/**
 * suggestions.tsx
 *
 * The AI Post Suggestion Engine page.
 *
 * Shows:
 *  - A "Generate Suggestions" button that triggers the engine
 *  - Tabs: All / New Posts / Follow-Ups / Comment Replies
 *  - Each suggestion card with: type badge, content, platforms, reasoning,
 *    best-time recommendation, confidence score, engagement prediction,
 *    and Accept / Dismiss / Schedule actions
 *  - A Best Posting Times panel derived from the user's history
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlatformIcon } from "@/components/platform-icon";
import {
  Sparkles,
  Clock,
  TrendingUp,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Lightbulb,
  Repeat2,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import type { SuggestedPost, BestTimeWindow, SuggestionRunResult } from "@shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  new_post: {
    label: "New Post Idea",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: "bg-violet-100 text-violet-700 border-violet-200",
  },
  follow_up: {
    label: "Follow-Up Thread",
    icon: <Repeat2 className="w-3.5 h-3.5" />,
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  comment_reply: {
    label: "Comment Reply",
    icon: <MessageCircle className="w-3.5 h-3.5" />,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700" },
  dismissed: { label: "Dismissed", color: "bg-red-100 text-red-600" },
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
};

const PREDICTION_COLOR: Record<string, string> = {
  High: "text-green-600",
  Medium: "text-amber-600",
  Low: "text-gray-500",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${ampm}`;
}

// ─── Schedule Dialog ──────────────────────────────────────────────────────────

function ScheduleDialog({
  suggestion,
  open,
  onClose,
  onScheduled,
}: {
  suggestion: SuggestedPost;
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const { toast } = useToast();
  const [scheduledAt, setScheduledAt] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      return apiRequest("POST", `/api/suggestions/${suggestion.id}/schedule`, body);
    },
    onSuccess: () => {
      toast({ title: "Post scheduled!", description: "The suggestion has been added to your schedule." });
      onScheduled();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Schedule failed", description: err.message, variant: "destructive" });
    },
  });

  const defaultTime =
    suggestion.suggestedDayOfWeek !== null && suggestion.suggestedHour !== null
      ? `${DAY_NAMES[suggestion.suggestedDayOfWeek!]} at ${formatHour(suggestion.suggestedHour!)}`
      : "next available slot";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule This Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            AI recommends posting on{" "}
            <span className="font-medium text-foreground">{suggestion.suggestedTime ?? defaultTime}</span>.
            You can override the time below, or leave blank to use the AI recommendation.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-time">Override time (optional)</Label>
            <Input
              id="schedule-time"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Post content preview:</p>
            <p className="text-muted-foreground line-clamp-3">{suggestion.content}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
            {scheduleMutation.isPending ? "Scheduling…" : "Schedule Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onUpdate,
}: {
  suggestion: SuggestedPost;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const qc = useQueryClient();

  const typeMeta = TYPE_META[suggestion.type] ?? TYPE_META.new_post;
  const statusMeta = STATUS_META[suggestion.status] ?? STATUS_META.pending;
  const predColor = PREDICTION_COLOR[suggestion.engagementPrediction ?? ""] ?? "text-gray-500";

  const patchMutation = useMutation({
    mutationFn: async (status: string) =>
      apiRequest("PATCH", `/api/suggestions/${suggestion.id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suggestions"] });
      onUpdate();
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const isDismissed = suggestion.status === "dismissed";
  const isScheduled = suggestion.status === "scheduled";

  return (
    <>
      <Card className={`transition-opacity ${isDismissed ? "opacity-50" : ""}`}>
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${typeMeta.color}`}>
                {typeMeta.icon}
                {typeMeta.label}
              </span>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
            {/* Confidence */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{suggestion.confidenceScore ?? 70}% confidence</span>
            </div>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed">{suggestion.content}</p>

          {/* Hashtags */}
          {suggestion.hashtags && suggestion.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestion.hashtags.map((tag) => (
                <span key={tag} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Platforms */}
          <div className="flex items-center gap-1.5">
            {suggestion.platforms.map((p) => (
              <PlatformIcon key={p} platform={p as any} className="w-4 h-4" />
            ))}
          </div>

          {/* Reasoning */}
          {suggestion.reasoning && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Why: </span>
              {suggestion.reasoning}
            </div>
          )}

          {/* Timing + Prediction row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {suggestion.suggestedTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Best time: <span className="font-medium text-foreground ml-0.5">{suggestion.suggestedTime}</span>
              </span>
            )}
            {suggestion.engagementPrediction && (
              <span className={`flex items-center gap-1 ${predColor}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {suggestion.engagementPrediction} engagement
              </span>
            )}
          </div>

          {/* Actions */}
          {!isDismissed && !isScheduled && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-200 hover:bg-green-50 gap-1"
                onClick={() => patchMutation.mutate("accepted")}
                disabled={patchMutation.isPending || suggestion.status === "accepted"}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {suggestion.status === "accepted" ? "Accepted" : "Accept"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Schedule
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 gap-1 ml-auto"
                onClick={() => patchMutation.mutate("dismissed")}
                disabled={patchMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" />
                Dismiss
              </Button>
            </div>
          )}
          {isScheduled && (
            <p className="text-xs text-blue-600 flex items-center gap-1 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Scheduled — check your Posts page
            </p>
          )}
        </CardContent>
      </Card>

      {scheduleOpen && (
        <ScheduleDialog
          suggestion={suggestion}
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => qc.invalidateQueries({ queryKey: ["/api/suggestions"] })}
        />
      )}
    </>
  );
}

