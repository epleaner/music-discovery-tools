import { trpc } from './trpc.js';

type NewsletterClient = Pick<
  typeof trpc,
  | 'newsletterList'
  | 'newsletterDetail'
  | 'newsletterSources'
  | 'newsletterBandcampLookup'
>;

export type NewsletterListInput = Parameters<typeof trpc.newsletterList.query>[0];
export type NewsletterListResponse = Awaited<
  ReturnType<typeof trpc.newsletterList.query>
>;
export type NewsletterSummary = NewsletterListResponse['newsletters'][number];
export type NewsletterDetail = Awaited<
  ReturnType<typeof trpc.newsletterDetail.query>
>;
export type NewsletterDetailInput = Parameters<
  typeof trpc.newsletterDetail.query
>[0];
export type NewsletterSourceOption = Awaited<
  ReturnType<typeof trpc.newsletterSources.query>
>[number];
export type NewsletterBandcampLookupInput = Parameters<
  typeof trpc.newsletterBandcampLookup.query
>[0];
export type NewsletterBandcampLookupResult = Awaited<
  ReturnType<typeof trpc.newsletterBandcampLookup.query>
>;
export type NewsletterBandcampLookupItem =
  NewsletterBandcampLookupResult['artists'][number];

export interface NewsletterApi {
  list(input: NewsletterListInput): Promise<NewsletterListResponse>;
  detail(input: NewsletterDetailInput): Promise<NewsletterDetail>;
  sources(): Promise<NewsletterSourceOption[]>;
  bandcampLookup(
    input: NewsletterBandcampLookupInput
  ): Promise<NewsletterBandcampLookupResult>;
}

export function createNewsletterApi(
  client: NewsletterClient = trpc
): NewsletterApi {
  return {
    list(input) {
      return client.newsletterList.query(input);
    },
    detail(input) {
      return client.newsletterDetail.query(input);
    },
    sources() {
      return client.newsletterSources.query();
    },
    bandcampLookup(input) {
      return client.newsletterBandcampLookup.query(input);
    },
  };
}

export const newsletterApi = createNewsletterApi();
