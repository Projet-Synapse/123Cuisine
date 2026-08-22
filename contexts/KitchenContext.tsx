//////////////////////////////////////////////////////////////////////////
//                         🥘 KitchenContext.tsx                        //
//////////////////////////////////////////////////////////////////////////

/*
 * Contexte central des données de l'app : recettes, listes de courses, categories, préférences. Bascule entre stockage local (mode invité) et Supabase (connecté), et propose la migration des données locales vers un compte à la connexion.
 */

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Recipe, PublicRecipe, ShoppingList, Preferences, ListItem, Categorie,
  getRecipes, getPublicRecipes, saveRecipes, getShoppingLists, saveShoppingLists,
  getPreferences, savePreferences, getCategories, saveCategories,
  updateShoppingList,
  updateCategorie,
  generateId,
  hasLocalGuestData, hasMigratedGuestData, markGuestDataMigrated, migrateLocalGuestDataToAccount,
} from '@/services/kitchenService';
import { useAuth, useAlert } from '@/template';

export interface KitchenContextType {
  recipes: Recipe[];
  publicRecipes: PublicRecipe[];
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePublic: (id: string) => Promise<void>;
  refreshPublicRecipes: () => Promise<void>;

  shoppingLists: ShoppingList[];
  addShoppingList: (list: Omit<ShoppingList, 'id' | 'createdAt'>) => Promise<void>;
  updateShoppingList: (list: ShoppingList) => Promise<void>;
  deleteShoppingList: (id: string) => Promise<void>;
  toggleListItem: (listId: string, itemId: string) => Promise<void>;
  setAllListItemsChecked: (listId: string, checked: boolean) => Promise<void>;
  addItemToList: (listId: string, item: Omit<ListItem, 'id'>) => Promise<void>;
  removeItemFromList: (listId: string, itemId: string) => Promise<void>;
  addRecipeToList: (listId: string, recipe: Recipe) => Promise<void>;

  categories: Categorie[];
  addCategorie: (pl: Omit<Categorie, 'id' | 'createdAt'>) => Promise<void>;
  updateCategorie: (pl: Categorie) => Promise<void>;
  deleteCategorie: (id: string) => Promise<void>;
  removeRecipeFromCategorie: (categorieId: string, recipeId: string) => Promise<void>;

  preferences: Preferences;
  updatePreferences: (prefs: Preferences) => Promise<void>;

  loading: boolean;
  refreshAll: () => Promise<void>;
}

