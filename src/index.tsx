import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import App from './modules/App';
import { GlobalStyle, lightTheme, darkTheme, colorTheme, themes } from './styles/theme';

const THEME_KEY = 'notebook-theme';

type ThemeKey = 'light' | 'dark' | 'color';

function ThemeWrapper() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'color') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'color' : 'light');

  const currentTheme = themes.find(t => t.key === theme)?.theme || lightTheme;

  return (
    <ThemeProvider theme={currentTheme}>
      <GlobalStyle />
      <App toggleTheme={toggleTheme} themeMode={theme} setTheme={setTheme} themeKey={theme} />
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ThemeWrapper />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // intentionally empty: ignore registration errors
    });
  });
} 