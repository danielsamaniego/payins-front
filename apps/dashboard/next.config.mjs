import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages export TS source, so Next must transpile them.
  transpilePackages: ["@payins/api-client", "@payins/money", "@payins/types"],
};

export default withNextIntl(nextConfig);
