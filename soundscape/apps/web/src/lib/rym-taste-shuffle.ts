import { loadFlattenedGenres, type FlattenedGenre } from './flatten-genres';

export type TasteShuffleMode = 'close' | 'balanced' | 'fringe';
export type TasteGenreDistance = 'direct' | 'related' | 'fringe';

export interface TasteGenreStat {
  name: string;
  playcount: number;
  artists: number;
}

export interface TasteGenreCandidate extends FlattenedGenre {
  distance: TasteGenreDistance;
  sourceTaste: string;
  score: number;
  reason: string;
}

export interface TasteShuffleOptions {
  count?: number;
  mode?: TasteShuffleMode;
  rng?: () => number;
}

export interface TasteGenreCombination {
  genres: TasteGenreCandidate[];
  chartGenres: string[];
  summary: string;
}

interface TasteExpansion {
  related: string[];
  fringe: string[];
}

const tasteExpansions = new Map<string, TasteExpansion>([
  [
    'ambient',
    {
      related: [
        'Dark Ambient',
        'Ambient Americana',
        'Space Ambient',
        'Tribal Ambient',
        'Ambient Dub',
        'Ambient Techno',
        'Ambient Pop',
      ],
      fringe: [
        'Lowercase',
        'Onkyo',
        'Field Recordings',
        'Sound Art',
        'Ritual Ambient',
        'Black Ambient',
        'Slushwave',
        'Psybient',
        'Dungeon Synth',
      ],
    },
  ],
  [
    'electronic',
    {
      related: [
        'IDM',
        'Glitch',
        'Ambient Techno',
        'Dub Techno',
        'Downtempo',
        'Trip Hop',
        'Folktronica',
      ],
      fringe: [
        'Microhouse',
        'Illbient',
        'Post-Dubstep',
        'Deconstructed Club',
        'Progressive Electronic',
        'Berlin School',
        'Psybient',
      ],
    },
  ],
  [
    'jazz',
    {
      related: [
        'Spiritual Jazz',
        'Avant-Garde Jazz',
        'Chamber Jazz',
        'ECM Style Jazz',
        'Modal Jazz',
        'Nu Jazz',
      ],
      fringe: [
        'Free Jazz',
        'European Free Jazz',
        'Dark Jazz',
        'Jazz Mugham',
        'Indo Jazz',
        'Third Stream',
        'Ethio-Jazz',
      ],
    },
  ],
  [
    'folk',
    {
      related: [
        'Contemporary Folk',
        'Indie Folk',
        'Chamber Folk',
        'Psychedelic Folk',
        'American Primitivism',
      ],
      fringe: [
        'Avant-Folk',
        'Freak Folk',
        'Free Folk',
        'Dark Folk',
        'Progressive Folk',
        'Ambient Americana',
      ],
    },
  ],
  [
    'drone',
    {
      related: ['Ambient', 'Dark Ambient', 'Minimalism', 'Drone Metal'],
      fringe: [
        'Ritual Ambient',
        'Black Ambient',
        'Funeral Doom Metal',
        'Dhrupad',
      ],
    },
  ],
  [
    'new age',
    {
      related: ['Ambient', 'Progressive Electronic', 'Space Ambient'],
      fringe: ['Celtic New Age', 'Neoclassical New Age', 'Gamelan', 'Shōmyō'],
    },
  ],
  [
    'idm',
    {
      related: ['Glitch', 'Microhouse', 'Ambient Techno', 'Dub Techno'],
      fringe: ['Illbient', 'Glitch Pop', 'Post-Dubstep', 'Braindance'],
    },
  ],
  [
    'electroacoustic',
    {
      related: [
        'Acousmatic Music',
        'Musique concrète',
        'Tape Music',
        'Sound Art',
      ],
      fringe: ['Reductionism', 'Lowercase', 'Onkyo', 'Spectralism'],
    },
  ],
  [
    'spiritual jazz',
    {
      related: ['Modal Jazz', 'Avant-Garde Jazz', 'Afro-Jazz'],
      fringe: ['Jazz Mugham', 'Indo Jazz', 'Ethio-Jazz', 'Arabic Jazz'],
    },
  ],
  [
    'dream pop',
    {
      related: ['Ambient Pop', 'Ethereal Wave', 'Slowcore'],
      fringe: ['Hypnagogic Pop', 'Slushwave', 'Darkwave'],
    },
  ],
  [
    'noise',
    {
      related: ['Ambient Noise Wall', 'Industrial', 'Power Electronics'],
      fringe: ['Death Industrial', 'Black Ambient', 'Noise Rock'],
    },
  ],
]);

