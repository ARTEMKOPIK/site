import { createGlobalStyle } from 'styled-components';

export const darkTheme = {
  colors: {
    background: '#18181b',
    backgroundLight: '#23232a',
    text: '#f4f4f5',
    textLight: '#f4f4f5',
    accent: '#6366f1',
    border: '#27272a',
    borderLight: '#3f3f46',
    success: '#22c55e',
    warning: '#f59e42',
    danger: '#ef4444',
  },
  borderRadius: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  mode: 'dark' as const,
};

export const lightTheme = {
  colors: {
    background: '#f4f4f5',
    backgroundLight: '#fff',
    text: '#18181b',
    textLight: '#18181b',
    accent: '#6366f1',
    border: '#e4e4e7',
    borderLight: '#e4e4e7',
    success: '#22c55e',
    warning: '#f59e42',
    danger: '#ef4444',
  },
  borderRadius: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  mode: 'light' as const,
};

export const colorTheme = {
  colors: {
    background: 'linear-gradient(135deg, #f4f4f5 0%, #e0e7ff 100%)',
    backgroundLight: '#fffbe9',
    text: '#18181b',
    textLight: '#18181b',
    accent: '#f59e42',
    border: '#f59e42',
    borderLight: '#fde68a',
    success: '#22c55e',
    warning: '#f59e42',
    danger: '#ef4444',
  },
  borderRadius: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
  mode: 'color' as const,
  backgroundImage: 'linear-gradient(135deg, #f4f4f5 0%, #e0e7ff 100%)',
};

export const themes = [
  { key: 'light', label: 'Светлая', theme: lightTheme },
  { key: 'dark', label: 'Тёмная', theme: darkTheme },
  { key: 'color', label: 'Цветная', theme: colorTheme },
];

export const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fontFamily};
    transition: background 0.2s, color 0.2s;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
`; 