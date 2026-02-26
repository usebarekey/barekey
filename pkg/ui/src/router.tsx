import { Navigate, Route, Routes } from "react-router-dom";

import * as SSO from "@/pages/auth/sso/page";
import * as SSOCallback from "@/pages/auth/sso/callback/page";
import * as Auth from "@/pages/auth/layout";
import * as Home from "@/pages/home/page";
import * as OrgNew from "@/pages/o/new/page";
import * as OrgSelect from "@/pages/o/select/page";
import * as OrgOverview from "@/pages/o/[org]/overview/page";
import * as OrgLayout from "@/pages/o/[org]/layout";
import * as OrgMembers from "@/pages/o/[org]/members/page";
import * as OrgProjects from "@/pages/o/[org]/projects/page";
import * as OrgSettings from "@/pages/o/[org]/settings/page";

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<Home.Page />} />
      <Route path="auth" element={<Auth.Layout />}>
        <Route path="sso" element={<SSO.Page />} />
        <Route path="sso/callback" element={<SSOCallback.Page />} />
      </Route>
      <Route path="o">
        <Route path="select" element={<OrgSelect.Page />} />
        <Route path="new" element={<OrgNew.Page />} />
        <Route path=":orgSlug" element={<OrgLayout.Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="members" element={<OrgMembers.Page />} />
          <Route path="projects" element={<OrgProjects.Page />} />
          <Route path="settings" element={<OrgSettings.Page />} />
          <Route path="overview" element={<OrgOverview.Page />} />
        </Route>
      </Route>
    </Routes>
  );
}
