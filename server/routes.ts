import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as XLSX from 'xlsx';
import { z } from "zod";
import { setupAuth } from "./auth";
import { insertActivitySchema, insertContainerItemSchema, insertInventoryItemSchema, insertUserSchema } from "@shared/schema";

// Add session type to Request object
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    systemType?: string;
  }
}

// Helper function to ensure systemType is a string
function ensureSystemType(systemType: string | undefined): string {
  if (!systemType) {
    console.log("WARNING: systemType is undefined, defaulting to 'store'");
    return 'store';
  }
  
  if (systemType !== 'store' && systemType !== 'warehouse') {
    console.log(`WARNING: Invalid systemType '${systemType}', defaulting to 'store'`);
    return 'store';
  }
  
  return systemType;
}

// Helper function to calculate days until expiry
function getDaysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const today = new Date();
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Helper function to determine status based on days until expiry
function getExpiryStatus(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) {
    return "expired";
  } else if (daysUntilExpiry <= 7) {
    return "short-dated";
  } else if (daysUntilExpiry <= 14) {
    return "expiring-soon";
  } else {
    return "good";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Auth routes - These will be handled by setupAuth, but kept here for reference
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password, systemType } = req.body;
      
      if (!username || !password || !systemType) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Generate session data
      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.systemType = systemType;
      }
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        systemType
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data" });
      }
      
      const existingUser = await storage.getUserByUsername(result.data.username);
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(result.data);
      
      return res.status(201).json({
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        systemType: req.session.systemType
      });
    } catch (error) {
      console.error("Auth check error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        return res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      return res.status(200).json({ message: "Logged out successfully" });
    }
  });
  
  // Dashboard routes
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const stats = await storage.getDashboardStats(systemType);
      
      return res.status(200).json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/dashboard/activities", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getActivities(systemType, limit);
      
      return res.status(200).json(activities);
    } catch (error) {
      console.error("Activities error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/dashboard/expiry-chart", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      
      // Get all container items that are active (have remaining quantity)
      const items = await storage.getContainerItems(systemType);
      const activeItems = items.filter(item => (item.remainingQty || 0) > 0);
      
      // Group by expiry date and sum quantities
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get the next 30 days
      const next30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      });
      
      // Initialize result with all 30 days and zero quantities
      const result = next30Days.map(date => ({
        date,
        quantity: 0,
        products: 0
      }));
      
      // Add quantities from active items
      activeItems.forEach(item => {
        const expiryDate = item.expiryDate.split('T')[0]; // Ensure YYYY-MM-DD format
        const dayIndex = next30Days.indexOf(expiryDate);
        
        if (dayIndex !== -1) {
          result[dayIndex].quantity += item.remainingQty || 0;
          result[dayIndex].products += 1;
        }
      });
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("Dashboard expiry chart error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Inventory routes
  app.get("/api/inventory", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const items = await storage.getInventoryItems(systemType);
      
      return res.status(200).json(items);
    } catch (error) {
      console.error("Inventory get error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/inventory/upload", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Inventory upload systemType:", systemType);
      const data = req.body.data;
      
      console.log("Inventory upload received data:", JSON.stringify(data).slice(0, 200) + "...");
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Invalid data format" });
      }
      
      const items: any[] = [];
      const skippedRows: any[] = [];
      
      console.log("Processing inventory rows:", data.length);
      
      for (const row of data) {
        try {
          // Convert all keys to lowercase
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase()] = row[key];
          });
          
          // Required fields with more lenient extraction
          let upc = "";
          if (normalizedRow.upc !== undefined) upc = String(normalizedRow.upc || "");
          if (normalizedRow.sku !== undefined && !upc) upc = String(normalizedRow.sku || "");
          if (normalizedRow.product_code !== undefined && !upc) upc = String(normalizedRow.product_code || "");
          if (normalizedRow.barcode !== undefined && !upc) upc = String(normalizedRow.barcode || "");
          
          let description = "";
          if (normalizedRow.description !== undefined) description = String(normalizedRow.description || "");
          if (normalizedRow.product_name !== undefined && !description) description = String(normalizedRow.product_name || "");
          if (normalizedRow.name !== undefined && !description) description = String(normalizedRow.name || "");
          if (normalizedRow.item !== undefined && !description) description = String(normalizedRow.item || "");
          
          // Check for critical data
          if (!upc) {
            skippedRows.push({ row, reason: "Missing UPC/SKU/Product Code" });
            continue;
          }
          
          if (!description) {
            skippedRows.push({ row, reason: "Missing Description/Name" });
            continue;
          }
          
          items.push({
            upc,
            venCode: normalizedRow.ven_code?.toString() || 
                     normalizedRow.vencode?.toString() || 
                     normalizedRow.vendor_code?.toString() || "",
            description,
            size: normalizedRow.size?.toString() || 
                  normalizedRow.package_size?.toString() || "",
            wh2qty: parseInt(normalizedRow.wh2qty) || 
                    parseInt(normalizedRow.warehouse_qty) || 
                    parseInt(normalizedRow.wh_qty) || 0,
            rvsbondqty: parseInt(normalizedRow.rvsbondqty) || 
                        parseInt(normalizedRow.reserve_qty) || 0,
            sdeptName: normalizedRow.sdeptname?.toString() || 
                       normalizedRow.department?.toString() || 
                       normalizedRow.category?.toString() || 
                       normalizedRow.dept?.toString() || "",
            vendorId: normalizedRow.vendor_id?.toString() || 
                      normalizedRow.vendorid?.toString() || 
                      normalizedRow.supplier_id?.toString() || "",
            storeQty: parseInt(normalizedRow.storeqty) || 
                      parseInt(normalizedRow.store_qty) || 
                      parseInt(normalizedRow.qty) || 
                      parseInt(normalizedRow.quantity) || 0,
            hostQty: parseInt(normalizedRow.hostqty) || 
                     parseInt(normalizedRow.host_qty) || 0,
            cost: normalizedRow.cost?.toString() || 
                  normalizedRow.unit_cost?.toString() || 
                  normalizedRow.cost_price?.toString() || "",
            price: normalizedRow.price?.toString() || 
                   normalizedRow.retail_price?.toString() || 
                   normalizedRow.selling_price?.toString() || "",
            grossMargin: normalizedRow.gross_margin?.toString() || 
                         normalizedRow.grossmargin?.toString() || 
                         normalizedRow.margin?.toString() || "",
            systemType
          });
        } catch (error) {
          console.error("Error processing inventory row:", error, row);
          skippedRows.push({ row, reason: "Processing error" });
        }
      }
      
      if (items.length === 0) {
        return res.status(400).json({ 
          message: "No valid items found in data", 
          skippedRows: skippedRows.length,
          skippedDetail: skippedRows.slice(0, 5)
        });
      }
      
      // Process in batches to avoid call stack limits
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      
      console.log(`Processing ${items.length} items in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(items.length/BATCH_SIZE)}, size: ${batch.length}`);
        
        try {
          const insertedBatch = await storage.createManyInventoryItems(batch);
          insertedCount += insertedBatch.length;
        } catch (error) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        }
      }
      
      // Create activity
      await storage.createActivity({
        type: "success",
        title: `${insertedCount} inventory items imported`,
        description: `Inventory data was successfully uploaded in batches`,
        systemType
      });
      
      return res.status(200).json({ 
        message: "Inventory imported successfully",
        count: insertedCount,
        skippedRows: skippedRows.length
      });
    } catch (error) {
      console.error("Inventory upload error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Container routes
  app.get("/api/containers", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting containers for systemType:", systemType);
      const items = await storage.getContainerItems(systemType);
      console.log("Found", items.length, "container items");
      
      return res.status(200).json(items);
    } catch (error) {
      console.error("Container get error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/containers/upload", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const data = req.body.data;
      
      console.log("Container upload received data:", JSON.stringify(data).slice(0, 200) + "...");
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Invalid data format" });
      }
      
      const items: any[] = [];
      const skippedRows: any[] = [];
      
      for (const row of data) {
        try {
          // Convert all keys to lowercase
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase()] = row[key];
          });
          
          // Required fields with more lenient extraction
          let upc = "";
          if (normalizedRow.upc !== undefined) upc = String(normalizedRow.upc || "");
          if (normalizedRow.sku !== undefined && !upc) upc = String(normalizedRow.sku || "");
          if (normalizedRow.product_code !== undefined && !upc) upc = String(normalizedRow.product_code || "");
          
          let description = "";
          if (normalizedRow.description !== undefined) description = String(normalizedRow.description || "");
          if (normalizedRow.product_name !== undefined && !description) description = String(normalizedRow.product_name || "");
          if (normalizedRow.name !== undefined && !description) description = String(normalizedRow.name || "");
          
          let container = "";
          if (normalizedRow.container !== undefined) container = String(normalizedRow.container || "");
          if (normalizedRow.container_id !== undefined && !container) container = String(normalizedRow.container_id || "");
          if (normalizedRow.shipment !== undefined && !container) container = String(normalizedRow.shipment || "");
          
          const receivingDate = normalizedRow.receiving_date?.toString() || 
                              normalizedRow.receivingdate?.toString() || 
                              normalizedRow.received_date?.toString() ||
                              normalizedRow.date_received?.toString() ||
                              new Date().toISOString().split('T')[0];
          
          let batchNumber = normalizedRow.batch_number?.toString() || 
                            normalizedRow.batch?.toString() || 
                            normalizedRow["batch_#"]?.toString() || 
                            normalizedRow["batch #"]?.toString();
                            
          // Generate batch if not provided
          if (!batchNumber) {
            batchNumber = `BATCH-${Math.floor(Math.random() * 100000)}`;
          }
          
          const qtyReceived = parseInt(normalizedRow.qty_rec) || 
                            parseInt(normalizedRow.qtyrec) || 
                            parseInt(normalizedRow.qty) || 
                            parseInt(normalizedRow.quantity) || 0;
          
          let expiryDate = normalizedRow.expiry_date?.toString() || 
                          normalizedRow.expirydate?.toString() || 
                          normalizedRow.expiration_date?.toString() || 
                          normalizedRow.exp_date?.toString() || "";
                          
          // If expiry date is not provided, default to 1 year from now
          if (!expiryDate) {
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            expiryDate = oneYearFromNow.toISOString().split('T')[0];
          }
          
          // Check if we have critical data
          if (!upc) {
            skippedRows.push({ row, reason: "Missing UPC/SKU" });
            continue;
          }
          
          if (!description) {
            skippedRows.push({ row, reason: "Missing description" });
            continue;
          }
          
          if (!container) {
            // Generate container ID if not provided
            container = `CONT-${Math.floor(Math.random() * 100000)}`;
          }
          
          // Calculate status based on expiry date
          const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
          const status = getExpiryStatus(daysUntilExpiry);
          
          items.push({
            container,
            supplier: normalizedRow.supplier?.toString() || "",
            upc,
            description,
            itemNumber: normalizedRow["item_#"]?.toString() || normalizedRow["item #"]?.toString() || normalizedRow.item_number?.toString() || "",
            receivingDate,
            batchNumber,
            qtyReceived,
            remainingQty: qtyReceived,
            expiryDate,
            status,
            systemType
          });
        } catch (error) {
          console.error("Error processing row:", error, row);
          skippedRows.push({ row, reason: "Processing error" });
        }
      }
      
      if (items.length === 0) {
        return res.status(400).json({ 
          message: "No valid items found in data", 
          skippedRows: skippedRows.length, 
          skippedDetail: skippedRows.slice(0, 5) 
        });
      }
      
      // Process in batches to avoid call stack limits
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      
      console.log(`Processing ${items.length} container items in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(items.length/BATCH_SIZE)}, size: ${batch.length}`);
        
        try {
          const insertedBatch = await storage.createManyContainerItems(batch);
          insertedCount += insertedBatch.length;
        } catch (error) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        }
      }
      
      // Create activity
      await storage.createActivity({
        type: "success",
        title: `${insertedCount} container items imported`,
        description: `Container data was successfully uploaded in batches`,
        systemType
      });
      
      return res.status(200).json({ 
        message: "Container data imported successfully",
        count: insertedCount
      });
    } catch (error) {
      console.error("Container upload error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Expiry alerts routes
  app.get("/api/expiry-alerts", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const status = req.query.status as string;
      const category = req.query.category as string;
      const search = req.query.search as string;
      
      console.log("Getting expiry alerts for systemType:", systemType, "status:", status || "all");
      
      // Get base items from storage
      let items = await storage.getExpiryItems(systemType, status as any);
      
      console.log("Expiry alerts sending data:", items.length, "items found");
      
      // Process items to add daysLeft and ensure status is set
      const today = new Date();
      const processedItems = items.map(item => {
        const expiryDate = new Date(item.expiryDate);
        const daysLeft = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate status if not already set
        let itemStatus = item.status || 'good';
        if (daysLeft < 0) {
          itemStatus = 'expired';
        } else if (daysLeft <= 7) {
          itemStatus = 'short-dated';
        } else if (daysLeft <= 14) {
          itemStatus = 'expiring-soon';
        } else {
          itemStatus = 'good';
        }
        
        // Return enhanced item with calculated fields
        return {
          ...item,
          daysLeft,
          status: itemStatus
        };
      });
      
      // Filter by category if provided (using supplier) and not 'all'
      let filteredItems = processedItems;
      if (category && category !== 'all') {
        filteredItems = processedItems.filter(item => item.supplier === category);
      }
      
      // Filter by search term if provided
      if (search) {
        filteredItems = filteredItems.filter(item => 
          item.upc.includes(search) || 
          item.description.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      console.log("Expiry alerts sending data:", filteredItems.length, "items found");
      
      return res.status(200).json(filteredItems);
    } catch (error) {
      console.error("Expiry alerts error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Reports routes
  app.get("/api/reports/expiry-status", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting expiry status stats for systemType:", systemType);
      const stats = await storage.getDashboardStats(systemType);
      
      console.log("Expiry status stats:", {
        goodStatus: stats.goodStatus,
        expiringSoon: stats.expiringSoon,
        expired: stats.expired,
        shortDated: stats.shortDated
      });
      
      return res.status(200).json([
        { name: "Good", value: stats.goodStatus },
        { name: "Expiring Soon", value: stats.expiringSoon },
        { name: "Expired", value: stats.expired },
        { name: "Short-dated", value: stats.shortDated }
      ]);
    } catch (error) {
      console.error("Expiry status report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/reports/category-breakdown", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting category breakdown for systemType:", systemType);
      const data = await storage.getCategoryBreakdown(systemType);
      
      return res.status(200).json(data);
    } catch (error) {
      console.error("Category breakdown report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/reports/monthly", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting monthly expiry data for systemType:", systemType);
      const data = await storage.getMonthlyExpiry(systemType);
      
      return res.status(200).json(data);
    } catch (error) {
      console.error("Monthly report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/reports/weekly", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting weekly expiry data for systemType:", systemType);
      const data = await storage.getWeeklyExpiry(systemType);
      
      return res.status(200).json(data);
    } catch (error) {
      console.error("Weekly report error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Overview routes
  app.get("/api/overview", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting overview data for systemType:", systemType);
      const search = req.query.search as string;
      
      let items = await storage.getOverviewItems(systemType);
      console.log("Found", items.length, "overview items");
      
      // Filter by search term if provided
      if (search) {
        items = items.filter(item => 
          item.upc.includes(search) || 
          item.description.toLowerCase().includes(search.toLowerCase())
        );
        console.log("After search filter:", items.length, "items remain");
      }
      
      return res.status(200).json(items);
    } catch (error) {
      console.error("Overview error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/overview/clear", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Clearing data for systemType:", systemType);
      const success = await storage.clearData(systemType);
      
      // Log the action
      await storage.createActivity({
        systemType,
        type: 'warning',
        title: `Data cleared for ${systemType}`,
        description: 'All data was cleared for this system',
        category: 'system'
      });
      
      return res.status(200).json({ 
        success,
        message: "Data cleared successfully" 
      });
    } catch (error) {
      console.error("Clear data error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Stock deduction routes
  app.get("/api/stock-deductions", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      console.log("Getting stock deductions for systemType:", systemType);
      const deductions = await storage.getStockDeductions(systemType);
      console.log("Found", deductions.length, "stock deductions");
      
      return res.status(200).json(deductions);
    } catch (error) {
      console.error("Stock deductions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/stock-deductions/deduct", async (req: Request, res: Response) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const systemType = ensureSystemType(req.session.systemType);
      const { upc, quantity } = req.body;
      
      console.log("Deducting stock for systemType:", systemType, "UPC:", upc, "Quantity:", quantity);
      
      if (!upc || !quantity || quantity <= 0) {
        console.error("Invalid deduction data:", { upc, quantity });
        return res.status(400).json({ message: "Invalid deduction data" });
      }
      
      const success = await storage.deductStockWithFEFO(upc, quantity, systemType);
      
      if (!success) {
        console.error("Failed to deduct stock. Insufficient inventory for UPC:", upc);
        return res.status(400).json({ message: "Failed to deduct stock. Insufficient inventory." });
      }
      
      console.log("Stock deducted successfully");
      return res.status(200).json({ 
        success: true,
        message: "Stock deducted successfully" 
      });
    } catch (error) {
      console.error("Stock deduction error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
