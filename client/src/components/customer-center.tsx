/**
 * CustomerCenter – Self-service subscription management panel.
 *
 * The RevenueCat Customer Center is a native iOS/Android component.
 * For the web, we build an equivalent self-service panel that:
 *  - Shows the current plan & entitlement status
 *  - Provides a "Manage Subscription" link to the Stripe Customer Portal
 *    (RevenueCat Web Billing exposes this via the Customer Portal URL)
 *  - Allows restoring purchases
 *  - Links to support
 *
 * This component is embedded in the Settings → Billing tab.
 */

import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  CreditCard,
  Calendar,
  Zap,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { PRO_ENTITLEMENT_ID } from "@/lib/revenuecat";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return String(date);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CustomerCenterProps {
  /** Called when the user clicks "Upgrade to Pro". */
  onUpgrade?: () => void;
  className?: string;
}

export function CustomerCenter({ onUpgrade, className }: CustomerCenterProps) {
  const { isPro, isLoading, customerInfo, refresh, openPaywall } = useSubscription();
  const { toast } = useToast();
  const [isRestoring, setIsRestoring] = useState(false);

  const proEntitlement = customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID];

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    await refresh();
    setIsRestoring(false);
    toast({
      title: "Purchases restored",
      description: "Your subscription status has been refreshed.",
    });
  }, [refresh, toast]);

  const handleUpgrade = useCallback(() => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      openPaywall();
    }
  }, [onUpgrade, openPaywall]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="customer-center">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle>Subscription</CardTitle>
          </div>
          {isPro ? (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Pro Active
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Zap className="h-3 w-3 mr-1" />
              Free Plan
            </Badge>
          )}
        </div>
        <CardDescription>
          {isPro
            ? "You have full access to all JuiceTrends Pro features."
            : "Upgrade to Pro to manage unlimited accounts and unlock all features."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current plan details */}
        {isPro && proEntitlement ? (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Crown className="h-4 w-4 text-primary" />
              JuiceTrends Pro
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-medium capitalize">
                    {proEntitlement.periodType ?? "Active"}
                  </span>
                </div>
              </div>

              {proEntitlement.expirationDate && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">
                    {proEntitlement.willRenew ? "Renews" : "Expires"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {formatDate(proEntitlement.expirationDate)}
                    </span>
                  </div>
                </div>
              )}

              {proEntitlement.originalPurchaseDate && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Member since</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {formatDate(proEntitlement.originalPurchaseDate)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Auto-renew</p>
                <div className="flex items-center gap-1.5">
                  {proEntitlement.willRenew ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {proEntitlement.willRenew ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Free plan feature comparison */
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Free plan includes:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "1 active social account",
                "Basic post scheduling",
                "Limited analytics",
                "5 AI suggestions/month",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          {isPro ? (
            <>
              {/* Manage subscription – links to Stripe Customer Portal via RevenueCat */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  // RevenueCat Web Billing Customer Portal
                  // The portal URL is available via the RC dashboard or via
                  // the customerInfo.managementURL field when present.
                  const mgmtUrl =
                    (customerInfo as any)?.managementURL ??
                    "https://billing.stripe.com/p/login/test_00000000";
                  window.open(mgmtUrl, "_blank", "noopener,noreferrer");
                }}
                data-testid="button-manage-subscription"
              >
                <CreditCard className="h-4 w-4" />
                Manage Subscription
                <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </Button>
            </>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={handleUpgrade}
              data-testid="button-upgrade-pro"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Pro
            </Button>
          )}

          {/* Restore purchases */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground gap-2"
            onClick={handleRestore}
            disabled={isRestoring}
            data-testid="button-restore-purchases"
          >
            {isRestoring ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Restore Purchases
          </Button>
        </div>

        {/* Support link */}
        <p className="text-xs text-muted-foreground text-center">
          Having issues?{" "}
          <a
            href="mailto:support@juicetrends.app"
            className="underline hover:text-foreground transition-colors"
          >
            Contact support
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
