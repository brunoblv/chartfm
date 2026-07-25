# ChartFM Design System
# Capítulo 2 — Arquitetura da Nova Home

Versão 1.0

---

# Objetivo

Este documento define a arquitetura completa da nova Home do ChartFM.

Não descreve componentes visuais.

Não descreve cores.

Não descreve tipografia.

Ele define a estrutura da experiência.

A Home deve ser construída para maximizar:

- descoberta musical;
- interação entre pessoas;
- tempo de permanência;
- profundidade de navegação;
- retorno diário.

---

# Princípio Fundamental

A Home não é uma Timeline.

A Home é um Discovery Hub.

Essa diferença é extremamente importante.

Uma timeline responde:

"O que aconteceu?"

Um Discovery Hub responde:

"O que vale a pena descobrir agora?"

Toda arquitetura da página deve partir desse princípio.

---

# Objetivos da Arquitetura

A Home deve responder rapidamente às seguintes perguntas:

Quem devo conhecer?

↓

O que devo ouvir?

↓

O que devo ler?

↓

O que está acontecendo?

↓

O que mudou desde minha última visita?

↓

Quais comunidades estão crescendo?

↓

Quais discussões estão interessantes?

↓

Quais Charts merecem atenção?

O usuário nunca deve sentir que existe apenas uma lista infinita de conteúdo.

---

# Estrutura Geral

A nova Home será composta por módulos independentes.

Cada módulo possui:

objetivo

prioridade

algoritmo próprio

layout próprio

métrica própria

Cada módulo poderá evoluir independentemente.

---

# Ordem Geral da Página

A ordem recomendada é:

1. Hero Personalizado

2. Hoje para Você

3. Pessoas para Conhecer

4. Descobertas

5. Reviews em Destaque

6. Lançamentos

7. Charts da Semana

8. Comunidades

9. Conversas

10. Feed

11. Rodapé Editorial

Essa ordem representa uma jornada de descoberta.

Não uma ordem cronológica.

---

# Hero

O Hero é responsável por causar impacto.

Ele ocupa toda a largura da área principal.

Não deve ser um banner.

Não deve ser propaganda.

Ele deve contar uma história.

Exemplos:

"Paramore voltou ao Top 10."

"O novo álbum de Lorde já possui 82 Reviews."

"Seu amigo Bruno publicou uma Chart que combina com você."

Sempre apenas UM destaque.

Nunca mais que isso.

---

# Hoje para Você

Esta será a principal seção da Home.

Ela mistura diversos tipos de conteúdo.

Exemplo:

Review

Álbum

Usuário

Community

Chart

Discussão

Playlist

Tudo dentro do mesmo algoritmo.

O usuário nunca deve saber qual critério escolheu cada item.

A sensação deve ser:

"Isso realmente parece interessante."

---

# Pessoas para Conhecer

Esta seção representa a nova filosofia do produto.

Ela deve aparecer sempre antes dos Charts.

Cada card apresenta:

foto

nome

compatibilidade

artistas em comum

última atividade

botão seguir

motivo da recomendação

Exemplo:

"Vocês ouviram 18 artistas iguais nesta semana."

Esse detalhe aumenta confiança.

---

# Descobertas

Essa seção funciona como sucessora do antigo Discover.

Ela reúne:

álbuns

artistas

músicas

Reviews

listas

posts

Communities

Tudo baseado em afinidade.

Visualmente ela parece um mosaico.

Não uma lista.

---

# Reviews em Destaque

As Reviews passam a ter papel editorial.

Critérios possíveis:

mais curtidas

mais comentadas

mais compartilhadas

curadoria da equipe

tendência

novidade

Cada card mostra:

capa

nota

trecho

autor

tempo de leitura

reações

---

# Lançamentos

Separado das Reviews.

Objetivo:

mostrar novidades.

Pode conter:

álbuns

EPs

Singles

Videoclipes

Relançamentos

Sempre com destaque visual para capas.

---

# Charts

Charts deixam de ser protagonistas.

Agora são consequência da atividade das pessoas.

Cada Chart aparece acompanhada do autor.

Exemplo:

Maria criou uma Chart Pop 2026.

Isso humaniza o conteúdo.

---

# Comunidades

Nova importância.

Cada Community deve parecer viva.

