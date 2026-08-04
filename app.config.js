// Powered by OnSpace.AI
// app.config.js plutôt qu'app.json : experiments.baseUrl doit rester vide en
// local/desktop (serveur à la racine) et n'être défini que pour le déploiement
// GitHub Pages (servi depuis un sous-dossier /123Cuisinez/), donc lu dynamiquement.
module.exports = {
  expo: {
    name: 'MaCuisine',
    slug: 'onspace-app',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/images/logo.png',
    scheme: 'onspaceapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
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
  },
};
