/**
 * Canal Telegram (stub). Implementar com a Bot API (sendMessage) após vincular o chat_id ao usuário.
 */
export const telegramChannel = {
  name: 'telegram',
  isConfigured: () => Boolean(process.env.TELEGRAM_BOT_TOKEN),
  async send({ user, notification }) {
    console.info(`[telegram] para ${user.name}: ${notification.title}`);
  },
};
