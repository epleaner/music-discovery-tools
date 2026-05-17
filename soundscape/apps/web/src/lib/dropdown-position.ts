interface HorizontalRect {
  left: number;
  right?: number;
  bottom?: number;
  top?: number;
}

interface ElementSize {
  width: number;
}

const viewportPadding = 4;

export function positionDropdownContent(
  triggerRect: Required<Pick<HorizontalRect, 'left' | 'right' | 'bottom'>>,
  contentSize: ElementSize
): { left: number; top: number } {
  return {
    left: Math.max(viewportPadding, triggerRect.right - contentSize.width),
    top: triggerRect.bottom + viewportPadding,
  };
}

export function positionDropdownSubContent(
  triggerRect: Required<Pick<HorizontalRect, 'left' | 'top'>>,
  contentSize: ElementSize
): { left: number; top: number } {
  return {
    left: Math.max(
      viewportPadding,
      triggerRect.left - contentSize.width - viewportPadding
    ),
    top: triggerRect.top,
  };
}
