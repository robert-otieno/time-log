import { useEffect } from "react";

interface ShortcutHandlers {
  onNewTask?: () => void;
  onToday?: () => void;
  onGoals?: () => void;
  onPriorities?: () => void;
  onFocusMode?: () => void;
}

export function useShortcuts({ onNewTask, onToday, onGoals, onPriorities, onFocusMode }: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      switch (e.key) {
        case "n":
          onNewTask?.();
          break;
        case "d":
          onToday?.();
          break;
        case "g":
          onGoals?.();
          break;
        case "p":
          onPriorities?.();
          break;
        case "f":
          onFocusMode?.();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewTask, onToday, onGoals, onPriorities, onFocusMode]);
}
