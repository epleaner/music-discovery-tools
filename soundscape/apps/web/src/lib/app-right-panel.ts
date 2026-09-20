export function buildSimilarPanelModel({
  selectedArtist,
}: {
  selectedArtist: string;
}) {
  return {
    showSimilarArtists: !!selectedArtist,
  };
}
