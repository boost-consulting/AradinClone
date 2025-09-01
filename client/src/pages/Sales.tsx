import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Search, ShoppingCart, Percent, JapaneseYen } from "lucide-react";
import { InventoryStatusBadge } from "@/components/InventoryStatusBadge";
import { InventoryState } from "@/lib/types";

interface InventoryBalance {
  id: number;
  productId: number;
  locationId: number;
  state: InventoryState;
  quantity: number;
  product: {
    id: number;
    sku: string;
    modelName: string;
    color: string;
    size: string;
    retailPrice: string;
  };
}

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Queries - locations must be first
  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const [selectedStore, setSelectedStore] = useState("");
  const [searchSku, setSearchSku] = useState("");
  const [salesForm, setSalesForm] = useState({
    sku: "",
    quantity: "",
    discountAmount: "",
    discountPercent: "",
  });

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

  const { data: storeInventory, isLoading } = useQuery<InventoryBalance[]>({
    queryKey: ["/api/inventory", selectedStore],
    enabled: !!selectedStore && selectedStore !== "all",
    queryFn: async () => {
      const response = await fetch(`/api/inventory?locationId=${selectedStore}`);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    },
  });

  // Mutations
  const recordSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/sales", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "販売を登録しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      setSalesForm({
        sku: "",
        quantity: "",
        discountAmount: "",
        discountPercent: "",
      });
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
  const currentStore = stores.find((s: any) => s.id.toString() === selectedStore);

  // Filter inventory for current store and normal state
  const storeNormalInventory = selectedStore === "all" ? [] : 
    storeInventory?.filter(item => 
      item.locationId.toString() === selectedStore && 
      item.state === '通常' &&
      item.quantity > 0
    ) || [];

  // Filter inventory based on search
  const filteredInventory = storeNormalInventory.filter(item =>
    searchSku === "" || item.product.sku.toLowerCase().includes(searchSku.toLowerCase())
  );

  // Calculate sale amount
  const calculateSaleAmount = () => {
    const selectedProduct = products?.find((p: any) => p.sku === salesForm.sku);
    if (!selectedProduct || !salesForm.quantity) return 0;

    const baseAmount = parseFloat(selectedProduct.retailPrice) * parseInt(salesForm.quantity);
    let discount = 0;

    if (salesForm.discountAmount) {
      discount = parseFloat(salesForm.discountAmount);
    } else if (salesForm.discountPercent) {
      discount = baseAmount * (parseFloat(salesForm.discountPercent) / 100);
    }

    return Math.max(0, baseAmount - discount);
  };

  const handleSaleSubmit = async () => {
    try {
      const selectedProduct = products?.find((p: any) => p.sku === salesForm.sku);
      const saleAmount = calculateSaleAmount();
      
      if (!selectedProduct || !currentStore) {
        throw new Error("商品または店舗が見つかりません");
      }

      await recordSaleMutation.mutateAsync({
        productId: selectedProduct.id,
        locationId: currentStore.id,
        quantity: parseInt(salesForm.quantity),
        saleAmount,
        discount: salesForm.discountAmount ? parseFloat(salesForm.discountAmount) : 
                 salesForm.discountPercent ? parseFloat(salesForm.discountPercent) : undefined,
        memo: `店舗${currentStore.name}での販売`,
      });
    } catch (error) {
      console.error("Sale submission error:", error);
    }
  };

  const handleDiscountChange = (field: 'amount' | 'percent', value: string) => {
    if (field === 'amount') {
      setSalesForm(prev => ({ 
        ...prev, 
        discountAmount: value,
        discountPercent: value ? "" : prev.discountPercent 
      }));
    } else {
      setSalesForm(prev => ({ 
        ...prev, 
        discountPercent: value,
        discountAmount: value ? "" : prev.discountAmount 
      }));
    }
  };

  return (
    <div data-testid="sales-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">販売管理</h1>
        <p className="text-sm text-muted-foreground mt-1">店舗での販売業務</p>
      </div>

      {/* Store Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>店舗選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="store-select">対象店舗:</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-48" data-testid="select-target-store">
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
            
            {/* Store Inventory Summary */}
            {selectedStore !== "all" && currentStore && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">{currentStore.name} 在庫サマリ</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {storeNormalInventory.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">通常在庫</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {storeNormalInventory.length}
                    </div>
                    <div className="text-xs text-muted-foreground">商品種類</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {storeNormalInventory.filter(item => item.quantity <= 10).length}
                    </div>
                    <div className="text-xs text-muted-foreground">低在庫商品</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {storeNormalInventory.filter(item => item.quantity === 0).length}
                    </div>
                    <div className="text-xs text-muted-foreground">品切れ商品</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Inventory Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{currentStore?.name || '店舗'}の在庫サマリ</CardTitle>
            <CardDescription>販売可能な在庫（通常状態）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="SKUで検索..."
                  value={searchSku}
                  onChange={(e) => setSearchSku(e.target.value)}
                  className="pl-8"
                  data-testid="input-inventory-search"
                />
              </div>

              <div className="max-h-96 overflow-y-auto">
                {selectedStore === "all" ? (
                  <p className="text-muted-foreground py-4">販売対象の店舗を選択してください</p>
                ) : isLoading ? (
                  <p>読み込み中...</p>
                ) : filteredInventory.length > 0 ? (
                  <div className="space-y-2">
                    {filteredInventory.map((item) => (
                      <div 
                        key={item.id} 
                        className="border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSalesForm(prev => ({ ...prev, sku: item.product.sku }))}
                        data-testid={`inventory-item-${item.product.sku}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{item.product.sku}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.product.modelName} - {item.product.color} - {item.product.size}
                            </div>
                            <div className="text-sm font-medium text-green-600">
                              ¥{parseInt(item.product.retailPrice).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{item.quantity}</div>
                            <InventoryStatusBadge state={item.state} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-muted-foreground" data-testid="empty-sales-inventory">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-medium text-lg mb-2">販売可能な在庫がありません</h3>
                    {searchSku ? (
                      <div className="text-sm text-center space-y-1">
                        <p>検索条件に一致する商品がありません</p>
                        <p className="text-xs">別のSKUで検索してください</p>
                      </div>
                    ) : (
                      <div className="text-sm text-center space-y-1">
                        <p>この店舗には現在販売可能な在庫がありません</p>
                        <p className="text-xs">仕入れまたは出荷処理を行ってください</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5" />
              <span>販売登録</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sales-sku">SKU</Label>
              <Select value={salesForm.sku} onValueChange={(value) => setSalesForm(prev => ({ ...prev, sku: value }))}>
                <SelectTrigger data-testid="select-sales-sku">
                  <SelectValue placeholder="SKUを選択" />
                </SelectTrigger>
                <SelectContent>
                  {filteredInventory.map((item) => (
                    <SelectItem key={item.id} value={item.product.sku}>
                      {item.product.sku} - 在庫: {item.quantity}点
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sales-quantity">数量</Label>
              <Input
                id="sales-quantity"
                type="number"
                value={salesForm.quantity}
                onChange={(e) => setSalesForm(prev => ({ ...prev, quantity: e.target.value }))}
                data-testid="input-sales-quantity"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-amount" className="flex items-center space-x-1">
                  <JapaneseYen className="h-3 w-3" />
                  <span>値引額</span>
                </Label>
                <Input
                  id="discount-amount"
                  type="number"
                  value={salesForm.discountAmount}
                  onChange={(e) => handleDiscountChange('amount', e.target.value)}
                  placeholder="円"
                  data-testid="input-discount-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-percent" className="flex items-center space-x-1">
                  <Percent className="h-3 w-3" />
                  <span>値引率</span>
                </Label>
                <Input
                  id="discount-percent"
                  type="number"
                  value={salesForm.discountPercent}
                  onChange={(e) => handleDiscountChange('percent', e.target.value)}
                  placeholder="%"
                  data-testid="input-discount-percent"
                />
              </div>
            </div>

            {/* Calculation Result */}
            {salesForm.sku && salesForm.quantity && (
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <h3 className="font-medium">計算結果</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>単価:</span>
                    <span>¥{products?.find((p: any) => p.sku === salesForm.sku)?.retailPrice ? 
                      parseInt(products.find((p: any) => p.sku === salesForm.sku).retailPrice).toLocaleString() : 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>小計:</span>
                    <span>¥{(parseInt(salesForm.quantity || "0") * 
                      (products?.find((p: any) => p.sku === salesForm.sku)?.retailPrice ? 
                       parseInt(products.find((p: any) => p.sku === salesForm.sku).retailPrice) : 0)).toLocaleString()}</span>
                  </div>
                  {(salesForm.discountAmount || salesForm.discountPercent) && (
                    <div className="flex justify-between text-red-600">
                      <span>値引:</span>
                      <span>-¥{(salesForm.discountAmount ? 
                        parseInt(salesForm.discountAmount) : 
                        (parseInt(salesForm.quantity || "0") * 
                         (products?.find((p: any) => p.sku === salesForm.sku)?.retailPrice ? 
                          parseInt(products.find((p: any) => p.sku === salesForm.sku).retailPrice) : 0) * 
                         parseInt(salesForm.discountPercent || "0") / 100)
                      ).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>合計:</span>
                    <span data-testid="text-sale-total">¥{calculateSaleAmount().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleSaleSubmit}
              disabled={recordSaleMutation.isPending || !salesForm.sku || !salesForm.quantity}
              className="w-full"
              data-testid="button-register-sale"
            >
              販売を登録
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
