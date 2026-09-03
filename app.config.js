// app.config.js plutôt qu'app.json : experiments.baseUrl doit rester vide en
// local/desktop (serveur à la racine) et n'être défini que pour le déploiement
// GitHub Pages (servi depuis un sous-dossier /123Cuisine/), donc lu dynamiquement.

// Source unique de la version, réutilisée telle quelle pour le nom affiché et
// convertie en `versionCode` pour Android (cf. plus bas). À garder alignée
// avec le champ "version" de package.json, que lisent electron-builder et le
// site web.
const VERSION = '1.2.7';

// Android n'affiche pas ce nombre, mais s'en sert pour savoir si un APK est
// plus récent qu'un autre : il DOIT augmenter à chaque publication, sinon
// l'installation de la mise à jour est refusée (« application plus ancienne »).
// On le dérive de la version pour n'avoir jamais à y penser :
//   1.2.7 -> 10207, 1.3.0 -> 10300, 2.0.0 -> 20000.
// Valable tant que les numéros mineur et correctif restent sous 100.
const [MAJOR, MINOR, PATCH] = VERSION.split('.').map(Number);
const VERSION_CODE = MAJOR * 10000 + MINOR * 100 + PATCH;

module.exports = {
  expo: {
    name: '123Cuisine',
    slug: '123cuisine',
    version: VERSION,
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
      versionCode: VERSION_CODE,
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
      // Fait signer l'APK de production avec notre keystore au lieu de la clé
      // de débogage du gabarit. Ne s'active que si les variables
      // ANDROID_KEYSTORE_* sont présentes (CI) — sans effet en local.
      './plugins/with-android-signing',
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
