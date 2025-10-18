import { useAppStore } from './index';
import * as selectors from './selectors';

/**
 * Custom hooks for common state access patterns
 * These provide a cleaner API than using useAppStore directly
 */

// UI Hooks
export const useCurrentView = () => useAppStore(selectors.selectCurrentView);
export const useRecentViewType = () => useAppStore(selectors.selectRecentViewType);
export const useIsRecentView = () => useAppStore(selectors.selectIsRecentView);
export const useIsTopView = () => useAppStore(selectors.selectIsTopView);
export const useIsSimilarView = () => useAppStore(selectors.selectIsSimilarView);

// User Hooks
export const useUsername = () => useAppStore(selectors.selectUsername);
export const usePeriod = () => useAppStore(selectors.selectPeriod);
export const useHasUsername = () => useAppStore(selectors.selectHasUsername);

// Data Hooks
export const useSelectedArtist = () => useAppStore(selectors.selectSelectedArtist);
export const useHasSelectedArtist = () =>
  useAppStore(selectors.selectHasSelectedArtist);

// Derived State Hooks
export const useCanViewSimilar = () => useAppStore(selectors.selectCanViewSimilar);
export const useShouldShowRecentViewSelector = () =>
  useAppStore(selectors.selectShouldShowRecentViewSelector);
export const useShouldShowTopPeriodSelector = () =>
  useAppStore(selectors.selectShouldShowTopPeriodSelector);

// Action Hooks
export const useUIActions = () => useAppStore(selectors.selectUIActions);
export const useUserActions = () => useAppStore(selectors.selectUserActions);
export const useDataActions = () => useAppStore(selectors.selectDataActions);
export const useAllActions = () => useAppStore(selectors.selectAllActions);

// Composite hooks for common use cases
export const useViewState = () => ({
  currentView: useCurrentView(),
  recentViewType: useRecentViewType(),
  isRecentView: useIsRecentView(),
  isTopView: useIsTopView(),
  isSimilarView: useIsSimilarView(),
});

export const useUserState = () => ({
  username: useUsername(),
  period: usePeriod(),
  hasUsername: useHasUsername(),
});

export const useDataState = () => ({
  selectedArtist: useSelectedArtist(),
  hasSelectedArtist: useHasSelectedArtist(),
  canViewSimilar: useCanViewSimilar(),
});

