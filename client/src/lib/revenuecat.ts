/**
 * RevenueCat Web SDK Service Layer
 *
 * Centralises all RevenueCat interactions for JuiceTrends.
 * Uses @revenuecat/purchases-js v1.x (Web Billing / Stripe gateway).
 *
 * Key design decisions:
 *  - SDK is configured once per authenticated session.
 *  - The app user ID is the JuiceTrends user ID so subscriptions are
 *    portable across browsers / devices for the same account.
 *  - Entitlement identifier: "JuiceTrends Pro"
 *  - Products: monthly | yearly | lifetime
 */

import {
  Purchases,
  PurchasesError,
  ErrorCode,
  LogLevel,
  type CustomerInfo,
  type Offerings,
  type Package,
} from "@revenuecat/purchases-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Public (sandbox) API key – safe to ship in client-side code. */
export const RC_API_KEY = "test_mOxdCEqaUeCWRWzBGnkRKoGDEZq";

/** The entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = "JuiceTrends Pro";

/** Package identifiers that map to RevenueCat offering packages. */
export const PACKAGE_IDS = {
  monthly: "monthly",
  yearly: "yearly",
  lifetime: "lifetime",
} as const;

export type PackageId = (typeof PACKAGE_IDS)[keyof typeof PACKAGE_IDS];

// ---------------------------------------------------------------------------
// SDK lifecycle
// ---------------------------------------------------------------------------

let _configured = false;

/**
 * Configure the RevenueCat SDK for the given authenticated user.
 * Must be called once after the user logs in.  Subsequent calls with the
 * same userId are no-ops; a different userId triggers `changeUser`.
 */
export function configureRevenueCat(appUserId: string): Purchases {
  if (Purchases.isConfigured()) {
    const instance = Purchases.getSharedInstance();
    if (instance.getAppUserId() !== appUserId) {
      // User switched – update the identity without re-configuring.
      instance.changeUser(appUserId);
    }
    return instance;
  }

  if (import.meta.env.DEV) {
    Purchases.setLogLevel(LogLevel.Debug);
  }

  const purchases = Purchases.configure({
    apiKey: RC_API_KEY,
    appUserId,
  });

  // Warm the branding / offering cache in the background.
  purchases.preload().catch(() => {
    // Non-critical; ignore errors.
  });

  _configured = true;
  return purchases;
}

/**
 * Tear down the SDK when the user logs out.
 */
export function closeRevenueCat(): void {
  if (Purchases.isConfigured()) {
    try {
      Purchases.getSharedInstance().close();
    } catch {
      // Already closed or never configured.
    }
  }
  _configured = false;
}

/**
 * Returns the shared Purchases instance, or null if not yet configured.
 */
