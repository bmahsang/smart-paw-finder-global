import { formatPrice } from '@/lib/shopify';
import { useAuthStore, B2B_DISCOUNT_RATE } from '@/stores/authStore';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  className?: string;
  originalClassName?: string;
}

export function PriceTag({ amount, currencyCode, className = '', originalClassName = '' }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);

  if (!isB2B) {
    return <span className={className} translate="no">{formatPrice(amount, currencyCode)}</span>;
  }

  const discounted = (parseFloat(amount) * (1 - B2B_DISCOUNT_RATE)).toFixed(2);

  const discountPercent = Math.round(B2B_DISCOUNT_RATE * 100);

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
        {formatPrice(amount, currencyCode)}
      </span>
      <span className={className} translate="no">
        {formatPrice(discounted, currencyCode)}
      </span>
      <span className="inline-flex items-center rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
        -{discountPercent}%
      </span>
    </span>
  );
}

export function getB2BPrice(amount: string): string {
  return (parseFloat(amount) * (1 - B2B_DISCOUNT_RATE)).toFixed(2);
}
