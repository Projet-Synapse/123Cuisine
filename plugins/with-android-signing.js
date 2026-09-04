//////////////////////////////////////////////////////////////////////////
//                    🔏 with-android-signing.js                        //
//////////////////////////////////////////////////////////////////////////
//
// SOMMAIRE
//   1. Pourquoi ce fichier existe
//   2. Constantes
//   3. Le plugin
//
// ── 1. Pourquoi ce fichier existe ────────────────────────────────────────
//
// Le projet est « managé » : le dossier `android/` n'est pas dans le dépôt,
// il est régénéré de zéro par `expo prebuild` à chaque construction. Éditer
// `android/app/build.gradle` à la main ne survivrait donc pas au build
// suivant — la seule façon durable de le modifier est un config plugin
// comme celui-ci, rejoué automatiquement à chaque prebuild.
//
// Ce qu'il corrige : dans le gabarit React Native/Expo, le type de build
// `release` est signé avec le keystore de DÉBOGAGE (le même pour toutes les
// applications Expo du monde). Un APK ainsi signé s'installe, mais n'est pas
// une vraie version publiable. On y injecte donc un `signingConfigs.release`
// qui lit notre keystore.
//
// Le keystore n'apparaît NULLE PART dans le dépôt : chemin et mots de passe
// arrivent par variables d'environnement, alimentées par les secrets GitHub
// (cf. le job `android-build` de .github/workflows/release.yml).
//
// Sans ces variables, le plugin ne touche à rien : les prebuild locaux et
// les constructions EAS (qui gèrent leur propre keystore) restent intacts.

// ── 2. Constantes ────────────────────────────────────────────────────────

const { withAppBuildGradle } = require('expo/config-plugins');

// Les quatre variables attendues. Le chemin est résolu par Gradle, donc il
// doit être ABSOLU : le processus Gradle ne tourne pas dans le même dossier
// que le script qui a déposé le fichier.
const REQUIRED = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];

// Bloc Groovy inséré dans `signingConfigs`. `System.getenv` plutôt que des
// valeurs en dur : rien de secret n'est écrit sur le disque du runner, et
// build.gradle reste identique quel que soit le keystore utilisé.
const RELEASE_SIGNING_CONFIG = `
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`;

// ── 3. Le plugin ─────────────────────────────────────────────────────────

/**
 * Fait signer le build `release` par notre keystore au lieu de celui de
 * débogage. No-op si les variables d'environnement ne sont pas toutes là.
 */
const withAndroidSigning = config => {
  const missing = REQUIRED.filter(name => !process.env[name]);
  if (missing.length > 0) {
    // Cas normal en local et sur EAS : on laisse le gabarit tel quel.
    return config;
  }

  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(`[with-android-signing] build.gradle attendu en Groovy, reçu « ${cfg.modResults.language} ».`);
    }

    let contents = cfg.modResults.contents;

    // Déjà appliqué (prebuild rejoué sans --clean) : ne rien faire deux fois.
    if (contents.includes('signingConfigs.release')) {
      return cfg;
    }

    // (a) Ajouter le bloc `release` dans `signingConfigs { ... }`.
    const signingConfigsAnchor = 'signingConfigs {';
    const signingConfigsAt = contents.indexOf(signingConfigsAnchor);
    if (signingConfigsAt === -1) {
      throw new Error('[with-android-signing] Bloc « signingConfigs { » introuvable dans android/app/build.gradle.');
    }
    const insertAt = signingConfigsAt + signingConfigsAnchor.length;
    contents = contents.slice(0, insertAt) + RELEASE_SIGNING_CONFIG + contents.slice(insertAt);

    // (b) Basculer le type de build `release` sur ce nouveau bloc.
    //
    // `signingConfig signingConfigs.debug` apparaît DEUX fois (buildTypes
    // debug puis release) : on ne remplace donc que la première occurrence
    // située après l'ouverture du bloc `release {`, jamais celle de `debug`.
    const buildTypesAt = contents.indexOf('buildTypes {');
    const releaseBlockAt = buildTypesAt === -1 ? -1 : contents.indexOf('release {', buildTypesAt);
    const debugSigningAt =
      releaseBlockAt === -1 ? -1 : contents.indexOf('signingConfig signingConfigs.debug', releaseBlockAt);
    if (debugSigningAt === -1) {
      throw new Error(
        '[with-android-signing] Impossible de trouver « signingConfig signingConfigs.debug » ' +
          'dans le bloc buildTypes.release — le gabarit Expo a changé, ce plugin doit être mis à jour. ' +
          "Sans correctif, l'APK partirait signé avec la clé de débogage.",
      );
    }
    contents =
      contents.slice(0, debugSigningAt) +
      'signingConfig signingConfigs.release' +
      contents.slice(debugSigningAt + 'signingConfig signingConfigs.debug'.length);

    cfg.modResults.contents = contents;
    return cfg;
  });
};

module.exports = withAndroidSigning;
