//////////////////////////////////////////////////////////////////////////
//                               Index.ts                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Ré-exports du module core (config + client Supabase).
 */

// Simplified Core module exports
export * from './types';
export { configManager, createConfig } from './config';
export { 
  getSharedSupabaseClient, 
  getSharedSupabaseClient as getSupabaseClient,
  safeSupabaseOperation 
} from './client';