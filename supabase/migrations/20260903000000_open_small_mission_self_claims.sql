-- Small missions: leaders publish, any authenticated member claims for themselves.
DROP POLICY IF EXISTS missions_insert_zone_leader ON public.missions;
CREATE POLICY missions_insert_assistant_zone_leader
ON public.missions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('assistant_zone_leader', 'zone_leader', 'president', 'teacher', 'chief')
  )
);

DROP POLICY IF EXISTS missions_update_zone_leader ON public.missions;
CREATE POLICY missions_update_assistant_zone_leader
ON public.missions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('assistant_zone_leader', 'zone_leader', 'president', 'teacher', 'chief')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('assistant_zone_leader', 'zone_leader', 'president', 'teacher', 'chief')
  )
);

DROP POLICY IF EXISTS missions_delete_zone_leader ON public.missions;
CREATE POLICY missions_delete_assistant_zone_leader
ON public.missions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND ur.role IN ('assistant_zone_leader', 'zone_leader', 'president', 'teacher', 'chief')
  )
);

DROP POLICY IF EXISTS ma_insert_assistant_zone_leader ON public.mission_assignments;
DROP POLICY IF EXISTS ma_insert_zone_leader ON public.mission_assignments;
CREATE POLICY ma_insert_self_claim
ON public.mission_assignments
FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND assigned_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
  )
);

CREATE OR REPLACE FUNCTION public.claim_mission(p_mission_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_mission_id bigint;
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

  IF EXISTS (
    SELECT 1
    FROM public.mission_assignments ma
    WHERE ma.mission_id = p_mission_id
      AND ma.status IN ('assigned', 'submitted', 'completed')
  ) THEN
    RAISE EXCEPTION '이미 다른 사용자가 맡은 작은 사명이에요.';
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
