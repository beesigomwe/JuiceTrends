import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/stats-card";
import { PlatformIcon, getPlatformName } from "@/components/platform-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Heart,
  MousePointer,
  Users,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DashboardStats, ChartDataPoint, Post, SocialAccount, PlatformType } from "@shared/schema";
import { format } from "date-fns";

const COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(280, 75%, 52%)",
  "hsl(245, 85%, 58%)",
  "hsl(220, 90%, 50%)",
  "hsl(200, 85%, 45%)",
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("7d");

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ["/api/dashboard/chart"],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const publishedPosts = posts?.filter((p) => p.status === "published") || [];
  const topPosts = [...publishedPosts]
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 5);

  const platformData = accounts?.map((account) => ({
    name: getPlatformName(account.platform),
    platform: account.platform,
    followers: account.followers || 0,
    engagement: parseFloat(account.engagement?.replace("%", "") || "0"),
  })) || [];

  const engagementByPlatform = accounts?.map((account) => ({
    name: getPlatformName(account.platform),
    value: parseFloat(account.engagement?.replace("%", "") || "0"),
    platform: account.platform,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analytics</h1>
          <p className="text-muted-foreground">
            Track your social media performance across all platforms.
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]" data-testid="select-date-range">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
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
              changeLabel="vs previous period"
              icon={<Eye className="h-4 w-4" />}
              testId="card-stat-reach"
            />
            <StatsCard
              title="Total Engagement"
              value={stats?.totalEngagement?.toLocaleString() || "0"}
              change={stats?.engagementChange}
              changeLabel="vs previous period"
              icon={<Heart className="h-4 w-4" />}
              testId="card-stat-engagement"
            />
            <StatsCard
              title="Total Followers"
              value={stats?.totalFollowers?.toLocaleString() || "0"}
              change={stats?.followersChange}
              changeLabel="vs previous period"
              icon={<Users className="h-4 w-4" />}
              testId="card-stat-followers"
            />
            <StatsCard
              title="Posts Published"
              value={publishedPosts.length}
              icon={<TrendingUp className="h-4 w-4" />}
              testId="card-stat-posts"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Engagement Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]" data-testid="chart-engagement">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reach"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="engagement"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Engagement by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : engagementByPlatform.length > 0 ? (
              <div className="h-[300px]" data-testid="chart-platform-engagement">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementByPlatform}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {engagementByPlatform.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Engagement"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {engagementByPlatform.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No platform data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Followers by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : platformData.length > 0 ? (
              <div className="h-[250px]" data-testid="chart-followers">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Bar dataKey="followers" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-muted-foreground">No follower data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Performing Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topPosts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPosts.map((post, index) => (
                    <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            {post.platforms.slice(0, 2).map((p) => (
                              <PlatformIcon key={p} platform={p} className="h-3.5 w-3.5" />
                            ))}
                          </div>
                          <span className="text-sm line-clamp-1 max-w-[180px]">
                            {post.content}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {post.engagement?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {post.reach?.toLocaleString() || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center">
                <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No published posts yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
