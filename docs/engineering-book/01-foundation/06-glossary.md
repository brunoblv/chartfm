# Capítulo 6 — Glossário do Projeto

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Documento Vivo

---

# Objetivo

Este glossário reúne os principais termos utilizados no ChartFM.

Seu objetivo é padronizar a linguagem utilizada em todo o projeto, evitando ambiguidades entre documentação, código e discussões de produto.

Sempre que um novo conceito for introduzido na plataforma, este documento deverá ser atualizado.

---

# Estrutura do Glossário

Cada termo possui:

- definição;
- objetivo;
- relacionamento com outros conceitos;
- observações quando necessário.

---

# A

## Activity

Registro de uma ação realizada por um usuário dentro da plataforma.

Exemplos:

- criou uma Chart;
- publicou uma Review;
- entrou em uma comunidade;
- comentou uma publicação.

As Activities alimentam o Feed e o Analytics.

---

## Album

Representa um álbum musical cadastrado na plataforma.

Pode possuir:

- artistas;
- faixas;
- capas;
- datas;
- gêneros;
- avaliações;
- Reviews.

---

## Album Club

Espaço onde a comunidade discute um álbum específico durante um período determinado.

Pode conter:

- votação;
- comentários;
- Reviews;
- notas.

---

## Analytics

Conjunto de métricas e eventos utilizados para compreender o comportamento dos usuários e apoiar decisões de produto.

---

## Analytics Event

Evento registrado quando uma ação relevante acontece na plataforma.

Exemplos:

- chart_created
- review_published
- follow_user
- push_vote
- community_join

Todos os eventos possuem timestamp e metadados.

---

# C

## Chart

Lista organizada de músicas publicada por um usuário.

Representa um recorte do gosto musical em determinado contexto.

Uma Chart pode ser:

- semanal;
- mensal;
- temática;
- pessoal;
- especial.

---

## Chart Snapshot

Registro imutável de uma Chart em determinado momento.

Utilizado para histórico e análises.

---

## Community

Grupo de usuários reunidos por interesse comum.

Pode possuir:

- membros;
- moderadores;
- regras;
- eventos;
- publicações.

---

## Curador

Usuário reconhecido por recomendar músicas, artistas ou álbuns relevantes.

Todo usuário pode se tornar um curador.

---

# D

## Discover

Sistema responsável por recomendar conteúdo relevante ao usuário.

Pode recomendar:

- músicas;
- artistas;
- usuários;
- comunidades;
- Reviews;
- Charts.

---

## Discover Score

Pontuação utilizada para ordenar recomendações.

Pode considerar fatores como:

- afinidade musical;
- popularidade;
- novidade;
- relevância;
- relacionamento entre usuários.

---

## Domain

Conjunto de funcionalidades relacionadas a um mesmo contexto de negócio.

Exemplos:

- Charts;
- Reviews;
- Communities;
- Feed;
- Analytics.

---

# E

## Event

Representa algo que aconteceu na plataforma.

Eventos conectam diferentes módulos do sistema.

Exemplo:

Chart criada.

↓

Analytics registra.

↓

Feed atualiza.

↓

Notificações são enviadas.

---

## Event Bus

Camada responsável por distribuir eventos entre módulos.

Seu objetivo é reduzir o acoplamento do sistema.

---

# F

## Feed

Linha do tempo da plataforma.

Mostra atividades relevantes da comunidade.

Não deve ser apenas cronológica.

Pode considerar:

- relevância;
- afinidade;
- interações.

---

## Follow

Relacionamento onde um usuário acompanha outro.

Esse relacionamento influencia:

- Feed;
- Discover;
- recomendações;
- notificações.

---

# G

## Gamificação

Conjunto de mecânicas que incentivam participação.

Exemplos:

- conquistas;
- níveis;
- badges;
- missões;
- rankings.

---

# I

## Insight

Conclusão produzida a partir de dados.

Exemplo:

