import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { config } from './config';
import { MemoryVault } from './memoryVault';
import { HeartbeatDaemon } from './heartbeat';
import { detectGaps } from './engines/gapDetection';
import { calculateDriftVelocity } from './engines/driftVelocity';
import { decomposeGoals } from './engines/goalDecomposer';
import { buildRecoveryPlan } from './engines/recoveryMode';
import { renderRestartCard } from './engines/restartCard';
import { renderWeeklyReview } from './engines/weeklyReview';
import { buildInterventionEntry } from './engines/interventionMemory';
import { detectGoalConflicts } from './engines/conflictDetection';
import { getRepoInsight } from './integrations/github';
import { getResearchDigest } from './integrations/arxiv';

const OPENCLAW_TOKEN = 'sawa-runtime-terror-2026';

const SKILL_REGISTRY = [
  { name: 'gap-detector', description: 'Compare active goals against recent execution logs and surface unserved goals, stalled work, and explicit blockers.' },
  { name: 'drift-calculator', description: 'Score execution drift from recent logs, active gaps, energy, and focus trends.' },
  { name: 'goal-decomposer', description: 'Turn active goals into confidence-weighted next actions that are small enough for a single focus block.' },
  { name: 'recovery-mode', description: 'When drift or blockers cross threshold, shrink the plan into an immediate reset sequence.' },
  { name: 'restart-card', description: 'Create a short recovery artifact when drift becomes critical or repeated blockers accumulate.' },
  { name: 'weekly-review', description: 'Summarize recent logs, decisions, and drift into a weekly operating review.' },
  { name: 'intervention-memory', description: 'Record which escalations worked or failed so future heartbeats adapt their tone and pressure.' },
  { name: 'accountability-escalator', description: 'Raise the intensity of reminders only after drift stays high and missed execution evidence repeats.' },
  { name: 'repo-intelligence', description: 'Summarize recent repository activity from the GitHub API and feed it into the heartbeat reasoning cycle.' },
  { name: 'research-digest', description: 'Pull a short arXiv digest for current topics relevant to the active goals.' }
];

function openClawAuth(request: Request, response: Response, next: NextFunction): void {
  const token = request.headers['x-openclaw-token'];
  if (token !== OPENCLAW_TOKEN) {
    response.status(401).json({ error: 'unauthorized', timestamp: new Date().toISOString() });
    return;
  }
  next();
}

