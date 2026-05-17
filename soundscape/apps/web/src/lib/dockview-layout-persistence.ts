import { parseHash, stringifyHash } from '@soundscape/utils';
import {
  dockviewPanelTypes,
  type DockviewPanelType,
} from './dockview-panel-catalog';

export const dockviewLayoutHashKey = 'dockviewLayout';
export const dockviewLayoutLocalStorageKey = 'soundscape:dockview-layout';

export type SerializedDockviewLayout = Record<string, unknown>;

export function encodeDockviewLayout(layout: unknown): string {
  return JSON.stringify(layout);
}

export function decodeDockviewLayout(
  encodedLayout: string | undefined | null
): SerializedDockviewLayout | undefined {
  if (!encodedLayout) return undefined;

  try {
    const parsed = JSON.parse(encodedLayout);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SerializedDockviewLayout;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function readDockviewLayoutFromHash(
  hash: string = window.location.hash
): SerializedDockviewLayout | undefined {
  return decodeDockviewLayout(parseHash(hash)[dockviewLayoutHashKey]);
}

export function writeDockviewLayoutToHash(
  hash: string,
  layout: unknown
): string {
  return stringifyHash({
    ...parseHash(hash),
    [dockviewLayoutHashKey]: encodeDockviewLayout(layout),
  });
}

export function replaceDockviewLayoutHash(layout: unknown): void {
  window.history.replaceState(
    null,
    '',
    writeDockviewLayoutToHash(window.location.hash, layout) ||
      window.location.pathname
  );
}

export function readDockviewLayoutFromLocalStorage(
  storage: Pick<Storage, 'getItem'> = window.localStorage
): SerializedDockviewLayout | undefined {
  return decodeDockviewLayout(storage.getItem(dockviewLayoutLocalStorageKey));
}

export function writeDockviewLayoutToLocalStorage(
  layout: unknown,
  storage: Pick<Storage, 'setItem'> = window.localStorage
): void {
  storage.setItem(dockviewLayoutLocalStorageKey, encodeDockviewLayout(layout));
}

export function readInitialDockviewLayout():
  | SerializedDockviewLayout
  | undefined {
  return readDockviewLayoutFromHash() ?? readDockviewLayoutFromLocalStorage();
}

function visitPanelState(
  value: unknown,
  visit: (panelState: Record<string, unknown>) => void
): void {
  if (!value || typeof value !== 'object') return;

  if ('id' in value && 'contentComponent' in value) {
    visit(value as Record<string, unknown>);
  }

  if (Array.isArray(value)) {
    for (const item of value) visitPanelState(item, visit);
    return;
  }

  for (const child of Object.values(value)) {
    visitPanelState(child, visit);
  }
}

const supportedDockviewPanelTypes = new Set(
  dockviewPanelTypes.map((panelType) => panelType.id)
);

export function hasUnsupportedDockviewPanels(layout: unknown): boolean {
  let hasUnsupportedPanel = false;

  visitPanelState(layout, (panelState) => {
    const component = panelState.contentComponent;
    if (
      typeof component === 'string' &&
      !supportedDockviewPanelTypes.has(component as DockviewPanelType)
    ) {
      hasUnsupportedPanel = true;
    }
  });

  return hasUnsupportedPanel;
}

export function collectDockviewPanelInstanceCounts(
  layout: unknown
): Map<DockviewPanelType, number> {
  const counts = new Map<DockviewPanelType, number>();

  visitPanelState(layout, (panelState) => {
    const component = panelState.contentComponent;
    const id = panelState.id;
    if (typeof component !== 'string' || typeof id !== 'string') return;

    const match = id.match(/^(.*)-(\d+)$/);
    if (!match) return;

    const panelType = component as DockviewPanelType;
    const instanceNumber = Number(match[2]);
    counts.set(panelType, Math.max(counts.get(panelType) ?? 0, instanceNumber));
  });

  return counts;
}
