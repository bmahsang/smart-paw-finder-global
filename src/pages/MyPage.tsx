import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LogOut, User, ShoppingBag, Heart, HelpCircle, ChevronRight,
  Package, Truck, ExternalLink, MapPin, Calendar, CreditCard, XCircle, Loader2, Search,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { fetchProductByHandle, formatPrice } from '@/lib/shopify';
import { initiateLogin, isLoggedIn as isCustomerLoggedIn, logout as customerLogout } from '@/lib/customer-auth';
import { fetchCustomerAccount, cancelCustomerOrder, CustomerAccountProfile, CustomerAccountOrder } from '@/lib/customer-account';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { useFavoritesStore } from '@/stores/favoritesStore';

function MenuLink({ icon: Icon, label, badge, onClick }: {
  icon: typeof ShoppingBag; label: string; badge?: string | number; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function AuthScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await initiateLogin('/mypage');
    } catch {
      toast.error('Failed to start login. Please try again.', { position: 'top-center' });
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <User className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold mb-2">My Page</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Sign in to view your orders<br />and manage your account.
      </p>
      <div className="w-full space-y-3">
        <Button onClick={handleLogin} disabled={loading} className="w-full h-12 text-base font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue with Shopify
        </Button>
      </div>
      <div className="w-full mt-4 pt-4 border-t border-border space-y-3">
        <Button onClick={() => navigate('/')} variant="ghost" className="w-full h-12 text-base text-muted-foreground">
          Continue as Guest
        </Button>
        <Button onClick={() => navigate('/guest-order')} variant="outline" className="w-full h-12 text-base">
          <Search className="h-4 w-4 mr-2" />
          Guest Order Lookup
        </Button>
      </div>
    </main>
  );
}

