"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  listEntities,
  getEntity,
  deleteEntity,
} from "@/lib/api";
import type { Entity, EntityDetail, Relation } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Network,
  ArrowRight,
  Info,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function GraphPage() {
  const { slug } = useParams<{ slug: string }>();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [graphDisabled, setGraphDisabled] = useState(false);

  // Detail panel
  const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Delete
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    setGraphDisabled(false);
    try {
      const data = await listEntities(slug, {
        page,
        page_size: PAGE_SIZE,
      });
      setEntities(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      const status = (err as { status_code?: number }).status_code;
      if (status === 400) {
        setGraphDisabled(true);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to load entities"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [slug, page]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const openDetail = async (name: string) => {
    setSheetOpen(true);
    setDetailLoading(true);
    setSelectedEntity(null);
    try {
      const detail = await getEntity(slug, name);
      setSelectedEntity(detail);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load entity"
      );
      setSheetOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteEntity(slug, name);
      setDeletingName(null);
      setSheetOpen(false);
      setSelectedEntity(null);
      toast.success(`Entity "${name}" deleted`);
      fetchEntities();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete entity"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (graphDisabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground text-sm">
            Explore entities and their relationships
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-amber-500/10 p-3 mb-4">
              <Info className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              Graph Store Not Enabled
            </h2>
            <p className="text-muted-foreground text-center max-w-md text-sm mb-4">
              The knowledge graph feature is not enabled for this project. To
              enable it, update your project configuration and set a{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                graph_store
              </code>{" "}
              provider.
            </p>
            <Button variant="outline" asChild>
              <a href={`/${slug}/settings/config`}>
                <Settings className="size-4" />
                Go to Settings
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Graph</h1>
        <p className="text-muted-foreground text-sm">
          Explore entities and their relationships
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="size-4" />
            Entities
          </CardTitle>
          <CardDescription>
            {total} entities in your knowledge graph
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Network className="size-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No entities found yet.</p>
              <p className="text-muted-foreground text-sm max-w-sm text-center mt-1">
                Entities are automatically extracted when memories are added with
                graph processing enabled.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Relations</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entities.map((entity) => (
                      <TableRow key={`${entity.type}-${entity.name}`}>
                        <TableCell>
                          <button
                            onClick={() => openDetail(entity.name)}
                            className="font-medium text-sm hover:underline"
                          >
                            {entity.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entity.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entity.relation_count ?? 0}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingName(entity.name)}
                            title="Delete entity"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {total} total entities
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
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
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {detailLoading
                ? "Loading..."
                : selectedEntity?.name ?? "Entity Detail"}
            </SheetTitle>
            <SheetDescription>
              {selectedEntity
                ? `Type: ${selectedEntity.type}`
                : "View entity properties and relations"}
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedEntity ? (
            <div className="space-y-6 p-4">
              {/* Properties */}
              <div>
                <h3 className="text-sm font-medium mb-2">Properties</h3>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{selectedEntity.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline">{selectedEntity.type}</Badge>
                  </div>
                  {Object.entries(selectedEntity.properties ?? {}).map(
                    ([key, val]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="text-right max-w-[60%] truncate">
                          {String(val)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Relations */}
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Relations ({(selectedEntity.relations ?? []).length})
                </h3>
                {(selectedEntity.relations ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No relations found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(selectedEntity.relations ?? []).map((rel: Relation) => (
                      <div
                        key={rel.id}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <span className="font-medium truncate">
                          {rel.source}
                        </span>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                        <Badge variant="secondary" className="shrink-0">
                          {rel.type}
                        </Badge>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">
                          {rel.target}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeletingName(selectedEntity.name)}
                >
                  <Trash2 className="size-4" />
                  Delete Entity
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deletingName}
        onOpenChange={(open) => !open && setDeletingName(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entity</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingName}&quot;? This
              will also remove all associated relations. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingName(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingName && handleDelete(deletingName)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
