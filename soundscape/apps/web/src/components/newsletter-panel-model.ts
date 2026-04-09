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
  entityLabels: string[];
  artists: string[];
  albums: string[];
  tracks: string[];
  links: NewsletterLinkModel[];
}

export interface NewsletterPanelModel {
  listState: 'loading' | 'empty' | 'error' | 'ready';
  listMessage: string | null;
  listItems: NewsletterListItemModel[];
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

export function buildNewsletterEntityLabels(
  newsletter: NewsletterSummary
): string[] {
  const labels: string[] = [];

  for (const artist of newsletter.artists) {
    labels.push(artist.name);
    if (labels.length === 3) return labels;
  }

  for (const album of newsletter.albums) {
    labels.push(
      album.primaryArtistName
        ? `${album.primaryArtistName} — ${album.name}`
        : album.name
    );
    if (labels.length === 3) return labels;
  }

  for (const track of newsletter.tracks) {
    labels.push(
      track.primaryArtistName
        ? `${track.primaryArtistName} / ${track.name}`
        : track.name
    );
    if (labels.length === 3) return labels;
  }

  return labels;
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
      entityLabels: buildNewsletterEntityLabels(newsletter),
      artists: newsletter.artists.map((artist) => artist.name),
      albums: newsletter.albums.map((album) =>
        album.primaryArtistName
          ? `${album.name} — ${album.primaryArtistName}`
          : album.name
      ),
      tracks: newsletter.tracks.map((track) =>
        track.primaryArtistName
          ? `${track.name} — ${track.primaryArtistName}`
          : track.name
      ),
      links: newsletter.links.map((link) => ({
        label: link.title ?? link.domain ?? link.url,
        url: link.url,
      })),
    })),
  };
}
