import { StateCreator } from 'zustand';
import type { AppStore, UISlice, UIAction } from '../types';

const initialState = {
  currentView: 'recent' as const,
  recentViewType: 'tracks' as const,
};

// Reducer for complex state updates (optional pattern)
export const uiReducer = (state: UISlice, action: UIAction): Partial<UISlice> => {
  switch (action.type) {
    case 'SET_CURRENT_VIEW':
      return { currentView: action.payload };
    case 'SET_RECENT_VIEW_TYPE':
      return { recentViewType: action.payload };
    case 'RESET_UI':
      return initialState;
    default:
      return state;
  }
};

export const createUISlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set) => ({
  ...initialState,

  setCurrentView: (view) =>
    set((state) => {
      state.currentView = view;
    }),

  setRecentViewType: (viewType) =>
    set((state) => {
      state.recentViewType = viewType;
    }),

  resetUI: () =>
    set((state) => {
      Object.assign(state, initialState);
    }),
});

