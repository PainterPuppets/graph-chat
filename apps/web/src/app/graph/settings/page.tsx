"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Trash2, Loader2, FileText, RefreshCw, Calendar } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  listGraphs, 
  createGraph, 
  deleteGraph, 
  listEpisodes, 
  deleteEpisode,
} from "../actions";
import { Zep } from "@getzep/zep-cloud";

type UploadSummary = {
  files: number;
  chunks: number;
};

type GraphInfo = {
  graphId: string;
  name?: string;
};

export default function GraphSettingsPage() {
  // State for creating new graph
  const [newGraphId, setNewGraphId] = useState("");
  const [newGraphName, setNewGraphName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // State for graphs list
  const [graphs, setGraphs] = useState<GraphInfo[]>([]);
  const [isLoadingGraphs, setIsLoadingGraphs] = useState(true);
  const [selectedGraphForUpload, setSelectedGraphForUpload] = useState<string>("");

  // State for file upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for episodes
  const [episodes, setEpisodes] = useState<Zep.Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedGraphForEpisodes, setSelectedGraphForEpisodes] = useState<string>("");
  const [deletingEpisodeId, setDeletingEpisodeId] = useState<string | null>(null);

  // Load graphs on mount
  useEffect(() => {
    loadGraphs();
  }, []);

  // Load episodes when selected graph changes
  useEffect(() => {
    if (selectedGraphForEpisodes) {
      loadEpisodes(selectedGraphForEpisodes);
    } else {
      setEpisodes([]);
    }
  }, [selectedGraphForEpisodes]);

  const loadGraphs = async () => {
    setIsLoadingGraphs(true);
    try {
      const loadedGraphs = await listGraphs();
      setGraphs(loadedGraphs);
      // Auto-select first graph if available
      if (loadedGraphs.length > 0 && !selectedGraphForUpload) {
        setSelectedGraphForUpload(loadedGraphs[0].graphId);
      }
    } catch (error) {
      console.error("Failed to load graphs:", error);
    } finally {
      setIsLoadingGraphs(false);
    }
  };

  const loadEpisodes = async (graphId: string) => {
    setIsLoadingEpisodes(true);
    try {
      const loadedEpisodes = await listEpisodes({ graphId });
      setEpisodes(loadedEpisodes);
    } catch (error) {
      console.error("Failed to load episodes:", error);
      setEpisodes([]);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const handleCreateGraph = async () => {
    if (!newGraphId.trim()) {
      setCreateError("请输入 Graph ID");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      await createGraph({
        graphId: newGraphId.trim(),
        name: newGraphName.trim() || undefined,
      });
      setCreateSuccess(`Graph "${newGraphId}" 创建成功！`);
      setNewGraphId("");
      setNewGraphName("");
      await loadGraphs();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "创建失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGraph = async (graphId: string) => {
    if (!confirm(`确定要删除 Graph "${graphId}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await deleteGraph(graphId);
      await loadGraphs();
      if (selectedGraphForUpload === graphId) {
        setSelectedGraphForUpload("");
      }
      if (selectedGraphForEpisodes === graphId) {
        setSelectedGraphForEpisodes("");
        setEpisodes([]);
      }
    } catch (error) {
      console.error("Failed to delete graph:", error);
    }
  };

  const handleDeleteEpisode = async (uuid: string) => {
    if (!confirm("确定要删除此 Episode 吗？")) {
      return;
    }

    setDeletingEpisodeId(uuid);
    try {
      await deleteEpisode(uuid);
      if (selectedGraphForEpisodes) {
        await loadEpisodes(selectedGraphForEpisodes);
      }
    } catch (error) {
      console.error("Failed to delete episode:", error);
    } finally {
      setDeletingEpisodeId(null);
    }
  };

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

    if (!selectedGraphForUpload) {
      setUploadStatus("请先选择要上传到的 Graph。");
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));
    formData.append("userId", localStorage.getItem("zepUserId") || "demo-user");
    formData.append("graphId", selectedGraphForUpload);

    try {
      const response = await fetch("/api/zep/ingest", {
        method: "POST",
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
      
      // Refresh episodes if viewing the same graph
      if (selectedGraphForEpisodes === selectedGraphForUpload) {
        await loadEpisodes(selectedGraphForUpload);
      }
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 overflow-y-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Graph 设置</h1>
        <p className="text-muted-foreground">
          创建和管理知识图谱，上传文档以构建 GraphRAG 知识库。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create New Graph Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              创建新 Graph
            </CardTitle>
            <CardDescription>
              创建一个新的知识图谱来存储和组织信息。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-graph-id">Graph ID *</Label>
              <Input
                id="new-graph-id"
                value={newGraphId}
                onChange={(e) => setNewGraphId(e.target.value)}
                placeholder="例如：my-knowledge-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-graph-name">显示名称（可选）</Label>
              <Input
                id="new-graph-name"
                value={newGraphName}
                onChange={(e) => setNewGraphName(e.target.value)}
                placeholder="例如：我的知识库"
              />
            </div>
            <Button
              onClick={handleCreateGraph}
              disabled={isCreating || !newGraphId.trim()}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建 Graph
                </>
              )}
            </Button>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            {createSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">{createSuccess}</p>
            )}
          </CardContent>
        </Card>

        {/* Existing Graphs Card */}
        <Card>
          <CardHeader>
            <CardTitle>已有 Graphs</CardTitle>
            <CardDescription>
              查看和管理已创建的知识图谱。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingGraphs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : graphs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                还没有创建任何 Graph
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {graphs.map((graph) => (
                    <div
                      key={graph.graphId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{graph.name || graph.graphId}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {graph.graphId}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGraph(graph.graphId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传文档
          </CardTitle>
          <CardDescription>
            将文档上传到选定的 Graph，支持 .txt / .md / .docx 格式。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-graph-select">选择目标 Graph</Label>
            <select
              id="upload-graph-select"
              value={selectedGraphForUpload}
              onChange={(e) => setSelectedGraphForUpload(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isLoadingGraphs || graphs.length === 0}
            >
              {graphs.length === 0 ? (
                <option value="">没有可用的 Graph</option>
              ) : (
                <>
                  <option value="">请选择 Graph</option>
                  {graphs.map((graph) => (
                    <option key={graph.graphId} value={graph.graphId}>
                      {graph.name || graph.graphId}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">选择文件</Label>
            <Input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx"
              multiple
              onChange={handleFileChange}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <Badge key={index} variant="secondary">
                  {file.name}
                </Badge>
              ))}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading || !selectedFiles.length || !selectedGraphForUpload}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                上传文件
              </>
            )}
          </Button>

          {uploadStatus && (
            <p className={`text-sm ${
              uploadStatus.includes("完成") 
                ? "text-green-600 dark:text-green-400" 
                : "text-muted-foreground"
            }`}>
              {uploadStatus}
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Episodes Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Episodes 管理
              </CardTitle>
              <CardDescription>
                查看和管理 Graph 中的 Episodes（文档片段）。
              </CardDescription>
            </div>
            {selectedGraphForEpisodes && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadEpisodes(selectedGraphForEpisodes)}
                disabled={isLoadingEpisodes}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingEpisodes ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="episodes-graph-select">选择 Graph</Label>
            <select
              id="episodes-graph-select"
              value={selectedGraphForEpisodes}
              onChange={(e) => setSelectedGraphForEpisodes(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isLoadingGraphs || graphs.length === 0}
            >
              {graphs.length === 0 ? (
                <option value="">没有可用的 Graph</option>
              ) : (
                <>
                  <option value="">请选择 Graph 查看 Episodes</option>
                  {graphs.map((graph) => (
                    <option key={graph.graphId} value={graph.graphId}>
                      {graph.name || graph.graphId}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {!selectedGraphForEpisodes ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-12 w-12 opacity-30" />
              <p>请选择一个 Graph 来查看其 Episodes</p>
            </div>
          ) : isLoadingEpisodes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-12 w-12 opacity-30" />
              <p>此 Graph 暂无 Episodes</p>
              <p className="text-sm">上传文档以创建 Episodes</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>共 {episodes.length} 个 Episodes</span>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {episodes.map((episode) => (
                    <div
                      key={episode.uuid}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {episode.sourceDescription || "Unnamed Episode"}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(episode.createdAt)}</span>
                            {episode.source && (
                              <Badge variant="outline" className="text-xs">
                                {episode.source}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEpisode(episode.uuid)}
                          disabled={deletingEpisodeId === episode.uuid}
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          {deletingEpisodeId === episode.uuid ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {episode.content && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-20 overflow-hidden">
                          <p className="line-clamp-3">{episode.content}</p>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: {episode.uuid}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
