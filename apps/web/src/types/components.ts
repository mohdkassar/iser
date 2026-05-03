import type { ClusterSummary, DatapointSummary } from "@iser/shared";
import type { PropsWithChildren, ReactNode } from "react";

export type PanelProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

export type SelectableListItem = {
  id: string;
  title: string;
  meta: string;
};

export type SelectableListProps = {
  items: SelectableListItem[];
  selectedId: string | null;
  emptyLabel: string;
  onSelect: (id: string) => void;
};

export type ClusterCardProps = {
  cluster: ClusterSummary;
  datapoints: DatapointSummary[];
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRename: (label: string) => Promise<void>;
};
