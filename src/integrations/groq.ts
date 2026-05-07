import Groq from 'groq-sdk';
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

export class GroqReasoningCore {
  private groq: Groq | null = null;

  private getClient(): Groq | null {
    if (!config.groq.apiKey) return null;
    if (!this.groq) {
      this.groq = new Groq({ apiKey: config.groq.apiKey });
    }
    return this.groq;
  }

  async decide(input: ReasoningInput): Promise<ClaudeDecision> {
    const client = this.getClient();
    if (!client) {
      return this.localFallback(input);
    }

    const userPrompt = buildPrompt(input);
    try {
      const response = await client.chat.completions.create({
        model: config.groq.model,
        messages: [
          {
            role: 'system',
            content: 'You are SAWA, a self-aware workflow agent. Return concise operational guidance.'
          },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        return this.localFallback(input, 'Groq response was empty.');
      }

      return {
        provider: 'groq',
        summary: firstSentence(text),
        message: text,
        nextActions: input.actions.slice(0, 3).map((action) => action.action),
        confidence: Math.max(0.35, 1 - input.drift.score),
        recoveryMode: input.recoveryPlan.length > 0
      };
    } catch (error) {
      return this.localFallback(input, error instanceof Error ? error.message : 'Groq call failed.');
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
    ]
      .filter(Boolean)
      .join(' ');

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
