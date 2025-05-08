import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      background: string;
      backgroundLight: string;
      text: string;
      textLight: string;
      accent: string;
      border: string;
      borderLight: string;
      success: string;
      warning: string;
      danger: string;
    };
    borderRadius: string;
    fontFamily: string;
    mode: 'light' | 'dark' | 'color';
  }
} 