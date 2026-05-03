import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Panel({ title, subtitle, action, children }) {
    return (_jsxs("section", { className: "panel", children: [_jsxs("header", { className: "panel__header", children: [_jsxs("div", { children: [_jsx("p", { className: "panel__eyebrow", children: subtitle ?? "Overview" }), _jsx("h2", { children: title })] }), action] }), _jsx("div", { className: "panel__content", children: children })] }));
}
