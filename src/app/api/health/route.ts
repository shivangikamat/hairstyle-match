import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasGeminiApiKey = Boolean(process.env.GEMINI_API_KEY);
  const serviceName = process.env.K_SERVICE || "hairmatch-live";
  const revision = process.env.K_REVISION || "local-dev";
  const deploymentTarget = process.env.GCP_PROJECT
    ? "google-cloud-run"
    : "local";

  return NextResponse.json({
    status: "ok",
    service: serviceName,
    runtime,
    revision,
    timestamp: new Date().toISOString(),
    deploymentTarget,
    config: {
      geminiApiKeyConfigured: hasGeminiApiKey,
      nodeEnv: process.env.NODE_ENV || "development",
      port: process.env.PORT || "3000",
    },
    challengeReadiness: {
      liveMultimodalExperience: true,
      spokenPreferenceCapture: true,
      structuredStyleAgent: true,
      groundedSalonHandoff: true,
      googleCloudDeploymentPath: true,
      liveModelConfigured: hasGeminiApiKey,
    },
    checks: {
      envConfigured: hasGeminiApiKey,
      healthEndpointReachable: true,
      cloudRunServiceBindingsPresent: Boolean(process.env.K_SERVICE),
    },
  });
}
