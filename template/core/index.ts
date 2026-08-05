//////////////////////////////////////////////////////////////////////////
//                               Index.ts                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Ré-exports du module core (config + client Supabase).
 */

// @ts-nocheck
// Simplified Core module exports
export * from './types';
export { configManager, createConfig } from './config';
export { 
  getSharedSupabaseClient, 
  getSharedSupabaseClient as getSupabaseClient,
  safeSupabaseOperation 
} from './client';