function StatusBadge({ status, type }: { status: string; type: 'financial' | 'fulfillment' }) {
  const map: Record<string, { label: string; cls: string }> = type === 'financial' ? {
    PAID: { label: 'Paid', cls: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
    REFUNDED: { label: 'Refunded', cls: 'bg-gray-100 text-gray-600' },
    PARTIALLY_REFUNDED: { label: 'Partial Refund', cls: 'bg-gray-100 text-gray-600' },
    AUTHORIZED: { label: 'Authorized', cls: 'bg-blue-100 text-blue-700' },
    VOIDED: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  } : {
    FULFILLED: { label: 'Shipped', cls: 'bg-green-100 text-green-700' },
    UNFULFILLED: { label: 'Pending', cls: 'bg-orange-100 text-orange-700' },
    PARTIALLY_FULFILLED: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-700' },
  };
  const info = map[status] || { label: status || 'Pending', cls: 'bg-orange-100 text-orange-700' };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>;
}

function OrderCard({ order, onCancelled }: {
  order: CustomerAccountOrder;
  onCancelled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const date = new Date(order.processedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const isCancellable =
    order.financialStatus === 'PAID' &&
    (!order.fulfillmentStatus || order.fulfillmentStatus === 'UNFULFILLED');

  const firstTracking = order.fulfillments[0];

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const result = await cancelCustomerOrder(order.id);
      if (result.success) {
        toast.success('Order cancelled successfully. A refund has been initiated.', { position: 'top-center' });
        onCancelled();
      } else {
        toast.error(result.error || 'Failed to cancel order.', { position: 'top-center' });
      }
    } catch {
      toast.error('Failed to cancel order. Please try again.', { position: 'top-center' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{order.name}</span>
            <StatusBadge status={order.financialStatus} type="financial" />
            <StatusBadge status={order.fulfillmentStatus} type="fulfillment" />
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{date}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{order.lineItems.length} items</span>
          <span className="text-sm font-bold" translate="no">{formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {order.lineItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.image?.url ? (
                <img src={item.image.url} alt={item.title} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">x{item.quantity}</p>
              </div>
            </div>
          ))}

          {firstTracking?.trackingUrl && (
            <a
              href={firstTracking.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Truck className="h-4 w-4" />
              Track Shipment
              {firstTracking.trackingCompany && (
                <span className="text-xs text-muted-foreground">({firstTracking.trackingCompany})</span>
              )}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {order.statusPageUrl && (
            <a
              href={order.statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <CreditCard className="h-4 w-4" />
              Order Details
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {isCancellable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={cancelling}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors disabled:opacity-50"
                >
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Order {order.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your order and initiate a full refund of{' '}
                    <span className="font-semibold text-foreground">
                      {formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}
                    </span>.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Order</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Cancel Order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(() => isCustomerLoggedIn());
  const [customerData, setCustomerData] = useState<CustomerAccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'favorites' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [favoriteProducts, setFavoriteProducts] = useState<Array<{ handle: string; title: string; image?: string; price: string; currencyCode: string }>>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const { getFavorites, removeFavorite } = useFavoritesStore();

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCustomerAccount()
      .then((data) => {
        if (!data) {
          setLoggedIn(false);
          setCustomerData(null);
        } else {
          setCustomerData(data);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load account. Please sign in again.', { position: 'top-center' });
      })
      .finally(() => setLoading(false));
  }, [loggedIn, refreshKey]);

  const authUser = useAuthStore((s) => s.user);
  const favoritesKey = authUser?.userId || customerData?.emailAddress || customerData?.id || '';

  useEffect(() => {
    if (!favoritesKey || activeTab !== 'favorites') return;
    const handles = getFavorites(favoritesKey);
    if (handles.length === 0) { setFavoriteProducts([]); return; }

    setFavoritesLoading(true);
    Promise.all(handles.map((h) => fetchProductByHandle(h).catch(() => null)))
      .then((products) => {
        setFavoriteProducts(
          products.filter(Boolean).map((p: any) => ({
            handle: p.handle, title: p.title,
            image: p.images.edges[0]?.node.url,
            price: p.priceRange.minVariantPrice.amount,
            currencyCode: p.priceRange.minVariantPrice.currencyCode,
          }))
        );
      })
      .finally(() => setFavoritesLoading(false));
  }, [favoritesKey, activeTab, getFavorites]);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    customerLogout();
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AuthScreen />
      </div>
    );
  }

  const orders = customerData?.orders || [];
  const favCount = favoritesKey ? getFavorites(favoritesKey).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-md mx-auto px-4 py-6 space-y-4 pb-24">

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center ring-2 ring-border">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">
                {customerData?.displayName || 'Customer'}
              </h2>
              {customerData?.emailAddress && (
                <p className="text-xs text-muted-foreground truncate">{customerData.emailAddress}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {customerData && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" />{orders.length} orders
                  </span>
                )}
              </div>
            </div>
          </div>

          {customerData?.defaultAddress && (
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {[customerData.defaultAddress.zip, customerData.defaultAddress.province, customerData.defaultAddress.city, customerData.defaultAddress.address1]
                  .filter(Boolean).join(' ')}
              </p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border divide-y divide-border px-4">
          <MenuLink
            icon={ShoppingBag}
            label="Order History"
            badge={orders.length > 0 ? orders.length : undefined}
            onClick={() => setActiveTab(activeTab === 'orders' ? null : 'orders')}
          />
          <MenuLink
            icon={Heart}
            label="Favorites"
            badge={favCount > 0 ? favCount : undefined}
            onClick={() => setActiveTab(activeTab === 'favorites' ? null : 'favorites')}
          />
          <MenuLink icon={HelpCircle} label="Contact Us" onClick={() => navigate('/contact')} />
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">Order History</h3>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onCancelled={() => setRefreshKey((k) => k + 1)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">Favorites</h3>
            {favoritesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : favoriteProducts.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No favorites yet</p>
                <p className="text-xs text-muted-foreground mt-1">Tap the heart on a product to save it</p>
              </div>
            ) : (
              favoriteProducts.map((product) => (
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
                    <p className="text-sm font-bold text-primary mt-1" translate="no">
                      {formatPrice(product.price, product.currencyCode)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (favoritesKey) {
                        removeFavorite(favoritesKey, product.handle);
                        setFavoriteProducts((prev) => prev.filter((p) => p.handle !== product.handle));
                      }
                    }}
                    className="p-2 hover:bg-secondary rounded-full"
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <Button variant="outline" onClick={handleLogout} className="w-full h-12">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </main>
    </div>
  );
}
