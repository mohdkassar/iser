import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type {
  ClusterSummary,
  DatapointSummary,
  RoomAgentMessage,
  SiteDetail,
} from "@iser/shared";
import { adminApi } from "../api/admin";

type RoomChatMessage = RoomAgentMessage & {
  id: string;
};

export function RoomPage() {
  const { siteId, clusterId } = useParams<{ siteId: string; clusterId: string }>();
  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about this room, its datapoints, or the telemetry patterns I can inspect through Mongo-backed tools.",
    },
  ]);
  const [roomQuestion, setRoomQuestion] = useState("");
  const [roomAgentError, setRoomAgentError] = useState<string | null>(null);
  const [isAskingAgent, setIsAskingAgent] = useState(false);
  const [roomAgentUsage, setRoomAgentUsage] = useState<{
    totalTokens: number;
    toolCallsUsed: number;
  } | null>(null);

  useEffect(() => {
    if (!siteId) return;

    setIsPending(true);
    setError(null);

    adminApi
      .getSite(siteId)
      .then(setSiteDetail)
      .catch(() => setError("Failed to load site data."))
      .finally(() => setIsPending(false));
  }, [siteId]);

  const cluster: ClusterSummary | undefined = siteDetail?.clusters.find(
    (c) => c.id === clusterId,
  );

  const datapoints: DatapointSummary[] = cluster
    ? siteDetail?.datapoints.filter((dp) => cluster.datapointIds.includes(dp.id)) ?? []
    : [];

  const aliases = cluster
    ? (Array.isArray(cluster.metadata.aliases)
        ? cluster.metadata.aliases.filter(
            (alias): alias is string => typeof alias === "string",
          )
        : [])
    : [];

  const [search, setSearch] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [subzoneFilter, setSubzoneFilter] = useState("all");
  const [equipmentGroupFilter, setEquipmentGroupFilter] = useState("all");
  const [deviceInstanceFilter, setDeviceInstanceFilter] = useState("all");
  const [expandedDatapointIds, setExpandedDatapointIds] = useState<string[]>([]);

  const filterOptions = useMemo(() => {
    const deviceTypes = new Set<string>();
    const subzones = new Set<string>();
    const equipmentGroups = new Set<string>();
    const deviceInstances = new Set<string>();

    for (const dp of datapoints) {
      if (dp.metadata?.deviceType) deviceTypes.add(dp.metadata.deviceType);
      if (dp.metadata?.subzone) subzones.add(dp.metadata.subzone);
      if (dp.metadata?.equipmentGroup) equipmentGroups.add(dp.metadata.equipmentGroup);
      if (dp.metadata?.deviceInstance) deviceInstances.add(dp.metadata.deviceInstance);
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

        if (!searchable.includes(query)) return false;
      }

      if (deviceTypeFilter !== "all" && dp.metadata?.deviceType !== deviceTypeFilter) return false;
      if (subzoneFilter !== "all" && dp.metadata?.subzone !== subzoneFilter) return false;
      if (equipmentGroupFilter !== "all" && dp.metadata?.equipmentGroup !== equipmentGroupFilter) return false;
      if (deviceInstanceFilter !== "all" && dp.metadata?.deviceInstance !== deviceInstanceFilter) return false;

      return true;
    });
  }, [datapoints, search, deviceTypeFilter, subzoneFilter, equipmentGroupFilter, deviceInstanceFilter]);

  function toggleDatapointDetails(datapointId: string) {
    setExpandedDatapointIds((current) =>
      current.includes(datapointId)
        ? current.filter((id) => id !== datapointId)
        : [...current, datapointId],
    );
  }

  async function askRoomAgent() {
    if (!siteId || !clusterId) return;

    const prompt = roomQuestion.trim();
    if (!prompt) return;

    const nextMessage: RoomChatMessage = {
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
    } catch (roomAgentRequestError) {
      setRoomAgentError(
        roomAgentRequestError instanceof Error
          ? roomAgentRequestError.message
          : "Failed to ask the room agent.",
      );
      setRoomMessages((current) => current.slice(0, -1));
    } finally {
      setIsAskingAgent(false);
    }
  }

  if (isPending) {
    return (
      <main className="app-shell">
        <p className="empty-state">Loading room details...</p>
      </main>
    );
  }

  if (error || !cluster) {
    return (
      <main className="app-shell">
        <div className="room-page__back">
          <Link to="/" className="secondary-button">Back to dashboard</Link>
        </div>
        <p className="empty-state">{error ?? "Room not found."}</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="room-page__back">
        <Link to="/" className="secondary-button">Back to dashboard</Link>
      </div>

      <section className="room-page__header">
        <div className="room-page__header-main">
          <p className="hero__eyebrow">Room Details</p>
          <h1>{cluster.label}</h1>
          <div className="room-page__badges">
            <span className={`badge badge--${cluster.status}`}>{cluster.status}</span>
            <span className="badge badge--type">{cluster.type}</span>
          </div>
        </div>
        <div className="room-page__header-details">
          <div className="room-page__header-stat">
            <span>Datapoints</span>
            <strong>{cluster.datapointCount}</strong>
          </div>
          <div className="room-page__header-stat">
            <span>Updated</span>
            <strong>{new Date(cluster.updatedAt).toLocaleString()}</strong>
          </div>
          <div className="room-page__aliases">
            <span className="room-page__aliases-label">Aliases</span>
            {aliases.length > 0 ? (
              <div className="alias-chips">
                {aliases.map((alias) => (
                  <span key={alias} className="alias-chip">
                    {alias}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty-state">No aliases stored for this room.</p>
            )}
          </div>
        </div>
      </section>

      <section className="room-page__content">
        <div className="panel room-page__panel--agent">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Room Agent</p>
              <h2>Ask questions about this room</h2>
            </div>
            {roomAgentUsage ? (
              <small className="room-agent__usage">
                {roomAgentUsage.totalTokens} tokens, {roomAgentUsage.toolCallsUsed} tool calls
              </small>
            ) : null}
          </div>

          <div className="room-agent__messages">
            {roomMessages.map((message) => (
              <div key={message.id} className={`room-agent__message room-agent__message--${message.role}`}>
                <span className="room-agent__role">{message.role === "user" ? "You" : "Agent"}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>

          <form
            className="room-agent__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void askRoomAgent();
            }}
          >
            <label className="room-agent__field">
              <span>Question</span>
              <textarea
                value={roomQuestion}
                onChange={(event) => setRoomQuestion(event.target.value)}
                placeholder="What telemetry looks suspicious in this room?"
                rows={5}
                disabled={!siteDetail || isAskingAgent}
              />
            </label>

            <div className="room-agent__actions">
              <button
                className="primary-button"
                type="submit"
                disabled={!siteDetail || isAskingAgent || roomQuestion.trim().length === 0}
              >
                {isAskingAgent ? "Asking..." : "Ask agent"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setRoomMessages((current) => current.slice(0, 1))}
                disabled={isAskingAgent}
              >
                Clear chat
              </button>
            </div>

            {roomAgentError ? <p className="status-pill status-pill--error">{roomAgentError}</p> : null}
          </form>
        </div>
        <div className="panel room-page__panel--datapoints">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Datapoints</p>
              <h2>{filteredDatapoints.length} of {datapoints.length} datapoints</h2>
            </div>
          </div>
          <div className="room-page__toolbar">
            <label className="search-control room-page__search">
              <span>Search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Raw name, identifier, metadata..."
              />
            </label>
            <div className="room-page__filters">
              <label className="filter-control">
                <span>Device type</span>
                <select value={deviceTypeFilter} onChange={(e) => setDeviceTypeFilter(e.target.value)}>
                  <option value="all">All</option>
                  {filterOptions.deviceTypes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>Subzone</span>
                <select value={subzoneFilter} onChange={(e) => setSubzoneFilter(e.target.value)}>
                  <option value="all">All</option>
                  {filterOptions.subzones.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>Equipment group</span>
                <select value={equipmentGroupFilter} onChange={(e) => setEquipmentGroupFilter(e.target.value)}>
                  <option value="all">All</option>
                  {filterOptions.equipmentGroups.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>Device instance</span>
                <select value={deviceInstanceFilter} onChange={(e) => setDeviceInstanceFilter(e.target.value)}>
                  <option value="all">All</option>
                  {filterOptions.deviceInstances.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="room-page__datapoints">
            {filteredDatapoints.map((dp) => (
              <div
                key={dp.id}
                className={`room-page__datapoint${expandedDatapointIds.includes(dp.id) ? " is-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="room-page__datapoint-toggle"
                  onClick={() => toggleDatapointDetails(dp.id)}
                >
                  <div className="room-page__datapoint-header">
                    <strong>{dp.metadata?.humanReadableName ?? dp.rawName}</strong>
                    <span>{dp.rawName}</span>
                    <span>{dp.identifier}</span>
                    <small>{dp.manufacturer}</small>
                  </div>
                  <span className="room-page__datapoint-chevron">
                    {expandedDatapointIds.includes(dp.id) ? "Collapse" : "Expand"}
                  </span>
                </button>
                {expandedDatapointIds.includes(dp.id) ? (
                  dp.metadata ? (
                    <dl className="metadata-grid">
                      <div>
                        <dt>Room candidate</dt>
                        <dd>{dp.metadata.roomCandidate}</dd>
                      </div>
                      <div>
                        <dt>Room aliases</dt>
                        <dd>{dp.metadata.roomAliases.join(", ") || "None"}</dd>
                      </div>
                      <div>
                        <dt>Equipment group</dt>
                        <dd>{dp.metadata.equipmentGroup ?? "Not extracted"}</dd>
                      </div>
                      <div>
                        <dt>Device instance</dt>
                        <dd>{dp.metadata.deviceInstance ?? "Not extracted"}</dd>
                      </div>
                      <div>
                        <dt>Device type</dt>
                        <dd>{dp.metadata.deviceType ?? "Not extracted"}</dd>
                      </div>
                      <div>
                        <dt>Subzone</dt>
                        <dd>{dp.metadata.subzone ?? "Not extracted"}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{dp.metadata.confidence}</dd>
                      </div>
                      <div>
                        <dt>Extraction version</dt>
                        <dd>{dp.metadataExtraction?.version ?? "unknown"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="empty-state">No extracted metadata.</p>
                  )
                ) : (
                  <p className="room-page__datapoint-summary">
                    {dp.metadata?.roomCandidate ?? "No room metadata"} · {dp.metadata?.deviceType ?? "Unknown type"}
                  </p>
                )}
                </div>
            ))}
            {filteredDatapoints.length === 0 ? (
              <p className="empty-state">
                {datapoints.length === 0
                  ? "No datapoints in this room."
                  : "No datapoints match the current search and filters."}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
