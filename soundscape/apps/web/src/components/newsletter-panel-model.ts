import type { NewsletterResourceStatus } from '../lib/newsletter-resource.js';
import type { NewsletterSummary } from '../lib/newsletters.js';

export interface NewsletterLinkModel {
  label: string;
  url: string;
}

export interface NewsletterListItemModel {
  id: number;
  sourceLabel: string;
  sentAtLabel: string;
  subject: string;
  summary: string | null;
  links: NewsletterLinkModel[];
}

export interface NewsletterPanelModel {
  listState: 'loading' | 'empty' | 'error' | 'ready';
  listMessage: string | null;
  listItems: NewsletterListItemModel[];
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function deriveLinkLabelFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = segments.at(-1);

    if (!slug) {
      return null;
    }

    return titleCaseWords(decodeURIComponent(slug).replace(/[-_]+/g, ' '));
  } catch {
    return null;
  }
}

export function formatNewsletterLinkLabel(link: {
  title: string | null;
  domain: string | null;
  url: string;
}): string {
  return link.title ?? deriveLinkLabelFromUrl(link.url) ?? link.domain ?? link.url;
}

export function formatNewsletterDate(sentAt: string | null): string {
  if (!sentAt) return 'Unknown date';

  const parsed = new Date(sentAt);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function formatNewsletterDetailDate(sentAt: string | null): string {
  if (!sentAt) return 'Unknown date';

  const parsed = new Date(sentAt);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function buildListState(
  status: NewsletterResourceStatus,
  newsletters: NewsletterSummary[],
  error: Error | null
): Pick<NewsletterPanelModel, 'listState' | 'listMessage'> {
  if (status === 'loading') {
    return { listState: 'loading', listMessage: 'Loading newsletters…' };
  }

  if (error) {
    return { listState: 'error', listMessage: error.message };
  }

  if (newsletters.length === 0) {
    return {
      listState: 'empty',
      listMessage: 'Run the local ingest worker to populate this panel.',
    };
  }

  return { listState: 'ready', listMessage: null };
}

export function buildNewsletterPanelModel(input: {
  newsletters: NewsletterSummary[];
  listStatus: NewsletterResourceStatus;
  listError?: Error | null;
}): NewsletterPanelModel {
  return {
    ...buildListState(
      input.listStatus,
      input.newsletters,
      input.listError ?? null
    ),
    listItems: input.newsletters.map((newsletter) => ({
      id: newsletter.id,
      sourceLabel:
        newsletter.source.canonicalName ??
        newsletter.source.senderEmail ??
        'Unknown source',
      sentAtLabel: formatNewsletterDate(newsletter.sentAt),
      subject: newsletter.subject ?? 'Untitled newsletter',
      summary: newsletter.summary,
      links: newsletter.links.map((link) => ({
        label: formatNewsletterLinkLabel(link),
        url: link.url,
      })),
    })),
  };
}
