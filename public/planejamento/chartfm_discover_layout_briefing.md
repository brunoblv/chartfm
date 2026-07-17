# ChartFM Discover Hub Social — Briefing de Layout

> Documento para orientar a montagem das telas do novo Discover (hub social).
> Complementa `chartfm_discover_hub_social.md` (o quê) com considerações de layout (como).

---

## 1. Contexto do design system atual

O layout deve nascer **dentro do sistema existente**, não como uma página com cara nova:

- **Shell existente**: sidebar fixa à esquerda (desktop), `TopBar` com busca e sino de notificações, `BottomNav` no mobile. O hub ocupa a área de conteúdo do `Shell`, como todas as outras páginas.
- **Cores**: tema claro e escuro via CSS vars. Accent vermelho (`#FA243C` claro / `#FF3B5C` escuro) usado com parcimônia — CTAs, estados ativos, badges de movimento. Fundo neutro, cards com borda sutil.
- **Componentes prontos para reutilizar**: `Avatar`, `Cover` (capas de álbum/single), `FollowButton`, `MovementBadge` (▲▼ de posições), `PositionNumber`, `ScoreSquare`, `AdSlot`.
- **Idioma**: tudo via i18n (pt/en). Nenhum texto hardcoded nos mockups deve ser tratado como final.

---

## 2. Estrutura geral da página (desktop)

Layout em **duas colunas** dentro da área de conteúdo:

```
┌──────────────────────────────────────────────────────────────┐
│ Header do hub: título + composer ("O que você está ouvindo?")│
├───────────────────────────────────┬──────────────────────────┤
│                                   │  SIDEBAR DIREITA (~320px)│
│  FEED (coluna principal, ~640px)  │  🔥 Em Alta              │
│                                   │  🎶 Música da Semana     │
│  [filtro: Seguindo | Todos]       │  📻 Playlist da Comunidade│
│  [chips de tipo de momento]       │  👑 Membros em Destaque  │
│                                   │  🌎 Comunidades em Alta  │
│  ┌─ Card de Momento ─┐            │  📀 Últimas Avaliações   │
│  ┌─ Card automático ─┐            │  [AdSlot]                │
│  ┌─ Card de Momento ─┐            │                          │
│  …scroll infinito…                │                          │
└───────────────────────────────────┴──────────────────────────┘
```

- **Feed com largura máxima ~640px** (padrão de rede social — legibilidade e ritmo de scroll). Não esticar o card em telas largas; centralizar o conjunto feed+sidebar.
- **Sidebar direita com módulos independentes** em cards pequenos, cada um com título + 3–5 itens + link "ver tudo". A sidebar NÃO rola junto com posts fixos (sticky opcional apenas no primeiro módulo).
- **Mobile**: uma coluna. Sidebar vira uma **faixa horizontal de destaque** acima do feed (carrossel de cards "Em Alta" / "Música da Semana") — nunca empurrada para o fim da página, senão morre.

---

## 3. O Composer ("Momento Musical")

Elemento de topo do feed, sempre visível para usuário logado:

- **Estado colapsado**: uma linha com avatar do usuário + placeholder "Compartilhe um momento musical…" + fileira de ícones dos tipos (🎧 💿 🚨 ⭐ 🔍 🎵). Clicar em um ícone já abre o composer com o tipo pré-selecionado.
- **Estado expandido (modal ou inline)**:
  1. Seletor de tipo (chips com emoji + rótulo).
  2. **Busca de música/álbum/artista obrigatória** — todo momento tem uma entidade vinculada. A busca reaproveita o padrão de busca de faixas já usado no create de parada (catálogo local primeiro).
  3. Preview da entidade escolhida (Cover + título + artista) como um "anexo" destacado.
  4. Campo de texto curto (limite ~280 chars — momento, não blogpost).
  5. Botão publicar em accent.
- Regras visíveis no próprio composer: "Descobri Hoje" mostra contador "1 por dia"; tipos automáticos (📈/📉 parada) **não aparecem** no composer.

---

## 4. Anatomia do Card de Momento

Um único componente de card com variações por tipo — nunca 8 layouts diferentes:

```
┌────────────────────────────────────────────┐
│ [Avatar] Nome · @user        [chip do tipo]│  ← header
│ há 2h                                       │
│                                             │
│ "Texto curto do usuário…"                   │  ← corpo (opcional)
│                                             │
│ ┌──────────────────────────────────┐        │
│ │ [Cover 64px] Título da música    │        │  ← anexo da entidade
│ │              Artista · Álbum     │        │     (sempre presente)
│ │              [▶ preview] [+ parada]       │
│ └──────────────────────────────────┘        │
│                                             │
│ ❤️ 12   💬 4   🔄 2                [⋯ menu] │  ← ações
└────────────────────────────────────────────┘
```

