// Response Models - Correspond to backend Response Models

export interface LoginRM {
  userId: string;
  token: string;
  email: string;
  errorMessage: string;
  tokenExpiration?: string;
  changePasswordRequired: boolean;
  companies: CompanyAssignment[];
}

export interface CompanyAssignment {
  companyId: string;
  companyName: string;
  role: string;
  category?: string;
  companyLogo?: string;
  companyLogoThumbnail?: string;
}

export interface ClientInfo {
  clientId: string;
  name: string;
  ckId: string;
  isPotentialClient: boolean;
  active: boolean;
}

// Inventory Batch Response Model
export interface InventoryBatchRM {
  id: string;
  inventoryId: string;
  quantityAdded: number;
  quantityRemaining: number;
  addedAt: string;
  expiresAt: string;
  isExpired: boolean;
  daysUntilExpiration: number;
}

// Inventory Response Models
export interface InventoryRM {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  price: number;
  title: string;
  description: string;
  barcode: string;
  imageS3Key?: string;
  warehouse?: WarehouseBasicInfo;
  batches: InventoryBatchRM[];
  createDatetime: string;
  updateDatetime: string;
}

export interface WarehouseBasicInfo {
  id: string;
  name: string;
  location: string;
}

export interface InventoryListItem {
  productId: string;
  title: string;
  description: string;
  barcode: string;
  price: number;
  totalQuantity: number;
  category?: string;
  imageS3Key?: string;
  warehouseDetails: WarehouseInventoryDetail[];
  lastUpdateDatetime: string;
}

export interface WarehouseInventoryDetail {
  inventoryId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  quantity: number;
}

// Type alias for backward compatibility
export type Estimate = EstimateRM;

// Estimate Response Models
export interface EstimateRM {
  id: string;
  companyId: string;
  name: string;
  description: string;
  estimateNumber?: string;
  client?: ClientListItem;
  location?: LocationRM;
  items: EstimateItemRM[];
  lineItems?: EstimateItemRM[]; // Alias for items
  inventory?: any[]; // Legacy
  total: number;
  totalCost?: number;
  sent: boolean;
  approved: boolean;
  sentDateTime: string;
  proposedStartDate?: string;
  expirationDate?: string;
  createDatetime: string;
  updateDatetime: string;
  termsAndConditions?: string;
  media?: any[];
  albums?: any[];
  publicShareId?: string;
  publicShareUrl?: string;
  viewCount?: number;
  lastViewedAt?: string;
  // Versioning
  version?: number;
  parentEstimateId?: string;
  isLatestVersion?: boolean;
}

export interface EstimateListItem {
  id: string;
  companyId: string;
  name: string;
  estimateNumber?: string;
  clientId?: string;
  clientName: string;
  locationCity: string;
  total: number;
  sent: boolean;
  approved: boolean;
  createDatetime: string;
  version?: number;
  isLatestVersion?: boolean;
}

export interface EstimateItemRM {
  id: string;
  productId: string;
  warehouseId: string;
  inventoryId?: string;
  title: string;
  description: string;
  quantity: number;
  price: number;
  cost: number;
  labor: number;
  barcode?: string;
  source?: string;
  laborRate?: number;
  sellPrice?: number;
  type?: string;
  category?: string;
  mediaIds?: string[];
  lineTotal: number;
}

export interface EstimateMediaRM {
  id: string;
  estimateId: string;
  companyId: string;
  albumId?: string;
  type: string;
  fileName: string;
  s3Key: string;
  webUrl: string; // Full image URL from backend
  thumbUrl?: string; // Thumbnail URL from backend
  url?: string; // Alias for webUrl (compatibility)
  thumbnailUrl?: string; // Alias for thumbUrl (compatibility)
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  createDatetime: string;
}

export interface EstimateAlbumRM {
  id: string;
  estimateId: string;
  name: string;
  description?: string;
  orderIndex: number;
  media: EstimateMediaRM[];
  createDatetime: string;
}

// Job Response Models
export interface JobRM {
  id: string;
  companyId: string;
  title: string;
  jobNumber?: string;
  description: string;
  status: string;
  estimateId?: string;
  estimateTitle?: string;
  estimateNumber?: string;
  client?: ClientListItem;
  location?: LocationRM;
  jobInventory?: JobInventoryRM[];
  lineItems?: any[];
  milestones?: any[];
  notes?: any[];
  media?: any[];
  albums?: any[];
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimatedTotal?: number;
  completionPercentage?: number;
  materialsCost?: number;
  laborCost?: number;
  profit?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
  lastOccurrenceCreated?: string;
  billingFrequency?: string;
  parentJobId?: string;
  parentJobTitle?: string;
  occurrenceDate?: string;
  childJobsCount?: number;
  googleCalendarEventId?: string;
  createDatetime: string;
  updateDatetime: string;
}

