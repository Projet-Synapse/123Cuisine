//////////////////////////////////////////////////////////////////////////
//                         🗄️ KitchenService.ts                         //
//////////////////////////////////////////////////////////////////////////

/*
 * Couche de données brute (recettes, listes, categories, préférences) : lecture/écriture locale (AsyncStorage, mode invité) ou Supabase (connecté), upload d'images, et migration des données invité vers un compte.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { readImageForUpload, type UploadResult } from '@/utils/upload';

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string;
  unit?: string;
  category: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  duration: number;
  servings: number;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
  image?: string;
  createdAt: string;
  isFavorite: boolean;
  isPublic?: boolean;
}

export interface PublicRecipe extends Recipe {
  authorName?: string;
  authorId?: string;
}

export interface ListItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  checked: boolean;
  // Renseignés quand l'article a été ajouté depuis une fiche produit réelle
  // (recherche Open Food Facts) plutôt que saisi à la main.
  brand?: string;
  imageUrl?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  supermarketId: string;
  items: ListItem[];
  createdAt: string;
  color: string;
}

export interface Categorie {
  id: string;
  name: string;
  description: string;
  recipeIds: string[];
  coverColor: string;
  createdAt: string;
  // Appartenance à des dossiers (étiquettes, pas dossiers exclusifs) : une
  // catégorie peut être dans 0, 1 ou plusieurs dossiers. Voir Dossier.
  dossierIds: string[];
}

// Dossier de categories, imbricable (parentId) : sert à organiser l'écran
// Catégories en arborescence (fil d'Ariane + navigation par dossiers).
export interface Dossier {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  createdAt: string;
  imageUrl?: string;
}

export interface Preferences {
  likedIngredients: string[];
  dislikedIngredients: string[];
  dietaryTags: string[];
  allergies: string[];
  defaultServings: number;
}

const KEYS = {
  recipes: '@kitchen_recipes',
  lists: '@kitchen_lists',
  preferences: '@kitchen_preferences',
  // Les VALEURS de ces deux clés gardent leur ancien nom : ce sont les clés
  // réelles du stockage local. Les renommer ferait disparaître les catégories
  // et les dossiers créés en mode invité avant la 1.2.7.
  categories: '@kitchen_playlists',
  dossiers: '@kitchen_playlist_groups',
  lastActiveList: '@kitchen_last_active_list',
};

// Mémorise la dernière liste de courses ouverte, pour que le raccourci
// "Liste en cours" de l'accueil pointe vers la liste réellement utilisée
// plutôt que systématiquement la plus ancienne. Réglage local à l'appareil
// (pas synchronisé), donc jamais bloquant et sans impact sur la sauvegarde
// des données en compte.
export const getLastActiveListId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(KEYS.lastActiveList);
  } catch {
    return null;
  }
};

export const setLastActiveListId = async (id: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.lastActiveList, id);
  } catch {
    // Best-effort : un échec ici ne doit jamais bloquer l'ouverture de la liste.
  }
};

const DEFAULT_RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Ratatouille provençale',
    description: 'Un classique du Sud de la France, coloré et savoureux.',
    ingredients: [
      { id: 'i1', name: 'Courgette', quantity: '2', unit: 'unité(s)', category: 'Légumes' },
      { id: 'i2', name: 'Aubergine', quantity: '1', unit: 'unité(s)', category: 'Légumes' },
      { id: 'i3', name: 'Poivron rouge', quantity: '1', unit: 'unité(s)', category: 'Légumes' },
      { id: 'i4', name: 'Tomates', quantity: '4', unit: 'unité(s)', category: 'Légumes' },
      { id: 'i5', name: 'Oignon', quantity: '1', unit: 'unité(s)', category: 'Légumes' },
      { id: 'i6', name: "Huile d'olive", quantity: '3', unit: 'c. à soupe', category: 'Huiles & Condiments' },
      { id: 'i7', name: 'Herbes de Provence', quantity: '1', unit: 'c. à café', category: 'Épices & Herbes' },
    ],
    steps: [
      'Lavez et coupez tous les légumes en rondelles.',
      "Faites revenir l'oignon dans l'huile d'olive pendant 5 minutes.",
      'Ajoutez les légumes et faites cuire 10 minutes à feu vif.',
      'Assaisonnez avec les herbes de Provence, sel et poivre.',
      'Laissez mijoter 20 minutes à feu doux.',
    ],
    tags: ['Végétarien', 'Vegan', 'Facile'],
    duration: 45,
    servings: 4,
    difficulty: 'Facile',
    createdAt: new Date().toISOString(),
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Poulet rôti aux herbes',
    description: 'Un poulet doré et parfumé, idéal pour le déjeuner dominical.',
    ingredients: [
      { id: 'i1', name: 'Poulet entier', quantity: '1', unit: 'unité(s)', category: 'Viandes' },
      { id: 'i2', name: 'Ail', quantity: '4', unit: 'gousse(s)', category: 'Légumes' },
      { id: 'i3', name: 'Romarin', quantity: '3', unit: 'branche(s)', category: 'Épices & Herbes' },
      { id: 'i4', name: 'Thym', quantity: '3', unit: 'branche(s)', category: 'Épices & Herbes' },
      { id: 'i5', name: 'Beurre', quantity: '50', unit: 'g', category: 'Produits laitiers' },
      { id: 'i6', name: 'Citron', quantity: '1', unit: 'unité(s)', category: 'Fruits' },
    ],
    steps: [
      'Préchauffez le four à 200°C.',
      "Frottez le poulet avec le beurre mou et l'ail écrasé.",
      'Glissez les herbes sous la peau et dans la cavité.',
      'Arrosez de jus de citron, salez et poivrez.',
      'Enfournez 1h15 en arrosant régulièrement.',
    ],
    tags: ['Plat principal', 'Four'],
    duration: 90,
    servings: 4,
    difficulty: 'Facile',
    createdAt: new Date().toISOString(),
    isFavorite: false,
  },
  {
    id: '3',
    title: 'Tarte tatin aux pommes',
    description: 'La célèbre tarte renversée caramélisée, un dessert incontournable.',
    ingredients: [
      { id: 'i1', name: 'Pommes Golden', quantity: '6', unit: 'unité(s)', category: 'Fruits' },
      { id: 'i2', name: 'Sucre', quantity: '150', unit: 'g', category: 'Céréales & Féculents' },
      { id: 'i3', name: 'Beurre', quantity: '80', unit: 'g', category: 'Produits laitiers' },
      { id: 'i4', name: 'Pâte feuilletée', quantity: '1', unit: 'boîte(s)', category: 'Céréales & Féculents' },
    ],
    steps: [
      'Épluchez et coupez les pommes en quartiers.',
      'Faites un caramel avec le sucre et le beurre dans une poêle allant au four.',
      'Disposez les pommes sur le caramel en les serrant.',
      'Recouvrez avec la pâte feuilletée en rentrant les bords.',
      'Enfournez à 180°C pendant 30 minutes, puis retournez.',
    ],
    tags: ['Dessert', 'Four'],
    duration: 60,
    servings: 6,
    difficulty: 'Moyen',
    createdAt: new Date().toISOString(),
    isFavorite: true,
  },
];

const DEFAULT_LISTS: ShoppingList[] = [
  {
    id: '1',
    name: 'Courses de la semaine',
    supermarketId: 'leclerc',
    color: '#0066CC',
    items: [
      { id: 'li1', name: 'Courgettes', quantity: '500', unit: 'g', category: 'Légumes', checked: false },
      { id: 'li2', name: 'Poulet fermier', quantity: '1', unit: 'unité(s)', category: 'Viandes', checked: true },
      { id: 'li3', name: 'Pâte feuilletée', quantity: '1', unit: 'boîte(s)', category: 'Céréales & Féculents', checked: false },
      { id: 'li4', name: 'Pommes Golden', quantity: '1', unit: 'kg', category: 'Fruits', checked: false },
    ],
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_PREFERENCES: Preferences = {
  likedIngredients: ['Tomates', 'Courgettes', 'Ail', 'Basilic', 'Fromage'],
  dislikedIngredients: ['Champignons', 'Betterave'],
  dietaryTags: [],
  allergies: [],
  defaultServings: 4,
};

// ===================== Supabase helpers =====================

function toDbRecipe(recipe: Recipe, userId: string) {
  return {
    id: recipe.id,
    user_id: userId,
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags,
    duration: recipe.duration,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    image_url: recipe.image || null,
    is_favorite: recipe.isFavorite,
    is_public: recipe.isPublic ?? false,
    created_at: recipe.createdAt,
  };
}

function fromDbRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) || '',
    ingredients: (row.ingredients as Ingredient[]) || [],
    steps: (row.steps as string[]) || [],
    tags: (row.tags as string[]) || [],
    duration: (row.duration as number) || 30,
    servings: (row.servings as number) || 4,
    difficulty: (row.difficulty as Recipe['difficulty']) || 'Facile',
    image: (row.image_url as string) || undefined,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    isFavorite: (row.is_favorite as boolean) || false,
    isPublic: (row.is_public as boolean) || false,
  };
}

function fromDbPublicRecipe(row: Record<string, unknown>): PublicRecipe {
  const base = fromDbRecipe(row);
  const profiles = row.user_profiles as Record<string, unknown> | null;
  return {
    ...base,
    authorId: row.user_id as string,
    authorName: (profiles?.username as string) || 'Utilisateur',
  };
}

function toDbList(list: ShoppingList, userId: string) {
  return {
    id: list.id,
    user_id: userId,
    name: list.name,
    supermarket_id: list.supermarketId,
    color: list.color,
    items: list.items,
    created_at: list.createdAt,
  };
}

function fromDbList(row: Record<string, unknown>): ShoppingList {
  return {
    id: row.id as string,
    name: row.name as string,
    supermarketId: row.supermarket_id as string,
    color: (row.color as string) || '#666666',
    items: (row.items as ListItem[]) || [],
    createdAt: (row.created_at as string) || new Date().toISOString(),
  };
}

// ===================== Recipes =====================

export const getRecipes = async (userId?: string): Promise<Recipe[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) { console.error('[getRecipes] Supabase error:', error.message); }
      if (!error && data) return data.map(fromDbRecipe);
    } catch (e) { console.error('[getRecipes] Exception:', e); }
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.recipes);
    return raw ? JSON.parse(raw) : DEFAULT_RECIPES;
  } catch {
    return DEFAULT_RECIPES;
  }
};

export const getPublicRecipes = async (currentUserId?: string): Promise<PublicRecipe[]> => {
  try {
    const sb = getSupabaseClient();
    let query = sb
      .from('recipes')
      .select('*, user_profiles(username)')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (currentUserId) {
      query = query.neq('user_id', currentUserId);
    }
    const { data, error } = await query;
    if (!error && data) return data.map(r => fromDbPublicRecipe(r as Record<string, unknown>));
  } catch {}
  return [];
};

export const saveRecipes = async (recipes: Recipe[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.recipes, JSON.stringify(recipes));
};

export const addRecipe = async (recipe: Recipe, userId?: string): Promise<Recipe[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipes').insert(toDbRecipe(recipe, userId));
      if (error) { console.error('[addRecipe] Supabase error:', error.message); throw new Error(error.message); }
      return getRecipes(userId);
    } catch (e) { console.error('[addRecipe] Exception:', e); throw e; }
  }
  const recipes = await getRecipes();
  const updated = [recipe, ...recipes];
  await saveRecipes(updated);
  return updated;
};

export const updateRecipe = async (recipe: Recipe, userId?: string): Promise<Recipe[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipes').update({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tags: recipe.tags,
        duration: recipe.duration,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        image_url: recipe.image || null,
        is_favorite: recipe.isFavorite,
        is_public: recipe.isPublic ?? false,
      }).eq('id', recipe.id);
      if (error) { console.error('[updateRecipe] Supabase error:', error.message); }
      return getRecipes(userId);
    } catch (e) { console.error('[updateRecipe] Exception:', e); }
  }
  const recipes = await getRecipes();
  const updated = recipes.map(r => r.id === recipe.id ? recipe : r);
  await saveRecipes(updated);
  return updated;
};

export const deleteRecipe = async (id: string, userId?: string): Promise<Recipe[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipes').delete().eq('id', id);
      if (error) { console.error('[deleteRecipe] Supabase error:', error.message); }
      return getRecipes(userId);
    } catch (e) { console.error('[deleteRecipe] Exception:', e); }
  }
  const recipes = await getRecipes();
  const updated = recipes.filter(r => r.id !== id);
  await saveRecipes(updated);
  return updated;
};

// ===================== Shopping lists =====================

export const getShoppingLists = async (userId?: string): Promise<ShoppingList[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('shopping_lists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) { console.error('[getShoppingLists] Supabase error:', error.message); }
      if (!error && data) return data.map(fromDbList);
    } catch (e) { console.error('[getShoppingLists] Exception:', e); }
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.lists);
    return raw ? JSON.parse(raw) : DEFAULT_LISTS;
  } catch {
    return DEFAULT_LISTS;
  }
};

export const saveShoppingLists = async (lists: ShoppingList[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.lists, JSON.stringify(lists));
};

export const addShoppingList = async (list: ShoppingList, userId?: string): Promise<ShoppingList[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('shopping_lists').insert(toDbList(list, userId));
      if (error) { console.error('[addShoppingList] Supabase error:', error.message); throw new Error(error.message); }
      return getShoppingLists(userId);
    } catch (e) { console.error('[addShoppingList] Exception:', e); throw e; }
  }
  const lists = await getShoppingLists();
  const updated = [list, ...lists];
  await saveShoppingLists(updated);
  return updated;
};

export const updateShoppingList = async (list: ShoppingList, userId?: string): Promise<ShoppingList[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('shopping_lists').update({
        name: list.name,
        supermarket_id: list.supermarketId,
        color: list.color,
        items: list.items,
      }).eq('id', list.id);
      if (error) { console.error('[updateShoppingList] Supabase error:', error.message); }
      return getShoppingLists(userId);
    } catch (e) { console.error('[updateShoppingList] Exception:', e); }
  }
  const lists = await getShoppingLists();
  const updated = lists.map(l => l.id === list.id ? list : l);
  await saveShoppingLists(updated);
  return updated;
};

export const deleteShoppingList = async (id: string, userId?: string): Promise<ShoppingList[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('shopping_lists').delete().eq('id', id);
      if (error) { console.error('[deleteShoppingList] Supabase error:', error.message); }
      return getShoppingLists(userId);
    } catch (e) { console.error('[deleteShoppingList] Exception:', e); }
  }
  const lists = await getShoppingLists();
  const updated = lists.filter(l => l.id !== id);
  await saveShoppingLists(updated);
  return updated;
};

// ===================== Preferences =====================

export const getPreferences = async (userId?: string): Promise<Preferences> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb.from('user_preferences').select('*').eq('id', userId).single();
      if (!error && data) {
        return {
          likedIngredients: (data.liked_ingredients as string[]) || [],
          dislikedIngredients: (data.disliked_ingredients as string[]) || [],
          dietaryTags: (data.dietary_tags as string[]) || [],
          allergies: (data.allergies as string[]) || [],
          defaultServings: (data.default_servings as number) || 4,
        };
      }
    } catch {}
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.preferences);
    return raw ? JSON.parse(raw) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export const savePreferences = async (prefs: Preferences, userId?: string): Promise<void> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      await sb.from('user_preferences').upsert({
        id: userId,
        liked_ingredients: prefs.likedIngredients,
        disliked_ingredients: prefs.dislikedIngredients,
        dietary_tags: prefs.dietaryTags,
        allergies: prefs.allergies,
        default_servings: prefs.defaultServings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      return;
    } catch {}
  }
  await AsyncStorage.setItem(KEYS.preferences, JSON.stringify(prefs));
};

// ===================== Image upload =====================

/*
 * Envoi d'une image dans un compartiment Supabase Storage.
 *
 * Le chemin du fichier DOIT commencer par l'identifiant de l'utilisateur :
 * toutes les policies de stockage du projet vérifient
 * `(storage.foldername(name))[1] = auth.uid()` (cf. 0001_init.sql, 0004, 0005).
 *
 * Renvoie l'erreur plutôt que `null` : quand une photo ne part pas, il faut le
 * dire. C'est ce silence qui a laissé les trois compartiments vides pendant
 * des semaines sans que personne ne comprenne pourquoi.
 */
