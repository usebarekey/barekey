# theme-watcher

Zero-dependency theme watcher. Works with React, Tailwind, shadcn, or any CSS framework.

## Install

```bash
npm i theme-watcher
```

## Usage

```tsx
import { ThemeWatcher, useTheme } from "theme-watcher";

function App() {
  return (
    <>
      <ThemeWatcher />
      <ThemeToggle />
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, toggleMode } = useTheme();
  return (
    <button onClick={toggleMode}>
      {resolvedTheme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
```

`<ThemeWatcher />` handles:
- System preference detection (`prefers-color-scheme`)
- localStorage persistence
- Cross-tab synchronization
- DOM updates (sets `class` or `data-*` attribute on `<html>`)

## API

### `<ThemeWatcher />`

Place once near your app root. Renders nothing.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `"light" \| "dark"` | - | Force a specific theme (ignores storage/system) |
| `defaultTheme` | `"light" \| "dark" \| "system"` | `"system"` | Initial theme when no stored preference |
| `storageKey` | `string` | `"theme"` | localStorage key for persistence |
| `attribute` | `"class" \| "data-*"` | `"class"` | Attribute set on `<html>` (e.g., `"data-theme"`) |
| `enableColorScheme` | `boolean` | `true` | Set `color-scheme` CSS property on `<html>` |
| `disableTransitionOnChange` | `boolean` | `false` | Disable CSS transitions during theme change |

### `useTheme()`

Hook for reading and controlling theme state.

| Return | Type | Description |
|--------|------|-------------|
| `theme` | `"light" \| "dark" \| "system"` | Current stored preference |
| `resolvedTheme` | `"light" \| "dark"` | Actual applied theme (resolves `"system"` to OS preference) |
| `systemTheme` | `"light" \| "dark"` | Current OS preference |
| `setTheme(t)` | `(t) => void` | Set preference (`"light"`, `"dark"`, or `"system"`) |
| `set(t)` | `(t) => void` | Alias for `setTheme` |
| `get()` | `() => string` | Read stored preference directly |
| `toggleMode()` | `() => void` | Toggle between `"light"` and `"dark"` |

## Tailwind / shadcn Setup

Set `darkMode: "class"` in `tailwind.config.js`. No other configuration needed.

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
}

.dark {
  --background: #111111;
  --foreground: #ffffff;
}
```

## Data Attribute Mode

For CSS frameworks that use `data-theme` instead of class:

```tsx
<ThemeWatcher attribute="data-theme" />
```

```css
:root[data-theme="light"] { /* ... */ }
:root[data-theme="dark"] { /* ... */ }
```

## Behavior

1. On mount: reads localStorage (falls back to `defaultTheme`)
2. If `"system"`: resolves via `prefers-color-scheme` media query
3. Applies to `<html>`: toggles class or sets data attribute
4. Listens for: OS preference changes, storage events (cross-tab sync)
5. On change: updates DOM, localStorage, and all `useTheme()` subscribers
