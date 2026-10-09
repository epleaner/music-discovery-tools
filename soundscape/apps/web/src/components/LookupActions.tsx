import type { Component } from 'solid-js';
import { getRYMSearchUrl } from '@soundscape/utils';
import Button from './Button';
import ExternalLink from './ExternalLink';

interface LookupActionsProps {
  artist: string;
  track?: string;
  onNTSLookup?: (query: string) => void;
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
      <Button
        variant="link"
        title={`Search NTS for ${description()}`}
        aria-label={`Search NTS for ${description()}`}
        onClick={() => props.onNTSLookup?.(query())}
      >
        NTS
      </Button>
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