async function uploadImage(bucket: string, localUri: string, pathPrefix: string): Promise<UploadResult> {
  try {
    const { bytes, mimeType, extension } = await readImageForUpload(localUri);
    const fileName = `${pathPrefix}_${Date.now()}.${extension}`;

    const sb = getSupabaseClient();
    const { error } = await sb.storage.from(bucket).upload(fileName, bytes, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      console.error(`[uploadImage:${bucket}]`, error.message);
      return { url: null, error: `La photo n'a pas pu être envoyée : ${error.message}` };
    }

    const { data } = sb.storage.from(bucket).getPublicUrl(fileName);
    return { url: data.publicUrl, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    console.error(`[uploadImage:${bucket}]`, message);
    return { url: null, error: `La photo n'a pas pu être envoyée : ${message}` };
  }
}

export const uploadRecipeImage = async (
  localUri: string,
  userId: string,
  recipeId: string
): Promise<UploadResult> => uploadImage('recipe-images', localUri, `${userId}/${recipeId}`);

// Même logique que uploadRecipeImage ci-dessus, mais dans le bucket dédié
// aux photos de dossiers de catégories (voir 0004_playlist_group_photos.sql).
export const uploadDossierImage = async (
  localUri: string,
  userId: string,
  groupId: string
): Promise<UploadResult> => uploadImage('playlist-group-images', localUri, `${userId}/${groupId}`);

// ===================== Catégories =====================

function toDbCategorie(pl: Categorie, userId: string) {
  return {
    id: pl.id,
    user_id: userId,
    name: pl.name,
    description: pl.description,
    recipe_ids: pl.recipeIds,
    cover_color: pl.coverColor,
    created_at: pl.createdAt,
    group_ids: pl.dossierIds,
  };
}

function fromDbCategorie(row: Record<string, unknown>): Categorie {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    recipeIds: (row.recipe_ids as string[]) || [],
    coverColor: (row.cover_color as string) || '#C0705A',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    dossierIds: (row.group_ids as string[]) || [],
  };
}

