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
    // Optimistic update first
    setRecipes(prev => [recipe, ...prev]);
    try {
      const updated = await addRecipe(recipe, userId);
      setRecipes(updated);
    } catch (e) {
      // Keep optimistic update, data is in local state
      console.error('[KitchenContext] addRecipe failed, keeping local:', e);
    }
  }, [userId]);

  const handleUpdateRecipe = useCallback(async (recipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
    try {
      const updated = await updateRecipe(recipe, userId);
      setRecipes(updated);
    } catch (e) {
      console.error('[KitchenContext] updateRecipe failed:', e);
    }
  }, [userId]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
    try {
      const updated = await deleteRecipe(id, userId);
      setRecipes(updated);
    } catch (e) {
      console.error('[KitchenContext] deleteRecipe failed:', e);
    }
  }, [userId]);

  const toggleFavorite = useCallback(async (id: string) => {
    const updated = recipes.map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r);
    setRecipes(updated);
    if (userId) {
      const recipe = updated.find(r => r.id === id);
      if (recipe) await updateRecipe(recipe, userId);
    } else {
      await saveRecipes(updated);
    }
  }, [recipes, userId]);

  const togglePublic = useCallback(async (id: string) => {
    const updated = recipes.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r);
    setRecipes(updated);
    if (userId) {
      const recipe = updated.find(r => r.id === id);
      if (recipe) await updateRecipe(recipe, userId);
    } else {
      await saveRecipes(updated);
    }
  }, [recipes, userId]);

  const handleAddShoppingList = useCallback(async (listData: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const list: ShoppingList = { ...listData, id: generateId(), createdAt: new Date().toISOString() };
    setShoppingLists(prev => [list, ...prev]);
    try {
      const updated = await addShoppingList(list, userId);
      setShoppingLists(updated);
    } catch (e) {
      console.error('[KitchenContext] addShoppingList failed, keeping local:', e);
    }
  }, [userId]);

  const handleUpdateShoppingList = useCallback(async (list: ShoppingList) => {
    setShoppingLists(prev => prev.map(l => l.id === list.id ? list : l));
    try {
      const updated = await updateShoppingList(list, userId);
      setShoppingLists(updated);
    } catch (e) {
      console.error('[KitchenContext] updateShoppingList failed:', e);
    }
  }, [userId]);

  const handleDeleteShoppingList = useCallback(async (id: string) => {
    setShoppingLists(prev => prev.filter(l => l.id !== id));
    try {
      const updated = await deleteShoppingList(id, userId);
      setShoppingLists(updated);
    } catch (e) {
      console.error('[KitchenContext] deleteShoppingList failed:', e);
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
    try {
      const updated = await addPlaylist(pl, userId);
      setPlaylists(updated);
    } catch (e) {
      console.error('[KitchenContext] addPlaylist failed, keeping local:', e);
    }
  }, [userId]);

  const handleUpdatePlaylist = useCallback(async (pl: RecipePlaylist) => {
    setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
    try {
      const updated = await updatePlaylist(pl, userId);
      setPlaylists(updated);
    } catch (e) {
      console.error('[KitchenContext] updatePlaylist failed:', e);
    }
  }, [userId]);

  const handleDeletePlaylist = useCallback(async (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    try {
      const updated = await deletePlaylist(id, userId);
      setPlaylists(updated);
    } catch (e) {
      console.error('[KitchenContext] deletePlaylist failed:', e);
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
    }}>
      {children}
    </KitchenContext.Provider>
  );
}
