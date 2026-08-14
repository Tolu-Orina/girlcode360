import { useState } from "react";
import { leadClass } from "@/components/blocks/app-page";
import { ErrorBanner, SuccessBanner } from "@/components/blocks/states";
import { Field, FieldSelect, FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import type {
  ContentReport,
  ContentReportReason,
} from "../../../../../packages/api-types/src/index";
import { ApiError, submitContentReport } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";

const REASONS: Array<{ id: ContentReportReason; label: string }> = [
  { id: "inaccurate", label: "Inaccurate" },
  { id: "harmful", label: "Harmful" },
  { id: "spam", label: "Spam" },
  { id: "privacy", label: "Privacy" },
  { id: "other", label: "Other" },
];

export function ContentReportForm({
  targetType,
  targetId,
  online,
  label,
}: {
  targetType: ContentReport["targetType"];
  targetId: string;
  online: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportReason>("harmful");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <SuccessBanner message="Report sent. We aim to review within 24 hours." />
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  const canSend = Boolean(apiBaseUrl) && online;

  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) {
          setError("Connect to send a report.");
          return;
        }
        setBusy(true);
        setError(null);
        void submitContentReport({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        })
          .then(() => setDone(true))
          .catch((err) => {
            setError(
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Could not send report",
            );
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className={leadClass}>
        Reports go to the moderation queue. We aim to review within 24 hours.
      </p>
      {error ? <ErrorBanner message={error} /> : null}
      <Field id={`report-reason-${targetId}`} label="Reason">
        <FieldSelect
          id={`report-reason-${targetId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value as ContentReportReason)}
        >
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </FieldSelect>
      </Field>
      <Field
        id={`report-details-${targetId}`}
        label="Details (optional)"
        hint="Up to 500 characters. Links are removed."
      >
        <FieldTextarea
          id={`report-details-${targetId}`}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !canSend}>
          Send report
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