Mostrar:

atividade recente

novos membros

discussão em andamento

última postagem

compatibilidade

Não mostrar apenas quantidade de membros.

---

# Conversas

Nova seção.

Objetivo:

mostrar debates.

Exemplo:

Qual o melhor álbum do ano?

Taylor Swift merece Grammy?

K-Pop está mudando?

Essa seção incentiva comentários.

---

# Feed

O Feed continua existindo.

Mas deixa de ser protagonista.

Ele aparece somente depois das recomendações.

Isso evita que a Home se transforme novamente em uma timeline.

---

# Rodapé Editorial

Antes do Footer tradicional.

Adicionar um bloco editorial.

Pode conter:

Artigo da Semana

Review escolhida pela equipe

Curador em Destaque

Comunidade recomendada

Esse espaço fortalece SEO.

---

# Sidebar Direita

A Sidebar Direita deixa de mostrar apenas informações estáticas.

Ela se torna um painel vivo.

Blocos sugeridos:

Trending

Eventos

Lançamentos

Aniversários

Usuários Online

Charts em crescimento

Comunidades em alta

Review mais curtida

Sempre informações rápidas.

---

# Algoritmos Independentes

Cada módulo possui algoritmo próprio.

Exemplo:

Hero

↓

Escolhe apenas um destaque.

Pessoas

↓

Afinidade.

Reviews

↓

Qualidade.

Comunidades

↓

Engajamento.

Charts

↓

Popularidade.

Conversas

↓

Velocidade de crescimento.

Isso evita repetição de conteúdo.

---

# Diversidade

Nunca mostrar:

cinco Reviews seguidas.

cinco Charts seguidas.

cinco artistas iguais.

Misturar formatos.

Misturar temas.

Misturar gêneros.

Misturar pessoas.

A Home deve parecer dinâmica.

---

# Scroll

O scroll deve transmitir sensação de descoberta.

Cada módulo possui:

título

descrição

espaçamento generoso

identidade própria

botão "Ver mais"

Nunca criar sensação de lista infinita.

---

# Modularidade

Cada bloco da Home é completamente independente.

Isso permite:

ativar

desativar

trocar ordem

A/B Test

novos algoritmos

sem alterar a estrutura da página.

---

# Estados Vazios

Cada módulo deve possuir estado vazio.

Exemplo:

Ainda não encontramos Reviews para você.

Veja os lançamentos desta semana.

Sempre oferecer uma ação.

Nunca deixar espaços vazios.

---

# Skeleton Loading

Todos os módulos possuem Skeleton independente.

O Hero carrega primeiro.

Depois:

Hoje para Você

↓

Pessoas

↓

Descobertas

↓

Reviews

↓

Charts

↓

Feed

A página nunca deve bloquear esperando tudo carregar.

---

# Atualização

A Home nunca faz refresh completo.

Os módulos podem atualizar individualmente.

Exemplo:

Trending muda.

Conversas mudam.

Usuários Online mudam.

Sem alterar o restante da tela.

Isso transmite sensação de plataforma viva.

---

# Regras de UX

O usuário deve encontrar algo interessante em menos de cinco segundos.

Nenhum módulo deve exigir esforço para entender.

Cada seção deve responder claramente:

Por que isso apareceu para mim?

O motivo da recomendação aumenta confiança.

---

# Objetivo Final

Ao terminar de navegar pela Home, o usuário deve ter:

descoberto pessoas;

encontrado músicas;

lido Reviews;

entrado em Communities;

participado de discussões;

e aberto diversas páginas internas.

A Home deixa de ser um destino.

Ela passa a ser o ponto de partida para toda a experiência do ChartFM.

---

# Checklist para o Claude Design

Ao construir o protótipo, garantir que:

- A Home não se pareça com uma timeline.
- Cada seção tenha identidade visual própria.
- Haja ritmo visual entre blocos grandes e pequenos.
- O destaque principal ocupe a atenção inicial sem parecer um anúncio.
- As pessoas sejam mais importantes visualmente do que os Charts.
- O usuário consiga identificar rapidamente novas oportunidades de descoberta.
- Os módulos sejam independentes e expansíveis.
- O layout favoreça a leitura, a exploração e a navegação entre páginas, aumentando retenção e profundidade de sessão.