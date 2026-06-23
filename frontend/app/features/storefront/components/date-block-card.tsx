/**
 * circuit.rocks — DateBlockCard (events)
 * Mono month/day stack in a bordered box, event title in Grotesk, location + time in mono.
 */
export function DateBlockCard({
  month,
  day,
  title,
  location,
  time,
  href = "#",
}: {
  month: string;
  day: string;
  title: string;
  location: string;
  time: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="cr-press flex gap-3.5 border-2 border-line bg-paper p-3.5 no-underline shadow-brutal hover:shadow-press active:shadow-none"
    >
      {/* Date stack */}
      <div className="flex w-16 shrink-0 flex-col justify-center border-2 border-line bg-signal py-2 text-center font-mono font-bold leading-none text-ink">
        <span className="text-xs tracking-[0.06em]">{month}</span>
        <span className="mt-1 text-[1.75rem]">{day}</span>
      </div>
      {/* Body */}
      <div className="flex min-w-0 flex-col justify-center gap-2">
        <span className="font-sans text-base font-semibold leading-tight text-ink">
          {title}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
          {location} · {time}
        </span>
      </div>
    </a>
  );
}
