import type { DriftScore, Gap, LogEntry } from '../types';

export function calculateDriftVelocity(gaps: Gap[], logs: LogEntry[]): DriftScore {
  const recentLogs = logs.slice(-5);
  const averageFocus = recentLogs.length
    ? recentLogs.reduce((sum, log) => sum + log.focus, 0) / recentLogs.length
    : 0.6;
  const averageEnergy = recentLogs.length
    ? recentLogs.reduce((sum, log) => sum + log.energy, 0) / recentLogs.length
    : 0.6;
  const highGapCount = gaps.filter((gap) => gap.severity === 'high').length;
  const mediumGapCount = gaps.filter((gap) => gap.severity === 'medium').length;

  const score = Math.min(
    1,
    0.45 * highGapCount + 0.2 * mediumGapCount + (1 - averageFocus) * 0.25 + (1 - averageEnergy) * 0.1
  );
  const previousWindow = logs.slice(-10, -5);
  const previousFocus = previousWindow.length
    ? previousWindow.reduce((sum, log) => sum + log.focus, 0) / previousWindow.length
    : averageFocus;
  const velocity = Number((score - Math.max(0, 1 - previousFocus)).toFixed(2));
  const trend =
    score >= 0.75 ? 'critical' :
    score >= 0.45 ? 'rising' :
    'stable';

  return {
    score: Number(score.toFixed(2)),
    velocity,
    trend,
    explanation: `Drift is ${trend} with ${highGapCount} high-severity gaps, average focus ${averageFocus.toFixed(2)}, and average energy ${averageEnergy.toFixed(2)}.`
  };
}
