import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Search, Settings, Package, MapPin } from "lucide-react";

interface Product {
  id: number;
  sku: string;
  modelName: string;
  color: string;
  size: string;
  category?: string;
  retailPrice: string;
  costPrice?: string;
  isActive: number;
}

interface Location {
  id: number;
  name: string;
  type: string;
  displayOrder: number;
  isActive: number;
}

interface ReplenishmentCriteria {
  id: number;
  productId: number;
  locationId: number;
  minStock: number;
  targetStock: number;
  standardReplenishment: number;
  product: Product;
  location: Location;
}

export default function Master() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchProduct, setSearchProduct] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<ReplenishmentCriteria | null>(null);

  // Product form state
  const [productForm, setProductForm] = useState({
    sku: "",
    modelName: "",
    color: "",
    size: "",
    category: "",
    retailPrice: "",
    costPrice: "",
  });

  // Location form state
  const [locationForm, setLocationForm] = useState({
    name: "",
    type: "store" as "store" | "warehouse",
    displayOrder: "",
  });

  // Criteria form state
  const [criteriaForm, setCriteriaForm] = useState({
    productId: "",
    locationId: "",
    minStock: "",
    targetStock: "",
    standardReplenishment: "",
  });

  // Queries
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: replenishmentCriteria, isLoading: criteriaLoading } = useQuery<ReplenishmentCriteria[]>({
    queryKey: ["/api/replenishment"],
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "商品を作成しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      resetProductForm();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/locations", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "場所を作成しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      resetLocationForm();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setCriteriaMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/replenishment", data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "補充基準を設定しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/replenishment"] });
      resetCriteriaForm();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetProductForm = () => {
    setProductForm({
      sku: "",
      modelName: "",
      color: "",
      size: "",
      category: "",
      retailPrice: "",
      costPrice: "",
    });
    setEditingProduct(null);
  };

  const resetLocationForm = () => {
    setLocationForm({
      name: "",
      type: "store",
      displayOrder: "",
    });
    setEditingLocation(null);
  };

  const resetCriteriaForm = () => {
    setCriteriaForm({
      productId: "",
      locationId: "",
      minStock: "",
      targetStock: "",
      standardReplenishment: "",
    });
    setEditingCriteria(null);
  };

  const handleProductSubmit = async () => {
    try {
      await createProductMutation.mutateAsync({
        ...productForm,
        retailPrice: parseFloat(productForm.retailPrice).toString(),
        costPrice: productForm.costPrice ? parseFloat(productForm.costPrice).toString() : undefined,
      });
    } catch (error) {
      console.error("Product creation error:", error);
    }
  };

  const handleLocationSubmit = async () => {
    try {
      await createLocationMutation.mutateAsync({
        ...locationForm,
        displayOrder: parseInt(locationForm.displayOrder) || 0,
      });
    } catch (error) {
      console.error("Location creation error:", error);
    }
  };

  const handleCriteriaSubmit = async () => {
    try {
      await setCriteriaMutation.mutateAsync({
        productId: parseInt(criteriaForm.productId),
        locationId: parseInt(criteriaForm.locationId),
        minStock: parseInt(criteriaForm.minStock),
        targetStock: parseInt(criteriaForm.targetStock),
        standardReplenishment: parseInt(criteriaForm.standardReplenishment),
      });
    } catch (error) {
      console.error("Criteria creation error:", error);
    }
  };

  // Filter products based on search
  const filteredProducts = products?.filter(product =>
    searchProduct === "" || 
    product.sku.toLowerCase().includes(searchProduct.toLowerCase()) ||
    product.modelName.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  return (
    <div data-testid="master-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">マスタ管理</h1>
        <p className="text-sm text-muted-foreground mt-1">商品、場所、補充基準の管理</p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" data-testid="tab-products">商品</TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations">場所</TabsTrigger>
          <TabsTrigger value="criteria" data-testid="tab-criteria">補充基準</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>商品一覧</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="SKUまたは商品名で検索..."
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        className="pl-8"
                        data-testid="input-product-search"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {productsLoading ? (
                    <p>読み込み中...</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table data-testid="table-products">
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>商品名</TableHead>
                            <TableHead>色</TableHead>
                            <TableHead>サイズ</TableHead>
                            <TableHead>店頭価格</TableHead>
                            <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                              <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                                <TableCell className="font-medium">{product.sku}</TableCell>
                                <TableCell>{product.modelName}</TableCell>
                                <TableCell>{product.color}</TableCell>
                                <TableCell>{product.size}</TableCell>
                                <TableCell>¥{parseInt(product.retailPrice).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingProduct(product);
                                      setProductForm({
                                        sku: product.sku,
                                        modelName: product.modelName,
                                        color: product.color,
                                        size: product.size,
                                        category: product.category || "",
                                        retailPrice: product.retailPrice,
                                        costPrice: product.costPrice || "",
                                      });
                                    }}
                                    data-testid={`button-edit-product-${product.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="px-4 py-12 text-center text-muted-foreground" data-testid="empty-products">
                                <div className="flex flex-col items-center">
                                  <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                  <h3 className="font-medium text-lg mb-2">商品データがありません</h3>
                                  {searchProduct ? (
                                    <div className="text-sm space-y-1">
                                      <p>検索条件に一致する商品がありません</p>
                                      <p className="text-xs">別のキーワードで検索してください</p>
                                    </div>
                                  ) : (
                                    <div className="text-sm space-y-1">
                                      <p>まだ商品が登録されていません</p>
                                      <p className="text-xs">右側のフォームから新しい商品を登録してください</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Product Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingProduct ? "商品編集" : "商品登録"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input
                    id="product-sku"
                    value={productForm.sku}
                    onChange={(e) => setProductForm(prev => ({ ...prev, sku: e.target.value }))}
                    data-testid="input-product-sku"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-model">型名</Label>
                  <Input
                    id="product-model"
                    value={productForm.modelName}
                    onChange={(e) => setProductForm(prev => ({ ...prev, modelName: e.target.value }))}
                    data-testid="input-product-model"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-color">色</Label>
                    <Input
                      id="product-color"
                      value={productForm.color}
                      onChange={(e) => setProductForm(prev => ({ ...prev, color: e.target.value }))}
                      data-testid="input-product-color"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-size">サイズ</Label>
                    <Input
                      id="product-size"
                      value={productForm.size}
                      onChange={(e) => setProductForm(prev => ({ ...prev, size: e.target.value }))}
                      data-testid="input-product-size"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-category">カテゴリ</Label>
                  <Input
                    id="product-category"
                    value={productForm.category}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    data-testid="input-product-category"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-retail-price">店頭価格</Label>
                    <Input
                      id="product-retail-price"
                      type="number"
                      value={productForm.retailPrice}
                      onChange={(e) => setProductForm(prev => ({ ...prev, retailPrice: e.target.value }))}
                      data-testid="input-product-retail-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-cost-price">原価</Label>
                    <Input
                      id="product-cost-price"
                      type="number"
                      value={productForm.costPrice}
                      onChange={(e) => setProductForm(prev => ({ ...prev, costPrice: e.target.value }))}
                      data-testid="input-product-cost-price"
                    />
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleProductSubmit}
                    disabled={createProductMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-product"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {editingProduct ? "更新" : "登録"}
                  </Button>
                  {editingProduct && (
                    <Button 
                      variant="outline"
                      onClick={resetProductForm}
                      data-testid="button-cancel-product"
                    >
                      キャンセル
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Location List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>場所一覧</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <p>読み込み中...</p>
                ) : (
                  <div className="space-y-2">
                    {locations && locations.length > 0 ? (
                      locations.map((location) => (
                        <div 
                          key={location.id}
                          className="border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setEditingLocation(location);
                            setLocationForm({
                              name: location.name,
                              type: location.type as "store" | "warehouse",
                              displayOrder: location.displayOrder.toString(),
                            });
                          }}
                          data-testid={`location-item-${location.id}`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{location.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {location.type === 'store' ? '店舗' : '倉庫'} - 表示順: {location.displayOrder}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-edit-location-${location.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8 text-muted-foreground" data-testid="empty-locations">
                        <MapPin className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <h4 className="font-medium mb-1">場所データがありません</h4>
                        <p className="text-xs text-center">倉庫や店舗の場所を登録してください</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingLocation ? "場所編集" : "場所登録"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location-name">場所名</Label>
                  <Input
                    id="location-name"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例: 店舗1, 棚A"
                    data-testid="input-location-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location-type">種類</Label>
                  <Select value={locationForm.type} onValueChange={(value: "store" | "warehouse") => setLocationForm(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger data-testid="select-location-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">店舗</SelectItem>
                      <SelectItem value="warehouse">倉庫</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location-order">表示順</Label>
                  <Input
                    id="location-order"
                    type="number"
                    value={locationForm.displayOrder}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, displayOrder: e.target.value }))}
                    data-testid="input-location-order"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleLocationSubmit}
                    disabled={createLocationMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-location"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {editingLocation ? "更新" : "登録"}
                  </Button>
                  {editingLocation && (
                    <Button 
                      variant="outline"
                      onClick={resetLocationForm}
                      data-testid="button-cancel-location"
                    >
                      キャンセル
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Replenishment Criteria Tab */}
        <TabsContent value="criteria">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Criteria List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>補充基準一覧</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {criteriaLoading ? (
                  <p>読み込み中...</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {replenishmentCriteria && replenishmentCriteria.length > 0 ? (
                      replenishmentCriteria.map((criteria) => (
                        <div 
                          key={criteria.id}
                          className="border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setEditingCriteria(criteria);
                            setCriteriaForm({
                              productId: criteria.productId.toString(),
                              locationId: criteria.locationId.toString(),
                              minStock: criteria.minStock.toString(),
                              targetStock: criteria.targetStock.toString(),
                              standardReplenishment: criteria.standardReplenishment.toString(),
                            });
                          }}
                          data-testid={`criteria-item-${criteria.id}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{criteria.product.sku}</div>
                              <div className="text-sm text-muted-foreground">
                                {criteria.location.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                下限: {criteria.minStock} | 基準: {criteria.targetStock} | 標準: {criteria.standardReplenishment}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-edit-criteria-${criteria.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8 text-muted-foreground" data-testid="empty-replenishment-criteria">
                        <Settings className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <h4 className="font-medium mb-1">補充基準が設定されていません</h4>
                        <p className="text-xs text-center">商品と場所の組み合わせで補充基準を設定してください</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Criteria Form */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingCriteria ? "補充基準編集" : "補充基準設定"}
                </CardTitle>
                <CardDescription>
                  SKU×場所ごとの補充基準を設定します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="criteria-product">商品</Label>
                  <Select value={criteriaForm.productId} onValueChange={(value) => setCriteriaForm(prev => ({ ...prev, productId: value }))}>
                    <SelectTrigger data-testid="select-criteria-product">
                      <SelectValue placeholder="商品を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.sku} - {product.modelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criteria-location">場所</Label>
                  <Select value={criteriaForm.locationId} onValueChange={(value) => setCriteriaForm(prev => ({ ...prev, locationId: value }))}>
                    <SelectTrigger data-testid="select-criteria-location">
                      <SelectValue placeholder="場所を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((location) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="criteria-min">下限在庫</Label>
                    <Input
                      id="criteria-min"
                      type="number"
                      value={criteriaForm.minStock}
                      onChange={(e) => setCriteriaForm(prev => ({ ...prev, minStock: e.target.value }))}
                      data-testid="input-criteria-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="criteria-target">基準在庫</Label>
                    <Input
                      id="criteria-target"
                      type="number"
                      value={criteriaForm.targetStock}
                      onChange={(e) => setCriteriaForm(prev => ({ ...prev, targetStock: e.target.value }))}
                      data-testid="input-criteria-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="criteria-standard">標準補充量</Label>
                    <Input
                      id="criteria-standard"
                      type="number"
                      value={criteriaForm.standardReplenishment}
                      onChange={(e) => setCriteriaForm(prev => ({ ...prev, standardReplenishment: e.target.value }))}
                      data-testid="input-criteria-standard"
                    />
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">補充基準について</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>下限在庫:</strong> この数を下回るとアラートが発生</p>
                    <p><strong>基準在庫:</strong> 補充後に目指す水準</p>
                    <p><strong>標準補充量:</strong> 出荷指示作成時の初期数量</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCriteriaSubmit}
                    disabled={setCriteriaMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-criteria"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {editingCriteria ? "更新" : "設定"}
                  </Button>
                  {editingCriteria && (
                    <Button 
                      variant="outline"
                      onClick={resetCriteriaForm}
                      data-testid="button-cancel-criteria"
                    >
                      キャンセル
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
