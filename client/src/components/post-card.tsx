import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Clock, Eye, Heart, MousePointer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlatformIcon } from "./platform-icon";
import type { Post } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PostCardProps {
  post: Post;
  onEdit?: (post: Post) => void;
  onDelete?: (post: Post) => void;
  onDuplicate?: (post: Post) => void;
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  published: "bg-green-500/10 text-green-600 dark:text-green-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function PostCard({ post, onEdit, onDelete, onDuplicate, compact = false }: PostCardProps) {
  return (
    <Card className={cn("hover-elevate group", compact && "p-0")} data-testid={`card-post-${post.id}`}>
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {post.platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="h-4 w-4" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusColors[post.status]}>
              {post.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-post-menu-${post.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(post)} data-testid="menu-edit-post">
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate?.(post)} data-testid="menu-duplicate-post">
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(post)}
                  className="text-red-600"
                  data-testid="menu-delete-post"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className={cn("text-sm mb-3 line-clamp-3", compact && "line-clamp-2")}>
          {post.content}
        </p>

        {post.hashtags && post.hashtags.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-primary">
                #{tag}
              </span>
            ))}
            {post.hashtags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{post.hashtags.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {post.scheduledAt
                ? format(new Date(post.scheduledAt), "MMM d, h:mm a")
                : "Not scheduled"}
            </span>
          </div>
          
          {post.status === "published" && !compact && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" title="Impressions">
                <Eye className="h-3 w-3" />
                <span>{post.impressions?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center gap-1" title="Engagement">
                <Heart className="h-3 w-3" />
                <span>{post.engagement?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center gap-1" title="Clicks">
                <MousePointer className="h-3 w-3" />
                <span>{post.clicks?.toLocaleString() || 0}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
