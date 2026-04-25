import Link from "next/link";
import { Search } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { COMMUNITIES, USERS_DATA } from "@/lib/data";

export default function CommunitiesPage() {
  const myComms = COMMUNITIES.slice(0, 3);
  const exploreComms = COMMUNITIES;

  return (
    <Shell title="Comunidades" subtitle="Encontre sua tribo musical">
      {/* Header actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, alignItems: "center" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "white", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10,
          padding: "10px 14px",
        }}>
          <Search size={16} color="#86868B" />
          <input placeholder="Buscar comunidades..." style={{ border: "none", outline: "none", fontSize: 14, color: "#1D1D1F", flex: 1, background: "transparent" }} />
        </div>
        <Link href="/community/create" style={{
          background: "#FA243C", color: "white", textDecoration: "none",
          padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 700,
          boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
        }}>
          Criar comunidade
        </Link>
      </div>

      {/* Suas comunidades */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Suas comunidades</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {myComms.map((c) => (
            <Link key={c.id} href={`/community/${c.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)",
                padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                }}>
                  {c.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#86868B" }}>{c.members.toLocaleString("pt-BR")} membros</div>
                  <div style={{ fontSize: 12, color: "#FA243C", fontWeight: 600, marginTop: 2 }}>12 posts novos</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Explorar */}
      <section>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Explorar comunidades</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {exploreComms.map((c) => (
            <div key={c.id} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {/* Banner */}
              <div style={{
                height: 120,
                background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 56 }}>{c.icon}</div>
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                  color: "white", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                }}>
                  {c.members.toLocaleString("pt-BR")} membros
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 18px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "#86868B", marginBottom: 14, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>
                  {c.tagline}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Avatar stack */}
                  <div style={{ display: "flex" }}>
                    {(c.memberSample ?? []).slice(0, 3).map((u, i) => (
                      <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid white", borderRadius: "50%" }}>
                        <Avatar user={u} size={24} />
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: "#86868B" }}>{c.posts} posts</span>
                  <div style={{ flex: 1 }} />
                  <Link href={`/community/${c.slug}`} style={{
                    background: "#1D1D1F", color: "white", textDecoration: "none",
                    padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>
                    Participar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
