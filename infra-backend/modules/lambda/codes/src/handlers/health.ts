/**
 * Phase 0 health handler — no VPC, no Amplify.
 * Packaged to infra-backend/modules/lambda/codes/dist-health for Terraform archive_file.
 */
export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      ok: true,
      service: "girlcode360-api",
      environment: process.env.ENVIRONMENT ?? "unknown",
      ts: new Date().toISOString(),
    }),
  };
};
