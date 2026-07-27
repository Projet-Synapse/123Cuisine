// Powered by OnSpace.AI
// Price estimation service — French average market prices (not real-time)
import { SUPERMARKETS } from '@/constants/config';

export interface PriceEstimate {
  supermarketId: string;
  supermarketName: string;
  color: string;
  estimatedTotal: number;
  savingsVsExpensive: number;
  isCheapest: boolean;
  isCurrent: boolean;
}

// Average item price (€) by ingredient category
const BASE_PRICE: Record<string, number> = {
  'Légumes': 2.80,
  'Fruits': 3.20,
  'Viandes': 11.50,
  'Poissons': 14.80,
  'Produits laitiers': 2.20,
  'Céréales & Féculents': 1.80,
  'Légumineuses': 2.10,
  'Épices & Herbes': 1.80,
  'Huiles & Condiments': 3.50,
  'Boissons': 2.50,
  'Surgelés': 3.80,
  'Conserves': 2.30,
  'Autre': 2.50,
};

// Supermarket price multipliers vs market average
const MULTIPLIER: Record<string, number> = {
  lidl: 0.80,
  aldi: 0.82,
  leclerc: 0.88,
  intermarche: 0.92,
  superu: 0.96,
  carrefour: 1.00,
  casino: 1.10,
  monoprix: 1.32,
  autre: 1.00,
};

function itemPrice(category: string, quantity: string, unit: string, smId: string): number {
  const base = BASE_PRICE[category] ?? 2.50;
  const mult = MULTIPLIER[smId] ?? 1.0;
  const qty = parseFloat(quantity) || 1;
  const u = unit.toLowerCase();

  let scale = qty;
  if (u === 'kg') scale = qty;
  else if (u === 'g') scale = qty / 500;
  else if (u === 'l') scale = qty;
  else if (u === 'cl') scale = qty / 100;
  else if (u === 'ml') scale = qty / 200;
  else scale = qty * 0.75;

  return Math.max(0.40, Math.round(base * scale * mult * 100) / 100);
}

export interface PriceItem {
  category: string;
  quantity: string;
  unit: string;
  checked: boolean;
}

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
