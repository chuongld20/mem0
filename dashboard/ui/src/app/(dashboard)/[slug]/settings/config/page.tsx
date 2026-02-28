"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getConfig, updateConfig, testConnection } from "@/lib/api";
import type { ProjectConfig, TestConnectionResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, Plug, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "groq", label: "Groq" },
  { value: "ollama", label: "Ollama" },
];

const EMBEDDER_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "ollama", label: "Ollama" },
];

function showApiKeyField(provider: string) {
  return provider !== "ollama";
}

function showBaseUrlField(provider: string) {
  return provider === "openai" || provider === "ollama";
}

export default function ConfigPage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(
    null
  );

  // LLM form fields
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");

  // Embedder form fields
  const [embedderProvider, setEmbedderProvider] = useState("openai");
  const [embedderModel, setEmbedderModel] = useState("");
  const [embedderApiKey, setEmbedderApiKey] = useState("");
  const [embedderBaseUrl, setEmbedderBaseUrl] = useState("");

  // Advanced configs (JSON textareas)
  const [vectorStoreConfigJson, setVectorStoreConfigJson] = useState("{}");
  const [graphStoreConfigJson, setGraphStoreConfigJson] = useState("{}");

  useEffect(() => {
    loadConfig();
  }, [slug]);

  async function loadConfig() {
    try {
      setLoading(true);
      const data = await getConfig(slug);
      setConfig(data);

      const llm = data.llm_config ?? {};
      setLlmProvider((llm.provider as string) ?? "openai");
      setLlmModel((llm.model as string) ?? "");
      setLlmApiKey((llm.api_key as string) ?? "");
      setLlmBaseUrl((llm.api_base_url as string) ?? "");

      const emb = data.embedder_config ?? {};
      setEmbedderProvider((emb.provider as string) ?? "openai");
      setEmbedderModel((emb.model as string) ?? "");
      setEmbedderApiKey((emb.api_key as string) ?? "");
      setEmbedderBaseUrl((emb.api_base_url as string) ?? "");

      setVectorStoreConfigJson(
        JSON.stringify(data.vector_store_config ?? {}, null, 2)
      );
      setGraphStoreConfigJson(
        JSON.stringify(data.graph_store_config ?? {}, null, 2)
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load configuration"
      );
    } finally {
      setLoading(false);
    }
  }

  function parseJson(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    const vectorStore = parseJson(vectorStoreConfigJson);
    const graphStore = parseJson(graphStoreConfigJson);

    if (!vectorStore || !graphStore) {
      toast.error(
        "Invalid JSON in Vector Store or Graph Store configuration."
      );
      return;
    }

    // Build LLM config from form fields
    const llm: Record<string, unknown> = {};
    if (llmProvider) llm.provider = llmProvider;
    if (llmModel) llm.model = llmModel;
    if (llmApiKey) llm.api_key = llmApiKey;
    if (llmBaseUrl) llm.api_base_url = llmBaseUrl;

    // Build Embedder config from form fields
    const embedder: Record<string, unknown> = {};
    if (embedderProvider) embedder.provider = embedderProvider;
    if (embedderModel) embedder.model = embedderModel;
    if (embedderApiKey) embedder.api_key = embedderApiKey;
    if (embedderBaseUrl) embedder.api_base_url = embedderBaseUrl;

    try {
      setSaving(true);
      const updated = await updateConfig(slug, {
        llm_config: llm,
        embedder_config: embedder,
        vector_store_config: vectorStore,
        graph_store_config: graphStore,
      });
      setConfig(updated);
      toast.success("Configuration saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await testConnection(slug);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Configure the backends and models for this project.
            {config && (
              <span className="ml-2 text-xs">
                Last updated:{" "}
                {new Date(config.updated_at).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {testResult && (
        <Card
          className={
            testResult.success
              ? "border-green-500/50"
              : "border-destructive/50"
          }
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {testResult.success ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : (
                <XCircle className="size-5 text-destructive" />
              )}
              Connection Test {testResult.success ? "Passed" : "Failed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {testResult.message}
            </p>
            {testResult.details && (
              <div className="mt-3 space-y-1">
                {Object.entries(testResult.details).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {value === true || value === "ok" ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    <span className="font-medium">{key}:</span>
                    <span className="text-muted-foreground">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LLM Config */}
      <Card>
        <CardHeader>
          <CardTitle>LLM Config</CardTitle>
          <CardDescription>
            Language model provider and credentials. Leave API Key empty to use
            the LiteLLM proxy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                placeholder="e.g. gpt-4o, gemini-pro, claude-3-opus"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              />
            </div>
            {showApiKeyField(llmProvider) && (
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                />
              </div>
            )}
            {showBaseUrlField(llmProvider) && (
              <div className="space-y-2">
                <Label>Base URL (optional)</Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Embedder Config */}
      <Card>
        <CardHeader>
          <CardTitle>Embedder Config</CardTitle>
          <CardDescription>
            Embedding provider and credentials. Leave API Key empty to use the
            LiteLLM proxy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={embedderProvider}
                onValueChange={setEmbedderProvider}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMBEDDER_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                placeholder="e.g. text-embedding-3-small"
                value={embedderModel}
                onChange={(e) => setEmbedderModel(e.target.value)}
              />
            </div>
            {showApiKeyField(embedderProvider) && (
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={embedderApiKey}
                  onChange={(e) => setEmbedderApiKey(e.target.value)}
                />
              </div>
            )}
            {showBaseUrlField(embedderProvider) && (
              <div className="space-y-2">
                <Label>Base URL (optional)</Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={embedderBaseUrl}
                  onChange={(e) => setEmbedderBaseUrl(e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vector Store Config</CardTitle>
          <CardDescription>
            Vector store configuration (JSON).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="vector-store-config">Configuration</Label>
            <textarea
              id="vector-store-config"
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
              value={vectorStoreConfigJson}
              onChange={(e) => setVectorStoreConfigJson(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Graph Store Config</CardTitle>
          <CardDescription>
            Graph store configuration (JSON). Leave as empty object to disable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="graph-store-config">Configuration</Label>
            <textarea
              id="graph-store-config"
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
              value={graphStoreConfigJson}
              onChange={(e) => setGraphStoreConfigJson(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
