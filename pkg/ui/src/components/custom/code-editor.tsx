import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import type { Highlighter } from "shiki";
import { cn } from "@/lib/utils";

const AUTO_CLOSE_PAIRS: Record<string, string> = {
	"{": "}",
	"[": "]",
	"(": ")",
	'"': '"',
};

const CLOSE_CHARS = new Set(Object.values(AUTO_CLOSE_PAIRS));

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
	if (highlighter) return Promise.resolve(highlighter);
	if (highlighterPromise) return highlighterPromise;

	highlighterPromise = import("shiki")
		.then((shiki) =>
			shiki.createHighlighter({
				themes: ["github-light", "github-dark"],
				langs: ["json"],
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

function stripShikiBg(html: string): string {
	return html.replace(/style=(["'])(.*?)\1/g, (_match, quote: string, val: string) => {
		const kept = val
			.split(";")
			.map((p) => p.trim())
			.filter(
				(p) =>
					p.length > 0 &&
					!p.toLowerCase().startsWith("background-color:") &&
					!p.toLowerCase().startsWith("--shiki-dark-bg:") &&
					!p.toLowerCase().startsWith("--shiki-light-bg:"),
			);
		return kept.length === 0 ? "" : `style=${quote}${kept.join("; ")};${quote}`;
	});
}

export function CodeEditor({
	value,
	onChange,
	placeholder,
	className,
	lang = "json",
	id,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	lang?: "json";
	id?: string;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);
	const [highlighted, setHighlighted] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getHighlighter()
			.then((h) => {
				if (cancelled) return;
				const html = h.codeToHtml(value || " ", {
					lang,
					themes: { light: "github-light", dark: "github-dark" },
				});
				setHighlighted(stripShikiBg(html));
			})
			.catch(() => {
				if (!cancelled) setHighlighted(null);
			});
		return () => { cancelled = true; };
	}, [value, lang]);

	const syncScroll = useCallback(() => {
		const ta = textareaRef.current;
		const hl = highlightRef.current;
		if (!ta || !hl) return;
		hl.scrollTop = ta.scrollTop;
		hl.scrollLeft = ta.scrollLeft;
	}, []);

	function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
		onChange(e.target.value);
	}

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		const ta = e.currentTarget;
		const { selectionStart, selectionEnd } = ta;

		if (e.key === "Tab") {
			e.preventDefault();
			const before = value.slice(0, selectionStart);
			const after = value.slice(selectionEnd);
			const next = before + "\t" + after;
			onChange(next);
			requestAnimationFrame(() => {
				ta.selectionStart = selectionStart + 1;
				ta.selectionEnd = selectionStart + 1;
			});
			return;
		}

		const closing = AUTO_CLOSE_PAIRS[e.key];
		if (closing) {
			// When typing a quote char and the next char is the same quote, skip over
			if (e.key === '"' && value[selectionStart] === '"' && selectionStart === selectionEnd) {
				e.preventDefault();
				requestAnimationFrame(() => {
					ta.selectionStart = selectionStart + 1;
					ta.selectionEnd = selectionStart + 1;
				});
				return;
			}

			e.preventDefault();
			const before = value.slice(0, selectionStart);
			const selected = value.slice(selectionStart, selectionEnd);
			const after = value.slice(selectionEnd);
			const next = before + e.key + selected + closing + after;
			onChange(next);
			requestAnimationFrame(() => {
				ta.selectionStart = selectionStart + 1;
				ta.selectionEnd = selectionEnd + 1;
			});
			return;
		}

		// Skip over closing char if it's already the next character
		if (CLOSE_CHARS.has(e.key) && value[selectionStart] === e.key && selectionStart === selectionEnd) {
			e.preventDefault();
			requestAnimationFrame(() => {
				ta.selectionStart = selectionStart + 1;
				ta.selectionEnd = selectionStart + 1;
			});
			return;
		}

		// Backspace: delete matching pair if cursor sits between an open/close pair
		if (e.key === "Backspace" && selectionStart === selectionEnd && selectionStart > 0) {
			const charBefore = value[selectionStart - 1];
			const charAfter = value[selectionStart];
			if (charBefore && AUTO_CLOSE_PAIRS[charBefore] === charAfter) {
				e.preventDefault();
				const next = value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1);
				onChange(next);
				requestAnimationFrame(() => {
					ta.selectionStart = selectionStart - 1;
					ta.selectionEnd = selectionStart - 1;
				});
				return;
			}
		}

		// Enter: auto-indent between braces/brackets
		if (e.key === "Enter" && selectionStart === selectionEnd) {
			const charBefore = value[selectionStart - 1];
			const charAfter = value[selectionStart];
			if (
				(charBefore === "{" && charAfter === "}") ||
				(charBefore === "[" && charAfter === "]")
			) {
				e.preventDefault();
				const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
				const currentLine = value.slice(lineStart, selectionStart);
				const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
				const before = value.slice(0, selectionStart);
				const after = value.slice(selectionStart);
				const next = before + "\n" + indent + "\t" + "\n" + indent + after;
				const cursorPos = selectionStart + 1 + indent.length + 1;
				onChange(next);
				requestAnimationFrame(() => {
					ta.selectionStart = cursorPos;
					ta.selectionEnd = cursorPos;
				});
				return;
			}

			// Regular enter preserves indentation
			const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
			const currentLine = value.slice(lineStart, selectionStart);
			const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
			if (indent.length > 0) {
				e.preventDefault();
				const before = value.slice(0, selectionStart);
				const after = value.slice(selectionEnd);
				const next = before + "\n" + indent + after;
				const cursorPos = selectionStart + 1 + indent.length;
				onChange(next);
				requestAnimationFrame(() => {
					ta.selectionStart = cursorPos;
					ta.selectionEnd = cursorPos;
				});
			}
		}
	}

	// Trailing newline so the textarea height matches
	const displayValue = value.endsWith("\n") ? value + " " : value;

	return (
		<div className={cn("relative", className)}>
			{/* Highlighted layer (behind) */}
			<div
				ref={highlightRef}
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-0 overflow-hidden",
					"[&_pre]:m-0 [&_pre]:overflow-visible [&_pre]:p-2.5 [&_pre]:text-xs [&_pre]:leading-[1.65]",
					"[&_code]:font-mono [&_.shiki]:bg-transparent!",
				)}
				dangerouslySetInnerHTML={highlighted ? { __html: highlighted } : undefined}
			/>

			{/* Editable textarea (in front, transparent text) */}
			<textarea
				ref={textareaRef}
				id={id}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onScroll={syncScroll}
				placeholder={placeholder}
				spellCheck={false}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				className={cn(
					"relative z-10 m-0 w-full resize-y font-mono text-xs leading-[1.65]",
					"border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50",
					"border bg-transparent p-2.5 outline-none transition-colors focus-visible:ring-3",
					"text-transparent caret-foreground selection:bg-primary/20",
					"placeholder:text-muted-foreground",
					"whitespace-pre overflow-auto",
					"min-h-28",
				)}
				style={{ tabSize: 2 }}
			/>

			{/* Mirror for auto-sizing — hidden, same styles as textarea */}
			<pre
				aria-hidden="true"
				className={cn(
					"pointer-events-none invisible absolute left-0 top-0 m-0 w-full whitespace-pre-wrap wrap-break-word",
					"border p-2.5 font-mono text-xs leading-[1.65]",
					"min-h-28",
				)}
			>
				{displayValue || placeholder || " "}
			</pre>
		</div>
	);
}
