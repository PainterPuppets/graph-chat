"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, RefreshCw, Network, Layers, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraphVisualization } from "@/components/graph/GraphVisualization";
import type { RawTriplet } from "@/lib/types/graph";
import { listGraphs, getGraphTriplets, listEntityTypes } from "../actions";
import { Zep } from "@getzep/zep-cloud";


export default function GraphPreviewPage() {
  const [graphs, setGraphs] = useState<Zep.Graph[]>([]);
  const [isLoadingGraphs, setIsLoadingGraphs] = useState(true);
  const [selectedGraphId, setSelectedGraphId] = useState<string>("");
  const [triplets, setTriplets] = useState<RawTriplet[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Entity types state
  const [entityTypes, setEntityTypes] = useState<Zep.EntityType[]>([]);
  const [isLoadingEntityTypes, setIsLoadingEntityTypes] = useState(false);
  const [showEntityTypes, setShowEntityTypes] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Load graphs list on mount
  useEffect(() => {
    loadGraphs();
  }, []);

  const loadGraphs = async () => {
    setIsLoadingGraphs(true);
    try {
      const loadedGraphs = await listGraphs();
      setGraphs(loadedGraphs);
    } catch (error) {
      console.error("Failed to load graphs:", error);
    } finally {
      setIsLoadingGraphs(false);
    }
  };

  // Auto-load graph and entity types when selection changes
  useEffect(() => {
    if (selectedGraphId) {
      loadGraphData(selectedGraphId);
      loadEntityTypesData(selectedGraphId);
    } else {
      setTriplets([]);
      setGraphError(null);
      setEntityTypes([]);
    }
  }, [selectedGraphId]);

  const loadGraphData = async (graphId: string) => {
    setIsLoadingGraph(true);
    setGraphError(null);

    try {
      const loadedTriplets = await getGraphTriplets({ graphId });
      setTriplets(loadedTriplets);
      if (loadedTriplets.length === 0) {
        setGraphError("该图谱暂无数据节点");
      }
    } catch (error) {
      setGraphError(error instanceof Error ? error.message : "加载图谱数据失败");
      setTriplets([]);
    } finally {
      setIsLoadingGraph(false);
    }
  };

  const loadEntityTypesData = async (graphId: string) => {
    setIsLoadingEntityTypes(true);
    try {
      const types = await listEntityTypes({ graphId });
      setEntityTypes(types);
    } catch (error) {
      console.error("Failed to load entity types:", error);
      setEntityTypes([]);
    } finally {
      setIsLoadingEntityTypes(false);
    }
  };

  const handleRefresh = () => {
    if (selectedGraphId) {
      loadGraphData(selectedGraphId);
      loadEntityTypesData(selectedGraphId);
    }
  };

  const toggleTypeExpanded = (typeName: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  const selectedGraph = graphs.find(g => g.graphId === selectedGraphId);
  const nodeCount = new Set(triplets.flatMap(t => [t.sourceNode.uuid, t.targetNode.uuid])).size;
  const edgeCount = triplets.length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Entity Types Sidebar */}
      {selectedGraphId && (
        <div className={`border-r bg-muted/30 transition-all duration-300 ${showEntityTypes ? 'w-80' : 'w-0'} overflow-hidden`}>
          <div className="w-80 h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Entity Types
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowEntityTypes(false)}>
                ×
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {isLoadingEntityTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : entityTypes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    暂无 Entity Types
                  </div>
                ) : (
                  entityTypes.map((type) => (
                    <div key={type.name} className="rounded-lg border bg-card">
                      <button
                        onClick={() => toggleTypeExpanded(type.name)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{type.name}</div>
                          {type.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {type.description}
                            </div>
                          )}
                        </div>
                        {type.properties && type.properties.length > 0 && (
                          expandedTypes.has(type.name) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )
                        )}
                      </button>
                      
                      {expandedTypes.has(type.name) && type.properties && type.properties.length > 0 && (
                        <div className="border-t px-3 py-2 space-y-1.5 bg-muted/30">
                          <div className="text-xs font-medium text-muted-foreground mb-2">属性</div>
                          {type.properties.map((prop) => (
                            <div key={prop.name} className="flex items-start gap-2 text-xs">
                              <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0">
                                {prop.name}
                              </Badge>
                              <span className="text-muted-foreground truncate">
                                {prop.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {entityTypes.length > 0 && (
              <div className="border-t p-3 text-xs text-muted-foreground text-center">
                共 {entityTypes.length} 个 Entity Types
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedGraphId && !showEntityTypes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEntityTypes(true)}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Entity Types
                </Button>
              )}
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Eye className="h-6 w-6" />
                  Graph 预览
                </h1>
                <p className="text-muted-foreground">
                  可视化查看知识图谱的节点和关系。
                </p>
              </div>
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
                    {entityTypes.length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {entityTypes.length} 类型
                      </Badge>
                    )}
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
    </div>
  );
}
