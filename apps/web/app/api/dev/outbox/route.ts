import { latestOutboxMessage, normaliseMobile } from '@identity/db';
import { platform } from '@/lib/server/platform';

export const dynamic = 'force-dynamic';

/**
 * Development and tests only: the last one-time code "sent" to a number (F05-FR-03). Refused unless the
 * dev-outbox sender is configured, which production refuses at start-up (F05-AC-4.1).
 */
export async function GET(request: Request) {
  const { config, db } = await platform();
  if (config.otpSender !== 'dev-outbox' || config.appEnv === 'production') return new Response('Not found', { status: 404 });
  const mobile = normaliseMobile(new URL(request.url).searchParams.get('mobile') ?? '');
  const message = mobile ? await latestOutboxMessage(db, mobile) : null;
  if (!message) return new Response('Not found', { status: 404 });
  return Response.json({ body: message.body, at: message.createdAt }, { headers: { 'Cache-Control': 'no-store' } });
}
