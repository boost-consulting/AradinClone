export interface DashboardMetrics {
  pendingShipments: number;
  lowStockItems: number;
  todayReceiving: {
    processed: number;
    planned: number;
  };
  weekSales: number;
}

export interface LowStockAlert {
  product: {
    id: number;
    sku: string;
    modelName: string;
    color: string;
    size: string;
  };
  location: {
    id: number;
    name: string;
  };
  currentStock: number;
  minStock: number;
  targetStock: number;
}

export interface PendingShipment {
  id: number;
  product: {
    sku: string;
    modelName: string;
    color: string;
    size: string;
  };
  fromLocation: {
    name: string;
  };
  toLocation: {
    name: string;
  };
  quantity: number;
  requestedDate: string | null;
  createdAt: string;
  creator: {
    username: string;
  };
}

export interface HistoryEntry {
  id: number;
  operationType: string;
  product: {
    sku: string;
    modelName: string;
  };
  quantity: number;
  fromLocation?: {
    name: string;
  };
  toLocation?: {
    name: string;
  };
  fromState?: string;
  toState?: string;
  saleAmount?: string;
  memo?: string;
  performer: {
    username: string;
  };
  performedAt: string;
}

export type InventoryState = '通常' | '確保' | '検品中' | '不良';
export type UserRole = 'warehouse' | 'store' | 'admin';
