import type { Track, RecentAlbum, RecentArtist } from '@soundscape/types';

export function groupTracksByAlbum(tracks: Track[]): RecentAlbum[] {
  const albumMap = new Map<string, RecentAlbum>();

  tracks.forEach((track) => {
    const albumName = track.album['#text'];
    const artistName = track.artist['#text'];
    const key = `${albumName}::${artistName}`;

    if (!albumMap.has(key)) {
      albumMap.set(key, {
        name: albumName,
        artist: artistName,
        image: track.image,
        trackCount: 1,
        lastPlayed: track.date?.uts || '0',
        url: track.url,
      });
    } else {
      const album = albumMap.get(key)!;
      album.trackCount++;
      // Keep the most recent play time
      if (
        track.date?.uts &&
        parseInt(track.date.uts) > parseInt(album.lastPlayed)
      ) {
        album.lastPlayed = track.date.uts;
      }
    }
  });

  return Array.from(albumMap.values()).sort(
    (a, b) => parseInt(b.lastPlayed) - parseInt(a.lastPlayed)
  );
}

export function groupTracksByArtist(tracks: Track[]): RecentArtist[] {
  const artistMap = new Map<string, RecentArtist>();

  tracks.forEach((track) => {
    const artistName = track.artist['#text'];

    if (!artistMap.has(artistName)) {
      artistMap.set(artistName, {
        name: artistName,
        image: track.image,
        trackCount: 1,
        lastPlayed: track.date?.uts || '0',
        url: track.url,
      });
    } else {
      const artist = artistMap.get(artistName)!;
      artist.trackCount++;
      // Keep the most recent play time
      if (
        track.date?.uts &&
        parseInt(track.date.uts) > parseInt(artist.lastPlayed)
      ) {
        artist.lastPlayed = track.date.uts;
      }
    }
  });

  return Array.from(artistMap.values()).sort(
    (a, b) => parseInt(b.lastPlayed) - parseInt(a.lastPlayed)
  );
}