export function createServer(vault: MemoryVault, daemon: HeartbeatDaemon) {
  const app = express();
  const dashboardDir = path.resolve(config.rootDir, 'dashboard');

  app.use(express.json());
  app.use(express.static(dashboardDir));

  // ── Public endpoints ───────────────────────────────────────────────────────

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      agent: 'SAWA',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/skills', (_request, response) => {
    response.json(SKILL_REGISTRY);
  });

  // ── Existing dashboard API ─────────────────────────────────────────────────

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'sawa-agent' });
  });

  app.get('/api/vault', async (_request, response) => {
    response.json(await vault.readSnapshot());
  });

  app.post('/api/heartbeat/run', async (_request, response) => {
    response.json(await daemon.runOnce());
  });

  app.get('/api/checklist', async (_request, response) => {
    response.sendFile(path.resolve(config.rootDir, 'CHECKLIST.md'));
  });

  // ── OpenClaw skill routes (token-protected) ────────────────────────────────

  app.post('/skills/gap-detector', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const output = gaps.length
        ? gaps.map((g) => `[${g.severity.toUpperCase()}] ${g.goalId}: ${g.reasons.join(' ')}`).join('\n')
        : 'No gaps detected. All active goals have recent execution evidence.';
      const actions = gaps.slice(0, 3).map((g) => `Address gap in goal "${g.goalId}"`);
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/drift-calculator', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const output = `Drift is ${drift.trend} — score ${drift.score}, velocity ${drift.velocity}. ${drift.explanation}`;
      const actions = drift.trend === 'critical'
        ? ['Trigger recovery mode immediately', 'Pause new commitments', 'Write an honest log entry']
        : drift.trend === 'rising'
        ? ['Review open gaps', 'Reduce scope for this heartbeat window']
        : ['Continue current plan — drift is stable'];
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/goal-decomposer', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const actions = decomposeGoals(snapshot.goals, gaps);
      const output = actions.length
        ? actions.map((a) => `[${a.goalId}] (conf ${a.confidence}) ${a.action}`).join('\n')
        : 'No active goals to decompose.';
      response.json({ output, actions: actions.map((a) => a.action), timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/recovery-mode', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const decomposed = decomposeGoals(snapshot.goals, gaps);
      const plan = buildRecoveryPlan(drift, gaps, decomposed);
      const output = plan.length
        ? `Recovery plan activated:\n${plan.map((step) => `- ${step}`).join('\n')}`
        : 'No recovery required. Drift and gaps are within normal thresholds.';
      response.json({ output, actions: plan, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/restart-card', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const decomposed = decomposeGoals(snapshot.goals, gaps);
      const plan = buildRecoveryPlan(drift, gaps, decomposed);
      const card = renderRestartCard(gaps, drift, plan);
      const filePath = await vault.writeRestartCard(card);
      const output = `Restart card generated at ${filePath}.\n\n${card}`;
      response.json({ output, actions: plan, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/weekly-review', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const fakeDecision = {
        provider: 'local-fallback' as const,
        summary: 'Weekly summary generated via OpenClaw skill endpoint.',
        message: '',
        nextActions: [],
        confidence: 1 - drift.score,
        recoveryMode: false
      };
      const review = renderWeeklyReview(snapshot.logs, gaps, drift, fakeDecision);
      const filePath = await vault.writeWeeklyReview(review);
      const output = `Weekly review written to ${filePath}.\n\n${review}`;
      const actions = gaps.slice(0, 3).map((g) => `Close gap: ${g.goalId}`);
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/intervention-memory', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const entry = buildInterventionEntry(drift, gaps);
      if (entry) {
        await vault.appendIntervention(entry);
      }
      const output = entry
        ? `Intervention recorded: ${entry}`
        : `No intervention needed — drift score ${drift.score} is below escalation threshold.`;
      response.json({ output, actions: entry ? ['Escalation recorded to memory vault'] : [], timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/accountability-escalator', openClawAuth, async (_request, response) => {
    try {
      const snapshot = await vault.readSnapshot();
      const gaps = detectGaps(snapshot.goals, snapshot.logs);
      const drift = calculateDriftVelocity(gaps, snapshot.logs);
      const conflicts = detectGoalConflicts(snapshot.goals);
      const highGaps = gaps.filter((g) => g.severity === 'high');
      const shouldEscalate = drift.score >= 0.7 && highGaps.length > 0;
      const output = shouldEscalate
        ? `Accountability escalation triggered. Drift ${drift.score} — ${highGaps.length} high-severity gap(s): ${highGaps.map((g) => g.goalId).join(', ')}. Conflicts: ${conflicts.length}.`
        : `Escalation not triggered. Drift ${drift.score} is below threshold or no high-severity gaps present.`;
      const actions = shouldEscalate
        ? highGaps.map((g) => `Immediate action required on goal "${g.goalId}"`)
        : ['Continue monitoring — no escalation required'];
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/repo-intelligence', openClawAuth, async (_request, response) => {
    try {
      const insight = await getRepoInsight();
      const output = `${insight.summary}\n\nRecent commits:\n${insight.commits.map((c) => `- ${c}`).join('\n') || '- none'}`;
      const actions = insight.commits.slice(0, 3).map((c) => `Review commit: ${c}`);
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  app.post('/skills/research-digest', openClawAuth, async (_request, response) => {
    try {
      const digest = await getResearchDigest();
      const output = `${digest.summary}\n\nPapers:\n${digest.papers.map((p) => `- ${p}`).join('\n') || '- none'}`;
      const actions = digest.papers.slice(0, 3).map((p) => `Read paper: ${p}`);
      response.json({ output, actions, timestamp: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'unknown error', timestamp: new Date().toISOString() });
    }
  });

  return app;
}
