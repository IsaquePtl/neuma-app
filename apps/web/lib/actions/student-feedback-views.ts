"use server";

import {
  markCheckInFeedbackViewed,
  markNodeFeedbackViewed,
  markStudentFeedbackViewed,
} from "@/lib/feedbacks/student";
import { revalidateStudentFeedbackPaths } from "@/lib/feedbacks/revalidate-student-feedback";
import type { StudentFeedbackViewRef } from "@/lib/feedbacks/student-shared";
import { createClient } from "@/lib/supabase/server";

export async function markStudentFeedbackViewedAction(
  refs: StudentFeedbackViewRef[],
): Promise<void> {
  if (refs.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await markStudentFeedbackViewed(supabase, user.id, refs);

  revalidateStudentFeedbackPaths();
}

export async function markNodeFeedbackViewedAction(
  nodeId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await markNodeFeedbackViewed(supabase, user.id, nodeId);
  revalidateStudentFeedbackPaths(nodeId);
}

export async function markCheckInFeedbackViewedAction(
  checkInId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await markCheckInFeedbackViewed(supabase, user.id, checkInId);
  revalidateStudentFeedbackPaths();
}
