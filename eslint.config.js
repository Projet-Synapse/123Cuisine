// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Désactive les règles ESLint qui portent sur le style (indentation,
// virgules, longueur de ligne...) puisque c'est désormais Prettier qui s'en
// charge — évite que les deux outils se contredisent.
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // electron/*.js tourne en CommonJS Node (process principal Electron),
    // pas dans l'environnement RN/browser du reste du projet — sans ça,
    // ESLint ne reconnaît pas __dirname/require/module et remonte de faux
    // positifs "is not defined".
    files: ['electron/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },

  {
    // Le plugin @typescript-eslint n'est enregistré par eslint-config-expo
    // que pour les fichiers .ts/.tsx (voir flat/utils/typescript.js) : sans
    // cette restriction, ESLint plante sur tout fichier .js (electron/*.js,
    // ce fichier lui-même...) qui n'a pas ce plugin disponible.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      // Ces trois règles font du "typed linting" (elles ont besoin des types
      // TypeScript résolus, pas juste de l'AST) : sans projectService pointé
      // sur le tsconfig du projet, ESLint plante avec "parserOptions not set
      // to generate type information" sur le premier fichier .ts venu.
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // 🎯 Les vrais chasseurs de bugs
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    // Fonction Supabase Edge (runtime Deno) : les imports par URL
    // (https://deno.land/...) sont valides sous Deno mais qu'ESLint/TS ne
    // peuvent pas résoudre depuis un projet Node — hors périmètre du lint.
    ignores: [
      'dist/**',
      'dist_electron/**',
      '.expo/**',
      'supabase/functions/**'
    ],
  },
]);
