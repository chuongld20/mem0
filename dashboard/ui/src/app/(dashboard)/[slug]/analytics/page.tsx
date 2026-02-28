"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getUsage, getRetrieval } from "@/lib/api";
import type { UsagePoint, RetrievalResponse } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export default function AnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [period, setPeriod] = useState<Period>("7d");
  const [usage, setUsage] = useState<UsagePoint[]>([]);
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageData, retrievalData] = await Promise.all([
        getUsage(slug, { period }),
        getRetrieval(slug, { period }),
      ]);
      setUsage(usageData.data);
      setRetrieval(retrievalData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }, [slug, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate counts by action
  const totalByAction = usage.reduce<Record<string, number>>((acc, d) => {
    acc[d.action] = (acc[d.action] || 0) + d.count;
    return acc;
  }, {});

  // Pivot usage data: group by date, one key per action
  const actions = Array.from(new Set(usage.map((d) => d.action)));
  const pivoted = Object.values(
    usage.reduce<Record<string, Record<string, unknown>>>((acc, d) => {
      if (!acc[d.date]) acc[d.date] = { date: d.date };
      acc[d.date][d.action] = d.count;
      return acc;
    }, {})
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Usage metrics and performance insights
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((action) => (
              <Card key={action}>
                <CardHeader className="pb-2">
                  <CardDescription className="capitalize">{action}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(totalByAction[action] || 0).toLocaleString()}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Last {PERIOD_DAYS[period]} days
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Usage chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage Over Time</CardTitle>
              <CardDescription>
                Activity counts per day by action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pivoted}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tickFormatter={(v) => format(new Date(v), "MM/dd")}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      labelFormatter={(v) =>
                        format(new Date(v as string), "MMM dd, yyyy")
                      }
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Legend />
                    {actions.map((action, i) => (
                      <Line
                        key={action}
                        type="monotone"
                        dataKey={action}
                        stroke={`hsl(${(i * 60 + 220) % 360} 70% 55%)`}
                        strokeWidth={2}
                        dot={false}
                        name={action}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Retrieval performance stats */}
          {retrieval && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Retrieval Performance
                </CardTitle>
                <CardDescription>
                  Search latency and volume summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-bold">
                      {retrieval.avg_latency_ms.toFixed(1)} ms
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">P50 Latency</p>
                    <p className="text-2xl font-bold">
                      {retrieval.p50_latency_ms.toFixed(1)} ms
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">P95 Latency</p>
                    <p className="text-2xl font-bold">
                      {retrieval.p95_latency_ms.toFixed(1)} ms
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Searches</p>
                    <p className="text-2xl font-bold">
                      {retrieval.total_searches.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
