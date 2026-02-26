import { Navigate, Route, Routes } from "react-router-dom";

import * as SSO from "@/pages/auth/sso/page";
import * as SSOCallback from "@/pages/auth/sso/callback/page";
import * as Auth from "@/pages/auth/layout";
import * as Home from "@/pages/home/page";
import * as Overview from "@/pages/@/user/overview/page";
import * as UserLayout from "@/pages/@/user/layout";
import * as Projects from "@/pages/@/user/projects/page";

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<Home.Page />} />
      <Route path="auth" element={<Auth.Layout />}>
        <Route path="sso" element={<SSO.Page />} />
        <Route path="sso/callback" element={<SSOCallback.Page />} />
      </Route>
      <Route path="@">
        <Route path=":userId" element={<UserLayout.Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="projects" element={<Projects.Page />} />
          <Route path="overview" element={<Overview.Page />} />
        </Route>
      </Route>
    </Routes>
  );
}
