import fs from 'node:fs/promises';
import path from 'node:path';
import Groq from 'groq-sdk';
import { config } from '../config';
import { MemoryVault } from '../memoryVault';
import { detectGaps } from '../engines/gapDetection';
import { calculateDriftVelocity } from '../engines/driftVelocity';
import { decomposeGoals } from '../engines/goalDecomposer';
import { detectGoalConflicts } from '../engines/conflictDetection';
import { buildRecoveryPlan } from '../engines/recoveryMode';
import { GroqReasoningCore } from '../integrations/groq';
import { deliverMessage, formatMessage } from '../integrations/messaging';
import { getRepoInsight } from '../integrations/github';
import { getMeetingInsight } from '../integrations/googleCalendar';
import { getResearchDigest } from '../integrations/arxiv';

const requiredEnvKeys = [
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'GITHUB_TOKEN',
  'GITHUB_WATCH_OWNER',
  'GITHUB_WATCH_REPO',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'HEARTBEAT_INTERVAL_HOURS',
  'MEMORY_VAULT_PATH',
  'PORT'
] as const;

async function main(): Promise<void> {
  const vault = new MemoryVault();
  await vault.initialize();

  await step1VerifyEnv();
  await step2VerifyVault();
  const heartbeatState = await step3RunHeartbeat(vault);
  await step4VerifyTelegram(heartbeatState.message, heartbeatState.delivery);
  await step5VerifyGitHub();
  await step6VerifyGroq();
}

async function step1VerifyEnv(): Promise<void> {
  console.log('STEP 1 — Verify .env keys');
  for (const key of requiredEnvKeys) {
    const value = process.env[key] ?? '';
    const set = isConfiguredValue(value);
    console.log(`${set ? 'PASS' : 'FAIL'} ${key}: ${set ? 'set' : 'missing or placeholder'}`);
  }
  console.log('');
}

async function step2VerifyVault(): Promise<void> {
  console.log('STEP 2 — Verify memory vault files');
  const checks = [
    path.join(config.memoryVaultPath, 'goals.md'),
    path.join(config.memoryVaultPath, 'behavior.md'),
    path.join(config.memoryVaultPath, 'fingerprint.md'),
    path.join(config.memoryVaultPath, 'projects.md')
  ];

  for (const filePath of checks) {
    const contents = await fs.readFile(filePath, 'utf8');
    console.log(`${contents.trim() ? 'PASS' : 'FAIL'} ${path.relative(process.cwd(), filePath)} ${contents.trim() ? 'has content' : 'is empty'}`);
  }

  const directories = [
    path.join(config.memoryVaultPath, 'logs'),
    path.join(config.memoryVaultPath, 'decisions'),
    path.join(config.memoryVaultPath, 'interventions'),
    path.join(config.memoryVaultPath, 'restart_cards')
  ];

  for (const dirPath of directories) {
    const stat = await fs.stat(dirPath);
    console.log(`${stat.isDirectory() ? 'PASS' : 'FAIL'} ${path.relative(process.cwd(), dirPath)} directory ${stat.isDirectory() ? 'exists' : 'missing'}`);
  }
  console.log('');
}

