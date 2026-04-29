import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { extractHandleFromUrl } from '@/lib/shopify';
import { useCategoryMenu } from '@/hooks/useCategoryMenu';

interface CategoryNavProps {
  selectedCollection: string | null;
  onSelect: (handle: string | null) => void;
}

export function CategoryNav({ selectedCollection, onSelect }: CategoryNavProps) {
  const { menu, collections } = useCategoryMenu();
  const topRef = useRef<HTMLDivElement>(null);

  const topItems = menu
    ? menu.items.filter(
        item => item.type === 'COLLECTION' || item.url.includes('/collections/')
      )
    : collections
        .filter(c => c.handle !== 'frontpage')
        .map(c => ({
          id: c.id,
          title: c.title,
          url: `https://placeholder/collections/${c.handle}`,
          type: 'COLLECTION',
          items: [],
        }));

  if (topItems.length === 0) return null;

  return (
    <div className="bg-background border-b border-border">
      <div
        ref={topRef}
        className="max-w-7xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2"
      >
        <button
          onClick={() => onSelect(null)}
          className={cn(
            'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
            !selectedCollection
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          )}
        >
          ALL
        </button>

        {topItems.map(item => {
          const handle = extractHandleFromUrl(item.url);
          const isActive = handle === selectedCollection;

          return (
            <button
              key={item.id}
              onClick={() => handle && onSelect(handle)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              )}
            >
              {item.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
