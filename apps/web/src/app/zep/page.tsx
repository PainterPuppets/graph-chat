"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GraphVisualization } from "@/components/graph/GraphVisualization";
import { getApiKeyHeader } from "@/components/api-key-provider";
import { trpc } from "@/utils/trpc";

type UploadSummary = {
  files: number;
  chunks: number;
};

export default function ZepSettingsPage() {
  const [zepUserId, setZepUserId] = useState("");
  const [zepThreadId, setZepThreadId] = useState("");
  const [zepGraphId, setZepGraphId] = useState("");
  const [zepTemplateId, setZepTemplateId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // tRPC queries
  const graphsQuery = useQuery(trpc.graph.list.queryOptions());
  const tripletsQuery = useQuery({
    ...trpc.graph.getTriplets.queryOptions({
      graphId: selectedGraphId || undefined,
      userId: zepUserId || undefined,
    }),
    enabled: !!selectedGraphId && isInitialized,
  });

  const graphs = graphsQuery.data ?? [];
  const triplets = tripletsQuery.data ?? [];
  const isLoadingGraphs = graphsQuery.isLoading;
  const isLoadingGraph = tripletsQuery.isLoading;
  const graphError = tripletsQuery.error
    ? tripletsQuery.error instanceof Error
      ? tripletsQuery.error.message
      : "加载图形数据失败"
    : triplets.length === 0 && selectedGraphId && !isLoadingGraph
    ? "没有找到图形数据"
    : null;

  useEffect(() => {
    const storedUserId = localStorage.getItem("zepUserId");
    const storedThreadId = localStorage.getItem("zepThreadId");
    const storedGraphId = localStorage.getItem("zepGraphId");
    const storedTemplateId = localStorage.getItem("zepTemplateId");

    const userId = storedUserId ?? crypto.randomUUID();
    const threadId = storedThreadId ?? crypto.randomUUID();

    setZepUserId(userId);
    setZepThreadId(threadId);
    setZepGraphId(storedGraphId ?? "");
    setZepTemplateId(storedTemplateId ?? "");

    localStorage.setItem("zepUserId", userId);
    localStorage.setItem("zepThreadId", threadId);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (zepUserId) localStorage.setItem("zepUserId", zepUserId);
  }, [zepUserId]);

  useEffect(() => {
    if (zepThreadId) localStorage.setItem("zepThreadId", zepThreadId);
  }, [zepThreadId]);

  useEffect(() => {
    localStorage.setItem("zepGraphId", zepGraphId);
  }, [zepGraphId]);

  useEffect(() => {
    localStorage.setItem("zepTemplateId", zepTemplateId);
  }, [zepTemplateId]);

  // Update zepGraphId when selectedGraphId changes
  useEffect(() => {
    if (selectedGraphId) {
      setZepGraphId(selectedGraphId);
    }
  }, [selectedGraphId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setUploadStatus(null);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      setUploadStatus("请选择文件后再上传。");
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));
    formData.append("userId", zepUserId);
    if (zepGraphId) formData.append("graphId", zepGraphId);

    try {
      const response = await fetch("/api/zep/ingest", {
        method: "POST",
        headers: getApiKeyHeader(),
        body: formData,
      });
      const data = (await response.json()) as UploadSummary & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error ?? "上传失败");
      }
      setUploadStatus(
        `上传完成：${data.files} 个文件，共 ${data.chunks} 个切片。`
      );
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadGraph = () => {
    const graphIdToLoad = zepGraphId || selectedGraphId;
    if (graphIdToLoad) {
      setSelectedGraphId(graphIdToLoad);
      tripletsQuery.refetch();
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Zep 设置</CardTitle>
          <CardDescription>
            用于 GraphRAG 和记忆的用户 / 线程 / 图谱配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="zep-user-id">Zep User ID</Label>
            <Input
              id="zep-user-id"
              value={zepUserId}
              onChange={(e) => setZepUserId(e.target.value)}
              placeholder="Zep User ID"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="zep-thread-id">Zep Thread ID</Label>
            <Input
              id="zep-thread-id"
              value={zepThreadId}
              onChange={(e) => setZepThreadId(e.target.value)}
              placeholder="Zep Thread ID"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="zep-graph-id">Zep Graph ID (可选)</Label>
            <Input
              id="zep-graph-id"
              value={zepGraphId}
              onChange={(e) => setZepGraphId(e.target.value)}
              placeholder="Zep Graph ID"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="zep-template-id">
              Zep Context Template ID (可选)
            </Label>
            <Input
              id="zep-template-id"
              value={zepTemplateId}
              onChange={(e) => setZepTemplateId(e.target.value)}
              placeholder="Zep Context Template ID"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>上传设定集</CardTitle>
          <CardDescription>
            支持 .txt / .md / .docx，多文件上传。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx"
            multiple
            onChange={handleFileChange}
          />
          {selectedFiles.length ? (
            <div className="text-xs text-muted-foreground">
              已选择 {selectedFiles.length} 个文件：
              {selectedFiles.map((file) => file.name).join(", ")}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button type="button" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? "上传中..." : "上传到 Zep"}
            </Button>
            {uploadStatus ? (
              <span className="text-xs text-muted-foreground">
                {uploadStatus}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>图形可视化</CardTitle>
          <CardDescription>可视化 Zep 图谱中的节点和关系。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="graph-select">选择图形</Label>
            <Select
              id="graph-select"
              value={selectedGraphId}
              onChange={(e) => setSelectedGraphId(e.target.value)}
              disabled={isLoadingGraphs}
              placeholder={isLoadingGraphs ? "加载中..." : "从服务器选择图形"}
            >
              {graphs.map((graph) => (
                <option key={graph.graphId} value={graph.graphId}>
                  {graph.name || graph.graphId}
                </option>
              ))}
            </Select>
            {graphs.length === 0 && !isLoadingGraphs && (
              <p className="text-xs text-muted-foreground">没有可用的图形</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">或</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-graph-id">手动输入 Graph ID</Label>
            <div className="flex gap-2">
              <Input
                id="manual-graph-id"
                value={zepGraphId}
                onChange={(e) => setZepGraphId(e.target.value)}
                placeholder="输入 Graph ID"
              />
              <Button
                type="button"
                onClick={handleLoadGraph}
                disabled={
                  isLoadingGraph ||
                  (!zepGraphId && !selectedGraphId && !zepUserId)
                }
              >
                {isLoadingGraph ? "加载中..." : "加载图形"}
              </Button>
            </div>
          </div>

          {graphError && (
            <div className="text-sm text-destructive">{graphError}</div>
          )}
          {triplets.length > 0 && (
            <div className="mt-4">
              <GraphVisualization triplets={triplets} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
