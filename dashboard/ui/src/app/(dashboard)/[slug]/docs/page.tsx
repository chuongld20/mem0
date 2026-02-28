"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  description,
  curl,
}: {
  method: string;
  path: string;
  description: string;
  curl: string;
}) {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    POST: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PATCH: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    PUT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${colors[method] || "bg-gray-100 text-gray-800"}`}
        >
          {method}
        </span>
        <code className="text-sm font-medium">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <CodeBlock>{curl}</CodeBlock>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function buildAgentDoc(slug: string, baseUrl: string) {
  const api = `${baseUrl}/api/v1/projects/${slug}`;
  const mcp = `${baseUrl}/mcp/${slug}/sse`;
  return `# SidMemo API Reference — Project: ${slug}

## Base URL
${api}

## Authentication
Every request requires one of:
- Header: Authorization: Bearer <JWT_TOKEN>
- Header: X-API-Key: <API_KEY>
Generate API keys at: ${baseUrl}/${slug}/settings/api-keys

## MCP Endpoint (for AI tool integration)
URL: ${mcp}
Transport: SSE (Server-Sent Events)
Auth: Header "Authorization: Bearer <API_KEY>" or query param "api_key=<API_KEY>"
Available MCP tools: add_memories, search_memories, get_all_memories, delete_memory

---

## Endpoints

### POST ${api}/memories
Add a new memory. The system extracts and stores the memory automatically.
Body (JSON):
{
  "messages": [{"role": "user", "content": "I prefer dark mode"}],
  "user_id": "alice",
  "agent_id": null,
  "run_id": null,
  "metadata": {}
}
Response: 201 with memory object { id, content, mem0_user_id, categories, created_at, updated_at }

### GET ${api}/memories
List memories with optional filters.
Query params: user_id, agent_id, search, page (default 1), page_size (default 20, max 100)
Response: { items: [...], total, page, page_size }

### GET ${api}/memories/{memory_id}
Get a single memory by UUID.
Response: memory object

### PATCH ${api}/memories/{memory_id}
Update a memory's content.
Body: { "content": "updated text" }
Response: updated memory object

### DELETE ${api}/memories/{memory_id}
Delete a memory. Irreversible.
Response: 204 No Content

### POST ${api}/memories/search
Semantic search across memories.
Body: { "query": "user preferences", "user_id": "alice", "limit": 10, "filters": {} }
Response: [{ id, content, score, mem0_user_id, metadata_ }]

### POST ${api}/memories/bulk-delete
Delete multiple memories. Requires admin role.
Body: { "ids": ["uuid1", "uuid2"] } or { "user_id": "alice" }
Response: { "deleted": <count> }

### POST ${api}/memories/export?format=jsonl
Export all memories as JSONL or CSV. format: "jsonl" (default) or "csv"
Response: streaming file download

### POST ${api}/memories/import
Import memories from a JSONL file upload.
Body: multipart/form-data with file field
Each line: { "content": "...", "mem0_user_id": "...", "mem0_agent_id": "...", "metadata": {} }
Response: { "imported": N, "skipped": N, "failed": N }

### GET ${api}/memories/{memory_id}/history
Get edit history of a memory.
Response: [{ id, content, metadata_, changed_by, changed_at }]

---

## Graph Endpoints (requires Neo4j configured)

### GET ${api}/graph/entities
List knowledge graph entities.
Query params: search, page, page_size
Response: { items: [{ name, type, properties, relation_count }], total, page, page_size }

### GET ${api}/graph/entities/{entity_name}
Get entity details with relations.
Response: { name, type, properties, relations: [{ id, source, target, type }] }

### GET ${api}/graph/relations
List relations. Query params: source, target, type, page, page_size
Response: [{ id, source, target, type, properties }]

### GET ${api}/graph/subgraph?entities=A&entities=B&hops=1
Get a subgraph around specified entities.
Response: { entities: [...], relations: [...] }

### DELETE ${api}/graph/entities/{entity_name}
Delete an entity. Requires admin role. Response: 204

### DELETE ${api}/graph/relations/{rel_id}
Delete a relation. Requires admin role. Response: 204

---

## Webhooks

### GET ${api}/webhooks
List webhooks. Response: [{ id, url, events, is_active, last_triggered_at, created_at }]

### POST ${api}/webhooks
Create webhook. Body: { "url": "https://...", "events": ["memory.created", "memory.deleted"], "is_active": true }
Events: memory.created, memory.updated, memory.deleted, * (all)

### PATCH ${api}/webhooks/{webhook_id}
Update webhook. Body: { "url"?: "...", "events"?: [...], "is_active"?: bool }

### DELETE ${api}/webhooks/{webhook_id}
Delete webhook. Response: 204

---

## Roles
- owner: full access, archive project, manage members
- admin: manage members, config, webhooks, bulk delete, import
- editor/member: add, edit, delete memories
- viewer: read-only

## Health Check
GET ${baseUrl}/health → { "status": "ok" }
`;
}

export default function DocsPage() {
  const { slug } = useParams<{ slug: string }>();
  const base = `/api/v1/projects/${slug}`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground text-sm">
          API reference and user guide for this project
        </p>
      </div>

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="guide">User Guide</TabsTrigger>
          <TabsTrigger value="agent">Agent Copy</TabsTrigger>
        </TabsList>

        {/* ── API Reference ── */}
        <TabsContent value="api" className="mt-6 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                All API requests require a Bearer token (JWT) or an API key via
                the <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> header.
              </p>
              <CodeBlock>{`# Using Bearer token
curl -H "Authorization: Bearer <TOKEN>" ...

# Using API key
curl -H "X-API-Key: <YOUR_API_KEY>" ...`}</CodeBlock>
            </CardContent>
          </Card>

          <Section title="Memories">
            <Endpoint
              method="GET"
              path={`${base}/memories`}
              description="List all memories with optional filtering and pagination."
              curl={`curl -H "Authorization: Bearer <TOKEN>" \\
  "${base}/memories?page=1&page_size=20&user_id=alice"`}
            />
            <Endpoint
              method="POST"
              path={`${base}/memories`}
              description="Add a new memory. Provide messages as an array of {role, content} objects."
              curl={`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Remember that I prefer dark mode"}], "user_id": "alice"}' \\
  "${base}/memories"`}
            />
            <Endpoint
              method="GET"
              path={`${base}/memories/:id`}
              description="Get a single memory by ID."
              curl={`curl -H "Authorization: Bearer <TOKEN>" \\
  "${base}/memories/<MEMORY_ID>"`}
            />
            <Endpoint
              method="PATCH"
              path={`${base}/memories/:id`}
              description="Update a memory's content."
              curl={`curl -X PATCH -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "Updated preference: light mode"}' \\
  "${base}/memories/<MEMORY_ID>"`}
            />
            <Endpoint
              method="DELETE"
              path={`${base}/memories/:id`}
              description="Delete a memory by ID."
              curl={`curl -X DELETE -H "Authorization: Bearer <TOKEN>" \\
  "${base}/memories/<MEMORY_ID>"`}
            />
            <Endpoint
              method="POST"
              path={`${base}/memories/search`}
              description="Search memories using natural language. Returns results ranked by relevance."
              curl={`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "user preferences", "limit": 10, "user_id": "alice"}' \\
  "${base}/memories/search"`}
            />
            <Endpoint
              method="POST"
              path={`${base}/memories/bulk-delete`}
              description="Bulk delete memories by IDs or user_id. Requires admin role."
              curl={`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"user_id": "alice"}' \\
  "${base}/memories/bulk-delete"`}
            />
          </Section>

          <Section title="Graph">
            <Endpoint
              method="GET"
              path={`${base}/graph`}
              description="Get the knowledge graph for this project."
              curl={`curl -H "Authorization: Bearer <TOKEN>" \\
  "${base}/graph"`}
            />
          </Section>

          <Section title="Webhooks">
            <Endpoint
              method="GET"
              path={`${base}/webhooks`}
              description="List all webhooks configured for this project."
              curl={`curl -H "Authorization: Bearer <TOKEN>" \\
  "${base}/webhooks"`}
            />
            <Endpoint
              method="POST"
              path={`${base}/webhooks`}
              description="Create a webhook. Specify the URL, events to subscribe to, and active status."
              curl={`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/hook", "events": ["memory.created", "memory.deleted"], "is_active": true}' \\
  "${base}/webhooks"`}
            />
            <Endpoint
              method="PATCH"
              path={`${base}/webhooks/:id`}
              description="Update a webhook's URL, events, or active status."
              curl={`curl -X PATCH -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"is_active": false}' \\
  "${base}/webhooks/<WEBHOOK_ID>"`}
            />
            <Endpoint
              method="DELETE"
              path={`${base}/webhooks/:id`}
              description="Delete a webhook."
              curl={`curl -X DELETE -H "Authorization: Bearer <TOKEN>" \\
  "${base}/webhooks/<WEBHOOK_ID>"`}
            />
          </Section>
        </TabsContent>

        {/* ── User Guide ── */}
        <TabsContent value="guide" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  <strong>Create a project</strong> from the Projects page. Each
                  project gets its own isolated memory store and configuration.
                </li>
                <li>
                  <strong>Generate an API key</strong> in Settings &gt; API Keys.
                  Use this key to authenticate API and MCP requests.
                </li>
                <li>
                  <strong>Add memories</strong> via the Playground, API, or MCP
                  integration. Memories are automatically embedded and indexed for
                  semantic search.
                </li>
                <li>
                  <strong>Search memories</strong> using natural language queries.
                  Results are ranked by semantic similarity.
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">MCP Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Connect AI tools like Claude Desktop or Cursor to your project
                using the Model Context Protocol (MCP). See the{" "}
                <a
                  href={`/${slug}/mcp`}
                  className="text-primary underline underline-offset-4"
                >
                  MCP page
                </a>{" "}
                for endpoint URLs and configuration snippets.
              </p>
              <p>
                Once connected, the AI tool can use <code className="bg-muted px-1 rounded text-xs">add_memory</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">search_memory</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">list_memories</code>, and{" "}
                <code className="bg-muted px-1 rounded text-xs">delete_memory</code> tools
                directly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Webhooks notify your external services when events occur in your
                project. Supported events:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <code className="bg-muted px-1 rounded text-xs">memory.created</code> — fired
                  when a new memory is added
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">memory.updated</code> — fired
                  when a memory is modified
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">memory.deleted</code> — fired
                  when a memory is removed
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">*</code> — subscribe to all
                  events
                </li>
              </ul>
              <p>
                Each delivery is signed with HMAC-SHA256 using the webhook
                secret. Verify the{" "}
                <code className="bg-muted px-1 rounded text-xs">X-Webhook-Signature</code>{" "}
                header to ensure authenticity. Failed deliveries are retried up
                to 3 times.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Each project can be configured independently via Settings &gt;
                Config. Available configuration sections:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>LLM</strong> — model provider and parameters for
                  memory extraction
                </li>
                <li>
                  <strong>Embedder</strong> — embedding model for semantic search
                </li>
                <li>
                  <strong>Vector Store</strong> — Qdrant connection settings
                </li>
                <li>
                  <strong>Graph Store</strong> — Neo4j connection for knowledge
                  graph (optional)
                </li>
              </ul>
              <p>
                Use the &quot;Test Connection&quot; button in settings to verify
                your configuration before saving.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roles &amp; Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Projects use role-based access control with four levels:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Owner</strong> — full access, can archive project and
                  manage all members
                </li>
                <li>
                  <strong>Admin</strong> — manage members, config, webhooks, and
                  bulk operations
                </li>
                <li>
                  <strong>Member</strong> — add, edit, and delete memories
                </li>
                <li>
                  <strong>Viewer</strong> — read-only access to memories and
                  project data
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Agent Copy ── */}
        <TabsContent value="agent" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Agent-Friendly Documentation
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const baseUrl =
                      typeof window !== "undefined"
                        ? `${window.location.protocol}//${window.location.host}`
                        : "";
                    navigator.clipboard
                      .writeText(buildAgentDoc(slug, baseUrl))
                      .then(() => {
                        setCopied(true);
                        toast.success("Copied to clipboard");
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => toast.error("Failed to copy"));
                  }}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Plain-text API reference optimized for AI agents. Copy and paste
                into your agent&apos;s system prompt or context file.
              </p>
              <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-sm whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                <code>
                  {typeof window !== "undefined"
                    ? buildAgentDoc(
                        slug,
                        `${window.location.protocol}//${window.location.host}`
                      )
                    : buildAgentDoc(slug, "<BASE_URL>")}
                </code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
