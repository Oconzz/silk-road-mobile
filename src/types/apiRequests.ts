// Request Models - Correspond to backend ViewModels

export interface LoginVM {
  email: string;
  password: string;
}

export interface RegisterVM {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  phone?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  company?: string;
  personalPhoto?: string;
  companyLogo?: string;  // Company logo URL or base64
  category?: string;  // Business category (e.g., "Painting", "Roofing")
}

// Inventory Request Models
export interface CreateInventoryVM {
  productId: string;
  warehouseId: string;
  quantity: number;
  price: number;
  title: string;
  description?: string;
  barcode?: string;
  imageS3Key?: string;
  category?: string;
  source?: string;
}

export interface UpdateInventoryVM {
  id: string;
  quantity?: number;
  price?: number;
  title?: string;
  description?: string;
  barcode?: string;
  category?: string;
  imageS3Key?: string;
}

export interface MoveInventoryVM {
  inventoryId: string;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  quantityToMove: number;
}

export interface InventoryListRequestVM {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  warehouseId?: string;
  productId?: string;
}

// Estimate Request Models
export interface CreateEstimateVM {
  name: string;
  description: string;
  clientId?: string;
  locationId?: string;
  proposedStartDate?: string;
  expirationDate?: string;
  items?: CreateEstimateItemVM[];
  termsAndConditions?: string;
}

export interface UpdateEstimateVM {
  id?: string;
  name?: string;
  description?: string;
  clientId?: string;
  locationId?: string;
  proposedStartDate?: string;
  expirationDate?: string;
  sent?: boolean;
  approved?: boolean;
  items?: CreateEstimateItemVM[];
  termsAndConditions?: string;
}

export interface CreateEstimateItemVM {
  productId: string;
  warehouseId: string;
  inventoryId?: string;
  quantity: number;
  price: number;
  labor: number;
  title: string;
  description?: string;
  barcode?: string;
  source?: string;
  mediaIds?: string[];
}

export interface EstimateListRequestVM {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sent?: boolean;
  approved?: boolean;
  clientId?: string;
}

export interface ConvertEstimateToJobVM {
  estimateId: string;
  jobTitle?: string;
  jobDescription?: string;
  status?: string;
}

export interface CreateEstimateMediaVM {
  estimateId: string;
  albumId?: string;
  type: string;
  fileName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
}

export interface UpdateEstimateMediaVM {
  id: string;
  caption?: string;
  albumId?: string;
}

// Job Request Models
export interface CreateJobVM {
  title: string;
  description: string;
  status: string;
  clientId?: string;
  locationId?: string;
  estimateId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedTotal?: number;
  laborCost?: number;
  materialsCost?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
  billingFrequency?: string;
  jobInventory?: CreateJobInventoryVM[];
}

export interface UpdateJobVM {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  clientId?: string;
  locationId?: string;
  estimateId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedTotal?: number;
  laborCost?: number;
  materialsCost?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
  billingFrequency?: string;
  jobInventory?: UpdateJobInventoryVM[];
}

export interface UpdateJobInventoryVM extends Partial<CreateJobInventoryVM> {
  id?: string;
}

export interface CreateJobMediaVM {
  jobId: string;
  albumId?: string;
  type: string;
  fileName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  category?: string; // before, after, general
}

export interface UpdateJobMediaVM {
  id: string;
  caption?: string;
  albumId?: string;
}

export interface CreateJobInventoryVM {
  productId?: string;
  warehouseId?: string;
  inventoryId?: string;
  idealQuantity: number;
  actualQuantity?: number;
  price?: number;
  labor?: number;
  title?: string;
  description?: string;
  barcode?: string;
  source?: string;
}

export interface JobListRequestVM {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  status?: string;
  clientId?: string;
}

// Client Request Models
export interface CreateClientVM {
  contactName: string;
  phone?: string;
  email?: string;
  companyName?: string;
  location?: CreateLocationVM;
}

export interface UpdateClientVM {
  id: string;
  contactName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  location?: UpdateLocationVM;
}

export interface ClientListRequestVM {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
}

// Bulk client creation for contact import
export interface BulkCreateClientVM {
  clients: CreateClientVM[];
}

export interface CreateLocationVM {
  name: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}

export interface UpdateLocationVM {
  id?: string;
  name?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}

// Warehouse Request Models
export interface CreateWarehouseVM {
  name: string;
  location?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

export interface UpdateWarehouseVM {
  id: string;
  name?: string;
  location?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}
