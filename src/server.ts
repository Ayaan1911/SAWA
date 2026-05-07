import express from 'express';
import path from 'node:path';
import { config } from './config';
import { MemoryVault } from './memoryVault';
import { HeartbeatDaemon } from './heartbeat';

export function createServer(vault: MemoryVault, daemon: HeartbeatDaemon) {
  const app = express();
  const dashboardDir = path.resolve(config.rootDir, 'dashboard');

  app.use(express.json());
  app.use(express.static(dashboardDir));

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

  return app;
}
