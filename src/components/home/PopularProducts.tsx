import { ChevronRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: number;
  image: string;
  badge?: string;
  title: string;
  price: number;
  rating: number;
  reviews: number;
}

const popularProducts: Product[] = [
  {
    id: 1,
    image: "🥗",
    badge: "BEST",
    title: "Fresh Cooked Meals - Variety Pack (20 Pouches)",
    price: 89.99,
    rating: 4.9,
    reviews: 2341,
  },
  {
    id: 2,
    image: "🍲",
    badge: "NEW",
    title: "Natural Recipe Fresh Food - Starter Pack (10 Pouches)",
    price: 49.99,
    rating: 4.8,
    reviews: 1892,
  },
  {
    id: 3,
    image: "🥩",
    badge: "SALE",
    title: "Grain-Free Premium Kibble - Beef & Sweet Potato 5lb",
    price: 34.99,
    rating: 4.7,
    reviews: 1245,
  },
  {
    id: 4,
    image: "🍖",
    badge: "TOP",
    title: "Fresh Kitchen Natural Diet - Multi-Protein 2.2lb",
    price: 59.99,
    rating: 4.9,
    reviews: 3421,
  },
];

export function PopularProducts() {
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const formatReviews = (reviews: number) => {
    return new Intl.NumberFormat("en-US").format(reviews);
  };

  return (
    <section className="mt-6 pb-24 animate-fade-up" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">Popular Products</h2>
        <button className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Shop All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        {popularProducts.map((product) => (
          <div
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-card transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="aspect-square bg-secondary flex items-center justify-center text-4xl relative">
              {product.image}
              {product.badge && (
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {product.badge}
                </span>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-xs font-medium text-foreground line-clamp-2 mb-2 min-h-[32px]">
                {product.title}
              </h3>
              <p className="text-sm font-bold text-foreground">
                {formatPrice(product.price)}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="text-[11px] font-medium text-foreground">{product.rating}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({formatReviews(product.reviews)})
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
