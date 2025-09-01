import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUp, Truck, Package, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { DashboardMetrics, LowStockAlert, PendingShipment } from "@/lib/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 30000,
  });

  const { data: lowStockAlerts, isLoading: alertsLoading } = useQuery<LowStockAlert[]>({
    queryKey: ["/api/dashboard/low-stock"],
    refetchInterval: 30000,
  });

  const { data: pendingShipments, isLoading: shipmentsLoading } = useQuery<PendingShipment[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  const { data: inventorySummary, isLoading: summaryLoading } = useQuery<{
    通常: number;
    確保: number;
    検品中: number;
    不良: number;
  }>({
    queryKey: ["/api/dashboard/inventory-summary"],
    refetchInterval: 30000,
  });

  const today = format(new Date(), 'yyyy年M月d日 (E)', { locale: ja });

  // Navigation handlers
  const handlePendingShipmentsClick = () => setLocation('/warehouse');
  const handleReceivingClick = () => setLocation('/warehouse');
  const handleLowStockClick = () => setLocation('/shipping');
  const handleSalesClick = () => setLocation('/sales');
  const handleQuickReceiving = () => setLocation('/warehouse');
  const handleQuickSales = () => setLocation('/sales');
  const handleQuickShipping = () => setLocation('/shipping');
  const handleQuickReturns = () => setLocation('/returns');

  if (metricsLoading || alertsLoading || shipmentsLoading || summaryLoading) {
    return (
      <div data-testid="dashboard-loading">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-date">
          {today} - 在庫状況と未処理業務の概要
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Pending Shipments */}
        <Card className="metric-card cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-pending-shipments" onClick={handlePendingShipmentsClick}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">未処理出荷指示</CardTitle>
            <Truck className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground" data-testid="text-pending-count">
              {metrics?.pendingShipments || 0}件
            </div>
            <div className="text-xs text-muted-foreground">期限近順</div>
            <div className="space-y-1">
              {pendingShipments && pendingShipments.length > 0 ? (
                pendingShipments.slice(0, 3).map((shipment) => (
                  <div key={shipment.id} className="text-xs text-destructive hover:underline cursor-pointer" data-testid={`link-shipment-${shipment.id}`}>
                    {shipment.toLocation.name}: {shipment.product.sku} ({shipment.requestedDate ? format(new Date(shipment.requestedDate), 'M/d') : ''}期限)
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground" data-testid="empty-pending-shipments">
                  現在、未処理の出荷指示はありません
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Receiving */}
        <Card className="metric-card cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-receiving" onClick={handleReceivingClick}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本日の仕入受入</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              <span className="text-primary" data-testid="text-processed-count">{metrics?.todayReceiving.processed || 0}</span>
              /<span className="text-muted-foreground" data-testid="text-planned-count">{metrics?.todayReceiving.planned || 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">処理済／予定数</div>
            <Progress 
              value={metrics?.todayReceiving.planned ? (metrics.todayReceiving.processed / metrics.todayReceiving.planned) * 100 : 0} 
              className="w-full h-2"
              data-testid="progress-receiving"
            />
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="metric-card cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-low-stock" onClick={handleLowStockClick}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">在庫少数アラート</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-destructive" data-testid="text-low-stock-count">
              {metrics?.lowStockItems || 0}件
            </div>
            <div className="text-xs text-muted-foreground">下限割れSKU</div>
            <div className="space-y-1">
              {lowStockAlerts?.slice(0, 3).map((alert, index) => (
                <div key={`alert-card-${alert.product.id}-${alert.location.id}-${index}`} className="text-xs text-destructive hover:underline cursor-pointer" data-testid={`link-alert-${alert.product.sku}-${index}`}>
                  {alert.product.sku} (在庫: {alert.currentStock})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Sales */}
        <Card className="metric-card cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-sales" onClick={handleSalesClick}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">直近7日の販売</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground" data-testid="text-week-sales">
              {metrics?.weekSales?.toLocaleString() || 0}点
            </div>
            <div className="text-xs text-muted-foreground">店舗合計</div>
            <div className="flex items-center text-xs text-green-600">
              <ArrowUp className="h-3 w-3 mr-1" />
              前週比 +8.3%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pending Shipments List */}
        <Card>
          <CardHeader>
            <CardTitle>未処理出荷指示</CardTitle>
            <CardDescription>期限順で表示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-pending-shipments">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">店舗</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">数量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">希望日</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">作成日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingShipments && pendingShipments.length > 0 ? (
                    pendingShipments.map((shipment) => (
                      <tr key={shipment.id} className="table-hover cursor-pointer" data-testid={`row-shipment-${shipment.id}`}>
                        <td className="px-4 py-3 text-sm">{shipment.toLocation.name}</td>
                        <td className="px-4 py-3 text-sm font-medium">{shipment.product.sku}</td>
                        <td className="px-4 py-3 text-sm">{shipment.quantity}</td>
                        <td className="px-4 py-3 text-sm text-destructive font-medium">
                          {shipment.requestedDate ? format(new Date(shipment.requestedDate), 'M/d') : '未設定'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {format(new Date(shipment.createdAt), 'M/d HH:mm')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" data-testid="empty-pending-shipments-table">
                        <div className="flex flex-col items-center">
                          <Truck className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p>現在、未処理の出荷指示はありません</p>
                          <p className="text-xs mt-1">新しい出荷指示が作成されると、ここに表示されます</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <Button variant="link" className="text-sm p-0" onClick={() => setLocation('/warehouse')} data-testid="button-view-all-shipments">
                すべての出荷指示を表示 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert Details */}
        <Card>
          <CardHeader>
            <CardTitle>少数アラート詳細</CardTitle>
            <CardDescription>下限在庫を下回った商品</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-low-stock-alerts">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">場所</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">現在庫</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">下限</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">基準</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lowStockAlerts && lowStockAlerts.length > 0 ? (
                    lowStockAlerts.map((alert, index) => (
                      <tr key={`alert-table-${alert.product.id}-${alert.location.id}-${index}`} className="table-hover cursor-pointer bg-red-50" data-testid={`row-alert-${alert.product.sku}-${alert.location.id}-${index}`}>
                        <td className="px-4 py-3 text-sm font-medium">{alert.product.sku}</td>
                        <td className="px-4 py-3 text-sm">{alert.location.name}</td>
                        <td className="px-4 py-3 text-sm text-destructive font-bold">{alert.currentStock}</td>
                        <td className="px-4 py-3 text-sm">{alert.minStock}</td>
                        <td className="px-4 py-3 text-sm">{alert.targetStock}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" data-testid="empty-low-stock-alerts">
                        <div className="flex flex-col items-center">
                          <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p>現在、在庫不足のアラートはありません</p>
                          <p className="text-xs mt-1">すべての商品が適正在庫を維持しています</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <Button variant="link" className="text-sm p-0" onClick={() => setLocation('/shipping')} data-testid="button-view-all-alerts">
                すべてのアラートを表示 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Status Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>在庫状態別サマリ</CardTitle>
          <CardDescription>全場所の在庫状態別数量</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-green-200 rounded-lg bg-green-50" data-testid="summary-normal">
              <div className="text-2xl font-bold text-green-800">{(inventorySummary?.通常 || 0).toLocaleString()}</div>
              <div className="text-sm font-medium text-green-700">通常</div>
              <div className="text-xs text-green-600">販売・出荷可能</div>
            </div>
            <div className="text-center p-4 border border-blue-200 rounded-lg bg-blue-50" data-testid="summary-reserved">
              <div className="text-2xl font-bold text-blue-800">{(inventorySummary?.確保 || 0).toLocaleString()}</div>
              <div className="text-sm font-medium text-blue-700">確保</div>
              <div className="text-xs text-blue-600">出荷予定分</div>
            </div>
            <div className="text-center p-4 border border-yellow-200 rounded-lg bg-yellow-50" data-testid="summary-inspection">
              <div className="text-2xl font-bold text-yellow-800">{(inventorySummary?.検品中 || 0).toLocaleString()}</div>
              <div className="text-sm font-medium text-yellow-700">検品中</div>
              <div className="text-xs text-yellow-600">確認待ち</div>
            </div>
            <div className="text-center p-4 border border-red-200 rounded-lg bg-red-50" data-testid="summary-defective">
              <div className="text-2xl font-bold text-red-800">{(inventorySummary?.不良 || 0).toLocaleString()}</div>
              <div className="text-sm font-medium text-red-700">不良</div>
              <div className="text-xs text-red-600">販売不可</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>クイックアクション</CardTitle>
          <CardDescription>よく使用する機能への直接アクセス</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="flex flex-col items-center p-4 h-auto hover:bg-muted/50 hover:border-primary/50"
              onClick={handleQuickReceiving}
              data-testid="button-quick-receiving"
            >
              <Package className="h-6 w-6 text-primary mb-2" />
              <span className="text-sm font-medium">仕入受入</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center p-4 h-auto hover:bg-muted/50 hover:border-primary/50"
              onClick={handleQuickSales}
              data-testid="button-quick-sales"
            >
              <TrendingUp className="h-6 w-6 text-green-600 mb-2" />
              <span className="text-sm font-medium">販売登録</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center p-4 h-auto hover:bg-muted/50 hover:border-primary/50"
              onClick={handleQuickShipping}
              data-testid="button-quick-shipping"
            >
              <Truck className="h-6 w-6 text-accent mb-2" />
              <span className="text-sm font-medium">出荷指示</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center p-4 h-auto hover:bg-muted/50 hover:border-primary/50"
              onClick={handleQuickReturns}
              data-testid="button-quick-returns"
            >
              <ArrowUp className="h-6 w-6 text-orange-500 mb-2" />
              <span className="text-sm font-medium">返品処理</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
