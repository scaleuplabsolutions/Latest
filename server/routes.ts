import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as XLSX from 'xlsx';
import { z } from "zod";
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
  return systemType || 'store';
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
    return "expiring-soon";
  } else if (daysUntilExpiry <= 14) {
    return "short-dated";
  } else {
    return "good";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
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
      const data = req.body.data;
      
      console.log("Inventory upload received data:", JSON.stringify(data).slice(0, 200) + "...");
      
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
      
      const insertedItems = await storage.createManyInventoryItems(items);
      
      // Create activity
      await storage.createActivity({
        type: "success",
        title: `${insertedItems.length} inventory items imported`,
        description: `Inventory data was successfully uploaded`,
        systemType
      });
      
      return res.status(200).json({ 
        message: "Inventory imported successfully",
        count: insertedItems.length,
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
      const systemType = req.session.systemType;
      const items = await storage.getContainerItems(systemType);
      
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
      
      const insertedItems = await storage.createManyContainerItems(items);
      
      // Create activity
      await storage.createActivity({
        type: "success",
        title: `${insertedItems.length} container items imported`,
        description: `Container ${items[0].container} data was successfully uploaded`,
        systemType
      });
      
      return res.status(200).json({ 
        message: "Container data imported successfully",
        count: insertedItems.length
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
      const systemType = req.session.systemType;
      const status = req.query.status as string;
      const category = req.query.category as string;
      const search = req.query.search as string;
      
      let items = await storage.getExpiryItems(systemType, status as any);
      
      // Filter by category if provided
      if (category) {
        items = items.filter(item => item.sdeptName === category);
      }
      
      // Filter by search term if provided
      if (search) {
        items = items.filter(item => 
          item.upc.includes(search) || 
          item.description.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return res.status(200).json(items);
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
      const systemType = req.session.systemType;
      const stats = await storage.getDashboardStats(systemType);
      
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
      const systemType = req.session.systemType;
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
      const systemType = req.session.systemType;
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
      const systemType = req.session.systemType;
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
      const systemType = req.session.systemType;
      const search = req.query.search as string;
      
      let items = await storage.getOverviewItems(systemType);
      
      // Filter by search term if provided
      if (search) {
        items = items.filter(item => 
          item.upc.includes(search) || 
          item.description.toLowerCase().includes(search.toLowerCase())
        );
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
      const systemType = req.session.systemType;
      const success = await storage.clearData(systemType);
      
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
      const systemType = req.session.systemType;
      const deductions = await storage.getStockDeductions(systemType);
      
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
      const systemType = req.session.systemType;
      const { upc, quantity } = req.body;
      
      if (!upc || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid deduction data" });
      }
      
      const success = await storage.deductStockWithFEFO(upc, quantity, systemType);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to deduct stock. Insufficient inventory." });
      }
      
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
