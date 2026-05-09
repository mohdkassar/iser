import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
export function ClusterCard({ cluster, datapoints, onApprove, onReject, onRename, onMerge, draggingClusterId, onDragStart, onDragEnd, }) {
    const [draftLabel, setDraftLabel] = useState(cluster.label);
    const [isExpanded, setIsExpanded] = useState(false);
    const hideActions = cluster.type === "room" && cluster.status === "approved";
    const canMerge = cluster.type === "room" && cluster.status === "pending";
    const isDragging = draggingClusterId === cluster.id;
    const isDropTarget = canMerge && draggingClusterId !== null && draggingClusterId !== cluster.id;
    const aliases = Array.isArray(cluster.metadata.aliases)
        ? cluster.metadata.aliases.filter((alias) => typeof alias === "string")
        : [];
    function handleDragStart(event) {
        if (!canMerge) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", cluster.id);
        onDragStart(cluster.id);
    }
    function handleDragOver(event) {
        if (!isDropTarget) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }
    async function handleDrop(event) {
        if (!isDropTarget) {
            return;
        }
        event.preventDefault();
        const sourceClusterId = event.dataTransfer.getData("text/plain") || draggingClusterId;
        if (!sourceClusterId || sourceClusterId === cluster.id) {
            onDragEnd();
            return;
        }
        await onMerge(sourceClusterId, cluster.id);
        onDragEnd();
    }
    return (_jsxs("article", { className: [
            "cluster-card",
            isExpanded ? "is-expanded" : "",
            isDragging ? "is-dragging" : "",
            isDropTarget ? "is-drop-target" : "",
        ]
            .filter(Boolean)
            .join(" "), draggable: canMerge, onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: (event) => void handleDrop(event), onDragEnd: onDragEnd, children: [_jsxs("button", { type: "button", className: "cluster-card__toggle", onClick: () => setIsExpanded((current) => !current), children: [_jsxs("div", { className: "cluster-card__header", children: [_jsx("span", { className: `badge badge--${cluster.status}`, children: cluster.status }), _jsx("span", { className: "badge badge--type", children: cluster.type })] }), _jsx("strong", { children: cluster.label }), _jsxs("p", { children: [cluster.datapointCount, " datapoints"] }), _jsxs("small", { children: ["Updated ", new Date(cluster.updatedAt).toLocaleString()] })] }), hideActions ? null : (_jsx("div", { className: "cluster-card__editor", children: _jsx("input", { value: draftLabel, onChange: (event) => setDraftLabel(event.target.value), onClick: (event) => event.stopPropagation() }) })), isExpanded ? (_jsxs("div", { className: "cluster-details", children: [_jsxs("div", { className: "cluster-details__section", children: [_jsx("h3", { children: "Aliases" }), aliases.length > 0 ? (_jsx("div", { className: "alias-chips", children: aliases.map((alias) => (_jsx("span", { className: "alias-chip", children: alias }, alias))) })) : (_jsx("p", { children: "No aliases stored for this cluster." }))] }), _jsxs("div", { className: "cluster-details__section", children: [_jsx("h3", { children: "Datapoints" }), _jsx("div", { className: "cluster-datapoints", children: datapoints.map((datapoint) => (_jsxs("div", { className: "cluster-datapoint", children: [_jsx("strong", { children: datapoint.rawName }), _jsx("span", { children: datapoint.identifier })] }, datapoint.id))) })] })] })) : null, hideActions ? null : (_jsxs("div", { className: "cluster-card__actions", children: [_jsx("button", { type: "button", onClick: () => void onApprove(), children: "Approve" }), _jsx("button", { type: "button", onClick: () => void onReject(), children: "Reject" }), _jsx("button", { type: "button", onClick: () => void onRename(draftLabel), children: "Update" })] })), cluster.type === "room" ? (_jsx(Link, { to: `/sites/${cluster.siteId}/rooms/${cluster.id}`, className: "cluster-card__view-link", onClick: (event) => event.stopPropagation(), children: "View details" })) : null] }));
}
