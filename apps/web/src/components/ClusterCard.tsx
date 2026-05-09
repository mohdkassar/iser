import type { DragEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ClusterCardProps } from "../types/components";

export function ClusterCard({
  cluster,
  datapoints,
  onApprove,
  onReject,
  onRename,
  onMerge,
  draggingClusterId,
  onDragStart,
  onDragEnd,
}: ClusterCardProps) {
  const [draftLabel, setDraftLabel] = useState(cluster.label);
  const [isExpanded, setIsExpanded] = useState(false);
  const hideActions = cluster.type === "room" && cluster.status === "approved";
  const canMerge = cluster.type === "room" && cluster.status === "pending";
  const isDragging = draggingClusterId === cluster.id;
  const isDropTarget = canMerge && draggingClusterId !== null && draggingClusterId !== cluster.id;
  const aliases = Array.isArray(cluster.metadata.aliases)
    ? cluster.metadata.aliases.filter((alias): alias is string => typeof alias === "string")
    : [];

  function handleDragStart(event: DragEvent<HTMLElement>) {
    if (!canMerge) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cluster.id);
    onDragStart(cluster.id);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!isDropTarget) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
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

  return (
    <article
      className={[
        "cluster-card",
        isExpanded ? "is-expanded" : "",
        isDragging ? "is-dragging" : "",
        isDropTarget ? "is-drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={canMerge}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={(event) => void handleDrop(event)}
      onDragEnd={onDragEnd}
    >
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
      {hideActions ? null : (
        <div className="cluster-card__editor">
          <input
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
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
      {hideActions ? null : (
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
      )}
      {cluster.type === "room" ? (
        <Link
          to={`/sites/${cluster.siteId}/rooms/${cluster.id}`}
          className="cluster-card__view-link"
          onClick={(event) => event.stopPropagation()}
        >
          View details
        </Link>
      ) : null}
    </article>
  );
}
