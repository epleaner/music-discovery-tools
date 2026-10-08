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
              <button
                type="button"
                class="result-row w-full items-start text-left"
                classList={{ 'bg-bg-subtle': active() }}
                disabled={!available()}
                aria-label={`${active() ? 'Pause' : 'Play'} ${track.name}`}
                aria-pressed={active()}
                onClick={() =>
                  available() && handleTrackClick(i(), track.streamUrl!)
                }
              >
                <span class="list-count shrink-0">
                  {active() ? 'Ⅱ' : track.position}
                </span>
                <span class="result-main break-words">
                  <span class="result-title">{track.name}</span>
                  <Show when={!available()}>
                    <span class="status block">Unavailable</span>
                  </Show>
                </span>
                <Show when={track.duration != null}>
                  <span class="result-meta numeric shrink-0">
                    {formatDuration(track.duration)}
                  </span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default BandcampPlayer;
