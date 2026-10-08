import { type Component, Show, createMemo, createSignal } from 'solid-js';
import type { Track } from '@soundscape/types';

const Artwork: Component<{ images?: Track['image'] }> = (props) => {
  const [failedUrl, setFailedUrl] = createSignal('');
  const imageUrl = createMemo(() => {
    let selected = '';
    let selectedRank = Infinity;
    for (const image of props.images ?? []) {
      const url = image['#text'];
      // Last.fm's generic star is not artist or release artwork.
      if (!url || url.includes('2a96cbd8b46e442fc41c2b86b821562f')) continue;
      const rank = image.size === 'medium' ? 0 : image.size === 'small' ? 1 : 2;
      if (rank < selectedRank) {
        selected = url;
        selectedRank = rank;
      }
    }
    return selected;
  });

  return (
    <Show
      when={imageUrl() && imageUrl() !== failedUrl()}
      fallback={<span class="list-cover" aria-hidden="true" />}
    >
      <img
        src={imageUrl()}
        alt=""
        width="48"
        height="48"
        loading="lazy"
        class="list-cover"
        onError={() => setFailedUrl(imageUrl())}
      />
    </Show>
  );
};

export default Artwork;
