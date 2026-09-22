-- Restore the complete small-mission runtime after the Supabase -> Neon migration.
-- Keeps self-claim, proof submission/review/reset, and reviewer visibility aligned
-- with the roles already used by the mission UI.

create or replace function public.claim_mission(p_mission_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment_id bigint;
begin
  if v_user_id is null then raise exception '로그인이 필요해요.'; end if;
  if not exists (select 1 from public.user_roles where user_id=v_user_id and is_active=true) then
    raise exception '활성 사용자만 작은 사명을 맡을 수 있어요.';
  end if;

  perform 1 from public.missions where id=p_mission_id for update;
  if not found then raise exception '존재하지 않는 작은 사명이에요.'; end if;

  select id into v_assignment_id
  from public.mission_assignments
  where mission_id=p_mission_id
    and student_id=v_user_id
    and status in ('assigned','submitted','completed')
  limit 1;

  if v_assignment_id is not null then return v_assignment_id; end if;

  insert into public.mission_assignments (mission_id,student_id,assigned_by,status)
  values (p_mission_id,v_user_id,v_user_id,'assigned')
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.claim_mission(bigint) from public;
grant execute on function public.claim_mission(bigint) to authenticated;

create or replace function public.submit_mission_proof(p_assignment_id bigint,p_proof_image_url text,p_proof_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_student uuid; v_status text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  select student_id,status into v_student,v_status
  from public.mission_assignments where id=p_assignment_id for update;
  if v_student is null then raise exception '작은 사명을 찾을 수 없습니다.'; end if;
  if v_student<>auth.uid() then raise exception '본인이 맡은 작은 사명만 인증할 수 있습니다.'; end if;
  if v_status not in ('assigned','rejected') then raise exception '현재 인증을 제출할 수 없는 상태입니다.'; end if;
  if nullif(trim(coalesce(p_proof_note,'')),'') is null or length(trim(p_proof_note))<10 then raise exception '인증 내용을 10자 이상 입력해주세요.'; end if;
  if nullif(trim(coalesce(p_proof_image_url,'')),'') is null then raise exception '인증 사진을 첨부해주세요.'; end if;

  update public.mission_assignments
  set status='submitted',proof_image_url=trim(p_proof_image_url),proof_note=trim(p_proof_note),
      submitted_at=now(),reviewed_by=null,reviewed_at=null,reject_reason=null,completed_at=null
  where id=p_assignment_id;

  return jsonb_build_object('ok',true,'status','submitted','assignment_id',p_assignment_id);
end;
$$;

revoke all on function public.submit_mission_proof(bigint,text,text) from public;
grant execute on function public.submit_mission_proof(bigint,text,text) to authenticated;

create or replace function public.review_mission_assignment(p_assignment_id bigint,p_action text,p_reject_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text; v_student uuid; v_role text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id=auth.uid()
      and ur.is_active=true
      and ur.role in ('service_manager','zone_leader','teacher','chief')
  ) then
    raise exception '작은 사명 인증 검토 권한이 없습니다.';
  end if;

  select status,student_id into v_status,v_student
  from public.mission_assignments where id=p_assignment_id for update;
  if v_student is null then raise exception '인증 내역을 찾을 수 없습니다.'; end if;
  if v_status<>'submitted' then raise exception '현재 검토할 수 있는 인증이 아닙니다.'; end if;

  select role into v_role
  from (
    select ur.role from public.user_roles ur
    where ur.user_id=auth.uid() and ur.is_active=true
    union
    select ura.role from public.user_role_assignments ura
    join public.user_roles ur on ur.user_id=ura.user_id and ur.is_active=true
    where ura.user_id=auth.uid()
  ) roles
  where role in ('service_manager','zone_leader','teacher','chief')
  order by case role when 'chief' then 1 when 'teacher' then 2 when 'service_manager' then 3 when 'zone_leader' then 4 else 99 end
  limit 1;

  if p_action='approve' then
    update public.mission_assignments
    set status='completed',reviewed_by=auth.uid(),reviewed_at=now(),completed_at=now(),reject_reason=null
    where id=p_assignment_id;
  elsif p_action='reject' then
    if nullif(trim(coalesce(p_reject_reason,'')),'') is null then raise exception '반려 사유를 입력해주세요.'; end if;
    update public.mission_assignments
    set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),reject_reason=trim(p_reject_reason),completed_at=null
    where id=p_assignment_id;
  else
    raise exception '지원하지 않는 검토 작업입니다.';
  end if;

  return jsonb_build_object('ok',true,'status',(select status from public.mission_assignments where id=p_assignment_id),'assignment_id',p_assignment_id,'reviewer_role',v_role);
end;
$$;

revoke all on function public.review_mission_assignment(bigint,text,text) from public;
grant execute on function public.review_mission_assignment(bigint,text,text) to authenticated;

create or replace function public.reset_mission_proof(p_assignment_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text; v_student uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  if not public.has_any_active_role(array['service_manager','zone_leader','teacher','chief']) then
    raise exception '인증 초기화 권한이 없습니다.';
  end if;

  select status,student_id into v_status,v_student
  from public.mission_assignments where id=p_assignment_id for update;
  if v_student is null then raise exception '인증 내역을 찾을 수 없습니다.'; end if;
  if v_status not in ('submitted','completed','rejected') then raise exception '현재 인증을 초기화할 수 없습니다.'; end if;

  update public.mission_assignments
  set status='assigned',proof_image_url=null,proof_note=null,submitted_at=null,
      completed_at=null,reviewed_by=null,reviewed_at=null,reject_reason=null
  where id=p_assignment_id;

  return jsonb_build_object('ok',true,'status','assigned','assignment_id',p_assignment_id);
end;
$$;

revoke all on function public.reset_mission_proof(bigint) from public;
grant execute on function public.reset_mission_proof(bigint) to authenticated;

drop policy if exists ma_select_assistant_zone_leader on public.mission_assignments;
drop policy if exists ma_select_own_or_leader on public.mission_assignments;
create policy ma_select_own_or_mission_reviewer
on public.mission_assignments
for select to authenticated
using (
  student_id=auth.uid()
  or public.has_any_active_role(array['assistant_zone_leader','service_manager','zone_leader','teacher','chief'])
);

drop policy if exists ma_insert_self_claim on public.mission_assignments;
create policy ma_insert_self_claim
on public.mission_assignments
for insert to authenticated
with check (
  student_id=auth.uid()
  and assigned_by=auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.is_active=true
  )
);
