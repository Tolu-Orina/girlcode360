import { cn } from "@/lib/utils";

/** Fashion-house still: 4:5 portrait, face crop on the upper third, body crop from the head. */
export function MirrorStill({
  src,
  alt,
  crop = "face",
  className,
}: {
  src: string;
  alt: string;
  crop?: "face" | "body" | "result";
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "m-0 w-full overflow-hidden bg-muted",
        "max-lg:-mx-4 max-lg:w-[calc(100%+2rem)] max-lg:rounded-none",
        "lg:rounded-[var(--radius)] lg:border lg:border-border",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "block aspect-[4/5] w-full object-cover",
          crop === "body" ? "object-[center_12%]" : "object-[center_18%]",
        )}
      />
    </figure>
  );
}
