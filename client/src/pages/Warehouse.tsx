import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWorkMode } from "@/lib/workMode";
import { 
  Package, Truck, ShoppingCart, AlertCircle, Calendar, MapPin, User, 
  ArrowDown, ArrowUp, CheckCircle2, Loader2, Filter, Search, Lock,
  Clock, Building2, RefreshCw
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function AutoReplenishButton() {
  const { canPerform } = useWorkMode();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const replenishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/inbounds/replenish", { date: 'today' });
    },
    onSuccess: (result: any) => {
      toast({
        title: "自動補充完了",
        description: result?.message || "自動補充が完了しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbounds/pending"] });
    },
    onError: (error) => {
      toast({
        title: "自動補充エラー",
        description: error instanceof Error ? error.message : "エラーが発生しました",
        variant: "destructive",
      });
    },
  });

  const handleReplenish = async () => {
    if (!canPerform('canReceiveInbound')) return;
    
    setIsLoading(true);
    replenishMutation.mutate();
    setIsLoading(false);
  };

  if (!canPerform('canReceiveInbound')) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" disabled>
            <Lock className="h-3 w-3 mr-1" />
            自動補充
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>倉庫モードでのみ実行可能</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button 
      size="sm" 
      variant="outline" 
      onClick={handleReplenish}
      disabled={isLoading || replenishMutation.isPending}
      className="text-xs"
    >
      {isLoading || replenishMutation.isPending ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3 mr-1" />
      )}
      自動補充
    </Button>
  );
}

interface InventoryAdjustment {
  productId: number;
  locationId: number;
  fromState?: string;
  toState?: string;
  quantity: number;
  operationType: string;
  memo?: string;
  saleAmount?: number;
}

interface SaleData {
  productId: number;
  locationId: number;
  quantity: number;
  saleAmount: number;
  discount?: number;
  memo?: string;
}

interface InboundPlan {
  id: number;
  productId: number;
  supplierName: string;
  plannedQty: number;
  receivedQty: number;
  dueDate: string;
  status: string;
  memo?: string;
  product?: any;
  creator?: any;
}

interface PendingShipmentsProps {
  onShipmentSelect?: (shipment: any) => void;
}

