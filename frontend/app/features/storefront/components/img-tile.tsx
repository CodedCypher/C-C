import { cn } from "~/lib/utils";

/**
 * circuit.rocks — ImgTile
 * Datasheet-aesthetic placeholder: bordered tile, diagonal hatch, inner square,
 * mono filename caption. Stands in for product photography.
 */
const HATCH =
  "repeating-linear-gradient(45deg, transparent, transparent 13px, rgba(20,20,20,0.04) 13px, rgba(20,20,20,0.04) 14px)";

export function ImgTile({
  label,
  ratio = "1 / 1",
  className,
}: {
  label: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-2 border-line bg-paper",
        className,
      )}
      style={{ aspectRatio: ratio, backgroundImage: HATCH }}
    >
      <div className="h-[52%] w-[52%] border-2 border-line bg-paper-2" />
      <span className="absolute bottom-2.5 left-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
        img: {label}
      </span>
    </div>
  );
}
