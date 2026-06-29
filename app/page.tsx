import { getRotation, getCollectiblePresence, getRotationFreshness } from "@/lib/data";
import { StoreView } from "@/components/StoreView";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [rotation, hasCollectible, updatedAt] = await Promise.all([
    getRotation(),
    getCollectiblePresence(),
    getRotationFreshness(),
  ]);
  return (
    <StoreView
      rotation={rotation}
      hasCollectible={hasCollectible}
      stale={{ updatedAt }}
    />
  );
}
