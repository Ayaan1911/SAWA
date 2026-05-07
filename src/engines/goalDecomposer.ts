import type { DecomposedAction, Gap, Goal } from '../types';

export function decomposeGoals(goals: Goal[], gaps: Gap[]): DecomposedAction[] {
  return goals
    .filter((goal) => goal.status === 'active')
    .flatMap((goal) => {
      const gap = gaps.find((item) => item.goalId === goal.id);
      const baseConfidence = Math.max(0.35, Math.min(0.98, goal.confidence - (gap?.severity === 'high' ? 0.15 : 0)));

      return [
        {
          goalId: goal.id,
          action: `Define the next concrete deliverable for ${goal.title}.`,
          confidence: Number(baseConfidence.toFixed(2))
        },
        {
          goalId: goal.id,
          action: `Schedule one 45-minute protected block for ${goal.title}.`,
          confidence: Number((baseConfidence - 0.05).toFixed(2))
        }
      ];
    });
}
