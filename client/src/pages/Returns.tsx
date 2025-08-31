import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RotateCcw, Package, Truck } from "lucide-react";

export default function Returns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedStore, setSelectedStore] = useState("1");
  const [customerReturnForm, setCustomerReturnForm] = useState({
    date: "",
    sku: "",
    quantity: "",
    condition: "再販可" as "再販可" | "不良",
  });
  const [warehouseReturnForm, setWarehouseReturnForm] = useState({
    sku: "",
    quantity: "",
    memo: "",
  });

  // Queries
  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: storeInventory } = useQuery<any[]>({
    queryKey: ["/api/inventory", selectedStore],
    enabled: !!selectedStore,
  });

  // Mutations
  const adjustInventoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/inventory/adjust", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "返品処理が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stores = locations?.filter((l: any) => l.type === 'store') || [];
  const warehouses = locations?.filter((l: any) => l.type === 'warehouse') || [];
  const currentStore = stores.find((s: any) => s.id.toString() === selectedStore);

  // Filter store inventory for normal state
  const storeNormalInventory = storeInventory?.filter((item: any) => 
    item.locationId.toString() === selectedStore && 
    item.state === '通常' &&
    item.quantity > 0
  ) || [];

  const handleCustomerReturn = async () => {
    try {
      const selectedProduct = products?.find((p: any) => p.sku === customerReturnForm.sku);
      
      if (!selectedProduct || !currentStore) {
        throw new Error("商品または店舗が見つかりません");
      }

      const targetState = customerReturnForm.condition === "再販可" ? "通常" : "不良";
      
      await adjustInventoryMutation.mutateAsync({
        productId: selectedProduct.id,
        locationId: currentStore.id,
        toState: targetState,
        quantity: parseInt(customerReturnForm.quantity),
        operationType: "顧客返品",
        performedBy: "store_user",
        memo: `顧客返品 - ${customerReturnForm.condition}`,
      });

      setCustomerReturnForm({
        date: "",
        sku: "",
        quantity: "",
        condition: "再販可",
      });
    } catch (error) {
      console.error("Customer return error:", error);
    }
  };

  const handleWarehouseReturn = async () => {
    try {
      const selectedProduct = products?.find((p: any) => p.sku === warehouseReturnForm.sku);
      const warehouseLocation = warehouses[0]; // Assume first warehouse
      
      if (!selectedProduct || !currentStore || !warehouseLocation) {
        throw new Error("必要な情報が不足しています");
      }

      // Reduce from store normal inventory
      await adjustInventoryMutation.mutateAsync({
        productId: selectedProduct.id,
        locationId: currentStore.id,
        fromState: "通常",
        toState: "通常",
        quantity: -parseInt(warehouseReturnForm.quantity), // Negative for reduction
        operationType: "店舗返品送付",
        performedBy: "store_user",
        memo: warehouseReturnForm.memo || "倉庫への返品送付",
      });

      // Add to warehouse inspection state
      await adjustInventoryMutation.mutateAsync({
        productId: selectedProduct.id,
        locationId: warehouseLocation.id,
        toState: "検品中",
        quantity: parseInt(warehouseReturnForm.quantity),
        operationType: "返品受入",
        performedBy: "store_user",
        memo: `${currentStore.name}からの返品受入`,
      });

      setWarehouseReturnForm({
        sku: "",
        quantity: "",
        memo: "",
      });
    } catch (error) {
      console.error("Warehouse return error:", error);
    }
  };

  return (
    <div data-testid="returns-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">返品管理</h1>
        <p className="text-sm text-muted-foreground mt-1">顧客返品と倉庫返品送付の管理</p>
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
              <SelectTrigger className="w-48" data-testid="select-store-returns">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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

      {/* Main Tabs */}
      <Tabs defaultValue="customer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customer" data-testid="tab-customer-returns">顧客返品</TabsTrigger>
          <TabsTrigger value="warehouse" data-testid="tab-warehouse-returns">倉庫返品送付</TabsTrigger>
        </TabsList>

        {/* Customer Returns Tab */}
        <TabsContent value="customer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>顧客返品</span>
              </CardTitle>
              <CardDescription>顧客からの返品を受け付けて在庫に反映します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-return-date">日付</Label>
                  <Input
                    id="customer-return-date"
                    type="date"
                    value={customerReturnForm.date}
                    onChange={(e) => setCustomerReturnForm(prev => ({ ...prev, date: e.target.value }))}
                    data-testid="input-customer-return-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-return-sku">SKU</Label>
                  <Select value={customerReturnForm.sku} onValueChange={(value) => setCustomerReturnForm(prev => ({ ...prev, sku: value }))}>
                    <SelectTrigger data-testid="select-customer-return-sku">
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
                  <Label htmlFor="customer-return-quantity">数量</Label>
                  <Input
                    id="customer-return-quantity"
                    type="number"
                    value={customerReturnForm.quantity}
                    onChange={(e) => setCustomerReturnForm(prev => ({ ...prev, quantity: e.target.value }))}
                    data-testid="input-customer-return-quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-return-condition">判定</Label>
                  <Select value={customerReturnForm.condition} onValueChange={(value: "再販可" | "不良") => setCustomerReturnForm(prev => ({ ...prev, condition: value }))}>
                    <SelectTrigger data-testid="select-customer-return-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="再販可">再販可</SelectItem>
                      <SelectItem value="不良">不良</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-medium mb-2">処理内容</h3>
                <p className="text-sm text-muted-foreground">
                  {customerReturnForm.condition === "再販可" 
                    ? "商品を通常在庫として店舗に追加します。再度販売に使用できます。"
                    : "商品を不良在庫として店舗に追加します。販売には使用できません。"
                  }
                </p>
              </div>

              <Button 
                onClick={handleCustomerReturn}
                disabled={adjustInventoryMutation.isPending || !customerReturnForm.sku || !customerReturnForm.quantity}
                className="w-full"
                data-testid="button-register-customer-return"
              >
                顧客返品を登録
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouse Return Shipping Tab */}
        <TabsContent value="warehouse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store Inventory */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>{currentStore?.name || '店舗'}の在庫</span>
                </CardTitle>
                <CardDescription>返品可能な在庫（通常状態）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {storeNormalInventory.length > 0 ? (
                    storeNormalInventory.map((item: any) => (
                      <div 
                        key={item.id}
                        className="border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setWarehouseReturnForm(prev => ({ ...prev, sku: item.product.sku }))}
                        data-testid={`inventory-item-warehouse-${item.product.sku}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{item.product.sku}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.product.modelName} - {item.product.color} - {item.product.size}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{item.quantity}</div>
                            <div className="text-xs text-green-600">通常</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-8 text-muted-foreground" data-testid="empty-return-inventory">
                      <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <h4 className="font-medium mb-1">返品可能な在庫がありません</h4>
                      <p className="text-xs text-center">通常状態の在庫がある場合のみ返品処理ができます</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Warehouse Return Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Truck className="h-5 w-5" />
                  <span>倉庫返品送付</span>
                </CardTitle>
                <CardDescription>店舗から倉庫への返品送付</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouse-return-sku">SKU</Label>
                  <Select value={warehouseReturnForm.sku} onValueChange={(value) => setWarehouseReturnForm(prev => ({ ...prev, sku: value }))}>
                    <SelectTrigger data-testid="select-warehouse-return-sku">
                      <SelectValue placeholder="SKUを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeNormalInventory.map((item: any) => (
                        <SelectItem key={item.id} value={item.product.sku}>
                          {item.product.sku} - 在庫: {item.quantity}点
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouse-return-quantity">数量</Label>
                  <Input
                    id="warehouse-return-quantity"
                    type="number"
                    value={warehouseReturnForm.quantity}
                    onChange={(e) => setWarehouseReturnForm(prev => ({ ...prev, quantity: e.target.value }))}
                    data-testid="input-warehouse-return-quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouse-return-memo">メモ</Label>
                  <Textarea
                    id="warehouse-return-memo"
                    value={warehouseReturnForm.memo}
                    onChange={(e) => setWarehouseReturnForm(prev => ({ ...prev, memo: e.target.value }))}
                    placeholder="返品理由など"
                    data-testid="textarea-warehouse-return-memo"
                  />
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">処理内容</h3>
                  <p className="text-sm text-muted-foreground">
                    店舗の通常在庫から指定数量を減算し、倉庫の検品中に追加します。
                    倉庫で検品後、再販可能か不良かを判定します。
                  </p>
                </div>

                <Button 
                  onClick={handleWarehouseReturn}
                  disabled={adjustInventoryMutation.isPending || !warehouseReturnForm.sku || !warehouseReturnForm.quantity}
                  className="w-full"
                  data-testid="button-send-warehouse-return"
                >
                  倉庫へ返品を送付
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