export const getCategories = async (userId?: string): Promise<Categorie[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('recipe_playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) { console.error('[getCategories] Supabase error:', error.message); }
      if (!error && data) return data.map(r => fromDbCategorie(r as Record<string, unknown>));
    } catch (e) { console.error('[getCategories] Exception:', e); }
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.categories);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCategories = async (categories: Categorie[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.categories, JSON.stringify(categories));
};

export const addCategorie = async (pl: Categorie, userId?: string): Promise<Categorie[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipe_playlists').insert(toDbCategorie(pl, userId));
      if (error) { console.error('[addCategorie] Supabase error:', error.message); throw new Error(error.message); }
      return getCategories(userId);
    } catch (e) { console.error('[addCategorie] Exception:', e); throw e; }
  }
  const list = await getCategories();
  const updated = [pl, ...list];
  await saveCategories(updated);
  return updated;
};

export const updateCategorie = async (pl: Categorie, userId?: string): Promise<Categorie[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipe_playlists').update({
        name: pl.name,
        description: pl.description,
        recipe_ids: pl.recipeIds,
        cover_color: pl.coverColor,
        group_ids: pl.dossierIds,
      }).eq('id', pl.id);
      if (error) { console.error('[updateCategorie] Supabase error:', error.message); }
      return getCategories(userId);
    } catch (e) { console.error('[updateCategorie] Exception:', e); }
  }
  const list = await getCategories();
  const updated = list.map(p => p.id === pl.id ? pl : p);
  await saveCategories(updated);
  return updated;
};

