"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, RefreshCw, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GraphVisualization } from "@/components/graph/GraphVisualization";
import { trpc } from "@/utils/trpc";

export default function GraphPreviewPage() {
  const [selectedGraphId, setSelectedGraphId] = useState<string>("");

  // tRPC queries
  const graphsQuery = useQuery(trpc.graph.list.queryOptions());
  const tripletsQuery = useQuery({
    ...trpc.graph.getTriplets.queryOptions({ graphId: selectedGraphId }),
    enabled: !!selectedGraphId,
  });

  const graphs = graphsQuery.data ?? [];
  const triplets = tripletsQuery.data ?? [];
  const isLoadingGraphs = graphsQuery.isLoading;
  const isLoadingGraph = tripletsQuery.isLoading;
  const graphError = tripletsQuery.error
    ? tripletsQuery.error instanceof Error
      ? tripletsQuery.error.message
      : "加载图谱数据失败"
    : triplets.length === 0 && selectedGraphId && !isLoadingGraph
    ? "该图谱暂无数据节点"
    : null;

  const handleRefresh = () => {
    if (selectedGraphId) {
      tripletsQuery.refetch();
    }
  };

  const selectedGraph = graphs.find(g => g.graphId === selectedGraphId);
  const nodeCount = new Set(triplets.flatMap(t => [t.sourceNode.uuid, t.targetNode.uuid])).size;
  const edgeCount = triplets.length;

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Graph 预览
            </h1>
            <p className="text-muted-foreground">
              可视化查看知识图谱的节点和关系。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={!selectedGraphId || isLoadingGraph}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingGraph ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="graph-select">选择 Graph</Label>
                <select
                  id="graph-select"
                  value={selectedGraphId}
                  onChange={(e) => setSelectedGraphId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoadingGraphs}
                >
                  {isLoadingGraphs ? (
                    <option value="">加载中...</option>
                  ) : graphs.length === 0 ? (
                    <option value="">没有可用的 Graph</option>
                  ) : (
                    <>
                      <option value="">请选择要预览的 Graph</option>
                      {graphs.map((graph) => (
                        <option key={graph.graphId} value={graph.graphId}>
                          {graph.name || graph.graphId}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {selectedGraph && !isLoadingGraph && triplets.length > 0 && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Network className="h-3 w-3" />
                    {nodeCount} 节点
                  </Badge>
                  <Badge variant="outline">
                    {edgeCount} 关系
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graph Visualization Area */}
      <div className="relative flex-1 rounded-lg border bg-card">
        {!selectedGraphId ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Network className="mx-auto mb-4 h-16 w-16 opacity-30" />
              <p className="text-lg font-medium">选择一个 Graph 开始预览</p>
              <p className="text-sm">从上方下拉菜单选择要查看的知识图谱</p>
            </div>
          </div>
        ) : isLoadingGraph ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">加载图谱数据中...</p>
            </div>
          </div>
        ) : graphError ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Network className="mx-auto mb-4 h-16 w-16 opacity-30" />
              <p className="text-lg font-medium">{graphError}</p>
              <p className="text-sm">尝试上传一些文档来构建知识图谱</p>
            </div>
          </div>
        ) : (
          <GraphVisualization
            triplets={triplets}
            className="h-full w-full overflow-hidden"
          />
        )}
      </div>
    </div>
  );
}
