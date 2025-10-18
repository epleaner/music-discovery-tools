# State Management with Zustand

This application uses Zustand for state management with a clean, scalable architecture.

## Architecture

### Slices Pattern

State is organized into domain-specific slices:

- **UI Slice** (`store/slices/ui-slice.ts`) - UI state like current view and view types
- **User Slice** (`store/slices/user-slice.ts`) - User preferences like username and period
- **Data Slice** (`store/slices/data-slice.ts`) - Data state like selected artist

Each slice:
- Defines its own state and actions
- Uses immer middleware for immutable updates
- Includes a reducer for complex state updates (optional pattern)
- Is fully typed with TypeScript

### Store Structure

```
src/store/
├── types.ts           # TypeScript types for state, actions, and action types
├── slices/            # Domain-specific state slices
│   ├── ui-slice.ts
│   ├── user-slice.ts
│   └── data-slice.ts
├── selectors.ts       # Derived state and selector functions
├── hooks.ts           # Custom React-like hooks for components
└── index.ts           # Main store combining all slices
```

### Middleware

- **immer** - Enables mutable syntax for immutable updates
- **devtools** - Redux DevTools integration for debugging

## Usage

### In Components

```typescript
// Import custom hooks
import { useUsername, useUserActions } from './store/hooks';

const MyComponent = () => {
  // Access state
  const username = useUsername();
  
  // Access actions
  const { setUsername } = useUserActions();
  
  // Use them
  return <input value={username()} onChange={e => setUsername(e.target.value)} />;
};
```

### Using Selectors

```typescript
import { useAppStore } from './store';
import { selectHasUsername } from './store/selectors';

const MyComponent = () => {
  const hasUsername = useAppStore(selectHasUsername);
  
  return hasUsername() ? <Content /> : <Login />;
};
```

### Custom Hooks for Common Patterns

```typescript
import { useViewState, useUserState } from './store/hooks';

const MyComponent = () => {
  // Get multiple related state values
  const { currentView, recentViewType, isRecentView } = useViewState();
  const { username, period, hasUsername } = useUserState();
};
```

## Best Practices

### 1. Use Selectors for Derived State

Instead of computing in components:
```typescript
// ❌ Don't
const hasUsername = () => username().trim().length > 0;

// ✅ Do
const hasUsername = useHasUsername();
```

### 2. Group Related Actions

```typescript
// ❌ Don't
const setUsername = useAppStore(state => state.setUsername);
const setPeriod = useAppStore(state => state.setPeriod);

// ✅ Do
const { setUsername, setPeriod } = useUserActions();
```

### 3. Use Custom Hooks for Common Patterns

Create custom hooks for frequently used state combinations:
```typescript
export const useViewState = () => ({
  currentView: useCurrentView(),
  recentViewType: useRecentViewType(),
  isRecentView: useIsRecentView(),
});
```

### 4. Keep Slices Focused

Each slice should have a single responsibility:
- UI state (views, modals, UI flags)
- User preferences (username, settings)
- Data state (selected items, cached data)

### 5. Use Action Types for Complex Updates

For complex state updates, define action types and use reducers:
```typescript
export type UIAction =
  | { type: 'SET_CURRENT_VIEW'; payload: MainView }
  | { type: 'RESET_UI' };

export const uiReducer = (state: UISlice, action: UIAction) => {
  switch (action.type) {
    case 'SET_CURRENT_VIEW':
      return { currentView: action.payload };
    case 'RESET_UI':
      return initialState;
    default:
      return state;
  }
};
```

## Extending the Store

### Adding a New Slice

1. Create slice file in `store/slices/`:
```typescript
// store/slices/new-slice.ts
import { StateCreator } from 'zustand';
import type { AppStore } from '../types';

export interface NewSlice {
  // State
  someValue: string;
  // Actions
  setSomeValue: (value: string) => void;
}

export const createNewSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  NewSlice
> = (set) => ({
  someValue: '',
  setSomeValue: (value) => set((state) => {
    state.someValue = value;
  }),
});
```

2. Add types to `store/types.ts`:
```typescript
export type AppStore = UISlice & UserSlice & DataSlice & NewSlice;
```

3. Combine in `store/index.ts`:
```typescript
import { createNewSlice } from './slices/new-slice';

export const useAppStore = create<AppStore>()(
  devtools(
    immer((...args) => ({
      ...createUISlice(...args),
      ...createUserSlice(...args),
      ...createDataSlice(...args),
      ...createNewSlice(...args), // Add here
    }))
  )
);
```

4. Add selectors in `store/selectors.ts`:
```typescript
export const selectSomeValue = (state: AppStore) => state.someValue;
```

5. Add hooks in `store/hooks.ts`:
```typescript
export const useSomeValue = () => useAppStore(selectSomeValue);
```

### Adding Actions to Existing Slice

1. Update the slice interface in `store/types.ts`
2. Implement action in the slice file
3. Add selector if needed
4. Add hook if needed

## Testing

The store is designed for easy testing:

```typescript
import { useAppStore } from './store';

describe('Store', () => {
  it('should update username', () => {
    const { setUsername } = useAppStore.getState();
    setUsername('testuser');
    expect(useAppStore.getState().username).toBe('testuser');
  });
});
```

## Debugging

Use Redux DevTools extension to:
- Inspect state
- Track actions
- Time-travel debug
- Export/import state

Store name: `soundscape-store`

