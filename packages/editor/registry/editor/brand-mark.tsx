/** The folded V: two code-like strokes meeting on a single canvas. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M2 7h10l13 27H15L2 7Z" fill="currentColor" />
      <path d="M25 7h13L25 34H15L25 7Z" fill="currentColor" opacity=".65" />
      <path d="m15 34 6-12 4 12H15Z" fill="currentColor" />
    </svg>
  );
}
