import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Truck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice, fetchShippingRates, ShippingRate } from '@/lib/shopify';
import { B2B_DISCOUNT_RATE } from '@/stores/authStore';
import { toast } from 'sonner';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, isLoading, createCheckout } = useCartStore();
  const isB2B = useAuthStore((s) => s.isB2B);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchShippingRates('US')
      .then((rates) => { if (rates.length > 0) setShippingRate(rates[0]); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (items.length === 0) navigate('/');
  }, [items.length, navigate]);

  const rawSubtotal = items.reduce((sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0);
  const subtotal = isB2B ? rawSubtotal * (1 - B2B_DISCOUNT_RATE) : rawSubtotal;
  const shipping = shippingRate ? parseFloat(shippingRate.amount) : 0;
  const total = subtotal + shipping;
  const currencyCode = items[0]?.price.currencyCode || 'USD';

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const lineItems = items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      const checkoutUrl = await createCheckout(lineItems);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to proceed to checkout. Please try again.', { position: 'top-center' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold">Order Summary</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Order Summary
          </h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.variantId} className="flex items-center gap-3">
                {item.product.node.images?.edges?.[0]?.node && (
                  <img
                    src={item.product.node.images.edges[0].node.url}
                    alt={item.product.node.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.product.node.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantTitle !== 'Default Title' && item.selectedOptions.map((o) => o.value).join(' / ')}
                    {' '}x{item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-right" translate="no">
                  {(() => {
                    const lineTotal = parseFloat(item.price.amount) * item.quantity;
                    if (isB2B) {
                      return (
                        <span className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground line-through">{formatPrice(lineTotal.toString(), item.price.currencyCode)}</span>
                          <span>{formatPrice((lineTotal * (1 - B2B_DISCOUNT_RATE)).toFixed(2), item.price.currencyCode)}</span>
                        </span>
                      );
                    }
                    return formatPrice(lineTotal.toString(), item.price.currencyCode);
                  })()}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span translate="no">
                {isB2B ? (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground line-through">{formatPrice(rawSubtotal.toString(), currencyCode)}</span>
                    <span>{formatPrice(subtotal.toString(), currencyCode)}</span>
                  </span>
                ) : formatPrice(subtotal.toString(), currencyCode)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />Shipping
              </span>
              <span translate="no">{shipping > 0 ? formatPrice(shipping.toString(), currencyCode) : 'Free'}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span translate="no">
                {isB2B ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground line-through">{formatPrice((rawSubtotal + shipping).toString(), currencyCode)}</span>
                    <span>{formatPrice(total.toString(), currencyCode)}</span>
                  </span>
                ) : formatPrice(total.toString(), currencyCode)}
              </span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Proceed to Payment — {formatPrice(total.toString(), currencyCode)}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
