import type { TimePeriod, RecentViewType } from '@soundscape/types';

// View types
export type MainView = 'recent' | 'top' | 'similar';

// UI Slice
export interface UIState {
  currentView: MainView;
  recentViewType: RecentViewType;
}

export interface UIActions {
  setCurrentView: (view: MainView) => void;
  setRecentViewType: (viewType: RecentViewType) => void;
  resetUI: () => void;
}

export type UISlice = UIState & UIActions;

// User Slice
export interface UserState {
  username: string;
  period: TimePeriod;
}

export interface UserActions {
  setUsername: (username: string) => void;
  setPeriod: (period: TimePeriod) => void;
  resetUser: () => void;
}

export type UserSlice = UserState & UserActions;

// Data Slice
export interface DataState {
  selectedArtist: string;
}

export interface DataActions {
  setSelectedArtist: (artist: string) => void;
  resetData: () => void;
}

export type DataSlice = DataState & DataActions;

// Combined Store
export type AppStore = UISlice & UserSlice & DataSlice;

// Action types for reducer pattern (optional, for complex actions)
export type UIAction =
  | { type: 'SET_CURRENT_VIEW'; payload: MainView }
  | { type: 'SET_RECENT_VIEW_TYPE'; payload: RecentViewType }
  | { type: 'RESET_UI' };

export type UserAction =
  | { type: 'SET_USERNAME'; payload: string }
  | { type: 'SET_PERIOD'; payload: TimePeriod }
  | { type: 'RESET_USER' };

export type DataAction =
  | { type: 'SET_SELECTED_ARTIST'; payload: string }
  | { type: 'RESET_DATA' };

