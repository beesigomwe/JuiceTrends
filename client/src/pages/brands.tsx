import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon, getPlatformName } from "@/components/platform-icon";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Layers,
  Tag,
} from "lucide-react";
import type { BrandWithAccounts, SocialAccount } from "@shared/schema";

// ─── Preset colour swatches ───────────────────────────────────────────────────
const COLOR_SWATCHES = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#64748b", // slate
  "#1e293b", // dark
];

// ─── Brand form dialog ────────────────────────────────────────────────────────
interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BrandWithAccounts | null;
  allAccounts: SocialAccount[];
  onSave: (data: {
    name: string;
    description: string;
    color: string;
    accountIds: string[];
  }) => void;
  isSaving: boolean;
}

function BrandFormDialog({
  open,
  onOpenChange,
  initial,
  allAccounts,
  onSave,
  isSaving,
}: BrandFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    initial?.accounts.map((a) => a.id) ?? []
  );

  // Reset when dialog opens with new initial value
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setColor(initial?.color ?? "#6366f1");
      setSelectedAccountIds(initial?.accounts.map((a) => a.id) ?? []);
    }
    onOpenChange(v);
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), color, accountIds: selectedAccountIds });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Brand" : "Create Brand"}</DialogTitle>
          <DialogDescription>
            Group social accounts under a brand to schedule posts to all of them at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name *</Label>
            <Input
              id="brand-name"
              placeholder="e.g. Acme Co."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="brand-desc">Description</Label>
            <Textarea
              id="brand-desc"
              placeholder="Optional short description…"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Colour */}
          <div className="space-y-1.5">
            <Label>Brand colour</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    outline: color === c ? `2px solid ${c}` : "none",
                  }}
                  title={c}
                />
              ))}
              {/* Custom hex input */}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-7 rounded-full cursor-pointer border border-border"
                title="Custom colour"
              />
            </div>
          </div>

          <Separator />

          {/* Account assignment */}
          <div className="space-y-2">
            <Label>Social accounts</Label>
            {allAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected accounts yet. Connect accounts on the Accounts page first.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {allAccounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedAccountIds.includes(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <PlatformIcon platform={account.platform as any} className="h-4 w-4" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{account.accountName}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {getPlatformName(account.platform as any)} · @{account.accountHandle}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            {isSaving ? "Saving…" : initial ? "Save changes" : "Create brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Brands page ─────────────────────────────────────────────────────────
export default function BrandsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<BrandWithAccounts | null>(null);
  const [deleteBrand, setDeleteBrand] = useState<BrandWithAccounts | null>(null);

  // Fetch brands
  const { data: brandsData = [], isLoading: brandsLoading } = useQuery<BrandWithAccounts[]>({
    queryKey: ["/api/brands"],
    enabled: !!user,
  });

  // Fetch all connected accounts (for the account picker)
  const { data: accountsData = [] } = useQuery<SocialAccount[]>({
    queryKey: ["/api/accounts"],
    enabled: !!user,
  });

  // Create brand mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      color: string;
      accountIds: string[];
    }) => {
      // 1. Create the brand
      const res = await apiRequest("POST", "/api/brands", {
        name: data.name,
        description: data.description || null,
        color: data.color,
      });
      const brand = await res.json() as { id: string };
      // 2. Add accounts
      await Promise.all(
        data.accountIds.map((accountId) =>
          apiRequest("POST", `/api/brands/${brand.id}/accounts`, { accountId })
        )
      );
      return brand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setCreateOpen(false);
      toast({ title: "Brand created", description: "Your new brand is ready." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create brand.", variant: "destructive" });
    },
  });

  // Update brand mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description: string;
      color: string;
      accountIds: string[];
      previousAccountIds: string[];
    }) => {
      // 1. Patch brand fields
      await apiRequest("PATCH", `/api/brands/${data.id}`, {
        name: data.name,
        description: data.description || null,
        color: data.color,
      });
      // 2. Remove accounts that were deselected
      const toRemove = data.previousAccountIds.filter((id) => !data.accountIds.includes(id));
      const toAdd = data.accountIds.filter((id) => !data.previousAccountIds.includes(id));
      await Promise.all([
        ...toRemove.map((accountId) =>
          apiRequest("DELETE", `/api/brands/${data.id}/accounts/${accountId}`, undefined)
        ),
        ...toAdd.map((accountId) =>
          apiRequest("POST", `/api/brands/${data.id}/accounts`, { accountId })
        ),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setEditBrand(null);
      toast({ title: "Brand updated", description: "Changes saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update brand.", variant: "destructive" });
    },
  });

  // Delete brand mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/brands/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setDeleteBrand(null);
      toast({ title: "Brand deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete brand.", variant: "destructive" });
    },
  });

  const handleCreate = (data: { name: string; description: string; color: string; accountIds: string[] }) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: { name: string; description: string; color: string; accountIds: string[] }) => {
    if (!editBrand) return;
    updateMutation.mutate({
      ...data,
      id: editBrand.id,
      previousAccountIds: editBrand.accounts.map((a) => a.id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Group your connected accounts into brands. When creating a post, pick a brand to
            auto-select its platforms and route publishing to the right accounts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Brand
        </Button>
      </div>

      {/* Empty state */}
      {!brandsLoading && brandsData.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No brands yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create a brand to group your social accounts together and schedule posts to all of
                them at once.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first brand
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Brand cards grid */}
      {brandsData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brandsData.map((brand) => (
            <Card key={brand.id} className="relative overflow-hidden">
              {/* Colour accent strip */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: brand.color ?? "#6366f1" }}
              />
              <CardHeader className="pb-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: brand.color ?? "#6366f1" }}
                    >
                      {brand.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{brand.name}</CardTitle>
                      {brand.description && (
                        <CardDescription className="text-xs truncate">
                          {brand.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditBrand(brand)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteBrand(brand)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Account list */}
                {brand.accounts.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Users className="h-3.5 w-3.5" />
                    <span>No accounts assigned</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {brand.accounts.map((account) => (
                      <div key={account.id} className="flex items-center gap-2">
                        <PlatformIcon platform={account.platform as any} className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium truncate">{account.accountName}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          @{account.accountHandle}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Platform badges */}
                {brand.accounts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Array.from(new Set(brand.accounts.map((a) => a.platform))).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
                        <PlatformIcon platform={p as any} className="h-3 w-3" />
                        {getPlatformName(p as any)}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {brand.accounts.length} account{brand.accounts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {Array.from(new Set(brand.accounts.map((a) => a.platform))).length} platform
                    {Array.from(new Set(brand.accounts.map((a) => a.platform))).length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <BrandFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={null}
        allAccounts={accountsData}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
      />

      {/* Edit dialog */}
      {editBrand && (
        <BrandFormDialog
          open={!!editBrand}
          onOpenChange={(v) => { if (!v) setEditBrand(null); }}
          initial={editBrand}
          allAccounts={accountsData}
          onSave={handleUpdate}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteBrand} onOpenChange={(v) => { if (!v) setDeleteBrand(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand "{deleteBrand?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the brand and all its account assignments. Posts that were
              associated with this brand will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBrand && deleteMutation.mutate(deleteBrand.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
