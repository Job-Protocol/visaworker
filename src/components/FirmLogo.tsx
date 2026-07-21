export function FirmLogo({
  href,
  name,
  logoUrl,
}: {
  href: string | null;
  name: string;
  logoUrl?: string | null;
}) {
  let domain = "";
  if (href) {
    try {
      domain = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
  }
  const initial = name.trim().charAt(0).toUpperCase();
  const explicit = logoUrl?.trim() || "";
  const src =
    explicit || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "");
  // Custom uploaded/pasted logos usually look best filling the tile;
  // fallback favicons stay small and centered like before.
  const imgClass = explicit
    ? "relative h-full w-full object-contain p-0.5"
    : "relative h-5 w-5 object-contain";
  return (
    <span
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-parchment font-serif text-[14px] text-ink/60"
      aria-hidden
    >
      <span className="absolute inset-0 flex items-center justify-center">{initial}</span>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={imgClass}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
