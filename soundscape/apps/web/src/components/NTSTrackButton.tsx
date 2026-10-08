import type { Component } from 'solid-js';
import Button from './Button';

interface NTSTrackButtonProps {
  track: string;
  artist: string;
  onClick: () => void;
}

const NTSTrackButton: Component<NTSTrackButtonProps> = (props) => (
  <Button
    variant="link"
    title={`Search NTS for ${props.track} by ${props.artist}`}
    aria-label={`Search NTS for ${props.track} by ${props.artist}`}
    onClick={props.onClick}
  >
    NTS <span class="list-action-label">{props.artist}</span>
  </Button>
);

export default NTSTrackButton;
