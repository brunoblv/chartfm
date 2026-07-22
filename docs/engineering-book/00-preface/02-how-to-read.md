# Como Ler Este Livro

Este livro está dividido em duas partes.

## Parte 1 — Fundação

Explica **por que o ChartFM existe**: o problema que resolve, a missão, a visão de produto, os princípios de engenharia e os valores que orientam decisões técnicas e de produto.

Leia esta parte inteira se você está entrando no projeto agora. Ela é curta o suficiente para ser lida em uma sentada e é o contexto necessário para entender todo o resto.

## Parte 2 — Arquitetura

Explica **como o sistema é construído**: a arquitetura geral, o modelo de domínio, como eventos e Analytics fluem pelo sistema, como os dados se movem entre camadas e como o deployment funciona.

Leia esta parte quando for trabalhar em uma área específica do sistema, ou quando precisar entender como um módulo se encaixa no todo.

## O que este livro não é

- Não é a documentação de API — para isso, leia o código em `app/api/`.
- Não é um changelog — para isso, use `git log`.
- Não é um guia de estilo de código — convenções de código ficam no `CLAUDE.md` do repositório.

## Como contribuir

Se você tomar uma decisão arquitetural relevante, ou perceber que um capítulo não reflete mais a realidade do sistema, atualize o capítulo correspondente na mesma mudança. Documentação desatualizada é pior do que nenhuma documentação, porque engana quem confia nela.