export function normalizeTasteGenre(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalizeGenres(genres: FlattenedGenre[]): FlattenedGenre[] {
  const byName = new Map<string, FlattenedGenre>();

  for (const genre of genres) {
    const key = normalizeTasteGenre(genre.name);
    const existing = byName.get(key);
    if (
      !existing ||
      genre.path.split(' > ').length < existing.path.split(' > ').length ||
      genre.path.length < existing.path.length
    ) {
      byName.set(key, genre);
    }
  }

  return [...byName.values()];
}

function tasteWeight(taste: TasteGenreStat): number {
  return (
    Math.max(1, taste.playcount) * (1 + Math.log1p(Math.max(0, taste.artists)))
  );
}

function addCandidate(
  candidates: Map<string, TasteGenreCandidate>,
  genre: FlattenedGenre | undefined,
  taste: TasteGenreStat,
  distance: TasteGenreDistance,
  multiplier: number,
  reason: string
) {
  if (!genre) return;

  const key = normalizeTasteGenre(genre.name);
  const score = tasteWeight(taste) * multiplier;
  const existing = candidates.get(key);
  if (!existing || score > existing.score) {
    candidates.set(key, {
      ...genre,
      distance,
      sourceTaste: taste.name,
      score,
      reason,
    });
  }
}

export function buildTasteGenreCandidates(
  tasteStats: TasteGenreStat[],
  rymGenres: FlattenedGenre[] = loadFlattenedGenres()
): TasteGenreCandidate[] {
  const canonicalGenres = canonicalizeGenres(rymGenres);
  const genreByName = new Map(
    canonicalGenres.map((genre) => [normalizeTasteGenre(genre.name), genre])
  );
  const candidates = new Map<string, TasteGenreCandidate>();

  for (const taste of tasteStats) {
    const normalizedTaste = normalizeTasteGenre(taste.name);
    addCandidate(
      candidates,
      genreByName.get(normalizedTaste),
      taste,
      'direct',
      100,
      `Direct RYM match for your ${taste.name} listening`
    );

    const expansion = tasteExpansions.get(normalizedTaste);
    for (const related of expansion?.related ?? []) {
      addCandidate(
        candidates,
        genreByName.get(normalizeTasteGenre(related)),
        taste,
        'related',
        45,
        `Related to your ${taste.name} listening`
      );
    }

    for (const fringe of expansion?.fringe ?? []) {
      addCandidate(
        candidates,
        genreByName.get(normalizeTasteGenre(fringe)),
        taste,
        'fringe',
        24,
        ''
      );
    }
  }

  return [...candidates.values()].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
}

function candidatePoolForMode(
  candidates: TasteGenreCandidate[],
  mode: TasteShuffleMode
): TasteGenreCandidate[] {
  if (mode === 'close') {
    return candidates.filter((candidate) => candidate.distance !== 'fringe');
  }

  if (mode === 'fringe') {
    const fringeCandidates = candidates.filter(
      (candidate) => candidate.distance === 'fringe'
    );
    if (fringeCandidates.length > 0) return fringeCandidates;
    return candidates.filter((candidate) => candidate.distance !== 'direct');
  }

  const discoveryCandidates = candidates.filter(
    (candidate) => candidate.distance !== 'direct'
  );
  return discoveryCandidates.length > 0 ? discoveryCandidates : candidates;
}

function weightedPick(
  candidates: TasteGenreCandidate[],
  rng: () => number
): TasteGenreCandidate | undefined {
  const total = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  if (total <= 0) return candidates[0];

  let cursor = rng() * total;
  for (const candidate of candidates) {
    cursor -= candidate.score;
    if (cursor <= 0) return candidate;
  }

  return candidates[candidates.length - 1];
}

export function shuffleTasteGenreCombination(
  tasteStats: TasteGenreStat[],
  rymGenres: FlattenedGenre[] = loadFlattenedGenres(),
  options: TasteShuffleOptions = {}
): TasteGenreCombination {
  const rng = options.rng ?? Math.random;
  const count = options.count ?? Math.floor(rng() * 2) + 2;
  const mode = options.mode ?? 'balanced';
  const candidates = buildTasteGenreCandidates(tasteStats, rymGenres);
  const selected: TasteGenreCandidate[] = [];
  let pool = candidatePoolForMode(candidates, mode);

  if (pool.length === 0) pool = candidates;

  while (selected.length < count && pool.length > 0) {
    const picked = weightedPick(pool, rng);
    if (!picked) break;
    selected.push(picked);
    pool = pool.filter((candidate) => candidate.name !== picked.name);
  }

  const tasteSources = [...new Set(selected.map((genre) => genre.sourceTaste))];

  return {
    genres: selected,
    chartGenres: selected.map((genre) => genre.name),
    summary:
      selected.length === 0
        ? 'No taste-matched RYM genres available yet.'
        : `Shuffled from your ${tasteSources.join(', ')} listening.`,
  };
}