// ─── Best Times Panel ─────────────────────────────────────────────────────────

function BestTimesPanel({ bestTimes }: { bestTimes: BestTimeWindow[] }) {
  if (bestTimes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-500" />
          Best Times to Post
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Derived from your historical post performance
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {bestTimes.map((t) => (
          <div
            key={t.platform}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <PlatformIcon platform={t.platform as any} className="w-4 h-4" />
              <span className="text-sm font-medium capitalize">{t.platform}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">
                avg {t.avgEngagement} eng · {t.sampleSize} posts
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuggestionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [bestTimes, setBestTimes] = useState<BestTimeWindow[]>([]);
  const [lastRun, setLastRun] = useState<{ analysedPosts: number; generatedAt: string } | null>(null);

  // Fetch existing suggestions
  const { data: suggestions = [], isLoading } = useQuery<SuggestedPost[]>({
    queryKey: ["/api/suggestions"],
    queryFn: () => apiRequest("GET", "/api/suggestions").then((r: any) => r.json()),
  });

  // Generate new suggestions
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/suggestions/generate", {});
      return res.json() as Promise<SuggestionRunResult>;
    },
    onSuccess: (data) => {
      setBestTimes(data.bestTimes ?? []);
      setLastRun({ analysedPosts: data.analysedPosts, generatedAt: data.generatedAt });
      qc.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({
        title: "Suggestions generated!",
        description: `Analysed ${data.analysedPosts} posts and created ${data.suggestions.length} new suggestions.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  // Filter by tab
  const filtered = suggestions.filter((s) => {
    if (activeTab === "all") return s.status !== "dismissed";
    if (activeTab === "new_post") return s.type === "new_post" && s.status !== "dismissed";
    if (activeTab === "follow_up") return s.type === "follow_up" && s.status !== "dismissed";
    if (activeTab === "comment_reply") return s.type === "comment_reply" && s.status !== "dismissed";
    if (activeTab === "dismissed") return s.status === "dismissed";
    return true;
  });

  const counts = {
    all: suggestions.filter((s) => s.status !== "dismissed").length,
    new_post: suggestions.filter((s) => s.type === "new_post" && s.status !== "dismissed").length,
    follow_up: suggestions.filter((s) => s.type === "follow_up" && s.status !== "dismissed").length,
    comment_reply: suggestions.filter((s) => s.type === "comment_reply" && s.status !== "dismissed").length,
    dismissed: suggestions.filter((s) => s.status === "dismissed").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            AI Suggestions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal content strategist — analyses your post history and suggests what to post next, when to post it, and how to continue the conversation.
          </p>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-1">
              Last run: analysed {lastRun.analysedPosts} posts ·{" "}
              {new Date(lastRun.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="shrink-0 gap-2"
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Suggestions
            </>
          )}
        </Button>
      </div>

      {/* Main layout: suggestions + best times sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Left: suggestion tabs + cards */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="gap-1">
                All
                {counts.all > 0 && (
                  <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{counts.all}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="new_post" className="gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                New Posts
                {counts.new_post > 0 && (
                  <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{counts.new_post}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="follow_up" className="gap-1">
                <Repeat2 className="w-3.5 h-3.5" />
                Follow-Ups
                {counts.follow_up > 0 && (
                  <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{counts.follow_up}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comment_reply" className="gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                Replies
                {counts.comment_reply > 0 && (
                  <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{counts.comment_reply}</span>
                )}
              </TabsTrigger>
              {counts.dismissed > 0 && (
                <TabsTrigger value="dismissed">
                  Dismissed
                  <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{counts.dismissed}</span>
                </TabsTrigger>
              )}
            </TabsList>

            {["all", "new_post", "follow_up", "comment_reply", "dismissed"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Loading suggestions…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Sparkles className="w-10 h-10 text-muted-foreground/40" />
                    <div>
                      <p className="font-medium text-muted-foreground">No suggestions yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Click "Generate Suggestions" to let the AI analyse your post history.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="gap-1 mt-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate now
                    </Button>
                  </div>
                ) : (
                  filtered.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onUpdate={() => qc.invalidateQueries({ queryKey: ["/api/suggestions"] })}
                    />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Right: best times panel */}
        <div className="space-y-4">
          <BestTimesPanel bestTimes={bestTimes} />

          {/* How it works */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {[
                ["Analyses", "your last 30 published posts by engagement, reach, and timing"],
                ["Identifies", "hot threads — posts with above-average engagement that deserve a follow-up"],
                ["Generates", "new post ideas, thread continuations, and comment starters in your voice"],
                ["Recommends", "the best day and time to post based on your own performance history"],
              ].map(([bold, rest]) => (
                <div key={bold} className="flex gap-2">
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-400" />
                  <p><span className="font-medium text-foreground">{bold}</span> {rest}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
