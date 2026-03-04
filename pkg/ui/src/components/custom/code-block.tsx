import { useEffect, useState } from "react";
import type { Highlighter } from "shiki";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (highlighter) return Promise.resolve(highlighter);
  if (highlighterPromise) return highlighterPromise;
  highlighterPromise = import("shiki").then((shiki) =>
    shiki.createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript"],
    }),
  ).then((h) => {
    highlighter = h;
    return h;
  });
  return highlighterPromise;
}

export function CodeBlock({
  code,
  lang = "typescript",
  className,
}: {
  code: string;
  lang?: string;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((h) => {
      if (cancelled) return;
      const result = h.codeToHtml(code, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
      });
      setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  if (!html) {
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
