create or replace function public.broadcast_quiz_score_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object('action', TG_OP, 'table', 'quiz_scores'),
    'quiz_score_changed',
    'home-quiz-champion-rt',
    false
  );
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists quiz_scores_broadcast_change on public.quiz_scores;

create trigger quiz_scores_broadcast_change
after insert or update or delete on public.quiz_scores
for each row
execute function public.broadcast_quiz_score_change();
