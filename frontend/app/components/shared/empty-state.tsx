import type * as React from "react";

/**
 * circuit.rocks admin — EmptyState
 *
 * Teaches the interface rather than just saying "no data". Centered inside a
 * brutalist dashed frame: optional icon, a title, a teaching description, and
 * an optional primary action (e.g. "Create your first order").
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-line bg-paper-2 px-6 py-14 text-center">
      {icon ? (
        <div className="flex size-14 items-center justify-center border-2 border-line bg-paper text-ink shadow-press">
          {icon}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-1.5">
        <h3 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
          {title}
        </h3>
        {description ? (
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-smoke">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
