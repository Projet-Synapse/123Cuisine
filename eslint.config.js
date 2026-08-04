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
    ignores: ['dist/*', 'dist_electron/*'],
  },
]);
