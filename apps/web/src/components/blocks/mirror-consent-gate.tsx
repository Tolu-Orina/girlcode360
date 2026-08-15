import { Camera, Lock, ScanFace } from "lucide-react";
import { Link } from "react-router-dom";
import { ActionRow, leadClass } from "@/components/blocks/app-page";
import { MirrorStage, MirrorStageEmpty } from "@/components/blocks/mirror-stage";
import { PageHeader } from "@/components/blocks/page-header";
import { ErrorBanner } from "@/components/blocks/states";
import { Button } from "@/components/ui/button";

export function MirrorConsentGate({
  processorLead,
  busy,
  blocked,
  error,
  onAllow,
  onSkip,
}: {
  processorLead: string;
  busy: boolean;
  blocked: boolean;
  error: string | null;
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-start lg:gap-8">
      <MirrorStage>
        <MirrorStageEmpty
          sampleFace
          label="Empty mirror. A face photo will sit here after you allow Mirror."
        />
      </MirrorStage>

      <div className="grid gap-6">
        <PageHeader
          eyebrow="Mirror"
          title="Photos for skin and try-on"
          lead="A face still for scores and makeup. A full-body still for clothes. Photos stay on this device until you send one to YouCam. Alena never sees them."
        />

        <ul className="m-0 grid list-none gap-4 p-0">
          <li className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-1">
            <ScanFace className="mt-0.5 size-6 text-primary" aria-hidden />
            <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
              One still, not a live stream
            </p>
            <p className="col-start-2 m-0 text-[length:var(--text-body)] text-muted-foreground">
              Capture is a photo. You can reuse it across Skin, Makeup, and Hair.
            </p>
          </li>
          <li className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-1">
            <Camera className="mt-0.5 size-6 text-primary" aria-hidden />
            <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
              YouCam only when you run a look
            </p>
            <p className="col-start-2 m-0 text-[length:var(--text-body)] text-muted-foreground">
              Perfect Corp. returns scores or a try-on image. We copy the result here.
            </p>
          </li>
          <li className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-1">
            <Lock className="mt-0.5 size-6 text-primary" aria-hidden />
            <p className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
              You can say no
            </p>
            <p className="col-start-2 m-0 text-[length:var(--text-body)] text-muted-foreground">
              Cycle, Health, Alena, and Wallet stay available.
            </p>
          </li>
        </ul>

        <p className={leadClass}>{processorLead}</p>
        {error ? <ErrorBanner message={error} /> : null}

        <ActionRow>
          <Button type="button" disabled={busy || blocked} onClick={onAllow}>
            Allow Mirror photos
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onSkip}>
            Not now
          </Button>
        </ActionRow>
        <p className={leadClass}>
          Change this later in{" "}
          <Link to="/app/account" className="font-semibold text-primary">
            Account
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
