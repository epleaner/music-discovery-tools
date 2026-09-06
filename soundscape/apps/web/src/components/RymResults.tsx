import { Component, Show, For } from 'solid-js';
import type { RymEntry, RymAlbumDetail } from '@soundscape/types';

interface RymResultsProps {
  entries: RymEntry[];
  album: RymAlbumDetail | null;
  status: string | null;
}

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
                <th class="text-left py-1 pr-2 font-medium">Date</th>
                <th class="text-left py-1 pr-2 font-medium">Genres</th>
                <th class="text-left py-1 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.entries}>
                {(entry) => (
                  <tr class="border-b border-border hover:bg-bg-muted">
                    <td class="py-1 pr-2">{entry.artist}</td>
                    <td class="py-1 pr-2">{entry.album}</td>
                    <td class="py-1 pr-2 text-fg-muted">{entry.date ?? ''}</td>
                    <td class="py-1 pr-2 text-fg-muted">{(entry.genres ?? []).join(', ')}</td>
                    <td class="py-1 text-fg-muted">{entry.avgRating != null ? entry.avgRating.toFixed(2) : ''}</td>
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
                {(genre) => (
                  <span class="control-size px-1.5 rounded bg-bg-muted text-fg-subtle">
                    {genre}
                  </span>
                )}
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
