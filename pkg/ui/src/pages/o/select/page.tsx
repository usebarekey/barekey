import { useAuth, useOrganizationList, useUser } from "@clerk/react-router";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { useEnsureCurrentUserRecord } from "@/hooks/use-ensure-current-user-record";
import { Spinner } from "@/components/ui/spinner";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { useAnalytics } from "@/lib/posthog";
import { generateDefaultOrgName, generateDefaultOrgSlugCandidate } from "@/lib/slugs";

function WorkspaceRedirectSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Spinner className="size-8" />
    </div>
  );
}

export function Page() {
  const { isLoaded: isAuthLoaded, isSignedIn, orgSlug } = useAuth();
  const { capture } = useAnalytics();
  const { user } = useUser();
  const {
    isLoaded: isOrgListLoaded,
    createOrganization,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: true,
  });
  const [isCreatingDefaultOrg, setIsCreatingDefaultOrg] = useState(false);
  const [isResolvingOrg, setIsResolvingOrg] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const hasAttemptedAutoCreateRef = useRef(false);
  const hasAttemptedAutoSelectRef = useRef<string | null>(null);

  useEnsureCurrentUserRecord();

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter(
    (membership) =>
      typeof membership.organization.slug === "string" && membership.organization.slug.length > 0,
  );
  const activeMembership =
    orgSlug === null
      ? null
      : (selectableMemberships.find((membership) => membership.organization.slug === orgSlug) ??
        null);
  const fallbackMembership = selectableMemberships[0] ?? null;

  async function handleCreateDefaultOrg() {
    if (!isOrgListLoaded || !isSignedIn || user == null) {
      return;
    }

    setIsCreatingDefaultOrg(true);
    setResolveError(null);
    capture("default_org_creation_submitted");

    const email =
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    const fullName = user.fullName ?? user.username ?? user.firstName ?? null;
    const orgName = generateDefaultOrgName({
      email,
      fullName,
    });

    try {
      let createdOrganization: { id: string; slug: string | null } | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          createdOrganization = await createOrganization({
            name: orgName,
            slug: generateDefaultOrgSlugCandidate({
              email,
              fullName,
            }),
          });
          break;
        } catch (error: unknown) {
          if (!isClerkIdentifierExistsError(error)) {
            throw error;
          }

          lastError = error;
        }
      }

      if (createdOrganization === null) {
        throw lastError ?? new Error("Unable to create default organization.");
      }

      await setActive({
        organization: createdOrganization.id,
      });
      capture("default_org_creation_succeeded");
    } catch (error: unknown) {
      setResolveError(getClerkErrorMessage(error, "Unable to create default organization."));
      capture("default_org_creation_failed");
    } finally {
      setIsCreatingDefaultOrg(false);
    }
  }

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !isOrgListLoaded || user == null) {
      return;
    }

    if (activeMembership) {
      return;
    }

    if (fallbackMembership) {
      if (
        isResolvingOrg ||
        hasAttemptedAutoSelectRef.current === fallbackMembership.organization.id
      ) {
        return;
      }

      hasAttemptedAutoSelectRef.current = fallbackMembership.organization.id;
      setIsResolvingOrg(true);
      setResolveError(null);

      void setActive({
        organization: fallbackMembership.organization.id,
      })
        .then(() => {
          capture("workspace_auto_selected", {
            orgId: fallbackMembership.organization.id,
            orgSlug: fallbackMembership.organization.slug,
          });
        })
        .catch((error: unknown) => {
          setResolveError(getClerkErrorMessage(error, "Unable to open your workspace."));
          hasAttemptedAutoSelectRef.current = null;
        })
        .finally(() => {
          setIsResolvingOrg(false);
        });
      return;
    }

    if (isCreatingDefaultOrg || hasAttemptedAutoCreateRef.current) {
      return;
    }

    hasAttemptedAutoCreateRef.current = true;
    void handleCreateDefaultOrg();
  }, [
    activeMembership,
    capture,
    fallbackMembership,
    isAuthLoaded,
    isCreatingDefaultOrg,
    isOrgListLoaded,
    isResolvingOrg,
    isSignedIn,
    setActive,
    user,
  ]);

  if (isAuthLoaded && !isSignedIn) {
    return <Navigate to="/auth/sso" replace />;
  }

  if (activeMembership?.organization.slug) {
    return <Navigate to={`/o/${activeMembership.organization.slug}/overview`} replace />;
  }

  if (
    !isAuthLoaded ||
    !isOrgListLoaded ||
    isCreatingDefaultOrg ||
    isResolvingOrg ||
    (!resolveError && isSignedIn && (fallbackMembership !== null || memberships.length === 0))
  ) {
    return <WorkspaceRedirectSpinner />;
  }

  return <WorkspaceRedirectSpinner />;
}
