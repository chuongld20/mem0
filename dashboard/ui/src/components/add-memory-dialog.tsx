"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddMemoryDialogProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddMemoryDialog({
  slug,
  open,
  onOpenChange,
  onSuccess,
}: AddMemoryDialogProps) {
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [metadataStr, setMetadataStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setContent("");
    setUserId("");
    setAgentId("");
    setMetadataStr("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !userId.trim()) return;

    let metadata: Record<string, unknown> | undefined;
    if (metadataStr.trim()) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        toast.error("Invalid JSON in metadata field");
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.addMemory(slug, {
        messages: [{ role: "user", content }],
        user_id: userId.trim(),
        agent_id: agentId.trim() || undefined,
        metadata,
      });
      toast.success("Memory added successfully");
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add memory");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Memory</DialogTitle>
            <DialogDescription>
              Add a new memory to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Enter memory content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_id">User ID *</Label>
              <Input
                id="user_id"
                placeholder="e.g. user-123"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent_id">Agent ID</Label>
              <Input
                id="agent_id"
                placeholder="e.g. agent-456 (optional)"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata">Metadata (JSON)</Label>
              <Textarea
                id="metadata"
                placeholder='{"key": "value"} (optional)'
                value={metadataStr}
                onChange={(e) => setMetadataStr(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !content.trim() || !userId.trim()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add Memory
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
