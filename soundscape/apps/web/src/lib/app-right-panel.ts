export type RightPanelMode = 'similar' | 'newsletters';

export function resolveRightPanelMode(mode?: string): RightPanelMode {
  return mode === 'newsletters' ? 'newsletters' : 'similar';
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
    showSimilarArtists: activeMode === 'similar',
    similarArtistTitle: selectedArtist,
    emptyMessage: 'Click any artist to see similar artists',
  };
}
