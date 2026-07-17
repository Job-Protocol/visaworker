export function SealMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`h-8 w-8 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="20" cy="20" r="18.5" className="text-navy" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="14.5" className="text-gold" stroke="currentColor" strokeWidth="0.6" />
      <path
        d="M20 8l2.5 5.2 5.7.6-4.2 3.9 1.2 5.6L20 20.5 14.8 23.3l1.2-5.6L11.8 13.8l5.7-.6L20 8z"
        className="text-crimson"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif tracking-tight text-ink ${className}`}>
      visaworker<span className="italic text-crimson">.ai</span>
    </span>
  );
}
