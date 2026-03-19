import { useTheme } from "theme-watcher";

import dark from "@/assets/barekey-dark.png";
import light from "@/assets/barekey-light.png";

/**
 * Renders the Barekey logo with theme-aware asset selection.
 *
 * @param props The optional CSS class name for the image element.
 * @returns The themed Barekey logo image.
 * @remarks This mirrors the shared auth/UI branding so the auth app does not diverge visually.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function Logo(props: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === "dark" ? light : dark;

  return <img src={src} alt="Barekey" className={props.className} />;
}
