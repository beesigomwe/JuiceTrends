/**
 * AccountActivationGate
 *
 * When a user is on the Free plan and has more than one connected social
 * account, this dialog prompts them to choose which single account to keep
 * active.  All other accounts are shown as inactive (greyed out) and cannot
 * be used for publishing until the user upgrades to Pro.
 *
 * The component is rendered inside the Accounts page.  It appears
 * automatically when:
 *  - The user is NOT on Pro, AND
 *  - They have more than one connected account, AND
 *  - No active account has been explicitly chosen yet (stored in localStorage).
 *
 * The active account ID is persisted in localStorage under the key
 * `jt_active_account_<userId>` so it survives page refreshes.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Crown, CheckCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformIcon, getPlatformName } from "@/components/platform-icon";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import type { SocialAccount } from "@shared/schema";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function storageKey(userId: string) {
  return `jt_active_account_${userId}`;
}

export function getActiveAccountId(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function setActiveAccountId(userId: string, accountId: string): void {
  try {
    localStorage.setItem(storageKey(userId), accountId);
  } catch {
    // Storage unavailable – silently ignore.
  }
}

// ---------------------------------------------------------------------------
// Hook – use this anywhere to know if an account is "active" for free users
// ---------------------------------------------------------------------------

export function useActiveAccount(accounts: SocialAccount[] | undefined) {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  const [activeAccountId, setActiveId] = useState<string | null>(() => {
    if (!user) return null;
    return getActiveAccountId(user.id);
  });

  // If the user is Pro, every account is active.
  const isAccountActive = useCallback(
    (accountId: string): boolean => {
      if (isPro) return true;
      if (!accounts || accounts.length <= 1) return true;
      return activeAccountId === accountId;
    },
    [isPro, accounts, activeAccountId],
  );

  const activateAccount = useCallback(
    (accountId: string) => {
      if (!user) return;
      setActiveAccountId(user.id, accountId);
      setActiveId(accountId);
    },
    [user],
  );

  return { activeAccountId, isAccountActive, activateAccount };
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

interface AccountActivationGateProps {
  accounts: SocialAccount[];
  /** Called after the user confirms their active account selection. */
  onConfirm?: (activeAccountId: string) => void;
}

export function AccountActivationGate({
  accounts,
  onConfirm,
}: AccountActivationGateProps) {
  const { user } = useAuth();
  const { isPro, openPaywall } = useSubscription();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");

  // Determine whether the gate should be shown.
  useEffect(() => {
    if (!user || isPro || accounts.length <= 1) {
      setOpen(false);
      return;
    }

    const existing = getActiveAccountId(user.id);
    const existingIsValid = existing && accounts.some((a) => a.id === existing);

    if (!existingIsValid) {
      // No valid active account chosen yet – show the gate.
      setSelected(accounts[0]?.id ?? "");
      setOpen(true);
    }
  }, [user, isPro, accounts]);

  const handleConfirm = useCallback(() => {
    if (!user || !selected) return;
    setActiveAccountId(user.id, selected);
    setOpen(false);
    onConfirm?.(selected);
  }, [user, selected, onConfirm]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      {/* Prevent closing by clicking outside – user MUST choose */}
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="account-activation-gate"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Lock className="h-4 w-4" />
            </div>
            <DialogTitle>Choose Your Active Account</DialogTitle>
          </div>
          <DialogDescription>
            The <strong>Free plan</strong> supports one active account at a time.
            Select which account you want to use, or upgrade to Pro to manage all
            of them simultaneously.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="space-y-2 my-2"
        >
          {accounts.map((account) => (
            <Label
              key={account.id}
              htmlFor={`account-${account.id}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                selected === account.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <RadioGroupItem
                value={account.id}
                id={`account-${account.id}`}
                className="shrink-0"
              />
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={account.avatarUrl ?? ""} />
                <AvatarFallback className="bg-muted text-xs">
                  <PlatformIcon platform={account.platform} className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{account.accountName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getPlatformName(account.platform)} · @{account.accountHandle}
                </p>
              </div>
              {selected === account.id && (
                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
              )}
            </Label>
          ))}
        </RadioGroup>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={!selected}
            data-testid="button-confirm-active-account"
          >
            Use this account
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={openPaywall}
            data-testid="button-upgrade-from-gate"
          >
            <Crown className="h-4 w-4 text-primary" />
            Upgrade to Pro – manage all accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Free-plan account limit banner
// ---------------------------------------------------------------------------

/**
 * Shown at the top of the Accounts page when the user is on the free plan
 * and has more than one account connected.
 */
export function FreePlanAccountBanner({
  totalAccounts,
  activeAccountName,
}: {
  totalAccounts: number;
  activeAccountName?: string;
}) {
  const { isPro, openPaywall } = useSubscription();

  if (isPro || totalAccounts <= 1) return null;

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      data-testid="free-plan-account-banner"
    >
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-medium">
            Free plan: 1 of {totalAccounts} accounts active
          </p>
          <p className="text-xs text-muted-foreground">
            {activeAccountName
              ? `"${activeAccountName}" is your active account.`
              : "Select an account to activate."}{" "}
            Upgrade to manage all {totalAccounts} accounts.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
        onClick={openPaywall}
        data-testid="button-upgrade-banner"
      >
        <Crown className="h-3.5 w-3.5" />
        Upgrade
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pro-gated feature wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps any UI element that should be locked behind the Pro entitlement.
 * Shows a lock overlay and opens the paywall when clicked on free plan.
 */
export function ProGate({
  children,
  feature,
  className,
}: {
  children: React.ReactNode;
  feature?: string;
  className?: string;
}) {
  const { isPro, openPaywall } = useSubscription();

  if (isPro) return <>{children}</>;

  return (
    <div className={cn("relative group", className)}>
      <div className="pointer-events-none opacity-50 select-none">{children}</div>
      <button
        onClick={openPaywall}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Upgrade to Pro to access ${feature ?? "this feature"}`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Crown className="h-4 w-4" />
        </div>
        <Badge variant="default" className="text-xs shadow-lg">
          Pro Feature
        </Badge>
      </button>
    </div>
  );
}
