// Powered by OnSpace.AI
import { SUPERMARKETS } from '@/constants/config';

// ── Types ──────────────────────────────────────────────────────
export interface PriceEstimate {
  supermarketId: string;
  supermarketName: string;
  color: string;
  estimatedTotal: number;
  savingsVsExpensive: number;
  isCheapest: boolean;
  isCurrent: boolean;
}

export interface PriceItem {
  name?: string;
  category: string;
  quantity: string;
  unit: string;
  checked: boolean;
}

export interface Brand {
  name: string;
  tier: 'mdd' | 'standard' | 'premium';
  pricePerUnit: number;
  description: string;
}

export interface CatalogProduct {
  name: string;
  category: string;
  unit: string;
  typicalQty: string;
  avgPrice: number;
  storesPrices: Record<string, number>;
}

export interface StorePriceEntry {
  supermarketId: string;
  supermarketName: string;
  color: string;
  price: number;
  isCurrent: boolean;
  isCheapest: boolean;
}

export interface ItemPriceBreakdown {
  itemName: string;
  category: string;
  unit: string;
  quantity: string;
  brands: Brand[];
  storePrices: StorePriceEntry[];
}

// ── Smart Unit Detection ───────────────────────────────────────
const UNIT_MAP: Array<{ keywords: string[]; unit: string }> = [
  { keywords: ['eau', 'lait', 'jus', 'vin', 'bière', 'cidre', 'limonade', 'kombucha', 'lait de coco', "lait d'avoine", 'lait de soja', 'kéfir'], unit: 'L' },
  { keywords: ['huile', 'vinaigre'], unit: 'cl' },
  { keywords: ['crème fraîche', 'crème liquide', 'sirop', 'coulis'], unit: 'cl' },
  { keywords: ['poulet', 'boeuf', 'porc', 'veau', 'agneau', 'dinde', 'lapin', 'canard', 'filet', 'escalope', 'steak', 'viande', 'hachis', 'rôti', 'côtelette'], unit: 'kg' },
  { keywords: ['saumon', 'thon', 'cabillaud', 'bar', 'dorade', 'maquereau', 'sardine', 'truite', 'crevette', 'moule', 'palourde', 'poisson'], unit: 'kg' },
  { keywords: ['tomate', 'carotte', 'oignon', 'pomme de terre', 'patate', 'courgette', 'aubergine', 'poivron', 'brocoli', 'épinard', 'champignon', 'haricot vert', 'asperge', 'fenouil', 'poireau', 'chou', 'navet'], unit: 'kg' },
  { keywords: ['pomme', 'poire', 'orange', 'citron', 'mandarine', 'fraise', 'framboise', 'myrtille', 'cerise', 'pêche', 'abricot', 'banane', 'kiwi', 'mangue', 'ananas', 'raisin', 'melon', 'pastèque'], unit: 'kg' },
  { keywords: ['farine', 'sucre', 'riz', 'pâtes', 'semoule', 'quinoa', 'orge', 'avoine', 'lentille', 'pois chiche', 'haricot sec', 'polenta'], unit: 'kg' },
  { keywords: ['beurre', 'fromage', 'gruyère', 'emmental', 'comté', 'camembert', 'brie', 'chèvre', 'parmesan', 'mozzarella', 'ricotta', 'mascarpone', 'feta'], unit: 'g' },
  { keywords: ['sel', 'poivre', 'épice', 'cannelle', 'cumin', 'curry', 'paprika', 'curcuma', 'muscade', 'coriandre', 'basilic', 'thym', 'romarin', 'origan', 'herbe', 'cacao', 'café'], unit: 'g' },
  { keywords: ['oeuf', 'yaourt', 'laitue', 'salade', 'pain', 'baguette', 'brioche'], unit: 'unité(s)' },
];

export function detectUnit(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const { keywords, unit } of UNIT_MAP) {
    if (keywords.some(k => lower.includes(k))) return unit;
  }
  return 'unité(s)';
}

