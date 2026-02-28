"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Memory, SearchResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlaygroundPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // Add memory state
  const [addContent, setAddContent] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addResult, setAddResult] = useState<Memory | null>(null);
  const [adding, setAdding] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUserId, setSearchUserId] = useState("");
  const [searchLimit, setSearchLimit] = useState(5);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleAdd = async () => {
    if (!addContent.trim()) return;

    setAdding(true);
    setAddResult(null);
    try {
      const result = await api.addMemory(slug, {
        messages: [{ role: "user", content: addContent.trim() }],
        user_id: addUserId.trim() || "default",
      });
      setAddResult(result);
      toast.success("Memory added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add memory");
    } finally {
      setAdding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const results = await api.searchMemories(slug, {
        query: searchQuery.trim(),
        user_id: searchUserId.trim(),
        limit: searchLimit,
      });
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No results found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Add Memory Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Add Memory
            </CardTitle>
            <CardDescription>
              Add a new memory to the project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Enter memory content..."
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>User ID (optional)</Label>
              <Input
                placeholder="e.g. user-123"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={adding || !addContent.trim()}
              className="w-full"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </Button>
          </CardContent>
        </Card>

        {addResult && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push(`/${slug}/memories/${addResult.id}`)}
          >
            <CardHeader>
              <CardTitle className="text-sm">Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">ID:</span>{" "}
                  <span className="font-mono text-xs">{addResult.id}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Content:</span>{" "}
                  {addResult.content}
                </p>
                {addResult.mem0_user_id && (
                  <p>
                    <span className="text-muted-foreground">User:</span>{" "}
                    {addResult.mem0_user_id}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4" />
              Search Memories
            </CardTitle>
            <CardDescription>
              Search memories by semantic similarity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search Query</Label>
              <Input
                placeholder="Enter search query..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label>User ID *</Label>
              <Input
                placeholder="e.g. user-123"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Limit: {searchLimit}</Label>
              <input
                type="range"
                min={1}
                max={50}
                value={searchLimit}
                onChange={(e) => setSearchLimit(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>50</span>
              </div>
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim() || !searchUserId.trim()}
              className="w-full"
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </CardContent>
        </Card>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.map((result) => (
              <Card
                key={result.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/${slug}/memories/${result.id}`)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm flex-1">{result.content}</p>
                    <Badge variant="secondary" className="shrink-0">
                      {((result.score ?? 0) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {result.mem0_user_id && <span>user: {result.mem0_user_id}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
