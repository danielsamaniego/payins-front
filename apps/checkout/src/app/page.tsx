export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Payins Checkout</h1>
      <p className="text-slate-600">
        Public, payer-facing app. Renders hosted/embedded payment UIs per <code>FlowType</code>{" "}
        (card, Pix QR, Boleto voucher, Yape/Nequi enrollment, redirect) for the flows Payins
        renders natively — i.e. the ones that don&apos;t redirect to Stripe/Ebanx.
      </p>
      <p className="text-sm text-slate-500">
        Talks only to the Hono backend through <code>@payins/api-client</code>. Provider SDKs
        tokenize cards in the browser; Payins never sees the PAN.
      </p>
    </main>
  );
}
