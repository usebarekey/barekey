import { useEffect, useState } from "react";
import type { Highlighter } from "shiki";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const supportedLanguages = ["typescript", "json"] as const;
type SupportedCodeBlockLanguage = (typeof supportedLanguages)[number];

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function stripShikiBackgroundStyles(html: string): string {
  return html
    .replace(/background-color:[^;"']+;?/g, "")
    .replace(/--shiki-dark-bg:[^;"']+;?/g, "")
    .replace(/--shiki-light-bg:[^;"']+;?/g, "");
}

function getHighlighter() {
  if (highlighter) {
    return Promise.resolve(highlighter);
  }
  if (highlighterPromise) {
    return highlighterPromise;
  }

  highlighterPromise = import("shiki")
    .then((shiki) =>
      shiki.createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: [...supportedLanguages],
      }),
    )
    .then((h) => {
      highlighter = h;
      return h;
    })
    .catch((error: unknown) => {
      highlighterPromise = null;
      throw error;
    });

  return highlighterPromise;
}

export function CodeBlock({
  code,
  lang = "typescript",
  className,
}: {
  code: string;
  lang?: SupportedCodeBlockLanguage;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [hasRenderError, setHasRenderError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setHasRenderError(false);

    void getHighlighter()
      .then((h) => {
        if (cancelled) {
          return;
        }
        const result = h.codeToHtml(code, {
          lang,
          themes: { light: "github-light", dark: "github-dark" },
        });
        setHtml(stripShikiBackgroundStyles(result));
      })
      .catch(() => {
        if (!cancelled) {
          setHasRenderError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (hasRenderError) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed",
          className,
        )}
      >
        <code>{code}</code>
      </pre>
    );
  }

  if (html === null) {
    return (
      <div className={cn("font-mono text-sm", className)}>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "[&_pre]:overflow-x-auto [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_code]:font-mono",
        "[&_.shiki]:bg-transparent!",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
