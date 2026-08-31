import { revalidatePath } from "next/cache";

export function revalidateStudentFeedbackPaths(nodeId?: string) {
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/session/feedback");
  revalidatePath("/path", "layout");
  if (nodeId) {
    revalidatePath(`/path/${nodeId}`);
  }
}
