import {
  getNewsletterMessageByGmailMessageId,
  type NewsletterDatabase,
  upsertNewsletterMessage,
  upsertNewsletterSource,
} from '@soundscape/newsletters-db';
import type { GmailMessageHeader, GmailMessagePayload } from './normalize-email.js';

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

export interface GmailApiCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
}

export interface GmailLabel {
  id: string;
  name: string;
}

export interface GmailApiMessageRef {
  id: string;
  threadId?: string;
}

export interface GmailApiMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailMessagePayload | null;
}

export interface GmailApiClient {
  resolveLabelByName(labelName: string): Promise<GmailLabel | null>;
  listMessageRefs(input: {
    labelId: string;
    query: string;
  }): Promise<GmailApiMessageRef[]>;
  getMessage(messageId: string): Promise<GmailApiMessage>;
}

export interface FetchedGmailSyncData {
  label: GmailLabel;
  query: string;
  messageRefs: GmailApiMessageRef[];
  messages: GmailApiMessage[];
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

export function buildGmailApiQuery(
  input: BuildGmailSearchQueryInput
): string {
  if (!input.lastSuccessfulSyncAt) {
    return '';
  }

  const cursorSeconds = Math.floor(
    new Date(input.lastSuccessfulSyncAt).getTime() / 1000
  );

  if (!Number.isFinite(cursorSeconds) || cursorSeconds <= 0) {
    return '';
  }

  return `after:${cursorSeconds}`;
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

export function createGmailApiClient(
  credentials: GmailApiCredentials,
  fetchImpl: typeof fetch = fetch
): GmailApiClient {
  let accessTokenPromise: Promise<string> | null = null;

  async function getAccessToken(): Promise<string> {
    accessTokenPromise ??= requestAccessToken(credentials, fetchImpl);
    return accessTokenPromise;
  }

  async function authorizedGet<T>(path: string): Promise<T> {
    const accessToken = await getAccessToken();
    const response = await fetchImpl(`https://gmail.googleapis.com${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      accessTokenPromise = requestAccessToken(credentials, fetchImpl);
      const nextAccessToken = await accessTokenPromise;
      const retryResponse = await fetchImpl(`https://gmail.googleapis.com${path}`, {
        headers: {
          Authorization: `Bearer ${nextAccessToken}`,
        },
      });

      if (!retryResponse.ok) {
        throw new Error(
          `Gmail API request failed: ${retryResponse.status} ${retryResponse.statusText} ${await retryResponse.text()}`
        );
      }

      return (await retryResponse.json()) as T;
    }

    if (!response.ok) {
      throw new Error(
        `Gmail API request failed: ${response.status} ${response.statusText} ${await response.text()}`
      );
    }

    return (await response.json()) as T;
  }

  return {
    async resolveLabelByName(labelName) {
      const payload = await authorizedGet<{ labels?: Array<{ id?: string; name?: string }> }>(
        '/gmail/v1/users/me/labels'
      );

      const normalizedLabelName = labelName.trim().toLowerCase();
      const label = payload.labels?.find(
        (candidate) => candidate.name?.trim().toLowerCase() === normalizedLabelName
      );

      if (!label?.id || !label.name) {
        return null;
      }

      return {
        id: label.id,
        name: label.name,
      };
    },

    async listMessageRefs(input) {
      const results: GmailApiMessageRef[] = [];
      let pageToken: string | undefined;

      do {
        const searchParams = new URLSearchParams({
          maxResults: '100',
          labelIds: input.labelId,
        });

        if (input.query) {
          searchParams.set('q', input.query);
        }

        if (pageToken) {
          searchParams.set('pageToken', pageToken);
        }

        const payload = await authorizedGet<{
          messages?: Array<{ id?: string; threadId?: string }>;
          nextPageToken?: string;
        }>(`/gmail/v1/users/me/messages?${searchParams.toString()}`);

        for (const message of payload.messages ?? []) {
          if (!message.id) {
            continue;
          }

          results.push({
            id: message.id,
            threadId: message.threadId,
          });
        }

        pageToken = payload.nextPageToken;
      } while (pageToken);

      return results;
    },

    async getMessage(messageId) {
      const payload = await authorizedGet<{
        id?: string;
        threadId?: string;
        internalDate?: string;
        payload?: GmailMessagePayload | null;
      }>(`/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`);

      if (!payload.id) {
        throw new Error(`Gmail message payload missing id for message ${messageId}.`);
      }

      return {
        id: payload.id,
        threadId: payload.threadId,
        internalDate: payload.internalDate,
        payload: payload.payload ?? null,
      };
    },
  };
}

