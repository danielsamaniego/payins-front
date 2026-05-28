/**
 * Placeholder login page. The real form + server action lands with the backend's
 * `iam` BC (Phase 2b per `../../../../PAYINS_SERVICE_PLAN.md` §15.2). Today this
 * is a hello-world so the auth gate in `src/middleware.ts` has a destination
 * other than 404, and so the dev workflow can reach the dashboard shell.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Payins Dashboard — Sign in</h1>
      <p className="text-slate-300">
        Login form is not implemented yet. The backend&apos;s <code>iam</code> bounded
        context (Phase 2b) will own admin authentication behind a swappable{" "}
        <code>IAdminAuthenticator</code> port (native argon2id adapter, provider-
        swappable later). Today the auth gate only checks that a session cookie
        exists; it does not yet validate against the backend.
      </p>
      <p className="text-sm text-slate-400">
        To poke around the protected shell in dev, set a fake session cookie in your
        browser: <code>document.cookie = &apos;payins_admin_session=dev&apos;</code>.
      </p>
    </main>
  );
}
