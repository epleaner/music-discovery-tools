import {
  type Component,
  type JSX,
  Show,
  createSignal,
  createUniqueId,
} from 'solid-js';

interface ResizablePanelsProps {
  leftPanel: JSX.Element;
  rightPanel: JSX.Element;
  initialLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  showRightPanel?: boolean;
}

const ResizablePanels: Component<ResizablePanelsProps> = (props) => {
  const [leftWidth, setLeftWidth] = createSignal(props.initialLeftWidth ?? 65);
  const [isDragging, setIsDragging] = createSignal(false);
  const primaryId = createUniqueId();
  let containerRef: HTMLDivElement | undefined;

  const resize = (width: number) => {
    setLeftWidth(
      Math.max(
        props.minLeftWidth ?? 30,
        Math.min(props.maxLeftWidth ?? 80, width)
      )
    );
  };

  return (
    <div
      ref={containerRef}
      class="workspace-split"
      data-single={props.showRightPanel === false}
      style={{ '--primary-width': `${leftWidth()}%` }}
    >
      <section
        id={primaryId}
        class="workspace-primary workspace-panel"
        aria-label="Listening workspace"
      >
        {props.leftPanel}
      </section>
      <Show when={props.showRightPanel !== false}>
        <div
          class="resize-handle"
          role="separator"
          tabindex={0}
          aria-label="Resize listening and discovery panels"
          aria-orientation="vertical"
          aria-controls={primaryId}
          aria-valuemin={props.minLeftWidth ?? 30}
          aria-valuemax={props.maxLeftWidth ?? 80}
          aria-valuenow={Math.round(leftWidth())}
          data-dragging={isDragging()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDragging(true);
          }}
          onPointerMove={(event) => {
            if (!isDragging() || !containerRef) return;
            const bounds = containerRef.getBoundingClientRect();
            resize(((event.clientX - bounds.left) / bounds.width) * 100);
          }}
          onPointerUp={() => setIsDragging(false)}
          onLostPointerCapture={() => setIsDragging(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') resize(leftWidth() - 2);
            else if (event.key === 'ArrowRight') resize(leftWidth() + 2);
            else if (event.key === 'Home') resize(props.minLeftWidth ?? 30);
            else if (event.key === 'End') resize(props.maxLeftWidth ?? 80);
            else return;
            event.preventDefault();
          }}
        />
        <aside
          class="workspace-secondary workspace-panel"
          aria-label="Discovery"
        >
          {props.rightPanel}
        </aside>
      </Show>
    </div>
  );
};

export default ResizablePanels;
