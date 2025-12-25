"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Settings2, Eye, MessageCircle, ArrowRight, Network } from "lucide-react";

import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Graph 设置",
    description: "创建新的知识图谱，上传文档以构建您的 GraphRAG 知识库。",
    icon: Settings2,
    href: "/graph/settings",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Graph 预览",
    description: "可视化查看知识图谱，探索节点之间的关系和连接。",
    icon: Eye,
    href: "/graph/preview",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "AI 对话",
    description: "基于选定的知识图谱进行智能对话，获取上下文相关的回答。",
    icon: MessageCircle,
    href: "/chat",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

export default function Home() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-12">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Network className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Graph Chat
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            基于 Zep 的知识图谱对话系统，通过 GraphRAG 技术实现智能上下文理解和知识管理。
          </p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                healthCheck.data ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground">
              {healthCheck.isLoading
                ? "检查连接..."
                : healthCheck.data
                  ? "API 已连接"
                  : "API 未连接"}
            </span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.href}
              className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50"
            >
              <CardHeader>
                <div className={`mb-2 inline-flex rounded-lg p-2.5 ${feature.bgColor}`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={feature.href}>
                  <Button variant="ghost" className="group/btn -ml-4">
                    开始使用
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start */}
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>快速开始</CardTitle>
            <CardDescription>
              三步构建您的知识图谱对话系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">创建 Graph</p>
                  <p className="text-sm text-muted-foreground">
                    在设置页面创建一个新的知识图谱
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">上传文档</p>
                  <p className="text-sm text-muted-foreground">
                    上传 txt、md 或 docx 文件来构建知识库
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium">开始对话</p>
                  <p className="text-sm text-muted-foreground">
                    选择图谱并开始智能对话
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
