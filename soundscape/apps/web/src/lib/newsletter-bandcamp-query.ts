import { createQuery } from '@tanstack/solid-query';
import type { Accessor } from 'solid-js';
import {
  newsletterApi,
  type NewsletterApi,
  type NewsletterBandcampLookupItem,
} from './newsletters.js';

export interface BandcampLookupVisibility {
  isModalOpen: boolean;
  showArtists: boolean;
  showAlbums: boolean;
  showTracks: boolean;
}

export function buildBandcampLookupKey(id: number) {
  return ['newsletter-bandcamp-lookup', id] as const;
}

export function shouldEnableBandcampLookup(
  visibility: BandcampLookupVisibility
): boolean {
  return (
    visibility.isModalOpen ||
    visibility.showArtists ||
    visibility.showAlbums ||
    visibility.showTracks
  );
}

export function findBandcampLookupItem(
  items: NewsletterBandcampLookupItem[],
  input: {
    name: string;
    primaryArtistName?: string | null;
  }
): NewsletterBandcampLookupItem | null {
  const primaryArtistName = input.primaryArtistName ?? null;

  return (
    items.find(
      (item) =>
        item.name === input.name &&
        (item.primaryArtistName ?? null) === primaryArtistName
    ) ?? null
  );
}

export function createNewsletterBandcampQuery(input: {
  newsletterId: Accessor<number | null | undefined>;
  enabled: Accessor<boolean>;
  api?: NewsletterApi;
}) {
  const api = input.api ?? newsletterApi;

  return createQuery(() => {
    const newsletterId = input.newsletterId();
    const enabled = newsletterId != null && input.enabled();

    return {
      queryKey:
        newsletterId == null
          ? (['newsletter-bandcamp-lookup', 'idle'] as const)
          : buildBandcampLookupKey(newsletterId),
      queryFn: async () => api.bandcampLookup({ id: newsletterId as number }),
      enabled,
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      retry: false,
    };
  });
}
