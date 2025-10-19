import { createSignal, createEffect, onMount } from 'solid-js';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Hook for managing theme preference with localStorage persistence
 */
export function useTheme() {
  const [theme, setTheme] = createSignal<Theme>('system');

  // Initialize theme from localStorage
  onMount(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    }
    applyTheme(stored || 'system');
  });

  // Apply theme whenever it changes
  createEffect(() => {
    const currentTheme = theme();
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
  });

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      root.classList.remove('light', 'dark');
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  };

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}

