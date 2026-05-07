import type { DriftScore, Gap } from '../types';

export function renderRestartCard(gaps: Gap[], drift: DriftScore, recoveryPlan: string[]): string {
  return `# Restart Card

## Situation
- Drift score: ${drift.score}
- Trend: ${drift.trend}
- Triggered gaps: ${gaps.map((gap) => `${gap.goalId} (${gap.severity})`).join(', ') || 'none'}

## Immediate Reset
${recoveryPlan.map((step) => `- ${step}`).join('\n') || '- Stay on the current plan.'}

## Why This Matters
${drift.explanation}
`;
}
