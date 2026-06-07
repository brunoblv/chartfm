import { getServerSession } from "next-auth";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { getCriticsFMAlbums, getTopRatedAlbums } from "@/lib/criticsfm-data";
import { getActiveWeeklyRelease } from "@/lib/weekly-releases";
import { TopAlbumsSection } from "./TopAlbumsSection";
import type { ClubeRoundData } from "@/lib/clube-album";
import type { WeeklyReleaseData, WeeklyReleaseAlbumInfo } from "@/lib/weekly-releases";

export const revalidate = 60;

const PHASE_STATUS: Record<string, { label: string; dot: string; cta: string }> = {
  "0": { label: "Aguardando inscrições", dot: "#86868B", cta: "Ver clube" },
  "1": { label: "Inscrições abertas", dot: "#1B873F", cta: "Indicar álbuns" },
  "2": { label: "Enquete aberta", dot: "#E09F00", cta: "Votar agora" },
  "3": { label: "Resultado publicado", dot: "var(--accent)", cta: "Ver resultado" },
  "4": { label: "Período de escuta", dot: "#5856D6", cta: "Ver clube" },
};

function SectionHeader({
  title,
  subtitle,
  href,
  linkText,
}: {
  title: string;
  subtitle?: string;
  href: string;
  linkText: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "4px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <Link
        href={href}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          paddingTop: 3,
        }}
      >
        {linkText} →
      </Link>
    </div>
  );
}

function LancamentoAlbumCard({ album }: { album: WeeklyReleaseAlbumInfo }) {
  const hue = Math.abs(
    album.title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  ) % 360;

  return (
    <Link
      href={`/criticsfm/${album.albumId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--divider)",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={album.title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `hsl(${hue},50%,60%)`,
                display: "grid",
                placeItems: "center",
                color: "white",
                fontSize: 40,
                fontWeight: 800,
              }}
            >
              {album.title[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 14px 14px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--text)",
            }}
          >
            {album.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {album.artist}
          </div>
          {album.year && (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>
              {album.year}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function LancamentosSection({ release }: { release: WeeklyReleaseData | null }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <SectionHeader
        title="Lançamentos da Semana"
        subtitle={
          release
            ? `Semana de ${release.weekLabel} · ${release.albums.length} álbum${release.albums.length !== 1 ? "s" : ""} em destaque`
            : "Álbuns em destaque para ouvir esta semana"
        }
        href="/criticsfm/lancamentos"
        linkText="Ver todos"
      />
      {!release ? (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--divider)",
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          Nenhum lançamento esta semana. Volte em breve.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap: 14,
          }}
        >
          {release.albums.map((album) => (
            <LancamentoAlbumCard key={album.albumId} album={album} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClubeSection({ round }: { round: ClubeRoundData | null }) {
  const phaseInfo = round ? (PHASE_STATUS[round.phase] ?? PHASE_STATUS["0"]) : null;

  return (
    <section style={{ marginBottom: 48 }}>
      <SectionHeader
        title="Clube do Álbum"
        subtitle="Curadoria coletiva semanal da comunidade ChartFM"
        href="/criticsfm/clube"
        linkText="Ver clube"
      />
      <Link
        href="/criticsfm/clube"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 20,
            border: "1px solid var(--divider)",
            padding: "24px 28px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            cursor: "pointer",
          }}
        >
          {!round ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 14,
                padding: "16px 0",
              }}
            >
              Nenhuma rodada ativa no momento.
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    Rodada #{round.number}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      color: "var(--text)",
                      marginBottom: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {round.theme}
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "var(--fill-inset)",
                      borderRadius: 100,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-subtle)",
                      border: "1px solid var(--divider)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: phaseInfo?.dot,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {phaseInfo?.label}
                  </span>
                </div>
                <div
                  style={{
                    background: "var(--btn-dark-bg)",
                    color: "var(--btn-dark-fg)",
                    padding: "9px 18px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    alignSelf: "center",
                  }}
                >
                  {phaseInfo?.cta} →
                </div>
              </div>
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--divider)",
                  display: "flex",
                  gap: 28,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--text)",
                    }}
                  >
                    {round.nominations.length}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    indicações
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--text)",
                    }}
                  >
                    {round.participantCount}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    membros
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Link>
    </section>
  );
}

export default async function CriticsFMPage() {
  const session = await getServerSession(authOptions);
  const [albums, round, weeklyRelease] = await Promise.all([
    getCriticsFMAlbums(),
    getActiveClubeRound(session?.user?.id ?? null),
    getActiveWeeklyRelease(),
  ]);
  const topAlbums = getTopRatedAlbums(albums);

  return (
    <Shell
      title="CriticsFM"
      subtitle="Reviews e curadoria musical da comunidade ChartFM"
    >
      <p
        style={{
          fontSize: 15,
          color: "var(--text-muted)",
          lineHeight: 1.65,
          marginBottom: 48,
          maxWidth: 580,
          letterSpacing: "-0.01em",
        }}
      >
        Um espaço para os membros do ChartFM avaliarem álbuns, descobrirem novos lançamentos
        e curarem o repertório coletivo da semana através do Clube do Álbum.
      </p>

      <LancamentosSection release={weeklyRelease} />
      <ClubeSection round={round} />
      <TopAlbumsSection albums={topAlbums} />
    </Shell>
  );
}
