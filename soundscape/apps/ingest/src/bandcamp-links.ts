import type { NewsletterLinkInput } from '@soundscape/newsletters-db';

interface CandidateLink {
  url: string;
  title: string | null;
}

export interface ExtractBandcampLinksInput {
  rawHtml?: string | null;
  rawText?: string | null;
  cleanedText?: string | null;
}

export interface ExtractBandcampLinksOptions {
  resolveUrl?: (url: string) => Promise<string | null>;
}

export interface ResolveUrlWithRedirectsOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRedirects?: number;
}

const URL_PATTERN = /https?:\/\/[^\s<>'"\])]+/g;
const DEFAULT_REDIRECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_REDIRECTS = 5;
const USER_AGENT = 'soundscape-newsletter-ingest/1.0';

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function resolveRedirectTarget(baseUrl: string, location: string): string | null {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return null;
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function isBandcampUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes('bandcamp.com');
  } catch {
    return false;
  }
}

function buildNewsletterLink(url: string, title: string | null): NewsletterLinkInput {
  const parsed = new URL(url);

  return {
    url: parsed.toString(),
    domain: parsed.hostname,
    title: title?.trim() || null,
    confidence: 1,
  };
}

async function requestFinalUrl(input: {
  url: string;
  method: 'HEAD' | 'GET';
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxRedirects: number;
}): Promise<string | null> {
  let currentUrl = input.url;

  for (let redirectCount = 0; redirectCount <= input.maxRedirects; redirectCount += 1) {
    const response = await input.fetchImpl(currentUrl, {
      method: input.method,
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(input.timeoutMs),
    });

    if (isRedirectStatus(response.status)) {
      const nextUrl = resolveRedirectTarget(
        currentUrl,
        response.headers.get('location') ?? ''
      );

      if (!nextUrl) {
        return null;
      }

      currentUrl = nextUrl;
      continue;
    }

    return response.ok ? response.url || currentUrl : null;
  }

  return null;
}

export async function resolveUrlWithRedirects(
  url: string,
  options: ResolveUrlWithRedirectsOptions = {}
): Promise<string | null> {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REDIRECT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  try {
    const headResult = await requestFinalUrl({
      url: normalizedUrl,
      method: 'HEAD',
      fetchImpl,
      timeoutMs,
      maxRedirects,
    });

    if (headResult) {
      return headResult;
    }
  } catch {
    // Fall through to GET.
  }

  try {
    return await requestFinalUrl({
      url: normalizedUrl,
      method: 'GET',
      fetchImpl,
      timeoutMs,
      maxRedirects,
    });
  } catch {
    return null;
  }
}

export function extractCandidateLinksFromHtml(html: string): CandidateLink[] {
  const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const links: CandidateLink[] = [];

  for (const match of matches) {
    const url = normalizeUrl(match[1] ?? '');
    if (!url) {
      continue;
    }

    links.push({
      url,
      title: stripHtmlTags(match[2] ?? '') || null,
    });
  }

  return links;
}

export function extractCandidateLinksFromText(text: string): CandidateLink[] {
  return [...text.matchAll(URL_PATTERN)]
    .map((match) => normalizeUrl(match[0] ?? ''))
    .filter((url): url is string => url != null)
    .map((url) => ({ url, title: null }));
}

async function resolveBandcampUrl(
  candidate: CandidateLink,
  resolveUrl: (url: string) => Promise<string | null>
): Promise<string | null> {
  if (isBandcampUrl(candidate.url)) {
    return candidate.url;
  }

  try {
    const resolved = await resolveUrl(candidate.url);
    const normalized = resolved ? normalizeUrl(resolved) : null;
    return normalized && isBandcampUrl(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export async function extractBandcampLinksFromNewsletter(
  input: ExtractBandcampLinksInput,
  options: ExtractBandcampLinksOptions = {}
): Promise<NewsletterLinkInput[]> {
  const resolveUrl = options.resolveUrl ?? resolveUrlWithRedirects;
  const candidates = [
    ...(input.rawHtml ? extractCandidateLinksFromHtml(input.rawHtml) : []),
    ...(input.rawText ? extractCandidateLinksFromText(input.rawText) : []),
    ...(input.cleanedText ? extractCandidateLinksFromText(input.cleanedText) : []),
  ];

  const deduped = new Map<string, NewsletterLinkInput>();

  for (const candidate of candidates) {
    const finalUrl = await resolveBandcampUrl(candidate, resolveUrl);
    if (!finalUrl || deduped.has(finalUrl)) {
      continue;
    }

    deduped.set(finalUrl, buildNewsletterLink(finalUrl, candidate.title));
  }

  return [...deduped.values()];
}
