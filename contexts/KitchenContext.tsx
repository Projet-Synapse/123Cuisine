// Powered by OnSpace.AI
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Recipe, PublicRecipe, ShoppingList, Preferences, ListItem, RecipePlaylist,
  getRecipes, getPublicRecipes, saveRecipes, getShoppingLists, saveShoppingLists,
  getPreferences, savePreferences, getPlaylists, savePlaylists,
  addRecipe, updateRecipe, deleteRecipe,
  addShoppingList, updateShoppingList, deleteShoppingList,
  addPlaylist, updatePlaylist, deletePlaylist,
  generateId,
} from '@/services/kitchenService';
import { useAuth } from '@/template';

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
  addItemToList: (listId: string, item: Omit<ListItem, 'id'>) => Promise<void>;
  removeItemFromList: (listId: string, itemId: string) => Promise<void>;
  addRecipeToList: (listId: string, recipe: Recipe) => Promise<void>;

  playlists: RecipePlaylist[];
  addPlaylist: (pl: Omit<RecipePlaylist, 'id' | 'createdAt'>) => Promise<void>;
  updatePlaylist: (pl: RecipePlaylist) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  removeRecipeFromPlaylist: (playlistId: string, recipeId: string) => Promise<void>;

  preferences: Preferences;
  updatePreferences: (prefs: Preferences) => Promise<void>;

  loading: boolean;
  refreshAll: () => Promise<void>;
}

export const KitchenContext = createContext<KitchenContextType | undefined>(undefined);

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [publicRecipes, setPublicRecipes] = useState<PublicRecipe[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [playlists, setPlaylists] = useState<RecipePlaylist[]>([]);
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
      getPlaylists(uid),
    ]);
    setRecipes(r);
    setShoppingLists(l);
    setPreferences(p);
    setPlaylists(pl);
    if (uid) {
      const pub = await getPublicRecipes(uid);
      setPublicRecipes(pub);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(userId);
  }, [userId, loadData]);

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

  // ── Playlists ──

  const handleAddPlaylist = useCallback(async (plData: Omit<RecipePlaylist, 'id' | 'createdAt'>) => {
    const pl: RecipePlaylist = { ...plData, id: generateId(), createdAt: new Date().toISOString() };
    setPlaylists(prev => [pl, ...prev]);
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
        });
        if (error) console.error('[addPlaylist] Supabase:', error.message);
      } catch (e) { console.error('[addPlaylist]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getPlaylists());
      await import('@/services/kitchenService').then(m => m.savePlaylists([pl, ...all.filter(p => p.id !== pl.id)]));
    }
  }, [userId]);

  const handleUpdatePlaylist = useCallback(async (pl: RecipePlaylist) => {
    setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipe_playlists').update({
          name: pl.name,
          description: pl.description,
          recipe_ids: pl.recipeIds,
          cover_color: pl.coverColor,
        }).eq('id', pl.id).eq('user_id', userId);
        if (error) console.error('[updatePlaylist] Supabase:', error.message);
      } catch (e) { console.error('[updatePlaylist]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getPlaylists());
      await import('@/services/kitchenService').then(m => m.savePlaylists(all.map(p => p.id === pl.id ? pl : p)));
    }
  }, [userId]);

  const handleDeletePlaylist = useCallback(async (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (userId) {
      try {
        const sb = (await import('@/template')).getSupabaseClient();
        const { error } = await sb.from('recipe_playlists').delete().eq('id', id).eq('user_id', userId);
        if (error) console.error('[deletePlaylist] Supabase:', error.message);
      } catch (e) { console.error('[deletePlaylist]', e); }
    } else {
      const all = await import('@/services/kitchenService').then(m => m.getPlaylists());
      await import('@/services/kitchenService').then(m => m.savePlaylists(all.filter(p => p.id !== id)));
    }
  }, [userId]);

  const removeRecipeFromPlaylist = useCallback(async (playlistId: string, recipeId: string) => {
    const updatedPls = playlists.map(pl => {
      if (pl.id !== playlistId) return pl;
      return { ...pl, recipeIds: pl.recipeIds.filter(rid => rid !== recipeId) };
    });
    setPlaylists(updatedPls);
    const pl = updatedPls.find(p => p.id === playlistId);
    if (pl) {
      if (userId) await updatePlaylist(pl, userId);
      else await savePlaylists(updatedPls);
    }
  }, [playlists, userId]);

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
      addItemToList,
      removeItemFromList,
      addRecipeToList,
      playlists,
      addPlaylist: handleAddPlaylist,
      updatePlaylist: handleUpdatePlaylist,
      deletePlaylist: handleDeletePlaylist,
      removeRecipeFromPlaylist,
      preferences,
      updatePreferences: handleUpdatePreferences,
      loading,
      refreshAll: () => loadData(userId),
    }}>
      {children}
    </KitchenContext.Provider>
  );
}
