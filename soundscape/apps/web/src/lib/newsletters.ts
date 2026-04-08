import { trpc } from './trpc.js';

type NewsletterClient = Pick<
  typeof trpc,
  'newsletterList' | 'newsletterDetail' | 'newsletterSources'
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

export interface NewsletterApi {
  list(input: NewsletterListInput): Promise<NewsletterListResponse>;
  detail(input: NewsletterDetailInput): Promise<NewsletterDetail>;
  sources(): Promise<NewsletterSourceOption[]>;
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
  };
}

export const newsletterApi = createNewsletterApi();
