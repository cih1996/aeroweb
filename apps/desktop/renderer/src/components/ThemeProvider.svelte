<script lang="ts" context="module">
  export type Theme = 'light' | 'dark' | 'system';

  const THEME_KEY = 'polyweb-theme';

  export function getStoredTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'system';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
  }

  export function setStoredTheme(theme: Theme): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
  }
</script>

<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  export let theme: Theme = 'system';

  const dispatch = createEventDispatcher<{ change: { theme: Theme; resolved: 'light' | 'dark' } }>();

  let resolvedTheme: 'light' | 'dark' = 'dark';
  let mediaQuery: MediaQueryList | null = null;

  function getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function resolveTheme(t: Theme): 'light' | 'dark' {
    if (t === 'system') {
      return getSystemTheme();
    }
    return t;
  }

  function applyTheme(t: 'light' | 'dark') {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', t);
    resolvedTheme = t;
  }

  function handleSystemChange(e: MediaQueryListEvent) {
    if (theme === 'system') {
      const newResolved = e.matches ? 'light' : 'dark';
      applyTheme(newResolved);
      dispatch('change', { theme, resolved: newResolved });
    }
  }

  export function setTheme(newTheme: Theme) {
    theme = newTheme;
    setStoredTheme(newTheme);
    const resolved = resolveTheme(newTheme);
    applyTheme(resolved);
    dispatch('change', { theme: newTheme, resolved });
  }

  export function toggleTheme() {
    // 循环切换: dark -> light -> system -> dark
    const order: Theme[] = ['dark', 'light', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  }

  export function getResolvedTheme(): 'light' | 'dark' {
    return resolvedTheme;
  }

  onMount(() => {
    // 读取存储的主题
    theme = getStoredTheme();

    // 监听系统主题变化
    mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    mediaQuery.addEventListener('change', handleSystemChange);

    // 应用主题
    const resolved = resolveTheme(theme);
    applyTheme(resolved);

    return () => {
      mediaQuery?.removeEventListener('change', handleSystemChange);
    };
  });

  // 响应 theme prop 变化
  $: {
    if (typeof document !== 'undefined') {
      const resolved = resolveTheme(theme);
      applyTheme(resolved);
    }
  }
</script>

<slot {theme} {resolvedTheme} {setTheme} {toggleTheme} />
