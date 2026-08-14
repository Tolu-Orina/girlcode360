import { useState } from "react";
import { leadClass } from "@/components/blocks/app-page";
import { SuccessBanner } from "@/components/blocks/states";
import { Field, FieldSelect, FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import type { ContentReportReason } from "../../../../../packages/api-types/src/index";
import { ApiError, submitContentReport } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";

const REASONS: Array<{ id: ContentReportReason; label: string }> = [
  { id: "inaccurate", label: "Inaccurate" },
  { id: "harmful", label: "Harmful" },
  { id: "spam", label: "Spam" },
  { id: "privacy", label: "Privacy" },
  { id: "other", label: "Other" },
];

export function ArticleReportForm({
  articleId,
  online,
}: {
  articleId: string;
  online: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportReason>("inaccurate");
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
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Report article
      </Button>
    );
  }

  const canSend = Boolean(apiBaseUrl) && online;

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) {
          setError("Connect to send a report.");
          return;
        }
        setBusy(true);
        setError(null);
        void submitContentReport({
          targetType: "article",
          targetId: articleId,
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
        There are no comments or community posts here.
      </p>
      <Field id={`report-reason-${articleId}`} label="Reason">
        <FieldSelect
          id={`report-reason-${articleId}`}
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
        id={`report-details-${articleId}`}
        label="Details (optional)"
        hint="Up to 500 characters. Links are removed."
        error={error ?? undefined}
      >
        <FieldTextarea
          id={`report-details-${articleId}`}
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
