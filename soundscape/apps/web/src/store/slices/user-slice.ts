import { StateCreator } from 'zustand';
import type { AppStore, UserSlice, UserAction } from '../types';

const initialState = {
  username: '',
  period: '7day' as const,
};

// Reducer for complex state updates (optional pattern)
export const userReducer = (
  state: UserSlice,
  action: UserAction
): Partial<UserSlice> => {
  switch (action.type) {
    case 'SET_USERNAME':
      return { username: action.payload };
    case 'SET_PERIOD':
      return { period: action.payload };
    case 'RESET_USER':
      return initialState;
    default:
      return state;
  }
};

export const createUserSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  UserSlice
> = (set) => ({
  ...initialState,

  setUsername: (username) =>
    set((state) => {
      state.username = username;
    }),

  setPeriod: (period) =>
    set((state) => {
      state.period = period;
    }),

  resetUser: () =>
    set((state) => {
      Object.assign(state, initialState);
    }),
});

