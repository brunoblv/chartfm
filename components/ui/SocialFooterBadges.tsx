const SOCIAL_HANDLE = "chartfm_";

function IconInstagram({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconX({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconThreads({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.435 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.119 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.787-2.03.827-.8 1.365-1.877 1.633-3.227l-4.388.002v-2.75h7.038c.074.39.113.796.113 1.217 0 2.41-.655 4.386-1.94 5.878-1.698 1.947-4.094 2.933-7.125 2.933h-.006c-1.794-.012-3.199-.477-4.471-1.363-.954-.65-1.716-1.55-2.263-2.678l2.476-1.136c.382.787.901 1.434 1.528 1.928.926.734 2.088 1.108 3.454 1.108 1.78 0 3.103-.532 4.07-1.63.78-.88 1.172-2.101 1.172-3.636v-.511c-.998.666-2.226 1.032-3.686 1.09h-.063c-1.43 0-2.553-.443-3.335-1.316-.725-.812-1.094-1.93-1.094-3.22 0-1.346.408-2.499 1.212-3.374.908-.98 2.167-1.477 3.74-1.477 1.274 0 2.353.208 3.22.62.73.33 1.37.802 1.91 1.406-.167-1.556.057-2.838.672-3.824.826-1.192 2.348-1.8 4.528-1.8 1.217 0 2.23.116 3.032.347l-.363 2.118c-.658-.196-1.437-.294-2.337-.294-1.055 0-1.858.24-2.387.713-.63.563-.896 1.445-.896 2.625 0 .274.024.531.068.768a5.18 5.18 0 0 1 1.039-1.18c.882-.84 2.007-1.323 3.344-1.436 1.937-.151 3.47.398 4.433 1.619.803 1.02 1.198 2.447 1.198 4.28 0 1.94-.512 3.6-1.524 4.936-1.145 1.516-2.789 2.37-4.895 2.546z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    id: "instagram",
    href: `https://instagram.com/${SOCIAL_HANDLE}`,
    label: "Instagram",
    Icon: IconInstagram,
  },
  {
    id: "x",
    href: `https://x.com/${SOCIAL_HANDLE}`,
    label: "X (Twitter)",
    Icon: IconX,
  },
  {
    id: "threads",
    href: `https://threads.net/@${SOCIAL_HANDLE}`,
    label: "Threads",
    Icon: IconThreads,
  },
] as const;

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--divider)",
  background: "var(--bg)",
  color: "var(--text-muted)",
  textDecoration: "none",
  transition: "color 0.15s, border-color 0.15s, background 0.15s",
};

type SocialFooterBadgesProps = {
  size?: number;
};

export function SocialFooterBadges({ size = 18 }: SocialFooterBadgesProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {SOCIAL_LINKS.map(({ id, href, label, Icon }) => (
        <a
          key={id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`${label}: @${SOCIAL_HANDLE}`}
          aria-label={`${label}: @${SOCIAL_HANDLE}`}
          style={badgeStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.borderColor = "var(--text-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--divider)";
          }}
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  );
}