// ── Smart Category Detection ───────────────────────────────────
const CAT_MAP: Array<{ keywords: string[]; cat: string }> = [
  { keywords: ['poulet', 'boeuf', 'porc', 'veau', 'agneau', 'dinde', 'lapin', 'canard', 'steak', 'viande', 'hachis', 'rôti', 'escalope', 'jambon', 'saucisson', 'chorizo', 'bacon', 'lardons', 'merguez', 'chipolata'], cat: 'Viandes' },
  { keywords: ['saumon', 'thon', 'cabillaud', 'bar', 'dorade', 'maquereau', 'sardine', 'truite', 'crevette', 'moule', 'palourde', 'poisson', 'crabe', 'homard', 'anchois'], cat: 'Poissons' },
  { keywords: ['tomate', 'carotte', 'oignon', 'pomme de terre', 'patate', 'courgette', 'aubergine', 'poivron', 'brocoli', 'épinard', 'champignon', 'haricot vert', 'artichaut', 'asperge', 'fenouil', 'céleri', 'navet', 'poireau', 'ail', 'échalote', 'laitue', 'salade', 'endive', 'chou', 'mais', 'petits pois'], cat: 'Légumes' },
  { keywords: ['pomme', 'poire', 'orange', 'citron', 'mandarine', 'fraise', 'framboise', 'myrtille', 'cerise', 'pêche', 'abricot', 'banane', 'kiwi', 'mangue', 'ananas', 'raisin', 'melon', 'pastèque'], cat: 'Fruits' },
  { keywords: ['lait', 'fromage', 'beurre', 'crème', 'yaourt', 'gruyère', 'emmental', 'comté', 'camembert', 'brie', 'roquefort', 'chèvre', 'parmesan', 'mozzarella', 'ricotta', 'mascarpone', 'feta', 'oeuf'], cat: 'Produits laitiers' },
  { keywords: ['farine', 'riz', 'pâtes', 'semoule', 'quinoa', 'orge', 'avoine', 'pain', 'baguette', 'brioche', 'céréales'], cat: 'Céréales & Féculents' },
  { keywords: ['lentille', 'pois chiche', 'haricot sec', 'fève', 'soja'], cat: 'Légumineuses' },
  { keywords: ['sel', 'poivre', 'épice', 'cannelle', 'cumin', 'curry', 'paprika', 'curcuma', 'muscade', 'coriandre', 'basilic', 'thym', 'romarin', 'origan', 'herbe', 'safran', 'sucre', 'cacao', 'café', 'thé', 'levure', 'vanille', 'chocolat', 'amande', 'noisette', 'noix'], cat: 'Épices & Herbes' },
  { keywords: ['huile', 'vinaigre', 'moutarde', 'ketchup', 'mayonnaise', 'sauce', 'pesto', 'bouillon', 'concentré de tomate', 'coulis', 'sirop', 'miel', 'confiture', 'nutella'], cat: 'Huiles & Condiments' },
  { keywords: ['eau', 'jus', 'vin', 'bière', 'limonade', 'soda', 'lait de coco'], cat: 'Boissons' },
  { keywords: ['surgelé', 'congelé', 'glace', 'pizza'], cat: 'Surgelés' },
  { keywords: ['conserve', 'boîte de', 'en boîte'], cat: 'Conserves' },
];

export function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, cat } of CAT_MAP) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Autre';
}

// ── Pricing Engine ─────────────────────────────────────────────
const BASE_PRICE: Record<string, number> = {
  'Légumes': 2.80, 'Fruits': 3.20, 'Viandes': 11.50, 'Poissons': 14.80,
  'Produits laitiers': 2.20, 'Céréales & Féculents': 1.80, 'Légumineuses': 2.10,
  'Épices & Herbes': 1.80, 'Huiles & Condiments': 3.50, 'Boissons': 2.50,
  'Surgelés': 3.80, 'Conserves': 2.30, 'Autre': 2.50,
};

const MULTIPLIER: Record<string, number> = {
  lidl: 0.80, aldi: 0.82, leclerc: 0.88, intermarche: 0.92,
  superu: 0.96, carrefour: 1.00, casino: 1.10, monoprix: 1.32, autre: 1.00,
};

