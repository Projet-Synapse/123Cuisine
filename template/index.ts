//////////////////////////////////////////////////////////////////////////
//                               Index.ts                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Point d'entrée unique du template : ré-exporte core, auth et ui pour être importé via '@/template' partout dans l'app.
 */

// @ts-nocheck
export * from './core';
export * from './auth';

// UI exports
export { useAlert, AlertProvider } from './ui';
export type { AlertButton, AlertState } from './ui';
