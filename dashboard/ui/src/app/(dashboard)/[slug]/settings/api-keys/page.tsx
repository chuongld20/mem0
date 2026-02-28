"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Info } from "lucide-react";
import { toast } from "sonner";

export default function ApiKeysPage() {
  const { slug } = useParams<{ slug: string }>();
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/projects/${slug}`
      : `/api/v1/projects/${slug}`;

  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(baseUrl).then(() => {
      setCopied(true);
      toast.success("Endpoint URL copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">API Keys</h2>
        <p className="text-muted-foreground text-sm">
          API access information for this project.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-5 text-muted-foreground" />
            API Key Management
          </CardTitle>
          <CardDescription>
            API keys can be managed through the API directly. Use your
            authentication token (Bearer token) to access the project API
            endpoints.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoint</CardTitle>
          <CardDescription>
            Base URL for this project&apos;s API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <div className="flex gap-2">
              <Input value={baseUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                <Copy className="size-4" />
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-muted-foreground">Copied!</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
          <CardDescription>
            Example curl commands for interacting with the API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>List memories</Label>
            <pre className="rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
{`curl -X GET "${baseUrl}/memories" \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
          <div className="space-y-2">
            <Label>Add a memory</Label>
            <pre className="rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "${baseUrl}/memories" \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "User prefers dark mode", "user_id": "user-123"}'`}
            </pre>
          </div>
          <div className="space-y-2">
            <Label>Search memories</Label>
            <pre className="rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "${baseUrl}/memories/search" \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "user preferences", "limit": 10}'`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