function itemPrice(category: string, quantity: string, unit: string, smId: string): number {
  const base = BASE_PRICE[category] ?? 2.50;
  const mult = MULTIPLIER[smId] ?? 1.0;
  const qty = parseFloat(quantity) || 1;
  const u = unit.toLowerCase();
  let scale: number;
  if (u === 'kg') scale = qty;
  else if (u === 'g') scale = qty / 500;
  else if (u === 'l') scale = qty;
  else if (u === 'cl') scale = qty / 100;
  else if (u === 'ml') scale = qty / 200;
  else scale = qty * 0.75;
  return Math.max(0.30, Math.round(base * scale * mult * 100) / 100);
}

export function getItemEstimatedPrice(category: string, quantity: string, unit: string, smId: string): number {
  return itemPrice(category, quantity, unit, smId);
}

// ── Brand Database ─────────────────────────────────────────────
export const BRAND_DATA: Record<string, Brand[]> = {
  'Légumes': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 1.80, description: 'Marque du magasin — rapport qualité/prix optimal' },
    { name: 'Bonduelle', tier: 'standard', pricePerUnit: 2.60, description: 'Surgelés et conserves de légumes, qualité constante' },
    { name: 'Florette', tier: 'premium', pricePerUnit: 3.80, description: 'Salades fraîches premium, prêtes à consommer' },
  ],
  'Fruits': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 2.00, description: 'Fruits de saison au meilleur prix' },
    { name: 'Dole', tier: 'standard', pricePerUnit: 3.20, description: 'Fruits tropicaux sélectionnés' },
    { name: 'Andros', tier: 'premium', pricePerUnit: 4.50, description: 'Compotes et jus artisanaux' },
  ],
  'Viandes': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 8.50, description: 'Viande française, bon rapport qualité/prix' },
    { name: 'Fleury Michon', tier: 'standard', pricePerUnit: 12.00, description: 'Charcuterie et viandes élaborées' },
    { name: 'Charal', tier: 'premium', pricePerUnit: 16.50, description: 'Bœuf sélectionné, viande maturée premium' },
  ],
  'Poissons': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 10.00, description: 'Poisson frais ou surgelé du magasin' },
    { name: 'Capitaine Igloo', tier: 'standard', pricePerUnit: 13.50, description: 'Produits de la mer surgelés variés' },
    { name: 'Labeyrie', tier: 'premium', pricePerUnit: 22.00, description: 'Saumon fumé et produits nobles de la mer' },
  ],
  'Produits laitiers': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 1.20, description: 'Laitages locaux, qualité garantie' },
    { name: 'Danone', tier: 'standard', pricePerUnit: 2.20, description: 'Yaourts, fromages frais et desserts laitiers' },
    { name: 'Président', tier: 'premium', pricePerUnit: 3.80, description: 'Beurre AOP, fromages de tradition française' },
  ],
  'Céréales & Féculents': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 0.90, description: 'Pâtes, riz et féculents du quotidien' },
    { name: 'Barilla', tier: 'standard', pricePerUnit: 1.60, description: 'Pâtes italiennes de référence' },
    { name: 'Tipiak', tier: 'premium', pricePerUnit: 3.20, description: 'Semoule fine, céréales et grains premium' },
  ],
  'Légumineuses': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 0.80, description: 'Légumineuses sèches ou en conserve' },
    { name: 'Cassegrain', tier: 'standard', pricePerUnit: 1.50, description: 'Légumes et légumineuses en conserve' },
    { name: 'Priméal', tier: 'premium', pricePerUnit: 3.00, description: 'Bio et agriculture durable certifiée' },
  ],
  'Épices & Herbes': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 0.90, description: 'Épices et herbes aux meilleurs prix' },
    { name: 'Ducros', tier: 'standard', pricePerUnit: 1.80, description: 'Épices et herbes aromatiques de référence' },
    { name: 'Verstegen', tier: 'premium', pricePerUnit: 4.00, description: "Mélanges d'épices artisanaux haut de gamme" },
  ],
  'Huiles & Condiments': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 2.50, description: 'Huiles et condiments essentiels du quotidien' },
    { name: 'Lesieur', tier: 'standard', pricePerUnit: 4.00, description: 'Huiles végétales de qualité, sauces variées' },
    { name: 'Maille', tier: 'premium', pricePerUnit: 6.00, description: 'Moutardes fines et vinaigres de qualité supérieure' },
  ],
  'Boissons': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 0.25, description: 'Eau et boissons au meilleur prix' },
    { name: 'Evian / Perrier', tier: 'standard', pricePerUnit: 0.60, description: 'Eaux minérales de source renommées' },
    { name: 'Tropicana', tier: 'premium', pricePerUnit: 2.50, description: 'Jus de fruits pressés, sans sucre ajouté' },
  ],
  'Surgelés': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 2.50, description: 'Surgelés pratiques du quotidien' },
    { name: 'Findus', tier: 'standard', pricePerUnit: 4.50, description: 'Légumes et plats cuisinés surgelés' },
    { name: 'Picard', tier: 'premium', pricePerUnit: 6.00, description: 'Spécialiste des surgelés haut de gamme' },
  ],
  'Conserves': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 0.90, description: 'Conserves du garde-manger abordables' },
    { name: 'William Saurin', tier: 'standard', pricePerUnit: 1.80, description: 'Plats cuisinés en boîte variés' },
    { name: 'La Belle Iloise', tier: 'premium', pricePerUnit: 4.50, description: 'Conserves artisanales de la mer' },
  ],
  'Autre': [
    { name: 'Marque distributeur', tier: 'mdd', pricePerUnit: 1.50, description: 'Marque du magasin économique' },
    { name: 'Marque standard', tier: 'standard', pricePerUnit: 2.50, description: 'Marque nationale de référence' },
    { name: 'Marque premium', tier: 'premium', pricePerUnit: 4.00, description: 'Gamme haut de gamme artisanale' },
  ],
};