export async function fetchGmailSyncData(
  client: GmailApiClient,
  input: BuildGmailSearchQueryInput
): Promise<FetchedGmailSyncData> {
  const label = await client.resolveLabelByName(input.label);

  if (!label) {
    throw new Error(
      `Gmail label \"${input.label}\" was not found. Create it in Gmail and apply it to newsletters before running sync.`
    );
  }

  const query = buildGmailApiQuery(input);
  const messageRefs = await client.listMessageRefs({
    labelId: label.id,
    query,
  });
  const messages: GmailApiMessage[] = [];

  for (const messageRef of messageRefs) {
    messages.push(await client.getMessage(messageRef.id));
  }

  return {
    label,
    query,
    messageRefs,
    messages,
  };
}

export function mapGmailApiMessageToNewsletterMessage(
  message: GmailApiMessage
): GmailNewsletterMessage {
  const headers = message.payload?.headers ?? [];
  const subject = readHeader(headers, 'subject');
  const fromHeader = readHeader(headers, 'from');
  const dateHeader = readHeader(headers, 'date');
  const parsedSender = parseFromHeader(fromHeader);

  return {
    id: message.id,
    threadId: message.threadId ?? null,
    internalDate: message.internalDate ?? null,
    sentAt: parseGmailTimestamp(dateHeader, message.internalDate),
    subject: subject ?? null,
    senderName: parsedSender.name,
    senderEmail: parsedSender.email,
    sourceName: parsedSender.name ?? parsedSender.email,
    headers: headers.map((header) => ({
      name: header.name,
      value: header.value,
    })),
  };
}

export function parseFromHeader(
  fromHeader?: string | null
): { name: string | null; email: string | null } {
  const value = fromHeader?.trim();

  if (!value) {
    return { name: null, email: null };
  }

  const match = value.match(/^(.*?)(?:\s*<([^>]+)>)?$/);

  if (!match) {
    return { name: null, email: value };
  }

  const rawName = match[1]?.trim().replace(/^"|"$/g, '');
  const rawEmail = match[2]?.trim();

  if (rawEmail) {
    return {
      name: rawName || null,
      email: rawEmail || null,
    };
  }

  const emailOnly = value.match(/([^\s<>@]+@[^\s<>]+)/)?.[1] ?? null;

  return {
    name: emailOnly ? null : rawName || null,
    email: emailOnly,
  };
}

export function parseGmailTimestamp(
  dateHeader?: string | null,
  internalDate?: string | null
): string | null {
  const preferredDate = dateHeader ? new Date(dateHeader) : null;

  if (preferredDate && !Number.isNaN(preferredDate.getTime())) {
    return preferredDate.toISOString();
  }

  if (!internalDate) {
    return null;
  }

  const parsedInternalDate = new Date(Number(internalDate));
  return Number.isNaN(parsedInternalDate.getTime())
    ? null
    : parsedInternalDate.toISOString();
}

function readHeader(
  headers: GmailMessageHeader[],
  headerName: string
): string | null {
  const normalizedHeaderName = headerName.toLowerCase();
  const header = headers.find(
    (candidate) => candidate.name.toLowerCase() === normalizedHeaderName
  );

  return header?.value ?? null;
}

async function requestAccessToken(
  credentials: GmailApiCredentials,
  fetchImpl: typeof fetch
): Promise<string> {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      redirect_uri: credentials.redirectUri,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to refresh Gmail OAuth token: ${response.status} ${response.statusText} ${await response.text()}`
    );
  }

  const payload = (await response.json()) as { access_token?: string };

  if (!payload.access_token) {
    throw new Error('Gmail OAuth token response did not include access_token.');
  }

  return payload.access_token;
}
