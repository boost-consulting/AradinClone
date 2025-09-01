import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { HistoryEntry } from "@/lib/types";
import { format } from "date-fns";

export function HistorySidebar() {
  const { data: history, isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ["/api/history?limit=20"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getOperationColor = (operationType: string) => {
    switch (operationType) {
      case '販売':
        return 'text-primary';
      case '出荷確定':
        return 'text-accent';
      case '仕入受入':
        return 'text-green-600';
      case '顧客返品':
        return 'text-orange-500';
      case '出荷指示作成':
        return 'text-blue-600';
      case '棚入れ':
        return 'text-purple-600';
      case '在庫確保':
        return 'text-cyan-600';
      case '店舗返品送付':
        return 'text-yellow-600';
      case '返品受入':
        return 'text-red-600';
      case '返品検品':
        return 'text-pink-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  if (isLoading) {
    return (
      <aside className="w-80 bg-card border-l border-border p-4 h-screen sticky top-16 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-2">直近の履歴</h2>
          <p className="text-xs text-muted-foreground">読み込み中...</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-card border-l border-border p-4 h-screen sticky top-16 overflow-y-auto" data-testid="sidebar-history">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">直近の履歴</h2>
        <p className="text-xs text-muted-foreground">最新20件</p>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-3">
          {history?.map((entry) => (
            <div key={entry.id} className="border border-border rounded-lg p-3 bg-background/50" data-testid={`history-entry-${entry.id}`}>
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs font-medium ${getOperationColor(entry.operationType)}`}>
                  {entry.operationType}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(entry.performedAt)}
                </span>
              </div>
              <div className="text-sm font-medium text-foreground mb-1" data-testid={`text-sku-${entry.product.sku}`}>
                {entry.product.sku}
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.fromLocation && entry.toLocation 
                  ? `${entry.fromLocation.name} → ${entry.toLocation.name} (${Math.abs(entry.quantity)}点)`
                  : entry.fromLocation
                  ? `${entry.fromLocation.name} → ${Math.abs(entry.quantity)}点`
                  : `${Math.abs(entry.quantity)}点`
                }
                {entry.saleAmount && ` (¥${parseInt(entry.saleAmount).toLocaleString()})`}
              </div>
              <div className="text-xs text-muted-foreground">
                担当: {entry.performer.username}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <Separator className="my-4" />
      <Button variant="link" className="w-full text-sm" data-testid="button-view-all-history">
        すべての履歴を表示
      </Button>
    </aside>
  );
}
