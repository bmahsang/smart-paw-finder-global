import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Heart, Package } from 'lucide-react';
import { fetchProductByHandle, formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore, GUEST_FAVORITES_KEY } from '@/stores/favoritesStore';
import { PriceTag } from '@/components/ui/PriceTag';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const { getFavorites, removeFavorite } = useFavoritesStore();
  const favoritesData = useFavoritesStore((s) => s.favorites);
  const favoritesKey = authUser?.userId || GUEST_FAVORITES_KEY;

  const [products, setProducts] = useState<Array<{ handle: string; title: string; image?: string; price: string; currencyCode: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!favoritesKey) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const handles = getFavorites(favoritesKey);
    if (handles.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(handles.map((h) => fetchProductByHandle(h).catch(() => null)))
      .then((results) => {
        setProducts(
          results.filter(Boolean).map((p: any) => ({
            handle: p.handle,
            title: p.title,
            image: p.images.edges[0]?.node.url,
            price: p.priceRange.minVariantPrice.amount,
            currencyCode: p.priceRange.minVariantPrice.currencyCode,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [favoritesKey, favoritesData, getFavorites]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <header className="sticky top-[57px] z-40 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex items-center px-4 h-12">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-sm">Favorites</h1>
          <div className="w-9" />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-3 pb-24">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No favorites yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap the heart on a product to save it</p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.handle}
              className="bg-card rounded-xl border border-border p-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => navigate(`/product/${product.handle}`)}
            >
              {product.image ? (
                <img src={product.image} alt={product.title} className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.title}</p>
                <div className="mt-1">
                  <PriceTag amount={product.price} currencyCode={product.currencyCode} className="text-sm font-bold text-primary" originalClassName="text-xs" />
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFavorite(favoritesKey, product.handle);
                }}
                className="p-2 hover:bg-secondary rounded-full"
              >
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
