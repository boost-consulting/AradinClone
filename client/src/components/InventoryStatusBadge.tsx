import { Badge } from "@/components/ui/badge";
import { InventoryState } from "@/lib/types";

interface InventoryStatusBadgeProps {
  state: InventoryState;
  className?: string;
}

export function InventoryStatusBadge({ state, className }: InventoryStatusBadgeProps) {
  const getStatusClass = (state: InventoryState) => {
    switch (state) {
      case '通常':
        return 'inventory-status-normal';
      case '確保':
        return 'inventory-status-reserved';
      case '検品中':
        return 'inventory-status-inspection';
      case '不良':
        return 'inventory-status-defective';
      default:
        return '';
    }
  };

  return (
    <Badge 
      className={`${getStatusClass(state)} ${className || ''}`}
      data-testid={`badge-inventory-${state}`}
    >
      {state}
    </Badge>
  );
}
