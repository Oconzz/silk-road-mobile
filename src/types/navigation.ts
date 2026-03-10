import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { OCRMethod } from './index';

// Auth Stack Navigator types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
};

// Home Stack (nested inside HomeTab to preserve tab bar)
export type HomeStackParamList = {
  HomeMain: undefined;
  ClientsList: {
    importSuccessMessage?: string;
  } | undefined;
  TeamMembers: undefined;
  TemplatesList: undefined;
};

// Bottom Tab Navigator types
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  JobsTab: undefined;
  EstimatesTab: undefined;
  InventoryTab: undefined;
  TimeCardsTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Home: undefined;
  Inventory: undefined;
  AddInventory: {
    existingItems?: InventoryItem[];
  } | undefined;
  CaptureReceipt: {
    existingItems?: InventoryItem[];
    ocrMethod?: OCRMethod;
  } | undefined;
  ManualEntry: {
    barcode?: string;
    productName?: string;
    productDescription?: string;
    productBrand?: string;
    productCategory?: string;
    productImageUrl?: string;
    existingItems?: InventoryItem[];
  } | undefined;
  ReviewItems: {
    items: InventoryItem[];
  };
  BarcodeScanner: {
    onScan: (barcode: string) => void;
    /** Context of where barcode scanner was called from */
    context?: 'inventory' | 'manual-entry' | 'item-update';
  };
  // Estimate screens
  EstimatesList: undefined;
  EstimateDetail: {
    estimateId: string;
  };
  CreateEstimate: {
    templateId?: string;
    duplicateFromId?: string;
  } | undefined;
  SelectInventoryForEstimate: undefined;
  // Client screens
  ClientsList: {
    importSuccessMessage?: string;
  } | undefined;
  ClientDetail: {
    clientId: string;
  };
  CreateClient: undefined;
  SelectClient: undefined;
  SelectLocation: {
    clientId: string;
    mode?: 'select' | 'manage'; // 'select' for estimate/job, 'manage' for client profile
  };
  // Template screens
  TemplatesList: undefined;
  // Job screens
  JobsList: undefined;
  JobDetail: {
    jobId: string;
  };
  CreateJob: {
    clientId?: string;
    templateId?: string;
    editMode?: boolean;
    isNewJob?: boolean; // When true, clears any saved draft
  } | undefined;
  // Client Profile
  ClientProfile: {
    clientId: string;
  };
  // Edit Client
  EditClient: {
    clientId: string;
  };
  // Select Inventory for Job
  SelectInventoryForJob: {
    onSelectItems?: (items: Array<{
      item: InventoryItem;
      percentage: number;
      quantity: number;
    }>) => void;
  } | undefined;
  // Settings
  Settings: undefined;
  CompanySettings: undefined;
  EditProfile: undefined;
  // Team Management (Admin only)
  TeamMembers: undefined;
  InviteTeamMember: {
    fullName?: string;
    email?: string;
    phone?: string;
  } | undefined;
  TeamMemberProfile: {
    memberId: string;
  };
  // Job Goals
  JobGoals: {
    jobId: string;
  };
  CreateJobGoal: {
    jobId: string;
  };
  EditJobGoal: {
    goalId: string;
  };
  // Assign Team Members to Job
  AssignTeamMembers: {
    jobId: string;
    jobTitle: string;
  };
  // Time Cards
  TimeCards: undefined;
  // My Goals
  MyGoals: undefined;
  // Warehouses
  Warehouses: undefined;
  // Subscription / Plan
  PlanSelection: {
    fromRegistration?: boolean;
  } | undefined;
  ManagePlan: undefined;
  // Notification Settings
  NotificationSettings: undefined;
  // Contact Import
  ContactImport: undefined;
  // Team Contact Import (select contact then navigate to InviteTeamMember)
  TeamContactImport: undefined;
  // Export Payments (QuickBooks CSV)
  ExportPayments: undefined;
};

// Tab screen props (composite for nested navigation)
export type HomeTabScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type InventoryTabScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'InventoryTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type EstimatesTabScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'EstimatesTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type JobsTabScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'JobsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Stack screen props (for screens pushed from tabs)
export type HomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Home'
>;
export type InventoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Inventory'
>;
export type AddInventoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AddInventory'
>;
export type CaptureReceiptScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CaptureReceipt'
>;
export type ReviewItemsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ReviewItems'
>;
export type BarcodeScannerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'BarcodeScanner'
>;
export type ManualEntryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ManualEntry'
>;

// Estimate screen props
export type EstimatesListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'EstimatesList'
>;
export type EstimateDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'EstimateDetail'
>;
export type CreateEstimateScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CreateEstimate'
>;
export type SelectInventoryForEstimateScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SelectInventoryForEstimate'
>;

// Client screen props
export type ClientsListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ClientsList'
>;
export type ClientDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ClientDetail'
>;
export type CreateClientScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CreateClient'
>;
export type SelectClientScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SelectClient'
>;
export type SelectLocationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SelectLocation'
>;

// Template screen props
export type TemplatesListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TemplatesList'
>;

// Job screen props
export type JobsListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'JobsList'
>;
export type JobDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'JobDetail'
>;
export type CreateJobScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CreateJob'
>;

// Client Profile screen props
export type ClientProfileScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ClientProfile'
>;

// Edit Client screen props
export type EditClientScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'EditClient'
>;

// Warehouse screen props
export type WarehousesScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Warehouses'
>;

// Contact Import screen props
export type ContactImportScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ContactImport'
>;

// Team Contact Import screen props
export type TeamContactImportScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TeamContactImport'
>;

// Subscription screen props
export type PlanSelectionScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PlanSelection'
>;
export type ManagePlanScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ManagePlan'
>;

export interface InventoryItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  quantity: number;
  price: number;
  barcode?: string;
  purchaseDate?: string;
  store?: string;
  /** Product ID for backend reference */
  productId?: string;
  /** Warehouse ID for backend reference */
  warehouseId?: string;
  /** Return deadline for rentals or items that need to be returned */
  returnDeadline?: string; // ISO date string
  /** Category for organizing materials (e.g., "Roofing", "Flooring", "Electrical") */
  category?: string;
  /** Tags for additional filtering/grouping */
  tags?: string[];
  /** S3 key for the product image */
  imageS3Key?: string;
  /** Local image URI for display before upload */
  imageUri?: string;
}

/** Predefined categories for inventory items */
export const INVENTORY_CATEGORIES = [
  'Roofing',
  'Flooring',
  'Electrical',
  'Plumbing',
  'Painting',
  'Drywall',
  'Framing',
  'Fixtures',
  'Hardware',
  'Landscaping',
  'HVAC',
  'Insulation',
  'Other',
] as const;

export type InventoryCategory = typeof INVENTORY_CATEGORIES[number];
