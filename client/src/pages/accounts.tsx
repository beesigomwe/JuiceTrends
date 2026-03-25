import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlatformIcon, getPlatformName } from "@/components/platform-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  RefreshCw,
  Unlink,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
} from "lucide-react";
import type { SocialAccount, PlatformType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";

const availablePlatforms: { platform: PlatformType; description: string }[] = [
  { platform: "facebook", description: "Connect your Facebook Page" },
  { platform: "instagram", description: "Connect your Instagram Business account" },
  { platform: "twitter", description: "Connect your X (Twitter) account" },
  { platform: "linkedin", description: "Connect your LinkedIn Company Page" },
  { platform: "tiktok", description: "Connect your TikTok Business account" },
  { platform: "pinterest", description: "Connect your Pinterest account" },
  { platform: "youtube", description: "Connect your YouTube channel" },
  { platform: "threads", description: "Connect your Threads account" },
];

export default function AccountsPage() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformType | null>(null);
  const queryClient = useQueryClient();
  const search = useSearch();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: PlatformType) => {
      // Kept for potential future manual connections; currently unused.
      return apiRequest("POST", "/api/accounts", {
        platform,
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/accounts/${id}/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  const connectedPlatforms = accounts?.map((a) => a.platform) || [];
  const totalFollowers = accounts?.reduce((sum, a) => sum + (a.followers || 0), 0) || 0;

  const handleConnect = (platform: PlatformType) => {
    setConnectingPlatform(platform);
    window.location.href = `/api/auth/${platform}`;
  };

  useEffect(() => {
    if (!search) return;

    const params = new URLSearchParams(search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) {
      toast({
        title: `${connected} connected successfully!`,
      });
      window.history.replaceState({}, "", "/accounts");
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        facebook_no_pages:
          "No Facebook Pages found. Create a Page or grant access to at least one Page.",
        instagram_no_account:
          "No Instagram Business account linked to your Facebook Pages. Link an Instagram account in Facebook Page settings.",
        youtube_no_channel: "No YouTube channel found for this account.",
        invalid_state: "Invalid or expired connection request. Please try again.",
      };
      const message = errorMessages[error] ?? `Failed to connect ${error}`;
      toast({
        title: message,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/accounts");
    }
  }, [search, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Connected Accounts</h1>
          <p className="text-muted-foreground">
            Manage your social media platform connections.
          </p>
        </div>
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-connect-account">
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Connect a Social Account</DialogTitle>
              <DialogDescription>
                Choose a platform to connect your account, refresh access, or add new pages/channels.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availablePlatforms.map(({ platform, description }) => {
                const isConnected = connectedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border text-left transition-colors",
                      "hover:bg-accent/50 cursor-pointer"
                    )}
                    onClick={() => handleConnect(platform)}
                    disabled={connectingPlatform !== null}
                    data-testid={`button-connect-${platform}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <PlatformIcon platform={platform} className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{getPlatformName(platform)}</p>
                      <p className="text-sm text-muted-foreground">
                        {connectingPlatform === platform
                          ? `Redirecting to ${getPlatformName(platform)}...`
                          : isConnected
                            ? "Already connected. Click to refresh access or add more pages/channels."
                            : description}
                      </p>
                    </div>
                    {isConnected && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connected Platforms
            </CardTitle>
            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-connected-count">
              {accounts?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">of 7 available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Followers
            </CardTitle>
            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-followers">
              {totalFollowers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">across all platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Engagement
            </CardTitle>
            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-avg-engagement">
              {accounts && accounts.length > 0
                ? (
                    accounts.reduce(
                      (sum, a) => sum + parseFloat(a.engagement?.replace("%", "") || "0"),
                      0
                    ) / accounts.length
                  ).toFixed(1)
                : "0"}
              %
            </div>
            <p className="text-xs text-muted-foreground">engagement rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Connected Accounts</h2>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-full mb-4" />
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="hover-elevate" data-testid={`card-account-${account.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={account.avatarUrl || ""} />
                        <AvatarFallback className="bg-muted">
                          <PlatformIcon platform={account.platform} className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{account.accountName}</p>
                        <p className="text-sm text-muted-foreground">
                          @{account.accountHandle}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-account-menu-${account.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => refreshMutation.mutate(account.id)}
                          data-testid="menu-refresh-account"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => disconnectMutation.mutate(account.id)}
                          className="text-red-600"
                          data-testid="menu-disconnect-account"
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <Badge
                      variant="secondary"
                      className={cn(
                        account.isConnected
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {account.isConnected ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Disconnected
                        </>
                      )}
                    </Badge>
                    <PlatformIcon platform={account.platform} className="h-5 w-5" />
                  </div>

                  {!account.isConnected && (
                    <div className="mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(account.platform)}
                        disabled={connectingPlatform !== null}
                        data-testid="button-reconnect-account"
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Reconnect
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold font-mono">
                        {account.followers?.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Followers</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono">{account.engagement}</p>
                      <p className="text-xs text-muted-foreground">Engagement</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your social media accounts to start managing content.
              </p>
              <Button onClick={() => setConnectDialogOpen(true)} data-testid="button-connect-first">
                <Plus className="h-4 w-4 mr-2" />
                Connect Account
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
