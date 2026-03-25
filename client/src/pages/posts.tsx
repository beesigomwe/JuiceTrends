import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/post-card";
import { PostCreationDrawer } from "@/components/post-creation-drawer";
import {
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { Post, PostStatus } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PostsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PostStatus | "all">("all");
  const qc = useQueryClient();

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/posts", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts"] });
      setDrawerOpen(false);
      setSelectedPost(null);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/posts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const handleCreatePost = async (data: any) => {
    await createPostMutation.mutateAsync({
      ...data,
      userId: "demo-user",
    });
  };

  const handleEdit = (post: Post) => {
    setSelectedPost(post);
    setDrawerOpen(true);
  };

  const handleDelete = (post: Post) => {
    deletePostMutation.mutate(post.id);
  };

  const handleDuplicate = (post: Post) => {
    const duplicateData = {
      content: post.content,
      platforms: post.platforms,
      hashtags: post.hashtags || [],
      scheduledAt: null,
      status: "draft",
      userId: "demo-user",
    };
    createPostMutation.mutate(duplicateData);
  };

  const filteredPosts = posts?.filter((post) => {
    const matchesSearch =
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.hashtags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesTab = activeTab === "all" || post.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const counts = {
    all: posts?.length || 0,
    draft: posts?.filter((p) => p.status === "draft").length || 0,
    scheduled: posts?.filter((p) => p.status === "scheduled").length || 0,
    published: posts?.filter((p) => p.status === "published").length || 0,
    failed: posts?.filter((p) => p.status === "failed").length || 0,
  };

  const tabConfig = [
    { value: "all", label: "All", icon: FileText, count: counts.all },
    { value: "draft", label: "Drafts", icon: FileText, count: counts.draft },
    { value: "scheduled", label: "Scheduled", icon: Clock, count: counts.scheduled },
    { value: "published", label: "Published", icon: CheckCircle, count: counts.published },
    { value: "failed", label: "Failed", icon: AlertCircle, count: counts.failed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Posts</h1>
          <p className="text-muted-foreground">
            Manage all your social media content in one place.
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} data-testid="button-create-post">
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-posts"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PostStatus | "all")}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          {tabConfig.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2"
              data-testid={`tab-${tab.value}`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {tab.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-3" />
                    <Skeleton className="h-16 w-full mb-3" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPosts && filteredPosts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No posts found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try adjusting your search terms"
                    : "Create your first post to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setDrawerOpen(true)} data-testid="button-create-first-post">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Post
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <PostCreationDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedPost(null);
        }}
        onSubmit={handleCreatePost}
        editPost={selectedPost}
        isLoading={createPostMutation.isPending}
      />
    </div>
  );
}
