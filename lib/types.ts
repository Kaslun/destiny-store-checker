export type CurrencyType = "silver" | "bright_dust" | "other";

export type CatalogItem = {
  itemHash: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  screenshotUrl: string | null;
  itemType: string | null;
  itemSubtype: string | null;
  collectibleHash: number | null;
  isEververse: boolean;
  typicalCurrency: string | null;
  previewItemHashes: number[] | null;
};

export type RotationItem = {
  itemHash: number;
  name: string;
  iconUrl: string | null;
  currencyType: CurrencyType;
  costAmount: number | null;
  saleStatus: string;
  itemType: string | null;
  categoryId: string | null;
  resetAt: string | null;
};

export type Category = { id: string; parentId: string | null; name: string; sortOrder: number };

export type Overlay = {
  ownedHashes: Set<number>;
  missingHashes: Set<number>;
  brightDust: number;
  wishlistHashes: Set<number>;
};
