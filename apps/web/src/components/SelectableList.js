import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function SelectableList({ items, selectedId, emptyLabel, onSelect }) {
    if (items.length === 0) {
        return _jsx("p", { className: "empty-state", children: emptyLabel });
    }
    return (_jsx("div", { className: "list", children: items.map((item) => (_jsxs("button", { className: `list__item ${selectedId === item.id ? "is-selected" : ""}`, onClick: () => onSelect(item.id), type: "button", children: [_jsx("strong", { children: item.title }), _jsx("span", { children: item.meta })] }, item.id))) }));
}