- **Chip do tipo** no canto superior direito: emoji + rótulo, com cor de fundo sutil por categoria (tint, nunca cor cheia). É o que dá identidade visual sem quebrar a unidade do card.
- **Anexo da entidade** é o elemento mais importante do card: capa sempre visível, clicável para a página da música/álbum/artista. Ações rápidas no anexo: preview de áudio (se houver) e "+ adicionar à minha parada".
- **Reviews rápidas (⭐)**: mostrar a nota como `ScoreSquare` dentro do anexo.
- **Cards automáticos (📈 subiu / 📉 caiu / 🎉 conquista / vencedores de Copa/Push)**: mesmo card, mas header do sistema ("ChartFM" ou o contexto: "Copa · Final") e `MovementBadge` no anexo. Visual levemente distinto (fundo com tint) para o usuário distinguir gerado-vs-postado sem precisar ler.
- **Lançamento consolidado (🚨)**: card único com stack de avatares ("Ana, Bruno e +5 compartilharam") no header.
- **Comentários**: colapsados por padrão (mostrar 1 mais curtido + "ver todos"), expandem inline sem navegar. Reaproveitar o padrão de like + resposta aninhada já existente nos posts de comunidade.

---

## 5. Filtros do feed

- **Toggle primário**: `Seguindo | Todos` — segmented control no topo do feed, persistente (lembrar escolha). "Seguindo" é o coração do foco em pessoas; se o usuário segue pouca gente, mostrar estado de "poucos momentos" com sugestões de quem seguir (nunca página vazia — filosofia nº 7).
- **Chips secundários por tipo** (Em Loop, Reviews, Lançamentos…): scroll horizontal, opcionais, abaixo do toggle. Não usar dropdown.

---

## 6. Módulos da sidebar

Ordem sugerida (do mais "agora" para o mais estático):

1. **🔥 Em Alta** — top 5 artistas/músicas mais comentados, com Cover pequena e contagem de menções.
2. **🎶 Música da Semana** — vencedora atual em destaque (Cover grande) + CTA de votação quando aberta. Integra com a Votação da Semana existente.
3. **📻 Playlist da Comunidade** — capa da playlist, contagem de contribuições da semana, CTA "adicionar minha música" (estado: já adicionou / ainda não). Link para Spotify.
4. **👑 Membros em Destaque** — top 5 com Avatar + FollowButton inline. É o módulo que mais reforça "pessoas antes da música": pessoas seguíveis a um clique.
5. **🌎 Comunidades em Alta** — chips/cards pequenos com contagem de membros ativos.
6. **📀 Últimas Avaliações** — 3 reviews recentes compactas (Avatar + ScoreSquare + título).
7. **AdSlot** — depois do 2º ou 3º módulo, nunca no topo.

---

## 7. Estados e princípios

- **Nunca página vazia**: feed sem posts → mostrar momentos automáticos do sistema + sugestões de pessoas; módulo sem dados → esconder o módulo, não mostrar "sem resultados".
- **Skeleton loading** nos cards (o feed é a página mais dinâmica do site).
- **Scroll infinito** com paginação por cursor; botão "novos momentos ↑" quando chegar conteúdo novo, em vez de inserir no meio do scroll.
- **Dark mode obrigatório** em todos os mockups — a maioria dos usuários usa tema escuro; desenhar primeiro no escuro e validar no claro.
- **Densidade**: cards respirando (padding generoso), mas anexo compacto — o feed deve mostrar 2,5–3 cards por viewport em desktop.
- **Toque mínimo de gamificação**: badges/conquistas aparecem como cards automáticos no feed, não como widgets separados nesta fase.

---

## 8. Telas a desenhar (escopo do design)

1. **Discover Hub — desktop** (feed + sidebar, estado logado, tema escuro).
2. **Discover Hub — mobile** (uma coluna, carrossel de destaques, BottomNav).
3. **Composer expandido** (com busca de entidade e tipo selecionado).
4. **Card de Momento — variações**: manual (Em Loop), review (com nota), automático (subiu na parada), lançamento consolidado.
5. **Estado vazio / primeiro acesso** (usuário novo, seguindo ninguém).
6. **Versão deslogada** (feed somente leitura + CTA de cadastro no lugar do composer).