export const deleteCategorie = async (id: string, userId?: string): Promise<Categorie[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('recipe_playlists').delete().eq('id', id);
      if (error) { console.error('[deleteCategorie] Supabase error:', error.message); }
      return getCategories(userId);
    } catch (e) { console.error('[deleteCategorie] Exception:', e); }
  }
  const list = await getCategories();
  const updated = list.filter(p => p.id !== id);
  await saveCategories(updated);
  return updated;
};

// ===================== Dossiers de catégories =====================

function toDbDossier(g: Dossier, userId: string) {
  return {
    id: g.id,
    user_id: userId,
    parent_id: g.parentId,
    name: g.name,
    color: g.color,
    created_at: g.createdAt,
    image_url: g.imageUrl || null,
  };
}

function fromDbDossier(row: Record<string, unknown>): Dossier {
  return {
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string) ?? null,
    color: (row.color as string) || '#C0705A',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    imageUrl: (row.image_url as string) || undefined,
  };
}

export const getDossiers = async (userId?: string): Promise<Dossier[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('playlist_groups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) { console.error('[getDossiers] Supabase error:', error.message); }
      if (!error && data) return data.map(r => fromDbDossier(r as Record<string, unknown>));
    } catch (e) { console.error('[getDossiers] Exception:', e); }
  }
  try {
    const raw = await AsyncStorage.getItem(KEYS.dossiers);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveDossiers = async (dossiers: Dossier[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.dossiers, JSON.stringify(dossiers));
};

export const addDossier = async (g: Dossier, userId?: string): Promise<Dossier[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('playlist_groups').insert(toDbDossier(g, userId));
      if (error) { console.error('[addDossier] Supabase error:', error.message); throw new Error(error.message); }
      return getDossiers(userId);
    } catch (e) { console.error('[addDossier] Exception:', e); throw e; }
  }
  const list = await getDossiers();
  const updated = [...list, g];
  await saveDossiers(updated);
  return updated;
};

