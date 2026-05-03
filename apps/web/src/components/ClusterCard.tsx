import { useState } from "react";
import type { ClusterCardProps } from "../types/components";

export function ClusterCard({ cluster, datapoints, onApprove, onReject, onRename }: ClusterCardProps) {
  const [draftLabel, setDraftLabel] = useState(cluster.label);
  const [isExpanded, setIsExpanded] = useState(false);
  const aliases = Array.isArray(cluster.metadata.aliases)
    ? cluster.metadata.aliases.filter((alias): alias is string => typeof alias === "string")
    : [];

  return (
    <article className={`cluster-card ${isExpanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className="cluster-card__toggle"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <div className="cluster-card__header">
          <span className={`badge badge--${cluster.status}`}>{cluster.status}</span>
          <span className="badge badge--type">{cluster.type}</span>
        </div>
        <strong>{cluster.label}</strong>
        <p>{cluster.datapointCount} datapoints</p>
        <small>Updated {new Date(cluster.updatedAt).toLocaleString()}</small>
      </button>
      <div className="cluster-card__editor">
        <input
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      {isExpanded ? (
        <div className="cluster-details">
          <div className="cluster-details__section">
            <h3>Aliases</h3>
            {aliases.length > 0 ? (
              <div className="alias-chips">
                {aliases.map((alias) => (
                  <span key={alias} className="alias-chip">
                    {alias}
                  </span>
                ))}
              </div>
            ) : (
              <p>No aliases stored for this cluster.</p>
            )}
          </div>
          <div className="cluster-details__section">
            <h3>Datapoints</h3>
            <div className="cluster-datapoints">
              {datapoints.map((datapoint) => (
                <div key={datapoint.id} className="cluster-datapoint">
                  <strong>{datapoint.rawName}</strong>
                  <span>{datapoint.identifier}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="cluster-card__actions">
        <button type="button" onClick={() => void onApprove()}>
          Approve
        </button>
        <button type="button" onClick={() => void onReject()}>
          Reject
        </button>
        <button type="button" onClick={() => void onRename(draftLabel)}>
          Update
        </button>
      </div>
    </article>
  );
}
