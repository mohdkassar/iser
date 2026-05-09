import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/admin";
import { Panel } from "../components/Panel";
import { SelectableList } from "../components/SelectableList";
import { useAdminData } from "../hooks/useAdminData";
function toLocalDateTimeValue(date) {
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
export function SyntheticTelemetryPage() {
    const { clients, clientDetail, siteDetail, selectedClientId, selectedSiteId, error, isPending, setSelectedClientId, setSelectedSiteId, } = useAdminData();
    const [selectedDatapointIds, setSelectedDatapointIds] = useState([]);
    const [search, setSearch] = useState("");
    const [valueMode, setValueMode] = useState("range");
    const [rangeMin, setRangeMin] = useState("0");
    const [rangeMax, setRangeMax] = useState("5");
    const [allowedValues, setAllowedValues] = useState("ON,OFF");
    const [errorMargin, setErrorMargin] = useState("0.05");
    const [missingValueMargin, setMissingValueMargin] = useState("0.1");
    const [granularityMinutes, setGranularityMinutes] = useState(5);
    const [startAt, setStartAt] = useState(() => toLocalDateTimeValue(new Date(Date.now() - 60 * 60 * 1000)));
    const [endAt, setEndAt] = useState(() => toLocalDateTimeValue(new Date()));
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null);
    const [formError, setFormError] = useState(null);
    useEffect(() => {
        setSelectedDatapointIds(siteDetail?.datapoints.map((datapoint) => datapoint.identifier) ?? []);
    }, [siteDetail?.datapoints]);
    const filteredDatapoints = useMemo(() => {
        const datapoints = siteDetail?.datapoints ?? [];
        const query = search.trim().toLowerCase();
        if (!query)
            return datapoints;
        return datapoints.filter((datapoint) => {
            const searchable = [
                datapoint.rawName,
                datapoint.identifier,
                datapoint.manufacturer,
                datapoint.metadata?.roomCandidate,
                datapoint.metadata?.deviceInstance,
                datapoint.metadata?.deviceType,
                datapoint.metadata?.subzone,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return searchable.includes(query);
        });
    }, [search, siteDetail?.datapoints]);
    function toggleDatapoint(identifier) {
        setSelectedDatapointIds((current) => current.includes(identifier) ? current.filter((value) => value !== identifier) : [...current, identifier]);
    }
    function selectAllDatapoints() {
        setSelectedDatapointIds(siteDetail?.datapoints.map((datapoint) => datapoint.identifier) ?? []);
    }
    function clearDatapoints() {
        setSelectedDatapointIds([]);
    }
    async function handleGenerate(event) {
        event.preventDefault();
        if (!selectedSiteId)
            return;
        setIsGenerating(true);
        setFormError(null);
        setResult(null);
        try {
            const valueSpec = valueMode === "range"
                ? {
                    kind: "range",
                    min: Number(rangeMin),
                    max: Number(rangeMax),
                }
                : valueMode === "list"
                    ? {
                        kind: "list",
                        values: allowedValues
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                    }
                    : {
                        kind: "percentage",
                    };
            const response = await adminApi.generateSyntheticTelemetry(selectedSiteId, {
                datapointIdentifiers: selectedDatapointIds,
                startAt: new Date(startAt).toISOString(),
                endAt: new Date(endAt).toISOString(),
                granularityMinutes,
                errorMargin: Number(errorMargin),
                missingValueMargin: Number(missingValueMargin),
                valueSpec,
            });
            setResult(response);
        }
        catch (error) {
            setFormError(error instanceof Error ? error.message : "Failed to generate telemetry.");
        }
        finally {
            setIsGenerating(false);
        }
    }
    return (_jsxs("main", { className: "app-shell telemetry-page", children: [_jsxs("section", { className: "hero", children: [_jsxs("div", { children: [_jsx("p", { className: "hero__eyebrow", children: "Synthetic telemetry" }), _jsx("h1", { children: "Generate telemetry records for selected datapoints." }), _jsx("p", { className: "hero__copy", children: "Choose a site, select one or more datapoints, then generate sample telemetry using a numeric range, fixed value list, or percentage values." })] }), _jsxs("div", { className: "hero__status", children: [_jsx("span", { className: "status-pill", children: isPending ? "Loading" : "Ready" }), _jsx(Link, { className: "secondary-button", to: "/", children: "Back to dashboard" })] })] }), _jsxs("section", { className: "dashboard-grid", children: [_jsx(Panel, { title: "Clients", subtitle: `${clients.length} available`, children: _jsx(SelectableList, { items: clients.map((client) => ({
                                id: client.id,
                                title: client.name,
                                meta: `${client.siteCount} sites`,
                            })), selectedId: selectedClientId, emptyLabel: "No clients found.", onSelect: setSelectedClientId }) }), _jsx(Panel, { title: "Sites", subtitle: clientDetail ? clientDetail.name : "Select a client", children: _jsx(SelectableList, { items: clientDetail?.sites.map((site) => ({
                                id: site.id,
                                title: site.name,
                                meta: `${site.datapointCount} datapoints`,
                            })) ?? [], selectedId: selectedSiteId, emptyLabel: "Select a client to load sites.", onSelect: setSelectedSiteId }) })] }), _jsx(Panel, { title: "Telemetry generator", subtitle: siteDetail ? `${selectedDatapointIds.length} datapoints selected` : "Select a site to begin", children: _jsxs("form", { className: "telemetry-page__form", onSubmit: handleGenerate, children: [_jsxs("div", { className: "telemetry-page__config", children: [_jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Start time" }), _jsx("input", { type: "datetime-local", value: startAt, onChange: (event) => setStartAt(event.target.value), disabled: !siteDetail || isGenerating })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "End time" }), _jsx("input", { type: "datetime-local", value: endAt, onChange: (event) => setEndAt(event.target.value), disabled: !siteDetail || isGenerating })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Granularity" }), _jsxs("select", { value: granularityMinutes, onChange: (event) => setGranularityMinutes(Number.parseInt(event.target.value, 10)), disabled: !siteDetail || isGenerating, children: [_jsx("option", { value: 1, children: "Minute samples" }), _jsx("option", { value: 5, children: "5 minute samples" })] })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Error margin" }), _jsx("input", { type: "number", min: 0, max: 1, step: 0.01, value: errorMargin, onChange: (event) => setErrorMargin(event.target.value), disabled: !siteDetail || isGenerating })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Missing values margin" }), _jsx("input", { type: "number", min: 0, max: 1, step: 0.01, value: missingValueMargin, onChange: (event) => setMissingValueMargin(event.target.value), disabled: !siteDetail || isGenerating })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Value mode" }), _jsxs("select", { value: valueMode, onChange: (event) => setValueMode(event.target.value), disabled: !siteDetail || isGenerating, children: [_jsx("option", { value: "range", children: "Numeric range" }), _jsx("option", { value: "list", children: "Allowed values" }), _jsx("option", { value: "percentage", children: "Percentage" })] })] }), valueMode === "range" ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Range min" }), _jsx("input", { type: "number", value: rangeMin, onChange: (event) => setRangeMin(event.target.value), disabled: !siteDetail || isGenerating })] }), _jsxs("label", { className: "telemetry-field", children: [_jsx("span", { children: "Range max" }), _jsx("input", { type: "number", value: rangeMax, onChange: (event) => setRangeMax(event.target.value), disabled: !siteDetail || isGenerating })] })] })) : valueMode === "list" ? (_jsxs("label", { className: "telemetry-field telemetry-field--wide", children: [_jsx("span", { children: "Allowed values" }), _jsx("input", { type: "text", value: allowedValues, onChange: (event) => setAllowedValues(event.target.value), placeholder: "ON,OFF", disabled: !siteDetail || isGenerating })] })) : (_jsxs("div", { className: "telemetry-summary", children: [_jsx("strong", { children: "Percentage mode" }), _jsx("p", { children: "Generates values from 0 to 100 with the selected error and missing-value margins." })] })), _jsxs("div", { className: "telemetry-page__actions", children: [_jsx("button", { className: "primary-button", type: "submit", disabled: !siteDetail || isGenerating || selectedDatapointIds.length === 0, children: isGenerating ? "Generating..." : "Generate telemetry" }), _jsx("button", { className: "secondary-button", type: "button", onClick: selectAllDatapoints, disabled: !siteDetail || isGenerating, children: "Select all" }), _jsx("button", { className: "secondary-button", type: "button", onClick: clearDatapoints, disabled: !siteDetail || isGenerating, children: "Clear" })] }), formError ? _jsx("p", { className: "status-pill status-pill--error", children: formError }) : null, result ? (_jsxs("div", { className: "telemetry-summary", children: [_jsx("strong", { children: "Generation complete" }), _jsxs("p", { children: [result.recordsCreated, " records created for ", result.datapointCount, " datapoints on ", result.siteName, ".", result.recordsSkipped > 0 ? ` ${result.recordsSkipped} samples were skipped.` : ""] })] })) : null] }), _jsxs("div", { className: "telemetry-page__datapoints", children: [_jsx("div", { className: "panel__header", children: _jsxs("div", { children: [_jsx("p", { className: "panel__eyebrow", children: "Datapoints" }), _jsxs("h2", { children: [selectedDatapointIds.length, " selected"] })] }) }), _jsxs("label", { className: "search-control telemetry-page__search", children: [_jsx("span", { children: "Search datapoints" }), _jsx("input", { type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Raw name, identifier, manufacturer...", disabled: !siteDetail })] }), _jsxs("div", { className: "telemetry-page__datapoint-list", children: [filteredDatapoints.map((datapoint) => (_jsxs("label", { className: "telemetry-page__datapoint", children: [_jsx("input", { type: "checkbox", checked: selectedDatapointIds.includes(datapoint.identifier), onChange: () => toggleDatapoint(datapoint.identifier), disabled: !siteDetail || isGenerating }), _jsxs("div", { children: [_jsx("strong", { children: datapoint.metadata?.humanReadableName ?? datapoint.rawName }), _jsx("span", { children: datapoint.rawName }), _jsx("span", { children: datapoint.identifier }), _jsx("small", { children: datapoint.manufacturer })] })] }, datapoint.id))), siteDetail && filteredDatapoints.length === 0 ? (_jsx("p", { className: "empty-state", children: "No datapoints match the current search." })) : null, !siteDetail ? _jsx("p", { className: "empty-state", children: "Select a site to load datapoints." }) : null] })] })] }) })] }));
}
