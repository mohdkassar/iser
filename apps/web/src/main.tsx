import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { App } from "./pages/App";
import { RoomPage } from "./pages/RoomPage";
import { SyntheticTelemetryPage } from "./pages/SyntheticTelemetryPage";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/telemetry" element={<SyntheticTelemetryPage />} />
        <Route path="/sites/:siteId/rooms/:clusterId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
