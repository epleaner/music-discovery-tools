import { Component, JSX, createSignal, onMount, onCleanup } from 'solid-js';

interface ResizableBottomProps {
  topPanel: JSX.Element;
  bottomPanel: JSX.Element;
  initialBottomHeight?: number; // pixels
  minBottomHeight?: number; // pixels
  maxBottomHeight?: number; // pixels
}

const ResizableBottom: Component<ResizableBottomProps> = (props) => {
  const [bottomHeight, setBottomHeight] = createSignal(
    props.initialBottomHeight || 300
  );
  const [isDragging, setIsDragging] = createSignal(false);
  // @ts-ignore - ref will be assigned by SolidJS
  let containerRef: HTMLDivElement;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return;

    const containerRect = containerRef.getBoundingClientRect();
    const offsetY = containerRect.bottom - e.clientY;

    const minHeight = props.minBottomHeight || 150;
    const maxHeight = props.maxBottomHeight || containerRect.height - 100;

    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, offsetY));
    setBottomHeight(clampedHeight);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  return (
    <div ref={containerRef} class='flex flex-col flex-1 overflow-hidden'>
      {/* Top Panel */}
      <div
        class='overflow-hidden'
        style={{ flex: '1 1 auto', 'min-height': '0' }}>
        {props.topPanel}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        class={`h-1 flex-shrink-0 cursor-row-resize hover:bg-border-hover transition-colors ${
          isDragging() ? 'bg-border-hover' : ''
        }`}
      />

      {/* Bottom Panel */}
      <div
        class='flex-shrink-0 overflow-hidden'
        style={{ height: `${bottomHeight()}px` }}>
        {props.bottomPanel}
      </div>
    </div>
  );
};

export default ResizableBottom;
