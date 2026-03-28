/**
 * useSubscription – React context + hook for RevenueCat subscription state.
 *
 * Provides:
 *  - isPro: boolean  – whether the current user has an active Pro entitlement
 *  - isLoading: boolean
 *  - customerInfo: CustomerInfo | null
 *  - refresh(): Promise<void>  – re-fetch customer info on demand
 *  - openPaywall(): void       – show the paywall modal
 *  - isPaywallOpen: boolean
 *  - closePaywall(): void
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CustomerInfo } from "@revenuecat/purchases-js";
import {
  configureRevenueCat,
  closeRevenueCat,
  getCustomerInfo,
  isProFromCustomerInfo,
} from "@/lib/revenuecat";
import { useAuth } from "@/hooks/use-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionContextValue = {
  /** True when the user has an active "JuiceTrends Pro" entitlement. */
  isPro: boolean;
  /** True while the initial customer info fetch is in progress. */
  isLoading: boolean;
  /** The raw RevenueCat CustomerInfo object, or null if unavailable. */
  customerInfo: CustomerInfo | null;
  /** Re-fetch customer info from RevenueCat (e.g. after a purchase). */
  refresh: () => Promise<void>;
  /** Open the paywall modal. */
  openPaywall: () => void;
  /** Close the paywall modal. */
  closePaywall: () => void;
  /** Whether the paywall modal is currently open. */
  isPaywallOpen: boolean;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  // Track the user ID we last configured RC for so we don't re-configure
  // unnecessarily on every render.  User IDs are strings (UUID).
  const configuredForRef = useRef<string | null>(null);

  const fetchCustomerInfo = useCallback(async () => {
    const info = await getCustomerInfo();
    setCustomerInfo(info);
  }, []);

  const refresh = useCallback(async () => {
    await fetchCustomerInfo();
  }, [fetchCustomerInfo]);

  // Configure / re-configure RevenueCat whenever the authenticated user changes.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // User logged out – tear down the SDK.
      if (configuredForRef.current !== null) {
        closeRevenueCat();
        setCustomerInfo(null);
        configuredForRef.current = null;
      }
      return;
    }

    const userId = user.id; // string UUID from the JuiceTrends auth system
    if (configuredForRef.current === userId) {
      // Already configured for this user; nothing to do.
      return;
    }

    // Configure the SDK for the newly authenticated user.
    configuredForRef.current = userId;
    configureRevenueCat(userId);

    setIsLoading(true);
    fetchCustomerInfo().finally(() => setIsLoading(false));
  }, [isAuthenticated, user, fetchCustomerInfo]);

  const openPaywall = useCallback(() => setIsPaywallOpen(true), []);
  const closePaywall = useCallback(() => setIsPaywallOpen(false), []);

  const value: SubscriptionContextValue = {
    isPro: isProFromCustomerInfo(customerInfo),
    isLoading,
    customerInfo,
    refresh,
    openPaywall,
    closePaywall,
    isPaywallOpen,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within <SubscriptionProvider>.");
  }
  return ctx;
}
