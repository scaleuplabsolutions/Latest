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

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Inventory methods
  getInventoryItems(systemType: string): Promise<InventoryItem[]>;
  getInventoryItemByUPC(upc: string, systemType: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  createManyInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]>;
  updateInventoryItem(id: number, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  
  // Container methods
  getContainerItems(systemType: string): Promise<ContainerItem[]>;
  getContainerItemById(id: number): Promise<ContainerItem | undefined>;
  getContainerItemsByUPC(upc: string, systemType: string): Promise<ContainerItem[]>;
  createContainerItem(item: InsertContainerItem): Promise<ContainerItem>;
  createManyContainerItems(items: InsertContainerItem[]): Promise<ContainerItem[]>;
  updateContainerItem(id: number, item: Partial<InsertContainerItem>): Promise<ContainerItem | undefined>;
  
  // Stock deductions
  getStockDeductions(systemType: string): Promise<StockDeduction[]>;
  createStockDeduction(deduction: InsertStockDeduction): Promise<StockDeduction>;
  
  // Activities
  getActivities(systemType: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Expiry-related methods
  getExpiryItems(systemType: string, status?: ExpiryStatus): Promise<ContainerItem[]>;
  getDashboardStats(systemType: string): Promise<{
    expired: number;
    expiringSoon: number;
    totalProducts: number;
    goodStatus: number;
    shortDated: number;
  }>;
  
  // FEFO logic
  deductStockWithFEFO(upc: string, quantity: number, systemType: string): Promise<boolean>;
  
  // Report-related methods
  getCategoryBreakdown(systemType: string): Promise<{ category: string; count: number; expired: number; expiringSoon: number; }[]>;
  getMonthlyExpiry(systemType: string): Promise<{ month: string; expired: number; expiringSoon: number; }[]>;
  getWeeklyExpiry(systemType: string): Promise<{ week: string; expired: number; expiringSoon: number; }[]>;
  
  // Overview methods
  getOverviewItems(systemType: string): Promise<any[]>;
  clearData(systemType: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private inventoryItems: Map<number, InventoryItem>;
  private containerItems: Map<number, ContainerItem>;
  private stockDeductions: Map<number, StockDeduction>;
  private activities: Map<number, Activity>;
  
  // IDs for auto-increment
  private userId: number;
  private inventoryItemId: number;
  private containerItemId: number;
  private stockDeductionId: number;
  private activityId: number;

  constructor() {
    this.users = new Map();
    this.inventoryItems = new Map();
    this.containerItems = new Map();
    this.stockDeductions = new Map();
    this.activities = new Map();
    
    this.userId = 1;
    this.inventoryItemId = 1;
    this.containerItemId = 1;
    this.stockDeductionId = 1;
    this.activityId = 1;
    
    // Create default admin user
    const adminUser: User = {
      id: this.userId++,
      username: 'admin',
      password: 'password',
      systemType: 'store'
    };
    this.users.set(adminUser.id, adminUser);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Inventory methods
  async getInventoryItems(systemType: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values())
      .filter(item => item.systemType === systemType);
  }
  
  async getInventoryItemByUPC(upc: string, systemType: string): Promise<InventoryItem | undefined> {
    return Array.from(this.inventoryItems.values())
      .find(item => item.upc === upc && item.systemType === systemType);
  }
  
  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const id = this.inventoryItemId++;
    const now = new Date();
    const inventoryItem: InventoryItem = { ...item, id, lastUpdated: now };
    this.inventoryItems.set(id, inventoryItem);
    return inventoryItem;
  }
  
  async createManyInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    
    for (const item of items) {
      results.push(await this.createInventoryItem(item));
    }
    
    return results;
  }
  
  async updateInventoryItem(id: number, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const existingItem = this.inventoryItems.get(id);
    
    if (!existingItem) {
      return undefined;
    }
    
    const updatedItem: InventoryItem = {
      ...existingItem,
      ...item,
      lastUpdated: new Date()
    };
    
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }
  
  // Container methods
  async getContainerItems(systemType: string): Promise<ContainerItem[]> {
    return Array.from(this.containerItems.values())
      .filter(item => item.systemType === systemType);
  }
  
  async getContainerItemById(id: number): Promise<ContainerItem | undefined> {
    return this.containerItems.get(id);
  }
  
  async getContainerItemsByUPC(upc: string, systemType: string): Promise<ContainerItem[]> {
    return Array.from(this.containerItems.values())
      .filter(item => item.upc === upc && item.systemType === systemType);
  }
  
  async createContainerItem(item: InsertContainerItem): Promise<ContainerItem> {
    const id = this.containerItemId++;
    const now = new Date();
    
    // Default remainingQty to qtyReceived if not specified
    const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.qtyReceived;
    
    const containerItem: ContainerItem = { 
      ...item, 
      id, 
      remainingQty, 
      lastUpdated: now 
    };
    
    this.containerItems.set(id, containerItem);
    return containerItem;
  }
  
  async createManyContainerItems(items: InsertContainerItem[]): Promise<ContainerItem[]> {
    const results: ContainerItem[] = [];
    
    for (const item of items) {
      results.push(await this.createContainerItem(item));
    }
    
    return results;
  }
  
  async updateContainerItem(id: number, item: Partial<InsertContainerItem>): Promise<ContainerItem | undefined> {
    const existingItem = this.containerItems.get(id);
    
    if (!existingItem) {
      return undefined;
    }
    
    const updatedItem: ContainerItem = {
      ...existingItem,
      ...item,
      lastUpdated: new Date()
    };
    
    this.containerItems.set(id, updatedItem);
    return updatedItem;
  }
  
  // Stock deductions
  async getStockDeductions(systemType: string): Promise<StockDeduction[]> {
    return Array.from(this.stockDeductions.values())
      .filter(item => item.systemType === systemType)
      .sort((a, b) => b.deductionDate.getTime() - a.deductionDate.getTime());
  }
  
  async createStockDeduction(deduction: InsertStockDeduction): Promise<StockDeduction> {
    const id = this.stockDeductionId++;
    const now = new Date();
    
    const stockDeduction: StockDeduction = {
      ...deduction,
      id,
      deductionDate: now
    };
    
    this.stockDeductions.set(id, stockDeduction);
    return stockDeduction;
  }
  
  // Activities
  async getActivities(systemType: string, limit = 10): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.systemType === systemType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = this.activityId++;
    const now = new Date();
    
    const newActivity: Activity = {
      ...activity,
      id,
      timestamp: now
    };
    
    this.activities.set(id, newActivity);
    return newActivity;
  }
  
  // Expiry-related methods
  async getExpiryItems(systemType: string, status?: ExpiryStatus): Promise<ContainerItem[]> {
    const items = Array.from(this.containerItems.values())
      .filter(item => item.systemType === systemType);
    
    if (!status || status === 'all') {
      return items;
    }
    
    // Check expiry status
    const today = new Date();
    
    return items.filter(item => {
      const expiryDate = new Date(item.expiryDate);
      const daysUntilExpiry = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (status) {
        case 'expired':
          return daysUntilExpiry < 0;
        case 'short-dated':
          return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
        case 'expiring-soon':
          return daysUntilExpiry > 7 && daysUntilExpiry <= 14;
        case 'good':
          return daysUntilExpiry > 14;
        default:
          return true;
      }
    });
  }
  
  async getDashboardStats(systemType: string): Promise<{ 
    expired: number; 
    expiringSoon: number; 
    totalProducts: number; 
    goodStatus: number; 
    shortDated: number; 
  }> {
    const expired = (await this.getExpiryItems(systemType, 'expired')).length;
    const expiringSoon = (await this.getExpiryItems(systemType, 'expiring-soon')).length;
    const shortDated = (await this.getExpiryItems(systemType, 'short-dated')).length;
    const goodStatus = (await this.getExpiryItems(systemType, 'good')).length;
    const totalProducts = expired + expiringSoon + shortDated + goodStatus;
    
    return {
      expired,
      expiringSoon,
      totalProducts,
      goodStatus,
      shortDated
    };
  }
  
  // FEFO logic
  async deductStockWithFEFO(upc: string, quantity: number, systemType: string): Promise<boolean> {
    // Find all container items with matching UPC
    const items = await this.getContainerItemsByUPC(upc, systemType);
    
    // Sort by expiry date (ascending)
    items.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    
    // Only process items with remaining quantity
    const availableItems = items.filter(item => (item.remainingQty || 0) > 0);
    
    if (availableItems.length === 0) {
      return false;
    }
    
    let remainingToDeduct = quantity;
    const deductionDetails: { 
      containerItemId: number;
      batchNumber: string;
      expiryDate: string;
      qtyDeducted: number;
      description: string;
    }[] = [];
    
    // Deduct from each batch starting with earliest expiry
    for (const item of availableItems) {
      if (remainingToDeduct <= 0) break;
      
      const availableQty = item.remainingQty || 0;
      const deductFromBatch = Math.min(availableQty, remainingToDeduct);
      
      // Update container item quantity
      await this.updateContainerItem(item.id, {
        remainingQty: availableQty - deductFromBatch
      });
      
      // Track deduction details
      deductionDetails.push({
        containerItemId: item.id,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        qtyDeducted: deductFromBatch,
        description: item.description
      });
      
      remainingToDeduct -= deductFromBatch;
    }
    
    // Create deduction records
    for (const detail of deductionDetails) {
      await this.createStockDeduction({
        upc,
        description: detail.description,
        qtyDeducted: detail.qtyDeducted,
        batchNumber: detail.batchNumber,
        expiryDate: detail.expiryDate,
        fefoApplied: true,
        systemType
      });
    }
    
    // Create activity record
    await this.createActivity({
      type: "success",
      title: `${quantity} units of ${upc} deducted using FEFO`,
      description: `Stock was deducted from ${deductionDetails.length} batches`,
      systemType
    });
    
    return true;
  }
  
  // Report-related methods
  async getCategoryBreakdown(systemType: string): Promise<{ category: string; count: number; expired: number; expiringSoon: number; }[]> {
    const items = await this.getExpiryItems(systemType);
    const today = new Date();
    
    // Group by category
    const categories = new Map<string, { count: number; expired: number; expiringSoon: number }>();
    
    for (const item of items) {
      // Use supplier as category for containers since they don't have sdeptName
      const category = item.supplier || 'Uncategorized';
      const expiryDate = new Date(item.expiryDate);
      const daysUntilExpiry = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (!categories.has(category)) {
        categories.set(category, { count: 0, expired: 0, expiringSoon: 0 });
      }
      
      const catStats = categories.get(category)!;
      catStats.count++;
      
      if (daysUntilExpiry < 0) {
        catStats.expired++;
      } else if (daysUntilExpiry <= 14) {
        // Include both short-dated (0-7 days) and expiring-soon (8-14 days)
        catStats.expiringSoon++;
      }
    }
    
    return Array.from(categories.entries()).map(([category, stats]) => ({
      category,
      ...stats
    }));
  }
  
  async getMonthlyExpiry(systemType: string): Promise<{ month: string; expired: number; expiringSoon: number; }[]> {
    // Generate data for last 6 months
    const result = [];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(today);
      monthDate.setMonth(today.getMonth() - i);
      const monthName = monthDate.toLocaleString('default', { month: 'long' });
      
      result.push({
        month: monthName,
        expired: Math.floor(Math.random() * 20),
        expiringSoon: Math.floor(Math.random() * 30)
      });
    }
    
    return result.reverse();
  }
  
  async getWeeklyExpiry(systemType: string): Promise<{ week: string; expired: number; expiringSoon: number; }[]> {
    // Generate data for last 8 weeks
    const result = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() - (i * 7));
      const weekNum = Math.ceil((weekDate.getDate() + (new Date(weekDate.getFullYear(), weekDate.getMonth(), 1).getDay())) / 7);
      
      result.push({
        week: `Week ${weekNum}`,
        expired: Math.floor(Math.random() * 10),
        expiringSoon: Math.floor(Math.random() * 15)
      });
    }
    
    return result.reverse();
  }
  
  // Overview methods
  async getOverviewItems(systemType: string): Promise<any[]> {
    const inventoryItems = await this.getInventoryItems(systemType);
    const containerItems = await this.getContainerItems(systemType);
    
    const result = [];
    
    // Group container items by UPC
    const containerByUpc = new Map<string, ContainerItem[]>();
    for (const item of containerItems) {
      if (!containerByUpc.has(item.upc)) {
        containerByUpc.set(item.upc, []);
      }
      containerByUpc.get(item.upc)!.push(item);
    }
    
    // Calculate overview for each inventory item
    for (const item of inventoryItems) {
      const containers = containerByUpc.get(item.upc) || [];
      const batches = containers.map(c => c.batchNumber).join(', ');
      
      // Find earliest expiry date among containers
      let shelfExpiryEstimate = '';
      if (containers.length > 0) {
        const dates = containers.map(c => new Date(c.expiryDate));
        const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
        shelfExpiryEstimate = earliestDate.toISOString().split('T')[0];
      }
      
      // Determine status based on earliest expiry
      let status: ExpiryStatus = 'good';
      if (shelfExpiryEstimate) {
        const expiryDate = new Date(shelfExpiryEstimate);
        const today = new Date();
        const daysUntilExpiry = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          status = 'expired';
        } else if (daysUntilExpiry <= 7) {
          status = 'short-dated';
        } else if (daysUntilExpiry <= 14) {
          status = 'expiring-soon';
        }
      }
      
      // Calculate daily sales estimate (random for demo)
      const dailySales = Math.floor(Math.random() * 10) + 1;
      
      result.push({
        upc: item.upc,
        description: item.description,
        shelfExpiryEstimate,
        totalStock: item.storeQty || 0,
        dailyStock: Math.min(item.storeQty || 0, 30),
        sales: `${dailySales}/day`,
        batchNumbers: batches,
        status
      });
    }
    
    return result;
  }
  
  async clearData(systemType: string): Promise<boolean> {
    // Find all items from the specified system type
    const inventoryIds = Array.from(this.inventoryItems.entries())
      .filter(([_, item]) => item.systemType === systemType)
      .map(([id, _]) => id);
      
    const containerIds = Array.from(this.containerItems.entries())
      .filter(([_, item]) => item.systemType === systemType)
      .map(([id, _]) => id);
      
    const stockDeductionIds = Array.from(this.stockDeductions.entries())
      .filter(([_, item]) => item.systemType === systemType)
      .map(([id, _]) => id);
      
    const activityIds = Array.from(this.activities.entries())
      .filter(([_, item]) => item.systemType === systemType)
      .map(([id, _]) => id);
    
    // Delete them all
    for (const id of inventoryIds) {
      this.inventoryItems.delete(id);
    }
    
    for (const id of containerIds) {
      this.containerItems.delete(id);
    }
    
    for (const id of stockDeductionIds) {
      this.stockDeductions.delete(id);
    }
    
    for (const id of activityIds) {
      this.activities.delete(id);
    }
    
    // Create activity to log the clear operation
    await this.createActivity({
      type: "info",
      title: "Data cleared",
      description: `All data for ${systemType} system was cleared`,
      systemType
    });
    
    return true;
  }
}

export const storage = new MemStorage();
