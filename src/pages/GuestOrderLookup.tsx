import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Loader2, Package, Truck, ExternalLink, CreditCard, ChevronLeft,
} from 'lucide-react';
import { formatPrice } from '@/lib/shopify';
import { toast } from 'sonner';

interface GuestOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: { amount: string; currencyCode: string };
  statusPageUrl: string | null;
  shippingAddress: { city?: string | null; province?: string | null; country?: string | null } | null;
  fulfillments: Array<{ trackingCompany: string | null; trackingNumber: string | null; trackingUrl: string | null }>;
  lineItems: Array<{ title: string; quantity: number; image: { url: string } | null }>;
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

function GuestOrderCard({ order }: { order: GuestOrder }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(order.processedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const firstTracking = order.fulfillments[0];

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
        </div>
      )}
    </div>
  );
}

export default function GuestOrderLookupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<GuestOrder[] | null>(null);

  const handleLookup = async () => {
    if (!email.trim() || !orderNumber.trim()) {
      toast.error('Please enter both email and order number.', { position: 'top-center' });
      return;
    }
    setLoading(true);
    setOrders(null);
    try {
      const res = await fetch('/api/guest-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), orderNumber: orderNumber.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Order not found.', { position: 'top-center' });
        return;
      }
      setOrders(data.orders);
    } catch {
      toast.error('Failed to look up order. Please try again.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-md mx-auto px-4 py-6 space-y-5 pb-24">
        <button
          onClick={() => navigate('/mypage')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to My Page
        </button>

        <div className="text-center mb-2">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold mb-1">Guest Order Lookup</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email and order number<br />from your confirmation email.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
          <Input
            type="text"
            placeholder="Order number (e.g. #1001)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="h-11"
          />
          <Button onClick={handleLookup} disabled={loading} className="w-full h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Look Up Order
          </Button>
        </div>

        {orders && orders.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">Order Found</h3>
            {orders.map((order) => (
              <GuestOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {orders && orders.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No orders found</p>
          </div>
        )}
      </main>
    </div>
  );
}
