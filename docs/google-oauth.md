# Connexion Google (123Cuisine)

L’utilisateur se connecte avec **son** compte Google. Supabase Auth reste le pont de session (profils, RLS, recettes) — il n’apparaît pas dans l’UI.

## 1. Google Cloud Console

1. Ouvrir [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Créer (ou ouvrir) un **OAuth 2.0 Client ID** de type **Web application**.
3. **Authorized redirect URIs** — ajouter **exactement** :
   ```
   https://lcfbzfsfubegppsyzkeb.supabase.co/auth/v1/callback
   ```
   (c’est le callback Supabase du projet 🍳 123Cuisine, pas l’URL GitHub Pages.)
4. Copier **Client ID** et **Client Secret**.

## 2. Supabase Dashboard

1. Projet **🍳 123Cuisine** → **Authentication** → **Providers** → **Google** :
   - Enable Google
   - Coller Client ID + Client Secret
2. **Authentication** → **URL Configuration** :
   - **Site URL** (prod) :
     ```
     https://projet-synapse.github.io/123Cuisine/
     ```
   - **Redirect URLs** (ajouter toutes celles utiles) :
     ```
     https://projet-synapse.github.io/123Cuisine/**
     https://projet-synapse.github.io/123Cuisine/login
     http://localhost:*
     http://127.0.0.1:*
     cuisine123://**
     ```

Sans ces Redirect URLs, Google accepte la connexion puis Supabase refuse le retour (`redirect_uri` / URL not allowed).

## 3. Comportement app

- Sur le web, le code renvoie toujours vers `/login` (sous `/123Cuisine` sur GitHub Pages).
- Sur mobile : scheme `cuisine123://auth`.
- `prompt=select_account` : choix du compte Google sans re-consentement forcé.

## 4. Vérification rapide

1. Ouvrir https://projet-synapse.github.io/123Cuisine/login
2. « Continuer avec Google » → choisir un compte Google quelconque
3. Retour sur `/login` puis entrée dans l’app (onglets)

Si échec : lire le bandeau rouge sur l’écran de connexion — il indique souvent une Redirect URL manquante.