async function step3RunHeartbeat(vault: MemoryVault): Promise<{ message: string; delivery: Awaited<ReturnType<typeof deliverMessage>> }> {
  console.log('STEP 3 — Manual heartbeat simulation');
  const snapshot = await vault.readSnapshot();
  console.log(`PASS 1. Read goals.md from memory vault (${snapshot.goals.length} goals)`);
  console.log(`PASS 2. Read logs/ folder (${snapshot.logs.length} log entries)`);

  const gaps = detectGaps(snapshot.goals, snapshot.logs);
  console.log(`PASS 3. Gap detection ran (${gaps.length} gaps)`);

  const drift = calculateDriftVelocity(gaps, snapshot.logs);
  console.log(`PASS 4. Drift velocity calculated (score=${drift.score}, velocity=${drift.velocity}, trend=${drift.trend})`);

  const actions = decomposeGoals(snapshot.goals, gaps);
  const conflicts = detectGoalConflicts(snapshot.goals);
  const recoveryPlan = buildRecoveryPlan(drift, gaps, actions);
  const [repoInsight, meetingInsight, researchDigest] = await Promise.all([
    getRepoInsight(),
    getMeetingInsight(),
    getResearchDigest()
  ]);
  const reasoning = new GroqReasoningCore();
  const decision = await reasoning.decide({
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

  console.log(`${decision.provider === 'groq' ? 'PASS' : 'FAIL'} 5. Groq API reasoning ${decision.provider === 'groq' ? 'called successfully' : `fell back to ${decision.provider}`}`);

  const message = formatMessage(decision, gaps, drift);
  console.log(`PASS 6. Telegram message formatted:\n${message}`);

  const delivery = await deliverMessage(message);
  console.log(`${delivery.provider === 'telegram' && delivery.delivered ? 'PASS' : 'FAIL'} 7. Telegram delivery ${delivery.provider}/${delivery.delivered ? 'delivered' : 'not delivered'} — ${delivery.detail}`);

  const decisionDocument = `# Heartbeat Decision

## Summary
- Provider: ${decision.provider}
- Drift: ${drift.score} (${drift.trend})
- Delivery: ${delivery.provider} / ${delivery.delivered}

## Message
${message}
`;
  const decisionPath = await vault.writeDecision('heartbeat-decision', decisionDocument);
  console.log(`PASS 8. Decision entry written to ${path.relative(process.cwd(), decisionPath)}`);

  await vault.appendLog({
    date: new Date().toISOString(),
    summary: `${decision.summary} Delivery via ${delivery.provider}.`,
    completed: ['heartbeat loop'],
    blocked: delivery.delivered ? [] : [delivery.detail],
    energy: Math.max(0.35, 1 - drift.score),
    focus: Math.max(0.3, 1 - drift.score / 1.3),
    tags: ['heartbeat', ...gaps.map((gap) => gap.goalId.toLowerCase())]
  });
  console.log('PASS 9. Console logging completed');
  console.log('');

  return { message, delivery };
}

async function step4VerifyTelegram(message: string, delivery: Awaited<ReturnType<typeof deliverMessage>>): Promise<void> {
  console.log('STEP 4 — Verify Telegram message');
  console.log(`Message sent:\n${message}`);
  console.log(`${delivery.provider === 'telegram' && delivery.delivered ? 'PASS' : 'FAIL'} Delivery detail: ${delivery.detail}`);
  console.log('');
}

async function step5VerifyGitHub(): Promise<void> {
  console.log('STEP 5 — Verify GitHub integration');
  try {
    const response = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}`, {
      headers: {
        Authorization: `Bearer ${config.github.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'sawa-agent'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      console.log(`FAIL GitHub metadata request failed: ${response.status} ${body}`);
      console.log('');
      return;
    }

    const payload = (await response.json()) as { full_name: string; visibility?: string; private: boolean };
    console.log(`PASS Repo metadata fetched: ${payload.full_name}, visibility=${payload.visibility ?? (payload.private ? 'private' : 'public')}`);
  } catch (error) {
    console.log(`FAIL GitHub metadata request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  console.log('');
}

async function step6VerifyGroq(): Promise<void> {
  console.log('STEP 6 — Verify Groq API');
  try {
    const client = new Groq({ apiKey: config.groq.apiKey });
    const response = await client.chat.completions.create({
      model: config.groq.model,
      messages: [{ role: 'user', content: 'Respond with exactly: SAWA Groq connection verified' }],
      max_tokens: 50
    });
    const text = response.choices[0]?.message?.content?.trim() ?? '';
    console.log(`${text === 'SAWA Groq connection verified' ? 'PASS' : 'FAIL'} Groq response: ${text}`);
  } catch (error) {
    console.log(`FAIL Groq request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  console.log('');
}

function isConfiguredValue(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  const lowered = value.toLowerCase();
  return !(
    lowered.includes('your_') ||
    lowered.includes('changeme') ||
    lowered.includes('placeholder')
  );
}

void main();
