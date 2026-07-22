# Capítulo 1 — Manifesto, Missão e Visão da Plataforma

> **ChartFM Engineering Book**  
> **Versão:** 1.0  
> **Status:** Draft Oficial  
> **Última atualização:** Julho de 2026

---

# Introdução

Este documento define a visão oficial do ChartFM.

Ele não descreve como o sistema foi implementado.

Ele explica **por que o ChartFM existe**, quais problemas resolve e quais princípios devem orientar toda decisão técnica e de produto.

Toda funcionalidade futura deve respeitar os princípios descritos neste capítulo.

---

# O que é o ChartFM?

O **ChartFM** é uma plataforma social de descoberta musical.

Seu objetivo não é substituir serviços de streaming, nem competir diretamente com plataformas de monitoramento de audições.

O ChartFM existe para conectar pessoas através da música.

A plataforma utiliza **Charts**, **Reviews**, **Comunidades**, **Jogos** e **Recomendações** como ferramentas para estimular a descoberta musical e a interação entre usuários.

Em uma frase:

> **O ChartFM transforma gosto musical em conversa, descoberta e comunidade.**

---

# O Problema

Hoje existem excelentes plataformas para ouvir música.

- Spotify
- Apple Music
- YouTube Music
- Deezer

Também existem plataformas para registrar audições.

- Last.fm

Mas nenhuma delas resolve completamente um problema fundamental:

> **Descobrir música através de pessoas reais.**

Os algoritmos recomendam músicas semelhantes.

As pessoas recomendam experiências.

Existe uma diferença enorme entre:

> "O algoritmo recomenda esta música."

e

> "Esta música mudou minha vida."

O ChartFM existe justamente nesse espaço.

---

# Nossa Missão

Nossa missão é permitir que qualquer pessoa descubra músicas, artistas e álbuns através da experiência de outros usuários.

Não queremos apenas mostrar o que alguém ouviu.

Queremos mostrar:

- Por que aquela música importa;
- Em que contexto ela foi descoberta;
- Quais emoções ela desperta;
- Quais outras pessoas compartilham daquele gosto.

---

# Nossa Visão

Queremos construir a maior comunidade de curadoria musical do mundo.

No ChartFM, cada usuário é um potencial curador.

O valor da plataforma não está apenas no catálogo musical.

Está principalmente nas pessoas.

Quanto melhores forem os curadores, maior será o valor da plataforma.

---

# Nossa Filosofia

O ChartFM segue cinco princípios fundamentais.

## 1. Pessoas antes da Música

O centro da plataforma não é a música.

O centro são as pessoas.

A música é o elo que conecta essas pessoas.

Toda funcionalidade deve responder à pergunta:

> Isso aproxima pessoas?

Se a resposta for **não**, provavelmente não pertence ao ChartFM.

---

## 2. Descoberta antes do Consumo

O objetivo não é apenas reproduzir músicas.

O objetivo é criar momentos de descoberta.

Cada visita ao ChartFM deve aumentar a probabilidade de o usuário encontrar algo novo.

Essa descoberta pode acontecer através de:

- Uma Chart;
- Uma Review;
- Uma Comunidade;
- Um Curador;
- Um comentário;
- Um jogo como Push ou Copa.

---

## 3. Curadoria acima de Popularidade

Popularidade é importante.

Curadoria é mais importante.

Uma Chart com vinte músicas cuidadosamente escolhidas pode gerar mais valor do que uma lista baseada apenas em números de reproduções.

O ChartFM deve incentivar qualidade de recomendação, e não apenas quantidade de conteúdo.

---

## 4. Comunidade como Produto

A comunidade não é um recurso adicional.

Ela é parte central do produto.

Todas as funcionalidades devem fortalecer a interação entre usuários.

Isso inclui:

- Seguir pessoas;
- Comentar;
- Recomendar;
- Criar comunidades;
- Participar de eventos;
- Compartilhar opiniões.

---

## 5. Dados para Melhorar a Experiência

Coletamos dados para melhorar a plataforma.

Nunca para substituir a personalidade dos usuários.

Analytics existe para responder perguntas como:

- Onde as pessoas descobrem mais músicas?
- Quais funcionalidades aproximam usuários?
- O que aumenta a retenção?
- O que gera mais conversas?

