import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlatformIcon, getPlatformName } from "./platform-icon";
import {
  Sparkles,
  CalendarIcon,
  Clock,
  ImagePlus,
  X,
  AlertTriangle,
  Send,
  Layers,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { PlatformType, Post, BrandWithAccounts, SocialAccount } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Per-platform character limits
// ---------------------------------------------------------------------------
const PLATFORM_CHAR_LIMITS: Record<PlatformType, number> = {
  twitter: 280,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
  youtube: 5000,
};

const REQUIRES_IMAGE: PlatformType[] = ["instagram", "pinterest"];
const REQUIRES_VIDEO: PlatformType[] = ["tiktok", "youtube"];

const validPlatforms = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
  "pinterest",
  "youtube",
  "threads",
] as const;

const postFormSchema = z.object({
  content: z.string().min(1, "Content is required"),
  platforms: z.array(z.enum(validPlatforms)).min(1, "Select at least one platform"),
  hashtags: z.string().optional(),
  scheduledDate: z.date().optional(),
  scheduledTime: z.string().optional(),
  aiTopic: z.string().optional(),
  aiTone: z.enum(["professional", "casual", "humorous", "promotional"]).optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface UploadedMedia {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localPreview?: string;
}

export interface PostCreationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    content: string;
    platforms: PlatformType[];
    hashtags: string[];
    scheduledAt: Date | null;
    status: "draft" | "scheduled";
    mediaUrls?: string[];
    brandId?: string | null;
    targetAccountIds: string[] | null;
  }) => void;
  onPublishNow?: (postId: string) => void;
  editPost?: Post | null;
  isLoading?: boolean;
}

const availablePlatforms: PlatformType[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
  "pinterest",
  "youtube",
  "threads",
];

function eligibleAccounts(
  platform: PlatformType,
  allAccounts: SocialAccount[],
  brand: BrandWithAccounts | null,
): SocialAccount[] {
  let list = allAccounts.filter((a) => a.platform === platform && a.isConnected);
  if (brand?.accounts.length) {
    const ids = new Set(brand.accounts.map((a) => a.id));
    list = list.filter((a) => ids.has(a.id));
  }
  return list;
}

