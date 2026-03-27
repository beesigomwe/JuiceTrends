import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Users,
  Send,
  Plus,
  Trash2,
  Edit,
  BarChart2,
  UserMinus,
  FileText,
  Upload,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "unsubscribed";
  tags: string[] | null;
  source: string | null;
  subscribedAt: string;
}

interface Newsletter {
  id: string;
  subject: string;
  previewText: string | null;
  bodyHtml: string;
  bodyText: string | null;
  status: "draft" | "scheduled" | "sent";
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  openCount: number;
  clickCount: number;
  tags: string[] | null;
  createdAt: string;
}

interface NewsletterStats {
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedCount: number;
  totalCampaignsSent: number;
  avgOpenRate: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: NewsletterStats }) {
  const cards = [
    { label: "Total Subscribers", value: stats.totalSubscribers, icon: Users, color: "text-blue-500" },
    { label: "Active Subscribers", value: stats.activeSubscribers, icon: Mail, color: "text-green-500" },
    { label: "Campaigns Sent", value: stats.totalCampaignsSent, icon: Send, color: "text-purple-500" },
    { label: "Avg Open Rate", value: `${stats.avgOpenRate}%`, icon: BarChart2, color: "text-orange-500" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={`h-8 w-8 ${c.color} shrink-0`} />
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Add Subscriber Dialog ────────────────────────────────────────────────────

function AddSubscriberDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/newsletter/subscribers", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name || null,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Subscriber added successfully" });
      setOpen(false);
      setEmail(""); setName(""); setTags("");
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-subscriber">
          <Plus className="h-4 w-4 mr-2" /> Add Subscriber
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Subscriber</DialogTitle>
          <DialogDescription>Add a new subscriber to your newsletter list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="sub-email">Email *</Label>
            <Input id="sub-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="subscriber@example.com" data-testid="input-subscriber-email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" data-testid="input-subscriber-name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-tags">Tags (comma-separated)</Label>
            <Input id="sub-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="customers, vip" data-testid="input-subscriber-tags" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending} data-testid="button-save-subscriber">
            {mutation.isPending ? "Adding..." : "Add Subscriber"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Import Dialog ───────────────────────────────────────────────────────

function BulkImportDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => {
      const lines = csvText.trim().split("\n").filter(Boolean);
      const subscribers = lines.map((line) => {
        const [email, name] = line.split(",").map((s) => s.trim());
        return { email, name: name || undefined };
      }).filter((s) => s.email);
      return apiFetch<{ imported: number; skipped: number }>("/api/newsletter/subscribers/import", {
        method: "POST",
        body: JSON.stringify({ subscribers }),
      });
    },
    onSuccess: (data) => {
      toast({ title: `Import complete: ${data.imported} imported, ${data.skipped} skipped` });
      setOpen(false);
      setCsvText("");
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-bulk-import">
          <Upload className="h-4 w-4 mr-2" /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Import Subscribers</DialogTitle>
          <DialogDescription>Paste CSV data — one subscriber per line: <code>email, name</code></DialogDescription>
        </DialogHeader>
        <Textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"alice@example.com, Alice\nbob@example.com, Bob"}
          rows={8}
          data-testid="textarea-bulk-import"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!csvText.trim() || mutation.isPending} data-testid="button-confirm-import">
            {mutation.isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subscribers Tab ──────────────────────────────────────────────────────────

function SubscribersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "active" | "unsubscribed">("all");

  const { data: subscribers = [], isLoading } = useQuery<NewsletterSubscriber[]>({
    queryKey: ["/api/newsletter/subscribers"],
    queryFn: () => apiFetch("/api/newsletter/subscribers"),
  });

  const unsubscribeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/newsletter/subscribers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "unsubscribed" }),
      }),
    onSuccess: () => {
      toast({ title: "Subscriber unsubscribed" });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/subscribers"] });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/stats"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/newsletter/subscribers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Subscriber removed" });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/subscribers"] });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/stats"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/newsletter/subscribers"] });
    qc.invalidateQueries({ queryKey: ["/api/newsletter/stats"] });
  };

  const filtered = subscribers.filter((s) => filter === "all" || s.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-36" data-testid="select-subscriber-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} subscriber{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <BulkImportDialog onSuccess={refresh} />
          <AddSubscriberDialog onSuccess={refresh} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading subscribers...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No subscribers yet</p>
          <p className="text-sm">Add your first subscriber to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub.id} data-testid={`row-subscriber-${sub.id}`}>
                  <TableCell className="font-medium">{sub.email}</TableCell>
                  <TableCell>{sub.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(sub.tags ?? []).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.subscribedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {sub.status === "active" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Unsubscribe"
                          onClick={() => unsubscribeMutation.mutate(sub.id)}
                          data-testid={`button-unsubscribe-${sub.id}`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Delete" data-testid={`button-delete-subscriber-${sub.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove subscriber?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove <strong>{sub.email}</strong> from your list.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(sub.id)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Campaign Composer Dialog ─────────────────────────────────────────────────

interface CampaignFormState {
  subject: string;
  previewText: string;
  bodyHtml: string;
}

function CampaignDialog({
  initial,
  onSuccess,
  trigger,
}: {
  initial?: Newsletter;
  onSuccess: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>({
    subject: initial?.subject ?? "",
    previewText: initial?.previewText ?? "",
    bodyHtml: initial?.bodyHtml ?? "",
  });
  const { toast } = useToast();

  const isEdit = !!initial;

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return apiFetch(`/api/newsletter/campaigns/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, previewText: form.previewText || null }),
        });
      }
      return apiFetch("/api/newsletter/campaigns", {
        method: "POST",
        body: JSON.stringify({ ...form, previewText: form.previewText || null }),
      });
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Campaign updated" : "Campaign created" });
      setOpen(false);
      if (!isEdit) setForm({ subject: "", previewText: "", bodyHtml: "" });
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update your newsletter campaign." : "Compose a new newsletter campaign."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="camp-subject">Subject Line *</Label>
            <Input
              id="camp-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Your exciting newsletter subject"
              data-testid="input-campaign-subject"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="camp-preview">Preview Text</Label>
            <Input
              id="camp-preview"
              value={form.previewText}
              onChange={(e) => setForm((f) => ({ ...f, previewText: e.target.value }))}
              placeholder="Short preview shown in inbox..."
              data-testid="input-campaign-preview"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="camp-body">Email Body (HTML or plain text) *</Label>
            <Textarea
              id="camp-body"
              value={form.bodyHtml}
              onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
              placeholder="<p>Hello {{name}},</p><p>Here's what's new this week...</p>"
              rows={10}
              className="font-mono text-sm"
              data-testid="textarea-campaign-body"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.subject || !form.bodyHtml || mutation.isPending}
            data-testid="button-save-campaign"
          >
            {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: campaigns = [], isLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/newsletter/campaigns"],
    queryFn: () => apiFetch("/api/newsletter/campaigns"),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/newsletter/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: (data: any) => {
      toast({ title: `Campaign sent to ${data.recipientCount} subscriber(s)` });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/campaigns"] });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/stats"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/newsletter/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/campaigns"] });
      qc.invalidateQueries({ queryKey: ["/api/newsletter/stats"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/newsletter/campaigns"] });

  const statusColor: Record<string, string> = {
    draft: "secondary",
    scheduled: "outline",
    sent: "default",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        <CampaignDialog
          onSuccess={refresh}
          trigger={
            <Button size="sm" data-testid="button-new-campaign">
              <Plus className="h-4 w-4 mr-2" /> New Campaign
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm">Create your first newsletter campaign to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp) => (
            <Card key={camp.id} data-testid={`card-campaign-${camp.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold truncate">{camp.subject}</h3>
                      <Badge variant={statusColor[camp.status] as any}>{camp.status}</Badge>
                    </div>
                    {camp.previewText && (
                      <p className="text-sm text-muted-foreground truncate">{camp.previewText}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>Created {new Date(camp.createdAt).toLocaleDateString()}</span>
                      {camp.status === "sent" && (
                        <>
                          <span>{camp.recipientCount} recipients</span>
                          <span>{camp.openCount} opens</span>
                          <span>{camp.clickCount} clicks</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {camp.status !== "sent" && (
                      <>
                        <CampaignDialog
                          initial={camp}
                          onSuccess={refresh}
                          trigger={
                            <Button size="icon" variant="ghost" title="Edit" data-testid={`button-edit-campaign-${camp.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Send now" data-testid={`button-send-campaign-${camp.id}`}>
                              <Send className="h-4 w-4 text-primary" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Send campaign now?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark the campaign as sent to all active subscribers. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => sendMutation.mutate(camp.id)}>
                                Send Now
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Delete" data-testid={`button-delete-campaign-${camp.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{camp.subject}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(camp.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsletterPage() {
  const { data: stats } = useQuery<NewsletterStats>({
    queryKey: ["/api/newsletter/stats"],
    queryFn: () => apiFetch("/api/newsletter/stats"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your subscriber list and send email campaigns to your audience.
        </p>
      </div>

      {stats && <StatsRow stats={stats} />}

      <Tabs defaultValue="subscribers">
        <TabsList data-testid="tabs-newsletter">
          <TabsTrigger value="subscribers" data-testid="tab-subscribers">
            <Users className="h-4 w-4 mr-2" /> Subscribers
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Mail className="h-4 w-4 mr-2" /> Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="mt-4">
          <SubscribersTab />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
