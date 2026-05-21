/**
 * app.config.js
 *
 * Extends app.json with runtime env var support.
 * The expo-router `origin` is read from environment variables so the same
 * codebase works on Replit (dev), Replit Deployments, and Netlify.
 *
 * Priority:
 *   1. EXPO_PUBLIC_APP_ORIGIN   — set explicitly in Netlify / Replit env vars
 *   2. URL                      — Netlify canonical site URL (auto-injected)
 *   3. DEPLOY_PRIME_URL         — Netlify branch/PR deploy URL (auto-injected)
 *   4. https://replit.com/      — safe fallback for local dev
 */

module.exports = ({ config }) => {
  const origin =
    process.env.EXPO_PUBLIC_APP_ORIGIN ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://replit.com/";

  return {
    ...config,
    plugins: [
      ["expo-router", { origin }],
      "expo-font",
      "expo-web-browser",
    ],
  };
};