function samePlatformTargets(
  a: Partial<Record<PlatformType, string>>,
  b: Partial<Record<PlatformType, string>>,
): boolean {
  const keysA = Object.keys(a) as PlatformType[];
  const keysB = Object.keys(b) as PlatformType[];
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export function PostCreationDrawer({
  open,
  onOpenChange,
  onSubmit,
  onPublishNow,
  editPost,
  isLoading,
}: PostCreationDrawerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  // Brand picker state
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    (editPost as any)?.brandId ?? null
  );
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [platformTargetByPlatform, setPlatformTargetByPlatform] = useState<
    Partial<Record<PlatformType, string>>
  >({});
  const seedEditTargetsDoneRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch brands for the picker
  const { data: brands = [] } = useQuery<BrandWithAccounts[]>({
    queryKey: ["/api/brands"],
  });

  const { data: allAccounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      content: editPost?.content || "",
      platforms: editPost?.platforms || [],
      hashtags: editPost?.hashtags?.join(", ") || "",
      scheduledDate: editPost?.scheduledAt ? new Date(editPost.scheduledAt) : undefined,
      scheduledTime: editPost?.scheduledAt
        ? format(new Date(editPost.scheduledAt), "HH:mm")
        : "",
      aiTone: "professional",
    },
  });

  // ─── Brand picker: apply brand platforms to form ──────────────────────────
  const applyBrand = (brand: BrandWithAccounts | null) => {
    setSelectedBrandId(brand?.id ?? null);
    setBrandPickerOpen(false);
    if (brand) {
      const brandPlatforms = Array.from(
        new Set(brand.accounts.map((a) => a.platform as PlatformType))
      );
      form.setValue("platforms", brandPlatforms, { shouldValidate: true });
    }
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;
  const selectedPlatforms = form.watch("platforms") || [];

  useEffect(() => {
    seedEditTargetsDoneRef.current = false;
  }, [editPost?.id]);

  useEffect(() => {
    if (!open) {
      seedEditTargetsDoneRef.current = false;
      setPlatformTargetByPlatform({});
      return;
    }
    if (!allAccounts.length) return;

    setPlatformTargetByPlatform((prev) => {
      let next: Partial<Record<PlatformType, string>> = { ...prev };

      if (editPost && !seedEditTargetsDoneRef.current) {
        seedEditTargetsDoneRef.current = true;
        next = {};
        if (editPost.targetAccountIds?.length) {
          for (const id of editPost.targetAccountIds) {
            const acc = allAccounts.find((a) => a.id === id);
            if (acc) next[acc.platform as PlatformType] = id;
          }
        }
        const brandForPost =
          editPost.brandId != null
            ? brands.find((b) => b.id === editPost.brandId) ?? null
            : null;
        for (const platform of editPost.platforms) {
          if (next[platform]) continue;
          const elig = eligibleAccounts(platform, allAccounts, brandForPost);
          if (elig[0]) next[platform] = elig[0].id;
        }
      }

      const platforms = selectedPlatforms;
      for (const platform of platforms) {
        const elig = eligibleAccounts(platform, allAccounts, selectedBrand);
        if (elig.length === 0) {
          delete next[platform];
          continue;
        }
        if (elig.length === 1) {
          next[platform] = elig[0]!.id;
          continue;
        }
        const cur = next[platform];
        if (!cur || !elig.some((e) => e.id === cur)) {
          delete next[platform];
        }
      }
      for (const p of Object.keys(next) as PlatformType[]) {
        if (!platforms.includes(p)) delete next[p];
      }
      if (samePlatformTargets(next, prev)) return prev;
      return next;
    });
  }, [
    open,
    editPost?.id,
    editPost?.targetAccountIds,
    editPost?.platforms,
    editPost?.brandId,
    allAccounts,
    brands,
    selectedBrand,
    selectedPlatforms,
  ]);

  const handleSubmit = (values: PostFormValues, asDraft: boolean = false) => {
    let scheduledAt: Date | null = null;

    if (values.scheduledDate && values.scheduledTime && !asDraft) {
      const [hours, minutes] = values.scheduledTime.split(":").map(Number);
      scheduledAt = new Date(values.scheduledDate);
      scheduledAt.setHours(hours, minutes, 0, 0);
    }

    const normalizedHashtags = values.hashtags
      ? values.hashtags
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter((tag) => tag.length > 0)
      : [];

    const platforms = values.platforms as PlatformType[];
    for (const platform of platforms) {
      const elig = eligibleAccounts(platform, allAccounts, selectedBrand);
      if (elig.length === 0) {
        toast({
          title: "Missing connection",
          description: `Connect a ${getPlatformName(platform)} account (or add one to this brand) before posting.`,
          variant: "destructive",
        });
        return;
      }
    }

    const targetAccountIds = platforms.map((p) => platformTargetByPlatform[p]).filter(Boolean) as string[];
    if (targetAccountIds.length !== platforms.length) {
      toast({
        title: "Select accounts",
        description: "Choose which account to use for each selected platform.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      content: values.content,
      platforms,
      hashtags: normalizedHashtags,
      scheduledAt,
      status: asDraft ? "draft" : "scheduled",
      mediaUrls: uploadedMedia.map((m) => m.url),
      brandId: selectedBrandId,
      targetAccountIds,
    });
  };

  // ─── AI content generation ────────────────────────────────────────────────
  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const topic = form.getValues("aiTopic") || "our brand";
      const tone = form.getValues("aiTone") || "professional";
      const platforms = form.getValues("platforms");

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic, tone, platforms }),
      });

      if (!res.ok) throw new Error("AI generation failed");
      const data = (await res.json()) as { content: string; hashtags?: string };
      form.setValue("content", data.content);
      if (data.hashtags) {
        form.setValue("hashtags", data.hashtags);
      }
    } catch {
      toast({ title: "AI generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Media upload ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        setIsUploading(true);
        setUploadProgress(0);

        const localPreview = URL.createObjectURL(file);
        const formData = new FormData();
        formData.append("file", file);

        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/media/upload");
          xhr.withCredentials = true;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 201) {
              const data = JSON.parse(xhr.responseText) as UploadedMedia;
              setUploadedMedia((prev) => [...prev, { ...data, localPreview }]);
            } else {
              toast({
                title: "Upload failed",
                description: `${file.name}: ${xhr.statusText}`,
                variant: "destructive",
              });
            }
            setIsUploading(false);
            setUploadProgress(0);
            resolve();
          };

          xhr.onerror = () => {
            toast({ title: "Upload error", description: file.name, variant: "destructive" });
            setIsUploading(false);
            setUploadProgress(0);
            resolve();
          };

          xhr.send(formData);
        });
      }
    },
    [toast]
  );

  const removeMedia = (index: number) => {
    setUploadedMedia((prev) => {
      const item = prev[index];
      if (item?.localPreview) URL.revokeObjectURL(item.localPreview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const characterCount = form.watch("content")?.length || 0;

  const charWarnings = selectedPlatforms
    .filter((p) => characterCount > PLATFORM_CHAR_LIMITS[p])
    .map((p) => `${getPlatformName(p)} (limit: ${PLATFORM_CHAR_LIMITS[p]})`);

  const hasImage = uploadedMedia.some((m) => m.mimeType.startsWith("image/"));
  const hasVideo = uploadedMedia.some((m) => m.mimeType.startsWith("video/"));
  const mediaWarnings: string[] = [];
  for (const p of selectedPlatforms) {
    if (REQUIRES_IMAGE.includes(p) && !hasImage && !hasVideo) {
      mediaWarnings.push(`${getPlatformName(p)} requires at least one image or video.`);
    }
    if (REQUIRES_VIDEO.includes(p) && !hasVideo) {
      mediaWarnings.push(`${getPlatformName(p)} requires a video attachment.`);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle data-testid="text-drawer-title">
            {editPost ? "Edit Post" : "Create New Post"}
          </SheetTitle>
          <SheetDescription>
            Compose your content and schedule it across multiple platforms.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form className="space-y-6">

            {/* ── Brand picker ─────────────────────────────────────────────── */}
            {brands.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Brand
                </Label>
                <Popover open={brandPickerOpen} onOpenChange={setBrandPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      {selectedBrand ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: selectedBrand.color ?? "#6366f1" }}
                          />
                          <span className="truncate">{selectedBrand.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({selectedBrand.accounts.length} account
                            {selectedBrand.accounts.length !== 1 ? "s" : ""})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No brand selected</span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-1" align="start">
                    {/* Clear option */}
                    <button
                      type="button"
                      onClick={() => applyBrand(null)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors text-muted-foreground"
                    >
                      No brand (manual platform selection)
                    </button>
                    <Separator className="my-1" />
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => applyBrand(brand)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded transition-colors space-y-0.5",
                          selectedBrandId === brand.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: brand.color ?? "#6366f1" }}
                          />
                          <span className="font-medium text-sm">{brand.name}</span>
                        </div>
                        {brand.accounts.length > 0 && (
                          <div className="flex flex-wrap gap-1 pl-5">
                            {Array.from(new Set(brand.accounts.map((a) => a.platform))).map((p) => (
                              <Badge
                                key={p}
                                variant="secondary"
                                className="text-xs px-1 py-0 gap-0.5 h-4"
                              >
                                <PlatformIcon platform={p as any} className="h-2.5 w-2.5" />
                                {getPlatformName(p as any)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {selectedBrand && selectedBrand.accounts.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Only accounts linked to this brand appear when you pick each platform below.
                  </p>
                )}
              </div>
            )}

            {/* ── Platform selector ─────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="platforms"
              render={() => (
                <FormItem>
                  <FormLabel>
                    Platforms
                    {selectedBrand && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (auto-selected from brand)
                      </span>
                    )}
                  </FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {availablePlatforms.map((platform) => (
                      <label
                        key={platform}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                          selectedPlatforms.includes(platform)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedPlatforms.includes(platform)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("platforms") || [];
                            if (checked) {
                              form.setValue("platforms", [...current, platform], {
                                shouldValidate: true,
                              });
                            } else {
                              form.setValue(
                                "platforms",
                                current.filter((p) => p !== platform),
                                { shouldValidate: true }
                              );
                            }
                          }}
                          data-testid={`checkbox-platform-${platform}`}
                        />
                        <PlatformIcon platform={platform} />
                        <span className="text-sm">{getPlatformName(platform)}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />

                  {selectedPlatforms.length > 0 && (
                    <div className="space-y-3 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Choose the profile or page to publish to for each platform.
                      </p>
                      {availablePlatforms
                        .filter((p) => selectedPlatforms.includes(p))
                        .map((platform) => {
                          const elig = eligibleAccounts(platform, allAccounts, selectedBrand);
                          const selectedId = platformTargetByPlatform[platform];
                          if (elig.length === 0) {
                            return (
                              <Alert key={platform} variant="destructive" className="py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  No connected {getPlatformName(platform)} account
                                  {selectedBrand ? " for this brand" : ""}. Connect one in Accounts.
                                </AlertDescription>
                              </Alert>
                            );
                          }
                          if (elig.length === 1) {
                            const acc = elig[0]!;
                            return (
                              <Card key={platform} className="border-dashed">
                                <CardContent className="py-3 px-3 flex flex-wrap items-center gap-2 text-sm">
                                  <PlatformIcon platform={platform} className="h-4 w-4 shrink-0" />
                                  <span className="text-muted-foreground">{getPlatformName(platform)}</span>
                                  <span className="font-medium">→ {acc.accountName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    @{acc.accountHandle}
                                  </span>
                                </CardContent>
                              </Card>
                            );
                          }
                          return (
                            <Card key={platform}>
                              <CardContent className="pt-4 pb-3 px-3 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <PlatformIcon platform={platform} className="h-4 w-4" />
                                  {getPlatformName(platform)}
                                </div>
                                <RadioGroup
                                  value={selectedId ?? ""}
                                  onValueChange={(id) =>
                                    setPlatformTargetByPlatform((prev) => ({
                                      ...prev,
                                      [platform]: id,
                                    }))
                                  }
                                  className="gap-2"
                                >
                                  {elig.map((acc) => (
                                    <label
                                      key={acc.id}
                                      htmlFor={`${platform}-${acc.id}`}
                                      className={cn(
                                        "flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                                        selectedId === acc.id
                                          ? "border-primary bg-primary/5"
                                          : "border-border hover:border-primary/50",
                                      )}
                                    >
                                      <RadioGroupItem
                                        value={acc.id}
                                        id={`${platform}-${acc.id}`}
                                      />
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={acc.avatarUrl ?? undefined} />
                                        <AvatarFallback className="text-xs">
                                          {acc.accountName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{acc.accountName}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          @{acc.accountHandle}
                                        </p>
                                      </div>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* ── Content with AI assist ────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Content</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateWithAI}
                      disabled={isGenerating}
                      className="text-primary"
                      data-testid="button-ai-generate"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {isGenerating ? "Generating..." : "AI Assist"}
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="What's on your mind? Share your message with your audience..."
                      className="min-h-[160px] resize-none"
                      {...field}
                      data-testid="input-post-content"
                    />
                  </FormControl>

                  {/* Per-platform character counts */}
                  {selectedPlatforms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedPlatforms.map((p) => {
                        const limit = PLATFORM_CHAR_LIMITS[p];
                        const over = characterCount > limit;
                        return (
                          <span
                            key={p}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded",
                              over
                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {getPlatformName(p)}: {characterCount}/{limit}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {charWarnings.length > 0 && (
                    <Alert variant="destructive" className="mt-2 py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Content exceeds limit for: {charWarnings.join(", ")}
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── AI topic and tone ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="aiTopic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">AI Topic</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. product launch"
                        className="h-8 text-sm"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aiTone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Tone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                        <SelectItem value="promotional">Promotional</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* ── Media upload ──────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label>Media</Label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                multiple
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
              />

              <div
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileChange(e.dataTransfer.files);
                }}
              >
                <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, WebP up to 10 MB · MP4 up to 100 MB
                </p>
              </div>

              {isUploading && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              {uploadedMedia.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {uploadedMedia.map((media, i) => (
                    <div key={i} className="relative group">
                      {media.mimeType.startsWith("image/") ? (
                        <img
                          src={media.localPreview ?? media.url}
                          alt={media.filename}
                          className="w-20 h-20 object-cover rounded-md border"
                        />
                      ) : (
                        <video
                          src={media.localPreview ?? media.url}
                          className="w-20 h-20 object-cover rounded-md border"
                          muted
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mediaWarnings.length > 0 && (
                <Alert className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {mediaWarnings.join(" ")}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* ── Hashtags ──────────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="hashtags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hashtags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="marketing, social, growth"
                      {...field}
                      data-testid="input-hashtags"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Separate hashtags with commas</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Schedule date/time ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-schedule-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-schedule-time">
                          <Clock className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, "0");
                          return (
                            <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                              {format(new Date().setHours(i, 0, 0, 0), "h:mm a")}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Action buttons ────────────────────────────────────────────── */}
            <div className="flex gap-2 pt-4 border-t flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleSubmit(form.getValues(), true)}
                disabled={isLoading}
                data-testid="button-save-draft"
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => form.handleSubmit((data) => handleSubmit(data, false))()}
                disabled={isLoading}
                data-testid="button-schedule-post"
              >
                {isLoading ? "Scheduling..." : "Schedule Post"}
              </Button>
              {editPost && onPublishNow && (
                <Button
                  type="button"
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => onPublishNow(editPost.id)}
                  disabled={isLoading || editPost.status === "published"}
                  data-testid="button-publish-now"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Publish Now
                </Button>
              )}
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
