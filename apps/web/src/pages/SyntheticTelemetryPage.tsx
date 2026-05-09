import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { GenerateSyntheticTelemetryInput, GenerateSyntheticTelemetryResponse } from "@iser/shared";

import { adminApi } from "../api/admin";
import { Panel } from "../components/Panel";
import { SelectableList } from "../components/SelectableList";
import { useAdminData } from "../hooks/useAdminData";

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function SyntheticTelemetryPage() {
  const {
    clients,
    clientDetail,
    siteDetail,
    selectedClientId,
    selectedSiteId,
    error,
    isPending,
    setSelectedClientId,
    setSelectedSiteId,
  } = useAdminData();

  const [selectedDatapointIds, setSelectedDatapointIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [valueMode, setValueMode] = useState<"range" | "list" | "percentage">("range");
  const [rangeMin, setRangeMin] = useState("0");
  const [rangeMax, setRangeMax] = useState("5");
  const [allowedValues, setAllowedValues] = useState("ON,OFF");
  const [errorMargin, setErrorMargin] = useState("0.05");
  const [missingValueMargin, setMissingValueMargin] = useState("0.1");
  const [granularityMinutes, setGranularityMinutes] = useState<1 | 5>(5);
  const [startAt, setStartAt] = useState(() => toLocalDateTimeValue(new Date(Date.now() - 60 * 60 * 1000)));
  const [endAt, setEndAt] = useState(() => toLocalDateTimeValue(new Date()));
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateSyntheticTelemetryResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDatapointIds(siteDetail?.datapoints.map((datapoint) => datapoint.identifier) ?? []);
  }, [siteDetail?.datapoints]);

  const filteredDatapoints = useMemo(() => {
    const datapoints = siteDetail?.datapoints ?? [];
    const query = search.trim().toLowerCase();

    if (!query) return datapoints;

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

  function toggleDatapoint(identifier: string) {
    setSelectedDatapointIds((current) =>
      current.includes(identifier) ? current.filter((value) => value !== identifier) : [...current, identifier],
    );
  }

  function selectAllDatapoints() {
    setSelectedDatapointIds(siteDetail?.datapoints.map((datapoint) => datapoint.identifier) ?? []);
  }

  function clearDatapoints() {
    setSelectedDatapointIds([]);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSiteId) return;

    setIsGenerating(true);
    setFormError(null);
    setResult(null);

    try {
      const valueSpec: GenerateSyntheticTelemetryInput["valueSpec"] =
        valueMode === "range"
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
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to generate telemetry.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell telemetry-page">
      <section className="hero">
        <div>
          <p className="hero__eyebrow">Synthetic telemetry</p>
          <h1>Generate telemetry records for selected datapoints.</h1>
          <p className="hero__copy">
            Choose a site, select one or more datapoints, then generate sample telemetry using a numeric range,
            fixed value list, or percentage values.
          </p>
        </div>
        <div className="hero__status">
          <span className="status-pill">{isPending ? "Loading" : "Ready"}</span>
          <Link className="secondary-button" to="/">
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="dashboard-grid">
        <Panel title="Clients" subtitle={`${clients.length} available`}>
          <SelectableList
            items={clients.map((client) => ({
              id: client.id,
              title: client.name,
              meta: `${client.siteCount} sites`,
            }))}
            selectedId={selectedClientId}
            emptyLabel="No clients found."
            onSelect={setSelectedClientId}
          />
        </Panel>

        <Panel title="Sites" subtitle={clientDetail ? clientDetail.name : "Select a client"}>
          <SelectableList
            items={
              clientDetail?.sites.map((site) => ({
                id: site.id,
                title: site.name,
                meta: `${site.datapointCount} datapoints`,
              })) ?? []
            }
            selectedId={selectedSiteId}
            emptyLabel="Select a client to load sites."
            onSelect={setSelectedSiteId}
          />
        </Panel>
      </section>

      <Panel
        title="Telemetry generator"
        subtitle={siteDetail ? `${selectedDatapointIds.length} datapoints selected` : "Select a site to begin"}
      >
        <form className="telemetry-page__form" onSubmit={handleGenerate}>
          <div className="telemetry-page__config">
            <label className="telemetry-field">
              <span>Start time</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                disabled={!siteDetail || isGenerating}
              />
            </label>
            <label className="telemetry-field">
              <span>End time</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                disabled={!siteDetail || isGenerating}
              />
            </label>
            <label className="telemetry-field">
              <span>Granularity</span>
              <select
                value={granularityMinutes}
                onChange={(event) => setGranularityMinutes(Number.parseInt(event.target.value, 10) as 1 | 5)}
                disabled={!siteDetail || isGenerating}
              >
                <option value={1}>Minute samples</option>
                <option value={5}>5 minute samples</option>
              </select>
            </label>
            <label className="telemetry-field">
              <span>Error margin</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={errorMargin}
                onChange={(event) => setErrorMargin(event.target.value)}
                disabled={!siteDetail || isGenerating}
              />
            </label>
            <label className="telemetry-field">
              <span>Missing values margin</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={missingValueMargin}
                onChange={(event) => setMissingValueMargin(event.target.value)}
                disabled={!siteDetail || isGenerating}
              />
            </label>
            <label className="telemetry-field">
              <span>Value mode</span>
              <select
                value={valueMode}
                onChange={(event) => setValueMode(event.target.value as "range" | "list" | "percentage")}
                disabled={!siteDetail || isGenerating}
              >
                <option value="range">Numeric range</option>
                <option value="list">Allowed values</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            {valueMode === "range" ? (
              <>
                <label className="telemetry-field">
                  <span>Range min</span>
                  <input
                    type="number"
                    value={rangeMin}
                    onChange={(event) => setRangeMin(event.target.value)}
                    disabled={!siteDetail || isGenerating}
                  />
                </label>
                <label className="telemetry-field">
                  <span>Range max</span>
                  <input
                    type="number"
                    value={rangeMax}
                    onChange={(event) => setRangeMax(event.target.value)}
                    disabled={!siteDetail || isGenerating}
                  />
                </label>
              </>
            ) : valueMode === "list" ? (
              <label className="telemetry-field telemetry-field--wide">
                <span>Allowed values</span>
                <input
                  type="text"
                  value={allowedValues}
                  onChange={(event) => setAllowedValues(event.target.value)}
                  placeholder="ON,OFF"
                  disabled={!siteDetail || isGenerating}
                />
              </label>
            ) : (
              <div className="telemetry-summary">
                <strong>Percentage mode</strong>
                <p>Generates values from 0 to 100 with the selected error and missing-value margins.</p>
              </div>
            )}
            <div className="telemetry-page__actions">
              <button className="primary-button" type="submit" disabled={!siteDetail || isGenerating || selectedDatapointIds.length === 0}>
                {isGenerating ? "Generating..." : "Generate telemetry"}
              </button>
              <button className="secondary-button" type="button" onClick={selectAllDatapoints} disabled={!siteDetail || isGenerating}>
                Select all
              </button>
              <button className="secondary-button" type="button" onClick={clearDatapoints} disabled={!siteDetail || isGenerating}>
                Clear
              </button>
            </div>
            {formError ? <p className="status-pill status-pill--error">{formError}</p> : null}
            {result ? (
              <div className="telemetry-summary">
                <strong>Generation complete</strong>
                <p>
                  {result.recordsCreated} records created for {result.datapointCount} datapoints on {result.siteName}.
                  {result.recordsSkipped > 0 ? ` ${result.recordsSkipped} samples were skipped.` : ""}
                </p>
              </div>
            ) : null}
          </div>

          <div className="telemetry-page__datapoints">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">Datapoints</p>
                <h2>{selectedDatapointIds.length} selected</h2>
              </div>
            </div>
            <label className="search-control telemetry-page__search">
              <span>Search datapoints</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Raw name, identifier, manufacturer..."
                disabled={!siteDetail}
              />
            </label>
            <div className="telemetry-page__datapoint-list">
              {filteredDatapoints.map((datapoint) => (
                <label key={datapoint.id} className="telemetry-page__datapoint">
                  <input
                    type="checkbox"
                    checked={selectedDatapointIds.includes(datapoint.identifier)}
                    onChange={() => toggleDatapoint(datapoint.identifier)}
                    disabled={!siteDetail || isGenerating}
                  />
                  <div>
                    <strong>{datapoint.metadata?.humanReadableName ?? datapoint.rawName}</strong>
                    <span>{datapoint.rawName}</span>
                    <span>{datapoint.identifier}</span>
                    <small>{datapoint.manufacturer}</small>
                  </div>
                </label>
              ))}
              {siteDetail && filteredDatapoints.length === 0 ? (
                <p className="empty-state">No datapoints match the current search.</p>
              ) : null}
              {!siteDetail ? <p className="empty-state">Select a site to load datapoints.</p> : null}
            </div>
          </div>
        </form>
      </Panel>
    </main>
  );
}
