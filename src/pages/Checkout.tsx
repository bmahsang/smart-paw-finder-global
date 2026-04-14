import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Truck, CreditCard, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice, fetchShippingRates, fetchCustomerData, ShippingRate } from '@/lib/shopify';
import { toast } from 'sonner';

interface ShippingForm {
  email: string;
  lastName: string;
  firstName: string;
  zip: string;
  province: string;
  city: string;
  address1: string;
  address2: string;
  phone: string;
  country: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, isLoading, createCheckout } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<ShippingForm>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('checkout-shipping') || '{}');
      return {
        email: user?.email || user?.shopifyEmail || saved.email || '',
        lastName: saved.lastName || '',
        firstName: saved.firstName || '',
        zip: saved.zip || '',
        province: saved.province || '',
        city: saved.city || '',
        address1: saved.address1 || '',
        address2: saved.address2 || '',
        phone: saved.phone || '',
        country: saved.country || '',
      };
    } catch {
      return { email: user?.email || user?.shopifyEmail || '', lastName: '', firstName: '', zip: '', province: '', city: '', address1: '', address2: '', phone: '', country: '' };
    }
  });

  useEffect(() => {
    fetchShippingRates('US')
      .then((rates) => { if (rates.length > 0) setShippingRate(rates[0]); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!user?.shopifyCustomerToken) return;
    fetchCustomerData(user.shopifyCustomerToken).then((data) => {
      if (!data) return;
      const addr = data.defaultAddress;
      setForm((prev) => ({
        email: data.email || prev.email || '',
        lastName: data.lastName || prev.lastName || '',
        firstName: data.firstName || prev.firstName || '',
        zip: addr?.zip || prev.zip || '',
        province: addr?.province || prev.province || '',
        city: addr?.city || prev.city || '',
        address1: addr?.address1 || prev.address1 || '',
        address2: prev.address2 || '',
        phone: data.phone || prev.phone || '',
        country: addr?.country || prev.country || '',
      }));
    }).catch(console.error);
  }, [user?.shopifyCustomerToken]);

  useEffect(() => {
    if (items.length === 0) navigate('/');
  }, [items.length, navigate]);

  const updateField = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0);
  const shipping = shippingRate ? parseFloat(shippingRate.amount) : 0;
  const total = subtotal + shipping;
  const currencyCode = items[0]?.price.currencyCode || 'USD';

  const isFormValid = form.email && form.lastName && form.zip && form.city && form.address1 && form.country;

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    try { localStorage.setItem('checkout-shipping', JSON.stringify(form)); } catch { /* ignore */ }
    try {
      const lineItems = items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      const checkoutUrl = await createCheckout(lineItems);
      if (checkoutUrl) {
        const url = new URL(checkoutUrl);
        url.searchParams.set('checkout[email]', form.email);
        url.searchParams.set('checkout[shipping_address][last_name]', form.lastName);
        url.searchParams.set('checkout[shipping_address][first_name]', form.firstName);
        url.searchParams.set('checkout[shipping_address][zip]', form.zip);
        url.searchParams.set('checkout[shipping_address][province]', form.province);
        url.searchParams.set('checkout[shipping_address][city]', form.city);
        url.searchParams.set('checkout[shipping_address][address1]', form.address1);
        url.searchParams.set('checkout[shipping_address][address2]', form.address2);
        url.searchParams.set('checkout[shipping_address][phone]', form.phone);
        url.searchParams.set('checkout[shipping_address][country]', form.country);
        window.location.href = url.toString();
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
          <h1 className="flex-1 text-center font-semibold">Shipping Information</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Order Summary */}
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
                <span className="text-sm font-semibold" translate="no">
                  {formatPrice((parseFloat(item.price.amount) * item.quantity).toString(), item.price.currencyCode)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span translate="no">{formatPrice(subtotal.toString(), currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />Shipping
              </span>
              <span translate="no">{shipping > 0 ? formatPrice(shipping.toString(), currencyCode) : 'Free'}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span translate="no">{formatPrice(total.toString(), currencyCode)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Form */}
        <form autoComplete="on" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Shipping Address
          </h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email" name="email" type="email" value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="given-name" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} placeholder="John" autoComplete="given-name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="lastName" name="family-name" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Smith" autoComplete="family-name" />
              </div>
            </div>

            <div>
              <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
              <Input id="country" name="country" value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="United States" autoComplete="country-name" />
            </div>

            <div>
              <Label htmlFor="address1">Address Line 1 <span className="text-destructive">*</span></Label>
              <Input id="address1" name="address-line1" value={form.address1} onChange={(e) => updateField('address1', e.target.value)} placeholder="123 Main St" autoComplete="address-line1" />
            </div>

            <div>
              <Label htmlFor="address2">Address Line 2</Label>
              <Input id="address2" name="address-line2" value={form.address2} onChange={(e) => updateField('address2', e.target.value)} placeholder="Apt, Suite, etc." autoComplete="address-line2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                <Input id="city" name="address-level2" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="New York" autoComplete="address-level2" />
              </div>
              <div>
                <Label htmlFor="province">State / Province</Label>
                <Input id="province" name="address-level1" value={form.province} onChange={(e) => updateField('province', e.target.value)} placeholder="NY" autoComplete="address-level1" />
              </div>
            </div>

            <div>
              <Label htmlFor="zip">Postal Code <span className="text-destructive">*</span></Label>
              <Input
                id="zip" name="postal-code" value={form.zip}
                onChange={(e) => updateField('zip', e.target.value)}
                placeholder="10001"
                className="flex-1"
                autoComplete="postal-code"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="tel" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" />
            </div>
          </div>
        </form>
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting || isLoading}
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
