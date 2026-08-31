-- Bug: after 회장(president) approves a report, its status moves from
-- 'submitted' to 'president_reviewed' — but the *_select_president RLS
-- policies only granted SELECT while status = 'submitted'. The moment a
-- president reviewed a report, they lost the ability to see it at all,
-- so it could never appear under the "회장검토완료" tab in the report list.
--
-- Fix: let the president also see reports they've already advanced past
-- their own review stage (president_reviewed / reviewed / approved),
-- not just the ones still waiting on them.

drop policy if exists "weekly_select_president" on public.weekly_reports;
create policy "weekly_select_president"
  on public.weekly_reports for select
  using (
    get_user_role() = 'president'
    and status in ('submitted', 'president_reviewed', 'reviewed', 'approved')
  );

drop policy if exists "growth_select_president" on public.growth_records;
create policy "growth_select_president"
  on public.growth_records for select
  using (
    get_user_role() = 'president'
    and status in ('submitted', 'president_reviewed', 'reviewed', 'approved')
  );

drop policy if exists "event_select_president" on public.event_reports;
create policy "event_select_president"
  on public.event_reports for select
  using (
    get_user_role() = 'president'
    and status in ('submitted', 'president_reviewed', 'reviewed', 'approved')
  );