function PendingShipmentsPanel({ onShipmentSelect }: PendingShipmentsProps) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { canPerform } = useWorkMode();
  
  const { data: pendingShipments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  const filteredShipments = useMemo(() => {
    if (!pendingShipments) return [];
    
    return pendingShipments.filter(shipment => {
      // Date filter
      if (filter !== 'all') {
        const dueDate = shipment.requestedDate ? new Date(shipment.requestedDate) : null;
        const today = new Date();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        switch (filter) {
          case 'overdue':
            if (!dueDate || dueDate >= today) return false;
            break;
          case 'today':
            if (!dueDate || dueDate.toDateString() !== today.toDateString()) return false;
            break;
          case '7days':
            if (!dueDate || dueDate > weekFromNow) return false;
            break;
        }
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          shipment.product?.sku?.toLowerCase().includes(query) ||
          shipment.toLocation?.name?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [pendingShipments, filter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">未処理出荷指示</h3>
          <Badge variant="secondary">{filteredShipments.length}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="overdue">期限切れ</SelectItem>
              <SelectItem value="today">本日</SelectItem>
              <SelectItem value="7days">7日間</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SKU/店舗検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 pl-8"
            />
          </div>
        </div>
      </div>
      
      {filteredShipments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>未処理の出荷指示はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShipments.map((shipment: any) => {
            const isOverdue = shipment.requestedDate && new Date(shipment.requestedDate) < new Date();
            
            return (
              <div key={shipment.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{shipment.toLocation?.name}</span>
                    {isOverdue && <Badge variant="destructive">期限切れ</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{shipment.product?.sku}</Badge>
                    <Badge variant="secondary">{shipment.quantity}点</Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                  <div>{shipment.product?.modelName}</div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {shipment.requestedDate ? 
                      format(parseISO(shipment.requestedDate), 'MM/dd', { locale: ja }) : 
                      '未設定'
                    }
                  </div>
                </div>
                
                <div className="flex justify-end">
                  {canPerform('canConfirmShipment') ? (
                    <Button 
                      size="sm" 
                      onClick={() => onShipmentSelect?.(shipment)}
                      className="text-xs"
                    >
                      出荷処理
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" disabled className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          出荷処理
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>倉庫モードでのみ実行可能</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PendingInboundProps {
  onInboundSelect?: (plan: InboundPlan) => void;
}

function PendingInboundPanel({ onInboundSelect }: PendingInboundProps) {
  const [filter, setFilter] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const { canPerform } = useWorkMode();

  // Listen for dashboard navigation event to set today filter
  useState(() => {
    const handleSetRange = (event: CustomEvent) => {
      if (event.detail === 'today') {
        setFilter('today');
      }
    };

    window.addEventListener('warehouse:setInboundRange', handleSetRange as EventListener);
    return () => {
      window.removeEventListener('warehouse:setInboundRange', handleSetRange as EventListener);
    };
  });
  
  const { data: inboundData, isLoading } = useQuery({
    queryKey: ["/api/inbounds/pending", filter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        range: filter === 'overdue' ? 'all' : filter,
        include_overdue: filter === 'overdue' ? 'true' : 'false',
        limit: '50',
        offset: '0'
      });
      
      if (searchQuery) {
        params.set('q', searchQuery);
      }
      
      const response = await fetch(`/api/inbounds/pending?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pending inbounds: ${response.statusText}`);
      }
      
      return response.json();
    },
    refetchInterval: 30000,
  });

  const pendingInbounds = (inboundData as any)?.items || [];

  // Server-side filtering eliminates the need for client-side filtering
  const filteredInbounds = pendingInbounds;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">未処理仕入予定</h3>
          <Badge variant="secondary">{filteredInbounds.length}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <AutoReplenishButton />
          
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="overdue">期限切れ</SelectItem>
              <SelectItem value="today">本日</SelectItem>
              <SelectItem value="7days">7日間</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SKU/仕入先検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 pl-8"
            />
          </div>
        </div>
      </div>
      
      {filteredInbounds.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>未処理の仕入予定はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInbounds.map((plan: InboundPlan) => {
            const isOverdue = plan.dueDate && new Date(plan.dueDate) < new Date();
            const remainingQty = plan.plannedQty - plan.receivedQty;
            
            return (
              <div key={plan.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{plan.supplierName}</span>
                    {isOverdue && <Badge variant="destructive">期限切れ</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{plan.product?.sku}</Badge>
                    <Badge variant="secondary">{remainingQty}点</Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                  <div>{plan.product?.modelName}</div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {plan.dueDate ? 
                      format(parseISO(plan.dueDate), 'MM/dd', { locale: ja }) : 
                      '未設定'
                    }
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    進捗: {plan.receivedQty}/{plan.plannedQty}
                  </div>
                  
                  {canPerform('canReceiveInbound') ? (
                    <Button 
                      size="sm" 
                      onClick={() => onInboundSelect?.(plan)}
                      className="text-xs"
                    >
                      受入処理
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" disabled className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          受入処理
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>倉庫モードでのみ実行可能</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ShippingFormProps {
  selectedShipment?: any;
  onSuccess?: () => void;
}

function ShippingProcessForm({ selectedShipment, onSuccess }: ShippingFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { canPerform } = useWorkMode();
  
  const confirmShippingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/shipping/${id}/confirm`);
    },
    onSuccess: () => {
      toast({
        title: "出荷確定完了",
        description: "出荷が正常に確定されました。",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/shipping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "出荷確定に失敗しました。",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const handleConfirm = async () => {
    if (!selectedShipment || !canPerform('canConfirmShipment')) return;
    
    setIsSubmitting(true);
    confirmShippingMutation.mutate(selectedShipment.id);
  };

  if (!selectedShipment) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p>出荷指示を選択してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">出荷処理</h3>
      
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">商品</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedShipment.product?.sku}</Badge>
              <span>{selectedShipment.product?.modelName}</span>
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">数量</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedShipment.quantity}点</Badge>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">出荷元</Label>
            <div>{selectedShipment.fromLocation?.name}</div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">配送先</Label>
            <div>{selectedShipment.toLocation?.name}</div>
          </div>
        </div>
        
        {selectedShipment.requestedDate && (
          <div>
            <Label className="text-sm font-medium">希望配送日</Label>
            <div>{format(parseISO(selectedShipment.requestedDate), 'yyyy年MM月dd日', { locale: ja })}</div>
          </div>
        )}
        
        {selectedShipment.memo && (
          <div>
            <Label className="text-sm font-medium">メモ</Label>
            <div className="text-sm text-muted-foreground">{selectedShipment.memo}</div>
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-2">
        {canPerform('canConfirmShipment') ? (
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting}
            className="min-w-24"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            出荷確定
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled variant="outline" className="min-w-24">
                <Lock className="h-4 w-4 mr-1" />
                出荷確定
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>倉庫モードでのみ実行可能</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

interface InboundFormProps {
  selectedInbound?: InboundPlan;
  onSuccess?: () => void;
}

function InboundReceiveForm({ selectedInbound, onSuccess }: InboundFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    goodQty: 0,
    defectQty: 0,
    shelfId: '',
    memo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { canPerform } = useWorkMode();
  
  const { data: locations } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });
  
  const warehouseShelves = locations?.filter(loc => loc.type === 'warehouse') || [];
  
  const receiveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/inbounds/${selectedInbound!.id}/receive`, data);
    },
    onSuccess: () => {
      toast({
        title: "仕入受入完了",
        description: "仕入が正常に受入されました。",
      });
      
      // Reset form
      setFormData({ goodQty: 0, defectQty: 0, shelfId: '', memo: '' });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/inbounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "仕入受入に失敗しました。",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInbound || !canPerform('canReceiveInbound')) return;
    
    if (!formData.shelfId || (formData.goodQty + formData.defectQty) <= 0) {
      toast({
        title: "入力エラー",
        description: "棚を選択し、数量を入力してください。",
        variant: "destructive"
      });
      return;
    }
    
    const remainingQty = selectedInbound.plannedQty - selectedInbound.receivedQty;
    if ((formData.goodQty + formData.defectQty) > remainingQty) {
      toast({
        title: "入力エラー",
        description: `残り受入数量を超えています（残り: ${remainingQty}点）。`,
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    receiveMutation.mutate({
      goodQty: formData.goodQty,
      defectQty: formData.defectQty,
      shelfId: parseInt(formData.shelfId),
      memo: formData.memo
    });
  };

  if (!selectedInbound) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p>仕入予定を選択してください</p>
      </div>
    );
  }
  
  const remainingQty = selectedInbound.plannedQty - selectedInbound.receivedQty;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">仕入受入</h3>
      
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">商品</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedInbound.product?.sku}</Badge>
              <span>{selectedInbound.product?.modelName}</span>
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">仕入先</Label>
            <div>{selectedInbound.supplierName}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">残り受入数量</Label>
            <div className="text-lg font-semibold">{remainingQty}点</div>
          </div>
          
          <div>
            <Label className="text-sm font-medium">納期</Label>
            <div>{selectedInbound.dueDate ? 
              format(parseISO(selectedInbound.dueDate), 'yyyy年MM月dd日', { locale: ja }) : 
              '未設定'
            }</div>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>良品数量</Label>
            <Input
              type="number"
              min="0"
              max={remainingQty}
              value={formData.goodQty || ''}
              onChange={(e) => setFormData({ ...formData, goodQty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          
          <div className="space-y-2">
            <Label>不良品数量</Label>
            <Input
              type="number"
              min="0"
              max={remainingQty}
              value={formData.defectQty || ''}
              onChange={(e) => setFormData({ ...formData, defectQty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          
          <div className="space-y-2">
            <Label>収納棚</Label>
            <Select
              value={formData.shelfId}
              onValueChange={(value) => setFormData({ ...formData, shelfId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="棚を選択" />
              </SelectTrigger>
              <SelectContent>
                {warehouseShelves.map((shelf) => (
                  <SelectItem key={shelf.id} value={shelf.id.toString()}>
                    {shelf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>メモ</Label>
          <Textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            placeholder="検品結果や特記事項など"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          {canPerform('canReceiveInbound') ? (
            <Button 
              type="submit" 
              disabled={isSubmitting || (formData.goodQty + formData.defectQty) <= 0 || !formData.shelfId}
              className="min-w-24"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              受入確定
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled variant="outline" className="min-w-24">
                  <Lock className="h-4 w-4 mr-1" />
                  受入確定
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>倉庫モードでのみ実行可能</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </form>
    </div>
  );
}

export default function Warehouse() {
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [selectedInbound, setSelectedInbound] = useState<InboundPlan | undefined>(undefined);
  const { workMode } = useWorkMode();

  const handleShipmentSelect = (shipment: any) => {
    setSelectedShipment(shipment);
    setSelectedInbound(undefined);
  };

  const handleInboundSelect = (plan: InboundPlan) => {
    setSelectedInbound(plan);
    setSelectedShipment(null);
    // Auto-switch to inbound tab when selecting an inbound plan
    setTimeout(() => {
      const inboundTab = document.querySelector('[data-value="inbound"]') as HTMLElement;
      if (inboundTab) {
        inboundTab.click();
      }
    }, 100);
  };

  const handleProcessSuccess = () => {
    setSelectedShipment(null);
    setSelectedInbound(undefined);
  };

  return (
    <div className="space-y-6" data-testid="warehouse-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">入出庫管理</h1>
        <Badge variant="outline" className="text-sm">
          作業モード: {workMode.mode === 'warehouse' ? '倉庫' : workMode.storeName || '店舗'}
        </Badge>
      </div>
      
      {/* Upper Section: Parallel Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Pending Shipments */}
        <Card className="h-[400px]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              未処理出荷指示
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[calc(100%-4rem)] overflow-y-auto">
            <PendingShipmentsPanel onShipmentSelect={handleShipmentSelect} />
          </CardContent>
        </Card>
        
        {/* Right Panel: Pending Inbound Plans */}
        <Card className="h-[400px]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-green-600" />
              未処理仕入予定
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[calc(100%-4rem)] overflow-y-auto">
            <PendingInboundPanel onInboundSelect={handleInboundSelect} />
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      {/* Lower Section: Processing Forms */}
      <Tabs defaultValue="shipping" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shipping">出荷処理</TabsTrigger>
          <TabsTrigger value="inbound">仕入受入</TabsTrigger>
        </TabsList>
        
        <TabsContent value="shipping">
          <Card>
            <CardContent className="p-6">
              <ShippingProcessForm 
                selectedShipment={selectedShipment} 
                onSuccess={handleProcessSuccess}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="inbound">
          <Card>
            <CardContent className="p-6">
              <InboundReceiveForm 
                selectedInbound={selectedInbound}
                onSuccess={handleProcessSuccess}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}