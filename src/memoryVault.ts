import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { appendText, ensureDir, ensureFile, listMarkdownFiles, readText, writeText } from './utils/fs';
import type { Goal, LogEntry, VaultSnapshot } from './types';

const defaultGoals = `# Goals

- [ ] G1 | Build SAWA heartbeat loop | tags: core,deep-work | confidence: 0.90
- [ ] G2 | Ship memory vault tooling | tags: memory,foundation | confidence: 0.95
- [ ] G3 | Stand up WhatsApp and Telegram delivery | tags: messaging,ops | confidence: 0.74
- [ ] G4 | Launch dashboard visibility | tags: dashboard,visibility | confidence: 0.71
`;

const defaultBehavior = `# Behavior

SAWA protects continuity, prefers a single next action, and escalates only after sustained drift.
`;

const defaultFingerprint = `# Fingerprint

- Prefers short recovery cycles over large re-plans.
- Responds well to direct accountability language.
- Loses momentum when context switching exceeds two open goals.
`;

const defaultInterventions = `# Intervention Memory

- 2026-05-07: Seeded repository and baseline recovery rules.
`;

const defaultLog = `# Daily Logs

## 2026-05-07T08:00:00.000Z
Summary: Repository audit and scaffold planning completed.
Completed: initial inventory
Blocked: missing backend implementation
Energy: 0.76
Focus: 0.64
Tags: setup,foundation
`;

export class MemoryVault {
  readonly root = config.memoryVaultPath;
  readonly goalsPath = path.join(this.root, 'goals.md');
  readonly behaviorPath = path.join(this.root, 'behavior.md');
  readonly fingerprintPath = path.join(this.root, 'fingerprint.md');
  readonly interventionsPath = path.join(this.root, 'intervention-memory.md');
  readonly logsDir = path.join(this.root, 'logs');
  readonly decisionsDir = path.join(this.root, 'decisions');
  readonly restartCardsDir = path.join(this.root, 'restart-cards');
  readonly reviewsDir = path.join(this.root, 'reviews');

  async initialize(): Promise<void> {
    await ensureDir(this.root);
    await ensureDir(this.logsDir);
    await ensureDir(this.decisionsDir);
    await ensureDir(this.restartCardsDir);
    await ensureDir(this.reviewsDir);
    await ensureFile(this.goalsPath, defaultGoals);
    await ensureFile(this.behaviorPath, defaultBehavior);
    await ensureFile(this.fingerprintPath, defaultFingerprint);
    await ensureFile(this.interventionsPath, defaultInterventions);
    await ensureFile(path.join(this.logsDir, '2026-05-07.md'), defaultLog);
    await ensureFile(path.join(this.decisionsDir, 'README.md'), '# Decisions\n');
    await ensureFile(path.join(this.restartCardsDir, 'README.md'), '# Restart Cards\n');
    await ensureFile(path.join(this.reviewsDir, 'README.md'), '# Weekly Reviews\n');
  }

  async readSnapshot(): Promise<VaultSnapshot> {
    const [goals, logs, behavior, fingerprint, interventions] = await Promise.all([
      this.readGoals(),
      this.readLogs(),
      readText(this.behaviorPath),
      readText(this.fingerprintPath),
      readText(this.interventionsPath)
    ]);

    return { goals, logs, behavior, fingerprint, interventions };
  }

  async readGoals(): Promise<Goal[]> {
    const content = await readText(this.goalsPath);
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- ['))
      .map((line): Goal | null => {
        const match = /- \[(?<done>[ xX])\] (?<id>[^|]+)\| (?<title>[^|]+)\| tags: (?<tags>[^|]+)\| confidence: (?<confidence>.+)/.exec(line);
        if (!match?.groups) {
          return null;
        }

        const status: Goal['status'] = match.groups.done.toLowerCase() === 'x' ? 'complete' : 'active';
        return {
          id: match.groups.id.trim(),
          title: match.groups.title.trim(),
          status,
          tags: match.groups.tags.split(',').map((tag) => tag.trim()),
          confidence: Number(match.groups.confidence.trim())
        } satisfies Goal;
      })
      .filter((goal): goal is Goal => goal !== null);
  }

  async readLogs(): Promise<LogEntry[]> {
    const files = (await fs.readdir(this.logsDir))
      .filter((file) => file.endsWith('.md'))
      .sort();
    const entries: LogEntry[] = [];

    for (const file of files) {
      const content = await readText(path.join(this.logsDir, file));
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.trim().split(/\r?\n/);
        const date = lines[0].trim();
        const fieldMap = new Map<string, string>();
        for (const line of lines.slice(1)) {
          const separator = line.indexOf(':');
          if (separator === -1) {
            continue;
          }
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim();
          fieldMap.set(key, value);
        }

        entries.push({
          date,
          summary: fieldMap.get('Summary') ?? '',
          completed: splitCsv(fieldMap.get('Completed')),
          blocked: splitCsv(fieldMap.get('Blocked')),
          energy: Number(fieldMap.get('Energy') ?? 0),
          focus: Number(fieldMap.get('Focus') ?? 0),
          tags: splitCsv(fieldMap.get('Tags'))
        });
      }
    }

    return entries.sort((left, right) => left.date.localeCompare(right.date));
  }

  async appendLog(entry: LogEntry): Promise<string> {
    const day = entry.date.slice(0, 10);
    const filePath = path.join(this.logsDir, `${day}.md`);
    const contents =
      (await fileExists(filePath)) ? '' : '# Daily Logs\n\n';

    const section = `## ${entry.date}
Summary: ${entry.summary}
Completed: ${entry.completed.join(', ') || 'none'}
Blocked: ${entry.blocked.join(', ') || 'none'}
Energy: ${entry.energy.toFixed(2)}
Focus: ${entry.focus.toFixed(2)}
Tags: ${entry.tags.join(', ') || 'none'}
`;

    if (contents) {
      await writeText(filePath, contents + section);
    } else {
      await appendText(filePath, `\n${section}`);
    }

    return filePath;
  }

  async writeDecision(slug: string, contents: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.decisionsDir, `${timestamp}-${slug}.md`);
    await writeText(filePath, contents);
    return filePath;
  }

  async writeRestartCard(contents: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.restartCardsDir, `${timestamp}-restart-card.md`);
    await writeText(filePath, contents);
    return filePath;
  }

  async writeWeeklyReview(contents: string): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filePath = path.join(this.reviewsDir, `${timestamp}-weekly-review.md`);
    await writeText(filePath, contents);
    return filePath;
  }

  async appendIntervention(entry: string): Promise<void> {
    await appendText(this.interventionsPath, `\n- ${entry}`);
  }

  async readAllMarkdown(): Promise<string[]> {
    return listMarkdownFiles(this.root);
  }
}

function splitCsv(value: string | undefined): string[] {
  if (!value || value === 'none') {
    return [];
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
