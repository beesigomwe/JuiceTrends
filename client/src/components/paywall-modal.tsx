/**
 * PaywallModal – Full-featured subscription paywall for JuiceTrends Pro.
 *
 * Strategy:
 *  1. First, attempt to render the RevenueCat-managed paywall via
 *     `purchases.presentPaywall()` inside the modal body.  This gives you
 *     the remotely-configurable paywall from the RC dashboard.
 *  2. If the RC paywall is unavailable (no paywall configured in dashboard,
 *     or SDK not yet ready), fall back to the custom built-in paywall that
 *     fetches offerings and renders the three packages directly.
 *
 * The component is opened/closed via the SubscriptionContext.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Zap,
  Crown,
  Infinity as InfinityIcon,
  Loader2,
  X,
  RefreshCw,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getProPackages,
  purchasePackage,
  presentPaywall,
  formatPrice,
  type PurchaseOutcome,
} from "@/lib/revenuecat";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import type { Package } from "@revenuecat/purchases-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlanKey = "monthly" | "yearly" | "lifetime";

interface PlanConfig {
  key: PlanKey;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  highlight: boolean;
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    key: "monthly",
    label: "Monthly",
    sublabel: "Billed every month",
    icon: <Zap className="h-5 w-5" />,
    highlight: false,
  },
  {
    key: "yearly",
    label: "Yearly",
    sublabel: "Billed once a year",
    icon: <Crown className="h-5 w-5" />,
    badge: "Best Value",
    badgeVariant: "default",
    highlight: true,
  },
  {
    key: "lifetime",
    label: "Lifetime",
    sublabel: "One-time payment",
    icon: <InfinityIcon className="h-5 w-5" />,
    badge: "Forever",
    badgeVariant: "secondary",
    highlight: false,
  },
];

const PRO_FEATURES = [
  "Manage unlimited social accounts",
  "Connect all Facebook Pages & Instagram accounts",
  "Advanced analytics & reporting",
  "Unlimited AI-generated post suggestions",
  "Priority scheduling & bulk publishing",
  "Custom brand workspaces",
  "Newsletter & ad campaign management",
  "Priority customer support",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaywallModal() {
  const { isPaywallOpen, closePaywall, refresh } = useSubscription();
  const { toast } = useToast();

  // RC-managed paywall container ref
  const rcPaywallRef = useRef<HTMLDivElement>(null);

  // State
  const [mode, setMode] = useState<"loading" | "rc-paywall" | "custom">("loading");
  const [packages, setPackages] = useState<Record<PlanKey, Package | null>>({
    monthly: null,
    yearly: null,
    lifetime: null,
  });
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // ---------------------------------------------------------------------------
  // Initialise paywall when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isPaywallOpen) {
      setMode("loading");
      return;
    }

    let cancelled = false;

    async function init() {
      // Small delay so the modal DOM is rendered before we try to inject RC paywall.
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;

      if (rcPaywallRef.current) {
        // Attempt RC-managed paywall first.
        try {
          const outcome = await presentPaywall(rcPaywallRef.current);
          if (cancelled) return;

          if (outcome.success) {
            await refresh();
            toast({ title: "Welcome to JuiceTrends Pro!", description: "Your subscription is now active." });
            closePaywall();
          } else if (!outcome.cancelled) {
            // RC paywall errored – fall back to custom.
            setMode("custom");
            loadPackages();
          } else {
            // User dismissed RC paywall.
            closePaywall();
          }
          return;
        } catch {
          // Fall through to custom paywall.
        }
      }

      if (!cancelled) {
        setMode("custom");
        loadPackages();
      }
    }

    async function loadPackages() {
      const pkgs = await getProPackages();
      if (!cancelled) {
        setPackages(pkgs as Record<PlanKey, Package | null>);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isPaywallOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Purchase handler
  // ---------------------------------------------------------------------------

  const handlePurchase = useCallback(async () => {
    const pkg = packages[selectedPlan];
    if (!pkg) {
      toast({ title: "Plan unavailable", description: "This plan is not currently available. Please try another.", variant: "destructive" });
      return;
    }

    setIsPurchasing(true);
    const outcome: PurchaseOutcome = await purchasePackage(pkg);
    setIsPurchasing(false);

    if (outcome.success) {
      await refresh();
      toast({ title: "Welcome to JuiceTrends Pro!", description: "Your subscription is now active. Enjoy unlimited accounts!" });
      closePaywall();
    } else if (!outcome.cancelled) {
      toast({ title: "Purchase failed", description: outcome.error, variant: "destructive" });
    }
  }, [packages, selectedPlan, refresh, closePaywall, toast]);

  // ---------------------------------------------------------------------------
  // Restore purchases
  // ---------------------------------------------------------------------------

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    await refresh();
    setIsRestoring(false);
    toast({ title: "Purchases restored", description: "Your subscription status has been refreshed." });
  }, [refresh, toast]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={isPaywallOpen} onOpenChange={(open) => !open && closePaywall()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
        data-testid="paywall-modal"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 pt-8 pb-6">
          <button
            onClick={closePaywall}
            className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Close paywall"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">JuiceTrends Pro</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Manage unlimited accounts and unlock every feature
              </DialogDescription>
            </div>
          </div>

          {/* Feature list */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-4">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Loading state */}
          {mode === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading plans…</p>
            </div>
          )}

          {/* RC-managed paywall container */}
          {(mode === "loading" || mode === "rc-paywall") && (
            <div
              ref={rcPaywallRef}
              id="rc-paywall-container"
              className={cn("min-h-[200px]", mode === "loading" ? "hidden" : "block")}
            />
          )}

          {/* Custom paywall fallback */}
          {mode === "custom" && (
            <>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-2">
                Choose your plan
              </h3>

              <div className="space-y-3">
                {PLAN_CONFIGS.map((plan) => {
                  const pkg = packages[plan.key];
                  const product = pkg?.webBillingProduct;
                  const isSelected = selectedPlan === plan.key;

                  return (
                    <button
                      key={plan.key}
                      onClick={() => setSelectedPlan(plan.key)}
                      disabled={!pkg}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted/30",
                        plan.highlight && !isSelected && "border-primary/30",
                        !pkg && "opacity-40 cursor-not-allowed",
                      )}
                      data-testid={`plan-option-${plan.key}`}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {plan.icon}
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{plan.label}</span>
                          {plan.badge && (
                            <Badge variant={plan.badgeVariant} className="text-xs">
                              {plan.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.sublabel}</p>
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        {product ? (
                          <>
                            <p className="font-bold text-lg leading-tight">
                              {formatPrice(product.currentPrice.amountMicros / 10000, product.currentPrice.currency)}
                            </p>
                            {plan.key === "yearly" && packages.monthly?.webBillingProduct && (
                              <p className="text-xs text-muted-foreground">
                                {formatPrice(
                                  product.currentPrice.amountMicros / 10000 / 12,
                                  product.currentPrice.currency,
                                )}
                                /mo
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              <Separator />

              {/* CTA */}
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={handlePurchase}
                disabled={isPurchasing || !packages[selectedPlan]}
                data-testid="button-subscribe"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Subscribe to {PLAN_CONFIGS.find((p) => p.key === selectedPlan)?.label}
                  </>
                )}
              </Button>

              {/* Restore & legal */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  data-testid="button-restore-purchases"
                >
                  {isRestoring ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Restore purchases
                </button>
                <span>Cancel anytime · Secure checkout</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
