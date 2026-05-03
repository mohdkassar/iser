import type { PanelProps } from "../types/components";

export function Panel({ title, subtitle, action, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">{subtitle ?? "Overview"}</p>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      <div className="panel__content">{children}</div>
    </section>
  );
}
