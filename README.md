# GirlCode360

All-inclusive women’s beauty and wellness platform (UK · Nigeria · Ghana).

## Documentation

| Document | Description |
| --- | --- |
| [Product Requirements (PRD)](./docs/girlcode-prd.md) | Functional & non-functional requirements |
| [AI Features Spec](./docs/girlcode-ai.md) | Alena, HealthLens (SheMatch deferred) |
| [Roadmap](./docs/girlcode-roadmap.md) | 14-day execution overlay + 6-month strategy |
| [Implementation Plan](./docs/girlcode-implementation-plan.md) | Day-by-day AWS build plan |

## Current build decisions

- **Auth:** Amazon Cognito User Pools with **custom** sign-in / sign-up / forgot-password / verification pages. **Not** Amplify. **Not** Cognito Hosted UI. Client SDK: `amazon-cognito-identity-js`.
- **Client:** Mobile-responsive **PWA** in `apps/web` (bottom tab bar on mobile/standalone).
- **Admin:** `apps/admin` — **LATER** (ops/content scaffold only; not in sprint).
- **Lambda code:** `infra-backend/modules/lambda/codes/`
- **Database:** **Aurora DSQL**. DynamoDB optional for hot counters only.
- **AI:** Amazon Nova 2 Lite on Bedrock only.
- **Out of scope now:** Marketplace and SheMatch.
- **Config:** SSM Parameter Store · Secrets Manager JSON blobs.

