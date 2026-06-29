import { getRotation, getCategories, getCollectiblePresence, getRotationFreshness } from "@/lib/data";
import { StoreView } from "@/components/StoreView";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [rotation, categories, hasCollectible, updatedAt] = await Promise.all([
    getRotation(),
    getCategories(),
    getCollectiblePresence(),
    getRotationFreshness(),
  ]);
  return (
    <StoreView
      rotation={rotation}
      categories={categories}
      hasCollectible={hasCollectible}
      stale={{ updatedAt }}
    />
  );
}
