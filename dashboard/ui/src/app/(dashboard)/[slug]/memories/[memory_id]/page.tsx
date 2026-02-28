"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Memory, MemoryHistory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

export default function MemoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const memoryId = params.memory_id as string;

  const [memory, setMemory] = useState<Memory | null>(null);
  const [history, setHistory] = useState<MemoryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [mem, hist] = await Promise.allSettled([
          api.getMemory(slug, memoryId),
          api.getMemoryHistory(slug, memoryId),
        ]);
        if (cancelled) return;
        if (mem.status === "fulfilled") {
          setMemory(mem.value);
          setEditContent(mem.value.content);
        }
        if (hist.status === "fulfilled") setHistory(hist.value);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load memory");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, memoryId]);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateMemory(slug, memoryId, {
        content: editContent,
      });
      setMemory(updated);
      setEditing(false);
      toast.success("Memory updated");
      const hist = await api.getMemoryHistory(slug, memoryId);
      setHistory(hist);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update memory");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteMemory(slug, memoryId);
      toast.success("Memory deleted");
      router.push(`/${slug}/memories`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${slug}/memories`)}
        >
          <ArrowLeft className="size-4" />
          Back to Memories
        </Button>
        <p className="text-muted-foreground">Memory not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/${slug}/memories`)}
      >
        <ArrowLeft className="size-4" />
        Back to Memories
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Memory Content</CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              {memory.id}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditContent(memory.content);
                setEditing(!editing);
              }}
            >
              <Pencil className="size-4" />
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm">{memory.content}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-medium">{memory.mem0_user_id || "--"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Agent ID</dt>
              <dd className="font-medium">{memory.mem0_agent_id || "--"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Run ID</dt>
              <dd className="font-medium">{memory.mem0_run_id || "--"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {formatDistanceToNow(new Date(memory.created_at), {
                  addSuffix: true,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-medium">
                {formatDistanceToNow(new Date(memory.updated_at), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm overflow-auto">
            {JSON.stringify(memory.metadata_, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="size-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No history entries yet.
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((entry, i) => (
                <div key={entry.id}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {entry.changed_by && (
                        <Badge variant="outline" className="text-xs">
                          {entry.changed_by}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.changed_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="rounded bg-muted p-2 text-sm">
                      <p className="whitespace-pre-wrap">{entry.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Memory</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this memory? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
