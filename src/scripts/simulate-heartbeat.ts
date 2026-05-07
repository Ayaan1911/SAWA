import { MemoryVault } from '../memoryVault';
import { HeartbeatDaemon } from '../heartbeat';

async function simulate(): Promise<void> {
  const vault = new MemoryVault();
  await vault.initialize();
  const daemon = new HeartbeatDaemon(vault);
  const result = await daemon.runOnce();
  console.log(JSON.stringify(result, null, 2));
}

void simulate();
