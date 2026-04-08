import { z } from 'zod';

const optionalTrimmedString = z.string().trim().min(1).nullish().transform((value) => value ?? null);

const extractedEntitySchema = z
  .object({
    name: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
    evidence: optionalTrimmedString,
    primaryArtistName: optionalTrimmedString,
  })
  .strict();

const extractedLinkSchema = z
  .object({
    url: z.string().trim().url(),
    domain: optionalTrimmedString,
    title: optionalTrimmedString,
    confidence: z.number().min(0).max(1),
    evidence: optionalTrimmedString,
  })
  .strict();

const extractedReleaseSchema = z
  .object({
    title: z.string().trim().min(1),
    artistName: optionalTrimmedString,
    releaseDate: optionalTrimmedString,
    confidence: z.number().min(0).max(1),
    evidence: optionalTrimmedString,
  })
  .strict();

const extractedEventSchema = z
  .object({
    title: z.string().trim().min(1),
    venue: optionalTrimmedString,
    city: optionalTrimmedString,
    startDate: optionalTrimmedString,
    confidence: z.number().min(0).max(1),
    evidence: optionalTrimmedString,
  })
  .strict();

export const newsletterExtractionSchema = z
  .object({
    sourceName: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    artists: z.array(extractedEntitySchema),
    albums: z.array(extractedEntitySchema),
    tracks: z.array(extractedEntitySchema),
    genres: z.array(extractedEntitySchema),
    links: z.array(extractedLinkSchema),
    releases: z.array(extractedReleaseSchema),
    events: z.array(extractedEventSchema),
  })
  .strict();

export type NewsletterExtraction = z.infer<typeof newsletterExtractionSchema>;
export type NewsletterExtractionEntity = z.infer<typeof extractedEntitySchema>;
export type NewsletterExtractionLink = z.infer<typeof extractedLinkSchema>;
export type NewsletterExtractionRelease = z.infer<typeof extractedReleaseSchema>;
export type NewsletterExtractionEvent = z.infer<typeof extractedEventSchema>;
export type SafeParseNewsletterExtractionResult = ReturnType<
  typeof newsletterExtractionSchema.safeParse
>;

export function safeParseNewsletterExtraction(
  input: unknown
): SafeParseNewsletterExtractionResult {
  return newsletterExtractionSchema.safeParse(input);
}

export function parseNewsletterExtraction(input: unknown): NewsletterExtraction {
  return newsletterExtractionSchema.parse(input);
}

export function isHighConfidence(
  confidence: number | null | undefined,
  threshold: number
): boolean {
  return typeof confidence === 'number' && confidence >= threshold;
}

export function filterNormalizedExtraction(
  extraction: NewsletterExtraction,
  threshold: number
): NewsletterExtraction {
  return {
    ...extraction,
    artists: extraction.artists.filter((artist) => isHighConfidence(artist.confidence, threshold)),
    albums: extraction.albums.filter((album) => isHighConfidence(album.confidence, threshold)),
    tracks: extraction.tracks.filter((track) => isHighConfidence(track.confidence, threshold)),
    genres: extraction.genres.filter((genre) => isHighConfidence(genre.confidence, threshold)),
    links: extraction.links.filter((link) => isHighConfidence(link.confidence, threshold)),
    releases: extraction.releases.filter((release) =>
      isHighConfidence(release.confidence, threshold)
    ),
    events: extraction.events.filter((event) => isHighConfidence(event.confidence, threshold)),
  };
}
