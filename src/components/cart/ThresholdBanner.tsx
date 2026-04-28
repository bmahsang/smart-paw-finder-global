import { Truck, PartyPopper } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore, B2B_DISCOUNT_RATE } from "@/stores/authStore";
import { formatPrice } from "@/lib/shopify";

const THRESHOLD = 150;

export function ThresholdBanner() {
  const items = useCartStore(state => state.items);
  const isB2B = useAuthStore(state => state.isB2B);

  if (items.length === 0) return null;

  const rawTotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const total = isB2B ? rawTotal * (1 - B2B_DISCOUNT_RATE) : rawTotal;
  const currencyCode = items[0]?.price.currencyCode || "USD";
  const progress = Math.min((total / THRESHOLD) * 100, 100);
  const remaining = THRESHOLD - total;
  const qualifies = total >= THRESHOLD;

  return (
    <div className={`rounded-xl p-4 mb-4 ${qualifies ? 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800'}`}>
      <div className="flex items-center gap-2 mb-2">
        {qualifies ? (
          <PartyPopper className="h-4 w-4 text-green-600 flex-shrink-0" />
        ) : (
          <Truck className="h-4 w-4 text-amber-600 flex-shrink-0" />
        )}
        {qualifies ? (
          <span className="text-sm font-bold text-green-600">
            $10 Flat Rate Shipping Unlocked!
          </span>
        ) : (
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Add <span className="text-primary font-bold">{formatPrice(remaining.toFixed(2), currencyCode)}</span> more for <span className="font-bold">$10 shipping!</span>
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${qualifies ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">
          {formatPrice(total.toFixed(2), currencyCode)}
        </span>
        <span className="text-[11px] text-muted-foreground font-medium">
          {formatPrice(THRESHOLD.toString(), currencyCode)}
        </span>
      </div>
    </div>
  );
}
