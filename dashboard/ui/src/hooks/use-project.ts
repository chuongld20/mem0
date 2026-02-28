"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import type { Project } from "@/lib/types";

interface UseProjectReturn {
  project: Project | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const cache = new Map<string, { project: Project; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

export function useProject(slug: string | undefined): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async (force = false) => {
    if (!slug) {
      setProject(null);
      setIsLoading(false);
      return;
    }

    // Check cache
    if (!force) {
      const cached = cache.get(slug);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setProject(cached.project);
        setIsLoading(false);
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getProject(slug);
      cache.set(slug, { project: data, ts: Date.now() });
      setProject(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load project";
      setError(message);
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const refresh = useCallback(async () => {
    await fetchProject(true);
  }, [fetchProject]);

  return { project, isLoading, error, refresh };
}
