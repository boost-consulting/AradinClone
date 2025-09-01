import { Link, useLocation } from "wouter";
import { Search, Bell, HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HistorySidebar } from "./HistorySidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  // Fetch pending shipments count for notification badge
  const { data: pendingShipments } = useQuery<any[]>({
    queryKey: ["/api/shipping/pending"],
    refetchInterval: 30000,
  });

  const pendingShipmentsCount = pendingShipments?.length || 0;

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
            <div className="relative">
              <Button variant="ghost" size="icon" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
                {pendingShipmentsCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {pendingShipmentsCount}
                  </Badge>
                )}
              </Button>
            </div>
            
            {/* User Info and Store Selection */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium">倉庫ユーザー</div>
                <div className="text-xs text-muted-foreground">管理者</div>
              </div>
              <Select defaultValue="store1">
                <SelectTrigger className="w-32" data-testid="select-store">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store1">店舗1</SelectItem>
                  <SelectItem value="store2">店舗2</SelectItem>
                  <SelectItem value="store3">店舗3</SelectItem>
                  <SelectItem value="store4">店舗4</SelectItem>
                  <SelectItem value="store5">店舗5</SelectItem>
                  <SelectItem value="store6">店舗6</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
