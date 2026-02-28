"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Brain, Users, TrendingUp, UserCheck, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Overview, TestConnectionResponse } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProjectOverviewPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [overview, setOverview] = useState<Overview | null>(null);
  const [connection, setConnection] = useState<TestConnectionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [ov, conn] = await Promise.allSettled([
          api.getOverview(slug),
          api.testConnection(slug),
        ]);
        if (cancelled) return;
        if (ov.status === "fulfilled") setOverview(ov.value);
        if (conn.status === "fulfilled") setConnection(conn.value);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    {
      title: "Total Memories",
      value: overview?.total_memories ?? 0,
      icon: Brain,
    },
    {
      title: "Total Users",
      value: overview?.total_users ?? 0,
      icon: Users,
    },
    {
      title: "Growth Rate (7d)",
      value: overview
        ? `${overview.growth_rate_7d >= 0 ? "+" : ""}${overview.growth_rate_7d.toFixed(1)}%`
        : "--",
      icon: TrendingUp,
    },
    {
      title: "Top Users",
      value: overview?.top_users?.length ?? 0,
      icon: UserCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Connection Status
          </CardTitle>
          <CardDescription>
            Status of the underlying memory store connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connection ? (
            <div className="flex items-center gap-3">
              {connection.success ? (
                <CheckCircle className="size-5 text-green-600" />
              ) : (
                <XCircle className="size-5 text-red-600" />
              )}
              <div>
                <Badge variant={connection.success ? "default" : "destructive"}>
                  {connection.success ? "Connected" : "Disconnected"}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {connection.message}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to check connection status.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
