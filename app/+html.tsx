//////////////////////////////////////////////////////////////////////////
//                              🌐 Html.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Document HTML racine utilisé uniquement pour l'export web statique (métadonnées, manifeste PWA, en-têtes de sécurité CSP).
 */

// Powered by OnSpace.AI
import { ScrollViewStyleReset } from 'expo-router/html';

const baseUrl = process.env.EXPO_BASE_URL ?? '';

// Document Français racine utilisé uniquement pour l'export web statique
// (voir https://docs.expo.dev/router/reference/static-rendering/#root-html).
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content="Vos recettes, vos courses, votre cuisine." />
        <meta name="theme-color" content="#C0392B" />

        {/*
          GitHub Pages ne permet pas de définir des en-têtes HTTP personnalisés
          (pas de fichier _headers comme sur Netlify/Cloudflare Pages) : cette
          balise meta est donc la seule façon de poser une CSP sur la version
          web. *.supabase.co reste volontairement large car le projet Supabase
          peut être amené à changer ; accounts.google.com/googleapis.com sont
          nécessaires à la connexion Google (redirection complète de page).
        */}
        <meta httpEquiv="Content-Security-Policy" content={[
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://*.supabase.co",
          "font-src 'self' data:",
          "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://*.googleapis.com",
          "frame-src 'self' https://accounts.google.com",
          "form-action 'self' https://*.supabase.co https://accounts.google.com",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ')} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        <link rel="manifest" href={`${baseUrl}/manifest.json`} />
        <link rel="apple-touch-icon" href={`${baseUrl}/apple-touch-icon.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="123Cuisine" />

        <title>123Cuisine</title>

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
