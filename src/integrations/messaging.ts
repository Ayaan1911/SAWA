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
  if (
    isConfiguredValue(config.whatsapp.accessToken) &&
    isConfiguredValue(config.whatsapp.phoneNumberId) &&
    isConfiguredValue(config.whatsapp.recipient)
  ) {
    return sendWhatsApp(message);
  }
  if (isConfiguredValue(config.telegram.botToken) && isConfiguredValue(config.telegram.chatId)) {
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
  const responseText = await response.text();

  return {
    provider: 'whatsapp',
    delivered: response.ok,
    detail: response.ok
      ? 'WhatsApp Cloud API accepted the message.'
      : `WhatsApp failed with status ${response.status}: ${responseText}`
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
  const responseText = await response.text();

  return {
    provider: 'telegram',
    delivered: response.ok,
    detail: response.ok
      ? 'Telegram sendMessage accepted the message.'
      : `Telegram failed with status ${response.status}: ${responseText}`
  };
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
