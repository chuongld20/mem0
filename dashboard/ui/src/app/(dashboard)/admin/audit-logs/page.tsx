"use client";

import { useEffect, useState, useCallback } from "react";
import { listAuditLogs } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const PAGE_SIZE = 25;

const ACTION_TYPES = [
  "all",
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "invite",
  "archive",
] as const;

function actionColor(
  action: string
): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("delete") || action.includes("remove"))
    return "destructive";
  if (action.includes("create") || action.includes("add")) return "default";
  if (action.includes("update") || action.includes("change"))
    return "secondary";
  return "outline";
}

export default function AuditLogsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState("all");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAuditLogs({
        page,
        page_size: PAGE_SIZE,
        action: actionFilter === "all" ? undefined : actionFilter,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load audit logs"
      );
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    if (currentUser?.is_superadmin) {
      loadLogs();
    }
  }, [loadLogs, currentUser]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Audit Logs</h2>
        <p className="text-muted-foreground text-sm">
          Track all actions performed on the platform. {total} total entries.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Action:</span>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "all"
                    ? "All Actions"
                    : a.charAt(0).toUpperCase() + a.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]" />
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target Type</TableHead>
                  <TableHead>Target ID</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedId(
                            expandedId === log.id ? null : log.id
                          )
                        }
                      >
                        <TableCell>
                          <ChevronDown
                            className={`size-4 text-muted-foreground transition-transform ${
                              expandedId === log.id ? "rotate-180" : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(
                            new Date(log.created_at),
                            "MMM d, yyyy HH:mm:ss"
                          )}
                        </TableCell>
                        <TableCell>
                          {log.actor_id ? (
                            <span title={log.actor_type}>
                              {log.actor_id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">
                              {log.actor_type || "system"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionColor(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.target_type}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                          {log.target_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {log.ip_address}
                        </TableCell>
                      </TableRow>
                      {expandedId === log.id && (
                        <TableRow key={`${log.id}-details`}>
                          <TableCell colSpan={7} className="bg-muted/50">
                            <div className="p-3">
                              <p className="text-xs font-medium mb-2">
                                Details
                              </p>
                              <pre className="text-xs font-mono whitespace-pre-wrap rounded-md bg-muted p-3 overflow-x-auto">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
