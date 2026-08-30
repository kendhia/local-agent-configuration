"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { Language } from "@/lib/types";

const theme = createTheme({
  theme: "dark",
  settings: {
    background: "#0e1117",
    backgroundImage: "",
    foreground: "#e6e9ef",
    caret: "#6c8cff",
    selection: "#26314d",
    selectionMatch: "#22293a",
    lineHighlight: "#141924",
    gutterBackground: "#0e1117",
    gutterForeground: "#4a5568",
    gutterBorder: "transparent",
    fontFamily: "var(--font-mono)",
  },
  styles: [
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#5f6b80", fontStyle: "italic" },
    { tag: [t.propertyName, t.definition(t.propertyName)], color: "#8ab4f8" },
    { tag: [t.string, t.special(t.string)], color: "#a5d6a7" },
    { tag: [t.number, t.bool, t.null], color: "#f0b37e" },
    { tag: [t.keyword, t.operatorKeyword], color: "#c792ea" },
    { tag: [t.heading, t.strong], color: "#6c8cff", fontWeight: "600" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: [t.link, t.url], color: "#22d3ee", textDecoration: "underline" },
    { tag: [t.monospace], color: "#f0b37e" },
    { tag: t.invalid, color: "#f87171" },
  ],
});

function extensionsFor(language: Language) {
  switch (language) {
    case "json":
    case "jsonc":
      return [json()];
    case "toml":
      return [StreamLanguage.define(toml)];
    case "yaml":
      return [yaml()];
    case "markdown":
      return [markdown()];
    case "shell":
      return [StreamLanguage.define(shell)];
    default:
      return [];
  }
}

interface Props {
  value: string;
  language: Language;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

export default function CodeEditor({ value, language, readOnly, onChange, onSave }: Props) {
  const extensions = useMemo(
    () => [
      ...extensionsFor(language),
      EditorView.lineWrapping,
      // Prec.highest so Cmd+S beats any default binding and never hits the browser.
      Prec.highest(
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSave();
              return true;
            },
          },
        ]),
      ),
    ],
    [language, onSave],
  );

  return (
    <CodeMirror
      value={value}
      theme={theme}
      extensions={extensions}
      onChange={onChange}
      editable={!readOnly}
      height="100%"
      style={{ height: "100%" }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: true,
      }}
    />
  );
}
