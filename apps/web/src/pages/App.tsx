import { useMemo, useState } from "react";
import type { ClusterStatus, ClusterType, MetadataExtractionVersion } from "@iser/shared";

import { ClusterCard } from "../components/ClusterCard";
import { Panel } from "../components/Panel";
import { SelectableList } from "../components/SelectableList";
import { useAdminData } from "../hooks/useAdminData";

const clusterStatusOptions: Array<"all" | ClusterStatus> = ["all", "pending", "approved", "rejected"];
const clusterTypeOptions: Array<"all" | ClusterType> = ["all", "room", "device"];

export function App() {
  const {
    clients,
    clientDetail,
    siteDetail,
    selectedClientId,
    selectedSiteId,
    error,
    isPending,
    isExtractingMetadata,
    isRunningRoomClustering,
    metadataExtractionProgress,
    setSelectedClientId,
    setSelectedSiteId,
    extractMetadata,
    runRoomClustering,
    clearSiteClustersAndMetadata,
    updateCluster,
  } = useAdminData();
  const [clusterStatusFilter, setClusterStatusFilter] = useState<"all" | ClusterStatus>("all");
  const [clusterTypeFilter, setClusterTypeFilter] = useState<"all" | ClusterType>("all");
  const [expandedDatapointId, setExpandedDatapointId] = useState<string | null>(null);
  const [metadataExtractionVersion, setMetadataExtractionVersion] =
    useState<MetadataExtractionVersion>("v1");
  const [metadataBatchSize, setMetadataBatchSize] = useState(5);
  const [datapointSearch, setDatapointSearch] = useState("");

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

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="hero__eyebrow">ISER Admin</p>
          <h1>Cluster industrial IoT datapoints into rooms and logical devices.</h1>
          <p className="hero__copy">
            Start with the client, drill into a site, inspect datapoints, then run and moderate the
            generated clusters.
          </p>
        </div>
        <div className="hero__status">
          <span className="status-pill">{isPending ? "Loading" : "Ready"}</span>
          {error ? <span className="status-pill status-pill--error">{error}</span> : null}
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

        <Panel
          title="Sites"
          subtitle={clientDetail ? `${clientDetail.name}` : "Select a client"}
          action={
            selectedSiteId ? (
              <div className="panel-actions">
                <button className="secondary-button" type="button" onClick={() => void clearSiteClustersAndMetadata()}>
                  Clear clusters and metadata
                </button>
              </div>
            ) : null
          }
        >
          <SelectableList
            items={
              clientDetail?.sites.map((site) => ({
                id: site.id,
                title: site.name,
                meta: `${site.datapointCount} datapoints • ${site.clusterCount} clusters`,
              })) ?? []
            }
            selectedId={selectedSiteId}
            emptyLabel="Select a client to load sites."
            onSelect={setSelectedSiteId}
          />
        </Panel>

        <Panel
          title="Datapoints"
          subtitle={
            siteDetail
              ? `${filteredDatapoints.length} of ${siteDetail.datapoints.length} shown`
              : "Select a site"
          }
        >
          <div className="datapoint-toolbar">
            <div className="datapoint-actions">
              <label className="extract-config">
                <span>Mode</span>
                <select
                  value={metadataExtractionVersion}
                  onChange={(event) =>
                    setMetadataExtractionVersion(event.target.value as MetadataExtractionVersion)
                  }
                  disabled={isExtractingMetadata || !siteDetail}
                >
                  <option value="v1">V1 single</option>
                  <option value="v2">V2 grouped</option>
                  <option value="v3">V3 room only</option>
                </select>
              </label>
              <label
                className={`extract-config ${
                  metadataExtractionVersion === "v1" ? "is-disabled" : ""
                }`}
              >
                <span>Batch size</span>
                <input
                  type="number"
                  min={1}
                  value={metadataBatchSize}
                  onChange={(event) =>
                    setMetadataBatchSize(Math.max(1, Number.parseInt(event.target.value || "1", 10)))
                  }
                  disabled={isExtractingMetadata || metadataExtractionVersion === "v1" || !siteDetail}
                />
              </label>
              <div className="extract-action">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void extractMetadata(metadataExtractionVersion, metadataBatchSize)}
                  disabled={isExtractingMetadata || !siteDetail}
                >
                  {isExtractingMetadata
                    ? `Extracting ${metadataExtractionProgress}%`
                    : "Extract metadata"}
                </button>
                {isExtractingMetadata ? (
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className="progress-bar"
                      style={{ width: `${metadataExtractionProgress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <label className="search-control datapoint-search">
              <span>Search datapoints</span>
              <input
                type="search"
                value={datapointSearch}
                onChange={(event) => setDatapointSearch(event.target.value)}
                placeholder="Raw name, identifier, metadata..."
                disabled={!siteDetail}
              />
            </label>
          </div>
          <div className="datapoint-list">
            {filteredDatapoints.map((datapoint) => (
              <button
                key={datapoint.id}
                type="button"
                className={`datapoint-card ${expandedDatapointId === datapoint.id ? "is-expanded" : ""}`}
                onClick={() =>
                  setExpandedDatapointId((current) => (current === datapoint.id ? null : datapoint.id))
                }
              >
                <div className="datapoint-card__summary">
                  <div className="datapoint-card__primary">
                    <strong>{datapoint.rawName}</strong>
                    <span>{datapoint.identifier}</span>
                    <small>{datapoint.manufacturer}</small>
                  </div>
                  <div className="datapoint-card__preview">
                    {datapoint.metadata ? (
                      <p>
                        {datapoint.metadata.roomCandidate} • {datapoint.metadata.deviceInstance ?? "room only"} •{" "}
                        {datapoint.metadata.deviceType ?? "room only"}
                      </p>
                    ) : (
                      <p>No extracted metadata yet.</p>
                    )}
                  </div>
                </div>
                {expandedDatapointId === datapoint.id && datapoint.metadata ? (
                  <dl className="metadata-grid">
                    <div>
                      <dt>Room candidate</dt>
                      <dd>{datapoint.metadata.roomCandidate}</dd>
                    </div>
                    <div>
                      <dt>Room aliases</dt>
                      <dd>{datapoint.metadata.roomAliases.join(", ") || "None"}</dd>
                    </div>
                    <div>
                      <dt>Equipment group</dt>
                      <dd>{datapoint.metadata.equipmentGroup ?? "Not extracted"}</dd>
                    </div>
                    <div>
                      <dt>Device instance</dt>
                      <dd>{datapoint.metadata.deviceInstance ?? "Not extracted"}</dd>
                    </div>
                    <div>
                      <dt>Device type</dt>
                      <dd>{datapoint.metadata.deviceType ?? "Not extracted"}</dd>
                    </div>
                    <div>
                      <dt>Subzone</dt>
                      <dd>{datapoint.metadata.subzone ?? "Not extracted"}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{datapoint.metadata.confidence}</dd>
                    </div>
                    <div>
                      <dt>Extraction version</dt>
                      <dd>{datapoint.metadataExtraction?.version ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt>Batch size</dt>
                      <dd>{datapoint.metadataExtraction?.batchSize ?? "unknown"}</dd>
                    </div>
                  </dl>
                ) : null}
              </button>
            ))}
            {siteDetail && filteredDatapoints.length === 0 ? (
              <p className="empty-state">No datapoints match the current search.</p>
            ) : null}
            {!siteDetail ? <p className="empty-state">Select a site to inspect datapoints.</p> : null}
          </div>
        </Panel>

        <Panel
          title="Clusters"
          subtitle={siteDetail ? `${filteredClusters.length} of ${siteDetail.clusters.length} shown` : "No site selected"}
          action={
            selectedSiteId ? (
              <button
                className="primary-button panel-action-button"
                type="button"
                onClick={() => void runRoomClustering()}
                disabled={isRunningRoomClustering}
              >
                {isRunningRoomClustering ? "Clustering rooms..." : "Run room clustering"}
              </button>
            ) : null
          }
        >
          <div className="cluster-toolbar">
            <label className="filter-control">
              <span>Status</span>
              <select
                value={clusterStatusFilter}
                onChange={(event) =>
                  setClusterStatusFilter(event.target.value as "all" | ClusterStatus)
                }
              >
                {clusterStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Type</span>
              <select
                value={clusterTypeFilter}
                onChange={(event) => setClusterTypeFilter(event.target.value as "all" | ClusterType)}
              >
                {clusterTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cluster-grid">
            {filteredClusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                datapoints={
                  siteDetail?.datapoints.filter((datapoint) => cluster.datapointIds.includes(datapoint.id)) ?? []
                }
                onApprove={() => updateCluster(cluster.id, "approved")}
                onReject={() => updateCluster(cluster.id, "rejected")}
                onRename={(label) => updateCluster(cluster.id, undefined, label)}
              />
            ))}
            {siteDetail && filteredClusters.length === 0 ? (
              <p className="empty-state">No clusters match the current filters.</p>
            ) : null}
            {!siteDetail ? (
              <p className="empty-state">Run room clustering to generate clusters.</p>
            ) : null}
          </div>
        </Panel>
      </section>
    </main>
  );
}
