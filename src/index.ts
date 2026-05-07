import { config } from './config';
import { MemoryVault } from './memoryVault';
import { HeartbeatDaemon } from './heartbeat';
import { createServer } from './server';

async function main(): Promise<void> {
  const vault = new MemoryVault();
  await vault.initialize();
  const daemon = new HeartbeatDaemon(vault);
  const app = createServer(vault, daemon);

  if (config.autoStartHeartbeat) {
    daemon.start(config.heartbeatIntervalHours);
  }

  app.listen(config.port, () => {
    console.log(`SAWA server running on http://localhost:${config.port}`);
  });
}

void main();
