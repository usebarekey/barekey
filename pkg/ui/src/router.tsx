import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import * as SSO from "@/pages/auth/sso/page";
import * as SSOCallback from "@/pages/auth/sso/callback/page";
import * as Auth from "@/pages/auth/layout";
import * as CliDeviceVerify from "@/pages/cli/device/page";
import * as Home from "@/pages/home/page";
import * as Pricing from "@/pages/pricing/page";
import * as CreateNew from "@/pages/new/page";
import * as OrgSelect from "@/pages/o/select/page";
import * as OrgOverview from "@/pages/o/[org]/overview/page";
import * as OrgAudit from "@/pages/o/[org]/audit/page";
import * as OrgLayout from "@/pages/o/[org]/layout";
import * as OrgBilling from "@/pages/o/[org]/billing/page";
import * as OrgMembers from "@/pages/o/[org]/members/page";
import * as OrgProjects from "@/pages/o/[org]/projects/page";
import * as OrgProjectLayout from "@/pages/o/[org]/project/[projectSlug]/layout";
import * as OrgProjectSettings from "@/pages/o/[org]/project/[projectSlug]/settings/page";
import * as OrgProjectVariables from "@/pages/o/[org]/project/[projectSlug]/variables/page";
import * as OrgSettings from "@/pages/o/[org]/settings/page";
import * as UserLayout from "@/pages/u/user/layout";
import * as UserPage from "@/pages/u/user/page";

function UserSectionRedirect({ sectionId }: { sectionId: string }) {
  const { userSlug = "user" } = useParams();
  return <Navigate to={`/u/${userSlug}#${sectionId}`} replace />;
}

function HashScrollHandler() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash.length <= 1) {
      return;
    }

    const targetId = decodeURIComponent(hash.slice(1));
    let rafId: number | null = null;
    let attempts = 0;

    const scrollToTarget = () => {
      attempts += 1;
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({
          block: "start",
        });
        return;
      }

      if (attempts < 12) {
        rafId = window.requestAnimationFrame(scrollToTarget);
      }
    };

    rafId = window.requestAnimationFrame(scrollToTarget);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [pathname, hash]);

  return null;
}

export function Router() {
  return (
    <>
      <HashScrollHandler />
      <Routes>
        <Route path="/" element={<Home.Page />} />
        <Route path="pricing" element={<Pricing.Page />} />
        <Route path="new" element={<CreateNew.Page />} />
        <Route path="cli/device" element={<CliDeviceVerify.Page />} />
        <Route path="auth" element={<Auth.Layout />}>
          <Route path="sso" element={<SSO.Page />} />
          <Route path="sso/callback" element={<SSOCallback.Page />} />
        </Route>
        <Route path="o">
          <Route path="select" element={<OrgSelect.Page />} />
          <Route path="new" element={<Navigate to="/new?type=organization" replace />} />
          <Route path=":orgSlug" element={<OrgLayout.Layout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="members" element={<OrgMembers.Page />} />
            <Route path="projects" element={<OrgProjects.Page />} />
            <Route path="audit" element={<OrgAudit.Page />} />
            <Route path="billing" element={<OrgBilling.Page />} />
            <Route path="project/:projectSlug" element={<OrgProjectLayout.Layout />}>
              <Route index element={<Navigate to="variables" replace />} />
              <Route path="variables" element={<OrgProjectVariables.Page />} />
              <Route path="overview" element={<Navigate to="../variables" replace />} />
              <Route path="settings" element={<OrgProjectSettings.Page />} />
            </Route>
            <Route path="settings" element={<OrgSettings.Page />} />
            <Route path="overview" element={<OrgOverview.Page />} />
          </Route>
        </Route>
        <Route path="u">
          <Route path=":userSlug" element={<UserLayout.Layout />}>
            <Route index element={<UserPage.Page />} />
            <Route path="overview" element={<UserSectionRedirect sectionId="profile" />} />
            <Route path="profile" element={<UserSectionRedirect sectionId="profile" />} />
            <Route path="security" element={<UserSectionRedirect sectionId="linked-accounts" />} />
            <Route path="workspaces" element={<UserSectionRedirect sectionId="profile" />} />
            <Route path="activity" element={<UserSectionRedirect sectionId="profile" />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
