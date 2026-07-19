import { Link } from "react-router-dom";
import "./onboarding.css";

export function TermsPage() {
  return (
    <main className="legal-page">
      <h1>Terms of Service</h1>
      <p>
        Placeholder terms for GirlCode360 internal beta. Replace with counsel-
        reviewed terms before public launch.
      </p>
      <ul>
        <li>
          GirlCode360 is a wellness product. It does not diagnose, treat, or
          cure medical conditions.
        </li>
        <li>You must be 18 or older to create an account.</li>
        <li>
          Do not rely on predictions or AI responses for emergency care — use
          local emergency services.
        </li>
        <li>
          You are responsible for the accuracy of data you log and for keeping
          your account secure.
        </li>
      </ul>
      <p>
        <Link to="/onboarding">Back to onboarding</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
      </p>
    </main>
  );
}
