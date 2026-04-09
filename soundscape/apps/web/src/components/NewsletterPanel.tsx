import { Component, type Accessor } from 'solid-js';
import NewsletterList from './NewsletterList.js';
import {
  createNewsletterListResource,
  type NewsletterResourceStatus,
} from '../lib/newsletter-resource.js';
import type { NewsletterApi, NewsletterSummary } from '../lib/newsletters.js';

interface NewsletterListResourceLike {
  newsletters: Accessor<NewsletterSummary[]>;
  status: Accessor<NewsletterResourceStatus>;
  error: Accessor<Error | null>;
}

export interface NewsletterPanelProps {
  api?: NewsletterApi;
  sourceId?: Accessor<number | null | undefined>;
  list?: NewsletterSummary[];
  listResource?: NewsletterListResourceLike;
}

function createStaticListResource(
  newsletters: NewsletterSummary[]
): NewsletterListResourceLike {
  return {
    newsletters: () => newsletters,
    status: () => (newsletters.length > 0 ? 'ready' : 'empty'),
    error: () => null,
  };
}

const NewsletterPanel: Component<NewsletterPanelProps> = (props) => {
  const listResource =
    props.listResource ??
    (props.list
      ? createStaticListResource(props.list)
      : createNewsletterListResource(props.sourceId ?? (() => null), {
          api: props.api,
        }));

  return (
    <div class="overflow-hidden h-full min-h-0 border border-border bg-bg">
      <NewsletterList
        newsletters={listResource.newsletters()}
        isLoading={listResource.status() === 'loading'}
        error={listResource.error()}
        api={props.api}
      />
    </div>
  );
};

export default NewsletterPanel;
