import {
  getNewsletterMessageByGmailMessageId,
  type NewsletterDatabase,
  upsertNewsletterMessage,
  upsertNewsletterSource,
} from '@soundscape/newsletters-db';

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailNewsletterMessage {
  id: string;
  threadId?: string | null;
  internalDate?: string | null;
  sentAt?: string | null;
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  sourceName?: string | null;
  rawHtml?: string | null;
  rawText?: string | null;
  cleanedText?: string | null;
  headers?: GmailHeader[];
}

export interface BuildGmailSearchQueryInput {
  label: string;
  lastSuccessfulSyncAt?: string | null;
}

export function buildGmailSearchQuery(
  input: BuildGmailSearchQueryInput
): string {
  const terms = [`label:${input.label}`];

  if (input.lastSuccessfulSyncAt) {
    const cursorSeconds = Math.floor(
      new Date(input.lastSuccessfulSyncAt).getTime() / 1000
    );

    if (Number.isFinite(cursorSeconds) && cursorSeconds > 0) {
      terms.push(`after:${cursorSeconds}`);
    }
  }

  return terms.join(' ');
}

export function deriveNewsletterSourceName(
  message: Pick<GmailNewsletterMessage, 'sourceName' | 'senderName' | 'senderEmail'>
): string {
  const preferred = message.sourceName ?? message.senderName ?? message.senderEmail;
  return preferred?.trim() || 'unknown-newsletter';
}

export function persistRawGmailMessage(
  db: NewsletterDatabase,
  message: GmailNewsletterMessage
): { newsletterMessageId: number; sourceId: number | null } {
  const sourceId = message.senderEmail
    ? upsertNewsletterSource(db, {
        canonicalName: deriveNewsletterSourceName(message),
        senderEmail: message.senderEmail,
      })
    : null;

  const newsletterMessageId = upsertNewsletterMessage(db, {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId ?? null,
    sourceId,
    subject: message.subject ?? null,
    senderName: message.senderName ?? null,
    senderEmail: message.senderEmail ?? null,
    sentAt: message.sentAt ?? null,
    gmailInternalDate: message.internalDate ?? null,
    rawHtml: message.rawHtml ?? null,
    rawText: message.rawText ?? null,
    cleanedText: message.cleanedText ?? null,
    rawHeadersJson:
      message.headers && message.headers.length > 0
        ? JSON.stringify(message.headers)
        : null,
    extractionStatus: 'pending',
  });

  return {
    newsletterMessageId,
    sourceId,
  };
}

export function getPersistedRawGmailMessage(
  db: NewsletterDatabase,
  gmailMessageId: string
) {
  return getNewsletterMessageByGmailMessageId(db, gmailMessageId);
}