export const updateDossier = async (g: Dossier, userId?: string): Promise<Dossier[]> => {
  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('playlist_groups').update({
        name: g.name,
        parent_id: g.parentId,
        color: g.color,
        image_url: g.imageUrl || null,
      }).eq('id', g.id);
      if (error) { console.error('[updateDossier] Supabase error:', error.message); }
      return getDossiers(userId);
    } catch (e) { console.error('[updateDossier] Exception:', e); }
  }
  const list = await getDossiers();
  const updated = list.map(g2 => g2.id === g.id ? g : g2);
  await saveDossiers(updated);
  return updated;
};

// Supprime un dossier et toute sa descendance (allGroups doit contenir tous
// les dossiers de l'utilisateur, déjà chargés côté client — pas besoin d'une
// requête récursive pour le volume concerné ici). `on delete cascade` côté
// SQL supprime les sous-dossiers ; ici on nettoie en plus les `dossierIds` des
// catégories qui référençaient l'un des dossiers supprimés (un tableau JSONB
// n'est pas concerné par le cascade d'une clé étrangère).
export const deleteDossier = async (
  id: string,
  allGroups: Dossier[],
  allPlaylists: Categorie[],
  userId?: string
): Promise<{ dossiers: Dossier[]; categories: Categorie[] }> => {
  const toDelete = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of allGroups) {
      if (g.parentId && toDelete.has(g.parentId) && !toDelete.has(g.id)) {
        toDelete.add(g.id);
        changed = true;
      }
    }
  }

  if (userId) {
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('playlist_groups').delete().eq('id', id);
      if (error) console.error('[deleteDossier] Supabase error:', error.message);
    } catch (e) { console.error('[deleteDossier] Exception:', e); }
  }

  const affectedPlaylists = allPlaylists.filter(p => p.dossierIds.some(gid => toDelete.has(gid)));
  for (const p of affectedPlaylists) {
    const updated = { ...p, dossierIds: p.dossierIds.filter(gid => !toDelete.has(gid)) };
    await updateCategorie(updated, userId);
  }

  if (!userId) {
    const list = await getDossiers();
    await saveDossiers(list.filter(g => !toDelete.has(g.id)));
  }

  const dossiers = await getDossiers(userId);
  const categories = await getCategories(userId);
  return { dossiers, categories };
};

