import type { ClaudeDecision, DecomposedAction, DriftScore, Gap, GoalConflict, MeetingInsight, RepoInsight, ResearchDigest, VaultSnapshot } from '../types';
import { config } from '../config';

interface ReasoningInput {
  snapshot: VaultSnapshot;
  gaps: Gap[];
  drift: DriftScore;
  actions: DecomposedAction[];
  conflicts: GoalConflict[];
  repoInsight: RepoInsight;
  meetingInsight: MeetingInsight;
  researchDigest: ResearchDigest;
  recoveryPlan: string[];
}

export class ClaudeReasoningCore {
  async decide(input: ReasoningInput): Promise<ClaudeDecision> {
    if (!config.anthropic.apiKey) {
      return this.localFallback(input);
    }

    const prompt = buildPrompt(input);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.anthropic.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.anthropic.model,
          max_tokens: 700,
          system: 'You are SAWA, a self-aware workflow agent. Return concise operational guidance.',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        return this.localFallback(input, `Anthropic API failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = payload.content?.find((item) => item.type === 'text')?.text?.trim();
      if (!text) {
        return this.localFallback(input, 'Anthropic response was empty.');
      }

      return {
        provider: 'anthropic',
        summary: firstSentence(text),
        message: text,
        nextActions: input.actions.slice(0, 3).map((action) => action.action),
        confidence: Math.max(0.35, 1 - input.drift.score),
        recoveryMode: input.recoveryPlan.length > 0
      };
    } catch (error) {
      return this.localFallback(input, error instanceof Error ? error.message : 'Anthropic call failed.');
    }
  }

  private localFallback(input: ReasoningInput, note?: string): ClaudeDecision {
    const nextActions = input.actions.slice(0, 3).map((action) => action.action);
    const summary =
      input.gaps.length > 0
        ? `Refocus on ${input.gaps[0].title} and shrink the next step.`
        : 'Stay on the current plan and protect the next execution block.';

    const message = [
      summary,
      input.drift.explanation,
      input.conflicts.length ? `Conflict detected: ${input.conflicts[0].reason}` : 'No cross-goal conflicts detected.',
      note ? `Note: ${note}` : null
    ].filter(Boolean).join(' ');

    return {
      provider: 'local-fallback',
      summary,
      message,
      nextActions,
      confidence: Math.max(0.35, 1 - input.drift.score),
      recoveryMode: input.recoveryPlan.length > 0
    };
  }
}

function buildPrompt(input: ReasoningInput): string {
  return `
Heartbeat timestamp: ${new Date().toISOString()}

Goals:
${input.snapshot.goals.map((goal) => `- ${goal.id}: ${goal.title} [${goal.status}] confidence=${goal.confidence}`).join('\n')}

Recent logs:
${input.snapshot.logs.slice(-5).map((log) => `- ${log.date}: ${log.summary}; completed=${log.completed.join(', ') || 'none'}; blocked=${log.blocked.join(', ') || 'none'}`).join('\n')}

Gaps:
${input.gaps.map((gap) => `- ${gap.goalId}: ${gap.reasons.join(' ')}`).join('\n') || '- none'}

Drift:
- Score: ${input.drift.score}
- Velocity: ${input.drift.velocity}
- Trend: ${input.drift.trend}

Goal conflicts:
${input.conflicts.map((conflict) => `- ${conflict.goalIds.join(' vs ')}: ${conflict.reason}`).join('\n') || '- none'}

Repo intelligence:
${input.repoInsight.summary}

Meeting intelligence:
${input.meetingInsight.summary}

Research digest:
${input.researchDigest.summary}

Recovery plan:
${input.recoveryPlan.join('\n') || 'No recovery plan required.'}

Respond with:
1. one-paragraph heartbeat assessment
2. the best next message for the user
3. three concrete next actions
`;
}

function firstSentence(text: string): string {
  const match = text.match(/.*?[.!?](\s|$)/);
  return match ? match[0].trim() : text.trim();
}
