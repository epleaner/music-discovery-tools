export interface GmailMessagePartBody {
  data?: string | null;
  attachmentId?: string | null;
  size?: number | null;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePayload {
  mimeType?: string | null;
  filename?: string | null;
  headers?: GmailMessageHeader[];
  body?: GmailMessagePartBody | null;
  parts?: GmailMessagePayload[] | null;
}

export interface NormalizedEmailBody {
  rawHtml: string | null;
  rawText: string | null;
  cleanedText: string | null;
}

interface CollectedBodies {
  rawHtml: string | null;
  rawText: string | null;
}

const BLOCK_TAG_PATTERN = /<\s*\/?(?:article|blockquote|br|div|footer|h[1-6]|header|hr|li|p|section|table|td|th|tr|ul|ol)\b[^>]*>/gi;
const STRIP_CONTENT_TAG_PATTERN = /<(?:head|script|style|title|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:head|script|style|title|noscript|svg)>/gi;
const STRIP_TAG_PATTERN = /<[^>]+>/g;
const NUMERIC_ENTITY_PATTERN = /&#(x?[0-9a-fA-F]+);/g;

export function decodeGmailBodyData(data?: string | null): string | null {
  if (!data) {
    return null;
  }

  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function normalizeGmailMessagePayload(
  payload?: GmailMessagePayload | null
): NormalizedEmailBody {
  const bodies = collectBodies(payload);
  const cleanedHtmlText = bodies.rawHtml ? cleanHtmlToText(bodies.rawHtml) : null;
  const cleanedPlainText = bodies.rawText ? normalizePlainText(bodies.rawText) : null;

  return {
    rawHtml: bodies.rawHtml,
    rawText: bodies.rawText,
    cleanedText: cleanedHtmlText ?? cleanedPlainText,
  };
}

function collectBodies(payload?: GmailMessagePayload | null): CollectedBodies {
  if (!payload) {
    return { rawHtml: null, rawText: null };
  }

  const initial: CollectedBodies = {
    rawHtml: extractBodyForMimeType(payload, 'text/html'),
    rawText: extractBodyForMimeType(payload, 'text/plain'),
  };

  if (!payload.parts || payload.parts.length === 0) {
    return initial;
  }

  for (const part of payload.parts) {
    const nested = collectBodies(part);

    if (!initial.rawHtml && nested.rawHtml) {
      initial.rawHtml = nested.rawHtml;
    }

    if (!initial.rawText && nested.rawText) {
      initial.rawText = nested.rawText;
    }

    if (initial.rawHtml && initial.rawText) {
      break;
    }
  }

  return initial;
}

function extractBodyForMimeType(
  payload: GmailMessagePayload,
  mimeType: 'text/html' | 'text/plain'
): string | null {
  if (payload.mimeType !== mimeType) {
    return null;
  }

  return decodeGmailBodyData(payload.body?.data);
}

function cleanHtmlToText(html: string): string | null {
  const withoutIgnoredSections = html.replace(STRIP_CONTENT_TAG_PATTERN, ' ');
  const withLineBreaks = withoutIgnoredSections.replace(BLOCK_TAG_PATTERN, '\n');
  const withoutTags = withLineBreaks.replace(STRIP_TAG_PATTERN, ' ');
  const decodedEntities = decodeHtmlEntities(withoutTags);

  return normalizePlainText(decodedEntities);
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  const withNamedEntities = Object.entries(namedEntities).reduce(
    (currentValue, [entity, replacement]) => currentValue.replaceAll(entity, replacement),
    value
  );

  return withNamedEntities.replace(NUMERIC_ENTITY_PATTERN, (_, rawCodePoint: string) => {
    const codePoint = rawCodePoint.toLowerCase().startsWith('x')
      ? Number.parseInt(rawCodePoint.slice(1), 16)
      : Number.parseInt(rawCodePoint, 10);

    if (!Number.isFinite(codePoint)) {
      return '';
    }

    return String.fromCodePoint(codePoint);
  });
}

function normalizePlainText(value: string): string | null {
  const normalizedLines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return null;
  }

  return normalizedLines.join('\n');
}
