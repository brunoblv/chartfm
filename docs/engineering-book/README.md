# ChartFM Engineering Book

Este é o livro de engenharia do ChartFM: o documento vivo que registra por que a plataforma existe, como pensamos sobre produto e engenharia, e como o sistema é construído por baixo do capô.

Ele não substitui o código, os testes ou o `CLAUDE.md` do repositório — esses continuam sendo a fonte de verdade sobre como o sistema funciona hoje. O livro existe para registrar o **porquê** por trás das decisões, algo que o código sozinho não consegue explicar.

## Como está organizado

- **[00-preface/](00-preface/)** — capa, prefácio e como ler este livro.
- **[01-foundation/](01-foundation/)** — manifesto, princípios de engenharia, visão e filosofia de produto, valores centrais e glossário.
- **[02-architecture/](02-architecture/)** — arquitetura do sistema, modelo de domínio, arquitetura de eventos, fluxo de dados e deployment.

Veja o [SUMMARY.md](SUMMARY.md) para o índice completo.

## Como manter este livro

- Escreva em português, em linguagem direta.
- Documente decisões e motivações, não implementação — implementação muda, motivação raramente muda.
- Sempre que uma decisão arquitetural relevante for tomada, ela deve ser refletida aqui.
- Se um capítulo divergir do sistema real, corrija o capítulo — não o contrário.
