// Subscription types for RevenueCat integration
import type { PurchasesPackage } from 'react-native-purchases';

// RevenueCat entitlement identifier — must match RevenueCat dashboard
export const RC_ENTITLEMENT_ID = 'SilkRoad Pro';

// ── Billing Period ────────────────────────────────────────────
export type BillingPeriod = 'monthly' | 'semi_annual';

// ── Tier Definitions ──────────────────────────────────────────
export type SubscriptionTierId = 'starter' | 'growth' | 'pro' | 'unlimited';

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  monthlyPrice: number;
  seats: number | null; // null = unlimited
  seatLabel: string;
  highlight?: boolean;
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 299,
    seats: 1,
    seatLabel: '1 seat (you)',
    features: [
      'Up to 10 Inventory Items',
      'Up to 3 Jobs & 3 Estimates',
      'Up to 3 Clients',
      'Square Payments',
      'Google Calendar Sync',
      'Push Notifications',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 349,
    seats: 11,
    seatLabel: '11 seats (1 + 10)',
    features: [
      'Unlimited Jobs, Estimates & Clients',
      'Unlimited Inventory',
      'Team Management & Dispatching',
      '10 additional team seats',
      'Square Payments',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 399,
    seats: 21,
    seatLabel: '21 seats (1 + 20)',
    highlight: true,
    features: [
      'Everything in Growth',
      'Advanced Analytics',
      '20 additional team seats',
      'Receipt Scanning (OCR)',
    ],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    monthlyPrice: 699,
    seats: null,
    seatLabel: 'Unlimited seats',
    features: [
      'Everything in Pro',
      'Unlimited team seats',
      'Priority Support',
    ],
  },
];

// Semi-annual plan: unlimited everything, billed $2,208 every 6 months
// (Annual with 1 month discount, split into 2 payments due to Apple limits)
export const SEMI_ANNUAL_PLAN = {
  price: 2208,
  periodMonths: 6,
  monthlyEquivalent: 368, // $2,208 / 6
  tierId: 'unlimited' as SubscriptionTierId,
  savings: '11 months for the price of 12',
};

// ── Pricing Model (fallback — real prices come from RevenueCat) ──
export const PRICING = {
  basePlatformFee: 299,
  seatPackPrice: 50,
  seatsPerPack: 10,
  baseSeats: 1,
} as const;

// High-value disclaimer threshold
export const HIGH_VALUE_THRESHOLD = 699;
export const HIGH_VALUE_DISCLAIMER = 'This is a high-value subscription. By proceeding, you confirm that you authorize this recurring charge. You can cancel anytime from your device settings.';

// ── Dynamic Plan (fetched from RevenueCat offerings) ────────────
export interface DynamicPlan {
  tierId: SubscriptionTierId;
  period: BillingPeriod;
  totalSeats: number | null;
  price: number;
  priceString: string;
  rcPackage: PurchasesPackage;
}

// ── RevenueCat Product Mapping ────────────────────────────────
// Products in App Store Connect:
//   silkroad_starter_monthly     → Starter   ($299/mo, 1 seat)
//   silkroad_growth_monthly      → Growth    ($349/mo, 11 seats)
//   silkroad_pro_monthly         → Pro       ($399/mo, 21 seats)
//   silkroad_unlimited_monthly   → Unlimited ($699/mo, unlimited)
//   silkroad_unlimited_semiannual→ Unlimited ($2,208/6mo, unlimited)

/** Extract tier ID from a RevenueCat product identifier. */
export const getTierFromProductId = (productId: string): SubscriptionTierId => {
  const lower = productId.toLowerCase();
  if (lower.includes('unlimited')) return 'unlimited';
  if (lower.includes('pro')) return 'pro';
  if (lower.includes('growth')) return 'growth';
  return 'starter';
};

/** Extract billing period from a RevenueCat product identifier. */
export const getPeriodFromProductId = (productId: string): BillingPeriod =>
  productId.includes('semiannual') || productId.includes('semi_annual') ? 'semi_annual' : 'monthly';

/** Get tier definition by ID. */
export const getTierById = (tierId: SubscriptionTierId): SubscriptionTier =>
  SUBSCRIPTION_TIERS.find(t => t.id === tierId) ?? SUBSCRIPTION_TIERS[0];

/** Calculate total seats for a tier. */
export const getTotalSeats = (packs: number): number =>
  PRICING.baseSeats + packs * PRICING.seatsPerPack;

/** Calculate the fallback monthly price for a given number of packs (legacy compat). */
export const getMonthlyPrice = (packs: number): number =>
  PRICING.basePlatformFee + packs * PRICING.seatPackPrice;

// Legacy compat
export const getPacksFromProductId = (productId: string): number => {
  const tier = getTierFromProductId(productId);
  switch (tier) {
    case 'growth': return 1;
    case 'pro': return 2;
    case 'unlimited': return 0;
    default: return 0;
  }
};

// ── Subscription State ────────────────────────────────────────
export interface SubscriptionState {
  isSubscribed: boolean;
  tierId: SubscriptionTierId;
  billingPeriod: BillingPeriod;
  productIdentifier: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  seatPacks: number;
  totalSeats: number;
  monthlyPrice: number;
  isUnlimited: boolean;
  isLoading: boolean;
  error: string | null;
}

// Freemium limits (when user has no active subscription)
export interface FreemiumLimits {
  maxJobs: number;
  maxEstimates: number;
  maxClients: number;
  maxInventoryItems: number;
  maxTeamMembers: number; // 0 = only the registering user (no invites)
}

export const FREEMIUM_LIMITS: FreemiumLimits = {
  maxJobs: 3,
  maxEstimates: 3,
  maxClients: 3,
  maxInventoryItems: 10,
  maxTeamMembers: 0,
};

export type FreemiumResourceType = 'jobs' | 'estimates' | 'clients' | 'inventory' | 'team';

export const FREEMIUM_RESOURCE_LABELS: Record<FreemiumResourceType, string> = {
  jobs: 'Jobs',
  estimates: 'Estimates',
  clients: 'Clients',
  inventory: 'Inventory Items',
  team: 'Team Members',
};

export const getFreemiumLimit = (resource: FreemiumResourceType): number => {
  switch (resource) {
    case 'jobs': return FREEMIUM_LIMITS.maxJobs;
    case 'estimates': return FREEMIUM_LIMITS.maxEstimates;
    case 'clients': return FREEMIUM_LIMITS.maxClients;
    case 'inventory': return FREEMIUM_LIMITS.maxInventoryItems;
    case 'team': return FREEMIUM_LIMITS.maxTeamMembers;
  }
};

// Seat helpers
export const getAvailableSeats = (totalUsers: number, currentMembers: number): number => {
  return Math.max(0, totalUsers - currentMembers);
};

export const getSeatsNeeded = (totalUsers: number, currentMembers: number, newInvites: number): number => {
  const overflow = (currentMembers + newInvites) - totalUsers;
  return overflow > 0 ? overflow : 0;
};

export const getPacksNeededForSeats = (seatsNeeded: number): number => {
  return Math.ceil(seatsNeeded / PRICING.seatsPerPack);
};

