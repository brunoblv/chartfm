# ChartFM Design System
# Capítulo 6 — Sistema Universal de Cards

Versão 1.0

---

# Objetivo

Os Cards são o principal elemento visual do ChartFM.

Toda interação da plataforma acontece através deles.

Por isso eles não devem ser tratados apenas como componentes.

Eles representam diferentes formas de descoberta.

Cada tipo de conteúdo possui sua própria personalidade.

O usuário deve reconhecer imediatamente o tipo de conteúdo apenas olhando para o card.

Mesmo sem ler.

---

# Filosofia

Não existe "um card".

Existem famílias de cards.

Cada família comunica uma intenção diferente.

Exemplo:

Pessoa

↓

Review

↓

Community

↓

Chart

↓

Artista

↓

Álbum

↓

Discussão

↓

Editorial

Todos possuem identidade própria.

---

# Princípios

Todo card deve responder:

O que é?

↓

Por que devo abrir?

↓

Quem publicou?

↓

O que posso fazer?

Se uma dessas perguntas não for respondida rapidamente, o card precisa ser redesenhado.

---

# Anatomia

Todos os cards compartilham uma estrutura comum.

Header

↓

Conteúdo Principal

↓

Informações Secundárias

↓

Ações

↓

Contexto

Isso cria consistência.

---

# Família 1
# Card Hero

É o maior componente do sistema.

Existe apenas um por página.

---

## Objetivo

Destacar o conteúdo mais importante.

---

## Estrutura

Imagem dominante.

Título.

Descrição.

Tag.

Autor (quando existir).

Call to Action principal.

Call to Action secundário.

---

## Uso

Nunca utilizar em listas.

Nunca repetir.

Nunca utilizar carrossel.

O Hero deve parecer a capa de uma revista.

---

# Família 2
# Card Pessoa

Este passa a ser o card mais importante do produto.

---

## Objetivo

Conectar pessoas.

---

## Estrutura

Foto grande.

Nome.

Compatibilidade.

Badges.

Artistas em comum.

Atividade recente.

Botão Seguir.

Botão Perfil.

---

## Compatibilidade

Mostrar visualmente.

Exemplo.

94%

Não apenas número.

Utilizar barras.

Gradientes.

Indicadores.

---

## Contexto

Sempre explicar.

Exemplo.

Vocês ouviram 37 artistas iguais.

Vocês seguem 12 pessoas iguais.

Vocês participam da mesma Community.

---

## Hover

Mostrar ações rápidas.

Seguir.

Mensagem.

Ver perfil.

---

# Família 3
# Card Review

Um dos componentes mais ricos.

---

## Estrutura

Grande capa.

Nota.

Título.

Trecho.

Autor.

Tempo de leitura.

Comentários.

Curtidas.

---

## Destaques

Editor's Choice

Trending

Mais curtida

Nova

Crítica da Equipe

Esses selos ajudam descoberta.

---

## Hover

Expandir trecho.

Mostrar botão ler.

---

# Família 4
# Card Álbum

---

## Estrutura

Capa dominante.

Nome.

Artista.

Ano.

Nota média.

Quantidade de Reviews.

Quantidade de Charts.

Botão ouvir.

---

## Objetivo

Levar o usuário para o hub do álbum.

---

# Família 5
# Card Artista

---

## Estrutura

Foto.

Nome.

Gênero.

Popularidade.

Seguidores.

Último lançamento.

Botão seguir.

---

## Mostrar

Grandes músicas.

Novidades.

Comunidades.

Reviews.

---

# Família 6
# Card Chart

Este componente deve mudar bastante em relação ao atual.

Hoje ele parece apenas uma lista.

---

## Nova Filosofia

A Chart pertence a alguém.

O autor é protagonista.

---

## Estrutura

Avatar.

Nome.

Título.

Preview das músicas.

Mudança de posição.

Comentários.

Likes.

---

## Preview

Mostrar apenas cinco músicas.

Botão:

Ver Chart completa.

---

# Família 7
# Card Community

---

## Estrutura

Imagem.

Nome.

Tema.

Quantidade de membros.

Atividade.

Última postagem.

Botão participar.

---

## Indicadores

Muito ativa.

Nova.

Popular.

