//////////////////////////////////////////////////////////////////////////
//                            Servings.ts                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Mise à l'échelle des quantités d'ingrédients selon le nombre de portions
 * choisi sur la fiche recette. Les quantités sont des chaînes libres
 * ("2", "1.5", "1/2", "une pincée"...) : on ne scale que celles qui
 * commencent par un nombre reconnaissable, le reste est laissé tel quel.
 */

// Repère un nombre en tête de chaîne : entier, décimal (point ou virgule)
// ou fraction simple ("1/2", "3/4").
const LEADING_NUMBER = /^\s*(\d+)\s*\/\s*(\d+)|^\s*(\d+(?:[.,]\d+)?)/;

export function parseLeadingQuantity(raw: string): { value: number; rest: string } | null {
  const match = raw.match(LEADING_NUMBER);
  if (!match) return null;
  const value =
    match[1] && match[2] ? parseInt(match[1], 10) / parseInt(match[2], 10) : parseFloat(match[3].replace(',', '.'));
  if (!isFinite(value)) return null;
  return { value, rest: raw.slice(match[0].length).trim() };
}

// Formate un nombre pour l'affichage : jusqu'à 2 décimales, sans zéros inutiles.
export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

// Met une quantité à l'échelle d'un facteur donné. Renvoie la chaîne
// d'origine, inchangée, si elle ne commence pas par un nombre reconnu.
export function scaleQuantity(raw: string, factor: number): string {
  if (!raw || factor === 1) return raw;
  const parsed = parseLeadingQuantity(raw);
  if (!parsed) return raw;
  const scaled = formatQuantity(parsed.value * factor);
  return parsed.rest ? `${scaled} ${parsed.rest}` : scaled;
}
