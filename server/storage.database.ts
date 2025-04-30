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
    const result = await db.insert(stockDeductions).values(deduction).returning();
    return result[0];
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
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  // Expiry-related methods
  async getExpiryItems(systemType: string, status?: ExpiryStatus): Promise<ContainerItem[]> {
    console.log("DatabaseStorage.getExpiryItems called with systemType:", systemType, "status:", status || "all");
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Initialize base query
    let baseCondition = and(
      eq(containerItems.systemType, systemType),
      gt(containerItems.remainingQty, 0)
    );
    
    // Add status filtering
    if (status) {
      if (status === 'expired') {
        // Expired: Earlier than today
        baseCondition = and(
          baseCondition,
          lt(containerItems.expiryDate, todayStr)
        );
      } else if (status === 'short-dated') {
        // Short-dated: Between today and 7 days from now
        const shortDatedDate = new Date(today);
        shortDatedDate.setDate(today.getDate() + 7);
        const shortDatedStr = shortDatedDate.toISOString().split('T')[0];
        
        baseCondition = and(
          baseCondition,
          gte(containerItems.expiryDate, todayStr),
          lte(containerItems.expiryDate, shortDatedStr)
        );
      } else if (status === 'expiring-soon') {
        // Expiring soon: Between 8 and 14 days from now
        const shortDatedDate = new Date(today);
        shortDatedDate.setDate(today.getDate() + 7);
        const shortDatedStr = shortDatedDate.toISOString().split('T')[0];
        
        const expiringSoonDate = new Date(today);
        expiringSoonDate.setDate(today.getDate() + 14);
        const expiringSoonStr = expiringSoonDate.toISOString().split('T')[0];
        
        baseCondition = and(
          baseCondition,
          gt(containerItems.expiryDate, shortDatedStr),
          lte(containerItems.expiryDate, expiringSoonStr)
        );
      } else if (status === 'good') {
        // Good: More than 14 days from now
        const expiringSoonDate = new Date(today);
        expiringSoonDate.setDate(today.getDate() + 14);
        const expiringSoonStr = expiringSoonDate.toISOString().split('T')[0];
        
        baseCondition = and(
          baseCondition,
          gt(containerItems.expiryDate, expiringSoonStr)
        );
      }
    }
    
    // Execute the query with our condition
    const items = await db
      .select()
      .from(containerItems)
      .where(baseCondition)
      .orderBy(asc(containerItems.expiryDate));
      
    console.log("DatabaseStorage.getExpiryItems found", items.length, "items");
    
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
    const deductionDate = new Date();
    
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
        deductionDate,
        fefoApplied: true
      });
      
      // Create activity for this deduction
      await this.createActivity({
        systemType,
        type: 'stock-deduction',
        title: `Stock Deduction: ${deductFromThisItem} units of ${item.description}`,
        description: `Deducted ${deductFromThisItem} units of ${item.description} (UPC: ${upc}, Batch: ${item.batchNumber})`,
        category: 'inventory',
        timestamp: deductionDate
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
    const overviewItems = [];
    
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
    
    for (const [upc, containerData] of containersByUPC.entries()) {
      // Find the inventory item for this UPC
      const inventoryItem = inventory.find(item => item.upc === upc);
      
      const daysUntilExpiry = calculateDaysUntilExpiry(containerData.earliestExpiry);
      
      overviewItems.push({
        upc,
        description: containerData.description,
        shelfExpiryEstimate: containerData.earliestExpiry,
        totalStock: containerData.totalQty,
        dailyStock: inventoryItem?.storeQty || 0,  // Use store quantity as daily stock
        sales: inventoryItem?.grossMargin || 'N/A',
        batchNumbers: containerData.batches.join(', '),
        status: getExpiryStatus(daysUntilExpiry),
        daysLeft: daysUntilExpiry,
        salesTrend: salesTrends.get(upc) || 'stable'
      });
    }
    
    // Sort by expiry date (earliest first)
    return overviewItems.sort((a, b) => {
      return new Date(a.shelfExpiryEstimate).getTime() - new Date(b.shelfExpiryEstimate).getTime();
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
        timestamp: new Date()
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