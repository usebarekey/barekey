import type { CSSProperties } from "react";
import { useLayoutEffect, useState } from "react";
import tailwindColors from "tailwindcss/colors";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useTheme } from "theme-watcher";

const DEBUG_COLOR_STORAGE_KEY = "debugger-tailwind-color-family";

const TAILWIND_COLOR_FAMILIES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "taupe",
  "mauve",
  "mist",
  "olive",
] as const;

const NEW_TAILWIND_V4_2_FAMILIES = ["taupe", "mauve", "mist", "olive"] as const;

type TailwindColorFamily = (typeof TAILWIND_COLOR_FAMILIES)[number];
type ColorScale = "50" | "100" | "200" | "300" | "500" | "600" | "700" | "800" | "900" | "950";
type ResolvedThemeMode = "light" | "dark";
type TailwindColorScale = Record<ColorScale, string>;

const COLOR_SCALES = ["50", "100", "200", "300", "500", "600", "700", "800", "900", "950"] as const;

const OLIVE_FALLBACK_SCALE: TailwindColorScale = {
  "50": "oklch(98.8% 0.003 106.5)",
  "100": "oklch(96.6% 0.005 106.5)",
  "200": "oklch(93% 0.007 106.5)",
  "300": "oklch(88% 0.011 106.6)",
  "500": "oklch(58% 0.031 107.3)",
  "600": "oklch(46.6% 0.025 107.3)",
  "700": "oklch(39.4% 0.023 107.4)",
  "800": "oklch(28.6% 0.016 107.4)",
  "900": "oklch(22.8% 0.013 107.4)",
  "950": "oklch(15.3% 0.006 107.1)",
};

const COLOR_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

type ColorToken = (typeof COLOR_TOKENS)[number];

const LIGHT_TOKEN_SCALE: Record<ColorToken, ColorScale> = {
  "--background": "50",
  "--foreground": "900",
  "--card": "50",
  "--card-foreground": "900",
  "--popover": "50",
  "--popover-foreground": "900",
  "--primary": "700",
  "--primary-foreground": "50",
  "--secondary": "100",
  "--secondary-foreground": "900",
  "--muted": "100",
  "--muted-foreground": "600",
  "--accent": "200",
  "--accent-foreground": "900",
  "--border": "300",
  "--input": "300",
  "--ring": "500",
  "--sidebar": "100",
  "--sidebar-foreground": "900",
  "--sidebar-primary": "700",
  "--sidebar-primary-foreground": "50",
  "--sidebar-accent": "200",
  "--sidebar-accent-foreground": "900",
  "--sidebar-border": "300",
  "--sidebar-ring": "500",
};

const DARK_TOKEN_SCALE: Record<ColorToken, ColorScale> = {
  "--background": "950",
  "--foreground": "100",
  "--card": "900",
  "--card-foreground": "50",
  "--popover": "900",
  "--popover-foreground": "50",
  "--primary": "300",
  "--primary-foreground": "950",
  "--secondary": "800",
  "--secondary-foreground": "100",
  "--muted": "800",
  "--muted-foreground": "300",
  "--accent": "700",
  "--accent-foreground": "100",
  "--border": "700",
  "--input": "700",
  "--ring": "500",
  "--sidebar": "900",
  "--sidebar-foreground": "100",
  "--sidebar-primary": "300",
  "--sidebar-primary-foreground": "950",
  "--sidebar-accent": "800",
  "--sidebar-accent-foreground": "100",
  "--sidebar-border": "700",
  "--sidebar-ring": "500",
};

function isTailwindColorScale(value: unknown): value is TailwindColorScale {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return COLOR_SCALES.every((shade) => typeof record[shade] === "string");
}

function resolveColorScale(family: TailwindColorFamily): TailwindColorScale {
  const source = tailwindColors as unknown as Record<string, unknown>;
  const candidate = source[family];
  if (isTailwindColorScale(candidate)) {
    return candidate;
  }

  return OLIVE_FALLBACK_SCALE;
}

