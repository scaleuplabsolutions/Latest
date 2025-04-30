export const getDaysUntilExpiry = (expiryDate: string): number => {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

export const getExpiryStatus = (daysUntilExpiry: number | string): 'expired' | 'expiring-soon' | 'short-dated' | 'good' => {
  const days = typeof daysUntilExpiry === 'string' 
    ? parseInt(daysUntilExpiry, 10) 
    : daysUntilExpiry;
  
  if (days < 0) {
    return 'expired';
  } else if (days <= 7) {
    return 'short-dated';
  } else if (days <= 14) {
    return 'expiring-soon';
  } else {
    return 'good';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'expiring-soon':
      return 'bg-amber-100 text-amber-800';
    case 'short-dated':
      return 'bg-orange-100 text-orange-800';
    case 'good':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export interface ExpiryItem {
  id: number;
  upc: string;
  description: string;
  supplier?: string;
  batchNumber: string;
  remainingQty?: number;
  receivingDate: string;
  expiryDate: string;
  daysLeft: number;
  status: string;
  container?: string;
  itemNumber?: string;
  qtyReceived?: number;
  lastUpdated?: string;
}

export interface InventoryItem {
  upc: string;
  venCode?: string;
  description: string;
  size?: string;
  wh2qty?: number;
  rvsbondqty?: number;
  sdeptName?: string;
  vendorId?: string;
  storeQty?: number;
  hostQty?: number;
  cost?: string;
  price?: string;
  grossMargin?: string;
}

export interface ContainerItem {
  container: string;
  supplier?: string;
  upc: string;
  description: string;
  itemNumber?: string;
  receivingDate: string;
  batchNumber: string;
  qtyReceived: number;
  expiryDate: string;
}

export interface StockDeduction {
  id: number;
  upc: string;
  description: string;
  qtyDeducted: number;
  batchNumber: string;
  expiryDate: string;
  deductionDate: string;
  fefoApplied: boolean;
}

export interface OverviewItem {
  upc: string;
  shelfExpiryEstimate: string;
  totalStock: number;
  dailyStock: number;
  sales: string;
  batchNumbers: string;
  status: string;
}
