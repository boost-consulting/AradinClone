/**
 * Unified RBAC Ability System - Single Truth Table
 * This is the authoritative source for all permission checks across the application.
 */

export type UserRole = 'STORE' | 'WAREHOUSE' | 'ADMIN';

export interface Abilities {
  canCreateShipRequest: boolean;
  canConfirmShipment: boolean;
  canReceiveInbound: boolean;
  canInspectReturns: boolean;
  canSell: boolean;
  canRegisterCustomerReturn: boolean;
  canSendStoreReturn: boolean;
}

/**
 * Single source of truth for all permissions
 * Any permission check in the application must use this function
 */
export function getAbilities(role: UserRole): Abilities {
  return {
    canCreateShipRequest: role === 'STORE',
    canConfirmShipment: role === 'WAREHOUSE',
    canReceiveInbound: role === 'WAREHOUSE',
    canInspectReturns: role === 'WAREHOUSE',
    canSell: role === 'STORE',
    canRegisterCustomerReturn: role === 'STORE',
    canSendStoreReturn: role === 'STORE',
  };
}

/**
 * Helper function to check specific permissions
 */
export function canPerform(role: UserRole, action: keyof Abilities): boolean {
  const abilities = getAbilities(role);
  return abilities[action];
}

/**
 * Convert from database role to standardized role
 */
export function normalizeRole(dbRole: string): UserRole {
  switch (dbRole.toLowerCase()) {
    case 'store':
      return 'STORE';
    case 'warehouse': 
      return 'WAREHOUSE';
    case 'admin':
      return 'ADMIN';
    default:
      return 'STORE'; // Default fallback
  }
}