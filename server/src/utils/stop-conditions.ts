import { stableHash } from "./stable-hash";

/**
 * Returns a StopCondition for ToolLoopAgent that halts the agent loop when
 * any tool+args pair has produced consecutive failures >= hardLimit times.
 *
 * Acts as a circuit-breaker: even if the LLM ignores selfCorrectionGuidance
 * returned in the tool result, this stops the loop and allows
 * generateSummaryResponse to inform the user.
 *
 * @param hardLimit - Number of identical failures before stopping. Default 3.
 */
export function repeatedFailureStop(hardLimit = 3) {
  return ({ steps }: { steps: any[] }) => {
    // Reason: Rebuild counts from scratch on every call because steps is the
    // full accumulated history. We reset on success so a passing call after
    // failures does not contribute to the loop count.
    const failCounts = new Map<string, number>();

    for (const step of steps) {
      for (const result of step.toolResults ?? []) {
        const output = result.result ?? result.output;
        const key = `${result.toolName}::${stableHash(result.args ?? result.input)}`;

        if (output?.success === false) {
          const count = (failCounts.get(key) ?? 0) + 1;
          failCounts.set(key, count);
          if (count >= hardLimit) return true;
        } else {
          failCounts.delete(key);
        }
      }
    }

    return false;
  };
}
