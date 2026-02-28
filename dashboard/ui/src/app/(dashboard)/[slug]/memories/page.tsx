"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Memory, SearchResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddMemoryDialog } from "@/components/add-memory-dialog";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 20;

export default function MemoriesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listMemories(slug, {
        page,
        page_size: PAGE_SIZE,
        user_id: userIdFilter || undefined,
      });
      setMemories(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [slug, page, userIdFilter]);

  useEffect(() => {
    if (!searchActive) {
      fetchMemories();
    }
  }, [fetchMemories, searchActive]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchActive(false);
      setSearchResults([]);
      fetchMemories();
      return;
    }

    if (!userIdFilter.trim()) {
      toast.error("User ID is required for semantic search");
      return;
    }

    setLoading(true);
    setSearchActive(true);
    try {
      const results = await api.searchMemories(slug, {
        query,
        user_id: userIdFilter.trim(),
        limit: 50,
      });
      setSearchResults(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchActive(false);
    setSearchResults([]);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentItems = searchActive ? searchResults : memories;

  const toggleAll = () => {
    if (selected.size === currentItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentItems.map((m) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected memories?`)) return;

    setDeleting(true);
    try {
      await api.bulkDeleteMemories(slug, {
        ids: Array.from(selected),
      });
      toast.success(`Deleted ${selected.size} memories`);
      setSelected(new Set());
      if (searchActive) {
        handleSearch();
      } else {
        fetchMemories();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete memories");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search memories..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Input
            placeholder="Filter by user_id"
            className="max-w-[180px]"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (searchActive) {
                  handleSearch();
                } else {
                  setPage(1);
                }
              }
            }}
          />
          {searchActive && (
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete Selected ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add Memory
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={currentItems.length > 0 && selected.size === currentItems.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Content</TableHead>
              {searchActive && <TableHead>Score</TableHead>}
              <TableHead>User ID</TableHead>
              {!searchActive && <TableHead>Created</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <div className="h-5 rounded bg-muted animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {searchActive ? "No search results." : "No memories found."}
                </TableCell>
              </TableRow>
            ) : searchActive ? (
              searchResults.map((result) => (
                <TableRow
                  key={result.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/${slug}/memories/${result.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(result.id)}
                      onChange={() => toggleSelect(result.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {result.content.length > 100
                      ? result.content.slice(0, 100) + "..."
                      : result.content}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {((result.score ?? 0) * 100).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {result.mem0_user_id || "--"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              memories.map((memory) => (
                <TableRow
                  key={memory.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/${slug}/memories/${memory.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(memory.id)}
                      onChange={() => toggleSelect(memory.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {memory.content.length > 100
                      ? memory.content.slice(0, 100) + "..."
                      : memory.content}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {memory.mem0_user_id || "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(memory.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!searchActive && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} total memories
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {searchActive && (
        <p className="text-sm text-muted-foreground">
          {searchResults.length} search result{searchResults.length !== 1 ? "s" : ""}
        </p>
      )}

      <AddMemoryDialog
        slug={slug}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => {
          if (searchActive) {
            handleSearch();
          } else {
            fetchMemories();
          }
        }}
      />
    </div>
  );
}
