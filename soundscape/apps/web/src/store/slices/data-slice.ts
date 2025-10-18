import { StateCreator } from 'zustand';
import type { AppStore, DataSlice, DataAction } from '../types';

const initialState = {
  selectedArtist: '',
};

// Reducer for complex state updates (optional pattern)
export const dataReducer = (
  state: DataSlice,
  action: DataAction
): Partial<DataSlice> => {
  switch (action.type) {
    case 'SET_SELECTED_ARTIST':
      return { selectedArtist: action.payload };
    case 'RESET_DATA':
      return initialState;
    default:
      return state;
  }
};

export const createDataSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  DataSlice
> = (set) => ({
  ...initialState,

  setSelectedArtist: (artist) =>
    set((state) => {
      state.selectedArtist = artist;
    }),

  resetData: () =>
    set((state) => {
      Object.assign(state, initialState);
    }),
});