export interface JobListItem {
  id: string;
  companyId: string;
  title: string;
  jobNumber?: string;
  status: string;
  clientId?: string;
  clientName: string;
  locationCity: string;
  scheduledStartDate?: string;
  estimatedTotal?: number;
  estimateId?: string;
  estimateTitle?: string;
  isRecurring?: boolean;
  parentJobId?: string;
  occurrenceDate?: string;
  childJobsCount?: number;
  completionPercentage?: number;
  createDatetime: string;
}

export interface JobInventoryRM {
  id: string;
  companyId: string;
  jobId: string;
  productId?: string;
  warehouseId?: string;
  idealQuantity: number;
  actualQuantity: number;
  quantityDifference?: number;
  price: number;
  labor: number;
  title: string;
  description?: string;
  barcode?: string;
  source?: string;
  warehouse?: {
    id: string;
    name: string;
  };
  createDatetime: string;
  updateDatetime?: string;
  // Legacy compatibility fields
  inventoryId?: string;
  quantityRequested?: number;
  quantityActual?: number;
  inventory?: InventoryRM;
}

export interface JobMediaRM {
  id: string;
  jobId: string;
  companyId: string;
  albumId?: string;
  type: string;
  fileName: string;
  s3Key: string;
  webUrl: string; // Full image URL from backend
  thumbUrl?: string; // Thumbnail URL from backend
  url?: string; // Alias for webUrl (compatibility)
  thumbnailUrl?: string; // Alias for thumbUrl (compatibility)
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  category?: string; // before, after, general
  createDatetime: string;
}

export interface JobAlbumRM {
  id: string;
  jobId: string;
  name: string;
  description?: string;
  orderIndex: number;
  media: JobMediaRM[];
  createDatetime: string;
}

// Client Response Models
export interface ClientRM {
  id: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  location?: LocationRM;
  locations?: LocationRM[];
  createDatetime: string;
  updateDatetime: string;
}

export interface ClientListItem {
  id: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  primaryAddress?: string;
  createDatetime: string;
}

// Bulk client creation response models
export interface BulkClientResultItem {
  index: number;
  id?: string;
  contactName: string;
  email: string;
  phone: string;
  status: 'created' | 'duplicate' | 'error';
  errorMessage?: string;
  duplicateField?: 'email' | 'phone';
  existingClientId?: string;
}

export interface BulkCreateClientResultRM {
  totalRequested: number;
  totalCreated: number;
  totalDuplicates: number;
  totalErrors: number;
  results: BulkClientResultItem[];
}

// Location Response Model
export interface LocationRM {
  id: string;
  companyId?: string;
  clientId: string;
  name: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  isPrimary: boolean;
  createDatetime: string;
  updateDatetime: string;
}

// Warehouse Response Model
export interface WarehouseRM {
  id: string;
  companyId: string;
  name: string;
  location: string;
  
  // Structured address fields
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  
  latitude?: number;
  longitude?: number;
  totalInventoryItems?: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface WarehouseListItem {
  id: string;
  companyId?: string;
  name: string;
  location: string;
  city?: string;
  state?: string;
  totalInventoryItems?: number;
  inventoryCount?: number;
  createDatetime?: string;
}

// Product Response Model
export interface ProductRM {
  id: string;
  name: string;
  description: string;
  category: string;
  createDatetime: string;
  updateDatetime: string;
}

// Estimate Template Response Model
export interface EstimateTemplateRM {
  id: string;
  companyId: string;
  name: string;
  description: string;
  items: EstimateItemRM[];
  createDatetime: string;
  updateDatetime: string;
}

// Receipt Response Model
export interface ReceiptRM {
  id: string;
  userId: string;
  imageUrl: string;
  processedAt: string;
  items: ReceiptItemRM[];
  totalAmount: number;
  storeName: string;
  purchaseDate: string;
}

export interface ReceiptItemRM {
  id: string;
  receiptId: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

// Company Config Response Model
export interface CompanyConfigRM {
  id: string;
  companyId: string;
  key: string;
  value: string;
  updateDatetime: string;
}

// Paged Response Wrapper - matches backend Business.Response.PagedResponse<T>
export interface PagedResponse<T> {
  items: T[];  // Backend uses "items", not "data"
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  sortBy?: string;
  sortDesc?: boolean;
  searchTerm?: string;
}

// User Response Models
export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
  createDatetime: string;
}

export interface UsersRM {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  company: string;
  personalPhoto?: string;
  isActive: boolean;
  createDatetime: string;
  updateDatetime: string;
}