// ===================== Migration invité → compte =====================
//
// Avant de se connecter, l'app fonctionne "sans compte" et stocke tout en
// local (AsyncStorage, cf. getRecipes/getShoppingLists/... ci-dessus quand
// userId est absent). Dès qu'un compte est connecté, l'app bascule
// entièrement sur les données Supabase de ce compte — qui démarrent vides.
// Sans la migration ci-dessous, tout ce qui avait été créé "sans compte"
// devenait invisible pour toujours dès la première connexion, en donnant
// l'impression que les données avaient été perdues (elles restaient en
// réalité sur l'appareil, simplement plus jamais affichées).

const migratedFlagKey = (userId: string) => `@kitchen_migrated_${userId}`;

export const hasLocalGuestData = async (): Promise<boolean> => {
  const [r, l, p, pl] = await Promise.all([
    AsyncStorage.getItem(KEYS.recipes),
    AsyncStorage.getItem(KEYS.lists),
    AsyncStorage.getItem(KEYS.categories),
    AsyncStorage.getItem(KEYS.preferences),
  ]);
  // Chaque clé n'est écrite qu'après une action réelle de l'utilisateur
  // (ajout, modification, suppression...) : si aucune n'existe, il n'y a
  // jamais eu de données "invité" à migrer, seulement les recettes de démo
  // affichées par défaut en mémoire.
  return !!(r || l || p || pl);
};

