import type { SelectableListProps } from "../types/components";

export function SelectableList({ items, selectedId, emptyLabel, onSelect }: SelectableListProps) {
  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <div className="list">
      {items.map((item) => (
        <button
          key={item.id}
          className={`list__item ${selectedId === item.id ? "is-selected" : ""}`}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <strong>{item.title}</strong>
          <span>{item.meta}</span>
        </button>
      ))}
    </div>
  );
}
