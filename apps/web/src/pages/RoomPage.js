import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { adminApi } from "../api/admin";
export function RoomPage() {
    const { siteId, clusterId } = useParams();
    const [siteDetail, setSiteDetail] = useState(null);
    const [error, setError] = useState(null);
    const [isPending, setIsPending] = useState(true);
    const [roomMessages, setRoomMessages] = useState([
        {
            id: "welcome",
            role: "assistant",
            content: "Ask me about this room, its datapoints, or the telemetry patterns I can inspect through Mongo-backed tools.",
        },
    ]);
    const [roomQuestion, setRoomQuestion] = useState("");
    const [roomAgentError, setRoomAgentError] = useState(null);
    const [isAskingAgent, setIsAskingAgent] = useState(false);
    const [roomAgentUsage, setRoomAgentUsage] = useState(null);
    useEffect(() => {
        if (!siteId)
            return;
        setIsPending(true);
        setError(null);
        adminApi
            .getSite(siteId)
            .then(setSiteDetail)
            .catch(() => setError("Failed to load site data."))
            .finally(() => setIsPending(false));
    }, [siteId]);
    const cluster = siteDetail?.clusters.find((c) => c.id === clusterId);
    const datapoints = cluster
        ? siteDetail?.datapoints.filter((dp) => cluster.datapointIds.includes(dp.id)) ?? []
        : [];
    const aliases = cluster
        ? (Array.isArray(cluster.metadata.aliases)
            ? cluster.metadata.aliases.filter((alias) => typeof alias === "string")
            : [])
        : [];
    const [search, setSearch] = useState("");
    const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
    const [subzoneFilter, setSubzoneFilter] = useState("all");
    const [equipmentGroupFilter, setEquipmentGroupFilter] = useState("all");
    const [deviceInstanceFilter, setDeviceInstanceFilter] = useState("all");
    const [expandedDatapointIds, setExpandedDatapointIds] = useState([]);
    const filterOptions = useMemo(() => {
        const deviceTypes = new Set();
        const subzones = new Set();
        const equipmentGroups = new Set();
        const deviceInstances = new Set();
        for (const dp of datapoints) {
            if (dp.metadata?.deviceType)
                deviceTypes.add(dp.metadata.deviceType);
            if (dp.metadata?.subzone)
                subzones.add(dp.metadata.subzone);
            if (dp.metadata?.equipmentGroup)
                equipmentGroups.add(dp.metadata.equipmentGroup);
            if (dp.metadata?.deviceInstance)
                deviceInstances.add(dp.metadata.deviceInstance);
        }
        return {
            deviceTypes: [...deviceTypes].sort(),
            subzones: [...subzones].sort(),
            equipmentGroups: [...equipmentGroups].sort(),
            deviceInstances: [...deviceInstances].sort(),
        };
    }, [datapoints]);
    const filteredDatapoints = useMemo(() => {
        const query = search.trim().toLowerCase();
        return datapoints.filter((dp) => {
            if (query) {
                const searchable = [
                    dp.rawName,
                    dp.identifier,
                    dp.manufacturer,
                    dp.metadata?.humanReadableName,
                    dp.metadata?.roomCandidate,
                    dp.metadata?.equipmentGroup,
                    dp.metadata?.deviceInstance,
                    dp.metadata?.deviceType,
                    dp.metadata?.subzone,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!searchable.includes(query))
                    return false;
            }
            if (deviceTypeFilter !== "all" && dp.metadata?.deviceType !== deviceTypeFilter)
                return false;
            if (subzoneFilter !== "all" && dp.metadata?.subzone !== subzoneFilter)
                return false;
            if (equipmentGroupFilter !== "all" && dp.metadata?.equipmentGroup !== equipmentGroupFilter)
                return false;
            if (deviceInstanceFilter !== "all" && dp.metadata?.deviceInstance !== deviceInstanceFilter)
                return false;
            return true;
        });
    }, [datapoints, search, deviceTypeFilter, subzoneFilter, equipmentGroupFilter, deviceInstanceFilter]);
    function toggleDatapointDetails(datapointId) {
        setExpandedDatapointIds((current) => current.includes(datapointId)
            ? current.filter((id) => id !== datapointId)
            : [...current, datapointId]);
    }
    async function askRoomAgent() {
        if (!siteId || !clusterId)
            return;
        const prompt = roomQuestion.trim();
        if (!prompt)
            return;
        const nextMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: prompt,
        };
        const nextMessages = [...roomMessages, nextMessage];
        setRoomMessages(nextMessages);
        setRoomQuestion("");
        setRoomAgentError(null);
        setIsAskingAgent(true);
        try {
            const result = await adminApi.askRoomAgent(siteId, clusterId, {
                messages: nextMessages.map(({ role, content }) => ({ role, content })),
            });
            setRoomMessages((current) => [
                ...current,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: result.answer,
                },
            ]);
            setRoomAgentUsage({
                totalTokens: result.usage.totalTokens,
                toolCallsUsed: result.toolCallsUsed,
            });
        }
        catch (roomAgentRequestError) {
            setRoomAgentError(roomAgentRequestError instanceof Error
                ? roomAgentRequestError.message
                : "Failed to ask the room agent.");
            setRoomMessages((current) => current.slice(0, -1));
        }
        finally {
            setIsAskingAgent(false);
        }
    }
    if (isPending) {
        return (_jsx("main", { className: "app-shell", children: _jsx("p", { className: "empty-state", children: "Loading room details..." }) }));
    }
    if (error || !cluster) {
        return (_jsxs("main", { className: "app-shell", children: [_jsx("div", { className: "room-page__back", children: _jsx(Link, { to: "/", className: "secondary-button", children: "Back to dashboard" }) }), _jsx("p", { className: "empty-state", children: error ?? "Room not found." })] }));
    }
    return (_jsxs("main", { className: "app-shell", children: [_jsx("div", { className: "room-page__back", children: _jsx(Link, { to: "/", className: "secondary-button", children: "Back to dashboard" }) }), _jsxs("section", { className: "room-page__header", children: [_jsxs("div", { className: "room-page__header-main", children: [_jsx("p", { className: "hero__eyebrow", children: "Room Details" }), _jsx("h1", { children: cluster.label }), _jsxs("div", { className: "room-page__badges", children: [_jsx("span", { className: `badge badge--${cluster.status}`, children: cluster.status }), _jsx("span", { className: "badge badge--type", children: cluster.type })] })] }), _jsxs("div", { className: "room-page__header-details", children: [_jsxs("div", { className: "room-page__header-stat", children: [_jsx("span", { children: "Datapoints" }), _jsx("strong", { children: cluster.datapointCount })] }), _jsxs("div", { className: "room-page__header-stat", children: [_jsx("span", { children: "Updated" }), _jsx("strong", { children: new Date(cluster.updatedAt).toLocaleString() })] }), _jsxs("div", { className: "room-page__aliases", children: [_jsx("span", { className: "room-page__aliases-label", children: "Aliases" }), aliases.length > 0 ? (_jsx("div", { className: "alias-chips", children: aliases.map((alias) => (_jsx("span", { className: "alias-chip", children: alias }, alias))) })) : (_jsx("p", { className: "empty-state", children: "No aliases stored for this room." }))] })] })] }), _jsxs("section", { className: "room-page__content", children: [_jsxs("div", { className: "panel room-page__panel--agent", children: [_jsxs("div", { className: "panel__header", children: [_jsxs("div", { children: [_jsx("p", { className: "panel__eyebrow", children: "Room Agent" }), _jsx("h2", { children: "Ask questions about this room" })] }), roomAgentUsage ? (_jsxs("small", { className: "room-agent__usage", children: [roomAgentUsage.totalTokens, " tokens, ", roomAgentUsage.toolCallsUsed, " tool calls"] })) : null] }), _jsx("div", { className: "room-agent__messages", children: roomMessages.map((message) => (_jsxs("div", { className: `room-agent__message room-agent__message--${message.role}`, children: [_jsx("span", { className: "room-agent__role", children: message.role === "user" ? "You" : "Agent" }), _jsx("p", { children: message.content })] }, message.id))) }), _jsxs("form", { className: "room-agent__composer", onSubmit: (event) => {
                                    event.preventDefault();
                                    void askRoomAgent();
                                }, children: [_jsxs("label", { className: "room-agent__field", children: [_jsx("span", { children: "Question" }), _jsx("textarea", { value: roomQuestion, onChange: (event) => setRoomQuestion(event.target.value), placeholder: "What telemetry looks suspicious in this room?", rows: 5, disabled: !siteDetail || isAskingAgent })] }), _jsxs("div", { className: "room-agent__actions", children: [_jsx("button", { className: "primary-button", type: "submit", disabled: !siteDetail || isAskingAgent || roomQuestion.trim().length === 0, children: isAskingAgent ? "Asking..." : "Ask agent" }), _jsx("button", { className: "secondary-button", type: "button", onClick: () => setRoomMessages((current) => current.slice(0, 1)), disabled: isAskingAgent, children: "Clear chat" })] }), roomAgentError ? _jsx("p", { className: "status-pill status-pill--error", children: roomAgentError }) : null] })] }), _jsxs("div", { className: "panel room-page__panel--datapoints", children: [_jsx("div", { className: "panel__header", children: _jsxs("div", { children: [_jsx("p", { className: "panel__eyebrow", children: "Datapoints" }), _jsxs("h2", { children: [filteredDatapoints.length, " of ", datapoints.length, " datapoints"] })] }) }), _jsxs("div", { className: "room-page__toolbar", children: [_jsxs("label", { className: "search-control room-page__search", children: [_jsx("span", { children: "Search" }), _jsx("input", { type: "search", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Raw name, identifier, metadata..." })] }), _jsxs("div", { className: "room-page__filters", children: [_jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Device type" }), _jsxs("select", { value: deviceTypeFilter, onChange: (e) => setDeviceTypeFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), filterOptions.deviceTypes.map((v) => (_jsx("option", { value: v, children: v }, v)))] })] }), _jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Subzone" }), _jsxs("select", { value: subzoneFilter, onChange: (e) => setSubzoneFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), filterOptions.subzones.map((v) => (_jsx("option", { value: v, children: v }, v)))] })] }), _jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Equipment group" }), _jsxs("select", { value: equipmentGroupFilter, onChange: (e) => setEquipmentGroupFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), filterOptions.equipmentGroups.map((v) => (_jsx("option", { value: v, children: v }, v)))] })] }), _jsxs("label", { className: "filter-control", children: [_jsx("span", { children: "Device instance" }), _jsxs("select", { value: deviceInstanceFilter, onChange: (e) => setDeviceInstanceFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), filterOptions.deviceInstances.map((v) => (_jsx("option", { value: v, children: v }, v)))] })] })] })] }), _jsxs("div", { className: "room-page__datapoints", children: [filteredDatapoints.map((dp) => (_jsxs("div", { className: `room-page__datapoint${expandedDatapointIds.includes(dp.id) ? " is-expanded" : ""}`, children: [_jsxs("button", { type: "button", className: "room-page__datapoint-toggle", onClick: () => toggleDatapointDetails(dp.id), children: [_jsxs("div", { className: "room-page__datapoint-header", children: [_jsx("strong", { children: dp.metadata?.humanReadableName ?? dp.rawName }), _jsx("span", { children: dp.rawName }), _jsx("span", { children: dp.identifier }), _jsx("small", { children: dp.manufacturer })] }), _jsx("span", { className: "room-page__datapoint-chevron", children: expandedDatapointIds.includes(dp.id) ? "Collapse" : "Expand" })] }), expandedDatapointIds.includes(dp.id) ? (dp.metadata ? (_jsxs("dl", { className: "metadata-grid", children: [_jsxs("div", { children: [_jsx("dt", { children: "Room candidate" }), _jsx("dd", { children: dp.metadata.roomCandidate })] }), _jsxs("div", { children: [_jsx("dt", { children: "Room aliases" }), _jsx("dd", { children: dp.metadata.roomAliases.join(", ") || "None" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Equipment group" }), _jsx("dd", { children: dp.metadata.equipmentGroup ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Device instance" }), _jsx("dd", { children: dp.metadata.deviceInstance ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Device type" }), _jsx("dd", { children: dp.metadata.deviceType ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Subzone" }), _jsx("dd", { children: dp.metadata.subzone ?? "Not extracted" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Confidence" }), _jsx("dd", { children: dp.metadata.confidence })] }), _jsxs("div", { children: [_jsx("dt", { children: "Extraction version" }), _jsx("dd", { children: dp.metadataExtraction?.version ?? "unknown" })] })] })) : (_jsx("p", { className: "empty-state", children: "No extracted metadata." }))) : (_jsxs("p", { className: "room-page__datapoint-summary", children: [dp.metadata?.roomCandidate ?? "No room metadata", " \u00B7 ", dp.metadata?.deviceType ?? "Unknown type"] }))] }, dp.id))), filteredDatapoints.length === 0 ? (_jsx("p", { className: "empty-state", children: datapoints.length === 0
                                            ? "No datapoints in this room."
                                            : "No datapoints match the current search and filters." })) : null] })] })] })] }));
}
