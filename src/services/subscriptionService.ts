import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import Config from 'react-native-config';
import {
  RC_ENTITLEMENT_ID,
  PRICING,
  SUBSCRIPTION_TIERS,
  getPacksFromProductId,
  getTierFromProductId,
  getPeriodFromProductId,
  getTierById,
  type BillingPeriod,
  type DynamicPlan,
  type SubscriptionState,
  type SubscriptionTierId,
} from '../types/subscription';

const DEFAULT_STATE: SubscriptionState = {
  isSubscribed: false,
  tierId: 'starter',
  billingPeriod: 'monthly',
  productIdentifier: null,
  expirationDate: null,
  willRenew: false,
  seatPacks: 0,
  totalSeats: PRICING.baseSeats,
  monthlyPrice: 0,
  isUnlimited: false,
  isLoading: false,
  error: null,
};

class SubscriptionService {
  private initialized = false;

  // ── Lifecycle ──────────────────────────────────────────────

  async initialize(userId?: string): Promise<void> {
    if (this.initialized) return;

    const apiKey = Config.REVENUECAT_API_KEY;

    if (!apiKey) {
      console.warn('[SubscriptionService] REVENUECAT_API_KEY not set – subscription features disabled.');
      return;
    }

    try {
      console.log('[SubscriptionService] Configuring with key:', apiKey.substring(0, 10) + '...');
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      await Purchases.configure({ apiKey, appUserID: userId || undefined });
      this.initialized = true;
      console.log('[SubscriptionService] RevenueCat initialized ✅');
    } catch (error) {
      console.error('[SubscriptionService] Init failed:', error);
    }
  }