export const KitchenContext = createContext<KitchenContextType | undefined>(undefined);

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const userId = user?.id;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [publicRecipes, setPublicRecipes] = useState<PublicRecipe[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    likedIngredients: [],
    dislikedIngredients: [],
    dietaryTags: [],
    allergies: [],
    defaultServings: 4,
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (uid?: string) => {
    setLoading(true);
    const [r, l, p, pl] = await Promise.all([
      getRecipes(uid),
      getShoppingLists(uid),
      getPreferences(uid),
      getCategories(uid),
    ]);
    setRecipes(r);
    setShoppingLists(l);
    setPreferences(p);
    setCategories(pl);
    if (uid) {
      const pub = await getPublicRecipes(uid);
      setPublicRecipes(pub);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(userId);
  }, [userId, loadData]);

  // Propose de récupérer les données créées "sans compte" (stockées en local
  // sur cet appareil) dès qu'un compte est connecté, une seule fois par
  // compte. Voir services/kitchenService.ts pour le détail.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const alreadyMigrated = await hasMigratedGuestData(userId);
      if (alreadyMigrated || cancelled) return;

      const hasGuestData = await hasLocalGuestData();
      if (!hasGuestData) {
        await markGuestDataMigrated(userId);
        return;
      }
      if (cancelled) return;

      showAlert(
        'Données locales trouvées',
        "Des recettes, listes de courses ou catégories enregistrées sur cet appareil avant votre connexion ont été trouvées. Voulez-vous les ajouter à votre compte ?",
        [
          { text: 'Ignorer', style: 'cancel', onPress: async () => { await markGuestDataMigrated(userId); } },
          {
            text: 'Ajouter à mon compte',
            onPress: async () => {
              await migrateLocalGuestDataToAccount(userId);
              await markGuestDataMigrated(userId);
              await loadData(userId);
            },
          },
        ]
      );
    })();

    return () => { cancelled = true; };
  }, [userId, loadData, showAlert]);

  const refreshPublicRecipes = useCallback(async () => {
    const pub = await getPublicRecipes(userId);
    setPublicRecipes(pub);
  }, [userId]);

  const handleAddRecipe = useCallback(async (recipeData: Omit<Recipe, 'id' | 'createdAt'>) => {
    const recipe: Recipe = { ...recipeData, id: generateId(), createdAt: new Date().toISOString() };
    setRecipes(prev => [recipe, ...prev]);
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipes').insert({
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
        });
        if (error) console.error('[addRecipe] Supabase:', error.message);
      } catch (e) { console.error('[addRecipe]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getRecipes());
      const updated = [recipe, ...all.filter(r => r.id !== recipe.id)];
      await import('@/services/kitchenService').then(m => m.saveRecipes(updated));
    }
  }, [userId]);

  const handleUpdateRecipe = useCallback(async (recipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
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
        }).eq('id', recipe.id).eq('user_id', userId);
        if (error) console.error('[updateRecipe] Supabase:', error.message);
      } catch (e) { console.error('[updateRecipe]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getRecipes());
      await import('@/services/kitchenService').then(m => m.saveRecipes(all.map(r => r.id === recipe.id ? recipe : r)));
    }
  }, [userId]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipes').delete().eq('id', id).eq('user_id', userId);
        if (error) console.error('[deleteRecipe] Supabase:', error.message);
      } catch (e) { console.error('[deleteRecipe]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getRecipes());
      await import('@/services/kitchenService').then(m => m.saveRecipes(all.filter(r => r.id !== id)));
    }
  }, [userId]);

  const toggleFavorite = useCallback(async (id: string) => {
    setRecipes(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r);
      const recipe = updated.find(r => r.id === id);
      if (recipe && userId) {
        import('@/template').then(({ getSupabaseClient }) => {
          getSupabaseClient().from('recipes').update({ is_favorite: recipe.isFavorite }).eq('id', id).eq('user_id', userId)
            .then(({ error }) => { if (error) console.error('[toggleFavorite]', error.message); });
        });
      } else if (recipe) {
        saveRecipes(updated);
      }
      return updated;
    });
  }, [userId]);

  const togglePublic = useCallback(async (id: string) => {
    setRecipes(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r);
      const recipe = updated.find(r => r.id === id);
      if (recipe && userId) {
        import('@/template').then(({ getSupabaseClient }) => {
          getSupabaseClient().from('recipes').update({ is_public: recipe.isPublic }).eq('id', id).eq('user_id', userId)
            .then(({ error }) => { if (error) console.error('[togglePublic]', error.message); });
        });
      } else if (recipe) {
        saveRecipes(updated);
      }
      return updated;
    });
  }, [userId]);

  const handleAddShoppingList = useCallback(async (listData: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const list: ShoppingList = { ...listData, id: generateId(), createdAt: new Date().toISOString() };
    setShoppingLists(prev => [list, ...prev]);
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('shopping_lists').insert({
          id: list.id,
          user_id: userId,
          name: list.name,
          supermarket_id: list.supermarketId,
          color: list.color,
          items: list.items,
          created_at: list.createdAt,
        });
        if (error) console.error('[addShoppingList] Supabase:', error.message);
      } catch (e) { console.error('[addShoppingList]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getShoppingLists());
      await import('@/services/kitchenService').then(m => m.saveShoppingLists([list, ...all.filter(l => l.id !== list.id)]));
    }
  }, [userId]);

  const handleUpdateShoppingList = useCallback(async (list: ShoppingList) => {
    setShoppingLists(prev => prev.map(l => l.id === list.id ? list : l));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('shopping_lists').update({
          name: list.name,
          supermarket_id: list.supermarketId,
          color: list.color,
          items: list.items,
        }).eq('id', list.id).eq('user_id', userId);
        if (error) console.error('[updateShoppingList] Supabase:', error.message);
      } catch (e) { console.error('[updateShoppingList]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getShoppingLists());
      await import('@/services/kitchenService').then(m => m.saveShoppingLists(all.map(l => l.id === list.id ? list : l)));
    }
  }, [userId]);

  const handleDeleteShoppingList = useCallback(async (id: string) => {
    setShoppingLists(prev => prev.filter(l => l.id !== id));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('shopping_lists').delete().eq('id', id).eq('user_id', userId);
        if (error) console.error('[deleteShoppingList] Supabase:', error.message);
      } catch (e) { console.error('[deleteShoppingList]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getShoppingLists());
      await import('@/services/kitchenService').then(m => m.saveShoppingLists(all.filter(l => l.id !== id)));
    }
  }, [userId]);

  const toggleListItem = useCallback(async (listId: string, itemId: string) => {
    const updated = shoppingLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item) };
    });
    setShoppingLists(updated);
    const list = updated.find(l => l.id === listId);
    if (list) {
      if (userId) await updateShoppingList(list, userId);
      else await saveShoppingLists(updated);
    }
  }, [shoppingLists, userId]);

  // Coche ou décoche tous les articles d'une liste d'un coup (fin de courses,
  // ou relance d'une liste type d'une semaine sur l'autre).
  const setAllListItemsChecked = useCallback(async (listId: string, checked: boolean) => {
    const updated = shoppingLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map(item => ({ ...item, checked })) };
    });
    setShoppingLists(updated);
    const list = updated.find(l => l.id === listId);
    if (list) {
      if (userId) await updateShoppingList(list, userId);
      else await saveShoppingLists(updated);
    }
  }, [shoppingLists, userId]);

  const addItemToList = useCallback(async (listId: string, itemData: Omit<ListItem, 'id'>) => {
    const item: ListItem = { ...itemData, id: generateId() };
    const updated = shoppingLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: [...l.items, item] };
    });
    setShoppingLists(updated);
    const list = updated.find(l => l.id === listId);
    if (list) {
      if (userId) await updateShoppingList(list, userId);
      else await saveShoppingLists(updated);
    }
  }, [shoppingLists, userId]);

  const removeItemFromList = useCallback(async (listId: string, itemId: string) => {
    const updated = shoppingLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.filter(i => i.id !== itemId) };
    });
    setShoppingLists(updated);
    const list = updated.find(l => l.id === listId);
    if (list) {
      if (userId) await updateShoppingList(list, userId);
      else await saveShoppingLists(updated);
    }
  }, [shoppingLists, userId]);

  const addRecipeToList = useCallback(async (listId: string, recipe: Recipe) => {
    const newItems: ListItem[] = recipe.ingredients.map(ing => ({
      id: generateId(),
      name: ing.name,
      quantity: ing.quantity || '1',
      unit: ing.unit || 'unité(s)',
      category: ing.category,
      checked: false,
    }));
    const updated = shoppingLists.map(l => {
      if (l.id !== listId) return l;
      const existingNames = new Set(l.items.map(i => i.name.toLowerCase()));
      const toAdd = newItems.filter(i => !existingNames.has(i.name.toLowerCase()));
      return { ...l, items: [...l.items, ...toAdd] };
    });
    setShoppingLists(updated);
    const list = updated.find(l => l.id === listId);
    if (list) {
      if (userId) await updateShoppingList(list, userId);
      else await saveShoppingLists(updated);
    }
  }, [shoppingLists, userId]);

  // ── Catégories ──

  const handleAddCategorie = useCallback(async (plData: Omit<Categorie, 'id' | 'createdAt'>) => {
    const pl: Categorie = { ...plData, id: generateId(), createdAt: new Date().toISOString() };
    setCategories(prev => [pl, ...prev]);
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipe_playlists').insert({
          id: pl.id,
          user_id: userId,
          name: pl.name,
          description: pl.description,
          recipe_ids: pl.recipeIds,
          cover_color: pl.coverColor,
          created_at: pl.createdAt,
          group_ids: pl.dossierIds,
        });
        if (error) console.error('[addCategorie] Supabase:', error.message);
      } catch (e) { console.error('[addCategorie]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getCategories());
      await import('@/services/kitchenService').then(m => m.saveCategories([pl, ...all.filter(p => p.id !== pl.id)]));
    }
  }, [userId]);

  const handleUpdateCategorie = useCallback(async (pl: Categorie) => {
    setCategories(prev => prev.map(p => p.id === pl.id ? pl : p));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipe_playlists').update({
          name: pl.name,
          description: pl.description,
          recipe_ids: pl.recipeIds,
          cover_color: pl.coverColor,
          group_ids: pl.dossierIds,
        }).eq('id', pl.id).eq('user_id', userId);
        if (error) console.error('[updateCategorie] Supabase:', error.message);
      } catch (e) { console.error('[updateCategorie]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getCategories());
      await import('@/services/kitchenService').then(m => m.saveCategories(all.map(p => p.id === pl.id ? pl : p)));
    }
  }, [userId]);

  const handleDeleteCategorie = useCallback(async (id: string) => {
    setCategories(prev => prev.filter(p => p.id !== id));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipe_playlists').delete().eq('id', id).eq('user_id', userId);
        if (error) console.error('[deleteCategorie] Supabase:', error.message);
      } catch (e) { console.error('[deleteCategorie]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getCategories());
      await import('@/services/kitchenService').then(m => m.saveCategories(all.filter(p => p.id !== id)));
    }
  }, [userId]);

  const removeRecipeFromCategorie = useCallback(async (categorieId: string, recipeId: string) => {
    const updatedPls = categories.map(pl => {
      if (pl.id !== categorieId) return pl;
      return { ...pl, recipeIds: pl.recipeIds.filter(rid => rid !== recipeId) };
    });
    setCategories(updatedPls);
    const pl = updatedPls.find(p => p.id === categorieId);
    if (pl) {
      if (userId) await updateCategorie(pl, userId);
      else await saveCategories(updatedPls);
    }
  }, [categories, userId]);

  const handleUpdatePreferences = useCallback(async (prefs: Preferences) => {
    setPreferences(prefs);
    await savePreferences(prefs, userId);
  }, [userId]);

  return (
    <KitchenContext.Provider value={{
      recipes,
      publicRecipes,
      addRecipe: handleAddRecipe,
      updateRecipe: handleUpdateRecipe,
      deleteRecipe: handleDeleteRecipe,
      toggleFavorite,
      togglePublic,
      refreshPublicRecipes,
      shoppingLists,
      addShoppingList: handleAddShoppingList,
      updateShoppingList: handleUpdateShoppingList,
      deleteShoppingList: handleDeleteShoppingList,
      toggleListItem,
      setAllListItemsChecked,
      addItemToList,
      removeItemFromList,
      addRecipeToList,
      categories,
      addCategorie: handleAddCategorie,
      updateCategorie: handleUpdateCategorie,
      deleteCategorie: handleDeleteCategorie,
      removeRecipeFromCategorie,
      preferences,
      updatePreferences: handleUpdatePreferences,
      loading,
      refreshAll: () => loadData(userId),
    }}>
      {children}
    </KitchenContext.Provider>
  );
}
