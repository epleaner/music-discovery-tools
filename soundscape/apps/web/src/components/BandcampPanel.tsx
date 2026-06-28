import { Component } from 'solid-js';

interface BandcampPanelProps {
  bandcampUrl: string;
}

const BandcampPanel: Component<BandcampPanelProps> = (props) => {
  return (
    <div class="p-4 text-xs text-fg-muted">
      <div>bandcampUrl: {props.bandcampUrl}</div>
    </div>
  );
};

export default BandcampPanel;
