import { AmbientLayer } from "@/components/blocks/ambient-layer";

export function GateScreen({ message }: { message: string }) {
  return (
    <main className="relative grid min-h-dvh place-content-center bg-background px-4">
      <AmbientLayer />
      <p className="relative z-10 m-0 text-[length:var(--text-body)] text-muted-foreground">
        {message}
      </p>
    </main>
  );
}