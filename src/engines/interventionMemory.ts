import type { DriftScore, Gap } from '../types';

export function buildInterventionEntry(drift: DriftScore, gaps: Gap[]): string | null {
  if (drift.score < 0.7) {
    return null;
  }

  const highGaps = gaps.filter((gap) => gap.severity === 'high').map((gap) => gap.goalId);
  return `${new Date().toISOString()}: Accountability escalation triggered at drift ${drift.score}. High gaps: ${highGaps.join(', ') || 'none'}.`;
}
