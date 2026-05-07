import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { appendText, ensureDir, ensureFile, listMarkdownFiles, readText, writeText } from './utils/fs';
import type { Goal, LogEntry, VaultSnapshot } from './types';

const defaultGoals = `# Goals

---
id: goal-001
title: Complete DSA Arrays module
status: active
priority: high
deadline: 2026-05-10
estimatedHours: 4
---
# DSA Arrays
Work through sliding window and two-pointer problems on LeetCode.

---
id: goal-002
title: Fix SAWA repo intelligence tool
status: active
priority: high
deadline: 2026-05-08
estimatedHours: 3
---
# Repo Intelligence
Ensure the GitHub API integration creates issues correctly.
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

const defaultProjects = `# Projects

## SAWA Agent
- Stabilize the Groq, Telegram, and GitHub integrations.
- Keep the heartbeat loop observable through decisions and restart cards.
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
  readonly projectsPath = path.join(this.root, 'projects.md');
  readonly interventionsSummaryPath = path.join(this.root, 'intervention-memory.md');
  readonly logsDir = path.join(this.root, 'logs');
  readonly decisionsDir = path.join(this.root, 'decisions');
  readonly interventionsDir = path.join(this.root, 'interventions');
  readonly restartCardsDir = path.join(this.root, 'restart_cards');
  readonly reviewsDir = path.join(this.root, 'reviews');

  async initialize(): Promise<void> {
    await ensureDir(this.root);
    await ensureDir(this.logsDir);
    await ensureDir(this.decisionsDir);
    await ensureDir(this.interventionsDir);
    await ensureDir(this.restartCardsDir);
    await ensureDir(this.reviewsDir);
    await this.ensureGoalsFile();
    await ensureFile(this.behaviorPath, defaultBehavior);
    await ensureFile(this.fingerprintPath, defaultFingerprint);
    await ensureFile(this.projectsPath, defaultProjects);
    await ensureFile(this.interventionsSummaryPath, defaultInterventions);
    await ensureFile(path.join(this.logsDir, '2026-05-07.md'), defaultLog);
    await ensureFile(path.join(this.decisionsDir, 'README.md'), '# Decisions\n');
    await ensureFile(path.join(this.interventionsDir, 'README.md'), '# Interventions\n');
    await ensureFile(path.join(this.restartCardsDir, 'README.md'), '# Restart Cards\n');
    await ensureFile(path.join(this.reviewsDir, 'README.md'), '# Weekly Reviews\n');
  }

  async readSnapshot(): Promise<VaultSnapshot> {
    const [goals, logs, behavior, fingerprint, interventions] = await Promise.all([
      this.readGoals(),
      this.readLogs(),
      readText(this.behaviorPath),
      readText(this.fingerprintPath),
      this.readInterventions()
    ]);

    return { goals, logs, behavior, fingerprint, interventions };
  }

  async readGoals(): Promise<Goal[]> {
    const content = await readText(this.goalsPath);
    const frontmatterGoals = parseStructuredGoals(content);
    if (frontmatterGoals.length > 0) {
      return frontmatterGoals;
    }

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
    const day = new Date().toISOString().slice(0, 10);
    const interventionsFile = path.join(this.interventionsDir, `${day}.md`);
    const header = (await fileExists(interventionsFile)) ? '' : '# Interventions\n';

    if (header) {
      await writeText(interventionsFile, `${header}\n- ${entry}\n`);
    } else {
      await appendText(interventionsFile, `- ${entry}\n`);
    }

    await appendText(this.interventionsSummaryPath, `\n- ${entry}`);
  }

  async readAllMarkdown(): Promise<string[]> {
    return listMarkdownFiles(this.root);
  }

  private async ensureGoalsFile(): Promise<void> {
    if (!(await fileExists(this.goalsPath))) {
      await ensureFile(this.goalsPath, defaultGoals);
      return;
    }

    const content = await readText(this.goalsPath);
    if (!content.trim() || isPlaceholderGoals(content)) {
      await writeText(this.goalsPath, defaultGoals);
    }
  }

  private async readInterventions(): Promise<string> {
    const files = (await fs.readdir(this.interventionsDir)).filter((file) => file.endsWith('.md'));
    const entries = await Promise.all(files.map((file) => readText(path.join(this.interventionsDir, file))));
    const summary = await readText(this.interventionsSummaryPath);
    return [summary, ...entries].filter(Boolean).join('\n');
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

function isPlaceholderGoals(content: string): boolean {
  return content.includes('Build SAWA heartbeat loop') || content.includes('- [ ] G1 |');
}

function parseStructuredGoals(content: string): Goal[] {
  const matches = [...content.matchAll(/---\s*\r?\n([\s\S]*?)\r?\n---/g)];
  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match) => {
      const metadata = new Map<string, string>();
      for (const line of match[1].split(/\r?\n/)) {
        const separator = line.indexOf(':');
        if (separator === -1) {
          continue;
        }
        metadata.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
      }

      const id = metadata.get('id');
      const title = metadata.get('title');
      const status = metadata.get('status') as Goal['status'] | undefined;
      if (!id || !title || !status) {
        return null;
      }

      const priority = metadata.get('priority') ?? 'medium';
      const confidence =
        priority === 'high' ? 0.9 :
        priority === 'low' ? 0.6 :
        0.75;

      return {
        id,
        title,
        status,
        tags: title
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .slice(0, 3),
        confidence
      } satisfies Goal;
    })
    .filter((goal): goal is Goal => goal !== null);
}
