type Props = { cols?: number; tone?: "purple" | "red" | "green"; className?: string };

/** Server-rack silhouettes with blinking LEDs, pure CSS. */
export function Racks({ cols = 3, tone = "purple", className }: Props) {
  return (
    <div className={`racks ${className ?? ""}`} data-tone={tone} aria-hidden>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className="rack" />
      ))}
    </div>
  );
}
