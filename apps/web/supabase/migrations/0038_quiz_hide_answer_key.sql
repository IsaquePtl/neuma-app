-- 0038: students must not read quiz answer keys.
--
-- 0015 granted SELECT on the whole node_quiz_questions row, including
-- correct_option_id. With pass_rule = quiz that key unlocks the next level.
-- The player loads prompts via the service role and returns them without
-- the answer. Mentors keep full access for the editor.

drop policy if exists "Students read own node_quiz_questions" on public.node_quiz_questions;
