import type { Component } from 'solid-js';
import { getRYMSearchUrl } from '@soundscape/utils';
import ExternalLink from './ExternalLink';

interface LookupActionsProps {
  artist: string;
  track?: string;
}

const LookupActions: Component<LookupActionsProps> = (props) => {
  const query = () =>
    props.track === undefined ? props.artist : `${props.artist} ${props.track}`;
  const description = () =>
    props.track === undefined
      ? props.artist
      : `${props.track} by ${props.artist}`;

  return (
    <div class="list-actions">
      <ExternalLink
        href={`https://www.nts.live/find?q=${encodeURIComponent(query())}`}
        class="btn btn-link"
        title={`Search NTS for ${description()}`}
        aria-label={`Search NTS for ${description()}`}
      >
        NTS
      </ExternalLink>
      <ExternalLink
        href={getRYMSearchUrl(query())}
        class="btn btn-link"
        title={`Search RateYourMusic for ${description()}`}
        aria-label={`Search RateYourMusic for ${description()}`}
      >
        RYM
      </ExternalLink>
    </div>
  );
};

export default LookupActions;
