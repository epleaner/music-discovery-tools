import { Component, For, Show } from 'solid-js';
import Chip from './Chip';
import SourceLink from './SourceLink';
import EmptyState from './EmptyState';
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
      {(link) => (
        <SourceLink href={link.url} base="https://rateyourmusic.com">
          {link.name}
        </SourceLink>
      )}
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
      <Show when={!props.status && !props.album && props.entries.length === 0}>
        <EmptyState>No results</EmptyState>
      </Show>

      <Show when={props.entries.length > 0}>
        <div class="result-list">
          <For each={props.entries}>
            {(entry) => (
              <article class="result-row">
                <div class="result-main">
                  <h3 class="result-title break-words">
                    <SourceLink
                      href={entry.albumUrl || entry.path}
                      base="https://rateyourmusic.com"
                    >
                      {entry.album}
                    </SourceLink>
                  </h3>
                  <div class="result-meta break-words">
                    <SourceLink
                      href={entry.artistUrl}
                      base="https://rateyourmusic.com"
                    >
                      {entry.artist}
                    </SourceLink>
                  </div>
                  <Show when={entry.date}>
                    <div class="result-meta">{entry.date}</div>
                  </Show>
                  <Show when={entry.genreLinks?.length || entry.genres?.length}>
                    <div class="result-meta break-words">
                      <Show
                        when={entry.genres?.length}
                        fallback={<RymLinkList links={entry.genreLinks} />}
                      >
                        <div class="result-actions">
                          <For each={entry.genres}>
                            {(genre) => (
                              <SourceLink
                                href={
                                  (
                                    entry.genreLinks?.find(
                                      (link) => link.name === genre
                                    ) ??
                                    entry.subgenreLinks?.find(
                                      (link) => link.name === genre
                                    )
                                  )?.url
                                }
                                base="https://rateyourmusic.com"
                              >
                                {genre}
                              </SourceLink>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                  <Show
                    when={entry.subgenreLinks?.length && !entry.genres?.length}
                  >
                    <RymLinkList
                      links={entry.subgenreLinks}
                      class="result-meta"
                    />
                  </Show>
                  <div class="result-actions result-meta numeric">
                    <Show when={entry.avgRating != null}>
                      <SourceLink
                        href={entry.albumUrl || entry.path}
                        base="https://rateyourmusic.com"
                      >
                        Rating {entry.avgRating}
                      </SourceLink>
                    </Show>
                    <Show when={entry.ratings != null}>
                      <SourceLink
                        href={entry.albumUrl || entry.path}
                        base="https://rateyourmusic.com"
                      >
                        {entry.ratings} ratings
                      </SourceLink>
                    </Show>
                    <Show when={entry.reviews != null}>
                      <SourceLink
                        href={entry.albumUrl || entry.path}
                        base="https://rateyourmusic.com"
                      >
                        {entry.reviews} reviews
                      </SourceLink>
                    </Show>
                  </div>
                  <Show when={entry.mediaLinks?.length}>
                    <RymLinkList links={entry.mediaLinks} />
                  </Show>
                  <Show
                    when={
                      entry.bandcampUrl &&
                      !entry.mediaLinks?.some(
                        (link) => link.url === entry.bandcampUrl
                      )
                    }
                  >
                    <SourceLink
                      href={entry.bandcampUrl}
                      base="https://bandcamp.com"
                    >
                      Bandcamp
                    </SourceLink>
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.album}>
        <div class="result-main">
          <h3 class="entity-heading break-words">
            <SourceLink
              href={props.album!.url}
              base="https://rateyourmusic.com"
            >
              {props.album!.title}
            </SourceLink>
          </h3>
          <div class="result-meta break-words">
            <SourceLink href={props.album!.artistUrl} base={props.album!.url}>
              {props.album!.artist}
            </SourceLink>
          </div>
          <Show when={props.album!.releaseDate}>
            <div class="result-meta">{props.album!.releaseDate}</div>
          </Show>
          <Show when={props.album!.genres && props.album!.genres!.length > 0}>
            <div class="result-actions">
              <For each={props.album!.genres}>
                {(genre) => (
                  <Chip>
                    <SourceLink
                      href={
                        props.album!.genreLinks?.find(
                          (link) => link.name === genre
                        )?.url
                      }
                      base={props.album!.url}
                    >
                      {genre}
                    </SourceLink>
                  </Chip>
                )}
              </For>
            </div>
          </Show>
          <Show when={props.album!.avgRating != null}>
            <div class="result-meta numeric">
              <SourceLink
                href={props.album!.url}
                base="https://rateyourmusic.com"
              >
                {props.album!.avgRating!.toFixed(2)}
                <Show when={props.album!.ratings != null}>
                  {' '}
                  ({props.album!.ratings} ratings)
                </Show>
              </SourceLink>
            </div>
          </Show>
          <Show
            when={
              props.album!.descriptors && props.album!.descriptors!.length > 0
            }
          >
            <div class="subtle-text break-words">
              <For each={props.album!.descriptors}>
                {(descriptor, i) => (
                  <>
                    <Show when={i() > 0}>, </Show>
                    <SourceLink
                      href={
                        props.album!.descriptorLinks?.find(
                          (link) => link.name === descriptor
                        )?.url
                      }
                      base={props.album!.url}
                    >
                      {descriptor}
                    </SourceLink>
                  </>
                )}
              </For>
            </div>
          </Show>
          <Show when={props.album!.tracks && props.album!.tracks!.length > 0}>
            <ol class="list-decimal pl-6 result-meta">
              <For each={props.album!.tracks}>
                {(track) => (
                  <li class="py-2 break-words">
                    <SourceLink
                      href={
                        props.album!.trackLinks?.find(
                          (link) => link.name === track
                        )?.url
                      }
                      base={props.album!.url}
                    >
                      {track}
                    </SourceLink>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </div>
      </Show>
    </>
  );
};

export default RymResults;