"Usuários que publicam Reviews retornam 35% mais."

---

# M

## Member

Usuário pertencente a uma comunidade.

---

## Moderador

Usuário responsável por administrar uma comunidade.

Pode:

- remover conteúdo;
- aprovar publicações;
- aplicar regras.

---

# N

## Notification

Mensagem enviada ao usuário para informar um evento relevante.

Pode ser:

- em tempo real;
- push;
- e-mail;
- interna.

---

# P

## Playlist

Lista de músicas criada pelo usuário.

Diferentemente de uma Chart, possui foco em reprodução.

---

## Profile

Página pública de um usuário.

Exibe:

- Charts;
- Reviews;
- estatísticas;
- seguidores;
- atividade.

---

## Push

Jogo social onde usuários promovem músicas por meio de votos ou desafios.

Possui regras próprias e ranking específico.

---

# R

## Recommendation

Sugestão personalizada produzida pelo sistema.

Pode recomendar:

- músicas;
- artistas;
- usuários;
- comunidades;
- Reviews.

---

## Reputation

Indicador da credibilidade de um usuário dentro da plataforma.

Pode considerar:

- atividade;
- qualidade das Reviews;
- participação;
- reconhecimento da comunidade.

---

## Review

Texto publicado por um usuário avaliando um álbum, música ou artista.

Seu objetivo principal é compartilhar experiências.

---

# S

## Scrobble

Registro de reprodução importado de serviços externos como Last.fm.

Serve como uma das fontes de dados da plataforma.

---

## Snapshot

Registro histórico imutável de uma informação.

Utilizado para preservar estados passados.

---

# T

## Tag

Palavra utilizada para categorizar conteúdo.

Pode identificar:

- gêneros;
- temas;
- moods;
- décadas.

---

## Timeline

Representação cronológica das atividades de um usuário.

---

# U

## User

Pessoa cadastrada na plataforma.

Pode:

- publicar;
- comentar;
- seguir;
- criar comunidades;
- votar;
- recomendar.

---

# V

## Vote

Ação utilizada para apoiar determinado conteúdo.

Pode ser utilizada em:

- Push;
- Copa;
- enquetes;
- Album Club.

---

# W

## Weekly Chart

Chart correspondente a uma semana específica.

Representa um dos principais tipos de Chart do sistema.

---

# Conceitos Arquiteturais

## Service

Camada responsável pelas regras de negócio.

---

## Repository

Camada responsável pelo acesso ao banco de dados.

---

## DTO

Objeto utilizado para transporte de dados entre camadas.

---

## API

Interface utilizada para comunicação entre frontend e backend.

---

## Hook

Função reutilizável responsável por encapsular lógica da interface.

---

## Component

Elemento reutilizável da interface.

---

## Entity

Representação de um objeto de negócio persistido no banco de dados.

---

## Aggregate

Conjunto de entidades tratadas como uma única unidade de consistência.

Conceito inspirado em Domain-Driven Design (DDD).

---

## Bounded Context

Limite entre diferentes domínios do sistema.

Exemplo:

O domínio de Charts não deve depender diretamente do domínio de Communities.

---

# Convenções de Nomenclatura

Sempre utilizar termos consistentes em todo o projeto.

| Conceito | Nome Oficial |
|-----------|--------------|
| Chart | Chart |
| Review | Review |
| Community | Community |
| Discover | Discover |
| Feed | Feed |
| Push | Push |
| Album Club | Album Club |
| Analytics | Analytics |
| Snapshot | Snapshot |
| Event | Event |
| Curador | Curator |
| Seguidor | Follower |
| Reputação | Reputation |

---

# Manutenção

Este documento deve ser atualizado sempre que:

- um novo domínio for criado;
- um novo conceito surgir;
- uma funcionalidade importante for adicionada;
- um termo passar a fazer parte da linguagem oficial do projeto.

O glossário é uma referência permanente para toda a equipe e deve permanecer alinhado com a evolução da plataforma.