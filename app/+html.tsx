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

        <link rel="manifest" href={`${baseUrl}/manifest.json`} />
        <link rel="apple-touch-icon" href={`${baseUrl}/apple-touch-icon.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MaCuisine" />

        <title>MaCuisine</title>

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
