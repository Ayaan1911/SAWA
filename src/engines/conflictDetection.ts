import type { Goal, GoalConflict } from '../types';

const conflictPairs = [
  ['deep-work', 'meetings'],
  ['research', 'shipping'],
  ['ops', 'deep-work']
];

export function detectGoalConflicts(goals: Goal[]): GoalConflict[] {
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const conflicts: GoalConflict[] = [];

  for (let index = 0; index < activeGoals.length; index += 1) {
    for (let inner = index + 1; inner < activeGoals.length; inner += 1) {
      const left = activeGoals[index];
      const right = activeGoals[inner];

      for (const [tagA, tagB] of conflictPairs) {
        const leftHas = left.tags.includes(tagA) && right.tags.includes(tagB);
        const rightHas = left.tags.includes(tagB) && right.tags.includes(tagA);
        if (leftHas || rightHas) {
          conflicts.push({
            goalIds: [left.id, right.id],
            reason: `Tags ${tagA} and ${tagB} compete for the same execution window.`
          });
        }
      }
    }
  }

  return conflicts;
}
