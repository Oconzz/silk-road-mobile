// Estimate Types - Aligned with backend models

// ===== Location =====
export interface Location {
  id: string;
  companyId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface LocationListItem {
  id: string;
  companyId: string;
  addressLine1: string;
  city: string;
  state: string;
  zipcode?: string;
  createDatetime: string;
}

export interface CreateLocationRequest {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// ===== Client =====
export interface Client {
  id: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName?: string;
  location?: Location;
  createDatetime: string;
  updateDatetime: string;
}

export interface ClientListItem {
  id: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName?: string;
  createDatetime: string;
}

export interface CreateClientRequest {
  contactName: string;
  phone: string;
  email: string;
  companyName?: string;
  location?: CreateLocationRequest;
}

export interface UpdateClientRequest {
  id: string;
  contactName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
}

export interface ClientListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
}

// ===== Estimate Media (Gallery) =====
export type EstimateMediaType = 'image' | 'video';
export type EstimateMediaSource = 'camera' | 'library';

export interface EstimateMedia {
  id: string;
  type: EstimateMediaType;
  source: EstimateMediaSource;
  uri: string; // URI local dentro do storage do app (NÃO gallery URI temporária)
  thumbnailUri?: string; // Obrigatório para video
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string; // ISO
  albumId: string; // Obrigatório - todo media pertence a um album
  lineItemId?: string; // Opcional (para futuro link com line items)
  notes?: string;
  s3Key?: string; // S3 storage key for remote access
}

export interface EstimateAlbum {
  id: string;
  name: string;
  createdAt: string; // ISO
  sortOrder: number;
}

// Default album name constant
export const DEFAULT_ALBUM_NAME = 'Overview';

// ===== Estimate Line Item (Frontend only - backend uses Inventory) =====
export interface EstimateLineItem {
  id: string;
  productId?: string; // Backend product ID
  warehouseId?: string; // Backend warehouse ID
  title: string; // Item title (required by backend)
  description: string;
  quantity: number;
  price: number; // Price per unit (required by backend)
  cost: number; // Cost price (what contractor paid)
  labor: number; // Labor amount (required by backend)
  sellPrice?: number; // Sell price (what contractor charges client) - if not set, defaults to cost
  laborRate?: number; // Hourly rate for labor
  barcode?: string; // Item barcode
  source?: string; // Source info
  inventoryId?: string; // If linked to inventory
  isManual?: boolean; // True if manually added (not from inventory)
  type?: 'material' | 'labor' | 'other'; // Item type - defaults to 'material'
  mediaIds?: string[]; // IDs of associated gallery images/videos
  category?: string; // Category name for the line item
}

// ===== Estimate =====
export interface Estimate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  client?: ClientListItem;
  location?: Location;
  inventory: InventoryRM[];
  total: number;
  sent: boolean;
  approved: boolean;
  sentDateTime?: string;
  createDatetime: string;
  updateDatetime: string;
  // Frontend-only computed fields
  lineItems?: EstimateLineItem[];
  totalCost?: number;
  totalLabor?: number;
  estimateNumber?: string; // Generated on frontend: EST-XXXXX
  expirationDate?: string;
  media?: EstimateMedia[]; // Gallery images/videos
  albums?: EstimateAlbum[]; // Gallery albums/folders
}

export interface EstimateListItem {
  id: string;
  companyId: string;
  name: string;
  clientName?: string; // Optional for frontend-only
  locationCity?: string; // Optional for frontend-only
  estimateNumber?: string; // Frontend-only
  total: number;
  sent: boolean;
  approved: boolean;
  createDatetime: string;
}

export interface CreateEstimateRequest {
  name: string;
  description: string;
  clientId?: string;
  locationId?: string;
  inventoryIds?: string[];
}

export interface UpdateEstimateRequest {
  id: string;
  name?: string;
  description?: string;
  clientId?: string;
  locationId?: string;
  sent?: boolean;
  approved?: boolean;
  inventoryIds?: string[];
}

export interface EstimateListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sent?: boolean;
  approved?: boolean;
  clientId?: string;
}

export interface ConvertEstimateToJobRequest {
  estimateId: string;
  jobTitle?: string;
  jobDescription?: string;
  status?: string;
}

// ===== Estimate Template =====
export interface EstimateTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  inventory: InventoryRM[];
  lineItems?: EstimateLineItem[];
  media?: EstimateMedia[];
  albums?: EstimateAlbum[];
  total: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface EstimateTemplateListItem {
  id: string;
  companyId: string;
  name: string;
  description: string;
  total: number;
  inventoryCount: number;
  createDatetime: string;
}

export interface CreateEstimateTemplateRequest {
  name: string;
  description: string;
  inventoryIds?: string[];
}

export interface UpdateEstimateTemplateRequest {
  id: string;
  name?: string;
  description?: string;
  inventoryIds?: string[];
}

export interface EstimateTemplateListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
}

// ===== Job =====
export interface Job {
  id: string;
  companyId: string;
  title: string;
  description: string;
  status: string;
  client?: ClientListItem;
  location?: Location;
  createDatetime: string;
  updateDatetime: string;
}

export interface JobListItem {
  id: string;
  companyId: string;
  title: string;
  status: string;
  clientName: string;
  locationCity: string;
  createDatetime: string;
}

// ===== Inventory (matching backend) =====
export interface InventoryRM {
  id: string;
  companyId: string;
  productId?: string; // Optional for frontend-only
  warehouseId?: string; // Optional for frontend-only
  quantity: number;
  price: number;
  title: string;
  description: string;
  barcode?: string;
  warehouse?: WarehouseBasicInfo;
  createDatetime: string;
  updateDatetime: string;
}

export interface WarehouseBasicInfo {
  id: string;
  name: string;
  location: string;
}

// ===== Paginated Response =====
export interface PagedResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
