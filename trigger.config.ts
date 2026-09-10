import { defineConfig } from "@trigger.dev/sdk";

/**
 * Trigger.dev v4 (docs/QUESTIONS.md B1). The project ref comes from the Trigger.dev
 * dashboard; this build config is the only file besides lib/env.ts that reads process.env.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_candidatly_not_configured",
  dirs: ["./trigger"],
  runtime: "node-24",
  maxDuration: 900,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
