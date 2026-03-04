import { Button } from "@/components/ui/button";
import { useEnsureCurrentUserRecord } from "@/hooks/use-ensure-current-user-record";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { generateDefaultOrgName, generateDefaultOrgSlugCandidate } from "@/lib/slugs";
import {
  OrganizationList,
  SignedIn,
  SignedOut,
  useAuth,
  useOrganizationList,
  useUser,
} from "@clerk/react-router";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";

export function Page() {
  const { isLoaded: isAuthLoaded, isSignedIn, orgSlug } = useAuth();
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
  const [createError, setCreateError] = useState<string | null>(null);
  const hasAttemptedAutoCreateRef = useRef(false);
  useEnsureCurrentUserRecord();

  const memberships = userMemberships.data ?? [];
  const hasMemberships = memberships.length > 0;
  const hasActiveOrgMembership =
    orgSlug !== null &&
    memberships.some((membership) => membership.organization.slug === orgSlug);

  async function handleCreateDefaultOrg() {
    if (!isOrgListLoaded || !isSignedIn || user == null) {
      return;
    }

    setIsCreatingDefaultOrg(true);
    setCreateError(null);

    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
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
    } catch (error: unknown) {
      setCreateError(getClerkErrorMessage(error, "Unable to create default organization."));
    } finally {
      setIsCreatingDefaultOrg(false);
    }
  }

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !isOrgListLoaded || user == null) {
      return;
    }

    if (orgSlug) {
      return;
    }

    if (hasMemberships || isCreatingDefaultOrg) {
      return;
    }

    if (hasAttemptedAutoCreateRef.current) {
      return;
    }

    hasAttemptedAutoCreateRef.current = true;
    void handleCreateDefaultOrg();
  }, [hasMemberships, isAuthLoaded, isCreatingDefaultOrg, isOrgListLoaded, isSignedIn, orgSlug, user]);

  if (isAuthLoaded && isSignedIn && isOrgListLoaded && orgSlug && hasActiveOrgMembership) {
    return <Navigate to={`/o/${orgSlug}/overview`} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-start justify-center px-4 py-10">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Select an organization to enter its workspace or create a new one.
          </p>
        </div>

        <SignedOut>
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            Sign in first to manage organizations.
          </div>
        </SignedOut>

        <SignedIn>
          <div className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Default organization bootstrap</p>
                <p className="text-sm text-muted-foreground">
                  Creates a workspace slug like <span className="font-mono">johndoeorg-5831</span>.
                </p>
              </div>
              <Button
                onClick={handleCreateDefaultOrg}
                disabled={!isOrgListLoaded || isCreatingDefaultOrg}
              >
                {isCreatingDefaultOrg ? "Creating..." : "Create default org"}
              </Button>
            </div>
            {hasMemberships ? (
              <p className="mt-3 text-xs text-muted-foreground">
                You already belong to {memberships.length} organization{memberships.length === 1 ? "" : "s"}.
              </p>
            ) : null}
            {createError ? <p className="mt-3 text-sm text-destructive">{createError}</p> : null}
          </div>

          <div className="rounded-xl border p-4">
            <OrganizationList
              hidePersonal={true}
              afterCreateOrganizationUrl={(organization) =>
                organization.slug ? `/o/${organization.slug}/overview` : "/o/select"
              }
              afterSelectOrganizationUrl={(organization) =>
                organization.slug ? `/o/${organization.slug}/overview` : "/o/select"
              }
            />
          </div>
        </SignedIn>

        <div className="text-xs text-muted-foreground">
          Barekey workspaces live under <span className="font-mono">/o/:orgSlug</span>. User
          account pages live under <span className="font-mono">/u/:userSlug</span>.{" "}
          <Link to="/" className="underline underline-offset-4">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
