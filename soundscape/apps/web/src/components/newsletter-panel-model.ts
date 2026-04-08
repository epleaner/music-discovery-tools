import type { NewsletterResourceStatus } from '../lib/newsletter-resource.js';
import type { NewsletterDetail, NewsletterSummary } from '../lib/newsletters.js';

export interface NewsletterListItemModel {
  id: number;
  sourceLabel: string;
  sentAtLabel: string;
  subject: string;
  summary: string | null;
  entityLabels: string[];
  isSelected: boolean;
}

export interface NewsletterDetailModel {
  state: 'loading' | 'empty' | 'error' | 'ready';
  title: string;
  sourceLabel?: string;
  summary?: string | null;
  artists: string[];
  albums: string[];
  tracks: string[];
  links: string[];
  excerpt?: string | null;
  errorMessage?: string;
}

export interface NewsletterPanelModel {
  selectedId: number | null;
  listState: 'loading' | 'empty' | 'error' | 'ready';
  listMessage: string | null;
  listItems: NewsletterListItemModel[];
  detail: NewsletterDetailModel;
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

export function resolveSelectedNewsletterId(
  newsletters: NewsletterSummary[],
  selectedId: number | null | undefined
): number | null {
  if (newsletters.length === 0) return null;
  if (selectedId != null && newsletters.some((newsletter) => newsletter.id === selectedId)) {
    return selectedId;
  }
  return newsletters[0]!.id;
}

export function buildNewsletterEntityLabels(newsletter: NewsletterSummary): string[] {
  const labels: string[] = [];

  for (const artist of newsletter.artists) {
    labels.push(artist.name);
    if (labels.length === 3) return labels;
  }

  for (const album of newsletter.albums) {
    labels.push(album.primaryArtistName ? `${album.primaryArtistName} — ${album.name}` : album.name);
    if (labels.length === 3) return labels;
  }

  for (const track of newsletter.tracks) {
    labels.push(track.primaryArtistName ? `${track.primaryArtistName} / ${track.name}` : track.name);
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

function buildDetailState(input: {
  status: NewsletterResourceStatus;
  newsletter: NewsletterDetail | null;
  error: Error | null;
}): NewsletterDetailModel {
  if (input.status === 'loading') {
    return {
      state: 'loading',
      title: 'Loading newsletter detail…',
      artists: [],
      albums: [],
      tracks: [],
      links: [],
    };
  }

  if (input.error) {
    return {
      state: 'error',
      title: 'Newsletter detail unavailable',
      errorMessage: input.error.message,
      artists: [],
      albums: [],
      tracks: [],
      links: [],
    };
  }

  if (input.status === 'idle' || input.status === 'empty' || !input.newsletter) {
    return {
      state: 'empty',
      title: 'Select a newsletter',
      artists: [],
      albums: [],
      tracks: [],
      links: [],
    };
  }

  return {
    state: 'ready',
    title: input.newsletter.subject ?? 'Untitled newsletter',
    sourceLabel: `${input.newsletter.source.canonicalName ?? input.newsletter.source.senderEmail ?? 'Unknown source'} · ${formatNewsletterDetailDate(input.newsletter.sentAt)}`,
    summary: input.newsletter.summary,
    artists: input.newsletter.artists.map((artist) => artist.name),
    albums: input.newsletter.albums.map((album) =>
      album.primaryArtistName ? `${album.name} — ${album.primaryArtistName}` : album.name
    ),
    tracks: input.newsletter.tracks.map((track) =>
      track.primaryArtistName ? `${track.name} — ${track.primaryArtistName}` : track.name
    ),
    links: input.newsletter.links.map((link) => link.title ?? link.domain ?? link.url),
    excerpt: input.newsletter.cleanedText,
  };
}

export function buildNewsletterPanelModel(input: {
  newsletters: NewsletterSummary[];
  selectedId?: number | null;
  listStatus: NewsletterResourceStatus;
  listError?: Error | null;
  detailStatus: NewsletterResourceStatus;
  detailError?: Error | null;
  detail: NewsletterDetail | null;
}): NewsletterPanelModel {
  const selectedId = resolveSelectedNewsletterId(input.newsletters, input.selectedId);

  return {
    selectedId,
    ...buildListState(input.listStatus, input.newsletters, input.listError ?? null),
    listItems: input.newsletters.map((newsletter) => ({
      id: newsletter.id,
      sourceLabel:
        newsletter.source.canonicalName ?? newsletter.source.senderEmail ?? 'Unknown source',
      sentAtLabel: formatNewsletterDate(newsletter.sentAt),
      subject: newsletter.subject ?? 'Untitled newsletter',
      summary: newsletter.summary,
      entityLabels: buildNewsletterEntityLabels(newsletter),
      isSelected: newsletter.id === selectedId,
    })),
    detail: buildDetailState({
      status: input.detailStatus,
      newsletter: input.detail,
      error: input.detailError ?? null,
    }),
  };
}
