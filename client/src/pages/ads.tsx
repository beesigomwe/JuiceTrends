import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Play, Pause, BarChart2, Target, Megaphone,
  DollarSign, Eye, MousePointer, TrendingUp, ChevronRight, RefreshCw,
  Layers, Image, FileText, Globe, Users, Zap, X,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type {
  AdCampaignWithSets, AdCampaignObjective, AdPlatform, AdCampaignStatus,
  AdSet, AdCreative, AdMetric,
} from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJECTIVES: { value: AdCampaignObjective; label: string; icon: string }[] = [
  { value: "awareness", label: "Brand Awareness", icon: "👁️" },
  { value: "traffic", label: "Website Traffic", icon: "🌐" },
  { value: "engagement", label: "Engagement", icon: "💬" },
  { value: "leads", label: "Lead Generation", icon: "📋" },
  { value: "conversions", label: "Conversions", icon: "🎯" },
  { value: "sales", label: "Sales", icon: "🛒" },
];

const AD_PLATFORMS: { value: AdPlatform; label: string; color: string }[] = [
  { value: "facebook", label: "Facebook", color: "bg-blue-600" },
  { value: "instagram", label: "Instagram", color: "bg-pink-500" },
  { value: "linkedin", label: "LinkedIn", color: "bg-blue-700" },
  { value: "twitter", label: "Twitter / X", color: "bg-black" },
];

const STATUS_COLORS: Record<AdCampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

