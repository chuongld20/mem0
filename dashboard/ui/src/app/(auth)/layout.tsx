"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, refreshAuth } = useAuthStore();

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Brain className="size-10 text-primary" />
          <h1 className="text-2xl font-bold">SidMemo</h1>
          <p className="text-sm text-muted-foreground">
            Memory layer for AI applications
          </p>
        </div>
        <Card>
          {children}
        </Card>
      </div>
    </div>
  );
}
