-- Report workflow RPCs restored for Neon.
-- Runtime functions were missing after the Supabase -> Neon migration.
-- Keep this migration in source control so fresh environments reproduce production.

create or replace function public.review_report(p_report_type text,p_report_id uuid,p_action text,p_feedback text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_status text; v_author uuid; v_role text; v_reviewer_name text; v_next_status text;
begin
if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
if p_report_type not in ('weekly','growth','event') then raise exception '지원하지 않는 보고서 종류입니다.'; end if;
if p_action not in ('approve','reject') then raise exception '지원하지 않는 검토 작업입니다.'; end if;
if nullif(trim(coalesce(p_feedback,'')),'') is null then raise exception '검토 의견을 입력해주세요.'; end if;
select role,name into v_role,v_reviewer_name from public.user_roles where user_id=nullif(auth.uid()::text,'')::uuid and is_active=true order by case role when 'chief' then 1 when 'teacher' then 2 when 'president' then 3 else 99 end limit 1;
if p_report_type='weekly' then select status,author_id into v_status,v_author from public.weekly_reports where id=p_report_id for update;
elsif p_report_type='growth' then select status,author_id into v_status,v_author from public.growth_records where id=p_report_id for update;
else select status,author_id into v_status,v_author from public.event_reports where id=p_report_id for update; end if;
if v_author is null then raise exception '보고서를 찾을 수 없습니다.'; end if;
if v_role='president' and v_status<>'submitted' then raise exception '현재 회장이 검토할 수 있는 보고서 상태가 아닙니다.';
elsif v_role='teacher' and v_status<>'president_reviewed' then raise exception '현재 담당 교사가 검토할 수 있는 보고서 상태가 아닙니다.';
elsif v_role='chief' and v_status<>'reviewed' then raise exception '현재 부장이 최종 검토할 수 있는 보고서 상태가 아닙니다.';
elsif v_role not in ('president','teacher','chief') then raise exception '보고서 검토 권한이 없습니다.'; end if;
if p_action='reject' then v_next_status:='rejected'; elsif v_role='president' then v_next_status:='president_reviewed'; elsif v_role='teacher' then v_next_status:='reviewed'; else v_next_status:='approved'; end if;
if p_report_type='weekly' then update public.weekly_reports set status=v_next_status,feedback=trim(p_feedback),reviewer_name=coalesce(nullif(trim(v_reviewer_name),''),v_role),updated_at=now(),finalized_at=case when v_next_status='approved' then now() else null end where id=p_report_id;
elsif p_report_type='growth' then update public.growth_records set status=v_next_status,feedback=trim(p_feedback),reviewer_name=coalesce(nullif(trim(v_reviewer_name),''),v_role),updated_at=now(),finalized_at=case when v_next_status='approved' then now() else null end where id=p_report_id;
else update public.event_reports set status=v_next_status,feedback=trim(p_feedback),reviewer_name=coalesce(nullif(trim(v_reviewer_name),''),v_role),updated_at=now(),finalized_at=case when v_next_status='approved' then now() else null end where id=p_report_id; end if;
return jsonb_build_object('ok',true,'report_type',p_report_type,'report_id',p_report_id,'previous_status',v_status,'status',v_next_status,'reviewer_name',coalesce(nullif(trim(v_reviewer_name),''),v_role));
end;$function$;

create or replace function public.revise_report(p_report_type text,p_report_id uuid,p_changes jsonb,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_status text; v_role text; v_expected_status text; v_author uuid;
begin
if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
select role into v_role from public.user_roles where user_id=nullif(auth.uid()::text,'')::uuid and is_active=true order by case role when 'chief' then 1 when 'teacher' then 2 when 'president' then 3 else 99 end limit 1;
if v_role not in ('president','teacher') then raise exception '검토 중 보고서를 수정할 권한이 없습니다.'; end if;
v_expected_status:=case when v_role='president' then 'submitted' else 'president_reviewed' end;
if p_report_type='weekly' then select status,author_id into v_status,v_author from public.weekly_reports where id=p_report_id for update;
elsif p_report_type='growth' then select status,author_id into v_status,v_author from public.growth_records where id=p_report_id for update;
else select status,author_id into v_status,v_author from public.event_reports where id=p_report_id for update; end if;
if v_author is null then raise exception '보고서를 찾을 수 없습니다.'; end if;
if v_status<>v_expected_status then raise exception '현재 검토 단계에서는 보고서를 수정할 수 없습니다.'; end if;
if p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception '수정 내용이 올바르지 않습니다.'; end if;
if p_report_type='weekly' then update public.weekly_reports set progress_summary=case when p_changes ? 'progress_summary' then p_changes->>'progress_summary' else progress_summary end,special_notes=case when p_changes ? 'special_notes' then p_changes->>'special_notes' else special_notes end,attendance_count=case when p_changes ? 'attendance_count' and nullif(p_changes->>'attendance_count','') is not null then (p_changes->>'attendance_count')::integer else attendance_count end,revision_count=revision_count+1,last_edited_at=now(),last_edited_by=nullif(auth.uid()::text,'')::uuid,updated_at=now() where id=p_report_id;
elsif p_report_type='growth' then update public.growth_records set student_name=case when p_changes ? 'student_name' then p_changes->>'student_name' else student_name end,spiritual_growth=case when p_changes ? 'spiritual_growth' then p_changes->>'spiritual_growth' else spiritual_growth end,participation_change=case when p_changes ? 'participation_change' then p_changes->>'participation_change' else participation_change end,prayer_requests=case when p_changes ? 'prayer_requests' then p_changes->>'prayer_requests' else prayer_requests end,revision_count=revision_count+1,last_edited_at=now(),last_edited_by=nullif(auth.uid()::text,'')::uuid,updated_at=now() where id=p_report_id;
else update public.event_reports set event_name=case when p_changes ? 'event_name' then p_changes->>'event_name' else event_name end,participant_count=case when p_changes ? 'participant_count' and nullif(p_changes->>'participant_count','') is not null then (p_changes->>'participant_count')::integer else participant_count end,performance_summary=case when p_changes ? 'performance_summary' then p_changes->>'performance_summary' else performance_summary end,improvement_points=case when p_changes ? 'improvement_points' then p_changes->>'improvement_points' else improvement_points end,feedback_text=case when p_changes ? 'feedback_text' then p_changes->>'feedback_text' else feedback_text end,revision_count=revision_count+1,last_edited_at=now(),last_edited_by=nullif(auth.uid()::text,'')::uuid,updated_at=now() where id=p_report_id; end if;
return jsonb_build_object('ok',true,'report_id',p_report_id,'revision_saved',true,'note',coalesce(p_note,''));
end;$function$;

create or replace function public.withdraw_report(p_report_type text,p_report_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_status text; v_author uuid; v_is_author boolean; v_is_chief boolean;
begin
if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
if p_report_type='weekly' then select status,author_id into v_status,v_author from public.weekly_reports where id=p_report_id for update;
elsif p_report_type='growth' then select status,author_id into v_status,v_author from public.growth_records where id=p_report_id for update;
elsif p_report_type='event' then select status,author_id into v_status,v_author from public.event_reports where id=p_report_id for update;
else raise exception '지원하지 않는 보고서 종류입니다.'; end if;
if v_author is null then raise exception '보고서를 찾을 수 없습니다.'; end if;
v_is_author:=v_author=nullif(auth.uid()::text,'')::uuid; v_is_chief:=public.has_any_active_role(array['chief']);
if not ((v_is_author and v_status in ('submitted','president_reviewed','rejected')) or (v_is_chief and v_status='approved')) then raise exception '현재 계정은 이 보고서를 회수할 수 없습니다.'; end if;
if p_report_type='weekly' then update public.weekly_reports set status='draft',finalized_at=null,updated_at=now() where id=p_report_id;
elsif p_report_type='growth' then update public.growth_records set status='draft',finalized_at=null,updated_at=now() where id=p_report_id;
else update public.event_reports set status='draft',finalized_at=null,updated_at=now() where id=p_report_id; end if;
return jsonb_build_object('ok',true,'report_id',p_report_id,'status','draft','note',coalesce(p_note,''));
end;$function$;

create or replace function public.batch_finalize_reports(p_report_type text,p_report_ids uuid[],p_feedback text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_count integer;
begin
if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
if not public.has_any_active_role(array['chief']) then raise exception '부장 총검토 권한이 없습니다.'; end if;
if p_report_type not in ('weekly','growth','event') then raise exception '지원하지 않는 보고서 종류입니다.'; end if;
if p_report_ids is null or cardinality(p_report_ids)=0 then raise exception '최종 검토할 보고서를 선택해주세요.'; end if;
if nullif(trim(coalesce(p_feedback,'')),'') is null then raise exception '검토 의견을 입력해주세요.'; end if;
if p_report_type='weekly' then update public.weekly_reports set status='approved',feedback=trim(p_feedback),updated_at=now(),finalized_at=now() where id=any(p_report_ids) and status='reviewed';
elsif p_report_type='growth' then update public.growth_records set status='approved',feedback=trim(p_feedback),updated_at=now(),finalized_at=now() where id=any(p_report_ids) and status='reviewed';
else update public.event_reports set status='approved',feedback=trim(p_feedback),updated_at=now(),finalized_at=now() where id=any(p_report_ids) and status='reviewed'; end if;
get diagnostics v_count=row_count;
if v_count<>cardinality(p_report_ids) then raise exception '선택한 보고서 중 현재 부장 최종검토 상태가 아닌 항목이 포함되어 있습니다.'; end if;
return jsonb_build_object('ok',true,'report_type',p_report_type,'count',v_count,'status','approved');
end;$function$;

grant execute on function public.review_report(text,uuid,text,text) to authenticated;
grant execute on function public.revise_report(text,uuid,jsonb,text) to authenticated;
grant execute on function public.withdraw_report(text,uuid,text) to authenticated;
grant execute on function public.batch_finalize_reports(text,uuid[],text) to authenticated;
