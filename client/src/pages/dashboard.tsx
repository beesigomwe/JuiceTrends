import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/stats-card";
import { PostCard } from "@/components/post-card";
import { PostCreationDrawer } from "@/components/post-creation-drawer";
import { PlatformIcon } from "@/components/platform-icon";
import {
  Users,
  Eye,
  Heart,
  Calendar,
  Plus,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Repeat2,
  MessageCircle,
} from "lucide-react";
import { Link } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { DashboardStats, ChartDataPoint, Post, SocialAccount, SuggestedPost } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const createPostMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/recent"] });
      qc.invalidateQueries({ queryKey: ["/api/posts"] });
      setDrawerOpen(false);
      toast({ title: "Post saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save post", variant: "destructive" });
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ["/api/dashboard/chart"],
  });

  const { data: recentPosts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts/recent"],
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const handleCreatePost = async (data: Record<string, unknown>) => {
    await createPostMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your social media overview.
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} data-testid="button-create-post">
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatsCard
              title="Total Reach"
              value={stats?.totalReach?.toLocaleString() || "0"}
              change={stats?.reachChange}
              changeLabel="vs last week"
              icon={<Eye className="h-4 w-4" />}
              testId="card-stat-reach"
            />
            <StatsCard
              title="Engagement"
              value={stats?.totalEngagement?.toLocaleString() || "0"}
              change={stats?.engagementChange}
              changeLabel="vs last week"
              icon={<Heart className="h-4 w-4" />}
              testId="card-stat-engagement"
            />
            <StatsCard
              title="Scheduled Posts"
              value={stats?.scheduledPosts || 0}
              change={stats?.postsChange}
              changeLabel="vs last week"
              icon={<Calendar className="h-4 w-4" />}
              testId="card-stat-scheduled"
            />
            <StatsCard
              title="Total Followers"
              value={stats?.totalFollowers?.toLocaleString() || "0"}
              change={stats?.followersChange}
              changeLabel="vs last week"
              icon={<Users className="h-4 w-4" />}
              testId="card-stat-followers"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Performance Overview</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Reach</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-2" />
                <span className="text-muted-foreground">Engagement</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <div className="h-[280px]" data-testid="chart-performance">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="reach"
                      stroke="hsl(var(--primary))"
                      fill="url(#reachGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#engagementGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Connected Accounts</CardTitle>
            <Link href="/accounts">
              <Button variant="ghost" size="sm" data-testid="link-view-accounts">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountsLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </>
            ) : accounts && accounts.length > 0 ? (
              accounts.slice(0, 4).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                  data-testid={`card-account-${account.id}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <PlatformIcon platform={account.platform} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account.accountName}</p>
                    <p className="text-xs text-muted-foreground">@{account.accountHandle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">
                      {account.followers?.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">followers</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No accounts connected</p>
                <Link href="/accounts">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="button-connect-account">
                    Connect Account
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Upcoming Posts</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" data-testid="link-view-calendar">
                View Calendar
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {postsLoading ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </>
            ) : recentPosts && recentPosts.filter(p => p.status === "scheduled").length > 0 ? (
              recentPosts
                .filter((p) => p.status === "scheduled")
                .slice(0, 3)
                .map((post) => <PostCard key={post.id} post={post} compact />)
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming posts</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setDrawerOpen(true)}
                  data-testid="button-schedule-first"
                >
                  Schedule a Post
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <Link href="/analytics">
              <Button variant="ghost" size="sm" data-testid="link-view-analytics">
                View Analytics
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {postsLoading ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </>
            ) : recentPosts && recentPosts.filter(p => p.status === "published").length > 0 ? (
              recentPosts
                .filter((p) => p.status === "published")
                .slice(0, 3)
                .map((post) => <PostCard key={post.id} post={post} compact />)
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No published posts yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-lg font-semibold">AI Suggestions</CardTitle>
          </div>
          <Link href="/suggestions">
            <Button variant="ghost" size="sm" data-testid="link-view-suggestions">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <SuggestionsDashboardWidget />
        </CardContent>
      </Card>

      <PostCreationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleCreatePost}
        isLoading={createPostMutation.isPending}
      />
    </div>
  );
}

function SuggestionsDashboardWidget() {
  const { data: suggestions = [], isLoading } = useQuery<SuggestedPost[]>({
    queryKey: ["/api/suggestions"],
    queryFn: () => fetch("/api/suggestions").then((r) => r.json()),
  });

  const pending = suggestions.filter((s) => s.status === "pending").slice(0, 3);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    new_post: <Lightbulb className="w-4 h-4 text-violet-500" />,
    follow_up: <Repeat2 className="w-4 h-4 text-blue-500" />,
    comment_reply: <MessageCircle className="w-4 h-4 text-emerald-500" />,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg border">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No suggestions yet</p>
        <Link href="/suggestions">
          <Button variant="outline" size="sm" className="mt-3 gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Generate Suggestions
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((s) => (
        <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors">
          <div className="mt-0.5 shrink-0">{TYPE_ICON[s.type] ?? TYPE_ICON.new_post}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{s.content}</p>
            {s.suggestedTime && (
              <p className="text-xs text-muted-foreground mt-1">Best time: {s.suggestedTime}</p>
            )}
          </div>
        </div>
      ))}
      <Link href="/suggestions">
        <Button variant="ghost" size="sm" className="w-full mt-1 gap-1 text-muted-foreground">
          See all suggestions
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    </div>
  );
}
