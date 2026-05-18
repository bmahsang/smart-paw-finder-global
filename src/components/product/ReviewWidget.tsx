import { useState, useEffect, useCallback } from 'react';
import { Star, Play, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  name: string;
  content: string;
  content_en?: string;
  date: string;
  images: string[];
  videos?: string[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface MediaItem {
  type: 'image' | 'video';
  src: string;
}

function MediaLightbox({ items, initialIndex, onClose }: { items: MediaItem[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index];

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : items.length - 1)), [items.length]);
  const next = useCallback(() => setIndex(i => (i < items.length - 1 ? i + 1 : 0)), [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-lg w-full max-h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {item.type === 'video' ? (
          <video
            key={item.src}
            src={item.src}
            className="max-w-full max-h-[75vh] rounded-xl"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img src={item.src} alt="" className="max-w-full max-h-[75vh] rounded-xl object-contain" />
        )}

        <button onClick={onClose} className="absolute -top-2 -right-2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80 transition-colors">
          <X className="h-5 w-5" />
        </button>

        {items.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80 transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {index + 1} / {items.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PER_PAGE = 5;

export function ReviewWidget({ productNumericId, onCount }: { productNumericId: string; onCount?: (n: number) => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lightbox, setLightbox] = useState<{ items: MediaItem[]; index: number } | null>(null);

  useEffect(() => {
    if (!productNumericId) return;
    fetch(`/api/kr-reviews?shopify_product_id=${productNumericId}`)
      .then(r => r.ok ? r.json() : { reviews: [] })
      .then(data => {
        const list = (data.reviews || []).slice().sort((a: Review, b: Review) => b.rating - a.rating);
        setReviews(list);
        onCount?.(list.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productNumericId]);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const totalPages = Math.ceil(reviews.length / PER_PAGE);
  const paged = reviews.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) return <div className="h-24 animate-pulse bg-secondary rounded-xl" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Customer Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <StarRating rating={Math.round(avgRating)} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} / 5 ({reviews.length} reviews)
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No reviews yet
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paged.map((r) => (
              <div key={r.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <StarRating rating={r.rating} />
                  <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>
                </div>
                {(r.content_en || r.content) && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{r.content_en || r.content}</p>
                )}
                {(r.images.length > 0 || (r.videos && r.videos.length > 0)) && (() => {
                  const media: MediaItem[] = [
                    ...(r.videos || []).map(src => ({ type: 'video' as const, src })),
                    ...r.images.map(src => ({ type: 'image' as const, src })),
                  ];
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {media.map((m, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox({ items: media, index: i })}
                          className="relative h-20 w-20 rounded-lg border border-border overflow-hidden bg-black"
                        >
                          {m.type === 'video' ? (
                            <>
                              <video src={m.src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="bg-white/90 rounded-full p-1.5 shadow-md">
                                  <Play className="h-4 w-4 text-black fill-black" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img src={m.src} alt="" className="h-full w-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2 flex-wrap">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-lg border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-lg border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
              >
                ‹
              </button>
              {(() => {
                const groupStart = Math.floor((page - 1) / 5) * 5 + 1;
                const groupEnd = Math.min(totalPages, groupStart + 4);
                return Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                      n === page
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {n}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-border disabled:opacity-30 hover:bg-secondary transition-colors"
              >
                »
              </button>
            </div>
          )}
        </>
      )}

      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
