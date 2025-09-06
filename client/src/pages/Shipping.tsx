import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Plus, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

interface LowStockAlert {
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

interface ShippingInstruction {
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
  status: string;
  memo?: string;
  createdAt: string;
}

export default function Shipping() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Queries - locations must be first
  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const [selectedStore, setSelectedStore] = useState("");
  const [shippingForm, setShippingForm] = useState({
    sku: "",
    quantity: "",
    requestedDate: "",
    memo: "",
    toLocationId: "", // 配送先店舗ID
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Set initial store when locations are loaded
  useEffect(() => {
    if (locations && selectedStore === "") {
      const firstStore = locations.filter((l: any) => l.type === 'store')
        .sort((a: any, b: any) => a.displayOrder - b.displayOrder)[0];
      if (firstStore) {
        setSelectedStore(firstStore.id.toString());
      }
    }
  }, [locations, selectedStore]);

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: lowStockAlerts } = useQuery<LowStockAlert[]>({
    queryKey: ["/api/dashboard/low-stock"],
    refetchInterval: 30000,
  });

  const { data: pendingShipments } = useQuery<ShippingInstruction[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  const { data: completedShipments } = useQuery<ShippingInstruction[]>({
    queryKey: ["/api/shipping"],
  });

  // Mutations
  const createShippingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/shipping", data);
    },
    onError: (error: any) => {
      // Handle validation errors by setting form errors
      if (error.message.includes('Validation error') && error.details?.errors) {
        const newErrors: Record<string, string> = {};
        error.details.errors.forEach((err: any) => {
          if (err.path && err.path[0]) {
            const fieldName = err.path[0];
            newErrors[fieldName] = err.message;
          }
        });
        setFormErrors(newErrors);
      } else {
        setFormErrors({ general: error.message || "出荷指示の作成に失敗しました" });
      }
    },
  });

  const confirmShippingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/shipping/${id}/confirm`, {});
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "出荷指示を実行しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stores = locations?.filter((l: any) => l.type === 'store')
    .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
    .filter((store: any, index: number, arr: any[]) => 
      arr.findIndex((s: any) => s.name === store.name) === index
    ) || [];
  const warehouses = locations?.filter((l: any) => l.type === 'warehouse') || [];
  const currentStore = stores.find((s: any) => s.id.toString() === selectedStore);

  // Filter alerts for current store
  const storeAlerts = selectedStore === "all" ? 
    lowStockAlerts || [] :
    lowStockAlerts?.filter(alert => 
      alert.location.id.toString() === selectedStore
    ) || [];

  // Filter pending shipments for current store (status = 'pending')
  const storePendingShipments = selectedStore === "all" ? 
    completedShipments?.filter(shipment => shipment.status === 'pending') || [] :
    completedShipments?.filter(shipment =>
      shipment.toLocation.name === currentStore?.name && shipment.status === 'pending'
    ) || [];

  // Filter confirmed/completed shipments for current store (status = 'confirmed' or 'completed')
  const storeCompletedShipments = selectedStore === "all" ? 
    completedShipments?.filter(shipment => 
      shipment.status === 'confirmed' || shipment.status === 'completed'
    ).slice(0, 20) || [] :
    completedShipments?.filter(shipment =>
      shipment.toLocation.name === currentStore?.name && 
      (shipment.status === 'confirmed' || shipment.status === 'completed')
    ).slice(0, 20) || [];

  const handleCreateShipping = async () => {
    try {
      const selectedProduct = products?.find((p: any) => p.sku === shippingForm.sku);
      const warehouseLocation = warehouses[0]; // Assume first warehouse
      
      const targetStore = stores.find((s: any) => s.id.toString() === shippingForm.toLocationId);
      
      if (!selectedProduct) {
        throw new Error("商品が見つかりません。SKUを確認してください。");
      }
      if (!targetStore) {
        throw new Error("配送先店舗が選択されていません。");
      }
      if (!warehouseLocation) {
        throw new Error("倉庫が見つかりません。");
      }

      // Clear previous errors
      setFormErrors({});
      
      // Format the requested date - input type="date" already gives us YYYY-MM-DD
      let formattedRequestedDate = null;
      if (shippingForm.requestedDate && shippingForm.requestedDate.trim() !== "") {
        formattedRequestedDate = shippingForm.requestedDate; // Already in YYYY-MM-DD format from date input
      }

      await createShippingMutation.mutateAsync({
        productId: selectedProduct.id,
        fromLocationId: warehouseLocation.id,
        toLocationId: targetStore.id,
        quantity: parseInt(shippingForm.quantity),
        requestedDate: formattedRequestedDate,
        memo: shippingForm.memo || null,
      });
      // Clear form on success
      setShippingForm({
        sku: "",
        quantity: "",
        requestedDate: "",
        memo: "",
        toLocationId: "",
      });
      setFormErrors({});
      
      toast({
        title: "出荷指示作成完了",
        description: "出荷指示が正常に作成されました。",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/shipping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      
    } catch (error) {
      console.error("Shipping creation error:", error);
      
      // Handle validation errors
      if (error instanceof Error && error.message.includes('Validation error')) {
        try {
          const errorData = JSON.parse(error.message.split('Validation error: ')[1] || '{}');
          if (errorData.errors) {
            const newErrors: Record<string, string> = {};
            errorData.errors.forEach((err: any) => {
              if (err.path && err.path[0]) {
                newErrors[err.path[0]] = err.message;
              }
            });
            setFormErrors(newErrors);
          }
        } catch (parseError) {
          // Fallback to generic error
          setFormErrors({ general: "入力内容を確認してください" });
        }
      } else {
        setFormErrors({ general: error instanceof Error ? error.message : "出荷指示の作成に失敗しました" });
      }
    }
  };

  const fillFromAlert = (alert: LowStockAlert) => {
    const recommendedQuantity = Math.max(0, alert.targetStock - alert.currentStock);
    setShippingForm({
      sku: alert.product.sku,
      quantity: recommendedQuantity.toString(),
      requestedDate: "",
      memo: `少数アラートによる補充要求（現在庫: ${alert.currentStock}、基準: ${alert.targetStock}）`,
      toLocationId: alert.location.id.toString(),
    });
  };

  return (
    <div data-testid="shipping-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">出荷指示</h1>
        <p className="text-sm text-muted-foreground mt-1">店舗からの出荷指示管理</p>
      </div>

      {/* Store Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>店舗選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label htmlFor="store-select">対象店舗:</Label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48" data-testid="select-store-shipping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての店舗</SelectItem>
                {stores.map((store: any) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>少数アラート（{selectedStore === "all" ? "全店舗" : currentStore?.name}）</span>
              <span className="ml-2 bg-destructive/10 text-destructive px-2 py-1 rounded text-xs font-normal">
                {storeAlerts.length}件
              </span>
            </CardTitle>
            <CardDescription>下限在庫を下回った商品</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {storeAlerts.length > 0 ? (
                storeAlerts.map((alert) => (
                  <div 
                    key={`${alert.product.id}-${alert.location.id}`}
                    className="border border-destructive/20 bg-red-50 rounded-lg p-3 cursor-pointer hover:bg-red-100"
                    onClick={() => fillFromAlert(alert)}
                    data-testid={`alert-${alert.product.sku}`}
                  >
                    <div className="font-medium">{alert.product.sku}</div>
                    <div className="text-sm text-muted-foreground">
                      {alert.product.modelName} - {alert.product.color} - {alert.product.size}
                    </div>
                    {selectedStore === "all" && (
                      <div className="text-sm font-medium text-blue-600">
                        店舗: {alert.location.name}
                      </div>
                    )}
                    <div className="flex justify-between text-sm mt-2">
                      <span>現在庫: <span className="font-bold text-destructive">{alert.currentStock}</span></span>
                      <span>下限: {alert.minStock}</span>
                      <span>基準: {alert.targetStock}</span>
                    </div>
                    <div className="text-xs text-primary mt-1">
                      推奨数量: {Math.max(0, alert.targetStock - alert.currentStock)}点
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center py-6 text-muted-foreground" data-testid="empty-low-stock-alerts">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <h4 className="font-medium mb-1">アラートはありません</h4>
                  <p className="text-xs text-center">すべての商品が適正在庫を維持しています</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Shipments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-accent" />
              <span>処理中の出荷指示</span>
            </CardTitle>
            <CardDescription>倉庫で処理待ちの出荷指示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {storePendingShipments.length > 0 ? (
                storePendingShipments.map((shipment) => (
                  <div 
                    key={shipment.id}
                    className="border border-border rounded-lg p-3"
                    data-testid={`pending-shipment-${shipment.id}`}
                  >
                    <div className="font-medium">{shipment.product.sku}</div>
                    <div className="text-sm text-muted-foreground">
                      数量: {shipment.quantity}点
                    </div>
                    {selectedStore === "all" && (
                      <div className="text-sm font-medium text-blue-600">
                        宛先: {shipment.toLocation.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      希望日: {shipment.requestedDate ? format(new Date(shipment.requestedDate), 'yyyy/M/d') : '未設定'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      作成: {format(new Date(shipment.createdAt), 'M/d HH:mm')}
                    </div>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={() => confirmShippingMutation.mutate(shipment.id)}
                        disabled={confirmShippingMutation.isPending}
                        className="w-full"
                        data-testid={`button-confirm-shipment-${shipment.id}`}
                      >
                        {confirmShippingMutation.isPending ? "処理中..." : "出荷実行"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center py-6 text-muted-foreground" data-testid="empty-pending-shipments">
                  <Package className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <h4 className="font-medium mb-1">処理中の指示はありません</h4>
                  <p className="text-xs text-center">出荷指示が作成されると倉庫での処理待ちとして表示されます</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Shipments */}
        <Card>
          <CardHeader>
            <CardTitle>出荷済み</CardTitle>
            <CardDescription>出荷処理が完了した指示（20件）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {storeCompletedShipments.length > 0 ? (
                storeCompletedShipments.map((shipment) => (
                  <div 
                    key={shipment.id}
                    className="border border-green-200 bg-green-50 rounded-lg p-3"
                    data-testid={`completed-shipment-${shipment.id}`}
                  >
                    <div className="font-medium">{shipment.product.sku}</div>
                    <div className="text-sm text-muted-foreground">
                      数量: {shipment.quantity}点
                    </div>
                    <div className="text-xs text-green-600">
                      完了済み
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center">出荷済みの指示はありません</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipping Instruction Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>出荷指示作成</span>
          </CardTitle>
          <CardDescription>新しい出荷指示を作成します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipping-sku">SKU</Label>
              <Select 
                value={shippingForm.sku} 
                onValueChange={(value) => {
                  // Auto-fill recommended quantity based on low stock alert for current store
                  const alert = storeAlerts.find(a => a.product.sku === value);
                  if (alert && selectedStore !== "all") {
                    const recommendedQuantity = Math.max(0, alert.targetStock - alert.currentStock);
                    setShippingForm(prev => ({ 
                      ...prev, 
                      sku: value,
                      quantity: recommendedQuantity.toString(),
                      memo: `少数アラートによる補充要求（現在庫: ${alert.currentStock}、基準: ${alert.targetStock}）`
                    }));
                  } else {
                    setShippingForm(prev => ({ ...prev, sku: value }));
                  }
                }}
              >
                <SelectTrigger data-testid="select-shipping-sku">
                  <SelectValue placeholder="SKUを選択" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product: any) => (
                    <SelectItem key={product.id} value={product.sku}>
                      {product.sku} - {product.modelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-destination">配送先店舗</Label>
              <Select 
                value={shippingForm.toLocationId} 
                onValueChange={(value) => setShippingForm(prev => ({ ...prev, toLocationId: value }))}
              >
                <SelectTrigger data-testid="select-shipping-destination">
                  <SelectValue placeholder="店舗を選択" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store: any) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-quantity">数量</Label>
              <Input
                id="shipping-quantity"
                type="number"
                value={shippingForm.quantity}
                onChange={(e) => setShippingForm(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="推奨数量が自動入力されます"
                data-testid="input-shipping-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-date" className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>希望納期</span>
              </Label>
              <Input
                id="shipping-date"
                type="date"
                value={shippingForm.requestedDate}
                onChange={(e) => setShippingForm(prev => ({ ...prev, requestedDate: e.target.value }))}
                data-testid="input-shipping-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-memo">メモ</Label>
              <Textarea
                id="shipping-memo"
                value={shippingForm.memo}
                onChange={(e) => setShippingForm(prev => ({ ...prev, memo: e.target.value }))}
                placeholder="補足情報があれば入力"
                className="min-h-[40px]"
                data-testid="textarea-shipping-memo"
              />
            </div>
          </div>

          {/* Error Messages */}
          {Object.keys(formErrors).length > 0 && (
            <div className="rounded-md bg-destructive/15 p-3">
              <div className="text-sm font-medium text-destructive mb-2">入力エラー:</div>
              <div className="space-y-1">
                {Object.entries(formErrors).map(([field, message]) => (
                  <div key={field} className="text-sm text-destructive">
                    {field === 'general' ? message : `${field}: ${message}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleCreateShipping}
              disabled={createShippingMutation.isPending || !shippingForm.sku || !shippingForm.quantity || !shippingForm.toLocationId}
              data-testid="button-create-shipping"
            >
              出荷指示を作成
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