Em crescimento.

Esses indicadores são importantes.

---

# Família 8
# Card Discussão

Muito diferente dos demais.

Pouca imagem.

Muito texto.

---

## Estrutura

Título.

Pergunta.

Autor.

Participantes.

Respostas.

Última atividade.

---

## Objetivo

Estimular comentários.

---

# Família 9
# Card Evento

Novo componente.

---

## Mostrar

Listening Party.

Album Club.

Live.

Evento.

Desafio.

---

## Estrutura

Imagem.

Título.

Data.

Participantes.

Botão participar.

---

# Família 10
# Card Editorial

Muito importante para SEO.

---

## Estrutura

Imagem.

Título.

Categoria.

Resumo.

Autor.

Tempo de leitura.

---

## Pode representar

Artigos.

Guias.

Listas.

Entrevistas.

Especial.

---

# Família 11
# Card Descoberta

É um card inteligente.

Pode representar qualquer conteúdo.

---

## Estrutura

Imagem.

Título.

Motivo.

Botão.

---

## Exemplo

Porque você ouviu Paramore.

Porque você segue Bruno.

Porque esta Review viralizou.

Porque esta Community cresceu.

O motivo sempre aparece.

---

# Família 12
# Card Trending

Utilizado na Sidebar.

Compacto.

Pouca informação.

Atualização frequente.

---

# Estados

Todo card precisa possuir:

Loading.

Hover.

Focus.

Pressed.

Disabled.

Erro.

Vazio.

Sem exceções.

---

# Skeleton

Cada card possui Skeleton próprio.

Nunca utilizar um Skeleton genérico.

O Skeleton deve reproduzir exatamente o layout final.

---

# Responsividade

Desktop

Card completo.

Tablet

Informações reduzidas.

Mobile

Priorização extrema.

Nunca esconder informações aleatoriamente.

Existe uma ordem de prioridade.

---

# Hierarquia

Os cards precisam comunicar importância.

Hero

★★★★★

Pessoa

★★★★★

Review

★★★★☆

Álbum

★★★★☆

Community

★★★★☆

Chart

★★★☆☆

Discussão

★★★☆☆

Trending

★★☆☆☆

---

# Espaçamento

Muito respiro.

Nunca cards colados.

Espaço faz parte da identidade.

---

# Cantos

Levemente arredondados.

Nada exagerado.

A interface deve parecer elegante.

---

# Sombras

Muito discretas.

Utilizar profundidade apenas quando necessário.

Nunca exagerar.

---

# Hover

Todo hover deve transmitir qualidade.

Leve elevação.

Mudança de sombra.

Imagem com pequeno zoom.

Ações aparecem suavemente.

Nunca animações chamativas.

---

# Cliques

Toda área principal do card deve ser clicável.

Botões secundários não devem competir com a ação principal.

---

# Microinformações

Adicionar pequenas informações que geram curiosidade.

Exemplo.

Lido por 438 pessoas.

Comentado há 3 minutos.

Entrou no Top 10 hoje.

Community cresceu 12%.

Esses detalhes tornam a interface viva.

---

# Badges

Os badges devem ser pequenos.

Poucos.

Nunca poluir.

Exemplos.

Novo.

Popular.

Editor's Choice.

Trending.

Exclusivo.

Oficial.

---

# Call To Action

Todo card precisa possuir apenas uma ação principal.

Exemplo.

Pessoa

↓

Seguir.

Review

↓

Ler.

Álbum

↓

Explorar.

Community

↓

Participar.

Chart

↓

Abrir.

Nunca criar dúvida.

---

# Acessibilidade

Todos os cards devem possuir:

Área de clique confortável.

Navegação por teclado.

Labels.

Contraste adequado.

Estados visíveis.

Nunca depender apenas de cor.

---

# Resultado Esperado

Ao navegar pela plataforma, o usuário deve reconhecer instantaneamente cada tipo de conteúdo.

Sem precisar ler títulos.

Os cards tornam-se parte da identidade do ChartFM.

Assim como os tweets são reconhecidos pelo formato e os pins do Pinterest possuem identidade própria, os cards do ChartFM devem ser imediatamente identificáveis.

Eles não são apenas componentes.

Eles são a linguagem visual da plataforma.