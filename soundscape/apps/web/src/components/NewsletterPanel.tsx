import { Component, type Accessor, createEffect, createMemo, createSignal } from 'solid-js';
import NewsletterDetail from './NewsletterDetail.js';
import NewsletterList from './NewsletterList.js';
import {
  createNewsletterDetailResource,
  createNewsletterListResource,
  type NewsletterResourceStatus,
} from '../lib/newsletter-resource.js';
import type {
  NewsletterApi,
  NewsletterDetail as NewsletterDetailData,
  NewsletterSummary,
} from '../lib/newsletters.js';
import { resolveSelectedNewsletterId } from './newsletter-panel-model.js';

interface NewsletterListResourceLike {
  newsletters: Accessor<NewsletterSummary[]>;
  status: Accessor<NewsletterResourceStatus>;
  error: Accessor<Error | null>;
}

interface NewsletterDetailResourceLike {
  newsletter: Accessor<NewsletterDetailData | null>;
  status: Accessor<NewsletterResourceStatus>;
  error: Accessor<Error | null>;
}

export interface NewsletterPanelProps {
  api?: NewsletterApi;
  sourceId?: Accessor<number | null | undefined>;
  selectedId?: Accessor<number | null>;
  onSelect?: (id: number) => void;
  list?: NewsletterSummary[];
  detail?: NewsletterDetailData | null;
  listResource?: NewsletterListResourceLike;
  detailResource?: NewsletterDetailResourceLike;
}

function createStaticListResource(newsletters: NewsletterSummary[]): NewsletterListResourceLike {
  return {
    newsletters: () => newsletters,
    status: () => (newsletters.length > 0 ? 'ready' : 'empty'),
    error: () => null,
  };
}

function createStaticDetailResource(detail: NewsletterDetailData | null): NewsletterDetailResourceLike {
  return {
    newsletter: () => detail,
    status: () => (detail ? 'ready' : 'empty'),
    error: () => null,
  };
}

const NewsletterPanel: Component<NewsletterPanelProps> = (props) => {
  const [internalSelectedId, setInternalSelectedId] = createSignal<number | null>(
    props.detail?.id ?? props.list?.[0]?.id ?? null
  );

  const resolvedSelectedId = createMemo(() => props.selectedId?.() ?? internalSelectedId());

  const listResource =
    props.listResource ??
    (props.list
      ? createStaticListResource(props.list)
      : createNewsletterListResource(props.sourceId ?? (() => null), {
          api: props.api,
        }));

  const detailResource =
    props.detailResource ??
    (props.detail !== undefined || props.list !== undefined
      ? createStaticDetailResource(props.detail ?? null)
      : createNewsletterDetailResource(resolvedSelectedId, {
          api: props.api,
        }));

  createEffect(() => {
    if (props.selectedId) return;

    const newsletters = listResource.newsletters();
    const current = internalSelectedId();

    const nextSelectedId = resolveSelectedNewsletterId(newsletters, current);

    if (nextSelectedId !== current) {
      setInternalSelectedId(nextSelectedId);
    }
  });

  const handleSelect = (id: number) => {
    if (!props.selectedId) {
      setInternalSelectedId(id);
    }
    props.onSelect?.(id);
  };

  return (
    <div class='flex overflow-hidden h-full min-h-0 border border-border bg-bg'>
      <div class='overflow-hidden w-[18rem] min-w-0 border-r border-border'>
        <NewsletterList
          newsletters={listResource.newsletters()}
          selectedId={resolvedSelectedId()}
          isLoading={listResource.status() === 'loading'}
          error={listResource.error()}
          onSelect={handleSelect}
        />
      </div>
      <div class='overflow-hidden flex-1 min-w-0'>
        <NewsletterDetail
          newsletter={detailResource.newsletter()}
          isLoading={detailResource.status() === 'loading'}
          isEmpty={detailResource.status() === 'idle' || detailResource.status() === 'empty'}
          error={detailResource.error()}
        />
      </div>
    </div>
  );
};

export default NewsletterPanel;
