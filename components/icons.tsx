"use client";

import { KIND_LABEL } from "@/lib/agents";
import type { ConfigKind } from "@/lib/types";
import {
  BookText,
  Braces,
  FileCode,
  FileText,
  Plug,
  Ruler,
  ScrollText,
  Sparkles,
  TerminalSquare,
  Users,
  Wrench,
} from "lucide-react";

const KIND_ICON: Record<ConfigKind, typeof FileText> = {
  instructions: BookText,
  settings: Wrench,
  mcp: Plug,
  rules: Ruler,
  subagents: Users,
  commands: TerminalSquare,
  skills: Sparkles,
  hooks: FileCode,
  models: Braces,
  other: ScrollText,
};

export function KindIcon({ kind, className }: { kind: ConfigKind; className?: string }) {
  const Icon = KIND_ICON[kind] ?? FileText;
  return <Icon className={className} aria-label={KIND_LABEL[kind]} />;
}
