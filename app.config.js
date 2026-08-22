// app.config.js plutôt qu'app.json : experiments.baseUrl doit rester vide en
// local/desktop (serveur à la racine) et n'être défini que pour le déploiement
// GitHub Pages (servi depuis un sous-dossier /123Cuisine/), donc lu dynamiquement.
module.exports = {
  expo: {
    name: '123Cuisine',
    slug: '123cuisine',
    version: '1.2.6',
    orientation: 'portrait',
    icon: './assets/images/logo.png',
    scheme: 'cuisine123',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.cuisine123.app',
    },
    android: {
      // Identifiant unique du paquet Android : indispensable pour construire
      // un APK. Aligné sur l'appId Electron (cf. electron-builder.yml) pour
      // que les trois plateformes portent le même nom technique.
      package: 'com.cuisine123.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/logo.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
      baseUrl: process.env.GH_PAGES_BASE_URL || undefined,
    },
    // Identifiant du projet EAS, nécessaire pour `eas build`. `eas init` ne
    // peut pas l'écrire tout seul dans un app.config.js dynamique : il
    // l'affiche, à reporter dans EAS_PROJECT_ID (fichier .env en local,
    // secret du dépôt en CI).
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || undefined,
      },
    },
  },
};
