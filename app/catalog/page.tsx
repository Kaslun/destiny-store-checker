import { getCatalog, getCategories, getItemCategories } from "@/lib/data";
import { CatalogView } from "@/components/CatalogView";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [items, categories, itemCategories] = await Promise.all([
    getCatalog(),
    getCategories(),
    getItemCategories(),
  ]);
  return <CatalogView items={items} categories={categories} itemCategories={itemCategories} />;
}
