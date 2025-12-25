"use client";

import { useState } from "react";
import { Key } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiKey } from "@/components/api-key-provider";

export function ApiKeyDialog() {
  const { apiKey, setApiKey, isConfigOpen, closeConfig } = useApiKey();
  const [inputValue, setInputValue] = useState(apiKey);

  const handleSave = () => {
    setApiKey(inputValue);
    closeConfig();
  };

  return (
    <Dialog open={isConfigOpen} onOpenChange={(open) => !open && closeConfig()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key 配置
          </DialogTitle>
          <DialogDescription>
            输入 API Key 以访问受保护的 API 接口。Key 将保存在本地浏览器中。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入你的 API Key"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeConfig}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
