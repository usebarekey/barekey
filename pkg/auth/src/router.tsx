import { Navigate, Route, Routes } from "react-router-dom";

import * as CliDeviceVerify from "@/pages/cli/device/page";

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cli/device" replace />} />
      <Route path="/cli/device" element={<CliDeviceVerify.Page />} />
    </Routes>
  );
}
