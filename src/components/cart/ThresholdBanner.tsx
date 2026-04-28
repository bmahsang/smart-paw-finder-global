import { useState, useEffect } from "react";
import { Truck } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useTranslation } from "@/hooks/useTranslation";
import { fetchShippingRates, ShippingRate } from "@/lib/shopify";

export function ThresholdBanner() {
  const items = useCartStore(state => state.items);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);
  const { formatPrice } = useTranslation();

  useEffect(() => {
    fetchShippingRates("US")
      .then((rates) => {
        if (rates.length > 0) {
          setShippingRate(rates[0]);
        }
      })
      .catch(console.error);
  }, []);

  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const currencyCode = items[0]?.price.currencyCode || "USD";

  // If no shipping rate fetched yet, show nothing
  if (!shippingRate) return null;

  const shippingCost = parseFloat(shippingRate.amount);
  const isFreeShipping = shippingCost === 0;

  const THRESHOLD = 150;
  const remaining = THRESHOLD - total;
  const qualifies = total >= THRESHOLD;

  return (
    <div className={`border rounded-lg p-3 mb-4 ${qualifies ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
      <div className="flex items-center gap-2">
        <Truck className={`h-4 w-4 flex-shrink-0 ${qualifies ? 'text-green-600' : 'text-amber-600'}`} />
        {qualifies ? (
          <span className="text-sm font-semibold text-green-600">
            $10 Flat Rate Shipping Unlocked!
          </span>
        ) : (
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Add <strong>{formatPrice(remaining.toFixed(2), currencyCode)}</strong> more for <strong>$10 flat rate shipping!</strong>
          </span>
        )}
      </div>
    </div>
  );
}
