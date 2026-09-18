import { Component, For, Show } from 'solid-js';
import Chip from './Chip';
import ExternalLink from './ExternalLink';
import type { RymEntry, RymAlbumDetail, RymLink } from '@soundscape/types';

interface RymResultsProps {
  entries: RymEntry[];
  album: RymAlbumDetail | null;
  status: string | null;
}

const RymLinkList: Component<{ links?: RymLink[]; class?: string }> = (props) => (
  <div class={`flex flex-wrap gap-x-2 gap-y-1 ${props.class ?? ''}`}>
    <For each={props.links ?? []}>
      {(link) => (
        <ExternalLink href={link.url} class="text-accent hover:underline">
          {link.name}
        </ExternalLink>
      )}
    </For>
  </div>
);

const RymResults: Component<RymResultsProps> = (props) => {
  return (
    <>
      <Show when={props.status}>
        <div class="text-fg-muted">{props.status}</div>
      </Show>

      <Show when={props.entries.length > 0}>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-xs">
            <thead>
              <tr class="border-b border-border text-fg-muted">
                <th class="text-left py-1 pr-2 font-medium">Artist</th>
                <th class="text-left py-1 pr-2 font-medium">Album</th>
                <th class="text-left py-1 pr-2 font-medium">Release date</th>
                <th class="text-left py-1 pr-2 font-medium">Genres</th>
                <th class="text-left py-1 pr-2 font-medium">Subgenres</th>
                <th class="text-left py-1 pr-2 font-medium">Rating</th>
                <th class="text-left py-1 pr-2 font-medium">Ratings</th>
                <th class="text-left py-1 pr-2 font-medium">Reviews</th>
                <th class="text-left py-1 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.entries}>
                {(entry) => (
                  <tr class="border-b border-border hover:bg-bg-muted align-top">
                    <td class="py-1 pr-2">
                      <Show
                        when={entry.artistUrl}
                        fallback={entry.artist}
                      >
                        {(url) => (
                          <ExternalLink href={url()} class="text-accent hover:underline">
                            {entry.artist}
                          </ExternalLink>
                        )}
                      </Show>
                    </td>
                    <td class="py-1 pr-2">
                      <Show
                        when={entry.albumUrl ?? entry.path}
                        fallback={entry.album}
                      >
                        {(url) => (
                          <ExternalLink
                            href={url().startsWith('http') ? url() : `https://rateyourmusic.com${url()}`}
                            class="text-accent hover:underline"
                          >
                            {entry.album}
                          </ExternalLink>
                        )}
                      </Show>
                    </td>
                    <td class="py-1 pr-2 text-fg-muted whitespace-nowrap">
                      {entry.date ?? ''}
                    </td>
                    <td class="py-1 pr-2 text-fg-muted">
                      <Show
                        when={entry.genreLinks?.length}
                        fallback={(entry.genres ?? []).join(', ')}
                      >
                        <RymLinkList links={entry.genreLinks} />
                      </Show>
                    </td>
                    <td class="py-1 pr-2 text-fg-muted">
                      <RymLinkList links={entry.subgenreLinks} />
                    </td>
                    <td class="py-1 pr-2 text-fg-muted whitespace-nowrap">
                      {entry.avgRating ?? ''}
                    </td>
                    <td class="py-1 pr-2 text-fg-muted whitespace-nowrap">
                      {entry.ratings ?? ''}
                    </td>
                    <td class="py-1 pr-2 text-fg-muted whitespace-nowrap">
                      {entry.reviews ?? ''}
                    </td>
                    <td class="py-1 text-fg-muted">
                      <RymLinkList links={entry.mediaLinks} />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.album}>
        <div class="flex flex-col gap-2">
          <div class="font-medium text-fg leading-tight">{props.album!.title}</div>
          <div class="text-fg-muted">{props.album!.artist}</div>
          <Show when={props.album!.releaseDate}>
            <div class="text-fg-subtle">{props.album!.releaseDate}</div>
          </Show>
          <Show when={props.album!.genres && props.album!.genres!.length > 0}>
            <div class="flex flex-wrap gap-1">
              <For each={props.album!.genres}>
                {(genre) => <Chip>{genre}</Chip>}
              </For>
            </div>
          </Show>
          <Show when={props.album!.avgRating != null}>
            <div class="text-fg-muted">
              {props.album!.avgRating!.toFixed(2)}
              <Show when={props.album!.ratings != null}> ({props.album!.ratings} ratings)</Show>
            </div>
          </Show>
          <Show when={props.album!.descriptors && props.album!.descriptors!.length > 0}>
            <div class="text-fg-subtle">{props.album!.descriptors!.join(', ')}</div>
          </Show>
          <Show when={props.album!.tracks && props.album!.tracks!.length > 0}>
            <ol class="list-decimal list-inside text-fg-muted">
              <For each={props.album!.tracks}>
                {(track) => <li>{track}</li>}
              </For>
            </ol>
          </Show>
        </div>
      </Show>
    </>
  );
};

export default RymResults;
