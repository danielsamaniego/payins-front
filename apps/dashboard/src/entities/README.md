# entities/

FSD `entities/` layer. **Not the DDD concept of an Entity** — the DDD entities of this
product (`Payment`, `Subscription`, `Checkout`, `Invoice`, `Instrument`, `Contract`,
`AdminUser`, …) are owned by the backend (separate, independent project). The frontend
does not have a domain layer.

Here, each slice is a **noun-scoped bundle** of read-side data + presentation:

| Segment | What it holds |
|---|---|
| `model/types.ts` | DTOs/types for the noun (often re-exported from `@payins/types`) |
| `api/<readOnly>.ts` | Read-side data access (`getPayment.ts`, `listSubscriptions.ts`) |
| `ui/<X>Card.tsx`, `<X>Badge.tsx`, … | Presentation components tied to the noun |
| `index.ts` | The slice's public API (re-exports) |

**No domain logic, no mutations, no state machines** — those live in `features/`.

Rules (enforced by `scripts/check-feature-imports.cjs`):

1. A slice may not import a sibling slice (`entities/payment` → `entities/subscription` ❌).
2. Importers reach a slice only through its `index.ts` (deep imports forbidden).
3. May not import from `app/`, `pages/`, `widgets/`, `features/` (those are above this layer).

Full guide: see [docs/frontend-architecture.md](../../../../docs/frontend-architecture.md)
§ "A note on the term `entities/`".
