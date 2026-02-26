import { useTheme } from "theme-watcher";
import dark from "@/assets/barekey-dark.png";
import light from "@/assets/barekey-light.png";

export function Logo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === "dark" ? light : dark;

  return <img src={src} alt="Barekey" className={className} />;
}
