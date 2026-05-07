import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = process.cwd();
const memoryVaultPath = path.resolve(rootDir, process.env.MEMORY_VAULT_PATH ?? 'memory-vault');

export const config = {
  rootDir,
  port: Number(process.env.PORT ?? 3000),
  heartbeatIntervalHours: Number(process.env.HEARTBEAT_INTERVAL_HOURS ?? 2),
  autoStartHeartbeat: process.env.AUTO_START_HEARTBEAT === 'true',
  memoryVaultPath,
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-latest'
  },
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    owner: process.env.GITHUB_WATCH_OWNER ?? '',
    repo: process.env.GITHUB_WATCH_REPO ?? ''
  },
  google: {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? path.resolve(rootDir, process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : ''
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    recipient: process.env.WHATSAPP_TO ?? ''
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? ''
  }
};
