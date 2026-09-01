import { revalidatePath } from "next/cache";

export function revalidateStudentFeedbackPaths(nodeId?: string) {
  revalidatePath("/home");
  revalidatePath("/home", "layout");
  revalidatePath("/session");
  revalidatePath("/session", "layout");
  revalidatePath("/session/feedback");
  revalidatePath("/path", "layout");
  revalidatePath("/checkins");
  if (nodeId) {
    revalidatePath(`/path/${nodeId}`);
  }
}
