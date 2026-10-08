import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

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

/** Persisted appearance; accents never recolor the neutral workspace surfaces. */
export function useTheme() {
  const [theme, setTheme] = createSignal<Theme>(
    (localStorage.getItem('theme') as Theme | null) ?? 'dark'
  );
  const [colorTheme, setColorTheme] = createSignal<ColorTheme>(
    (localStorage.getItem('colorTheme') as ColorTheme | null) ?? 'default'
  );
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const [systemDark, setSystemDark] = createSignal(systemTheme.matches);

  onMount(() => {
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    systemTheme.addEventListener('change', handleChange);
    onCleanup(() => systemTheme.removeEventListener('change', handleChange));
  });

  createEffect(() => {
    const currentTheme = theme();
    const currentColorTheme = colorTheme();
    const dark =
      currentTheme === 'dark' || (currentTheme === 'system' && systemDark());
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    root.dataset.colorTheme = currentColorTheme;
    localStorage.setItem('theme', currentTheme);
    localStorage.setItem('colorTheme', currentColorTheme);
  });

  return {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
  };
}
