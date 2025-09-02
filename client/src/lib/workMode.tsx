import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAbilities, normalizeRole, type UserRole, type Abilities } from './abilities';
import { queryClient } from './queryClient';

export interface WorkMode {
  mode: 'warehouse' | 'store';
  storeId?: number;
  storeName?: string;
}

interface WorkModeContextType {
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  canPerform: (action: keyof Abilities) => boolean;
  abilities: Abilities;
  userRole: UserRole;
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

  const setWorkMode = async (mode: WorkMode) => {
    try {
      // Call server-side session switch API with credentials
      const response = await fetch('/api/auth/switch', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: mode.mode,
          storeId: mode.storeId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to switch session mode: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update local state after successful server update
      setWorkModeState(mode);
      localStorage.setItem('workMode', JSON.stringify(mode));
      
      // Invalidate all relevant queries after mode switch
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipping/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inbounds/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
    } catch (error) {
      console.error('Failed to switch work mode:', error);
      // Keep local state unchanged if server call fails
    }
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

  // Normalize the user role from database
  const userRole = auth ? normalizeRole(auth.role) : 'STORE';
  
  // Get abilities based on user role (unified truth table)
  const abilities = getAbilities(userRole);

  // Permission check using unified ability system
  const canPerform = (action: keyof Abilities): boolean => {
    return abilities[action];
  };

  return (
    <WorkModeContext.Provider value={{ 
      workMode, 
      setWorkMode, 
      canPerform, 
      abilities, 
      userRole 
    }}>
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
