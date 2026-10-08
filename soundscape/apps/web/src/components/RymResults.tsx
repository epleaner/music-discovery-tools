import { Component, For, Show } from 'solid-js';
import Chip from './Chip';
import ExternalLink from './ExternalLink';
import type { RymEntry, RymAlbumDetail, RymLink } from '@soundscape/types';

interface RymResultsProps {
  entries: RymEntry[];
  album: RymAlbumDetail | null;
  status: string | null;
}

const RymLinkList: Component<{ links?: RymLink[]; class?: string }> = (
  props
) => (
  <div class={`result-actions ${props.class ?? ''}`}>
    <For each={props.links ?? []}>
      {(link) => <ExternalLink href={link.url}>{link.name}</ExternalLink>}
    </For>
  </div>
);

const RymResults: Component<RymResultsProps> = (props) => {
  return (
    <>
      <Show when={props.status}>
        <div class="status break-words" role="status">
          {props.status}
        </div>
      </Show>

      <Show when={props.entries.length > 0}>
        <div class="result-list">
          <For each={props.entries}>
            {(entry) => (
              <article class="result-row">
                <div class="result-main">
                  <h3 class="result-title break-words">
                    <Show
                      when={entry.albumUrl ?? entry.path}
                      fallback={entry.album}
                    >
                      {(url) => (
                        <ExternalLink
                          href={
                            url().startsWith('http')
                              ? url()
                              : `https://rateyourmusic.com${url()}`
                          }
                        >
                          {entry.album}
                        </ExternalLink>
                      )}
                    </Show>
                  </h3>
                  <div class="result-meta break-words">
                    <Show when={entry.artistUrl} fallback={entry.artist}>
                      {(url) => (
                        <ExternalLink href={url()}>{entry.artist}</ExternalLink>
                      )}
                    </Show>
                  </div>
                  <Show when={entry.date}>
                    <div class="result-meta">{entry.date}</div>
                  </Show>
                  <Show when={entry.genreLinks?.length || entry.genres?.length}>
                    <div class="result-meta break-words">
                      <Show
                        when={entry.genreLinks?.length}
                        fallback={(entry.genres ?? []).join(', ')}
                      >
                        <RymLinkList links={entry.genreLinks} />
                      </Show>
                    </div>
                  </Show>
                  <Show when={entry.subgenreLinks?.length}>
                    <RymLinkList
                      links={entry.subgenreLinks}
                      class="result-meta"
                    />
                  </Show>
                  <div class="result-actions result-meta numeric">
                    <Show when={entry.avgRating != null}>
                      <span>Rating {entry.avgRating}</span>
                    </Show>
                    <Show when={entry.ratings != null}>
                      <span>{entry.ratings} ratings</span>
                    </Show>
                    <Show when={entry.reviews != null}>
                      <span>{entry.reviews} reviews</span>
                    </Show>
                  </div>
                  <Show when={entry.mediaLinks?.length}>
                    <RymLinkList links={entry.mediaLinks} />
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.album}>
        <div class="result-main">
          <h3 class="entity-heading break-words">{props.album!.title}</h3>
          <div class="result-meta break-words">{props.album!.artist}</div>
          <Show when={props.album!.releaseDate}>
            <div class="result-meta">{props.album!.releaseDate}</div>
          </Show>
          <Show when={props.album!.genres && props.album!.genres!.length > 0}>
            <div class="result-actions">
              <For each={props.album!.genres}>
                {(genre) => <Chip>{genre}</Chip>}
              </For>
            </div>
          </Show>
          <Show when={props.album!.avgRating != null}>
            <div class="result-meta numeric">
              {props.album!.avgRating!.toFixed(2)}
              <Show when={props.album!.ratings != null}>
                {' '}
                ({props.album!.ratings} ratings)
              </Show>
            </div>
          </Show>
          <Show
            when={
              props.album!.descriptors && props.album!.descriptors!.length > 0
            }
          >
            <div class="subtle-text break-words">
              {props.album!.descriptors!.join(', ')}
            </div>
          </Show>
          <Show when={props.album!.tracks && props.album!.tracks!.length > 0}>
            <ol class="list-decimal pl-6 result-meta">
              <For each={props.album!.tracks}>
                {(track) => <li class="py-2 break-words">{track}</li>}
              </For>
            </ol>
          </Show>
        </div>
      </Show>
    </>
  );
};

export default RymResults;
