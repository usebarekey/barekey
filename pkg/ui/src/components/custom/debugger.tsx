import { Button } from "@/components/ui/button";
import { useTheme } from "theme-watcher";

export function Debugger() {
  const { toggleMode } = useTheme();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-2 right-2 z-50">
      <Button onClick={toggleMode}>Toggle Theme</Button>
    </div>
  );
}