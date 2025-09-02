import { Link, useLocation } from "wouter";
import { Search, Bell, HelpCircle, Package, ArrowRight, Settings, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HistorySidebar } from "./HistorySidebar";
import { useWorkMode, getWorkModeBadgeColor, getWorkModeDisplayName } from "@/lib/workMode";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { workMode, setWorkMode, canPerform } = useWorkMode();

  // Get current auth data for server session display
  const { data: auth } = useQuery<any>({
    queryKey: ['/api/auth/me'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending shipments count for notification badge
  const { data: pendingShipments } = useQuery<any[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  // Fetch low stock alerts for notification badge
  const { data: lowStockAlerts } = useQuery<any[]>({
    queryKey: ["/api/dashboard/low-stock"],
    refetchInterval: 30000,
  });

  // Fetch stores for dynamic dropdown
  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const pendingShipmentsCount = pendingShipments?.length || 0;
  const lowStockAlertsCount = lowStockAlerts?.length || 0;
  const totalNotifications = pendingShipmentsCount + lowStockAlertsCount;
  const storeOptions = stores?.filter(store => store.type === 'store') || [];

  const navigationTabs = [
    { href: "/", label: "ダッシュボード" },
    { href: "/inventory", label: "在庫一覧" },
    { href: "/warehouse", label: "入出庫" },
    { href: "/sales", label: "販売管理" },
    { href: "/shipping", label: "出荷指示" },
    { href: "/returns", label: "返品管理" },
    { href: "/master", label: "マスタ管理" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="bg-card border-b border-border shadow-sm fixed top-0 left-0 right-0 z-40 h-16">
        <div className="px-6 h-full flex items-center justify-between">
          {/* Logo and System Name */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold">在</span>
              </div>
              <span className="text-xl font-bold text-foreground">在庫管理システム</span>
            </div>
          </div>
          
          {/* Main Navigation */}
          <nav className="hidden lg:flex space-x-1">
            {navigationTabs.map((tab) => (
              <Link key={tab.href} href={tab.href}>
                <Button
                  variant={location === tab.href ? "default" : "ghost"}
                  className={`nav-tab ${location === tab.href ? "active" : ""}`}
                  data-testid={`nav-${tab.href.replace("/", "") || "dashboard"}`}
                >
                  {tab.label}
                </Button>
              </Link>
            ))}
          </nav>
          
          {/* Right Side Controls */}
          <div className="flex items-center space-x-4">
            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="SKU検索..."
                className="w-48 pl-8"
                data-testid="input-sku-search"
              />
            </div>
            
            {/* Notifications Badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {totalNotifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {totalNotifications}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 border-b border-border">
                  <h4 className="font-semibold text-sm">通知 ({totalNotifications}件)</h4>
                  <div className="text-xs text-muted-foreground mt-1">
                    出荷指示: {pendingShipmentsCount}件 | 在庫少数: {lowStockAlertsCount}件
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {/* Pending Shipments */}
                  {pendingShipments && pendingShipments.length > 0 && (
                    <>
                      <div className="p-2 bg-muted/50">
                        <h5 className="text-xs font-medium text-muted-foreground">未処理出荷指示</h5>
                      </div>
                      {pendingShipments.slice(0, 3).map((shipment: any) => (
                        <DropdownMenuItem key={`shipment-${shipment.id}`} asChild>
                          <Link href="/warehouse" className="flex items-start space-x-3 p-3 cursor-pointer">
                            <Package className="h-4 w-4 mt-0.5 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {shipment.product?.sku || 'SKU未設定'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {shipment.fromLocation?.name} → {shipment.toLocation?.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                数量: {shipment.quantity}点
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  {/* Low Stock Alerts */}
                  {lowStockAlerts && lowStockAlerts.length > 0 && (
                    <>
                      <div className="p-2 bg-muted/50">
                        <h5 className="text-xs font-medium text-muted-foreground">在庫少数アラート</h5>
                      </div>
                      {lowStockAlerts.slice(0, 3).map((alert: any, index: number) => (
                        <DropdownMenuItem key={`alert-${alert.product?.id}-${alert.location?.id}-${index}`} asChild>
                          <Link href="/" className="flex items-start space-x-3 p-3 cursor-pointer">
                            <div className="h-4 w-4 mt-0.5 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">!</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {alert.product?.sku || 'SKU未設定'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {alert.location?.name}
                              </div>
                              <div className="text-xs text-orange-600">
                                在庫: {alert.currentStock}点 (最小: {alert.minStock}点)
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  {/* No notifications */}
                  {(!pendingShipments || pendingShipments.length === 0) && (!lowStockAlerts || lowStockAlerts.length === 0) && (
                    <div className="p-6 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm">通知はありません</p>
                    </div>
                  )}
                </div>
                {totalNotifications > 6 && (
                  <div className="p-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-2">
                      {pendingShipmentsCount > 3 && (
                        <Link href="/warehouse">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            すべての出荷指示
                          </Button>
                        </Link>
                      )}
                      {lowStockAlertsCount > 3 && (
                        <Link href="/">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            すべてのアラート
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Work Mode Badge and Switcher */}
            <Badge 
              className={`px-3 py-1 ${getWorkModeBadgeColor(workMode.mode)}`}
              data-testid="badge-work-mode"
            >
              作業モード: {getWorkModeDisplayName(workMode)}
            </Badge>
            
            {/* Work Mode Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-work-mode">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="p-2 border-b border-border">
                  <h4 className="font-semibold text-sm">作業モード切替</h4>
                </div>
                <DropdownMenuItem 
                  onClick={() => setWorkMode({ mode: 'warehouse' })}
                  className={workMode.mode === 'warehouse' ? 'bg-accent' : ''}
                >
                  倉庫モード
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {storeOptions.map((store: any) => (
                  <DropdownMenuItem
                    key={store.id}
                    onClick={() => setWorkMode({ 
                      mode: 'store', 
                      storeId: store.id, 
                      storeName: store.name 
                    })}
                    className={workMode.mode === 'store' && workMode.storeId === store.id ? 'bg-accent' : ''}
                  >
                    {store.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Help */}
            <Button variant="ghost" size="icon" data-testid="button-help">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="pt-16 min-h-screen">
        <div className="flex">
          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
          
          {/* History Sidebar */}
          <HistorySidebar />
        </div>
      </div>
    </div>
  );
}
