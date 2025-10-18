import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { createUISlice } from './slices/ui-slice';
import { createUserSlice } from './slices/user-slice';
import { createDataSlice } from './slices/data-slice';
import type { AppStore } from './types';

/**
 * Main application store combining all slices
 * Uses immer middleware for immutable state updates
 * Uses devtools middleware for Redux DevTools integration
 */
export const useAppStore = create<AppStore>()(
  devtools(
    immer((...args) => ({
      ...createUISlice(...args),
      ...createUserSlice(...args),
      ...createDataSlice(...args),
    })),
    {
      name: 'soundscape-store',
    }
  )
);

// Export store for testing or non-hook usage
export { useAppStore as default };

// Re-export types for convenience
export type { AppStore } from './types';

