//////////////////////////////////////////////////////////////////////////
//                            UseKitchen.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Raccourci pour consommer KitchenContext.
 */

// Powered by OnSpace.AI
import { useContext } from 'react';
import { KitchenContext, KitchenContextType } from '@/contexts/KitchenContext';

export function useKitchen(): KitchenContextType {
  const context = useContext(KitchenContext);
  if (!context) throw new Error('useKitchen must be used within KitchenProvider');
  return context;
}
