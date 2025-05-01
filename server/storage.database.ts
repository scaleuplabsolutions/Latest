import { db, pool } from "./db";
import { eq, and, desc, sql, like, or, isNull, not, gt, lt, lte, gte, asc } from "drizzle-orm";
import { 
  users,
  User,
  InsertUser,
  inventoryItems,
  InventoryItem,
  InsertInventoryItem,
  containerItems,
  ContainerItem,
  InsertContainerItem,
  stockDeductions,
  StockDeduction,
  InsertStockDeduction,
  activities,
  Activity,
  InsertActivity,
  ExpiryStatus
} from "@shared/schema";
import { IStorage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  // Session store for authentication
  public sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session' 
    });
  }
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Inventory methods
  async getInventoryItems(systemType: string): Promise<InventoryItem[]> {
    return await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.systemType, systemType))
      .orderBy(inventoryItems.description);
  }

  async getInventoryItemByUPC(upc: string, systemType: string): Promise<InventoryItem | undefined> {
    const result = await db
      .select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.upc, upc),
        eq(inventoryItems.systemType, systemType)
      ));
    return result[0];
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const result = await db.insert(inventoryItems).values(item).returning();
    return result[0];
  }

  async createManyInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]> {
    if (items.length === 0) return [];
    const result = await db.insert(inventoryItems).values(items).returning();
    return result;
  }

  async updateInventoryItem(id: number, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const result = await db
      .update(inventoryItems)
      .set(item)
      .where(eq(inventoryItems.id, id))
      .returning();
    return result[0];
  }

  // Container methods
  async getContainerItems(systemType: string): Promise<ContainerItem[]> {
    return await db
      .select()
      .from(containerItems)
      .where(eq(containerItems.systemType, systemType))
      .orderBy(desc(containerItems.lastUpdated));
  }

  async getContainerItemById(id: number): Promise<ContainerItem | undefined> {
    const result = await db
      .select()
      .from(containerItems)
      .where(eq(containerItems.id, id));
    return result[0];
  }

  async getContainerItemsByUPC(upc: string, systemType: string): Promise<ContainerItem[]> {
    return await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.upc, upc),
        eq(containerItems.systemType, systemType)
      ))
      .orderBy(asc(containerItems.expiryDate)); // FEFO order
  }

  async createContainerItem(item: InsertContainerItem): Promise<ContainerItem> {
    const result = await db.insert(containerItems).values({
      ...item,
      remainingQty: item.qtyReceived,
      lastUpdated: new Date()
    }).returning();
    return result[0];
  }

  async createManyContainerItems(items: InsertContainerItem[]): Promise<ContainerItem[]> {
    if (items.length === 0) return [];
    
    const itemsWithRemainingQty = items.map(item => ({
      ...item,
      remainingQty: item.qtyReceived,
      lastUpdated: new Date()
    }));
    
    const result = await db.insert(containerItems).values(itemsWithRemainingQty).returning();
    return result;
  }

  async updateContainerItem(id: number, item: Partial<InsertContainerItem>): Promise<ContainerItem | undefined> {
    const updatedItem = {
      ...item,
      lastUpdated: new Date()
    };
    
    const result = await db
      .update(containerItems)
      .set(updatedItem)
      .where(eq(containerItems.id, id))
      .returning();
    return result[0];
  }

  // Stock deductions
  async getStockDeductions(systemType: string): Promise<StockDeduction[]> {
    return await db
      .select()
      .from(stockDeductions)
      .where(eq(stockDeductions.systemType, systemType))
      .orderBy(desc(stockDeductions.deductionDate));
  }

  async createStockDeduction(deduction: InsertStockDeduction): Promise<StockDeduction> {
    console.log("Creating stock deduction:", JSON.stringify(deduction));
    
    // TypeScript fix: Create a clean object with only the valid properties from schema
    const cleanDeduction = {
      systemType: deduction.systemType,
      description: deduction.description,
      upc: deduction.upc,
      batchNumber: deduction.batchNumber,
      expiryDate: deduction.expiryDate,
      qtyDeducted: deduction.qtyDeducted,
      fefoApplied: deduction.fefoApplied ?? true
    };
    
    try {
      const result = await db.insert(stockDeductions).values(cleanDeduction).returning();
      console.log("Stock deduction created successfully");
      return result[0];
    } catch (error) {
      console.error("Error creating stock deduction:", error);
      throw error;
    }
  }

  // Activities
  async getActivities(systemType: string, limit = 10): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.systemType, systemType))
      .orderBy(desc(activities.timestamp))
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    console.log("Creating activity:", JSON.stringify(activity));
    
    // TypeScript fix: Create a clean object with only the valid properties from schema
    const cleanActivity = {
      systemType: activity.systemType,
      type: activity.type,
      title: activity.title,
      description: activity.description ?? null,
      category: activity.category ?? null
    };
    
    try {
      const result = await db.insert(activities).values(cleanActivity).returning();
      console.log("Activity created successfully");
      return result[0];
    } catch (error) {
      console.error("Error creating activity:", error);
      throw error;
    }
  }

  // Expiry-related methods
  async getExpiryItems(systemType: string, status?: ExpiryStatus): Promise<ContainerItem[]> {
    console.log("DatabaseStorage.getExpiryItems called with systemType:", systemType, "status:", status || "all");
    
    // Basic check for items with a non-zero remaining quantity for this system
    let query = db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0)
      ))
      .orderBy(asc(containerItems.expiryDate));
    
    const items = await query;
    console.log("DatabaseStorage.getExpiryItems found", items.length, "items");
    
    // If status filtering is required, do it in-memory since date comparisons 
    // can be tricky with different date formats
    if (status && items.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return items.filter(item => {
        const expiryDate = new Date(item.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (status === 'expired' && daysDiff < 0) {
          return true;
        } else if (status === 'short-dated' && daysDiff >= 0 && daysDiff <= 7) {
          return true;
        } else if (status === 'expiring-soon' && daysDiff > 7 && daysDiff <= 14) {
          return true;
        } else if (status === 'good' && daysDiff > 14) {
          return true;
        }
        
        return false;
      });
    }
    
    return items;
  }

  async getDashboardStats(systemType: string): Promise<{
    expired: number;
    expiringSoon: number;
    totalProducts: number;
    goodStatus: number;
    shortDated: number;
  }> {
    const today = new Date();
    
    // Short-dated: 0-7 days
    const shortDatedDate = new Date(today);
    shortDatedDate.setDate(today.getDate() + 7);
    
    // Expiring soon: 8-14 days
    const expiringSoonDate = new Date(today);
    expiringSoonDate.setDate(today.getDate() + 14);
    
    const activeContainers = await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0)
      ));
    
    // Count by status categories
    let expired = 0;
    let shortDated = 0;
    let expiringSoon = 0;
    let goodStatus = 0;
    
    // Get unique UPCs for total product count
    const uniqueUPCs = new Set<string>();
    
    activeContainers.forEach(item => {
      uniqueUPCs.add(item.upc);
      
      const expiryDate = new Date(item.expiryDate);
      const daysLeft = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) {
        expired++;
      } else if (daysLeft <= 7) {
        shortDated++;
      } else if (daysLeft <= 14) {
        expiringSoon++;
      } else {
        goodStatus++;
      }
    });
    
    return {
      expired,
      expiringSoon,
      totalProducts: uniqueUPCs.size,
      goodStatus,
      shortDated
    };
  }
  
  // FEFO logic
  async deductStockWithFEFO(upc: string, quantity: number, systemType: string): Promise<boolean> {
    const containerItemsForUPC = await this.getContainerItemsByUPC(upc, systemType);
    
    if (containerItemsForUPC.length === 0) {
      return false;
    }
    
    // Calculate total remaining quantity for this UPC
    const totalRemainingQty = containerItemsForUPC.reduce((sum, item) => sum + (item.remainingQty || 0), 0);
    
    // Check if we have enough inventory to satisfy the deduction
    if (totalRemainingQty < quantity) {
      return false;
    }
    
    let remainingToDeduct = quantity;
    
    // Loop through container items in FEFO order (already sorted by expiry date)
    for (const item of containerItemsForUPC) {
      if (remainingToDeduct <= 0) break;
      
      const remainingQty = item.remainingQty || 0;
      
      if (remainingQty <= 0) continue;
      
      const deductFromThisItem = Math.min(remainingQty, remainingToDeduct);
      const newRemainingQty = remainingQty - deductFromThisItem;
      
      // Update the container item with new remaining quantity
      await this.updateContainerItem(item.id, { 
        remainingQty: newRemainingQty
      });
      
      // Create a stock deduction record
      await this.createStockDeduction({
        systemType,
        upc,
        description: item.description,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        qtyDeducted: deductFromThisItem,
        fefoApplied: true
      });
      
      // Create activity for this deduction
      await this.createActivity({
        systemType,
        type: 'stock-deduction',
        title: `Stock Deduction: ${deductFromThisItem} units of ${item.description}`,
        description: `Deducted ${deductFromThisItem} units of ${item.description} (UPC: ${upc}, Batch: ${item.batchNumber})`,
        category: 'inventory'
      });
      
      remainingToDeduct -= deductFromThisItem;
    }
    
    return true;
  }
  
  // Report-related methods
  async getCategoryBreakdown(systemType: string): Promise<{ category: string; count: number; expired: number; expiringSoon: number; }[]> {
    const today = new Date();
    const expiringSoonDate = new Date(today);
    expiringSoonDate.setDate(today.getDate() + 14);
    
    const containers = await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0)
      ));
    
    const categoryMap = new Map<string, { count: number; expired: number; expiringSoon: number }>();
    
    containers.forEach(item => {
      const category = item.supplier || 'Unknown';
      const expiryDate = new Date(item.expiryDate);
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, expired: 0, expiringSoon: 0 });
      }
      
      const categoryData = categoryMap.get(category)!;
      categoryData.count++;
      
      if (expiryDate < today) {
        categoryData.expired++;
      } else if (expiryDate <= expiringSoonDate) {
        categoryData.expiringSoon++;
      }
    });
    
    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }));
  }
  
  async getMonthlyExpiry(systemType: string): Promise<{ month: string; expired: number; expiringSoon: number; }[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Get items with expiry dates in the current year
    const containers = await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0),
        like(containerItems.expiryDate, `${currentYear}%`)
      ));
    
    const monthlyData = new Map<string, { expired: number; expiringSoon: number }>();
    
    // Initialize all months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach(month => {
      monthlyData.set(month, { expired: 0, expiringSoon: 0 });
    });
    
    containers.forEach(item => {
      const expiryDate = new Date(item.expiryDate);
      const month = months[expiryDate.getMonth()];
      
      const monthData = monthlyData.get(month)!;
      
      if (expiryDate < today) {
        monthData.expired++;
      } else {
        const expirySoonDate = new Date(today);
        expirySoonDate.setDate(today.getDate() + 14);
        
        if (expiryDate <= expirySoonDate) {
          monthData.expiringSoon++;
        }
      }
    });
    
    return months.map(month => ({
      month,
      ...monthlyData.get(month)!
    }));
  }
  
  async getWeeklyExpiry(systemType: string): Promise<{ week: string; expired: number; expiringSoon: number; }[]> {
    const today = new Date();
    const nextFourWeeks = Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + i * 7);
      return `Week ${i + 1}`;
    });
    
    const containers = await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0)
      ));
    
    const weeklyData = new Map<string, { expired: number; expiringSoon: number }>();
    
    // Initialize all weeks
    nextFourWeeks.forEach(week => {
      weeklyData.set(week, { expired: 0, expiringSoon: 0 });
    });
    
    containers.forEach(item => {
      const expiryDate = new Date(item.expiryDate);
      const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 0) {
        // Expired already
        const weekData = weeklyData.get('Week 1')!;
        weekData.expired++;
      } else if (daysDiff < 28) {
        // Will expire in the next 4 weeks
        const weekIndex = Math.floor(daysDiff / 7);
        const week = `Week ${weekIndex + 1}`;
        
        if (weeklyData.has(week)) {
          const weekData = weeklyData.get(week)!;
          weekData.expiringSoon++;
        }
      }
    });
    
    return nextFourWeeks.map(week => ({
      week,
      ...weeklyData.get(week)!
    }));
  }
  
  // Overview methods
  async getOverviewItems(systemType: string): Promise<any[]> {
    // Get all container items and inventory items
    const containers = await db
      .select()
      .from(containerItems)
      .where(and(
        eq(containerItems.systemType, systemType),
        gt(containerItems.remainingQty, 0)
      ));
    
    const inventory = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.systemType, systemType));
      
    // Get stock deductions for sales trend analysis
    const deductions = await db
      .select()
      .from(stockDeductions)
      .where(eq(stockDeductions.systemType, systemType))
      .orderBy(desc(stockDeductions.deductionDate));
    
    // Group containers by UPC to get total quantities and batch numbers
    const containersByUPC = new Map<string, {
      batches: string[];
      totalQty: number;
      description: string;
      earliestExpiry: string;
    }>();
    
    containers.forEach(container => {
      if (!containersByUPC.has(container.upc)) {
        containersByUPC.set(container.upc, {
          batches: [],
          totalQty: 0,
          description: container.description,
          earliestExpiry: container.expiryDate
        });
      }
      
      const data = containersByUPC.get(container.upc)!;
      
      if (!data.batches.includes(container.batchNumber)) {
        data.batches.push(container.batchNumber);
      }
      
      data.totalQty += container.remainingQty || 0;
      
      // Update earliest expiry date
      if (new Date(container.expiryDate) < new Date(data.earliestExpiry)) {
        data.earliestExpiry = container.expiryDate;
      }
    });
    
    // Create overview items
    const overviewItems: any[] = [];
    
    // Calculate sales trends based on deductions
    const salesTrends = new Map<string, 'increasing' | 'decreasing' | 'stable'>();
    deductions.forEach(deduction => {
      if (!salesTrends.has(deduction.upc)) {
        // Get all deductions for this UPC
        const productDeductions = deductions.filter(d => d.upc === deduction.upc);
        
        // If we have multiple deductions, calculate trend
        if (productDeductions.length >= 2) {
          // Take the most recent 5 deductions or less
          const recentDeductions = productDeductions.slice(0, 5);
          
          // Calculate average quantity deducted per day for first and second half
          const midPoint = Math.ceil(recentDeductions.length / 2);
          const recentHalf = recentDeductions.slice(0, midPoint);
          const olderHalf = recentDeductions.slice(midPoint);
          
          const recentTotal = recentHalf.reduce((sum, d) => sum + d.qtyDeducted, 0);
          const olderTotal = olderHalf.length > 0 
            ? olderHalf.reduce((sum, d) => sum + d.qtyDeducted, 0) 
            : recentTotal; // fallback if we don't have enough data
          
          // Compare recent to older deductions
          if (recentTotal > olderTotal * 1.2) {
            salesTrends.set(deduction.upc, 'increasing');
          } else if (recentTotal < olderTotal * 0.8) {
            salesTrends.set(deduction.upc, 'decreasing');
          } else {
            salesTrends.set(deduction.upc, 'stable');
          }
        } else {
          // Not enough data for a trend
          salesTrends.set(deduction.upc, 'stable');
        }
      }
    });
    
    // Get all unique UPCs from both containers and inventory
    const allUPCs = new Set<string>();
    containers.forEach(item => allUPCs.add(item.upc));
    inventory.forEach(item => allUPCs.add(item.upc));
    
    // Process each UPC to create new overview structure
    // Convert Set to Array manually to avoid compatibility issues
    const upcsArray = Array.from(allUPCs);
    upcsArray.forEach(upc => {
      // Get inventory item for this UPC if exists
      const inventoryItem = inventory.find(item => item.upc === upc);
      
      // Get container data for this UPC if exists
      const containerData = containersByUPC.get(upc);
      
      // Skip if we don't have either inventory or container data
      if (!inventoryItem && !containerData) return; // Using return instead of continue in forEach
      
      // Get all stock deductions for this UPC
      const upcDeductions = deductions.filter(d => d.upc === upc);
      const totalDeducted = upcDeductions.reduce((sum, d) => sum + d.qtyDeducted, 0);
      
      // Get inventory stock (hostQty field from inventory)
      const inventoryStock = inventoryItem?.hostQty || 0;
      
      // Get received stock (from containers)
      const receivedStock = containerData?.totalQty || 0;
      
      // Calculate remaining quantity based on business rules:
      // First deplete inventory stock, then use received stock
      let remainingQuantity = 0;
      
      if (inventoryStock > totalDeducted) {
        // Inventory stock is enough to cover deductions
        remainingQuantity = inventoryStock - totalDeducted;
      } else {
        // Inventory stock is depleted, use received stock for remaining
        const remainingDeductions = totalDeducted - inventoryStock;
        remainingQuantity = Math.max(0, receivedStock - remainingDeductions);
      }
      
      // Get the days until expiry
      const daysUntilExpiry = containerData ? calculateDaysUntilExpiry(containerData.earliestExpiry) : 0;
      
      // Create the overview item with the new structure
      overviewItems.push({
        upc,
        description: inventoryItem?.description || (containerData ? containerData.description : 'Unknown'),
        daysLeft: daysUntilExpiry,
        inventoryStock,
        receivedStock,
        stockDeductions: totalDeducted,
        remainingQuantity,
        expiryDate: containerData?.earliestExpiry || '',
        status: containerData ? getExpiryStatus(daysUntilExpiry) : ''
      });
    });
    
    // Sort by days left (ascending) so critical items appear first
    return overviewItems.sort((a: any, b: any) => {
      // If a has no days left (no container), put it at the end
      if (a.daysLeft === 0 && b.daysLeft !== 0) return 1;
      // If b has no days left (no container), put it at the end
      if (b.daysLeft === 0 && a.daysLeft !== 0) return -1;
      // Otherwise sort by days left (ascending)
      return a.daysLeft - b.daysLeft;
    });
  }
  
  async clearData(systemType: string): Promise<boolean> {
    try {
      // Delete container items
      await db.delete(containerItems).where(eq(containerItems.systemType, systemType));
      
      // Delete inventory items
      await db.delete(inventoryItems).where(eq(inventoryItems.systemType, systemType));
      
      // Delete stock deductions
      await db.delete(stockDeductions).where(eq(stockDeductions.systemType, systemType));
      
      // Delete activities
      await db.delete(activities).where(eq(activities.systemType, systemType));
      
      // Create activity for the data clear
      await this.createActivity({
        systemType,
        type: 'system',
        title: 'Data Clear',
        description: 'All data has been cleared from the system',
        category: 'admin'
      });
      
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }
}

// Helper functions
function calculateDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  const expiry = new Date(expiryDate);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry < 0) {
    return 'expired';
  } else if (daysUntilExpiry <= 7) {
    return 'short-dated';
  } else if (daysUntilExpiry <= 14) {
    return 'expiring-soon';
  } else {
    return 'good';
  }
}