Os dados devem orientar decisões, mas nunca substituir o fator humano.

---

# O Papel dos Charts

Os Charts são frequentemente vistos como o produto principal.

Na verdade, eles representam apenas um meio de expressão.

Uma Chart responde à pergunta:

> "O que é importante para mim neste momento?"

Ela funciona como uma fotografia do gosto musical do usuário.

A partir dessa fotografia surgem:

- Descobertas;
- Conversas;
- Comparações;
- Recomendações.

---

# O Papel das Reviews

As Reviews representam a opinião.

Enquanto a Chart mostra preferências, a Review explica essas preferências.

Ela adiciona contexto.

Uma boa Review transforma um álbum em assunto de conversa.

---

# O Papel das Comunidades

Comunidades unem pessoas com interesses semelhantes.

Elas permitem que a descoberta musical aconteça em grupos menores e mais especializados.

Cada comunidade deve desenvolver sua própria identidade.

---

# O Papel do Discover

O Discover é o mecanismo que conecta tudo.

Ele não deve mostrar apenas conteúdo popular.

Ele deve responder à pergunta:

> O que eu provavelmente gostaria de conhecer hoje?

Para isso utiliza:

- Afinidade musical;
- Atividade recente;
- Recomendações de curadores;
- Comunidades;
- Reviews;
- Charts.

---

# O Papel do Feed

O Feed não existe para mostrar uma lista infinita de publicações.

Ele existe para contar a história da comunidade.

Ao abrir o Feed, o usuário deve sentir que está acompanhando a atividade de pessoas reais.

---

# O Papel do Analytics

O Analytics não é um painel de números.

Ele é uma ferramenta de aprendizado.

Seu objetivo é responder perguntas importantes sobre o comportamento da comunidade.

Exemplos:

- Como novos usuários descobrem músicas?
- Quais ações aumentam a retenção?
- Qual funcionalidade gera mais conversas?
- Como podemos melhorar a experiência?

---

# O Papel da Engenharia

A engenharia existe para tornar essa visão possível.

Ela deve priorizar:

- Simplicidade;
- Escalabilidade;
- Observabilidade;
- Qualidade;
- Documentação;
- Automação.

Toda decisão técnica deve considerar o impacto na experiência do usuário e na evolução do produto.

---

# Princípios de Desenvolvimento

Ao desenvolver qualquer funcionalidade para o ChartFM, siga estes princípios:

1. Resolver um problema real do usuário.
2. Reutilizar componentes sempre que possível.
3. Evitar duplicação de regras de negócio.
4. Instrumentar eventos importantes para Analytics.
5. Projetar pensando em crescimento.
6. Documentar decisões arquiteturais relevantes.
7. Manter baixo acoplamento entre módulos.

---

# Como Mediremos o Sucesso

O sucesso do ChartFM não será medido apenas pelo número de usuários.

Também será medido por indicadores como:

- Músicas descobertas através da comunidade;
- Qualidade das interações;
- Retenção dos usuários;
- Crescimento de curadores;
- Participação em comunidades;
- Quantidade de Reviews publicadas;
- Diversidade de artistas descobertos.

Esses indicadores refletem melhor a missão da plataforma do que métricas de vaidade, como visualizações de página.

---

# Visão para os Próximos Anos

O ChartFM deve evoluir para uma plataforma onde:

- Pessoas descubram músicas através de outras pessoas;
- Curadores construam reputação;
- Comunidades criem culturas próprias;
- Jogos incentivem participação;
- Recomendações sejam altamente personalizadas;
- Analytics oriente decisões continuamente;
- A Inteligência Artificial amplifique a curadoria humana, sem substituí-la.

---

# Conclusão

Este capítulo define a identidade do ChartFM.

Todo o restante deste livro — arquitetura, banco de dados, APIs, Analytics, infraestrutura e roadmap — existe para sustentar essa visão.

Sempre que houver dúvida sobre uma decisão técnica ou de produto, a pergunta deve ser:

> **Esta decisão aproxima o ChartFM de sua missão de conectar pessoas por meio da descoberta musical?**

Se a resposta for **sim**, ela está alinhada com os princípios estabelecidos neste livro.

Se a resposta for **não**, vale a pena reavaliar antes de seguir em frente.