import { Component, For, createSignal, Show } from 'solid-js';
import SourceLink from './SourceLink';

interface Track {
  name: string;
  url?: string;
  position: number;
  duration: number | null;
  streamUrl: string | null;
}

interface BandcampPlayerProps {
  tracks: Track[];
  base: string;
}

const BandcampPlayer: Component<BandcampPlayerProps> = (props) => {
  let audioRef: HTMLAudioElement | undefined;
  const [playingIndex, setPlayingIndex] = createSignal<number | null>(null);
  const [isPlaying, setIsPlaying] = createSignal(false);

  const formatDuration = (secs: number | null): string => {
    if (secs == null) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTrackClick = (index: number, streamUrl: string) => {
    const audio = audioRef!;
    if (playingIndex() === index && isPlaying()) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.src = streamUrl;
      audio.play();
      setPlayingIndex(index);
      setIsPlaying(true);
    }
  };

  const currentTrack = () => {
    const i = playingIndex();
    return i !== null ? props.tracks[i] : null;
  };

  return (
    <div class="space-y-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      <Show when={currentTrack()}>
        <div class="status break-words" role="status">
          {isPlaying() ? 'Playing' : 'Paused'}: {currentTrack()!.name}
        </div>
      </Show>
      <div class="result-list">
        <For each={props.tracks}>
          {(track, i) => {
            const available = () => track.streamUrl !== null;
            const active = () => playingIndex() === i() && isPlaying();
            return (
              <div class="list-row" classList={{ 'bg-bg-subtle': active() }}>
                <button
                  type="button"
                  class="btn-icon shrink-0"
                  disabled={!available()}
                  aria-label={`${active() ? 'Pause' : 'Play'} ${track.name}`}
                  aria-pressed={active()}
                  onClick={() =>
                    available() && handleTrackClick(i(), track.streamUrl!)
                  }
                >
                  <span class="list-count">
                    {active() ? 'Ⅱ' : track.position}
                  </span>
                </button>
                <span class="list-main">
                  <span class="list-title whitespace-normal break-words">
                    <SourceLink href={track.url} base={props.base}>
                      {track.name}
                    </SourceLink>
                  </span>
                  <Show when={!available()}>
                    <span class="list-meta">Unavailable</span>
                  </Show>
                  <Show when={track.duration != null}>
                    <span class="list-meta numeric">
                      {formatDuration(track.duration)}
                    </span>
                  </Show>
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default BandcampPlayer;
