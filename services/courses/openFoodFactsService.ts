/**
 * openFoodFactsService.ts
 * Recherche de produits via l'API Open Food Facts (https://world.openfoodfacts.org/).
 * Utilisé pour l'autocomplétion lors de l'ajout d'articles à une liste de courses.
 */

export interface OFFProduct {
  id: string;
  name: string;
  brand: string;
  quantity: string;
  unit: string;
  category: string;
  imageUrl: string | null;
}

/** Map des catégories pnns_groups_2 Open Food Facts → catégories internes de l'app. */
const CATEGORY_MAP: Record<string, string> = {
  'fruits': 'Fruits',
  'vegetables': 'Légumes',
  'legumes': 'Légumes',
  'cereals-and-potatoes': 'Féculents',
  'bread': 'Féculents',
  'pasta': 'Féculents',
  'rice': 'Féculents',
  'meat': 'Viandes',
  'poultry': 'Viandes',
  'processed-meat': 'Charcuterie',
  'fish-and-seafood': 'Poissons',
  'fish': 'Poissons',
  'milk-and-dairy-products': 'Produits laitiers',
  'dairy': 'Produits laitiers',
  'cheese': 'Produits laitiers',
  'eggs': 'Produits laitiers',
  'fats-and-sauces': 'Condiments',
  'sauces': 'Condiments',
  'sugary-snacks': 'Sucreries',
  'sweets': 'Sucreries',
  'chocolate-products': 'Sucreries',
  'beverages': 'Boissons',
  'fruit-juices': 'Boissons',
  'sodas': 'Boissons',
  'waters-and-flavored-waters': 'Boissons',
  'frozen-products': 'Surgelés',
  'ice-cream': 'Surgelés',
  'plant-based-foods': 'Légumes',
  'nuts': 'Épicerie',
  'cereals': 'Féculents',
  'soups': 'Épicerie',
  'pizza-pies-and-quiches': 'Surgelés',
};

function mapCategory(rawCategory: string | undefined): string {
  if (!rawCategory) return 'Épicerie';
  const lower = rawCategory.toLowerCase().replace(/\s+/g, '-');
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Épicerie';
}

function extractUnit(quantityStr: string | undefined): string {
  if (!quantityStr) return 'unité(s)';
  const match = quantityStr.match(/\d+\s*(kg|g|l|ml|cl|pièces?|unités?|x)/i);
  if (!match) return 'unité(s)';
  const u = match[1].toLowerCase();
  if (u === 'kg') return 'kg';
  if (u === 'g') return 'g';
  if (u === 'l') return 'L';
  if (u === 'ml') return 'ml';
  if (u === 'cl') return 'cl';
  return 'unité(s)';
}

/**
 * Recherche des produits Open Food Facts correspondant à la chaîne `query`.
 * Retourne au maximum 10 résultats.
 */
export async function searchOpenFoodFactsProducts(query: string): Promise<OFFProduct[]> {
  if (!query.trim()) return [];

  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query.trim())}` +
      `&search_simple=1&action=process&json=1&page_size=10&lc=fr&cc=fr` +
      `&fields=code,product_name,brands,quantity,pnns_groups_2,image_small_url`;

    const response = await fetch(url, { headers: { 'User-Agent': '123Cuisine - React Native App' } });
    if (!response.ok) return [];

    const data = await response.json() as {
      products?: Array<{
        code?: string;
        product_name?: string;
        brands?: string;
        quantity?: string;
        pnns_groups_2?: string;
        image_small_url?: string;
      }>;
    };

    if (!data.products) return [];

    return data.products
      .filter(p => p.product_name && p.product_name.trim().length > 0)
      .slice(0, 10)
      .map(p => ({
        id: p.code ?? Math.random().toString(36).slice(2),
        name: (p.product_name ?? '').trim(),
        brand: (p.brands ?? '').split(',')[0].trim(),
        quantity: p.quantity ?? '',
        unit: extractUnit(p.quantity),
        category: mapCategory(p.pnns_groups_2),
        imageUrl: p.image_small_url ?? null,
      }));
  } catch {
    return [];
  }
}
