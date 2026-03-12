import { useOrganization, useUser } from "@clerk/react-router";
import { PostHogProvider, usePostHog } from "@posthog/react";
import posthog from "posthog-js";
import { type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { runtimeConfig } from "./runtime-config";

const posthogApiKey = runtimeConfig.posthogKey;
const posthogApiHost = runtimeConfig.posthogHost;
const posthogUiHost = runtimeConfig.posthogUiHost;

let hasInitializedPostHog = false;

function isUiSurface(pathname: string) {
  return (
    pathname === "/new" ||
    pathname.startsWith("/o/") ||
    pathname.startsWith("/u/") ||
    pathname.startsWith("/cli/")
  );
}

function getSurface(pathname: string) {
  return isUiSurface(pathname) ? "ui" : "landing";
}

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

function initPostHog() {
  if (hasInitializedPostHog || !posthogApiKey || typeof window === "undefined") {
    return;
  }

  posthog.init(posthogApiKey, {
    api_host: posthogApiHost,
    ui_host: posthogUiHost,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: false,
    loaded(client) {
      if (import.meta.env.DEV) {
        client.debug();
      }
    },
  });

  hasInitializedPostHog = true;
}

function PostHogIdentitySync() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, isLoaded: isOrganizationLoaded } = useOrganization();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasInitializedPostHog || !isUserLoaded) {
      return;
    }

    if (!user) {
      if (previousUserIdRef.current !== null) {
        posthog.reset();
        previousUserIdRef.current = null;
      }
      return;
    }

    previousUserIdRef.current = user.id;

    posthog.identify(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName ?? user.username ?? undefined,
      username: user.username ?? undefined,
    });
  }, [
    isUserLoaded,
    user?.fullName,
    user?.id,
    user?.primaryEmailAddress?.emailAddress,
    user?.username,
  ]);

  useEffect(() => {
    if (!hasInitializedPostHog || !isOrganizationLoaded) {
      return;
    }

    if (!organization) {
      posthog.resetGroups();
      posthog.unregister("current_org_id");
      posthog.unregister("current_org_slug");
      posthog.unregister("current_org_name");
      return;
    }

    posthog.group("organization", organization.id, {
      name: organization.name,
      slug: organization.slug ?? undefined,
    });
    posthog.register({
      current_org_id: organization.id,
      current_org_name: organization.name,
      current_org_slug: organization.slug ?? undefined,
    });
  }, [isOrganizationLoaded, organization]);

  return null;
}

function PostHogPageTracker() {
  const location = useLocation();
  const lastTrackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasInitializedPostHog || typeof window === "undefined") {
      return;
    }

    const nextUrl = window.location.href;
    if (lastTrackedUrlRef.current === nextUrl) {
      return;
    }

    lastTrackedUrlRef.current = nextUrl;

    const surface = getSurface(location.pathname);

    posthog.register({
      current_hash: location.hash || undefined,
      current_pathname: location.pathname,
      current_search: location.search || undefined,
      current_surface: surface,
    });

    if (!location.hash) {
      posthog.unregister("current_hash");
    }

    if (!location.search) {
      posthog.unregister("current_search");
    }

    posthog.capture("$pageview", {
      $current_url: nextUrl,
      current_hash: location.hash || undefined,
      current_pathname: location.pathname,
      current_search: location.search || undefined,
      current_surface: surface,
    });
  }, [location.hash, location.pathname, location.search]);

  return null;
}

export function PostHogRootProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <PostHogIdentitySync />
      <PostHogPageTracker />
      {children}
    </PostHogProvider>
  );
}

export function useAnalytics() {
  const client = usePostHog();
  const location = useLocation();

  function capture(eventName: string, properties: AnalyticsProperties = {}) {
    if (!hasInitializedPostHog) {
      return;
    }

    client.capture(eventName, {
      current_hash: location.hash || undefined,
      current_pathname: location.pathname,
      current_search: location.search || undefined,
      current_surface: getSurface(location.pathname),
      ...properties,
    });
  }

  return { capture };
}
