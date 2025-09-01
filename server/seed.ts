import { db } from "./db";
import { 
  users, locations, products, inventoryBalances, replenishmentCriteria,
  shippingInstructions, inventoryHistory
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Idempotent seed data - can be run multiple times safely
export async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    // Truncate all tables in reverse dependency order for clean reset
    await db.execute(sql`TRUNCATE TABLE inventory_history CASCADE`);
    await db.execute(sql`TRUNCATE TABLE shipping_instructions CASCADE`);
    await db.execute(sql`TRUNCATE TABLE replenishment_criteria CASCADE`);
    await db.execute(sql`TRUNCATE TABLE inventory_balances CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products CASCADE`);
    await db.execute(sql`TRUNCATE TABLE locations CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);

    console.log("✅ Truncated all tables for clean reset");

    // 1. Create users first (required for foreign keys)
    const demoUsers = [
      {
        id: "warehouse_user",
        username: "warehouse_user",
        password: "password123",
        role: "warehouse" as const,
        storeId: null,
      },
      {
        id: "store_user_1",
        username: "store_user_1", 
        password: "password123",
        role: "store" as const,
        storeId: null, // Will be set after store creation
      },
      {
        id: "store_user_2",
        username: "store_user_2",
        password: "password123", 
        role: "store" as const,
        storeId: null,
      },
      {
        id: "admin_user",
        username: "admin_user",
        password: "password123",
        role: "admin" as const,
        storeId: null,
      }
    ];

    await db.insert(users).values(demoUsers);
    console.log("✅ Created demo users");

    // 2. Create locations with unique codes
    const locationData = [
      // Warehouse shelves
      { name: "倉庫 棚A", type: "warehouse" as const, code: "SHELF_A", displayOrder: 1 },
      { name: "倉庫 棚B", type: "warehouse" as const, code: "SHELF_B", displayOrder: 2 },
      { name: "倉庫 棚C", type: "warehouse" as const, code: "SHELF_C", displayOrder: 3 },
      // Stores
      { name: "店舗1", type: "store" as const, code: "STORE_1", displayOrder: 11 },
      { name: "店舗2", type: "store" as const, code: "STORE_2", displayOrder: 12 },
      { name: "店舗3", type: "store" as const, code: "STORE_3", displayOrder: 13 },
      { name: "店舗4", type: "store" as const, code: "STORE_4", displayOrder: 14 },
      { name: "店舗5", type: "store" as const, code: "STORE_5", displayOrder: 15 },
      { name: "店舗6", type: "store" as const, code: "STORE_6", displayOrder: 16 },
    ];

    const createdLocations = await db.insert(locations).values(locationData).returning();
    console.log("✅ Created locations");

    // Update store users with their assigned stores
    const store1 = createdLocations.find(l => l.code === "STORE_1");
    const store2 = createdLocations.find(l => l.code === "STORE_2");
    
    if (store1) {
      await db.update(users).set({ storeId: store1.id }).where(eq(users.id, "store_user_1"));
    }
    if (store2) {
      await db.update(users).set({ storeId: store2.id }).where(eq(users.id, "store_user_2"));
    }

    // 3. Create 30 SKUs (12 styles × 2 colors × 3 sizes = 72, but using 30 for demo)
    const styles = ["シャツ", "ズボン", "ジャケット", "スカート", "ドレス"];
    const colors = ["BK", "WH", "NV", "GY", "RD", "BL"];
    const sizes = ["S", "M", "L"];
    
    const productData = [];
    let skuCounter = 1;
    
    for (let i = 0; i < 30; i++) {
      const styleIndex = Math.floor(i / 6) % styles.length;
      const colorIndex = Math.floor(i / 3) % colors.length;
      const sizeIndex = i % sizes.length;
      
      const sku = `${skuCounter.toString().padStart(4, '0')}-${colors[colorIndex]}-${sizes[sizeIndex]}`;
      productData.push({
        sku,
        modelName: `${styles[styleIndex]}${Math.floor(skuCounter / 10).toString().padStart(2, '0')}`,
        color: colors[colorIndex],
        size: sizes[sizeIndex],
        category: styles[styleIndex],
        retailPrice: "2980.00",
        costPrice: "1490.00",
      });
      skuCounter++;
    }

    const createdProducts = await db.insert(products).values(productData).returning();
    console.log("✅ Created 30 products");

    // 4. Initialize inventory balances
    const inventoryData = [];
    const warehouseShelves = createdLocations.filter(l => l.type === "warehouse");
    const stores = createdLocations.filter(l => l.type === "store");
    
    for (const product of createdProducts) {
      // Warehouse inventory (distribute across shelves)
      for (const shelf of warehouseShelves) {
        const baseStock = Math.floor(Math.random() * 50) + 10; // 10-59 units
        inventoryData.push(
          { productId: product.id, locationId: shelf.id, state: "通常" as const, quantity: baseStock },
          { productId: product.id, locationId: shelf.id, state: "確保" as const, quantity: Math.floor(Math.random() * 5) },
          { productId: product.id, locationId: shelf.id, state: "検品中" as const, quantity: Math.floor(Math.random() * 3) },
          { productId: product.id, locationId: shelf.id, state: "不良" as const, quantity: Math.floor(Math.random() * 2) }
        );
      }
      
      // Store inventory (smaller quantities)
      for (const store of stores) {
        const storeStock = Math.floor(Math.random() * 15) + 5; // 5-19 units
        inventoryData.push(
          { productId: product.id, locationId: store.id, state: "通常" as const, quantity: storeStock },
          { productId: product.id, locationId: store.id, state: "不良" as const, quantity: Math.floor(Math.random() * 2) }
        );
      }
    }

    await db.insert(inventoryBalances).values(inventoryData);
    console.log("✅ Created inventory balances");

    // 5. Set replenishment criteria
    const criteriaData = [];
    for (const product of createdProducts) {
      for (const store of stores) {
        criteriaData.push({
          productId: product.id,
          locationId: store.id,
          minStock: Math.floor(Math.random() * 10) + 5, // 5-14
          targetStock: Math.floor(Math.random() * 20) + 15, // 15-34
          standardReplenishment: Math.floor(Math.random() * 15) + 10, // 10-24
        });
      }
    }

    await db.insert(replenishmentCriteria).values(criteriaData);
    console.log("✅ Created replenishment criteria");

    // 6. Create some sample shipping instructions
    const shippingData = [];
    const warehouseShelf = warehouseShelves[0]; // Use first warehouse shelf
    
    for (let i = 0; i < 5; i++) {
      const randomProduct = createdProducts[Math.floor(Math.random() * createdProducts.length)];
      const randomStore = stores[Math.floor(Math.random() * stores.length)];
      
      shippingData.push({
        productId: randomProduct.id,
        fromLocationId: warehouseShelf.id,
        toLocationId: randomStore.id,
        quantity: Math.floor(Math.random() * 10) + 1,
        status: "pending",
        memo: `出荷指示サンプル ${i + 1}`,
        createdBy: "warehouse_user",
      });
    }

    await db.insert(shippingInstructions).values(shippingData);
    console.log("✅ Created sample shipping instructions");

    // 7. Create some history entries
    const historyData = [];
    for (let i = 0; i < 10; i++) {
      const randomProduct = createdProducts[Math.floor(Math.random() * createdProducts.length)];
      const operationTypes = ["仕入受入", "棚入れ", "販売", "出荷指示作成"];
      const randomOperation = operationTypes[Math.floor(Math.random() * operationTypes.length)];
      
      historyData.push({
        operationType: randomOperation as any,
        productId: randomProduct.id,
        quantity: Math.floor(Math.random() * 20) + 1,
        fromLocationId: warehouseShelf.id,
        toLocationId: stores[0].id,
        fromState: "通常" as const,
        toState: "通常" as const,
        performedBy: "warehouse_user",
        memo: `サンプル履歴 ${i + 1}`,
      });
    }

    await db.insert(inventoryHistory).values(historyData);
    console.log("✅ Created sample history entries");

    console.log("🎉 Database seed completed successfully!");
    console.log(`Created:
    - 4 users (warehouse_user, store_user_1, store_user_2, admin_user)
    - 9 locations (3 warehouse shelves + 6 stores)
    - 30 products
    - ${inventoryData.length} inventory balance records
    - ${criteriaData.length} replenishment criteria
    - 5 shipping instructions
    - 10 history entries`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

// Reset and reseed function for demo data recreation
export async function resetAndReseed() {
  console.log("🔄 Resetting database and reseeding...");
  await seedDatabase();
}