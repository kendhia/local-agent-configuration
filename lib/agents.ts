import type { ConfigKind } from "./types";

export interface Pattern {
  /** Glob relative to the scope root (home dir for global, project root for project). */
  glob: string;
  kind: ConfigKind;
}

export interface AgentDef {
  id: string;
  name: string;
  /** Short blurb shown in the sidebar tooltip / detail header. */
  note?: string;
  accent: string;
  /** Globs relative to $HOME. */
  global: Pattern[];
  /** Globs relative to a project root. Scanning prefixes each with `**` + `/`. */
  project: Pattern[];
}

const p = (glob: string, kind: ConfigKind): Pattern => ({ glob, kind });

/**
 * Agents with a real config surface. Files that do not exist are never shown,
 * so the registry can be generous without cluttering the dashboard.
 */
const PRIMARY_AGENTS: AgentDef[] = [
  {
    id: "claude",
    name: "Claude Code",
    note: "Anthropic Claude Code CLI, desktop and IDE extensions",
    accent: "#d97757",
    global: [
      p("CLAUDE.md", "instructions"),
      p(".claude/CLAUDE.md", "instructions"),
      p(".claude/settings.json", "settings"),
      p(".claude/settings.local.json", "settings"),
      p(".claude/config.json", "settings"),
      p(".claude.json", "settings"),
      p(".claude/keybindings.json", "settings"),
      p(".claude/agents/*.md", "subagents"),
      p(".claude/commands/**/*.md", "commands"),
      p(".claude/skills/*/SKILL.md", "skills"),
      p(".claude/hooks/*", "hooks"),
      p(".claude/output-styles/*.md", "other"),
      p(".claude/statusline*", "other"),
    ],
    project: [
      p("CLAUDE.md", "instructions"),
      p("CLAUDE.local.md", "instructions"),
      p(".claude/settings.json", "settings"),
      p(".claude/settings.local.json", "settings"),
      p(".claude/agents/*.md", "subagents"),
      p(".claude/commands/**/*.md", "commands"),
      p(".claude/skills/*/SKILL.md", "skills"),
      p(".claude/hooks/*", "hooks"),
      p(".claude/workflows/*", "other"),
      p(".mcp.json", "mcp"),
    ],
  },
  {
    id: "codex",
    name: "Codex",
    note: "OpenAI Codex CLI — also reads AGENTS.md",
    accent: "#10a37f",
    global: [
      p(".codex/config.toml", "settings"),
      p(".codex/AGENTS.md", "instructions"),
      p(".codex/instructions.md", "instructions"),
      p(".codex/skills/*/SKILL.md", "skills"),
      p(".codex/prompts/*.md", "commands"),
      p(".codex/notify.sh", "hooks"),
    ],
    project: [
      p(".codex/config.toml", "settings"),
      p(".codex/skills/*/SKILL.md", "skills"),
      p(".codex/prompts/*.md", "commands"),
    ],
  },
  {
    id: "pi",
    name: "Pi",
    note: "Pi agent — also reads AGENTS.md",
    accent: "#a78bfa",
    global: [
      p(".pi/agent/AGENTS.md", "instructions"),
      p(".pi/agent/settings.json", "settings"),
      p(".pi/agent/models.json", "models"),
      p(".pi/agent/models-store.json", "models"),
      p(".pi/agent/trust.json", "settings"),
      p(".pi/agent/skills/*/SKILL.md", "skills"),
      p(".pi/agent/commands/*.md", "commands"),
    ],
    project: [
      p(".pi/settings.json", "settings"),
      p(".pi/skills/*/SKILL.md", "skills"),
      p(".pi/commands/*.md", "commands"),
    ],
  },
  {
    id: "shared",
    name: "AGENTS.md (shared)",
    note: "The cross-vendor standard — read by Codex, Pi, Amp, Cursor, Jules and others",
    accent: "#60a5fa",
    global: [
      p("AGENTS.md", "instructions"),
      p(".agents/skills/*/SKILL.md", "skills"),
      p(".config/agents/AGENTS.md", "instructions"),
      p(".config/agents/skills/*/SKILL.md", "skills"),
    ],
    project: [
      p("AGENTS.md", "instructions"),
      p("AGENT.md", "instructions"),
      p(".agents/skills/*/SKILL.md", "skills"),
    ],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    accent: "#4285f4",
    global: [
      p("GEMINI.md", "instructions"),
      p(".gemini/GEMINI.md", "instructions"),
      p(".gemini/settings.json", "settings"),
      p(".gemini/skills/*/SKILL.md", "skills"),
      p(".gemini/commands/**/*.toml", "commands"),
    ],
    project: [
      p("GEMINI.md", "instructions"),
      p(".gemini/settings.json", "settings"),
      p(".gemini/commands/**/*.toml", "commands"),
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    accent: "#f0f0f0",
    global: [
      p(".cursor/rules/*.mdc", "rules"),
      p(".cursor/mcp.json", "mcp"),
      p(".cursor/cli.json", "settings"),
      p(".cursor/argv.json", "settings"),
      p(".cursor/skills/*/SKILL.md", "skills"),
    ],
    project: [
      p(".cursorrules", "rules"),
      p(".cursor/rules/**/*.mdc", "rules"),
      p(".cursor/mcp.json", "mcp"),
      p(".cursor/environment.json", "settings"),
    ],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    accent: "#8b949e",
    global: [
      p(".copilot/config.json", "settings"),
      p(".copilot/mcp-config.json", "mcp"),
      p(".copilot/skills/*/SKILL.md", "skills"),
    ],
    project: [
      p(".github/copilot-instructions.md", "instructions"),
      p(".github/instructions/**/*.md", "instructions"),
      p(".github/agents/*.md", "subagents"),
      p(".github/prompts/**/*.md", "commands"),
      p(".vscode/mcp.json", "mcp"),
    ],
  },
  {
    id: "aider",
    name: "Aider",
    accent: "#22d3ee",
    global: [
      p(".aider.conf.yml", "settings"),
      p(".aider.model.settings.yml", "models"),
      p(".aider.model.metadata.json", "models"),
    ],
    project: [p(".aider.conf.yml", "settings"), p("CONVENTIONS.md", "instructions")],
  },
  {
    id: "amp",
    name: "Amp",
    accent: "#fb923c",
    global: [p(".config/amp/settings.json", "settings")],
    project: [],
  },
  {
    id: "opencode",
    name: "opencode",
    accent: "#facc15",
    global: [
      p(".config/opencode/opencode.json", "settings"),
      p(".config/opencode/AGENTS.md", "instructions"),
      p(".config/opencode/agent/*.md", "subagents"),
    ],
    project: [
      p("opencode.json", "settings"),
      p("opencode.jsonc", "settings"),
      p(".opencode/agent/*.md", "subagents"),
    ],
  },
  {
    id: "crush",
    name: "Crush",
    accent: "#f472b6",
    global: [p(".config/crush/crush.json", "settings")],
    project: [p("crush.json", "settings"), p(".crush.json", "settings")],
  },
  {
    id: "goose",
    name: "Goose",
    accent: "#94a3b8",
    global: [p(".config/goose/config.yaml", "settings"), p(".config/goose/profiles.yaml", "settings")],
    project: [p(".goosehints", "instructions")],
  },
  {
    id: "conductor",
    name: "Conductor",
    note: "Workspace orchestration — settings.toml drives setup and run scripts",
    accent: "#818cf8",
    global: [p(".conductor/settings.toml", "settings")],
    project: [p(".conductor/settings.toml", "settings"), p(".conductor/scripts/*", "hooks")],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    accent: "#34d399",
    global: [
      p(".codeium/windsurf/memories/global_rules.md", "rules"),
      p(".codeium/windsurf/mcp_config.json", "mcp"),
      p(".codeium/windsurf/skills/*/SKILL.md", "skills"),
    ],
    project: [p(".windsurfrules", "rules"), p(".windsurf/rules/**/*.md", "rules")],
  },
  {
    id: "cline",
    name: "Cline",
    accent: "#2dd4bf",
    global: [p(".cline/skills/*/SKILL.md", "skills"), p(".cline/settings.json", "settings")],
    project: [p(".clinerules", "rules"), p(".clinerules/**/*.md", "rules")],
  },
  {
    id: "roo",
    name: "Roo Code",
    accent: "#c084fc",
    global: [p(".roo/skills/*/SKILL.md", "skills"), p(".roo/settings.json", "settings")],
    project: [p(".roomodes", "settings"), p(".roo/rules/**/*.md", "rules")],
  },
  {
    id: "kiro",
    name: "Kiro",
    accent: "#7dd3fc",
    global: [p(".kiro/skills/*/SKILL.md", "skills"), p(".kiro/settings.json", "settings")],
    project: [p(".kiro/steering/*.md", "rules"), p(".kiro/settings/*.json", "settings")],
  },
  {
    id: "junie",
    name: "Junie",
    accent: "#fca5a5",
    global: [p(".junie/skills/*/SKILL.md", "skills"), p(".junie/settings.json", "settings")],
    project: [p(".junie/guidelines.md", "instructions")],
  },
  {
    id: "qwen",
    name: "Qwen Code",
    accent: "#a3e635",
    global: [p(".qwen/skills/*/SKILL.md", "skills"), p(".qwen/settings.json", "settings")],
    project: [p("QWEN.md", "instructions"), p(".qwen/settings.json", "settings")],
  },
];

/**
 * Agents installed here that only carry a skills directory and/or a flat
 * settings file. Expanded into full defs to keep the registry readable.
 */
const SKILL_ONLY_AGENTS: Array<[id: string, name: string, dir: string]> = [
  ["continue", "Continue", ".continue"],
  ["kilocode", "Kilo Code", ".kilocode"],
  ["factory", "Factory Droid", ".factory"],
  ["trae", "Trae", ".trae"],
  ["zencoder", "Zencoder", ".zencoder"],
  ["openhands", "OpenHands", ".openhands"],
  ["moltbot", "Moltbot", ".moltbot"],
  ["mux", "Mux", ".mux"],
  ["neovate", "Neovate", ".neovate"],
  ["pochi", "Pochi", ".pochi"],
  ["qoder", "Qoder", ".qoder"],
  ["kode", "Kode", ".kode"],
  ["codebuddy", "CodeBuddy", ".codebuddy"],
  ["commandcode", "CommandCode", ".commandcode"],
  ["mcpjam", "MCPJam", ".mcpjam"],
  ["cagent", "cagent", ".cagent"],
];

const SKILL_ONLY_ACCENT = "#64748b";

export const AGENTS: AgentDef[] = [
  ...PRIMARY_AGENTS,
  ...SKILL_ONLY_AGENTS.map(([id, name, dir]) => ({
    id,
    name,
    accent: SKILL_ONLY_ACCENT,
    global: [
      p(`${dir}/skills/*/SKILL.md`, "skills" as ConfigKind),
      p(`${dir}/settings.json`, "settings" as ConfigKind),
      p(`${dir}/config.json`, "settings" as ConfigKind),
      p(`${dir}/AGENTS.md`, "instructions" as ConfigKind),
      p(`${dir}/rules/*.md`, "rules" as ConfigKind),
    ],
    project: [
      p(`${dir}/skills/*/SKILL.md`, "skills" as ConfigKind),
      p(`${dir}/rules/**/*.md`, "rules" as ConfigKind),
    ],
  })),
];

export const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]));

export const KIND_ORDER: ConfigKind[] = [
  "instructions",
  "settings",
  "mcp",
  "rules",
  "subagents",
  "commands",
  "skills",
  "hooks",
  "models",
  "other",
];

export const KIND_LABEL: Record<ConfigKind, string> = {
  instructions: "Instructions",
  settings: "Settings",
  mcp: "MCP",
  rules: "Rules",
  subagents: "Subagents",
  commands: "Commands",
  skills: "Skills",
  hooks: "Hooks",
  models: "Models",
  other: "Other",
};

/** Agent display order in the UI: registry order, which puts the majors first. */
export const AGENT_ORDER = new Map(AGENTS.map((a, i) => [a.id, i]));
