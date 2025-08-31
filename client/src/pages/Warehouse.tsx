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
import { Truck, Package, CheckCircle, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface PendingShipment {
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
  memo?: string;
}

export default function Warehouse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form states
  const [selectedShipment, setSelectedShipment] = useState<PendingShipment | null>(null);
  const [receivingForm, setReceivingForm] = useState({
    supplier: "",
    date: "",
    sku: "",
    quantity: "",
    goodQuality: "",
    defectiveQuality: "",
    shelf: "",
  });
  const [returnsForm, setReturnsForm] = useState({
    sku: "",
    quantity: "",
    condition: "再販可" as "再販可" | "不良",
  });

  // Queries
  const { data: pendingShipments, isLoading: shipmentsLoading } = useQuery<PendingShipment[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  // Mutations
  const confirmShipmentMutation = useMutation({
    mutationFn: async ({ id, performedBy }: { id: number; performedBy: string }) => {
      await apiRequest("POST", `/api/shipping/${id}/confirm`, { performedBy });
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "出荷を確定しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      setSelectedShipment(null);
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/inventory/adjust", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "在庫調整が完了しました",
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

  const handleReserveInventory = async () => {
    if (!selectedShipment) return;
    
    try {
      const product = products?.find((p: any) => p.sku === selectedShipment.product.sku);
      const fromLocation = locations?.find((l: any) => l.name === selectedShipment.fromLocation.name);
      
      if (!product || !fromLocation) {
        throw new Error("商品または場所が見つかりません");
      }

      await adjustInventoryMutation.mutateAsync({
        productId: product.id,
        locationId: fromLocation.id,
        fromState: "通常",
        toState: "確保",
        quantity: selectedShipment.quantity,
        operationType: "在庫確保",
        performedBy: "warehouse_user",
        memo: `出荷指示#${selectedShipment.id}に対する在庫確保`,
      });
    } catch (error) {
      console.error("Reserve inventory error:", error);
    }
  };

  const handleConfirmShipment = async () => {
    if (!selectedShipment) return;
    
    await confirmShipmentMutation.mutateAsync({
      id: selectedShipment.id,
      performedBy: "warehouse_user",
    });
  };

  const handleReceiving = async () => {
    try {
      const product = products?.find((p: any) => p.sku === receivingForm.sku);
      const warehouseLocation = locations?.find((l: any) => l.name === receivingForm.shelf);
      
      if (!product || !warehouseLocation) {
        throw new Error("商品または棚が見つかりません");
      }

      // First, add to inspection state
      await adjustInventoryMutation.mutateAsync({
        productId: product.id,
        locationId: warehouseLocation.id,
        toState: "検品中",
        quantity: parseInt(receivingForm.quantity),
        operationType: "仕入受入",
        performedBy: "warehouse_user",
        memo: `仕入先: ${receivingForm.supplier}`,
      });

      // Reset form
      setReceivingForm({
        supplier: "",
        date: "",
        sku: "",
        quantity: "",
        goodQuality: "",
        defectiveQuality: "",
        shelf: "",
      });
    } catch (error) {
      console.error("Receiving error:", error);
    }
  };

  const handleShelfPlacement = async () => {
    try {
      const product = products?.find((p: any) => p.sku === receivingForm.sku);
      const warehouseLocation = locations?.find((l: any) => l.name === receivingForm.shelf);
      
      if (!product || !warehouseLocation) {
        throw new Error("商品または棚が見つかりません");
      }

      const goodQty = parseInt(receivingForm.goodQuality || "0");
      const defectiveQty = parseInt(receivingForm.defectiveQuality || "0");

      // Move good quality to normal
      if (goodQty > 0) {
        await adjustInventoryMutation.mutateAsync({
          productId: product.id,
          locationId: warehouseLocation.id,
          fromState: "検品中",
          toState: "通常",
          quantity: goodQty,
          operationType: "棚入れ",
          performedBy: "warehouse_user",
          memo: "良品として棚入れ",
        });
      }

      // Move defective to defective state
      if (defectiveQty > 0) {
        await adjustInventoryMutation.mutateAsync({
          productId: product.id,
          locationId: warehouseLocation.id,
          fromState: "検品中",
          toState: "不良",
          quantity: defectiveQty,
          operationType: "棚入れ",
          performedBy: "warehouse_user",
          memo: "不良品として分別",
        });
      }

      // Reset form
      setReceivingForm({
        supplier: "",
        date: "",
        sku: "",
        quantity: "",
        goodQuality: "",
        defectiveQuality: "",
        shelf: "",
      });
    } catch (error) {
      console.error("Shelf placement error:", error);
    }
  };

  const handleReturnsInspection = async () => {
    try {
      const product = products?.find((p: any) => p.sku === returnsForm.sku);
      const warehouseLocation = locations?.find((l: any) => l.type === "warehouse");
      
      if (!product || !warehouseLocation) {
        throw new Error("商品または倉庫が見つかりません");
      }

      const targetState = returnsForm.condition === "再販可" ? "通常" : "不良";
      
      await adjustInventoryMutation.mutateAsync({
        productId: product.id,
        locationId: warehouseLocation.id,
        fromState: "検品中",
        toState: targetState,
        quantity: parseInt(returnsForm.quantity),
        operationType: "返品検品",
        performedBy: "warehouse_user",
        memo: `返品検品結果: ${returnsForm.condition}`,
      });

      setReturnsForm({
        sku: "",
        quantity: "",
        condition: "再販可",
      });
    } catch (error) {
      console.error("Returns inspection error:", error);
    }
  };

  return (
    <div data-testid="warehouse-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">入出庫</h1>
        <p className="text-sm text-muted-foreground mt-1">倉庫業務の管理</p>
      </div>

      {/* Pending Shipments Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="h-5 w-5" />
            <span>未処理出荷指示</span>
          </CardTitle>
          <CardDescription>期限順で表示</CardDescription>
        </CardHeader>
        <CardContent>
          {shipmentsLoading ? (
            <p>読み込み中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-pending-shipments-warehouse">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">店舗</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">数量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">希望日</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingShipments?.map((shipment) => (
                    <tr 
                      key={shipment.id} 
                      className={`table-hover cursor-pointer ${selectedShipment?.id === shipment.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedShipment(shipment)}
                      data-testid={`row-pending-shipment-${shipment.id}`}
                    >
                      <td className="px-4 py-3 text-sm">{shipment.toLocation.name}</td>
                      <td className="px-4 py-3 text-sm font-medium">{shipment.product.sku}</td>
                      <td className="px-4 py-3 text-sm">{shipment.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        {shipment.requestedDate ? format(new Date(shipment.requestedDate), 'M/d') : '未設定'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShipment(shipment);
                          }}
                          data-testid={`button-select-shipment-${shipment.id}`}
                        >
                          選択
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="shipping" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shipping" data-testid="tab-shipping">出荷処理</TabsTrigger>
          <TabsTrigger value="receiving" data-testid="tab-receiving">仕入受入・棚入れ</TabsTrigger>
          <TabsTrigger value="returns" data-testid="tab-returns">返品受入・検品</TabsTrigger>
        </TabsList>

        {/* Shipping Processing Tab */}
        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>出荷処理</CardTitle>
              <CardDescription>選択した出荷指示の処理</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedShipment ? (
                <div className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">選択中の出荷指示</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">店舗:</span> {selectedShipment.toLocation.name}
                      </div>
                      <div>
                        <span className="text-muted-foreground">SKU:</span> {selectedShipment.product.sku}
                      </div>
                      <div>
                        <span className="text-muted-foreground">数量:</span> {selectedShipment.quantity}点
                      </div>
                      <div>
                        <span className="text-muted-foreground">希望日:</span> {selectedShipment.requestedDate ? format(new Date(selectedShipment.requestedDate), 'yyyy/M/d') : '未設定'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-4">
                    <Button 
                      variant="outline" 
                      onClick={handleReserveInventory}
                      disabled={adjustInventoryMutation.isPending}
                      data-testid="button-reserve-inventory"
                    >
                      在庫を確保する
                    </Button>
                    <Button 
                      onClick={handleConfirmShipment}
                      disabled={confirmShipmentMutation.isPending}
                      data-testid="button-confirm-shipment"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      出荷を確定する
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">上記の未処理出荷指示から1件を選択してください</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receiving and Shelving Tab */}
        <TabsContent value="receiving">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receiving Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>仕入受入</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">仕入先</Label>
                    <Input
                      id="supplier"
                      value={receivingForm.supplier}
                      onChange={(e) => setReceivingForm(prev => ({ ...prev, supplier: e.target.value }))}
                      data-testid="input-supplier"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">日付</Label>
                    <Input
                      id="date"
                      type="date"
                      value={receivingForm.date}
                      onChange={(e) => setReceivingForm(prev => ({ ...prev, date: e.target.value }))}
                      data-testid="input-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Select value={receivingForm.sku} onValueChange={(value) => setReceivingForm(prev => ({ ...prev, sku: value }))}>
                      <SelectTrigger data-testid="select-receiving-sku">
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
                    <Label htmlFor="quantity">受入数量</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={receivingForm.quantity}
                      onChange={(e) => setReceivingForm(prev => ({ ...prev, quantity: e.target.value }))}
                      data-testid="input-receiving-quantity"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shelf">棚</Label>
                  <Select value={receivingForm.shelf} onValueChange={(value) => setReceivingForm(prev => ({ ...prev, shelf: value }))}>
                    <SelectTrigger data-testid="select-shelf">
                      <SelectValue placeholder="棚を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.filter((l: any) => l.type === 'warehouse').map((location: any) => (
                        <SelectItem key={location.id} value={location.name}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleReceiving}
                  disabled={adjustInventoryMutation.isPending}
                  className="w-full"
                  data-testid="button-register-receiving"
                >
                  受入を登録
                </Button>
              </CardContent>
            </Card>

            {/* Shelf Placement Form */}
            <Card>
              <CardHeader>
                <CardTitle>棚入れ確定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="good-quality">良品数量</Label>
                    <Input
                      id="good-quality"
                      type="number"
                      value={receivingForm.goodQuality}
                      onChange={(e) => setReceivingForm(prev => ({ ...prev, goodQuality: e.target.value }))}
                      data-testid="input-good-quality"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defective-quality">不良品数量</Label>
                    <Input
                      id="defective-quality"
                      type="number"
                      value={receivingForm.defectiveQuality}
                      onChange={(e) => setReceivingForm(prev => ({ ...prev, defectiveQuality: e.target.value }))}
                      data-testid="input-defective-quality"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleShelfPlacement}
                  disabled={adjustInventoryMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-shelf-placement"
                >
                  棚入れを確定
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Returns Receiving and Inspection Tab */}
        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>返品受入・検品</span>
              </CardTitle>
              <CardDescription>店舗からの返品を受入し、検品を行います</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="returns-sku">SKU</Label>
                  <Select value={returnsForm.sku} onValueChange={(value) => setReturnsForm(prev => ({ ...prev, sku: value }))}>
                    <SelectTrigger data-testid="select-returns-sku">
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
                  <Label htmlFor="returns-quantity">数量</Label>
                  <Input
                    id="returns-quantity"
                    type="number"
                    value={returnsForm.quantity}
                    onChange={(e) => setReturnsForm(prev => ({ ...prev, quantity: e.target.value }))}
                    data-testid="input-returns-quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="returns-condition">判定</Label>
                  <Select value={returnsForm.condition} onValueChange={(value: "再販可" | "不良") => setReturnsForm(prev => ({ ...prev, condition: value }))}>
                    <SelectTrigger data-testid="select-returns-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="再販可">再販可</SelectItem>
                      <SelectItem value="不良">不良</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleReturnsInspection}
                disabled={adjustInventoryMutation.isPending}
                className="w-full"
                data-testid="button-confirm-returns-inspection"
              >
                返品を検品して確定
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
