import { Component, JSX, createSignal, onMount, onCleanup } from 'solid-js';

interface ResizablePanelsProps {
  leftPanel: JSX.Element;
  rightPanel: JSX.Element;
  initialLeftWidth?: number; // percentage
  minLeftWidth?: number; // percentage
  maxLeftWidth?: number; // percentage
}

const ResizablePanels: Component<ResizablePanelsProps> = (props) => {
  const [leftWidth, setLeftWidth] = createSignal(props.initialLeftWidth || 70);
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
    const offsetX = e.clientX - containerRect.left;
    const newWidthPercent = (offsetX / containerRect.width) * 100;

    const minWidth = props.minLeftWidth || 20;
    const maxWidth = props.maxLeftWidth || 80;

    const clampedWidth = Math.max(
      minWidth,
      Math.min(maxWidth, newWidthPercent)
    );
    setLeftWidth(clampedWidth);
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
    <div ref={containerRef} class='flex flex-1 overflow-hidden'>
      {/* Left Panel */}
      <div
        class='border-r border-border overflow-hidden'
        style={{ width: `${leftWidth()}%`, 'min-width': '0', height: '100%' }}>
        {props.leftPanel}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        class={`w-1 cursor-col-resize hover:bg-border-hover transition-colors ${
          isDragging() ? 'bg-border-hover' : ''
        }`}
      />

      {/* Right Panel */}
      <div class='flex-1 overflow-hidden' style={{ 'min-width': '0', height: '100%' }}>
        {props.rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanels;
