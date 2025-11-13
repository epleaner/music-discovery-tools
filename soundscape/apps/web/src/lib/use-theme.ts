import { createSignal, createEffect, onMount } from 'solid-js';

export type Theme = 'light' | 'dark' | 'system';
export type ColorTheme =
  | 'default'
  | 'blue'
  | 'green'
  | 'purple'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'twilight'
  | 'fire';

/**
 * Hook for managing theme preference with localStorage persistence
 */
export function useTheme() {
  const [theme, setTheme] = createSignal<Theme>('system');
  const [colorTheme, setColorTheme] = createSignal<ColorTheme>('default');

  // Initialize theme from localStorage
  onMount(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const storedColorTheme = localStorage.getItem(
      'colorTheme'
    ) as ColorTheme | null;

    if (storedTheme) {
      setTheme(storedTheme);
    }
    if (storedColorTheme) {
      setColorTheme(storedColorTheme);
    }

    applyTheme(storedTheme || 'system', storedColorTheme || 'default');
  });

  // Apply theme whenever it changes
  createEffect(() => {
    const currentTheme = theme();
    const currentColorTheme = colorTheme();
    localStorage.setItem('theme', currentTheme);
    localStorage.setItem('colorTheme', currentColorTheme);
    applyTheme(currentTheme, currentColorTheme);
  });

  const applyTheme = (theme: Theme, colorTheme: ColorTheme) => {
    const root = document.documentElement;

    // Apply light/dark theme
    if (theme === 'system') {
      root.classList.remove('light', 'dark');
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }

    // Apply color theme
    root.removeAttribute('data-color-theme');
    if (colorTheme !== 'default') {
      root.setAttribute('data-color-theme', colorTheme);
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
    colorTheme,
    setColorTheme,
  };
}
