/**
 * Canal de e-mail (stub). Para ativar, instale um cliente SMTP (ex.: nodemailer)
 * ou Microsoft Graph (sendMail) e implemente `send`.
 */
export const emailChannel = {
  name: 'email',
  isConfigured: () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
  async send({ user, notification }) {
    console.info(`[email] para ${user.email}: ${notification.title}`);
  },
};