export function getPurchases(): Purchases | null {
  if (!Purchases.isConfigured()) return null;
  try {
    return Purchases.getSharedInstance();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Customer info & entitlements
// ---------------------------------------------------------------------------

/**
 * Fetch the latest CustomerInfo from RevenueCat.
 * Returns null on error so callers can degrade gracefully.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const purchases = getPurchases();
  if (!purchases) return null;
  try {
    return await purchases.getCustomerInfo();
  } catch (e) {
    console.error("[RevenueCat] getCustomerInfo error:", e);
    return null;
  }
}

/**
 * Check whether the current user has an active "JuiceTrends Pro" entitlement.
 */
export async function hasProEntitlement(): Promise<boolean> {
  const purchases = getPurchases();
  if (!purchases) return false;
  try {
    return await purchases.isEntitledTo(PRO_ENTITLEMENT_ID);
  } catch (e) {
    console.error("[RevenueCat] isEntitledTo error:", e);
    return false;
  }
}

/**
 * Synchronous entitlement check from a cached CustomerInfo object.
 * Use this when you already have customerInfo in hand.
 */
export function isProFromCustomerInfo(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;
}

// ---------------------------------------------------------------------------
// Offerings
// ---------------------------------------------------------------------------

/**
 * Fetch the current Offerings from RevenueCat.
 * Returns null on error.
 */
export async function getOfferings(): Promise<Offerings | null> {
  const purchases = getPurchases();
  if (!purchases) return null;
  try {
    return await purchases.getOfferings();
  } catch (e) {
    console.error("[RevenueCat] getOfferings error:", e);
    return null;
  }
}

/**
 * Convenience helper – returns the three canonical packages (monthly,
 * yearly, lifetime) from the current offering, or null for each if not found.
 */
export async function getProPackages(): Promise<{
  monthly: Package | null;
  yearly: Package | null;
  lifetime: Package | null;
}> {
  const offerings = await getOfferings();
  const current = offerings?.current ?? null;

  return {
    monthly: current?.packagesById?.[PACKAGE_IDS.monthly] ?? current?.monthly ?? null,
    yearly: current?.packagesById?.[PACKAGE_IDS.yearly] ?? current?.annual ?? null,
    lifetime: current?.packagesById?.[PACKAGE_IDS.lifetime] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

export type PurchaseOutcome =
  | { success: true; customerInfo: CustomerInfo }
  | { success: false; cancelled: boolean; error: string };

/**
 * Purchase a given RevenueCat Package.
 *
 * @param pkg          - The Package object from getOfferings().
 * @param customerEmail - Pre-fill the billing email (skips email step).
 * @param htmlTarget   - Optional DOM element to mount the checkout UI inside.
 */
export async function purchasePackage(
  pkg: Package,
  customerEmail?: string,
  htmlTarget?: HTMLElement | null,
): Promise<PurchaseOutcome> {
  const purchases = getPurchases();
  if (!purchases) {
    return { success: false, cancelled: false, error: "RevenueCat not configured." };
  }

  try {
    const result = await purchases.purchase({
      rcPackage: pkg,
      customerEmail,
      ...(htmlTarget ? { htmlTarget } : {}),
    });

    return { success: true, customerInfo: result.customerInfo };
  } catch (e) {
    if (
      e instanceof PurchasesError &&
      e.errorCode === ErrorCode.UserCancelledError
    ) {
      return { success: false, cancelled: true, error: "Purchase cancelled by user." };
    }
    const message = e instanceof Error ? e.message : "Unknown purchase error.";
    console.error("[RevenueCat] purchase error:", e);
    return { success: false, cancelled: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Paywall (RevenueCat-managed)
// ---------------------------------------------------------------------------

/**
 * Present the RevenueCat-managed paywall inside the given HTML element.
 * The paywall is configured remotely in the RevenueCat dashboard.
 *
 * @param htmlTarget - The DOM element to inject the paywall into.
 * @param offeringId - Optional specific offering identifier to use.
 */
export async function presentPaywall(
  htmlTarget: HTMLElement,
  offeringId?: string,
): Promise<PurchaseOutcome> {
  const purchases = getPurchases();
  if (!purchases) {
    return { success: false, cancelled: false, error: "RevenueCat not configured." };
  }

  try {
    let offering: import("@revenuecat/purchases-js").Offering | undefined;

    if (offeringId) {
      const offerings = await purchases.getOfferings();
      offering = offerings.all[offeringId] ?? undefined;
    }

    const result = await purchases.presentPaywall({
      htmlTarget,
      ...(offering ? { offering } : {}),
    });

    return { success: true, customerInfo: result.customerInfo };
  } catch (e) {
    if (
      e instanceof PurchasesError &&
      e.errorCode === ErrorCode.UserCancelledError
    ) {
      return { success: false, cancelled: true, error: "Paywall dismissed by user." };
    }
    const message = e instanceof Error ? e.message : "Unknown paywall error.";
    console.error("[RevenueCat] presentPaywall error:", e);
    return { success: false, cancelled: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Restore purchases
// ---------------------------------------------------------------------------

/**
 * Restore purchases for the current user.
 * Returns updated CustomerInfo or null on failure.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  // The Web SDK does not have a dedicated restorePurchases() method.
  // Fetching fresh CustomerInfo from the server achieves the same result,
  // as RevenueCat reconciles the purchase history server-side.
  return getCustomerInfo();
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a price from a RevenueCat WebBillingProduct for display.
 */
export function formatPrice(
  priceAmount: number,
  currency: string,
  locale = "en-US",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(priceAmount / 100);
  } catch {
    return `${currency.toUpperCase()} ${(priceAmount / 100).toFixed(2)}`;
  }
}
