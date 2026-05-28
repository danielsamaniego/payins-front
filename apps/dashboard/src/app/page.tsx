export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Payins Dashboard</h1>
      <p className="text-slate-300">
        Superadmin console: configure payment methods, capabilities and commission contracts,
        view integrator platforms, and inspect payments / subscriptions / disputes / webhook
        deliveries (with replay).
      </p>
      <p className="text-sm text-slate-400">
        Auth is owned by the backend (Hono <code>iam</code> feature) behind a swappable port.
        Phase 2 adds a reduced, platform-scoped role for integrator self-service.
      </p>
    </main>
  );
}