export function getBrands(category: string): Brand[] {
  return BRAND_DATA[category] ?? BRAND_DATA['Autre'];
}

// ── Product Catalog ─────────────────────────────────────────────
const CATALOG_RAW: Omit<CatalogProduct, 'storesPrices'>[] = [
  { name: 'Lait demi-écrémé', category: 'Boissons', unit: 'L', typicalQty: '1', avgPrice: 0.95 },
  { name: 'Beurre doux 250g', category: 'Produits laitiers', unit: 'g', typicalQty: '250', avgPrice: 2.10 },
  { name: 'Oeufs (x6)', category: 'Produits laitiers', unit: 'unité(s)', typicalQty: '6', avgPrice: 2.50 },
  { name: 'Yaourt nature (x4)', category: 'Produits laitiers', unit: 'unité(s)', typicalQty: '4', avgPrice: 1.80 },
  { name: 'Emmental râpé 200g', category: 'Produits laitiers', unit: 'g', typicalQty: '200', avgPrice: 2.20 },
  { name: 'Crème fraîche épaisse', category: 'Produits laitiers', unit: 'cl', typicalQty: '20', avgPrice: 1.50 },
  { name: 'Mozzarella 125g', category: 'Produits laitiers', unit: 'g', typicalQty: '125', avgPrice: 1.80 },
  { name: 'Crème liquide entière', category: 'Produits laitiers', unit: 'cl', typicalQty: '20', avgPrice: 1.20 },
  { name: 'Pâtes spaghetti', category: 'Céréales & Féculents', unit: 'kg', typicalQty: '0.5', avgPrice: 1.20 },
  { name: 'Riz blanc', category: 'Céréales & Féculents', unit: 'kg', typicalQty: '1', avgPrice: 1.80 },
  { name: 'Farine T55', category: 'Céréales & Féculents', unit: 'kg', typicalQty: '1', avgPrice: 1.10 },
  { name: 'Pain de mie', category: 'Céréales & Féculents', unit: 'unité(s)', typicalQty: '1', avgPrice: 2.00 },
  { name: 'Flocons d\'avoine', category: 'Céréales & Féculents', unit: 'kg', typicalQty: '0.5', avgPrice: 1.50 },
  { name: 'Filet de poulet', category: 'Viandes', unit: 'kg', typicalQty: '0.5', avgPrice: 7.00 },
  { name: 'Boeuf haché 5%', category: 'Viandes', unit: 'kg', typicalQty: '0.5', avgPrice: 6.50 },
  { name: 'Lardons fumés', category: 'Viandes', unit: 'g', typicalQty: '200', avgPrice: 2.00 },
  { name: 'Jambon blanc (x4)', category: 'Viandes', unit: 'unité(s)', typicalQty: '4', avgPrice: 2.80 },
  { name: 'Escalope de veau', category: 'Viandes', unit: 'kg', typicalQty: '0.4', avgPrice: 9.00 },
  { name: 'Filet de saumon', category: 'Poissons', unit: 'kg', typicalQty: '0.3', avgPrice: 6.00 },
  { name: 'Thon en boîte 160g', category: 'Conserves', unit: 'g', typicalQty: '160', avgPrice: 2.00 },
  { name: 'Crevettes roses', category: 'Poissons', unit: 'kg', typicalQty: '0.3', avgPrice: 4.50 },
  { name: 'Tomates rondes', category: 'Légumes', unit: 'kg', typicalQty: '1', avgPrice: 2.50 },
  { name: 'Carottes', category: 'Légumes', unit: 'kg', typicalQty: '1', avgPrice: 1.20 },
  { name: 'Oignons jaunes', category: 'Légumes', unit: 'kg', typicalQty: '1', avgPrice: 1.10 },
  { name: 'Pommes de terre', category: 'Légumes', unit: 'kg', typicalQty: '2', avgPrice: 2.00 },
  { name: 'Courgettes', category: 'Légumes', unit: 'kg', typicalQty: '1', avgPrice: 2.20 },
  { name: 'Champignons de Paris', category: 'Légumes', unit: 'kg', typicalQty: '0.5', avgPrice: 2.00 },
  { name: 'Ail (tête)', category: 'Légumes', unit: 'unité(s)', typicalQty: '1', avgPrice: 1.20 },
  { name: 'Poivrons', category: 'Légumes', unit: 'kg', typicalQty: '0.5', avgPrice: 2.80 },
  { name: 'Épinards frais', category: 'Légumes', unit: 'kg', typicalQty: '0.3', avgPrice: 2.50 },
  { name: 'Tomates pelées (boîte)', category: 'Conserves', unit: 'g', typicalQty: '400', avgPrice: 0.80 },
  { name: 'Pommes Golden', category: 'Fruits', unit: 'kg', typicalQty: '1', avgPrice: 2.50 },
  { name: 'Oranges', category: 'Fruits', unit: 'kg', typicalQty: '1', avgPrice: 2.00 },
  { name: 'Bananes', category: 'Fruits', unit: 'kg', typicalQty: '1', avgPrice: 1.50 },
  { name: 'Citrons', category: 'Fruits', unit: 'kg', typicalQty: '0.5', avgPrice: 1.80 },
  { name: 'Fraises', category: 'Fruits', unit: 'kg', typicalQty: '0.5', avgPrice: 4.50 },
  { name: "Huile d'olive vierge extra", category: 'Huiles & Condiments', unit: 'cl', typicalQty: '50', avgPrice: 4.50 },
  { name: 'Huile de tournesol', category: 'Huiles & Condiments', unit: 'L', typicalQty: '1', avgPrice: 2.50 },
  { name: 'Moutarde de Dijon', category: 'Huiles & Condiments', unit: 'g', typicalQty: '200', avgPrice: 2.00 },
  { name: 'Concentré de tomates', category: 'Huiles & Condiments', unit: 'g', typicalQty: '70', avgPrice: 0.80 },
  { name: 'Bouillon de volaille (x4)', category: 'Huiles & Condiments', unit: 'unité(s)', typicalQty: '4', avgPrice: 1.20 },
  { name: 'Sel fin', category: 'Épices & Herbes', unit: 'kg', typicalQty: '1', avgPrice: 0.80 },
  { name: 'Poivre noir moulu', category: 'Épices & Herbes', unit: 'g', typicalQty: '50', avgPrice: 1.80 },
  { name: 'Herbes de Provence', category: 'Épices & Herbes', unit: 'g', typicalQty: '25', avgPrice: 1.50 },
  { name: 'Cumin en poudre', category: 'Épices & Herbes', unit: 'g', typicalQty: '25', avgPrice: 1.60 },
  { name: 'Sucre en poudre', category: 'Épices & Herbes', unit: 'kg', typicalQty: '1', avgPrice: 1.20 },
  { name: 'Cacao en poudre', category: 'Épices & Herbes', unit: 'g', typicalQty: '250', avgPrice: 3.50 },
  { name: 'Eau minérale (1,5L)', category: 'Boissons', unit: 'L', typicalQty: '1.5', avgPrice: 0.40 },
  { name: "Jus d'orange", category: 'Boissons', unit: 'L', typicalQty: '1', avgPrice: 1.80 },
  { name: 'Lentilles vertes', category: 'Légumineuses', unit: 'kg', typicalQty: '0.5', avgPrice: 1.40 },
  { name: 'Pois chiches', category: 'Légumineuses', unit: 'kg', typicalQty: '0.5', avgPrice: 1.80 },
];

