import { Navigate, Route, Routes } from "react-router-dom";

import * as AuthSsoCallback from "@/pages/auth/sso/callback/page";
import * as AuthSso from "@/pages/auth/sso/page";
import * as CliDeviceVerify from "@/pages/cli/device/page";

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cli/device" replace />} />
      <Route path="/auth/sso" element={<AuthSso.Page />} />
      <Route path="/auth/sso/callback" element={<AuthSsoCallback.Page />} />
      <Route path="/cli/device" element={<CliDeviceVerify.Page />} />
    </Routes>
  );
}
