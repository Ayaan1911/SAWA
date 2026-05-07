import type { DecomposedAction, DriftScore, Gap } from '../types';

export function buildRecoveryPlan(drift: DriftScore, gaps: Gap[], actions: DecomposedAction[]): string[] {
  if (drift.score < 0.55 && gaps.every((gap) => gap.severity !== 'high')) {
    return [];
  }

  const topActions = actions.slice(0, 3).map((action) => action.action);
  return [
    'Pause new commitments for the next heartbeat window.',
    ...topActions,
    'Write one honest log entry immediately after the recovery block.'
  ];
}
