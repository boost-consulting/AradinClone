import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface WorkMode {
  mode: 'warehouse' | 'store';
  storeId?: number;
  storeName?: string;
}

interface WorkModeContextType {
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  canPerform: (action: string) => boolean;
}

const WorkModeContext = createContext<WorkModeContextType | undefined>(undefined);

interface WorkModeProviderProps {
  children: ReactNode;
}

export function WorkModeProvider({ children }: WorkModeProviderProps) {
  const [workMode, setWorkModeState] = useState<WorkMode>(() => {
    // Try to restore from localStorage
    const saved = localStorage.getItem('workMode');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back to default
      }
    }
    return { mode: 'store' };
  });

  const { data: auth } = useQuery<any>({
    queryKey: ['/api/auth/me'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ['/api/locations'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const setWorkMode = (mode: WorkMode) => {
    setWorkModeState(mode);
    localStorage.setItem('workMode', JSON.stringify(mode));
  };

  // Auto-set work mode based on user role if not already set
  useEffect(() => {
    if (auth && locations && Array.isArray(locations)) {
      const stores = locations.filter((l: any) => l.type === 'store');
      
      if (auth.role === 'warehouse' && workMode.mode !== 'warehouse') {
        setWorkMode({ mode: 'warehouse' });
      } else if (auth.role === 'store' && workMode.mode !== 'store' && auth.storeId) {
        const userStore = stores.find((s: any) => s.id === auth.storeId);
        if (userStore) {
          setWorkMode({ 
            mode: 'store', 
            storeId: userStore.id, 
            storeName: userStore.name 
          });
        }
      }
    }
  }, [auth, locations, workMode.mode]);

  const canPerform = (action: string): boolean => {
    if (!auth || !auth.role) return false;
    
    const { mode } = workMode;
    const userRole = auth.role;

    // Permission matrix
    const permissions: Record<string, string[]> = {
      'shipping.create': ['store'],
      'shipping.confirm': ['warehouse'],
      'sales.create': ['store'],
      'returns.customer': ['store'],
      'returns.send': ['store'],
      'inbound.create': ['warehouse'],
      'inbound.receive': ['warehouse'],
      'returns.inspect': ['warehouse'],
    };

    const requiredRoles = permissions[action];
    if (!requiredRoles) return true; // Default allow for undefined actions

    // Check if current work mode allows this action
    return requiredRoles.includes(mode) && requiredRoles.includes(userRole);
  };

  return (
    <WorkModeContext.Provider value={{ workMode, setWorkMode, canPerform }}>
      {children}
    </WorkModeContext.Provider>
  );
}

export function useWorkMode() {
  const context = useContext(WorkModeContext);
  if (context === undefined) {
    throw new Error('useWorkMode must be used within a WorkModeProvider');
  }
  return context;
}

export function getWorkModeBadgeColor(mode: WorkMode['mode']) {
  switch (mode) {
    case 'warehouse':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'store':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

export function getWorkModeDisplayName(mode: WorkMode) {
  if (mode.mode === 'warehouse') {
    return '倉庫';
  }
  return mode.storeName || `店舗${mode.storeId}`;
}
