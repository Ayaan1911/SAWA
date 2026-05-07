import type { ClaudeDecision, DriftScore, Gap, LogEntry } from '../types';

export function renderWeeklyReview(logs: LogEntry[], gaps: Gap[], drift: DriftScore, decision: ClaudeDecision): string {
  const recentLogs = logs.slice(-7);
  return `# Weekly Review

## Highlights
${recentLogs.map((log) => `- ${log.date}: ${log.summary}`).join('\n') || '- No recent logs.'}

## Gaps
${gaps.map((gap) => `- ${gap.goalId}: ${gap.reasons.join(' ')}`).join('\n') || '- No open gaps.'}

## Drift
- Score: ${drift.score}
- Velocity: ${drift.velocity}
- Trend: ${drift.trend}

## Latest Decision
- Provider: ${decision.provider}
- Summary: ${decision.summary}
- Next actions: ${decision.nextActions.join('; ')}
`;
}
