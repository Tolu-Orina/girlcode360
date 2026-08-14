import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <main className="min-h-dvh bg-background px-4 pt-[calc(var(--space-6)+env(safe-area-inset-top))] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]">
      <article className="mx-auto grid w-full max-w-[720px] gap-4">
        <h1 className="m-0 text-[length:var(--text-page)] text-foreground max-lg:text-[28px]">
          Terms of Service
        </h1>
        <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
          Placeholder terms for GirlCode360 internal beta. Replace with
          counsel-reviewed terms before public launch.
        </p>
        <ul className="m-0 grid list-disc gap-3 pl-6 text-[length:var(--text-body)] text-muted-foreground">
          <li>
            GirlCode360 is a wellness product. It does not diagnose, treat, or
            cure medical conditions.
          </li>
          <li>You must be 18 or older to create an account.</li>
          <li>
            Do not rely on predictions or AI responses for emergency care. Use
            local emergency services.
          </li>
          <li>
            You are responsible for the accuracy of data you log and for keeping
            your account secure.
          </li>
        </ul>
        <p className="m-0 flex flex-wrap gap-4 text-[length:var(--text-body)]">
          <Link to="/onboarding">Back to onboarding</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </article>
    </main>
  );
}