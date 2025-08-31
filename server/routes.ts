import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertProductSchema, insertLocationSchema, insertShippingInstructionSchema,
  insertReplenishmentCriteriaSchema, insertInventoryHistorySchema 
} from "@shared/schema";
import { z } from "zod";

// Request schemas
const saleSchema = z.object({
  productId: z.number(),
  locationId: z.number(),
  quantity: z.number().positive(),
  saleAmount: z.number().positive(),
  discount: z.number().optional(),
  memo: z.string().optional(),
});

const adjustInventorySchema = z.object({
  productId: z.number(),
  locationId: z.number(),
  fromState: z.enum(['通常', '確保', '検品中', '不良']).optional(),
  toState: z.enum(['通常', '確保', '検品中', '不良']),
  quantity: z.number().positive(),
  operationType: z.enum(['販売', '顧客返品', '出荷指示作成', '在庫確保', '出荷確定', '仕入受入', '棚入れ', '店舗返品送付', '返品受入', '返品検品']),
  memo: z.string().optional(),
  saleAmount: z.number().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
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
  app.post("/api/shipping", async (req, res) => {
    try {
      const data = insertShippingInstructionSchema.parse(req.body);
      const instruction = await storage.createShippingInstruction(data);
      
      // Create history entry
      await storage.createHistoryEntry({
        operationType: '出荷指示作成',
        productId: data.productId,
        quantity: data.quantity,
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
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
  app.post("/api/shipping/:id/confirm", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { performedBy } = req.body;
      
      await storage.confirmShippingInstruction(id, performedBy);
      res.json({ message: "Shipping instruction confirmed" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to confirm shipping" });
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
  app.post("/api/inventory/adjust", async (req, res) => {
    try {
      const data = adjustInventorySchema.parse(req.body);
      const { performedBy = 'system' } = req.body;
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        data.fromState || null,
        data.toState,
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
  app.post("/api/sales", async (req, res) => {
    try {
      const data = saleSchema.parse(req.body);
      const { performedBy = 'system' } = req.body;
      
      await storage.adjustInventory(
        data.productId,
        data.locationId,
        '通常',
        '通常',
        -data.quantity, // Negative for reduction
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

  // Seed data (temporarily disabled)
  app.post("/api/seed", async (req, res) => {
    res.status(501).json({ message: "Seed data creation temporarily disabled" });
  });

  // History
  app.get("/api/history", async (req, res) => {
    try {
      const { limit, productId, locationId } = req.query;
      
      let history;
      if (productId) {
        history = await storage.getInventoryHistoryByProduct(
          parseInt(productId as string),
          locationId ? parseInt(locationId as string) : undefined
        );
      } else {
        history = await storage.getInventoryHistory(limit ? parseInt(limit as string) : 20);
      }
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
