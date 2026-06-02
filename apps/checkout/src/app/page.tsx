export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Payins Checkout</h1>
      <p className="text-slate-600">
        Public, payer-facing app. Buyers reach a real checkout via{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">/c/&lt;sessionId&gt;</code> —
        the integrator hands them that URL after creating a PaymentSession.
      </p>
      <p className="text-sm text-slate-500">
        Provider SDKs tokenize cards in the browser; Payins never sees the PAN.
      </p>
    </main>
  );
}
