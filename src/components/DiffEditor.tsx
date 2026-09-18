import { useEffect, useRef } from "react";
import {
  LanguageDescription,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { MergeView } from "@codemirror/merge";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import { splitPatch } from "../lib/diff/patch";
import { useThemeStore } from "../lib/stores/theme";

const addLine = Decoration.line({ class: "diff-line-add" });
const delLine = Decoration.line({ class: "diff-line-del" });

const baseTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "12px" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
});

function patchDecorations(): Extension {
  return EditorView.decorations.compute(["doc"], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
      const line = state.doc.line(lineNumber);
      if (line.text.startsWith("+") && !line.text.startsWith("+++")) {
        builder.add(line.from, line.from, addLine);
      } else if (line.text.startsWith("-") && !line.text.startsWith("---")) {
        builder.add(line.from, line.from, delLine);
      }
    }
    return builder.finish();
  });
}

async function languageFor(fileName: string): Promise<Extension> {
  const description = LanguageDescription.matchFilename(languages, fileName);
  if (!description) {
    return [];
  }
  try {
    return await description.load();
  } catch {
    return [];
  }
}

type Props = {
  patch: string;
  fileName: string;
  mode: "unified" | "side";
};

export function DiffEditor({ patch, fileName, mode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useThemeStore((state) => state.resolved);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) {
      return;
    }
    parent.innerHTML = "";
    let disposed = false;
    let view: EditorView | null = null;
    let merge: MergeView | null = null;

    const setup = async () => {
      const language = await languageFor(fileName);
      if (disposed) {
        return;
      }
      const common = [
        ...(theme === "dark" ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle)]),
        baseTheme,
        lineNumbers(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ];
      if (mode === "side") {
        const split = splitPatch(patch);
        if (split) {
          merge = new MergeView({
            a: { doc: split.original, extensions: [language, ...common] },
            b: { doc: split.modified, extensions: [language, ...common] },
            parent,
            highlightChanges: true,
            gutter: true,
            collapseUnchanged: { margin: 3, minSize: 4 },
          });
          return;
        }
      }
      view = new EditorView({
        doc: patch,
        extensions: [...common, patchDecorations()],
        parent,
      });
    };
    void setup();

    return () => {
      disposed = true;
      merge?.destroy();
      view?.destroy();
    };
  }, [patch, fileName, mode, theme]);

  return <div className="diff-editor" ref={containerRef} data-testid="diff-editor" />;
}
