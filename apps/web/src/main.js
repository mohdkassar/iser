import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { App } from "./pages/App";
import { RoomPage } from "./pages/RoomPage";
import { SyntheticTelemetryPage } from "./pages/SyntheticTelemetryPage";
import "./styles/global.css";
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(App, {}) }), _jsx(Route, { path: "/telemetry", element: _jsx(SyntheticTelemetryPage, {}) }), _jsx(Route, { path: "/sites/:siteId/rooms/:clusterId", element: _jsx(RoomPage, {}) })] }) }) }));
