import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { PlatformIcon, getPlatformName } from "./platform-icon";
import { Sparkles, CalendarIcon, Clock, ImagePlus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { PlatformType, Post, platformTypes } from "@shared/schema";

const validPlatforms = ["facebook", "instagram", "twitter", "linkedin", "tiktok", "pinterest", "youtube"] as const;

const postFormSchema = z.object({
  content: z.string().min(1, "Content is required").max(2200, "Content too long"),
  platforms: z.array(z.enum(validPlatforms)).min(1, "Select at least one platform"),
  hashtags: z.string().optional(),
  scheduledDate: z.date().optional(),
  scheduledTime: z.string().optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface PostCreationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    content: string;
    platforms: PlatformType[];
    hashtags: string[];
    scheduledAt: Date | null;
    status: "draft" | "scheduled";
  }) => void;
  editPost?: Post | null;
  isLoading?: boolean;
}

const availablePlatforms: PlatformType[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
];

export function PostCreationDrawer({
  open,
  onOpenChange,
  onSubmit,
  editPost,
  isLoading,
}: PostCreationDrawerProps) {
  const [isGenerating, setIsGenerating] = useState(false);

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
    },
  });

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

    onSubmit({
      content: values.content,
      platforms: values.platforms as PlatformType[],
      hashtags: normalizedHashtags,
      scheduledAt,
      status: asDraft ? "draft" : "scheduled",
    });
  };

  const generateWithAI = async () => {
    setIsGenerating(true);
    setTimeout(() => {
      const suggestions = [
        "Exciting news! We're thrilled to announce our latest product update that's going to revolutionize how you work. Stay tuned for more details!",
        "Behind every great product is an incredible team. Today we celebrate our amazing people who make the magic happen every day.",
        "Your feedback drives our innovation. Thank you to our community for helping us build something truly special.",
      ];
      form.setValue("content", suggestions[Math.floor(Math.random() * suggestions.length)]);
      setIsGenerating(false);
    }, 1500);
  };

  const characterCount = form.watch("content")?.length || 0;
  const selectedPlatforms = form.watch("platforms") || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
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
            <FormField
              control={form.control}
              name="platforms"
              render={() => (
                <FormItem>
                  <FormLabel>Platforms</FormLabel>
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
                              form.setValue("platforms", [...current, platform], { shouldValidate: true });
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
                </FormItem>
              )}
            />

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
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "text-xs",
                        characterCount > 2200 ? "text-red-500" : "text-muted-foreground"
                      )}
                    >
                      {characterCount}/2200
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Media</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, MP4 up to 100MB
                </p>
              </div>
            </div>

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
                  <p className="text-xs text-muted-foreground">
                    Separate hashtags with commas
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <div className="flex gap-3 pt-4 border-t">
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
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