const TAILWIND_COLOR_SCALES: Record<TailwindColorFamily, TailwindColorScale> = {
  red: resolveColorScale("red"),
  orange: resolveColorScale("orange"),
  amber: resolveColorScale("amber"),
  yellow: resolveColorScale("yellow"),
  lime: resolveColorScale("lime"),
  green: resolveColorScale("green"),
  emerald: resolveColorScale("emerald"),
  teal: resolveColorScale("teal"),
  cyan: resolveColorScale("cyan"),
  sky: resolveColorScale("sky"),
  blue: resolveColorScale("blue"),
  indigo: resolveColorScale("indigo"),
  violet: resolveColorScale("violet"),
  purple: resolveColorScale("purple"),
  fuchsia: resolveColorScale("fuchsia"),
  pink: resolveColorScale("pink"),
  rose: resolveColorScale("rose"),
  slate: resolveColorScale("slate"),
  gray: resolveColorScale("gray"),
  zinc: resolveColorScale("zinc"),
  neutral: resolveColorScale("neutral"),
  stone: resolveColorScale("stone"),
  taupe: resolveColorScale("taupe"),
  mauve: resolveColorScale("mauve"),
  mist: resolveColorScale("mist"),
  olive: resolveColorScale("olive"),
};

function isTailwindColorFamily(value: string): value is TailwindColorFamily {
  return TAILWIND_COLOR_FAMILIES.some((family) => family === value);
}

function readStoredColorFamily(): TailwindColorFamily {
  if (typeof window === "undefined") {
    return "olive";
  }

  const stored = window.localStorage.getItem(DEBUG_COLOR_STORAGE_KEY);
  if (!stored || !isTailwindColorFamily(stored)) {
    return "olive";
  }

  return stored;
}

function colorTokenValue(family: TailwindColorFamily, shade: ColorScale): string {
  return TAILWIND_COLOR_SCALES[family][shade];
}

function swatchStyle(family: TailwindColorFamily): CSSProperties {
  return {
    backgroundColor: colorTokenValue(family, "500"),
  };
}

function applyColorway(family: TailwindColorFamily, mode: ResolvedThemeMode): void {
  const tokenScale = mode === "dark" ? DARK_TOKEN_SCALE : LIGHT_TOKEN_SCALE;
  const root = document.documentElement;

  for (const token of COLOR_TOKENS) {
    root.style.setProperty(token, colorTokenValue(family, tokenScale[token]));
  }
}

export function Debugger() {
  const { toggleMode, resolvedTheme } = useTheme();
  const [colorFamily, setColorFamily] = useState<TailwindColorFamily>(() => readStoredColorFamily());

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const mode: ResolvedThemeMode = resolvedTheme === "dark" ? "dark" : "light";
    applyColorway(colorFamily, mode);
    window.localStorage.setItem(DEBUG_COLOR_STORAGE_KEY, colorFamily);
  }, [colorFamily, resolvedTheme]);

  if (!import.meta.env.DEV) {
    return null;
  }

  function nextColorway() {
    setColorFamily((current) => {
      const currentIndex = TAILWIND_COLOR_FAMILIES.indexOf(current);
      const nextIndex = (currentIndex + 1) % TAILWIND_COLOR_FAMILIES.length;
      return TAILWIND_COLOR_FAMILIES[nextIndex];
    });
  }

  return (
    <div className="fixed right-2 bottom-2 z-[1000] flex items-center gap-2 rounded-xl border bg-background/90 p-2 shadow-lg backdrop-blur-sm pointer-events-auto">
      <NativeSelect
        value={colorFamily}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (isTailwindColorFamily(value)) {
            setColorFamily(value);
          }
        }}
        className="w-56"
      >
        {TAILWIND_COLOR_FAMILIES.map((family) => (
          <NativeSelectOption key={family} value={family}>
            {NEW_TAILWIND_V4_2_FAMILIES.some((entry) => entry === family)
              ? `${family} (v4.2)`
              : family}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div
        className="size-3 rounded-full border border-border"
        style={swatchStyle(colorFamily)}
        aria-hidden="true"
      />
      <Button variant="outline" onClick={nextColorway}>
        Next Color
      </Button>
      <Button onClick={toggleMode}>Toggle Theme</Button>
    </div>
  );
}
