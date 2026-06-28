import { Component, For, createSignal, Show } from 'solid-js';

interface Track {
  name: string;
  position: number;
  duration: number | null;
  streamUrl: string | null;
}

interface BandcampPlayerProps {
  tracks: Track[];
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
    <div class="mt-3">
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
      />
      <Show when={currentTrack()}>
        <div class="mb-2 text-xs text-fg-muted flex items-center gap-1">
          <span class="text-fg">♪</span>
          <span>{currentTrack()!.name}</span>
        </div>
      </Show>
      <div class="flex flex-col gap-0.5">
        <For each={props.tracks}>
          {(track, i) => {
            const available = () => track.streamUrl !== null;
            const active = () => playingIndex() === i() && isPlaying();
            return (
              <div
                class={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  available()
                    ? 'hover:bg-bg-subtle cursor-pointer'
                    : 'opacity-40 cursor-default'
                } ${active() ? 'bg-bg-subtle' : ''}`}
                onClick={() => available() && handleTrackClick(i(), track.streamUrl!)}
              >
                <span class="w-4 text-right text-fg-subtle shrink-0">
                  {active() ? '▶' : track.position}
                </span>
                <span class="flex-1 min-w-0 truncate text-fg">
                  {track.name}
                  {!available() && (
                    <span class="ml-1 text-fg-subtle">(unavailable)</span>
                  )}
                </span>
                <Show when={track.duration}>
                  <span class="text-fg-subtle shrink-0">{formatDuration(track.duration)}</span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default BandcampPlayer;
