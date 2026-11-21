/** JustNote Learning mark: a note page whose "J" stroke branches into a mind map node. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="JustNote Learning">
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M19 11h21l11 11v31a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V15a4 4 0 0 1 4-4z" fill="var(--accent-foreground, #fff)" />
      <path d="M40 11v8a3 3 0 0 0 3 3h8z" fill="var(--accent)" opacity=".28" />
      <path d="M31 27v14a6.5 6.5 0 0 1-6.5 6.5H23" fill="none" stroke="var(--accent)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 35h8" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="35" r="3.4" fill="var(--accent)" />
      <circle cx="31" cy="25.5" r="2.6" fill="var(--accent)" />
    </svg>
  )
}
