import { Link } from "react-router-dom";
import { MarketingFooter, MarketingHeader } from "@/components/blocks/marketing-chrome";
import { marketingPad } from "@/components/blocks/marketing-layout";
import { CURRENT_POLICY_VERSION } from "../lib/api";

export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingHeader />
      <main
        className={`${marketingPad} pt-[calc(var(--space-6)+env(safe-area-inset-top))] pb-[calc(var(--space-8)+env(safe-area-inset-bottom))]`}
      >
        <article className="mx-auto grid w-full max-w-[720px] gap-8">
          <header className="grid gap-4">
            <h1 className="m-0 text-[length:var(--text-page)] text-foreground max-lg:text-[28px]">
              Privacy
            </h1>
            <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
              Notification bodies never include health content. You can export or
              delete your data. Policy version {CURRENT_POLICY_VERSION}. This
              page is a placeholder for internal beta and is not legal advice.
            </p>
          </header>

          <dl className="m-0 grid gap-8">
            <div className="grid gap-2">
              <dt className="font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-bold text-foreground">
                Your consents, your call
              </dt>
              <dd className="m-0 text-[length:var(--text-body)] text-muted-foreground">
                Turn analytics, Alena, HealthLens, and Mirror on or off in
                Account.
              </dd>
            </div>
            <div className="grid gap-2">
              <dt className="font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-bold text-foreground">
                Export or delete
              </dt>
              <dd className="m-0 text-[length:var(--text-body)] text-muted-foreground">
                Download your data as JSON, or request deletion with a 24-hour
                cooling-off window.
              </dd>
            </div>
            <div className="grid gap-2">
              <dt className="font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-bold text-foreground">
                Wellness only
              </dt>
              <dd className="m-0 text-[length:var(--text-body)] text-muted-foreground">
                We never diagnose. Patterns and Prep Cards help you talk to a
                clinician.
              </dd>
            </div>
          </dl>

          <ul className="m-0 grid list-disc gap-3 pl-6 text-[length:var(--text-body)] text-muted-foreground">
            <li>
              We process health and wellness data only with your explicit
              consent.
            </li>
            <li>
              Data is encrypted in transit (TLS) and at rest (AWS KMS) on our
              backend.
            </li>
            <li>
              <strong className="text-foreground">Mirror photos:</strong> face
              and body images used for skin scores and apparel try-on are stored
              only after you grant Mirror consent. They are encrypted at rest,
              never sent to Alena, and are deleted with your account. You can
              withdraw Mirror consent in Account without affecting Cycle, Alena,
              or Wallet.
            </li>
            <li>
              Your region, chosen during onboarding, sets which privacy rules
              apply.
            </li>
            <li>
              <strong className="text-foreground">Health Wallet:</strong>{" "}
              documents are encrypted on your device before upload. Servers
              store ciphertext and wrapped keys only. Time-limited share links
              carry the file key in the URL fragment so it is not sent to our
              servers. Soft-deleted files are purged within 30 days.
            </li>
          </ul>

          <p className="m-0 flex flex-wrap gap-4 text-[length:var(--text-body)]">
            <Link to="/">Back to home</Link>
            <Link to="/terms">Terms of Service</Link>
          </p>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}