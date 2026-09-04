import { Resend } from 'resend';

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');
    client = new Resend(apiKey);
  }
  return client;
}

export async function sendAlertEmail(subject: string, html: string): Promise<void> {
  const from = process.env.ALERTS_FROM_EMAIL;
  const to = process.env.ALERTS_TO_EMAIL;
  if (!from || !to) {
    console.warn('[alerts] ALERTS_FROM_EMAIL / ALERTS_TO_EMAIL not set — skipping digest email');
    return;
  }
  await getClient().emails.send({ from: `Fieldbook <${from}>`, to, subject, html });
}
