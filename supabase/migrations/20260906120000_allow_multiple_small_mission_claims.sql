-- Allow each active member to claim the same small mission independently.
-- A mission is not globally exclusive; only the same member's duplicate active claim is blocked.
-- Source-fix workflow trigger marker: 2026-09-06.
-- Verification trigger: rerun source fix application.
-- Verification trigger 2: 2026-09-06.
CREATE OR REPLACE FUNCTION public.claim_mission(p_mission_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment_id bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION '활성 사용자만 작은 사명을 수행할 수 있습니다.';
  END IF;

  PERFORM 1 FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 작은 사명입니다.';
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.mission_assignments
  WHERE mission_id = p_mission_id
    AND student_id = v_user_id
    AND status = 'assigned'
  LIMIT 1;

  IF v_assignment_id IS NOT NULL THEN
    RETURN v_assignment_id;
  END IF;

  INSERT INTO public.mission_assignments (mission_id, student_id, assigned_by, status)
  VALUES (p_mission_id, v_user_id, v_user_id, 'assigned')
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mission(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_mission(bigint) TO authenticated;