export const hasMigratedGuestData = async (userId: string): Promise<boolean> => {
  return !!(await AsyncStorage.getItem(migratedFlagKey(userId)));
};

export const markGuestDataMigrated = async (userId: string): Promise<void> => {
  await AsyncStorage.setItem(migratedFlagKey(userId), '1');
};

export const migrateLocalGuestDataToAccount = async (userId: string): Promise<void> => {
  const [recipesRaw, listsRaw, playlistsRaw, prefsRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.recipes),
    AsyncStorage.getItem(KEYS.lists),
    AsyncStorage.getItem(KEYS.categories),
    AsyncStorage.getItem(KEYS.preferences),
  ]);

  const sb = getSupabaseClient();

  if (recipesRaw) {
    try {
      const localRecipes: Recipe[] = JSON.parse(recipesRaw);
      for (const recipe of localRecipes) {
        const { error } = await sb.from('recipes').insert(toDbRecipe(recipe, userId));
        if (error) console.error('[migrateLocalGuestDataToAccount] recipe:', error.message);
      }
    } catch (e) { console.error('[migrateLocalGuestDataToAccount] recipes:', e); }
  }

  if (listsRaw) {
    try {
      const localLists: ShoppingList[] = JSON.parse(listsRaw);
      for (const list of localLists) {
        const { error } = await sb.from('shopping_lists').insert(toDbList(list, userId));
        if (error) console.error('[migrateLocalGuestDataToAccount] list:', error.message);
      }
    } catch (e) { console.error('[migrateLocalGuestDataToAccount] lists:', e); }
  }

  if (playlistsRaw) {
    try {
      const localPlaylists: Categorie[] = JSON.parse(playlistsRaw);
      for (const pl of localPlaylists) {
        const { error } = await sb.from('recipe_playlists').insert(toDbCategorie(pl, userId));
        if (error) console.error('[migrateLocalGuestDataToAccount] catégorie:', error.message);
      }
    } catch (e) { console.error('[migrateLocalGuestDataToAccount] categories:', e); }
  }

  if (prefsRaw) {
    try {
      const localPrefs: Preferences = JSON.parse(prefsRaw);
      await savePreferences(localPrefs, userId);
    } catch (e) { console.error('[migrateLocalGuestDataToAccount] preferences:', e); }
  }
};

export const generateId = (): string => {
  // Generate a valid UUID v4 (required by Supabase uuid columns)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
