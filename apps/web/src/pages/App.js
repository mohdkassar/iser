import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClusterCard } from "../components/ClusterCard";
import { Panel } from "../components/Panel";
import { SelectableList } from "../components/SelectableList";
import { useAdminData } from "../hooks/useAdminData";
const clusterStatusOptions = ["all", "pending", "approved", "rejected"];
const clusterTypeOptions = ["all", "room", "device"];
export function App() {
    const { clients, clientDetail, siteDetail, selectedClientId, selectedSiteId, error, isPending, isExtractingMetadata, isRunningRoomClustering, metadataExtractionProgress, setSelectedClientId, setSelectedSiteId, extractMetadata, runRoomClustering, clearSiteClustersAndMetadata, updateCluster, mergeRoomClusters, } = useAdminData();
    const [clusterStatusFilter, setClusterStatusFilter] = useState("all");
    const [clusterTypeFilter, setClusterTypeFilter] = useState("all");
    const [expandedDatapointId, setExpandedDatapointId] = useState(null);
    const [metadataExtractionVersion, setMetadataExtractionVersion] = useState("v1");
    const [metadataBatchSize, setMetadataBatchSize] = useState(5);
    const [datapointSearch, setDatapointSearch] = useState("");
    const [roomClusteringThreshold, setRoomClusteringThreshold] = useState(0.5);
    const [draggingClusterId, setDraggingClusterId] = useState(null);
    const filteredDatapoints = useMemo(() => {
        const datapoints = siteDetail?.datapoints ?? [];
        const query = datapointSearch.trim().toLowerCase();
        if (!query) {
            return datapoints;
        }
        return datapoints.filter((datapoint) => {
            const searchableText = [
                datapoint.rawName,
                datapoint.identifier,
                datapoint.manufacturer,
                datapoint.metadata?.humanReadableName,
                datapoint.metadata?.roomCandidate,
                datapoint.metadata?.roomAliases.join(" "),
                datapoint.metadata?.equipmentGroup,
                datapoint.metadata?.deviceInstance,
                datapoint.metadata?.deviceType,
                datapoint.metadata?.subzone,
                datapoint.metadataExtraction?.version,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [datapointSearch, siteDetail?.datapoints]);
    const filteredClusters = useMemo(() => {
        const clusters = siteDetail?.clusters ?? [];
        return clusters.filter((cluster) => {
            const statusMatches = clusterStatusFilter === "all" || cluster.status === clusterStatusFilter;
            const typeMatches = clusterTypeFilter === "all" || cluster.type === clusterTypeFilter;
            return statusMatches && typeMatches;
        });
    }, [clusterStatusFilter, clusterTypeFilter, siteDetail?.clusters]);
    return (_jsxs("main", { className: "app-shell", children: [_jsxs("section", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "hero__eyebrow", children: "ISER Admin" }), _jsx("h1", { children: "Cluster industrial IoT datapoints into rooms and logical devices." }), _jsx("p", { className: "hero__copy", children: "Start with the client, drill into a site, inspect datapoints, then run and moderate the generated clusters." })] }), _jsxs("div", { className: "hero__status", children: [_jsx("span", { className: "status-pill", children: isPending ? "Loading" : "Ready" }), _jsx(Link, { className: "secondary-button", to: "/telemetry", children: "Synthetic telemetry" }), error ? _jsx("span", { className: "status-pill status-pill--error", children: error }) : null] })] }), _jsxs("section", { className: "dashboard-grid", children: [_jsx(Panel, { title: "Clients", subtitle: `${clients.length} available`, children: _jsx(SelectableList, { items: clients.map((client) => ({
                                id: client.id,
                                title: client.name,
                                meta: `${client.siteCount} sites`,
                            })), selectedId: selectedClientId, emptyLabel: "No clients found.", onSelect: setSelectedClientId }) }), _jsx(Panel, { title: "Sites", subtitle: clientDetail ? `${clientDetail.name}` : "Select a client", action: selectedSiteId ? (_jsx("div", { className: "panel-actions", children: _jsx("button", { className: "secondary-button", type: "button", onClick: () => void clearSiteClustersAndMetadata(), children: "Clear clusters and metadata" }) })) : null, children: _jsx(SelectableList, { items: clientDetail?.sites.map((site) => ({
                                id: site.id,
                                title: site.name,
                                meta: `${site.datapointCount} datapoints • ${site.clusterCount} clusters`,
                            })) ?? [], selectedId: selectedSiteId, emptyLabel: "Select a client to load sites.", onSelect: setSelectedSiteId }) }), _jsxs(Panel, { title: "Datapoints", subtitle: siteDetail
                            ? `${filteredDatapoints.length} of ${siteDetail.datapoints.length} shown`
                            : "Select a site", children: [_jsxs("div", { className: "datapoint-toolbar", children: [_jsxs("div", { className: "datapoint-actions", children: [_jsxs("label", { className: "extract-config", children: [_jsx("span", { children: "Mode" }), _jsxs("select", { value: metadataExtractionVersion, onChange: (event) => setMetadataExtractionVersion(event.target.value), disabled: isExtractingMetadata || !siteDetail, children: [_jsx("option", { value: "v1", children: "V1 single" }), _jsx("option", { value: "v2", children: "V2 grouped" }), _jsx("option", { value: "v3", children: "V3 room only" })] })] }), _jsxs("label", { className: `extract-config ${metadataExtractionVersion === "v1" ? "is-disabled" : ""}`, children: [_jsx("span", { children: "Batch size" }), _jsx("input", { type: "number", min: 1, value: metadataBatchSize, onChange: (event) => setMetadataBatchSize(Math.max(1, Number.parseInt(event.target.value || "1", 10))), disabled: isExtractingMetadata || metadataExtractionVersion === "v1" || !siteDetail })] }), _jsxs("div", { className: "extract-action", children: [_jsx("button", { className: "secondary-button", type: "button", onClick: () => void extractMetadata(metadataExtractionVersion, metadataBatchSize), disabled: isExtractingMetadata || !siteDetail, children: isExtractingMetadata
                                                            ? `Extracting ${metadataExtractionProgress}%`
                                                            : "Extract metadata" }), isExtractingMetadata ? (_jsx("div", { className: "progress-track", "aria-hidden": "true", children: _jsx("div", { className: "progress-bar", style: { width: `${metadataExtractionProgress}%` } }) })) : null] })] }), _jsxs("label", { className: "search-control datapoint-search", children: [_jsx("span", { children: "Search datapoints" }), _jsx("input", { type: "search", value: datapointSearch, onChange: (event) => setDatapointSearch(event.target.value), placeholder: "Raw name, identifier, metadata...", disabled: !siteDetail })] })] }), _jsxs("div", { className: "datapoint-list", children: [filteredDatapoints.map((datapoint) => (_jsxs("button", { type: "button", className: `datapoint-card ${expandedDatapointId === datapoint.id ? "is-expanded" : ""}`, onClick: () => setExpandedDatapointId((current) => (current === datapoint.id ? null : datapoint.id)), children: [_jsxs("div", { className: "datapoint-card__summary", children: [_jsxs("div", { className: "datapoint-card__primary", children: [_jsx("strong", { children: datapoint.metadata?.humanReadableName ?? datapoint.rawName }), _jsx("span", { children: datapoint.rawName }), _jsx("span", { children: datapoint.identifier }), _jsx("small", { children: datapoint.manufacturer })] }), _jsx("div", { className: "datapoint-card__preview", children: datapoint.metadata ? (_jsxs("p", { children: [datapoint.metadata.roomCandidate, " \u2022 ", datapoint.metadata.deviceInstance ?? "room only", " \u2022", " ", datapoint.metadata.deviceType ?? "room only"] })) : (_jsx("p", { children: "No extracted metadata yet." })) })] }), expandedDatapointId === datapoint.id && datapoint.metadata ? (_jsxs("dl", { className: "metadata-grid", children: [_jsxs("div", { children: [_jsx("dt", { children: "Room candidate" }), _jsx("dd", { children: datapoint.metadata.roomCandidate })] }), _jsxs("div", { children: [_jsx("dt", { children: "Room aliases" }), _jsx("dd", { children: datapoint.metadata.roomAliases.join(", ") || "None" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Equipment group" }), _jsx("dd", { children: datapoint.metadata.equipmentGroup ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Device instance" }), _jsx("dd", { children: datapoint.metadata.deviceInstance ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Device type" }), _jsx("dd", { children: datapoint.metadata.deviceType ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Subzone" }), _jsx("dd", { children: datapoint.metadata.subzone ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Confidence" }), _jsx("dd", { children: datapoint.metadata.confidence })] }), _jsxs("div", { children: [_jsx("dt", { children: "Extraction version" }), _jsx("dd", { children: datapoint.metadataExtraction?.version ?? "unknown" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Batch size" }), _jsx("dd", { children: datapoint.metadataExtraction?.batchSize ?? "unknown" })] })] })) : null] }, datapoint.id))), siteDetail && filteredDatapoints.length === 0 ? (_jsx("p", { className: "empty-state", children: "No datapoints match the current search." })) : null, !siteDetail ? _jsx("p", { className: "empty-state", children: "Select a site to inspect datapoints." }) : null] })] }), _jsxs(Panel, { title: "Clusters", subtitle: siteDetail ? `${filteredClusters.length} of ${siteDetail.clusters.length} shown` : "No site selected", action: selectedSiteId ? (_jsxs("div", { className: "cluster-action", children: [_jsxs("label", { className: "threshold-control", children: [_jsx("span", { children: "Threshold" }), _jsx("input", { type: "number", min: 0, max: 1, step: 0.05, value: roomClusteringThreshold, onChange: (event) => setRoomClusteringThreshold(Math.min(1, Math.max(0, Number.parseFloat(event.target.value || "0")))), disabled: isRunningRoomClustering })] }), _jsx("button", { className: "primary-button panel-action-button", type: "button", onClick: () => void runRoomClustering(roomClusteringThreshold), disabled: isRunningRoomClustering, children: isRunningRoomClustering ? "Clustering rooms..." : "Run room clustering" })] })) : null, children: [_jsxs("div", { className: "cluster-toolbar", children: [_jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Status" }), _jsx("select", { value: clusterStatusFilter, onChange: (event) => setClusterStatusFilter(event.target.value), children: clusterStatusOptions.map((status) => (_jsx("option", { value: status, children: status }, status))) })] }), _jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Type" }), _jsx("select", { value: clusterTypeFilter, onChange: (event) => setClusterTypeFilter(event.target.value), children: clusterTypeOptions.map((type) => (_jsx("option", { value: type, children: type }, type))) })] })] }), _jsxs("div", { className: "cluster-grid", children: [filteredClusters.map((cluster) => (_jsx(ClusterCard, { cluster: cluster, datapoints: siteDetail?.datapoints.filter((datapoint) => cluster.datapointIds.includes(datapoint.id)) ?? [], onApprove: () => updateCluster(cluster.id, "approved"), onReject: () => updateCluster(cluster.id, "rejected"), onRename: (label) => updateCluster(cluster.id, undefined, label), onMerge: mergeRoomClusters, draggingClusterId: draggingClusterId, onDragStart: setDraggingClusterId, onDragEnd: () => setDraggingClusterId(null) }, cluster.id))), siteDetail && filteredClusters.length === 0 ? (_jsx("p", { className: "empty-state", children: "No clusters match the current filters." })) : null, !siteDetail ? (_jsx("p", { className: "empty-state", children: "Run room clustering to generate clusters." })) : null] })] })] })] }));
}
