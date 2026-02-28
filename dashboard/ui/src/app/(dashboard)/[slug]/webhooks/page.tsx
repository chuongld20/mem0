"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listDeliveries,
} from "@/lib/api";
import type { Webhook, WebhookDelivery } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  MoreHorizontal,
  Zap,
  Pencil,
  Trash2,
  ToggleLeft,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ALL_EVENTS = [
  "memory.created",
  "memory.updated",
  "memory.deleted",
  "memory.searched",
] as const;

interface WebhookFormState {
  url: string;
  events: string[];
  is_active: boolean;
}

const emptyForm: WebhookFormState = {
  url: "",
  events: [],
  is_active: true,
};

export default function WebhooksPage() {
  const { slug } = useParams<{ slug: string }>();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<
    Record<string, WebhookDelivery[]>
  >({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(
    null
  );

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWebhooks(slug);
      setWebhooks(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load webhooks"
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (wh: Webhook) => {
    setEditingId(wh.id);
    setForm({
      url: wh.url,
      events: [...wh.events],
      is_active: wh.is_active,
    });
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSave = async () => {
    if (!form.url || form.events.length === 0) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateWebhook(slug, editingId, {
          url: form.url,
          events: form.events,
          is_active: form.is_active,
        });
        toast.success("Webhook updated");
      } else {
        await createWebhook(slug, {
          url: form.url,
          events: form.events,
        });
        toast.success("Webhook created");
      }
      setDialogOpen(false);
      fetchWebhooks();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save webhook"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook(slug, id);
      setDeletingId(null);
      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete webhook"
      );
    }
  };

  const handleToggleActive = async (wh: Webhook) => {
    try {
      await updateWebhook(slug, wh.id, { is_active: !wh.is_active });
      toast.success(wh.is_active ? "Webhook deactivated" : "Webhook activated");
      fetchWebhooks();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update webhook"
      );
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testWebhook(slug, id);
      const ok = result.status_code !== null && result.status_code >= 200 && result.status_code < 300;
      if (ok) {
        toast.success(`Test passed - Status ${result.status_code}`);
      } else {
        toast.error(`Test failed - Status ${result.status_code ?? "no response"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const toggleDeliveries = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!deliveries[id]) {
      setLoadingDeliveries(id);
      try {
        const data = await listDeliveries(slug, id);
        setDeliveries((prev) => ({ ...prev, [id]: data }));
      } catch {
        setDeliveries((prev) => ({ ...prev, [id]: [] }));
      } finally {
        setLoadingDeliveries(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground text-sm">
            Receive HTTP callbacks when events occur in your project
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12">
          <Globe className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">No webhooks configured yet.</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" />
            Create your first webhook
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh) => (
                <>
                  <TableRow key={wh.id}>
                    <TableCell>
                      <button
                        onClick={() => toggleDeliveries(wh.id)}
                        className="flex items-center gap-1.5 font-mono text-sm hover:underline"
                      >
                        {expandedId === wh.id ? (
                          <ChevronUp className="size-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate max-w-[300px]">
                          {wh.url}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <Badge key={ev} variant="outline">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={wh.is_active ? "default" : "secondary"}>
                        {wh.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(wh.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTest(wh.id)}
                            disabled={testingId === wh.id}
                          >
                            <Zap className="size-4" />
                            {testingId === wh.id ? "Testing..." : "Test"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(wh)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(wh)}
                          >
                            <ToggleLeft className="size-4" />
                            {wh.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(wh.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedId === wh.id && (
                    <TableRow key={`${wh.id}-deliveries`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-4">
                        <p className="text-sm font-medium mb-2">
                          Recent Deliveries
                        </p>
                        {loadingDeliveries === wh.id ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading...
                          </div>
                        ) : (deliveries[wh.id] ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No deliveries yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(deliveries[wh.id] ?? []).slice(0, 10).map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between rounded-md border bg-background p-2 text-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant={
                                      d.status_code !== null && d.status_code >= 200 && d.status_code < 300
                                        ? "default"
                                        : "destructive"
                                    }
                                  >
                                    {d.status_code ?? "pending"}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {d.event}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <span>
                                    {d.attempt_count} attempt{d.attempt_count !== 1 ? "s" : ""}
                                  </span>
                                  <span>
                                    {format(
                                      new Date(d.created_at),
                                      "MMM dd HH:mm"
                                    )}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Webhook" : "Add Webhook"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update your webhook configuration"
                : "Configure a new webhook endpoint to receive event notifications"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhook"
                value={form.url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, url: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {ALL_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-accent transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-primary"
                      checked={form.events.includes(event)}
                      onChange={() => toggleEvent(event)}
                    />
                    <span className="font-mono text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            {editingId && (
              <div className="flex items-center gap-3">
                <Label>Active</Label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: !prev.is_active,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    form.is_active ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none block size-5 rounded-full bg-background shadow ring-0 transition-transform ${
                      form.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.url || form.events.length === 0}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
