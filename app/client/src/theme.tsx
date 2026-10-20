import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);
function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem('spf.theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // The toggle still works for this visit when storage is unavailable.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(preferredTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content =
      theme === 'dark' ? '#10151e' : '#f8fafc';
  }, [theme]);
  useEffect(() => {
    const sync = () => setTheme(preferredTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'spf.theme' || event.key === null) sync();
    };
    const system = matchMedia('(prefers-color-scheme: dark)');
    system.addEventListener('change', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      system.removeEventListener('change', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('spf.theme', next);
    } catch {
      // Keep the in-memory preference if persistence is blocked.
    }
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext)!;
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label="Dark mode"
      aria-pressed={theme === 'dark'}
      onClick={toggle}
    >
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}
