//////////////////////////////////////////////////////////////////////////
//                             📤 Upload.ts                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Préparation d'une image avant envoi vers Supabase Storage.
 *
 * POURQUOI CE FICHIER EXISTE
 * Les trois envois de l'app (photo de recette, photo de dossier, photo de
 * profil) faisaient la même chose, et la même chose était fausse :
 *
 *   const ext = localUri.split('.').pop();   // ← sur une image choisie
 *   const response = await fetch(localUri);  //   depuis un ordinateur…
 *
 * Sur mobile, `expo-image-picker` renvoie un chemin `file:///…/photo.jpg` et
 * tout allait bien. Sur le web et dans l'app de bureau, il renvoie une adresse
 * `data:image/jpeg;base64,/9j/4AAQ…` :
 *   • `split('.').pop()` ne trouve aucun point et renvoie TOUTE la chaîne
 *     base64 — le nom du fichier envoyé faisait plusieurs mégaoctets ;
 *   • `fetch()` sur une adresse `data:` est refusé par la politique de
 *     sécurité (connect-src), donc l'appel échouait avant même d'essayer.
 * Les deux erreurs étaient avalées par un `catch { return null }`, et la photo
 * disparaissait sans un mot. Résultat vérifié dans la base : les trois
 * compartiments de stockage étaient vides, aucune photo n'était jamais partie
 * depuis la création du projet.
 *
 * Ici, une adresse `data:` est décodée sur place — pas de réseau, donc rien à
 * autoriser — et le type d'image vient de l'en-tête de l'adresse, pas d'une
 * extension devinée.
 *
 * SOMMAIRE
 * Chap 1. Types d'image
 * Chap 2. Décodage base64
 * Chap 3. Lecture d'une image, quelle que soit sa provenance
 */

/////////////////////////////// Chap 1. Types ///////////////////////////////

export interface ImagePayload {
  bytes: ArrayBuffer;
  mimeType: string;
  extension: string;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

/////////////////////////////// Chap 2. Décodage base64 ///////////////////////////////

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/*
 * Décodeur maison plutôt que `atob` : celui-ci n'existe pas partout côté
 * React Native selon le moteur, et `Buffer` non plus. Une quinzaine de lignes
 * valent mieux qu'une dépendance ou qu'un plantage sur un seul appareil.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/[\r\n\s]/g, '').replace(/=+$/, '');
  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  // Les adresses `data:` produites par un navigateur peuvent utiliser
  // l'alphabet « URL-safe » : on accepte les deux.
  lookup['-'.charCodeAt(0)] = 62;
  lookup['_'.charCodeAt(0)] = 63;

  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)];
    const c1 = lookup[clean.charCodeAt(i + 1)];
    const c2 = lookup[clean.charCodeAt(i + 2)];
    const c3 = lookup[clean.charCodeAt(i + 3)];

    if (byteIndex < byteLength) bytes[byteIndex++] = (c0 << 2) | (c1 >> 4);
    if (byteIndex < byteLength) bytes[byteIndex++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (byteIndex < byteLength) bytes[byteIndex++] = ((c2 & 3) << 6) | c3;
  }

  return bytes.buffer;
}

/////////////////////////////// Chap 3. Lecture ///////////////////////////////

/** Extension de fichier lisible dans un chemin, en ignorant la query string. */
function extensionFromPath(uri: string): string | null {
  const withoutQuery = uri.split('?')[0].split('#')[0];
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  if (!lastSegment.includes('.')) return null;
  const ext = lastSegment.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[ext] ? ext : null;
}

/**
 * Lit l'image désignée par `uri` et renvoie de quoi l'envoyer.
 * Lance une erreur explicite : c'est au code appelant de la montrer à
 * l'utilisateur plutôt que de laisser la photo disparaître en silence.
 */
export async function readImageForUpload(uri: string): Promise<ImagePayload> {
  if (uri.startsWith('data:')) {
    const match = /^data:([^;,]+)?((?:;[^,]*)*),(.*)$/s.exec(uri);
    if (!match) throw new Error("Image illisible (adresse de données mal formée).");

    const mimeType = (match[1] || 'image/jpeg').toLowerCase();
    const isBase64 = /;base64/i.test(match[2] ?? '');
    const payload = match[3] ?? '';

    const bytes = isBase64
      ? base64ToArrayBuffer(payload)
      : (new TextEncoder().encode(decodeURIComponent(payload)).buffer as ArrayBuffer);

    if (bytes.byteLength === 0) throw new Error('Image vide.');

    return { bytes, mimeType, extension: MIME_TO_EXTENSION[mimeType] ?? 'jpg' };
  }

  // file:// (mobile), blob: (web), http(s):// — tous lisibles par fetch.
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Image inaccessible (${response.status}).`);
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Image vide.');

  const mimeType = blob.type && blob.type !== '' ? blob.type.toLowerCase() : null;
  const extension =
    (mimeType ? MIME_TO_EXTENSION[mimeType] : null) ?? extensionFromPath(uri) ?? 'jpg';

  return {
    bytes: await blob.arrayBuffer(),
    mimeType: mimeType ?? EXTENSION_TO_MIME[extension] ?? 'image/jpeg',
    extension,
  };
}

/** Résultat commun aux trois envois de l'app. */
export interface UploadResult {
  url: string | null;
  error: string | null;
}
