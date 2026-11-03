export interface AssetTypeRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  isCustom: boolean;
}

export interface NewAssetType {
  name: string;
  category: string;
  description: string;
}
