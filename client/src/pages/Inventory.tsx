import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { InventoryStatusBadge } from "@/components/InventoryStatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye } from "lucide-react";
import { InventoryState } from "@/lib/types";

interface InventoryBalance {
  id: number;
  productId: number;
  locationId: number;
  state: InventoryState;
  quantity: number;
  lastUpdated: string;
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
    type: string;
  };
}

interface InventoryHistory {
  id: number;
  operationType: string;
  quantity: number;
  fromState?: string;
  toState?: string;
  saleAmount?: string;
  memo?: string;
  performer: {
    username: string;
  };
  performedAt: string;
}

export default function Inventory() {
  const [searchSku, setSearchSku] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{
    productId: number;
    locationId: number;
    sku: string;
    location: string;
  } | null>(null);

  const { data: inventoryBalances, isLoading } = useQuery<InventoryBalance[]>({
    queryKey: ["/api/inventory"],
    refetchInterval: 30000,
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: inventoryHistory } = useQuery<InventoryHistory[]>({
    queryKey: ["/api/history", selectedDetail?.productId, selectedDetail?.locationId],
    enabled: !!selectedDetail,
  });

  // Group inventory balances by SKU and location
  const groupedInventory = inventoryBalances?.reduce((acc, balance) => {
    const key = `${balance.product.sku}-${balance.location.name}`;
    if (!acc[key]) {
      acc[key] = {
        product: balance.product,
        location: balance.location,
        states: {},
        total: 0,
        lastUpdated: balance.lastUpdated,
      };
    }
    acc[key].states[balance.state] = balance.quantity;
    acc[key].total += balance.quantity;
    if (new Date(balance.lastUpdated) > new Date(acc[key].lastUpdated)) {
      acc[key].lastUpdated = balance.lastUpdated;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  // Filter inventory based on search criteria
  const filteredInventory = Object.values(groupedInventory).filter((item: any) => {
    if (searchSku && !item.product.sku.toLowerCase().includes(searchSku.toLowerCase())) {
      return false;
    }
    if (selectedLocation && item.location.name !== selectedLocation) {
      return false;
    }
    if (selectedState && !(item.states[selectedState] > 0)) {
      return false;
    }
    // TODO: Implement low stock filtering based on replenishment criteria
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const openDetailModal = (productId: number, locationId: number, sku: string, location: string) => {
    setSelectedDetail({ productId, locationId, sku, location });
  };

  if (isLoading) {
    return (
      <div data-testid="inventory-loading">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">在庫一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="inventory-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">在庫一覧</h1>
        <p className="text-sm text-muted-foreground mt-1">全場所の在庫状況一覧</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>フィルタ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="sku-search">SKU検索</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sku-search"
                  placeholder="SKUを入力..."
                  value={searchSku}
                  onChange={(e) => setSearchSku(e.target.value)}
                  className="pl-8"
                  data-testid="input-sku-filter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-filter">場所</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger data-testid="select-location-filter">
                  <SelectValue placeholder="すべての場所" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">すべての場所</SelectItem>
                  {locations?.map((location: any) => (
                    <SelectItem key={location.id} value={location.name}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state-filter">状態</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger data-testid="select-state-filter">
                  <SelectValue placeholder="すべての状態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">すべての状態</SelectItem>
                  <SelectItem value="通常">通常</SelectItem>
                  <SelectItem value="確保">確保</SelectItem>
                  <SelectItem value="検品中">検品中</SelectItem>
                  <SelectItem value="不良">不良</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="low-stock-toggle">少数アラートのみ</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="low-stock-toggle"
                  checked={showLowStockOnly}
                  onCheckedChange={setShowLowStockOnly}
                  data-testid="switch-low-stock-only"
                />
                <Label htmlFor="low-stock-toggle" className="text-sm">
                  下限割れのみ表示
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>在庫一覧</CardTitle>
          <CardDescription>
            {filteredInventory.length}件の商品を表示中
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-inventory">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">場所</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">通常</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">確保</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">検品中</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">不良</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">合計</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">最終更新</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">明細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInventory.map((item: any) => (
                  <tr key={`${item.product.id}-${item.location.id}`} className="table-hover" data-testid={`row-inventory-${item.product.sku}-${item.location.id}`}>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div>
                        <div className="font-medium">{item.product.sku}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.product.modelName} - {item.product.color} - {item.product.size}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.location.name}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600" data-testid={`qty-normal-${item.product.sku}-${item.location.id}`}>
                      {item.states['通常'] || 0}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-600" data-testid={`qty-reserved-${item.product.sku}-${item.location.id}`}>
                      {item.states['確保'] || 0}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-yellow-600" data-testid={`qty-inspection-${item.product.sku}-${item.location.id}`}>
                      {item.states['検品中'] || 0}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600" data-testid={`qty-defective-${item.product.sku}-${item.location.id}`}>
                      {item.states['不良'] || 0}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" data-testid={`qty-total-${item.product.sku}-${item.location.id}`}>
                      {item.total}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(item.lastUpdated)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailModal(item.product.id, item.location.id, item.product.sku, item.location.name)}
                        data-testid={`button-detail-${item.product.sku}-${item.location.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        明細
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Detail Modal */}
      <Dialog open={!!selectedDetail} onOpenChange={() => setSelectedDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-inventory-detail">
          <DialogHeader>
            <DialogTitle>
              在庫明細 - {selectedDetail?.sku} ({selectedDetail?.location})
            </DialogTitle>
            <DialogDescription>
              この商品・場所の履歴を表示しています
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-inventory-history">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">日時</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">操作種別</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">数量変化</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">状態変化</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">担当者</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventoryHistory?.map((entry) => (
                  <tr key={entry.id} data-testid={`row-history-${entry.id}`}>
                    <td className="px-4 py-3 text-sm">{formatDate(entry.performedAt)}</td>
                    <td className="px-4 py-3 text-sm">{entry.operationType}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${entry.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {entry.fromState && entry.toState && entry.fromState !== entry.toState ? (
                        <div className="flex items-center space-x-2">
                          <InventoryStatusBadge state={entry.fromState as InventoryState} />
                          <span>→</span>
                          <InventoryStatusBadge state={entry.toState as InventoryState} />
                        </div>
                      ) : entry.toState ? (
                        <InventoryStatusBadge state={entry.toState as InventoryState} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{entry.performer.username}</td>
                    <td className="px-4 py-3 text-sm">
                      {entry.saleAmount && `¥${parseInt(entry.saleAmount).toLocaleString()}`}
                      {entry.memo && entry.memo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
