import { env } from '../../config/env.js';
import { emailChannel } from './email.js';
import { teamsChannel } from './teams.js';
import { whatsappChannel } from './whatsapp.js';
import { telegramChannel } from './telegram.js';

/**
 * Registro de canais externos de notificação.
 * Cada canal implementa: { name, isConfigured(): boolean, send({ user, notification }): Promise<void> }
 * Ative via NOTIFY_CHANNELS=email,teams,whatsapp,telegram.
 */
const registry = [emailChannel, teamsChannel, whatsappChannel, telegramChannel];

export function activeChannels() {
  return registry.filter((c) => env.notifyChannels.includes(c.name) && c.isConfigured());
}

export async function dispatchExternal(user, notification) {
  for (const channel of activeChannels()) {
    try {
      await channel.send({ user, notification });
    } catch (err) {
      console.error(`[notify:${channel.name}] falha`, err.message);
    }
  }
}
