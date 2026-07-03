export function buildSimilarPanelModel({
  selectedArtist,
}: {
  selectedArtist: string;
}) {
  return {
    similarArtistTitle: selectedArtist,
    showSimilarArtists: !!selectedArtist,
    emptyMessage: 'Click any artist to see similar artists',
  };
}
