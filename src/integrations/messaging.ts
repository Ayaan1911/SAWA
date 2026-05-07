import type { ClaudeDecision, DeliveryResult, DriftScore, Gap } from '../types';
import { config } from '../config';

export function formatMessage(decision: ClaudeDecision, gaps: Gap[], drift: DriftScore): string {
  return [
    `SAWA heartbeat`,
    `Drift ${drift.score} (${drift.trend})`,
    decision.summary,
    gaps.length ? `Top gap: ${gaps[0].goalId} - ${gaps[0].title}` : 'No active execution gaps.',
    `Next: ${decision.nextActions.join(' | ')}`
  ].join('\n');
}

export async function deliverMessage(message: string): Promise<DeliveryResult> {
  if (config.whatsapp.accessToken && config.whatsapp.phoneNumberId && config.whatsapp.recipient) {
    return sendWhatsApp(message);
  }
  if (config.telegram.botToken && config.telegram.chatId) {
    return sendTelegram(message);
  }

  return {
    provider: 'dry-run',
    delivered: false,
    detail: 'Messaging adapters are implemented but not configured. Message was formatted successfully.'
  };
}

async function sendWhatsApp(message: string): Promise<DeliveryResult> {
  const response = await fetch(`https://graph.facebook.com/v22.0/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: config.whatsapp.recipient,
      type: 'text',
      text: { body: message }
    })
  });

  return {
    provider: 'whatsapp',
    delivered: response.ok,
    detail: response.ok ? 'WhatsApp Cloud API accepted the message.' : `WhatsApp failed with status ${response.status}.`
  };
}

async function sendTelegram(message: string): Promise<DeliveryResult> {
  const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: config.telegram.chatId,
      text: message
    })
  });

  return {
    provider: 'telegram',
    delivered: response.ok,
    detail: response.ok ? 'Telegram sendMessage accepted the message.' : `Telegram failed with status ${response.status}.`
  };
}
