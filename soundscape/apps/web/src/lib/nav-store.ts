export type ViewKind = 'home' | 'tab' | 'artist' | 'scrape' | 'item';

export type RestoreRef =
  | { type: 'tab'; panel: string; subview?: string }
  | { type: 'artist'; name: string }
  | {
      type: 'scrape';
      requestId: string;
      title: string;
      source?: 'rym' | 'bandcamp';
      url?: string;
      mode?: 'label' | 'related' | 'resolve';
      query?: { artist: string; album?: string; kind: 'album' | 'artist' };
    }
  | {
      type: 'item';
      artist: string;
      album?: string;
      itemKind: 'album' | 'artist';
    };

export interface NavView {
  id: string;
  label: string;
  kind: ViewKind;
  restore: RestoreRef;
  siblingGroup?: string;
}

export interface NavState {
  stack: NavView[];
  index: number;
}

export function appendOrReplace(
  state: NavState,
  view: Omit<NavView, 'id'>,
  id: string,
): NavState {
  const current = state.stack[state.index];
  const newView: NavView = { ...view, id };

  if (current?.siblingGroup !== undefined && current.siblingGroup === view.siblingGroup) {
    return {
      stack: [...state.stack.slice(0, state.index), newView],
      index: state.index,
    };
  }

  const stack = [...state.stack.slice(0, state.index + 1), newView];
  return { stack, index: stack.length - 1 };
}

export function moveHistory(state: NavState, direction: -1 | 1): NavState {
  const index = state.index + direction;
  if (index < 0 || index >= state.stack.length) return state;
  return { stack: state.stack, index };
}

export function homeState(homeView: NavView): NavState {
  return { stack: [homeView], index: 0 };
}

export function serialize(state: NavState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function deserialize(str: string): NavState | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(str));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('stack' in parsed) ||
      !('index' in parsed) ||
      !Array.isArray((parsed as { stack: unknown }).stack)
    ) {
      return null;
    }
    return parsed as NavState;
  } catch {
    return null;
  }
}
