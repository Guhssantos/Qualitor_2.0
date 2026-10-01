/** Canal Microsoft Teams via Incoming Webhook / Workflows. */
export const teamsChannel = {
  name: 'teams',
  isConfigured: () => Boolean(process.env.TEAMS_WEBHOOK_URL),
  async send({ user, notification }) {
    await fetch(process.env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `**${notification.title}** (${user.name})\n\n${notification.message}` }),
    });
  },
};
