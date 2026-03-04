import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  onBlockedAttempt,
}: {
  hasUnsavedChanges: boolean;
  onBlockedAttempt?: () => void;
}) {
  const location = useLocation();
  const currentPathRef = useRef("");

  useEffect(() => {
    currentPathRef.current = `${location.pathname}${location.search}${location.hash}`;
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    function isBlockedDestination(url: string | URL | null | undefined): boolean {
      if (url == null) {
        return false;
      }

      const resolvedUrl = new URL(String(url), window.location.origin);
      if (resolvedUrl.origin !== window.location.origin) {
        return false;
      }

      const nextPath = `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
      return nextPath !== currentPathRef.current;
    }

    window.history.pushState = function guardedPushState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void {
      if (isBlockedDestination(url)) {
        onBlockedAttempt?.();
        return;
      }

      originalPushState(data, unused, url);
    };

    window.history.replaceState = function guardedReplaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void {
      if (isBlockedDestination(url)) {
        onBlockedAttempt?.();
        return;
      }

      originalReplaceState(data, unused, url);
    };

    function handlePopState(): void {
      const expectedPath = currentPathRef.current;
      const actualPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (actualPath !== expectedPath) {
        onBlockedAttempt?.();
        originalPushState(window.history.state, "", expectedPath);
      }
    }

    function handleLinkClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      if (isBlockedDestination(anchor.href)) {
        event.preventDefault();
        onBlockedAttempt?.();
      }
    }

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges, onBlockedAttempt]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
