-- Drop existing policy
DROP POLICY IF EXISTS "Anyone can view plans" ON plans;

-- Create new policy that allows everyone to read plans
CREATE POLICY "Anyone can view plans" ON plans FOR SELECT USING (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'plans';