function spendPercent(spend: number, budget: number): number {
  if (!budget) return 0;
  return Math.min(100, Math.round((spend / budget) * 100));
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onEdit,
  onDelete,
  onStatusChange,
  onSelect,
  selected,
}: {
  campaign: AdCampaignWithSets;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: AdCampaignStatus) => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const m = campaign.metrics;
  const spend = m?.totalSpend ?? 0;
  const budget = campaign.totalBudget ?? 0;
  const pct = spendPercent(spend, budget);
  const platform = AD_PLATFORMS.find((p) => p.value === campaign.platform);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full ${platform?.color ?? "bg-gray-400"}`} />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {platform?.label ?? campaign.platform}
              </span>
            </div>
            <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {OBJECTIVES.find((o) => o.value === campaign.objective)?.icon}{" "}
              {OBJECTIVES.find((o) => o.value === campaign.objective)?.label}
            </p>
          </div>
          <Badge className={`text-xs shrink-0 ${STATUS_COLORS[campaign.status as AdCampaignStatus]}`}>
            {campaign.status}
          </Badge>
        </div>

        {/* Budget progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Spend: {formatCurrency(spend)}</span>
            <span>Budget: {formatCurrency(budget)}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center">
            <p className="text-xs font-semibold">{(m?.totalImpressions ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Impr.</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold">{(m?.totalClicks ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Clicks</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold">{m?.avgCtr ?? "0"}%</p>
            <p className="text-xs text-muted-foreground">CTR</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 mt-3 pt-3 border-t">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          {campaign.status === "active" ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onStatusChange("paused"); }}>
              <Pause className="h-3 w-3 mr-1" /> Pause
            </Button>
          ) : campaign.status === "paused" || campaign.status === "draft" ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600" onClick={(e) => { e.stopPropagation(); onStatusChange("active"); }}>
              <Play className="h-3 w-3 mr-1" /> Activate
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive ml-auto" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Campaign Form ─────────────────────────────────────────────────────────────

function CampaignForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<AdCampaignWithSets>;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    objective: initial?.objective ?? "awareness",
    platform: initial?.platform ?? "facebook",
    status: initial?.status ?? "draft",
    totalBudget: initial?.totalBudget ? String(initial.totalBudget / 100) : "",
    dailyBudget: initial?.dailyBudget ? String(initial.dailyBudget / 100) : "",
    currency: initial?.currency ?? "USD",
    notes: initial?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      totalBudget: form.totalBudget ? Math.round(parseFloat(form.totalBudget) * 100) : 0,
      dailyBudget: form.dailyBudget ? Math.round(parseFloat(form.dailyBudget) * 100) : 0,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Campaign Name *</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Summer Sale 2025" className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Platform *</Label>
          <Select value={form.platform} onValueChange={(v) => set("platform", v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AD_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Objective *</Label>
          <Select value={form.objective} onValueChange={(v) => set("objective", v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Total Budget ($)</Label>
          <Input type="number" min="0" value={form.totalBudget} onChange={(e) => set("totalBudget", e.target.value)} placeholder="500" className="mt-1" />
        </div>
        <div>
          <Label>Daily Budget ($)</Label>
          <Input type="number" min="0" value={form.dailyBudget} onChange={(e) => set("dailyBudget", e.target.value)} placeholder="50" className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["draft", "active", "paused", "completed", "archived"] as AdCampaignStatus[]).map((s: AdCampaignStatus) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes about this campaign..." className="mt-1 resize-none" rows={2} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!form.name.trim()}>
          {initial?.id ? "Save Changes" : "Create Campaign"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Ad Set Form ──────────────────────────────────────────────────────────────

function AdSetForm({
  campaignId,
  initial,
  onSave,
  onClose,
}: {
  campaignId: string;
  initial?: Partial<AdSet>;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    placement: initial?.placement ?? "feed",
    bidStrategy: initial?.bidStrategy ?? "lowest_cost",
    dailyBudget: initial?.dailyBudget ? String(initial.dailyBudget / 100) : "",
    ageMin: String((initial?.targeting as any)?.ageMin ?? 18),
    ageMax: String((initial?.targeting as any)?.ageMax ?? 65),
    locations: ((initial?.targeting as any)?.locations ?? []).join(", "),
    interests: ((initial?.targeting as any)?.interests ?? []).join(", "),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      campaignId,
      name: form.name,
      placement: form.placement,
      bidStrategy: form.bidStrategy,
      dailyBudget: form.dailyBudget ? Math.round(parseFloat(form.dailyBudget) * 100) : 0,
      targeting: {
        ageMin: parseInt(form.ageMin),
        ageMax: parseInt(form.ageMax),
      locations: form.locations.split(",").map((s: string) => s.trim()).filter(Boolean),
      interests: form.interests.split(",").map((s: string) => s.trim()).filter(Boolean),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Ad Set Name *</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 25-34 US Women" className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Placement</Label>
          <Select value={form.placement} onValueChange={(v) => set("placement", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["feed", "stories", "reels", "sidebar", "search"].map((p) => (
                <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bid Strategy</Label>
          <Select value={form.bidStrategy} onValueChange={(v) => set("bidStrategy", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lowest_cost">Lowest Cost</SelectItem>
              <SelectItem value="cost_cap">Cost Cap</SelectItem>
              <SelectItem value="bid_cap">Bid Cap</SelectItem>
              <SelectItem value="target_cost">Target Cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Daily Budget Override ($)</Label>
        <Input type="number" min="0" value={form.dailyBudget} onChange={(e) => set("dailyBudget", e.target.value)} placeholder="Leave blank to use campaign budget" className="mt-1" />
      </div>

      <Separator />
      <p className="text-sm font-medium flex items-center gap-1"><Users className="h-4 w-4" /> Audience Targeting</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Age Min</Label>
          <Input type="number" min="13" max="65" value={form.ageMin} onChange={(e) => set("ageMin", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Age Max</Label>
          <Input type="number" min="13" max="65" value={form.ageMax} onChange={(e) => set("ageMax", e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Locations (comma-separated country codes)</Label>
        <Input value={form.locations} onChange={(e) => set("locations", e.target.value)} placeholder="US, GB, CA" className="mt-1" />
      </div>

      <div>
        <Label>Interests (comma-separated)</Label>
        <Input value={form.interests} onChange={(e) => set("interests", e.target.value)} placeholder="fitness, travel, technology" className="mt-1" />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!form.name.trim()}>
          {initial?.id ? "Save Changes" : "Create Ad Set"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Creative Form ────────────────────────────────────────────────────────────

function CreativeForm({
  adSetId,
  campaignId,
  initial,
  onSave,
  onClose,
}: {
  adSetId: string;
  campaignId: string;
  initial?: Partial<AdCreative>;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    format: initial?.format ?? "image",
    headline: initial?.headline ?? "",
    bodyText: initial?.bodyText ?? "",
    callToAction: initial?.callToAction ?? "Learn More",
    destinationUrl: initial?.destinationUrl ?? "",
    mediaUrl: initial?.mediaUrl ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div>
        <Label>Creative Name *</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hero Image v1" className="mt-1" />
      </div>

      <div>
        <Label>Format</Label>
        <Select value={form.format} onValueChange={(v) => set("format", v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["image", "video", "carousel", "story", "text"].map((f) => (
              <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Headline</Label>
        <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Grab attention in one line" className="mt-1" />
      </div>

      <div>
        <Label>Body Text</Label>
        <Textarea value={form.bodyText} onChange={(e) => set("bodyText", e.target.value)} placeholder="Describe your offer..." className="mt-1 resize-none" rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Call to Action</Label>
          <Select value={form.callToAction} onValueChange={(v) => set("callToAction", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Learn More", "Shop Now", "Sign Up", "Download", "Contact Us", "Book Now", "Get Offer"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Destination URL</Label>
          <Input value={form.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} placeholder="https://example.com" className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Media URL (image or video)</Label>
        <Input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="https://..." className="mt-1" />
        {form.mediaUrl && (
          <div className="mt-2 rounded-md overflow-hidden border h-32 bg-muted flex items-center justify-center">
            <img src={form.mediaUrl} alt="preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ adSetId, campaignId, ...form })} disabled={!form.name.trim()}>
          {initial?.id ? "Save Changes" : "Create Creative"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Campaign Detail Panel ─────────────────────────────────────────────────────

function CampaignDetail({ campaign }: { campaign: AdCampaignWithSets }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adSetDialog, setAdSetDialog] = useState<{ open: boolean; adSet?: AdSet }>({ open: false });
  const [creativeDialog, setCreativeDialog] = useState<{ open: boolean; adSetId?: string; creative?: AdCreative }>({ open: false });

  const { data: metrics = [] } = useQuery<AdMetric[]>({
    queryKey: ["/api/ads/campaigns", campaign.id, "metrics"],
    queryFn: () => apiRequest("GET", `/api/ads/campaigns/${campaign.id}/metrics`).then((r) => r.json()),
  });

  const createAdSetMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/ads/campaigns/${campaign.id}/sets`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setAdSetDialog({ open: false }); toast({ title: "Ad set created" }); },
    onError: () => toast({ title: "Failed to create ad set", variant: "destructive" }),
  });

  const updateAdSetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/ads/campaigns/${campaign.id}/sets/${id}`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setAdSetDialog({ open: false }); toast({ title: "Ad set updated" }); },
  });

  const deleteAdSetMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ads/campaigns/${campaign.id}/sets/${id}`).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); toast({ title: "Ad set deleted" }); },
  });

  const createCreativeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/ads/sets/${data.adSetId}/creatives`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setCreativeDialog({ open: false }); toast({ title: "Creative created" }); },
    onError: () => toast({ title: "Failed to create creative", variant: "destructive" }),
  });

  const updateCreativeMutation = useMutation({
    mutationFn: ({ adSetId, id, data }: { adSetId: string; id: string; data: any }) =>
      apiRequest("PATCH", `/api/ads/sets/${adSetId}/creatives/${id}`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setCreativeDialog({ open: false }); toast({ title: "Creative updated" }); },
  });

  const deleteCreativeMutation = useMutation({
    mutationFn: ({ adSetId, id }: { adSetId: string; id: string }) =>
      apiRequest("DELETE", `/api/ads/sets/${adSetId}/creatives/${id}`).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); toast({ title: "Creative deleted" }); },
  });

  const publishMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ads/campaigns/${campaign.id}/publish`).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      if (data.success) toast({ title: "Campaign published!", description: `Platform campaign ID: ${data.platformCampaignId}` });
      else toast({ title: "Publish failed", description: data.error, variant: "destructive" });
    },
    onError: () => toast({ title: "Failed to publish campaign", variant: "destructive" }),
  });

  const syncInsightsMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ads/campaigns/${campaign.id}/sync-insights`).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      if (data.success) toast({ title: "Insights synced!", description: data.message });
      else toast({ title: "Sync failed", description: data.error, variant: "destructive" });
    },
    onError: (err: any) => toast({
      title: "Failed to sync insights",
      description: err?.message ?? "Could not reach the Meta Insights API",
      variant: "destructive",
    }),
  });

  // Build chart data from metrics
  const chartData = metrics.slice(-14).map((m) => ({
    date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    spend: (m.spend ?? 0) / 100,
    impressions: m.impressions ?? 0,
    clicks: m.clicks ?? 0,
    ctr: parseFloat(m.ctr ?? "0"),
  }));

  const m = campaign.metrics;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Total Spend", value: formatCurrency(m?.totalSpend ?? 0) },
          { icon: Eye, label: "Impressions", value: (m?.totalImpressions ?? 0).toLocaleString() },
          { icon: MousePointer, label: "Clicks", value: (m?.totalClicks ?? 0).toLocaleString() },
          { icon: TrendingUp, label: "Avg CTR", value: `${m?.avgCtr ?? "0"}%` },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action buttons */}
      {campaign.status !== "archived" && (
        <div className="flex justify-end gap-2">
          {/* Sync Insights — only shown for published Facebook/Instagram campaigns */}
          {campaign.platformCampaignId && ["facebook", "instagram"].includes(campaign.platform) && (
            <Button
              variant="outline"
              onClick={() => syncInsightsMutation.mutate()}
              disabled={syncInsightsMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncInsightsMutation.isPending ? "animate-spin" : ""}`} />
              {syncInsightsMutation.isPending ? "Syncing…" : "Sync Insights"}
            </Button>
          )}
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} className="gap-2">
            <Zap className="h-4 w-4" />
            {publishMutation.isPending ? "Publishing…" : "Publish to Platform"}
          </Button>
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ad Sets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><Target className="h-4 w-4" /> Ad Sets</h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdSetDialog({ open: true })}>
            <Plus className="h-3 w-3" /> Add Ad Set
          </Button>
        </div>

        {campaign.adSets.length === 0 ? (
          <div className="text-center py-6 border rounded-lg border-dashed">
            <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No ad sets yet. Add one to define your audience and budget.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaign.adSets.map((adSet) => (
              <Card key={adSet.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{adSet.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {adSet.placement && <Badge variant="outline" className="text-xs">{adSet.placement}</Badge>}
                        {adSet.bidStrategy && <Badge variant="outline" className="text-xs">{adSet.bidStrategy}</Badge>}
                        {adSet.dailyBudget ? <Badge variant="outline" className="text-xs">{formatCurrency(adSet.dailyBudget)}/day</Badge> : null}
                      </div>
                      {adSet.targeting && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ages {(adSet.targeting as any).ageMin}–{(adSet.targeting as any).ageMax}
                          {(adSet.targeting as any).locations?.length ? ` · ${(adSet.targeting as any).locations.join(", ")}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAdSetDialog({ open: true, adSet })}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteAdSetMutation.mutate(adSet.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Creatives */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" /> Creatives</p>
                      <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => setCreativeDialog({ open: true, adSetId: adSet.id })}>
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </div>
                    {adSet.creatives.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No creatives yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {adSet.creatives.map((creative) => (
                          <div key={creative.id} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{creative.name}</p>
                              {creative.headline && <p className="text-xs text-muted-foreground truncate">{creative.headline}</p>}
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">{creative.format}</Badge>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCreativeDialog({ open: true, adSetId: adSet.id, creative })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteCreativeMutation.mutate({ adSetId: adSet.id, id: creative.id })}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ad Set Dialog */}
      <Dialog open={adSetDialog.open} onOpenChange={(o) => !o && setAdSetDialog({ open: false })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{adSetDialog.adSet ? "Edit Ad Set" : "New Ad Set"}</DialogTitle>
          </DialogHeader>
          <AdSetForm
            campaignId={campaign.id}
            initial={adSetDialog.adSet}
            onClose={() => setAdSetDialog({ open: false })}
            onSave={(data) => {
              if (adSetDialog.adSet) {
                updateAdSetMutation.mutate({ id: adSetDialog.adSet.id, data });
              } else {
                createAdSetMutation.mutate(data);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Creative Dialog */}
      <Dialog open={creativeDialog.open} onOpenChange={(o) => !o && setCreativeDialog({ open: false })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creativeDialog.creative ? "Edit Creative" : "New Creative"}</DialogTitle>
          </DialogHeader>
          {creativeDialog.adSetId && (
            <CreativeForm
              adSetId={creativeDialog.adSetId}
              campaignId={campaign.id}
              initial={creativeDialog.creative}
              onClose={() => setCreativeDialog({ open: false })}
              onSave={(data) => {
                if (creativeDialog.creative) {
                  updateCreativeMutation.mutate({ adSetId: creativeDialog.adSetId!, id: creativeDialog.creative.id, data });
                } else {
                  createCreativeMutation.mutate(data);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaignDialog, setCampaignDialog] = useState<{ open: boolean; campaign?: AdCampaignWithSets }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [activeTab, setActiveTab] = useState("all");

  const { data: campaigns = [], isLoading } = useQuery<AdCampaignWithSets[]>({
    queryKey: ["/api/ads/campaigns"],
    queryFn: () => apiRequest("GET", "/api/ads/campaigns").then((r) => r.json()),
  });

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ads/campaigns", data).then((r) => r.json()),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setCampaignDialog({ open: false }); setSelectedId(c.id); toast({ title: "Campaign created" }); },
    onError: () => toast({ title: "Failed to create campaign", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/ads/campaigns/${id}`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); setCampaignDialog({ open: false }); toast({ title: "Campaign updated" }); },
    onError: () => toast({ title: "Failed to update campaign", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdCampaignStatus }) =>
      apiRequest("PATCH", `/api/ads/campaigns/${id}/status`, { status }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] }); toast({ title: "Status updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ads/campaigns/${id}`).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ads/campaigns"] });
      setDeleteDialog({ open: false });
      if (selectedId === deleteDialog.id) setSelectedId(null);
      toast({ title: "Campaign deleted" });
    },
  });

  const filtered = campaigns.filter((c) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  // Aggregate totals
  const totals = campaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + (c.metrics?.totalSpend ?? 0),
      impressions: acc.impressions + (c.metrics?.totalImpressions ?? 0),
      clicks: acc.clicks + (c.metrics?.totalClicks ?? 0),
      conversions: acc.conversions + (c.metrics?.totalConversions ?? 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> Ad Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create, manage, and track paid advertising campaigns across platforms.
            </p>
          </div>
          <Button onClick={() => setCampaignDialog({ open: true })} className="gap-2">
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </div>

        {/* Overview stats */}
        {campaigns.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { icon: DollarSign, label: "Total Spend", value: formatCurrency(totals.spend), color: "text-blue-600" },
              { icon: Eye, label: "Impressions", value: totals.impressions.toLocaleString(), color: "text-purple-600" },
              { icon: MousePointer, label: "Clicks", value: totals.clicks.toLocaleString(), color: "text-green-600" },
              { icon: TrendingUp, label: "Conversions", value: totals.conversions.toLocaleString(), color: "text-orange-600" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body: two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Campaign list */}
        <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-8 text-xs">
                <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
                <TabsTrigger value="active" className="flex-1 text-xs">Active</TabsTrigger>
                <TabsTrigger value="draft" className="flex-1 text-xs">Draft</TabsTrigger>
                <TabsTrigger value="paused" className="flex-1 text-xs">Paused</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading campaigns…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first ad campaign to get started.</p>
                <Button size="sm" className="mt-3 gap-1" onClick={() => setCampaignDialog({ open: true })}>
                  <Plus className="h-3.5 w-3.5" /> New Campaign
                </Button>
              </div>
            ) : (
              filtered.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  selected={selectedId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                  onEdit={() => setCampaignDialog({ open: true, campaign: c })}
                  onDelete={() => setDeleteDialog({ open: true, id: c.id })}
                  onStatusChange={(status) => statusMutation.mutate({ id: c.id, status })}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <Badge className={`text-xs ${STATUS_COLORS[selected.status as AdCampaignStatus]}`}>{selected.status}</Badge>
                <Button size="sm" variant="ghost" className="ml-auto gap-1 h-7 text-xs" onClick={() => setCampaignDialog({ open: true, campaign: selected })}>
                  <Pencil className="h-3 w-3" /> Edit Campaign
                </Button>
              </div>
              <CampaignDetail campaign={selected} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <BarChart2 className="h-14 w-14 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Select a campaign</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Choose a campaign from the list to view its ad sets, creatives, and performance analytics.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={campaignDialog.open} onOpenChange={(o) => !o && setCampaignDialog({ open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{campaignDialog.campaign ? "Edit Campaign" : "New Ad Campaign"}</DialogTitle>
          </DialogHeader>
          <CampaignForm
            initial={campaignDialog.campaign}
            onClose={() => setCampaignDialog({ open: false })}
            onSave={(data) => {
              if (campaignDialog.campaign) {
                updateMutation.mutate({ id: campaignDialog.campaign.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the campaign, all its ad sets, and all creatives. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false })}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteDialog.id && deleteMutation.mutate(deleteDialog.id)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