export const PRODUCT_CATALOG: CatalogProduct[] = CATALOG_RAW.map(product => {
  const storesPrices: Record<string, number> = {};
  SUPERMARKETS.filter(sm => sm.id !== 'autre').forEach(sm => {
    const mult = MULTIPLIER[sm.id] ?? 1.0;
    storesPrices[sm.id] = Math.round(product.avgPrice * mult * 100) / 100;
  });
  return { ...product, storesPrices };
});

// ── Per-item Breakdown ─────────────────────────────────────────
export function getItemPriceBreakdown(
  itemName: string,
  category: string,
  quantity: string,
  unit: string,
  currentSmId: string
): ItemPriceBreakdown {
  const brands = getBrands(category);
  const markets = SUPERMARKETS.filter(sm => sm.id !== 'autre');
  const storePrices: StorePriceEntry[] = markets.map(sm => ({
    supermarketId: sm.id,
    supermarketName: sm.name,
    color: sm.color,
    price: itemPrice(category, quantity, unit, sm.id),
    isCurrent: sm.id === currentSmId,
    isCheapest: false,
  }));
  storePrices.sort((a, b) => a.price - b.price);
  if (storePrices.length > 0) storePrices[0].isCheapest = true;
  return { itemName, category, unit, quantity, brands, storePrices };
}

// ── Total Comparison ───────────────────────────────────────────
export function getPriceComparisons(items: PriceItem[], currentSupermarketId: string): PriceEstimate[] {
  const pending = items.filter(i => !i.checked);
  if (pending.length === 0) return [];
  const markets = SUPERMARKETS.filter(sm => sm.id !== 'autre');
  const estimates = markets.map(sm => ({
    supermarketId: sm.id,
    supermarketName: sm.name,
    color: sm.color,
    estimatedTotal: Math.round(pending.reduce((sum, item) => sum + itemPrice(item.category, item.quantity, item.unit, sm.id), 0) * 100) / 100,
    savingsVsExpensive: 0,
    isCheapest: false,
    isCurrent: sm.id === currentSupermarketId,
  }));
  estimates.sort((a, b) => a.estimatedTotal - b.estimatedTotal);
  const maxPrice = estimates[estimates.length - 1]?.estimatedTotal ?? 0;
  return estimates.map((e, idx) => ({
    ...e,
    savingsVsExpensive: Math.round((maxPrice - e.estimatedTotal) * 100) / 100,
    isCheapest: idx === 0,
  }));
}
