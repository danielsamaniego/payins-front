// Public API of the shared/api segment. The server-only factory
// (`api.server.ts`) is NOT re-exported here on purpose — importing it must be
// an explicit choice from a server-only module so the `server-only` guard can
// catch accidental client leakage at build time.

export { getApiClient } from "./api.client";
export type { PayinsClient, PayinsClientOptions, PayinsError, RequestOptions } from "@payins/api-client";
