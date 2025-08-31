import { 
  users, locations, products, inventoryBalances, replenishmentCriteria, 
  shippingInstructions, inventoryHistory,
  type User, type InsertUser, type Location, type InsertLocation,
  type Product, type InsertProduct, type InventoryBalance, type InsertInventoryBalance,
  type ReplenishmentCriteria, type InsertReplenishmentCriteria,
  type ShippingInstruction, type InsertShippingInstruction,
  type InventoryHistory, type InsertInventoryHistory,
  type InventoryState, type OperationType
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, lt, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Location methods
  getLocations(): Promise<Location[]>;
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location>;

  // Product methods
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;

  // Inventory methods
  getInventoryBalance(productId: number, locationId: number, state: InventoryState): Promise<InventoryBalance | undefined>;
  getInventoryBalances(): Promise<(InventoryBalance & { product: Product; location: Location })[]>;
  getInventoryBalancesByLocation(locationId: number): Promise<(InventoryBalance & { product: Product })[]>;
  getInventoryBalancesByProduct(productId: number): Promise<(InventoryBalance & { location: Location })[]>;
  updateInventoryBalance(productId: number, locationId: number, state: InventoryState, quantity: number): Promise<void>;
  adjustInventory(productId: number, locationId: number, fromState: InventoryState | null, toState: InventoryState, quantity: number, operationType: OperationType, performedBy: string, memo?: string, saleAmount?: number): Promise<void>;

  // Replenishment criteria methods
  getReplenishmentCriteria(): Promise<(ReplenishmentCriteria & { product: Product; location: Location })[]>;
  getReplenishmentCriteriaByLocation(locationId: number): Promise<(ReplenishmentCriteria & { product: Product })[]>;
  setReplenishmentCriteria(criteria: InsertReplenishmentCriteria): Promise<ReplenishmentCriteria>;

  // Shipping instruction methods
  getShippingInstructions(): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User })[]>;
  getPendingShippingInstructions(): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User })[]>;
  getShippingInstruction(id: number): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User }) | undefined>;
  createShippingInstruction(instruction: InsertShippingInstruction): Promise<ShippingInstruction>;
  confirmShippingInstruction(id: number, performedBy: string): Promise<void>;

  // History methods
  getInventoryHistory(limit?: number): Promise<(InventoryHistory & { product: Product; fromLocation?: Location; toLocation?: Location; performer: User })[]>;
  getInventoryHistoryByProduct(productId: number, locationId?: number): Promise<(InventoryHistory & { fromLocation?: Location; toLocation?: Location; performer: User })[]>;
  createHistoryEntry(entry: InsertInventoryHistory): Promise<InventoryHistory>;

  // Analytics methods
  getLowStockAlerts(): Promise<{ product: Product; location: Location; currentStock: number; minStock: number; targetStock: number }[]>;
  getDashboardMetrics(): Promise<{
    pendingShipments: number;
    lowStockItems: number;
    todayReceiving: { processed: number; planned: number };
    weekSales: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.isActive, 1)).orderBy(asc(locations.displayOrder));
  }

  async getLocation(id: number): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [created] = await db.insert(locations).values(location).returning();
    return created;
  }

  async updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location> {
    const [updated] = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
    return updated;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.isActive, 1)).orderBy(asc(products.sku));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async getInventoryBalance(productId: number, locationId: number, state: InventoryState): Promise<InventoryBalance | undefined> {
    const [balance] = await db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.productId, productId),
          eq(inventoryBalances.locationId, locationId),
          eq(inventoryBalances.state, state)
        )
      );
    return balance || undefined;
  }

  async getInventoryBalances(): Promise<(InventoryBalance & { product: Product; location: Location })[]> {
    return await db
      .select()
      .from(inventoryBalances)
      .leftJoin(products, eq(inventoryBalances.productId, products.id))
      .leftJoin(locations, eq(inventoryBalances.locationId, locations.id))
      .where(and(eq(products.isActive, 1), eq(locations.isActive, 1)))
      .then(rows => rows.map(row => ({ ...row.inventory_balances, product: row.products!, location: row.locations! })));
  }

  async getInventoryBalancesByLocation(locationId: number): Promise<(InventoryBalance & { product: Product })[]> {
    return await db
      .select()
      .from(inventoryBalances)
      .leftJoin(products, eq(inventoryBalances.productId, products.id))
      .where(and(eq(inventoryBalances.locationId, locationId), eq(products.isActive, 1)))
      .then(rows => rows.map(row => ({ ...row.inventory_balances, product: row.products! })));
  }

  async getInventoryBalancesByProduct(productId: number): Promise<(InventoryBalance & { location: Location })[]> {
    return await db
      .select()
      .from(inventoryBalances)
      .leftJoin(locations, eq(inventoryBalances.locationId, locations.id))
      .where(and(eq(inventoryBalances.productId, productId), eq(locations.isActive, 1)))
      .then(rows => rows.map(row => ({ ...row.inventory_balances, location: row.locations! })));
  }

  async updateInventoryBalance(productId: number, locationId: number, state: InventoryState, quantity: number): Promise<void> {
    const existing = await this.getInventoryBalance(productId, locationId, state);
    
    if (existing) {
      await db
        .update(inventoryBalances)
        .set({ quantity, lastUpdated: new Date() })
        .where(eq(inventoryBalances.id, existing.id));
    } else {
      await db
        .insert(inventoryBalances)
        .values({ productId, locationId, state, quantity });
    }
  }

  async adjustInventory(
    productId: number, 
    locationId: number, 
    fromState: InventoryState | null, 
    toState: InventoryState, 
    quantity: number, 
    operationType: OperationType, 
    performedBy: string, 
    memo?: string, 
    saleAmount?: number
  ): Promise<void> {
    // Reduce from state if specified
    if (fromState) {
      const fromBalance = await this.getInventoryBalance(productId, locationId, fromState);
      if (fromBalance && fromBalance.quantity >= quantity) {
        await this.updateInventoryBalance(productId, locationId, fromState, fromBalance.quantity - quantity);
      } else {
        throw new Error(`Insufficient inventory in ${fromState} state`);
      }
    }

    // Add to target state
    const toBalance = await this.getInventoryBalance(productId, locationId, toState);
    const newQuantity = (toBalance?.quantity || 0) + quantity;
    await this.updateInventoryBalance(productId, locationId, toState, newQuantity);

    // Create history entry
    await this.createHistoryEntry({
      operationType,
      productId,
      quantity,
      fromLocationId: locationId,
      toLocationId: locationId,
      fromState,
      toState,
      saleAmount: saleAmount?.toString(),
      memo,
      performedBy,
    });
  }

  async getReplenishmentCriteria(): Promise<(ReplenishmentCriteria & { product: Product; location: Location })[]> {
    return await db
      .select()
      .from(replenishmentCriteria)
      .leftJoin(products, eq(replenishmentCriteria.productId, products.id))
      .leftJoin(locations, eq(replenishmentCriteria.locationId, locations.id))
      .where(and(eq(products.isActive, 1), eq(locations.isActive, 1)))
      .then(rows => rows.map(row => ({ ...row.replenishment_criteria, product: row.products!, location: row.locations! })));
  }

  async getReplenishmentCriteriaByLocation(locationId: number): Promise<(ReplenishmentCriteria & { product: Product })[]> {
    return await db
      .select()
      .from(replenishmentCriteria)
      .leftJoin(products, eq(replenishmentCriteria.productId, products.id))
      .where(and(eq(replenishmentCriteria.locationId, locationId), eq(products.isActive, 1)))
      .then(rows => rows.map(row => ({ ...row.replenishment_criteria, product: row.products! })));
  }

  async setReplenishmentCriteria(criteria: InsertReplenishmentCriteria): Promise<ReplenishmentCriteria> {
    const existing = await db
      .select()
      .from(replenishmentCriteria)
      .where(
        and(
          eq(replenishmentCriteria.productId, criteria.productId),
          eq(replenishmentCriteria.locationId, criteria.locationId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(replenishmentCriteria)
        .set(criteria)
        .where(eq(replenishmentCriteria.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(replenishmentCriteria).values(criteria).returning();
      return created;
    }
  }

  async getShippingInstructions(): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User })[]> {
    return await db
      .select()
      .from(shippingInstructions)
      .leftJoin(products, eq(shippingInstructions.productId, products.id))
      .leftJoin(locations, eq(shippingInstructions.fromLocationId, locations.id))
      .leftJoin(users, eq(shippingInstructions.createdBy, users.id))
      .orderBy(desc(shippingInstructions.createdAt))
      .then(rows => rows.map(row => ({ 
        ...row.shipping_instructions, 
        product: row.products!,
        fromLocation: row.locations!,
        toLocation: row.locations!,
        creator: row.users!
      })));
  }

  async getPendingShippingInstructions(): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User })[]> {
    return await db
      .select()
      .from(shippingInstructions)
      .leftJoin(products, eq(shippingInstructions.productId, products.id))
      .leftJoin(locations, eq(shippingInstructions.fromLocationId, locations.id))
      .leftJoin(users, eq(shippingInstructions.createdBy, users.id))
      .where(eq(shippingInstructions.status, 'pending'))
      .orderBy(asc(shippingInstructions.requestedDate))
      .then(rows => rows.map(row => ({ 
        ...row.shipping_instructions, 
        product: row.products!,
        fromLocation: row.locations!,
        toLocation: row.locations!,
        creator: row.users!
      })));
  }

  async getShippingInstruction(id: number): Promise<(ShippingInstruction & { product: Product; fromLocation: Location; toLocation: Location; creator: User }) | undefined> {
    const [result] = await db
      .select()
      .from(shippingInstructions)
      .leftJoin(products, eq(shippingInstructions.productId, products.id))
      .leftJoin(locations, eq(shippingInstructions.fromLocationId, locations.id))
      .leftJoin(users, eq(shippingInstructions.createdBy, users.id))
      .where(eq(shippingInstructions.id, id));

    if (!result) return undefined;

    return { 
      ...result.shipping_instructions, 
      product: result.products!,
      fromLocation: result.locations!,
      toLocation: result.locations!,
      creator: result.users!
    };
  }

  async createShippingInstruction(instruction: InsertShippingInstruction): Promise<ShippingInstruction> {
    const [created] = await db.insert(shippingInstructions).values(instruction).returning();
    return created;
  }

  async confirmShippingInstruction(id: number, performedBy: string): Promise<void> {
    const instruction = await this.getShippingInstruction(id);
    if (!instruction) throw new Error('Shipping instruction not found');

    // Move inventory from warehouse to store
    const warehouseBalance = await this.getInventoryBalance(instruction.productId, instruction.fromLocationId, '通常');
    if (!warehouseBalance || warehouseBalance.quantity < instruction.quantity) {
      throw new Error('Insufficient warehouse inventory');
    }

    // Update warehouse inventory (reduce)
    await this.updateInventoryBalance(instruction.productId, instruction.fromLocationId, '通常', warehouseBalance.quantity - instruction.quantity);

    // Update store inventory (increase)
    const storeBalance = await this.getInventoryBalance(instruction.productId, instruction.toLocationId, '通常');
    await this.updateInventoryBalance(instruction.productId, instruction.toLocationId, '通常', (storeBalance?.quantity || 0) + instruction.quantity);

    // Mark shipping instruction as completed
    await db
      .update(shippingInstructions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(shippingInstructions.id, id));

    // Create history entry
    await this.createHistoryEntry({
      operationType: '出荷確定',
      productId: instruction.productId,
      quantity: instruction.quantity,
      fromLocationId: instruction.fromLocationId,
      toLocationId: instruction.toLocationId,
      fromState: '通常',
      toState: '通常',
      referenceId: id.toString(),
      performedBy,
    });
  }

  async getInventoryHistory(limit: number = 20): Promise<(InventoryHistory & { product: Product; fromLocation?: Location; toLocation?: Location; performer: User })[]> {
    return await db
      .select()
      .from(inventoryHistory)
      .leftJoin(products, eq(inventoryHistory.productId, products.id))
      .leftJoin(locations, eq(inventoryHistory.fromLocationId, locations.id))
      .leftJoin(users, eq(inventoryHistory.performedBy, users.id))
      .orderBy(desc(inventoryHistory.performedAt))
      .limit(limit)
      .then(rows => rows.map(row => ({ 
        ...row.inventory_history, 
        product: row.products!,
        fromLocation: row.locations || undefined,
        toLocation: row.locations || undefined,
        performer: row.users!
      })));
  }

  async getInventoryHistoryByProduct(productId: number, locationId?: number): Promise<(InventoryHistory & { fromLocation?: Location; toLocation?: Location; performer: User })[]> {
    let query = db
      .select()
      .from(inventoryHistory)
      .leftJoin(locations, eq(inventoryHistory.fromLocationId, locations.id))
      .leftJoin(users, eq(inventoryHistory.performedBy, users.id));

    if (locationId) {
      query = query.where(
        and(
          eq(inventoryHistory.productId, productId),
          eq(inventoryHistory.fromLocationId, locationId)
        )
      );
    } else {
      query = query.where(eq(inventoryHistory.productId, productId));
    }

    return await query
      .orderBy(desc(inventoryHistory.performedAt))
      .then(rows => rows.map(row => ({ 
        ...row.inventory_history,
        fromLocation: row.locations || undefined,
        toLocation: row.locations || undefined,
        performer: row.users!
      })));
  }

  async createHistoryEntry(entry: InsertInventoryHistory): Promise<InventoryHistory> {
    const [created] = await db.insert(inventoryHistory).values(entry).returning();
    return created;
  }

  async getLowStockAlerts(): Promise<{ product: Product; location: Location; currentStock: number; minStock: number; targetStock: number }[]> {
    const result = await db
      .select({
        product: products,
        location: locations,
        currentStock: inventoryBalances.quantity,
        minStock: replenishmentCriteria.minStock,
        targetStock: replenishmentCriteria.targetStock,
      })
      .from(replenishmentCriteria)
      .leftJoin(products, eq(replenishmentCriteria.productId, products.id))
      .leftJoin(locations, eq(replenishmentCriteria.locationId, locations.id))
      .leftJoin(
        inventoryBalances,
        and(
          eq(inventoryBalances.productId, replenishmentCriteria.productId),
          eq(inventoryBalances.locationId, replenishmentCriteria.locationId),
          eq(inventoryBalances.state, '通常')
        )
      )
      .where(
        and(
          eq(products.isActive, 1),
          eq(locations.isActive, 1),
          lt(sql`COALESCE(${inventoryBalances.quantity}, 0)`, replenishmentCriteria.minStock)
        )
      );

    return result.map(row => ({
      product: row.product!,
      location: row.location!,
      currentStock: row.currentStock || 0,
      minStock: row.minStock,
      targetStock: row.targetStock,
    }));
  }

  async getDashboardMetrics(): Promise<{
    pendingShipments: number;
    lowStockItems: number;
    todayReceiving: { processed: number; planned: number };
    weekSales: number;
  }> {
    // Get pending shipments count
    const [pendingShipmentsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shippingInstructions)
      .where(eq(shippingInstructions.status, 'pending'));

    // Get low stock alerts count
    const lowStockAlerts = await this.getLowStockAlerts();

    // Get today's receiving data (mock implementation)
    const todayReceiving = { processed: 45, planned: 60 };

    // Get week sales (mock implementation)
    const weekSales = 1247;

    return {
      pendingShipments: pendingShipmentsResult.count,
      lowStockItems: lowStockAlerts.length,
      todayReceiving,
      weekSales,
    };
  }
}

export const storage = new DatabaseStorage();
