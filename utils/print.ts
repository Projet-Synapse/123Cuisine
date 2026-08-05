//////////////////////////////////////////////////////////////////////////
//                             🖨️ Print.ts                              //
//////////////////////////////////////////////////////////////////////////
// Règles injectées dans toute page imprimée, quel que soit le HTML fourni :
// - print-color-adjust force les navigateurs à imprimer les couleurs de fond
//   (sans ça, les cases cochées de la liste de courses ou les bandeaux
//   colorés ressortent vides à l'impression — la plupart des navigateurs
//   omettent les fonds par défaut à l'impression).
// - les règles sur img évitent qu'une photo de recette déborde de la page
//   ou soit coupée en deux par un saut de page.
/*
 * Impression HTML multiplateforme : ouvre une fenêtre dédiée sur web/desktop (attend le chargement des images, force les couleurs), délègue à expo-print sur mobile natif.
 */

import { Platform } from 'react-native';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRINT_SAFETY_CSS = `
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    img { max-width: 100%; height: auto; display: block; page-break-inside: avoid; break-inside: avoid; }
    @page { margin: 16mm; }
  </style>
`;

function withPrintSafetyCss(html: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${PRINT_SAFETY_CSS}</head>`);
  }
  return PRINT_SAFETY_CSS + html;
}

// Attend que toutes les images de la page à imprimer soient chargées (ou en
// erreur) avant de lancer l'impression. Sans ça, window.print() est appelé
// pendant que les <img> sont encore en train de charger et le rendu imprimé
// (ou le PDF généré) affiche des images cassées / des espaces vides —
// c'était le principal responsable d'un rendu "cassé" à l'impression dès
// qu'une recette avec photo était imprimée.
function waitForImages(doc: Document, timeoutMs = 4000): Promise<void> {
  const images = Array.from(doc.images || []);
  const pending = images.filter(img => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise(resolve => {
    let remaining = pending.length;
    const done = () => { remaining -= 1; if (remaining <= 0) resolve(); };
    pending.forEach(img => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    setTimeout(resolve, timeoutMs);
  });
}

// Sur web, Print.printAsync({ html }) de expo-print ignore le HTML fourni et
// appelle juste window.print() sur la page actuelle — on ouvre donc une fenêtre
// dédiée avec le HTML généré et on l'imprime, elle.
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error("Impossible d'ouvrir la fenêtre d'impression : autorisez les pop-ups pour ce site puis réessayez.");
    }

    win.document.write(withPrintSafetyCss(html));
    win.document.close();
    win.focus();

    await waitForImages(win.document);

    // Referme la fenêtre une fois le dialogue d'impression fermé (accepté ou
    // annulé) plutôt que de la laisser traîner ouverte indéfiniment.
    win.onafterprint = () => win.close();
    win.print();
    return;
  }

  const Print = await import('expo-print');
  await Print.printAsync({ html });
}