  async identify(userId: string): Promise<void> {
    if (!this.initialized) return;
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[SubscriptionService] Identified user:', userId,
        '| Entitlements:', Object.keys(customerInfo.entitlements.active));
    } catch (error) {
      console.error('[SubscriptionService] Identify failed:', error);
    }
  }

  async logout(): Promise<void> {
    if (!this.initialized) return;
    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('[SubscriptionService] Logout failed:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Customer Info & State ──────────────────────────────────

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.initialized) return null;
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('[SubscriptionService] getCustomerInfo failed:', error);
      return null;
    }
  }

  /**
   * Derive app-level subscription state from RevenueCat customer info.
   * Parses tier from the product identifier pattern (e.g. "silkroad_pro_monthly").
   */
  async getSubscriptionState(): Promise<SubscriptionState> {
    if (!this.initialized) return DEFAULT_STATE;

    try {
      const info = await Purchases.getCustomerInfo();
      return this.parseCustomerInfo(info);
    } catch (error: any) {
      console.error('[SubscriptionService] getSubscriptionState failed:', error);
      return { ...DEFAULT_STATE, error: error.message || 'Subscription check failed' };
    }
  }

  parseCustomerInfo(info: CustomerInfo): SubscriptionState {
    const entitlement = info.entitlements.active[RC_ENTITLEMENT_ID];
    if (!entitlement) return DEFAULT_STATE;

    const productId = entitlement.productIdentifier ?? '';
    const tierId = getTierFromProductId(productId);
    const billingPeriod = getPeriodFromProductId(productId);
    const tier = getTierById(tierId);
    const seatPacks = getPacksFromProductId(productId);
    const isUnlimited = tierId === 'unlimited';

    return {
      isSubscribed: true,
      tierId,
      billingPeriod,
      productIdentifier: productId,
      expirationDate: entitlement.expirationDate ?? null,
      willRenew: entitlement.willRenew ?? false,
      seatPacks,
      totalSeats: tier.seats ?? 999,
      monthlyPrice: tier.monthlyPrice,
      isUnlimited,
      isLoading: false,
      error: null,
    };
  }

  // ── Offerings & Purchases ──────────────────────────────────

  async getOfferings(): Promise<PurchasesOfferings | null> {
    if (!this.initialized) return null;
    try {
      return await Purchases.getOfferings();
    } catch (error) {
      console.error('[SubscriptionService] getOfferings failed:', error);
      return null;
    }
  }

  async getAvailablePackages(): Promise<PurchasesPackage[]> {
    const offerings = await this.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  }

  /**
   * Fetch all available plans from RevenueCat, mapped to our tier model.
   * Returns sorted by tier price ascending.
   */
  async getPlans(): Promise<DynamicPlan[]> {
    const packages = await this.getAvailablePackages();
    const plans: DynamicPlan[] = [];

    for (const pkg of packages) {
      const productId = pkg.product.identifier;
      const tierId = getTierFromProductId(productId);
      const period = getPeriodFromProductId(productId);
      const tier = getTierById(tierId);

      plans.push({
        tierId,
        period,
        totalSeats: tier.seats,
        price: pkg.product.price,
        priceString: pkg.product.priceString,
        rcPackage: pkg,
      });
    }

    return plans.sort((a, b) => a.price - b.price);
  }

  /**
   * Fetch only monthly plans from RevenueCat.
   */
  async getMonthlyPlans(): Promise<DynamicPlan[]> {
    const plans = await this.getPlans();
    return plans.filter(p => p.period === 'monthly');
  }

  /**
   * Find the RevenueCat package that matches a specific tier and billing period.
   */
  async findPackageForTier(tierId: SubscriptionTierId, period: BillingPeriod = 'monthly'): Promise<PurchasesPackage | null> {
    const packages = await this.getAvailablePackages();

    for (const pkg of packages) {
      const productId = pkg.product.identifier;
      const pkgTier = getTierFromProductId(productId);
      const pkgPeriod = getPeriodFromProductId(productId);

      if (pkgTier === tierId && pkgPeriod === period) return pkg;
    }

    console.warn(`[SubscriptionService] No package found for tier ${tierId} (${period})`);
    return null;
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
    if (!this.initialized) return null;
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.log('[SubscriptionService] Purchase successful');
      return customerInfo;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('[SubscriptionService] User cancelled');
        return null;
      }
      console.error('[SubscriptionService] Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Purchase (or upgrade/downgrade) to a subscription for a specific tier and billing period.
   * Returns the updated CustomerInfo on success, null if cancelled or package not found.
   */
  async purchaseForTier(tierId: SubscriptionTierId, period: BillingPeriod = 'monthly'): Promise<CustomerInfo | null> {
    const pkg = await this.findPackageForTier(tierId, period);
    if (!pkg) {
      console.error(`[SubscriptionService] Cannot purchase: no package for tier ${tierId} (${period})`);
      throw new Error(
        'Subscription products are not yet configured. Please contact support or try again later.',
      );
    }
    return this.purchasePackage(pkg);
  }

  async restorePurchases(): Promise<CustomerInfo | null> {
    if (!this.initialized) return null;
    try {
      const info = await Purchases.restorePurchases();
      console.log('[SubscriptionService] Purchases restored');
      return info;
    } catch (error) {
      console.error('[SubscriptionService] Restore failed:', error);
      throw error;
    }
  }

  // ── Customer Center ────────────────────────────────────────

  async presentCustomerCenter(): Promise<void> {
    if (!this.initialized) {
      console.warn('[SubscriptionService] Not initialized – cannot present Customer Center');
      return;
    }
    try {
      await RevenueCatUI.presentCustomerCenter();
      console.log('[SubscriptionService] Customer Center presented');
    } catch (error) {
      console.error('[SubscriptionService] Customer Center error:', error);
    }
  }

  // ── Debug ────────────────────────────────────────────────

  async debugConnection(): Promise<void> {
    console.log('\n========== REVENUECAT DEBUG ==========');
    console.log('[DEBUG] Initialized:', this.initialized);
    console.log('[DEBUG] API Key:', Config.REVENUECAT_API_KEY?.substring(0, 10) + '...');

    if (!this.initialized) {
      console.log('[DEBUG] ❌ Not initialized — cannot proceed');
      return;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[DEBUG] Customer ID:', customerInfo.originalAppUserId);
      console.log('[DEBUG] Active Entitlements:', JSON.stringify(Object.keys(customerInfo.entitlements.active)));
      console.log('[DEBUG] All Entitlements:', JSON.stringify(Object.keys(customerInfo.entitlements.all)));
    } catch (e) {
      console.error('[DEBUG] getCustomerInfo error:', e);
    }

    try {
      const offerings = await Purchases.getOfferings();
      console.log('[DEBUG] Current Offering:', offerings.current?.identifier ?? 'NULL');
      const pkgs = offerings.current?.availablePackages ?? [];
      console.log('[DEBUG] Available Packages:', pkgs.length);
      pkgs.forEach((pkg, i) => {
        console.log(`[DEBUG]   Package ${i}: id=${pkg.identifier} product=${pkg.product.identifier} price=${pkg.product.priceString}`);
      });
    } catch (e) {
      console.error('[DEBUG] getOfferings error:', e);
    }

    console.log('========== END DEBUG ==========\n');
  }

  // ── Listener ───────────────────────────────────────────────

  addCustomerInfoListener(listener: (info: CustomerInfo) => void): () => void {
    if (!this.initialized) return () => {};
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }
}

export const subscriptionService = new SubscriptionService();
