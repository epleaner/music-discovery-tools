export type RightPanelMode = 'similar' | 'newsletters' | 'bandcamp' | 'scrape';

export function resolveRightPanelMode(mode?: string): RightPanelMode {
  if (mode === 'newsletters') return 'newsletters';
  if (mode === 'bandcamp') return 'bandcamp';
  if (mode === 'scrape') return 'scrape';
  return 'similar';
}

export function buildRightPanelModel({
  mode,
  selectedArtist,
}: {
  mode?: string;
  selectedArtist: string;
}) {
  const activeMode = resolveRightPanelMode(mode);

  return {
    activeMode,
    showNewsletterPanel: activeMode === 'newsletters',
    showBandcampPanel: activeMode === 'bandcamp',
    showScrapePanel: activeMode === 'scrape',
    showSimilarArtists: activeMode === 'similar',
    similarArtistTitle: selectedArtist,
    emptyMessage: 'Click any artist to see similar artists',
  };
}
