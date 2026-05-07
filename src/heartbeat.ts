import path from 'node:path';
import { MemoryVault } from './memoryVault';
import { detectGaps } from './engines/gapDetection';
import { calculateDriftVelocity } from './engines/driftVelocity';
import { decomposeGoals } from './engines/goalDecomposer';
import { detectGoalConflicts } from './engines/conflictDetection';
import { buildRecoveryPlan } from './engines/recoveryMode';
import { renderRestartCard } from './engines/restartCard';
import { renderWeeklyReview } from './engines/weeklyReview';
import { buildInterventionEntry } from './engines/interventionMemory';
import { GroqReasoningCore } from './integrations/groq';
import { deliverMessage, formatMessage } from './integrations/messaging';
import { getRepoInsight } from './integrations/github';
import { getMeetingInsight } from './integrations/googleCalendar';
import { getResearchDigest } from './integrations/arxiv';
import type { HeartbeatResult, LogEntry } from './types';

export class HeartbeatDaemon {
  constructor(
    private readonly vault: MemoryVault,
    private readonly reasoningCore = new GroqReasoningCore()
  ) {}

  async runOnce(): Promise<HeartbeatResult> {
    const snapshot = await this.vault.readSnapshot();
    const gaps = detectGaps(snapshot.goals, snapshot.logs);
    const drift = calculateDriftVelocity(gaps, snapshot.logs);
    const actions = decomposeGoals(snapshot.goals, gaps);
    const conflicts = detectGoalConflicts(snapshot.goals);
    const recoveryPlan = buildRecoveryPlan(drift, gaps, actions);
    const [repoInsight, meetingInsight, researchDigest] = await Promise.all([
      getRepoInsight(),
      getMeetingInsight(),
      getResearchDigest()
    ]);
    const decision = await this.reasoningCore.decide({
      snapshot,
      gaps,
      drift,
      actions,
      conflicts,
      repoInsight,
      meetingInsight,
      researchDigest,
      recoveryPlan
    });
    const message = formatMessage(decision, gaps, drift);
    const delivery = await deliverMessage(message);

    const decisionDocument = renderDecisionDocument({
      snapshot,
      gaps,
      drift,
      conflicts,
      decision,
      message,
      delivery,
      repoInsight,
      meetingInsight,
      researchDigest
    });
    const decisionPath = await this.vault.writeDecision('heartbeat-decision', decisionDocument);

    let restartCardPath: string | null = null;
    if (decision.recoveryMode) {
      restartCardPath = await this.vault.writeRestartCard(renderRestartCard(gaps, drift, recoveryPlan));
    }

    const intervention = buildInterventionEntry(drift, gaps);
    if (intervention) {
      await this.vault.appendIntervention(intervention);
    }

    await this.vault.appendLog(buildHeartbeatLog(gaps, drift, decision, delivery));

    if (new Date().getUTCDay() === 0) {
      const weeklyReview = renderWeeklyReview(snapshot.logs, gaps, drift, decision);
      await this.vault.writeWeeklyReview(weeklyReview);
    }

    return {
      timestamp: new Date().toISOString(),
      gaps,
      drift,
      repoInsight,
      meetingInsight,
      researchDigest,
      decision,
      delivery,
      decisionPath: path.relative(process.cwd(), decisionPath),
      restartCardPath: restartCardPath ? path.relative(process.cwd(), restartCardPath) : null
    };
  }

  start(intervalHours: number): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    return setInterval(() => {
      void this.runOnce();
    }, intervalMs);
  }
}

function renderDecisionDocument(input: {
  snapshot: Awaited<ReturnType<MemoryVault['readSnapshot']>>;
  gaps: HeartbeatResult['gaps'];
  drift: HeartbeatResult['drift'];
  conflicts: ReturnType<typeof detectGoalConflicts>;
  decision: HeartbeatResult['decision'];
  message: string;
  delivery: HeartbeatResult['delivery'];
  repoInsight: HeartbeatResult['repoInsight'];
  meetingInsight: HeartbeatResult['meetingInsight'];
  researchDigest: HeartbeatResult['researchDigest'];
}): string {
  return `# Heartbeat Decision

## Vault Read
- Goals loaded: ${input.snapshot.goals.length}
- Logs loaded: ${input.snapshot.logs.length}

## Gap Detection
${input.gaps.map((gap) => `- ${gap.goalId}: ${gap.reasons.join(' ')}`).join('\n') || '- none'}

## Drift
- Score: ${input.drift.score}
- Velocity: ${input.drift.velocity}
- Trend: ${input.drift.trend}

## Groq Core
- Provider: ${input.decision.provider}
- Summary: ${input.decision.summary}
- Confidence: ${input.decision.confidence}

## Messaging
- Provider: ${input.delivery.provider}
- Delivered: ${input.delivery.delivered}
- Detail: ${input.delivery.detail}

## Repo Intelligence
- ${input.repoInsight.summary}

## Meeting Intelligence
- ${input.meetingInsight.summary}

## Research Digest
- ${input.researchDigest.summary}

## Goal Conflicts
${input.conflicts.map((conflict) => `- ${conflict.goalIds.join(' vs ')}: ${conflict.reason}`).join('\n') || '- none'}

## User Message
${input.message}
`;
}

function buildHeartbeatLog(
  gaps: HeartbeatResult['gaps'],
  drift: HeartbeatResult['drift'],
  decision: HeartbeatResult['decision'],
  delivery: HeartbeatResult['delivery']
): LogEntry {
  return {
    date: new Date().toISOString(),
    summary: `${decision.summary} Delivery via ${delivery.provider}.`,
    completed: ['heartbeat loop'],
    blocked: delivery.delivered ? [] : [delivery.detail],
    energy: Math.max(0.35, 1 - drift.score),
    focus: Math.max(0.3, 1 - drift.score / 1.3),
    tags: ['heartbeat', ...gaps.map((gap) => gap.goalId.toLowerCase())]
  };
}
