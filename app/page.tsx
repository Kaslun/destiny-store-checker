import { getRotation, getCollectiblePresence, getRotationFreshness } from "@/lib/data";
import { StoreView } from "@/components/StoreView";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [{ items, previousDate }, hasCollectible, updatedAt] = await Promise.all([
    getRotation(),
    getCollectiblePresence(),
    getRotationFreshness(),
  ]);
  return (
    <StoreView
      rotation={items}
      hasCollectible={hasCollectible}
      stale={{ updatedAt }}
      previousDate={previousDate}
    />
  );
}
