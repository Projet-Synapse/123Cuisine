//////////////////////////////////////////////////////////////////////////
//                          UseWeeklyMenu.tsx                           //
//////////////////////////////////////////////////////////////////////////

/*
 * Raccourci pour consommer WeeklyMenuContext.
 */

import { useContext } from 'react';
import { WeeklyMenuContext, WeeklyMenuContextType } from '@/contexts/WeeklyMenuContext';

export function useWeeklyMenu(): WeeklyMenuContextType {
  const context = useContext(WeeklyMenuContext);
  if (!context) throw new Error('useWeeklyMenu must be used within WeeklyMenuProvider');
  return context;
}
