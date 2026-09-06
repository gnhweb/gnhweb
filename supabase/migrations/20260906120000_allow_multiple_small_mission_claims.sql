-- Allow each active member to claim the same small mission independently.
-- A mission is not globally exclusive; only the same member's duplicate active claim is blocked.
CREATE OR REPLACE FUNCTION public.claim_mission(p_mission_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_mission_id bigint;
  existing_assignment_id bigint;
  new_assignment_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
  ) THEN
    RAISE EXCEPTION '활성 사용자만 작은 사명을 맡을 수 있어요.';
  END IF;

  SELECT id
    INTO locked_mission_id
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF locked_mission_id IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 작은 사명이에요.';
  END IF;

  SELECT ma.id
    INTO existing_assignment_id
  FROM public.mission_assignments ma
  WHERE ma.mission_id = p_mission_id
    AND ma.student_id = auth.uid()
    AND ma.status IN ('assigned', 'submitted', 'completed')
  ORDER BY ma.assigned_at DESC
  LIMIT 1;

  IF existing_assignment_id IS NOT NULL THEN
    RETURN existing_assignment_id;
  END IF;

  INSERT INTO public.mission_assignments (
    mission_id,
    student_id,
    assigned_by,
    status
  ) VALUES (
    p_mission_id,
    auth.uid(),
    auth.uid(),
    'assigned'
  )
  RETURNING id INTO new_assignment_id;

  RETURN new_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mission(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_mission(bigint) TO authenticated;
