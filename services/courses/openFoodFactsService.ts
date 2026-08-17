//////////////////////////////////////////////////////////////////////////
//                    🌍 OpenFoodFactsService.ts                        //
//////////////////////////////////////////////////////////////////////////

/*
 * Recherche de vrais produits (nom, marque, photo) via l'API publique et
 * gratuite Open Food Facts — utilisée pour enrichir l'ajout d'articles à
 * une liste de courses.
 *
 * ⚠️ Important : Open Food Facts est une base collaborative de FICHES
 * PRODUITS (nom, marque, photo, quantité...), pas un comparateur de prix.
 * Elle ne connaît ni les prix ni la disponibilité par magasin — contrairement
 * à des services comme Jow, qui reposent sur des partenariats commerciaux
 * directs avec les enseignes et leurs APIs privées, inaccessibles à un
 * projet indépendant comme celui-ci. On combine donc ici de vraies fiches
 * produit avec le moteur d'estimation de prix par catégorie déjà existant
 * (voir priceService.ts) — le prix affiché reste une estimation, jamais un
 * prix réel du magasin.
 *
 * Endpoint : on utilise search.openfoodfacts.org (le nouveau moteur de
 * recherche "search-a-licious" d'Open Food Facts), et non l'ancien
 * world.openfoodfacts.org/cgi/search.pl — ce dernier est déprécié et renvoie
 * désormais une page "Page temporarily unavailable" pour les requêtes
 * anonymes. L'API v2 classique (/api/v2/search), elle, ignore silencieusement
 * le texte libre. search-a-licious est la seule des trois à faire une vraie
 * recherche pertinente par nom de produit (vérifié manuellement).
 */

import { detectCategory, detectUnit } from './priceService';

export interface OFFProduct {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  quantity?: string;
  category: string;
  unit: string;
}

const SEARCH_TIMEOUT_MS = 6000;
const SEARCH_URL = 'https://search.openfoodfacts.org/search';

interface OFFRawHit {
  code?: string;
  product_name?: string;
  brands?: string[];
  image_front_small_url?: string;
  quantity?: string;
  categories_tags?: string[];
}

function mapProduct(raw: OFFRawHit): OFFProduct | null {
  const name = (raw.product_name || '').trim();
  if (!name || !raw.code) return null;
  return {
    id: raw.code,
    name,
    brand: raw.brands?.[0]?.trim() || undefined,
    imageUrl: raw.image_front_small_url || undefined,
    quantity: raw.quantity || undefined,
    // Les categories_tags OFF sont en anglais/multi-langue, peu fiables pour
    // un mapping direct vers nos 13 catégories françaises (voir
    // priceService) : on réutilise la détection par mots-clés déjà en place,
    // à partir du nom du produit.
    category: detectCategory(name),
    unit: detectUnit(name),
  };
}

// Recherche de produits par nom. Renvoie [] en cas d'erreur réseau/timeout —
// la recherche reste un enrichissement optionnel, jamais bloquant pour
// l'ajout manuel d'un article.
export async function searchOpenFoodFactsProducts(query: string, pageSize = 15): Promise<OFFProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q,
      page_size: String(pageSize),
      fields: 'code,product_name,brands,image_front_small_url,quantity,categories_tags',
    });

    const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        // Open Food Facts demande un user-agent identifiable par app (voir
        // leurs conditions d'utilisation de l'API) — ignoré silencieusement
        // par le fetch web (header restreint par le navigateur), pris en
        // compte sur natif/Electron.
        'User-Agent': '123Cuisine/1.2.2 (app de cuisine personnelle)',
      },
    });

    if (!response.ok) return [];
    const data = await response.json();
    const hits = (data?.hits as OFFRawHit[]) || [];

    const seen = new Set<string>();
    const mapped: OFFProduct[] = [];
    for (const raw of hits) {
      const p = mapProduct(raw);
      if (!p) continue;
      const dedupeKey = p.name.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      mapped.push(p);
    }
    return mapped;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
