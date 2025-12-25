"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2, Eye, MessageCircle, Home } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import { cn } from "@/lib/utils";

export default function Header() {
  const pathname = usePathname();

  const links = [
    { to: "/", label: "Home", icon: Home },
    { to: "/graph/settings", label: "Graph 设置", icon: Settings2 },
    { to: "/graph/preview", label: "Graph 预览", icon: Eye },
    { to: "/chat", label: "Chat", icon: MessageCircle },
  ] as const;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                href={to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
