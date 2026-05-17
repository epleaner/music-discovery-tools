import { dockviewPanelTypes } from './dockview-panel-catalog';

export function shouldShowDockviewEmptyState(totalPanels: number): boolean {
  return totalPanels === 0;
}

export function getDockviewEmptyStateOverlayClass(): string {
  return 'absolute inset-0 z-[2147483647] flex items-center justify-center bg-bg';
}

export function shouldResetDockviewBeforeEmptyStatePanelAdd(
  totalPanels: number
): boolean {
  return totalPanels === 0;
}

export function getDockviewEmptyStateMenuItemLabels(): string[] {
  return dockviewPanelTypes.map((panelType) => panelType.title);
}
