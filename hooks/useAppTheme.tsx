// Powered by OnSpace.AI
import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
