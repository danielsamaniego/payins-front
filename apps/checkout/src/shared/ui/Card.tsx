import type { ReactNode } from "react";

/**
 * Container card — the standard surface every checkout panel sits on.
 * Pure presentation; no state, no client behaviour.
 */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold tracking-tight text-slate-900">{children}</h2>;
}
