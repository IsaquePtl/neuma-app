import type { createClient } from "@/lib/supabase/server";

import { mentorMayComplete } from "@/lib/nodes/evaluation";
import { nodeUsesQuizGate, quizPassScore } from "@/lib/nodes/pass-rule";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Mentor completion has to follow the level's pass rule.
 *
 * - quiz: a stored attempt at or above pass_score. A fail stays a fail.
 * - check_in: an approved submission, unless this call is the approval itself.
 * - mentor / none: the mentor may move the level (repair included).
 */
export async function assertMentorMayCompleteNode(
  supabase: Supabase,
  nodeId: string,
  mode: "advance" | "approve_check_in",
) {
  const { data: node, error } = await supabase
    .from("nodes")
    .select("id, path_id, pass_rule, pass_score")
    .eq("id", nodeId)
    .maybeSingle();
  if (error || !node) throw new Error("Nível não encontrado");

  const bestScore = nodeUsesQuizGate(node.pass_rule)
    ? await bestQuizScore(supabase, nodeId)
    : null;
  const approvedCheckIns =
    node.pass_rule === "check_in" && mode === "advance"
      ? await approvedCheckInCount(supabase, nodeId)
      : 0;

  const decision = mentorMayComplete({
    passRule: node.pass_rule,
    passScore: node.pass_score,
    bestScore,
    approvedCheckIns,
    mode,
  });
  if (!decision.ok) {
    const threshold = quizPassScore(node.pass_score);
    if (node.pass_rule === "quiz") {
      throw new Error(
        typeof bestScore === "number"
          ? `Este nível pede quiz. A melhor nota é ${bestScore}% e o limiar é ${threshold}%.`
          : `Este nível pede quiz. Ainda não há uma tentativa com pelo menos ${threshold}%.`,
      );
    }
    throw new Error(
      "Este nível pede check-in. Sem um envio aprovado o nível não avança.",
    );
  }

  return node;
}

async function bestQuizScore(supabase: Supabase, nodeId: string) {
  const { data: attempts, error } = await supabase
    .from("node_quiz_attempts")
    .select("score")
    .eq("node_id", nodeId)
    .order("score", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const best = attempts?.[0]?.score;
  return typeof best === "number" ? best : null;
}

async function approvedCheckInCount(supabase: Supabase, nodeId: string) {
  const { count, error } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("node_id", nodeId)
    .eq("status", "approved");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
