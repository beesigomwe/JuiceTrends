import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCreationDrawer } from "@/components/post-creation-drawer";
import { PlatformIcon } from "@/components/platform-icon";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Filter,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { Post, PlatformType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setDrawerOpen(false);
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getPostsForDay = (day: Date) => {
    if (!posts) return [];
    return posts.filter((post) => {
      if (!post.scheduledAt) return false;
      return isSameDay(new Date(post.scheduledAt), day);
    });
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedPost(null);
    setDrawerOpen(true);
  };

  const handlePostClick = (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPost(post);
    setDrawerOpen(true);
  };

  const handleCreatePost = async (data: any) => {
    await createPostMutation.mutateAsync({
      ...data,
      userId: "demo-user",
    });
  };

  const scheduledCount = posts?.filter((p) => p.status === "scheduled").length || 0;
  const draftCount = posts?.filter((p) => p.status === "draft").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Content Calendar</h1>
          <p className="text-muted-foreground">
            Schedule and manage your social media content.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {scheduledCount} Scheduled
            </Badge>
            <Badge variant="secondary" className="bg-muted">
              {draftCount} Drafts
            </Badge>
          </div>
          <Button onClick={() => setDrawerOpen(true)} data-testid="button-create-post">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[160px] text-center" data-testid="text-current-month">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayPosts = getPostsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[112px] p-2 rounded-md border cursor-pointer transition-colors",
                      isCurrentMonth
                        ? "bg-card hover:bg-accent/50"
                        : "bg-muted/30 opacity-50",
                      isCurrentDay && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    onClick={() => handleDayClick(day)}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrentDay && "text-primary font-bold"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayPosts.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          {dayPosts.length}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayPosts.slice(0, 2).map((post) => (
                        <div
                          key={post.id}
                          className="p-1.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                          onClick={(e) => handlePostClick(post, e)}
                          data-testid={`calendar-post-${post.id}`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            {post.platforms.slice(0, 3).map((platform) => (
                              <PlatformIcon
                                key={platform}
                                platform={platform}
                                className="h-3 w-3"
                              />
                            ))}
                          </div>
                          <p className="text-xs line-clamp-1 text-foreground/80">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {post.scheduledAt &&
                              format(new Date(post.scheduledAt), "h:mm a")}
                          </div>
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{dayPosts.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PostCreationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleCreatePost}
        editPost={selectedPost}
        isLoading={createPostMutation.isPending}
      />
    </div>
  );
}
