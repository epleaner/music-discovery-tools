import type { AppStore } from './types';

/**
 * Selectors for derived state and commonly accessed state
 * Use these to avoid prop drilling and maintain single source of truth
 */

// UI Selectors
export const selectCurrentView = (state: AppStore) => state.currentView;
export const selectRecentViewType = (state: AppStore) => state.recentViewType;
export const selectIsRecentView = (state: AppStore) => state.currentView === 'recent';
export const selectIsTopView = (state: AppStore) => state.currentView === 'top';
export const selectIsSimilarView = (state: AppStore) =>
  state.currentView === 'similar';

// User Selectors
export const selectUsername = (state: AppStore) => state.username;
export const selectPeriod = (state: AppStore) => state.period;
export const selectHasUsername = (state: AppStore) => state.username.trim().length > 0;

// Data Selectors
export const selectSelectedArtist = (state: AppStore) => state.selectedArtist;
export const selectHasSelectedArtist = (state: AppStore) =>
  state.selectedArtist.trim().length > 0;

// Combined/Derived Selectors
export const selectCanViewSimilar = (state: AppStore) =>
  state.selectedArtist.trim().length > 0;

export const selectShouldShowRecentViewSelector = (state: AppStore) =>
  state.currentView === 'recent' && state.username.trim().length > 0;

export const selectShouldShowTopPeriodSelector = (state: AppStore) =>
  state.currentView === 'top' && state.username.trim().length > 0;

// Action Selectors (for passing to components)
export const selectUIActions = (state: AppStore) => ({
  setCurrentView: state.setCurrentView,
  setRecentViewType: state.setRecentViewType,
  resetUI: state.resetUI,
});

export const selectUserActions = (state: AppStore) => ({
  setUsername: state.setUsername,
  setPeriod: state.setPeriod,
  resetUser: state.resetUser,
});

export const selectDataActions = (state: AppStore) => ({
  setSelectedArtist: state.setSelectedArtist,
  resetData: state.resetData,
});

// Composite selector for all actions
export const selectAllActions = (state: AppStore) => ({
  ...selectUIActions(state),
  ...selectUserActions(state),
  ...selectDataActions(state),
});

