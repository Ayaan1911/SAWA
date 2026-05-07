import type { Gap, Goal, LogEntry } from '../types';

export function detectGaps(goals: Goal[], logs: LogEntry[]): Gap[] {
  const recentLogs = logs.slice(-5);

  return goals
    .filter((goal) => goal.status !== 'complete')
    .map((goal) => {
      const mentions = recentLogs.filter((log) =>
        [...log.completed, ...log.blocked, log.summary]
          .join(' ')
          .toLowerCase()
          .includes(goal.title.toLowerCase().split(' ')[0])
      );
      const blockedHits = recentLogs.filter((log) =>
        log.blocked.some((item) => includesGoal(goal, item))
      );
      const reasons: string[] = [];

      if (mentions.length === 0) {
        reasons.push('No recent execution evidence in the last five log entries.');
      }
      if (blockedHits.length > 0) {
        reasons.push('Recent logs show the goal is blocked.');
      }
      if (goal.confidence < 0.75) {
        reasons.push('Planning confidence is below the working threshold.');
      }

      const severity: Gap['severity'] =
        blockedHits.length > 0 || reasons.length >= 2 ? 'high' :
        reasons.length === 1 ? 'medium' :
        'low';

      return {
        goalId: goal.id,
        title: goal.title,
        severity,
        reasons,
        lastSeen: mentions.at(-1)?.date ?? null
      };
    })
    .filter((gap) => gap.reasons.length > 0);
}

function includesGoal(goal: Goal, value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes(goal.id.toLowerCase()) || normalized.includes(goal.title.toLowerCase());
}
