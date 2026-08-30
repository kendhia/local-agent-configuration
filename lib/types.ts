export type Language = "json" | "jsonc" | "toml" | "yaml" | "markdown" | "shell" | "text";

export type ConfigKind =
  | "instructions"
  | "settings"
  | "mcp"
  | "subagents"
  | "commands"
  | "skills"
  | "hooks"
  | "rules"
  | "models"
  | "other";

export interface ConfigFile {
  /** Absolute path on disk. Also the stable identity of the entry. */
  path: string;
  /** `~/…` for global files, project-relative for project files. */
  displayPath: string;
  name: string;
  agentId: string;
  kind: ConfigKind;
  scope: "global" | "project";
  /** Project id, for `scope: "project"` entries. */
  projectId?: string;
  /** Directory the file lives in, relative to the project root ("" = project root). */
  dir?: string;
  size: number;
  mtime: number;
  language: Language;
  /**
   * Other agents that reach this same file through a symlink. Agents routinely
   * link a shared skills directory into their own config dir; the file is listed
   * once at its real location and credited to the rest here.
   */
  linkedBy?: string[];
}

export interface AgentGroup {
  agentId: string;
  agentName: string;
  accent: string;
  files: ConfigFile[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  addedAt: number;
}

export interface ProjectScan {
  project: Project;
  agents: AgentGroup[];
  fileCount: number;
  /** Distinct directories (relative to the project root) that hold configs. */
  dirs: string[];
  error?: string;
}

export interface Snapshot {
  home: string;
  global: AgentGroup[];
  projects: ProjectScan[];
  scannedAt: number;
  scanDepth: number;
}

export interface FilePayload {
  path: string;
  displayPath: string;
  content: string;
  size: number;
  mtime: number;
  language: Language;
  /** Set when the file is too large or binary to edit safely. */
  readOnlyReason?: string;
}

export interface SaveResult {
  path: string;
  size: number;
  mtime: number;
  backup?: string;
}
