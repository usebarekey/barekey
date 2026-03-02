import { SignedIn, SignedOut, useOrganizationList, useUser } from "@clerk/react-router";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { generateOrganizationSlugCandidateFromName } from "@/lib/slugs";

export function Page() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!isLoaded || isSubmitting || trimmedName.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let createdOrganization: { id: string; slug: string | null } | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          createdOrganization = await createOrganization({
            name: trimmedName,
            slug: generateOrganizationSlugCandidateFromName(trimmedName),
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
        throw lastError ?? new Error("Unable to create organization.");
      }

      await setActive({
        organization: createdOrganization.id,
      });

      void navigate(
        createdOrganization.slug ? `/o/${createdOrganization.slug}/overview` : "/o/select",
        { replace: true },
      );
    } catch (error: unknown) {
      setErrorMessage(getClerkErrorMessage(error, "Unable to create organization."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-start justify-center px-4 py-10">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Create organization</h1>
          <p className="text-sm text-muted-foreground">
            Create a new Barekey workspace. Slugs use a short 4-digit suffix (for example{" "}
            <span className="font-mono">myorganization4821</span>).
          </p>
        </div>

        <SignedOut>
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            Sign in first to create an organization.
          </div>
        </SignedOut>

        <SignedIn>
          <div className="rounded-xl border p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="org-name" className="text-sm font-medium">
                  Organization name
                </label>
                <Input
                  id="org-name"
                  placeholder={user?.fullName ? `${user.fullName}'s Organization` : "My Organization"}
                  value={name}
                  disabled={isSubmitting}
                  onChange={(event) => setName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreate();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The slug is generated from lowercase letters and numbers with a 4-digit suffix.
                </p>
              </div>

              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" render={<Link to="/o/select" />}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!isLoaded || isSubmitting || name.trim().length === 0}>
                  {isSubmitting ? "Creating..." : "Create organization"}
                </Button>
              </div>
            </div>
          </div>
        </SignedIn>

        <div className="text-xs text-muted-foreground">
          Need an existing workspace instead?{" "}
          <Link to="/o/select" className="underline underline-offset-4">
            Select organization
          </Link>
        </div>
      </div>
    </div>
  );
}
