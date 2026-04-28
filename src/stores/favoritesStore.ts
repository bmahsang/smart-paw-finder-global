import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const GUEST_FAVORITES_KEY = '__guest__';

interface FavoritesStore {
  favorites: Record<string, string[]>;

  addFavorite: (userId: string, productHandle: string) => void;
  removeFavorite: (userId: string, productHandle: string) => void;
  isFavorite: (userId: string, productHandle: string) => boolean;
  getFavorites: (userId: string) => string[];
  mergeGuestToUser: (userId: string) => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: {},

      addFavorite: (userId, productHandle) =>
        set((state) => {
          const current = state.favorites[userId] || [];
          if (current.includes(productHandle)) return state;
          return {
            favorites: { ...state.favorites, [userId]: [...current, productHandle] },
          };
        }),

      removeFavorite: (userId, productHandle) =>
        set((state) => {
          const current = state.favorites[userId] || [];
          return {
            favorites: { ...state.favorites, [userId]: current.filter((h) => h !== productHandle) },
          };
        }),

      isFavorite: (userId, productHandle) => {
        const current = get().favorites[userId] || [];
        return current.includes(productHandle);
      },

      getFavorites: (userId) => get().favorites[userId] || [],

      mergeGuestToUser: (userId) =>
        set((state) => {
          const guest = state.favorites[GUEST_FAVORITES_KEY] || [];
          if (guest.length === 0) return state;
          const current = state.favorites[userId] || [];
          const merged = Array.from(new Set([...current, ...guest]));
          const { [GUEST_FAVORITES_KEY]: _, ...rest } = state.favorites;
          return { favorites: { ...rest, [userId]: merged } };
        }),
    }),
    {
      name: 'shopify-favorites',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
