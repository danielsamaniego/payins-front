/**
 * Public Payment Link landing — `/l/:slug`. Server Component: fetches the link metadata
 * from the backend (`GET /l/:slug`) and renders the checkout for the allowed methods.
 * Placeholder for now.
 */
export default async function PaymentLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Payment link</h1>
      <p className="text-slate-600">
        Slug: <code>{slug}</code>
      </p>
      <p className="text-sm text-slate-500">
        TODO: <code>GET /l/{slug}</code> for metadata (amount, currency, allowed methods) and
        render the appropriate per-<code>FlowType</code> UI.
      </p>
    </main>
  );
}
