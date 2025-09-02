import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { seedDatabase, resetAndReseed } from "./seed";
import { 
  insertProductSchema, insertLocationSchema, insertShippingInstructionSchema,
  insertReplenishmentCriteriaSchema, insertInventoryHistorySchema, insertUserSchema,
  insertInboundPlanSchema,
  users, locations, products, inventoryBalances, replenishmentCriteria, 
  shippingInstructions, inboundPlans, inventoryHistory
} from "@shared/schema";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";

// Extend Express Session interface
declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
    storeId?: number;
  }
}

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Authorization middleware for different roles
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.role || !roles.includes(req.session.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

// Request schemas
const saleSchema = z.object({
  productId: z.number(),
  locationId: z.number(),
  quantity: z.number().positive().int(),
  saleAmount: z.number().positive(),
  discount: z.number().optional(),
  memo: z.string().optional(),
});

const adjustInventorySchema = z.object({
  productId: z.number(),
  locationId: z.number(),
  fromState: z.enum(['通常', '確保', '検品中', '不良']).optional(),
  toState: z.enum(['通常', '確保', '検品中', '不良']).optional(), // Now optional for reduction-only operations
  quantity: z.number().positive().int(), // Always positive integers only
  operationType: z.enum(['販売', '顧客返品', '出荷指示作成', '在庫確保', '出荷確定', '仕入受入', '棚入れ', '店舗返品送付', '返品受入', '返品検品']),
  memo: z.string().optional(),
  saleAmount: z.number().optional(),
});

// New dedicated schema for reduction-only operations (sales, returns)
const reductionOnlySchema = z.object({
  productId: z.number(),
  locationId: z.number(),
  fromState: z.enum(['通常', '確保', '検品中', '不良']),
  quantity: z.number().positive().int(), // Always positive for reduction amount
  operationType: z.enum(['販売', '店舗返品送付']),
  memo: z.string().optional(),
  saleAmount: z.number().optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.authenticateUser(username, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.storeId = user.storeId || undefined;
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          storeId: user.storeId 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    // Auto-login for demo purposes
    if (!req.session.userId) {
      try {
        // Default to store_user for demo
        const user = await storage.getUserByUsername("store_user");
        if (user) {
          req.session.userId = user.id;
          req.session.role = user.role;
          req.session.storeId = user.storeId || undefined;
        }
      } catch (error) {
        // Ignore auto-login errors
      }
    }
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.json({
      userId: req.session.userId,
      role: req.session.role,
      storeId: req.session.storeId
    });
  });

  // User management routes
  app.get("/api/users", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Demo data management (admin only, development environment only)
  app.post("/api/admin/reset-demo-data", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ message: "Demo data reset not allowed in production" });
      }

      await resetAndReseed();
      res.json({ message: "Demo data reset and reseeded successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset demo data" });
    }
  });

  // Inventory state summary
  app.get("/api/dashboard/inventory-summary", async (req, res) => {
    try {
      const summary = await storage.getInventoryStateSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory state summary" });
    }
  });

  // Low stock alerts
  app.get("/api/dashboard/low-stock", async (req, res) => {
    try {
      const alerts = await storage.getLowStockAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock alerts" });
    }
  });

  // Pending shipping instructions
  app.get("/api/shipping/pending", async (req, res) => {
    try {
      const instructions = await storage.getPendingShippingInstructions();
      res.json(instructions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending shipping instructions" });
    }
  });

  // All shipping instructions
  app.get("/api/shipping", async (req, res) => {
    try {
      const instructions = await storage.getShippingInstructions();
      res.json(instructions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping instructions" });
    }
  });

  // Create shipping instruction
  app.post("/api/shipping", requireAuth, requireRole('store'), async (req, res) => {
    try {
      const requestData = { ...req.body, createdBy: req.session.userId };
      const data = insertShippingInstructionSchema.parse(requestData);
      const instruction = await storage.createShippingInstruction(data);
      
      // Create history entry (information only - no inventory movement)
      await storage.createHistoryEntry({
        operationType: '出荷指示作成',
        productId: data.productId,
        quantity: data.quantity,
        fromLocationId: null, // No inventory movement on creation
        toLocationId: null,   // No inventory movement on creation
        referenceId: instruction.id.toString(),
        memo: data.memo,
        performedBy: data.createdBy,
      });

      res.json(instruction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create shipping instruction" });
      }
    }
  });

  // Confirm shipping instruction
  app.post("/api/shipping/:id/confirm", requireAuth, requireRole('warehouse'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const performedBy = req.session.userId!;
      
      await storage.confirmShippingInstruction(id, performedBy);
      res.json({ message: "Shipping instruction confirmed" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to confirm shipping" });
    }
  });

  // Inbound plan routes
  app.get("/api/inbounds", requireAuth, async (req, res) => {
    try {
      const plans = await storage.getInboundPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inbound plans" });
    }
  });

  app.get("/api/inbounds/pending", requireAuth, async (req, res) => {
    try {
      const { range = 'all', include_overdue = 'false', q = '', limit = 50, offset = 0 } = req.query;
      
      const filters = {
        range: range as string,
        includeOverdue: include_overdue === 'true',
        searchQuery: q as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };
      
      const result = await storage.getPendingInboundPlans(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending inbound plans" });
    }
  });

  app.post("/api/inbounds", requireAuth, requireRole('warehouse'), async (req, res) => {
    try {
      const planData = insertInboundPlanSchema.parse(req.body);
      planData.createdBy = req.session.userId!;
      
      const plan = await storage.createInboundPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error('Error creating inbound plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors.map(e => ({ path: e.path, message: e.message }))
        });
      }
      const message = error instanceof Error ? error.message : "Failed to create inbound plan";
      res.status(500).json({ message });
    }
  });

  app.post("/api/inbounds/:id/receive", requireAuth, requireRole('warehouse'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid inbound plan ID" });
      }

      const receiveData = z.object({
        goodQty: z.number().int().min(0),
        defectQty: z.number().int().min(0),
        shelfId: z.number().int().positive(),
        memo: z.string().optional().default("")
      }).parse(req.body);

      if (receiveData.goodQty + receiveData.defectQty <= 0) {
        return res.status(400).json({ message: "Total quantity must be greater than 0" });
      }

      await storage.receiveInboundPlan(
        id, 
        receiveData.goodQty, 
        receiveData.defectQty, 
        receiveData.shelfId, 
        receiveData.memo, 
        req.session.userId!
      );
      
      res.json({ message: "Inbound received successfully" });
    } catch (error) {
      console.error('Error receiving inbound:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors.map(e => ({ path: e.path, message: e.message }))
        });
      }
      const message = error instanceof Error ? error.message : "Failed to receive inbound";
      res.status(500).json({ message });
    }
  });

  // Auto-replenishment endpoint
  app.post("/api/inbounds/replenish", requireAuth, requireRole('warehouse'), async (req, res) => {
    try {
      const { date = 'today' } = req.query;
      
      const result = await storage.autoReplenishInventory(date as string, req.session.userId!);
      res.json(result);
    } catch (error) {
      console.error('Error in auto-replenishment:', error);
      const message = error instanceof Error ? error.message : "Failed to auto-replenish inventory";
      res.status(500).json({ message });
    }
  });

  // Inventory balances
  app.get("/api/inventory", async (req, res) => {
    try {
      const { locationId, productId } = req.query;
      
      let balances;
      if (locationId) {
        balances = await storage.getInventoryBalancesByLocation(parseInt(locationId as string));
      } else if (productId) {
        balances = await storage.getInventoryBalancesByProduct(parseInt(productId as string));
      } else {
        balances = await storage.getInventoryBalances();
      }
      
      res.json(balances);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory balances" });
    }
  });

  // Adjust inventory (for sales, returns, etc.)
  app.post("/api/inventory/adjust", requireAuth, async (req, res) => {
    try {
      const data = adjustInventorySchema.parse(req.body);
      const performedBy = req.session.userId!;
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        data.fromState || null,
        data.toState || null,
        data.quantity,
        data.operationType,
        performedBy,
        data.memo,
        data.saleAmount
      );
      
      res.json({ message: "Inventory adjusted successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to adjust inventory" });
      }
    }
  });

  // Sales
  app.post("/api/sales", requireAuth, async (req, res) => {
    try {
      const data = saleSchema.parse(req.body);
      const performedBy = req.session.userId!;
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        '通常',
        null, // No toState for sales - only reduce from normal inventory
        data.quantity, // Positive quantity for reduction
        '販売',
        performedBy,
        data.memo,
        data.saleAmount
      );
      
      res.json({ message: "Sale recorded successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to record sale" });
      }
    }
  });

  // Store return shipment (reduction-only operation)
  app.post("/api/returns/ship", requireAuth, async (req, res) => {
    try {
      const data = reductionOnlySchema.parse(req.body);
      const performedBy = req.session.userId!;
      
      if (data.operationType !== '店舗返品送付') {
        return res.status(400).json({ message: "Invalid operation type for return shipment" });
      }
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        data.fromState, // fromState is required for returns
        null, // No toState for return shipments - only reduce from store
        data.quantity, // Positive quantity for reduction amount
        '店舗返品送付',
        performedBy,
        data.memo
      );
      
      res.json({ message: "Return shipment processed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to process return shipment" });
      }
    }
  });

  // Customer returns (increases inventory)
  app.post("/api/returns/customer", requireAuth, async (req, res) => {
    try {
      const data = adjustInventorySchema.parse(req.body);
      const performedBy = req.session.userId!;
      
      if (data.operationType !== '顧客返品') {
        return res.status(400).json({ message: "Invalid operation type for customer return" });
      }
      
      if (!data.toState) {
        return res.status(400).json({ message: "toState is required for customer returns" });
      }
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        null, // No fromState for customer returns
        data.toState, // Add to normal or defective inventory
        data.quantity,
        '顧客返品',
        performedBy,
        data.memo
      );
      
      res.json({ message: "Customer return processed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to process customer return" });
      }
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create product" });
      }
    }
  });

  app.get("/api/products/:sku", async (req, res) => {
    try {
      const product = await storage.getProductBySku(req.params.sku);
      if (!product) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const data = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(data);
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create location" });
      }
    }
  });

  // Replenishment criteria
  app.get("/api/replenishment", async (req, res) => {
    try {
      const { locationId } = req.query;
      
      let criteria;
      if (locationId) {
        criteria = await storage.getReplenishmentCriteriaByLocation(parseInt(locationId as string));
      } else {
        criteria = await storage.getReplenishmentCriteria();
      }
      
      res.json(criteria);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch replenishment criteria" });
    }
  });

  app.post("/api/replenishment", async (req, res) => {
    try {
      const data = insertReplenishmentCriteriaSchema.parse(req.body);
      const criteria = await storage.setReplenishmentCriteria(data);
      res.json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to set replenishment criteria" });
      }
    }
  });

  // Seed data
  app.post("/api/seed", async (req, res) => {
    try {
      // Create demo users if they don't exist
      let warehouseUser = await db.select().from(users).where(eq(users.role, 'warehouse')).limit(1);
      let storeUser = await db.select().from(users).where(eq(users.role, 'store')).limit(1);
      
      if (warehouseUser.length === 0) {
        await db.insert(users).values({
          id: 'warehouse_user',
          username: 'warehouse_user',
          password: 'password',
          role: 'warehouse',
          storeId: null
        }).onConflictDoNothing();
        warehouseUser = await db.select().from(users).where(eq(users.id, 'warehouse_user')).limit(1);
      }
      
      if (storeUser.length === 0) {
        await db.insert(users).values({
          id: 'store_user',
          username: 'store_user',
          password: 'password',
          role: 'store',
          storeId: null
        }).onConflictDoNothing();
        storeUser = await db.select().from(users).where(eq(users.id, 'store_user')).limit(1);
      }

      const warehouseUserId = warehouseUser[0].id;
      const storeUserId = storeUser[0].id;

      // Create locations (warehouse shelves + stores)
      await db.insert(locations).values([
        { name: '倉庫 棚A', type: 'warehouse', code: 'SHELF_A', displayOrder: 1 },
        { name: '倉庫 棚B', type: 'warehouse', code: 'SHELF_B', displayOrder: 2 },
        { name: '倉庫 棚C', type: 'warehouse', code: 'SHELF_C', displayOrder: 3 },
        { name: '店舗1', type: 'store', code: 'STORE_1', displayOrder: 4 },
        { name: '店舗2', type: 'store', code: 'STORE_2', displayOrder: 5 },
        { name: '店舗3', type: 'store', code: 'STORE_3', displayOrder: 6 },
        { name: '店舗4', type: 'store', code: 'STORE_4', displayOrder: 7 },
        { name: '店舗5', type: 'store', code: 'STORE_5', displayOrder: 8 },
        { name: '店舗6', type: 'store', code: 'STORE_6', displayOrder: 9 },
      ]).onConflictDoNothing();

      // Create products (12 models × 2 colors × 3 sizes = 72 SKUs)
      const productData: any[] = [];
      const models = [
        'Tシャツ01', 'Tシャツ02', 'シャツ01', 'シャツ02', 'パンツ01', 'パンツ02',
        'ジーンズ01', 'ジーンズ02', 'ジャケット01', 'ジャケット02', 'セーター01', 'セーター02'
      ];
      const colors = ['BK', 'WH']; // Black, White
      const sizes = ['S', 'M', 'L'];
      const prices = [2980, 3980, 4980, 5980, 6980, 7980, 8980, 9980, 12980, 14980, 16980, 18980];

      models.forEach((model, modelIndex) => {
        colors.forEach(color => {
          sizes.forEach(size => {
            const sku = `${model.replace(/[^A-Z0-9]/g, '')}${modelIndex + 1 < 10 ? '0' + (modelIndex + 1) : modelIndex + 1}-${color}-${size}`;
            productData.push({
              sku,
              modelName: model,
              color: color === 'BK' ? 'ブラック' : 'ホワイト',
              size,
              category: model.includes('Tシャツ') || model.includes('シャツ') ? 'トップス' : 'ボトムス',
              retailPrice: prices[modelIndex].toString(),
              costPrice: (prices[modelIndex] * 0.6).toString(),
            });
          });
        });
      });

      await db.insert(products).values(productData.slice(0, 30)).onConflictDoNothing(); // Insert first 30 products

      // Get created product and location IDs
      const createdProducts = await db.select().from(products).limit(30);
      const createdLocations = await db.select().from(locations);

      // Create inventory balances (warehouse: 20 per SKU, stores: 0-5 per SKU)
      const inventoryData: any[] = [];
      createdProducts.forEach(product => {
        // Warehouse shelves (A=10, B=6, C=4)
        inventoryData.push(
          { productId: product.id, locationId: 1, state: '通常', quantity: 10 }, // 棚A
          { productId: product.id, locationId: 2, state: '通常', quantity: 6 },  // 棚B
          { productId: product.id, locationId: 3, state: '通常', quantity: 4 },  // 棚C
        );
        
        // Stores (random 0-5 quantity, mostly normal with some defective)
        for (let storeIndex = 4; storeIndex <= 9; storeIndex++) {
          const quantity = Math.floor(Math.random() * 6); // 0-5
          if (quantity > 0) {
            const isDefective = Math.random() < 0.1; // 10% chance of defective
            inventoryData.push({
              productId: product.id,
              locationId: storeIndex,
              state: isDefective ? '不良' : '通常',
              quantity
            });
          }
        }
      });

      await db.insert(inventoryBalances).values(inventoryData).onConflictDoNothing();

      // Create replenishment criteria
      const replenishmentData: any[] = [];
      createdProducts.forEach(product => {
        // Store criteria: min=2, base=5, target=5
        for (let storeIndex = 4; storeIndex <= 9; storeIndex++) {
          replenishmentData.push({
            productId: product.id,
            locationId: storeIndex,
            minStock: 2,
            baseStock: 5,
            targetStock: 5,
          });
        }
        // Warehouse criteria: min=5, base=15, target=20
        for (let warehouseIndex = 1; warehouseIndex <= 3; warehouseIndex++) {
          replenishmentData.push({
            productId: product.id,
            locationId: warehouseIndex,
            minStock: 5,
            baseStock: 15,
            targetStock: 20,
          });
        }
      });

      await db.insert(replenishmentCriteria).values(replenishmentData).onConflictDoNothing();

      // Create shipping instructions using actual user IDs
      const shippingData = [
        { productId: createdProducts[0].id, fromLocationId: 1, toLocationId: 4, quantity: 3, status: 'pending', createdBy: storeUserId },
        { productId: createdProducts[1].id, fromLocationId: 2, toLocationId: 4, quantity: 2, status: 'pending', createdBy: storeUserId },
        { productId: createdProducts[2].id, fromLocationId: 1, toLocationId: 5, quantity: 4, status: 'pending', createdBy: storeUserId },
        { productId: createdProducts[3].id, fromLocationId: 3, toLocationId: 5, quantity: 1, status: 'pending', createdBy: storeUserId },
        { productId: createdProducts[4].id, fromLocationId: 2, toLocationId: 6, quantity: 2, status: 'pending', createdBy: storeUserId },
      ];

      await db.insert(shippingInstructions).values(shippingData).onConflictDoNothing();

      // Create history entries using actual user IDs
      const historyData = [
        { operationType: '仕入受入' as const, productId: createdProducts[0].id, locationId: 1, quantity: 5, performedBy: warehouseUserId },
        { operationType: '棚入れ' as const, productId: createdProducts[0].id, fromLocationId: 1, toLocationId: 1, quantity: 5, state: '通常' as const, performedBy: warehouseUserId },
        { operationType: '棚入れ' as const, productId: createdProducts[1].id, fromLocationId: 2, toLocationId: 2, quantity: 3, state: '通常' as const, performedBy: warehouseUserId },
        { operationType: '販売' as const, productId: createdProducts[2].id, locationId: 4, quantity: 1, amount: 2980, performedBy: storeUserId },
        { operationType: '販売' as const, productId: createdProducts[3].id, locationId: 5, quantity: 2, amount: 5960, performedBy: storeUserId },
        { operationType: '販売' as const, productId: createdProducts[4].id, locationId: 6, quantity: 1, amount: 4980, performedBy: storeUserId },
        { operationType: '顧客返品' as const, productId: createdProducts[2].id, locationId: 4, quantity: 1, performedBy: storeUserId },
        { operationType: '在庫確保' as const, productId: createdProducts[5].id, fromLocationId: 1, toLocationId: 1, quantity: 2, state: '確保' as const, performedBy: warehouseUserId },
      ];

      await db.insert(inventoryHistory).values(historyData).onConflictDoNothing();

      res.json({ message: "Sample data seeded successfully" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ message: "Failed to seed data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Admin routes - Database management
  app.post("/api/admin/seed", requireAuth, requireRole('admin', 'warehouse'), async (req, res) => {
    try {
      await seedDatabase();
      res.json({ message: "Database seeded successfully with fresh demo data" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ 
        message: "Failed to seed database", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post("/api/admin/reset", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await resetAndReseed();
      res.json({ message: "Database reset and reseeded successfully" });
    } catch (error) {
      console.error("Reset error:", error);
      res.status(500).json({ 
        message: "Failed to reset database", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // History
  app.get("/api/history", async (req, res) => {
    try {
      const { limit, productId, locationId, types } = req.query;
      
      let history;
      if (productId) {
        history = await storage.getInventoryHistoryByProduct(
          parseInt(productId as string),
          locationId ? parseInt(locationId as string) : undefined
        );
      } else {
        history = await storage.getInventoryHistory(
          limit ? parseInt(limit as string) : 20,
          types ? (types as string).split(',') : undefined
        );
      }
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
