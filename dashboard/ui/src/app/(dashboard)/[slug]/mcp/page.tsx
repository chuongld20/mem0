"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Copy,
  Check,
  Link,
  Key,
  Wrench,
  MessageSquare,
  Search,
  Trash2,
  ListPlus,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

const MCP_TOOLS = [
  {
    name: "add_memory",
    description:
      "Add new memories to the project. Accepts text content along with optional user_id, agent_id, and metadata.",
    icon: ListPlus,
  },
  {
    name: "search_memory",
    description:
      "Search memories using natural language queries. Returns the most relevant memories with similarity scores.",
    icon: Search,
  },
  {
    name: "list_memories",
    description:
      "Retrieve all memories, optionally filtered by user_id or agent_id. Supports pagination.",
    icon: MessageSquare,
  },
  {
    name: "delete_memory",
    description:
      "Delete a specific memory by its ID. This action is irreversible.",
    icon: Trash2,
  },
];

export default function McpPage() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connected" | "failed"
  >("idle");

  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";

  const mcpUrl = `${baseUrl}/mcp/${slug}/sse`;

  const claudeConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            [`sidmemo-${slug}`]: {
              url: mcpUrl,
              headers: {
                Authorization: "Bearer <YOUR_API_KEY>",
              },
            },
          },
        },
        null,
        2
      ),
    [slug, mcpUrl]
  );

  const cursorConfig = useMemo(
    () =>
      JSON.stringify(
        {
          name: `sidmemo-${slug}`,
          url: mcpUrl,
          headers: {
            Authorization: "Bearer <YOUR_API_KEY>",
          },
        },
        null,
        2
      ),
    [slug, mcpUrl]
  );

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied!");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const res = await fetch(mcpUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 401) {
        // 401 means the endpoint exists but needs auth - still a valid connection
        setConnectionStatus("connected");
        toast.success("MCP endpoint is reachable");
      } else {
        setConnectionStatus("failed");
        toast.error(`Connection failed - Status ${res.status}`);
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Connection failed - endpoint unreachable");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MCP Integration</h1>
        <p className="text-muted-foreground text-sm">
          Connect your AI tools to this project using the Model Context Protocol
        </p>
      </div>

      {/* Endpoint URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link className="size-4" />
            MCP Endpoint
          </CardTitle>
          <CardDescription>
            Use this URL to connect MCP-compatible clients to your project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
              {mcpUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(mcpUrl, "url")}
              title="Copy URL"
            >
              {copied === "url" ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : connectionStatus === "connected" ? (
                <Wifi className="size-4" />
              ) : connectionStatus === "failed" ? (
                <WifiOff className="size-4" />
              ) : (
                <Wifi className="size-4" />
              )}
              Test Connection
            </Button>
            {connectionStatus === "connected" && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Endpoint reachable
              </span>
            )}
            {connectionStatus === "failed" && (
              <span className="text-sm text-destructive">
                Endpoint unreachable
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Note */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Key className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">API Key Required</p>
            <p className="text-muted-foreground text-sm">
              All MCP connections require a valid API key. You can generate one
              in your project&apos;s{" "}
              <a
                href={`/${slug}/settings/api-keys`}
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                API Keys settings
              </a>
              . Include it in the{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                Authorization
              </code>{" "}
              header as a Bearer token.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Snippets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4" />
            Configuration
          </CardTitle>
          <CardDescription>
            Copy the configuration snippet for your preferred client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
            </TabsList>

            <TabsContent value="claude" className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Add this to your Claude Desktop configuration file (
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      claude_desktop_config.json
                    </code>
                    )
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(claudeConfig, "claude")}
                  >
                    {copied === "claude" ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Copy
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
                  <code>{claudeConfig}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="cursor" className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Add this as an MCP server in Cursor settings
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(cursorConfig, "cursor")}
                  >
                    {copied === "cursor" ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Copy
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
                  <code>{cursorConfig}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Available MCP Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4" />
            Available Tools
          </CardTitle>
          <CardDescription>
            These MCP tools are available when connected to this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {MCP_TOOLS.map((tool) => (
              <div key={tool.name} className="flex gap-3 rounded-lg border p-4">
                <tool.icon className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium">{tool.name}</p>
                    <Badge variant="outline" className="text-xs">
                      tool
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {tool.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
