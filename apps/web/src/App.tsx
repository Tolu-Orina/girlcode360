import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { RequireOnboarding } from "./components/RequireOnboarding";
import { AppShell } from "./layout/AppShell";
import { AccountPage } from "./pages/AccountPage";
import { CyclePage } from "./pages/CyclePage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HealthPage } from "./pages/HealthPage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { LibraryPage } from "./pages/LibraryPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SharePage } from "./pages/SharePage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TermsPage } from "./pages/TermsPage";
import { VerifyPage } from "./pages/VerifyPage";
import { ZaraPage } from "./pages/ZaraPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/share/:token" element={<SharePage />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireOnboarding>
              <AppShell />
            </RequireOnboarding>
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="cycle" element={<CyclePage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="zara" element={<ZaraPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}
