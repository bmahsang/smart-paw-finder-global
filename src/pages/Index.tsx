import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroBanner } from "@/components/home/HeroBanner";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { CategoryNav } from "@/components/shop/CategoryNav";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionsParam = searchParams.get("collections");  // e.g. "ssfw,toy"
  const multiCollections = collectionsParam ? collectionsParam.split(",") : null;
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

  const handleSearch = (query: string) => {
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  };

  const handleCollectionSelect = (handle: string | null) => {
    if (handle) {
      setSearchParams({ collection: handle });
    } else {
      setSearchParams({});
    }
  };

  const handleMultiCollectionSelect = (handles: string[], title: string) => {
    setSearchParams({ collections: handles.join(","), collectionTitle: title });
  };

  const showHeroBanner = !searchQuery && !selectedCollection && !collectionsParam;

  return (
    <div className="bg-background min-h-screen overflow-x-hidden overflow-y-auto">
      <Header
        onSearch={handleSearch}
        onCollectionSelect={handleCollectionSelect}
        onMultiCollectionSelect={handleMultiCollectionSelect}
      />
      {(selectedCollection || searchQuery) && (
        <CategoryNav selectedCollection={selectedCollection} onSelect={handleCollectionSelect} />
      )}
      {showHeroBanner && (
        <div className="max-w-7xl mx-auto">
          <HeroBanner />
        </div>
      )}
      <main className="max-w-7xl mx-auto pb-20">
        <ProductGrid
          searchQuery={searchQuery}
          collectionHandle={selectedCollection}
          multiCollections={multiCollections}
          overrideTitle={collectionTitle}
        />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
