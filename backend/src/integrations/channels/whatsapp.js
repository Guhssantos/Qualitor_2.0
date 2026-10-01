/**
 * Canal WhatsApp (stub). Implementar com WhatsApp Cloud API (Meta) ou Azure Communication Services.
 * Requer telefone do usuário (campo User.phone).
 */
export const whatsappChannel = {
  name: 'whatsapp',
  isConfigured: () => Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN),
  async send({ user, notification }) {
    if (!user.phone) return;
    console.info(`[whatsapp] para ${user.phone}: ${notification.title}`);
  },
};
