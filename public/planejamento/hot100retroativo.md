# ChartFM - Hot 100 Retrospectivo

## Visão

O Hot 100 Retrospectivo é um sistema capaz de reconstruir a história musical do usuário mesmo antes da existência dos seus dados no Last.fm.

A ideia não é adivinhar exatamente o que o usuário ouvia, mas estimar quais músicas fariam parte de suas paradas pessoais utilizando uma combinação de:

• Last.fm
• MusicBrainz
• YouTube
• Histórico das Top 20
• Inteligência do algoritmo
• Ajustes manuais do usuário

O usuário sempre terá a palavra final.

---

# Linha do Tempo

## Outubro/2010 em diante

Utilizar dados reais.

Fontes:

✔ Last.fm

Scrobbles por semana

Scrobbles por mês

Scrobbles totais

Primeiro scrobble

Último scrobble

---

## Antes de Outubro/2010

Utilizar algoritmo de estimativa.

Fontes:

• Total geral de plays

• Data do lançamento

• Histórico da Top20

• Quantidade de #1

• Importância da música

• Ajustes manuais

---

# Página

Selecionar:

Ano

Mês

↓

Exemplo

Maio/2005

↓

O sistema procura todas as músicas elegíveis.

---

# Dados exibidos

Tabela

• Capa

• Música

• Artista

• Álbum

• Plays no mês

• Plays totais

• Primeiro scrobble

• Último scrobble

• Data do Single (MusicBrainz)

• Data do Álbum

• Data do Clipe (YouTube)

• Primeira entrada Top20

• Pico

• Semanas

• Quantidade de #1

• Importance

• Peak Potential

• Prioridade

• Score Final

• Elegível

---

# Fontes de Dados

## Last.fm

Scrobbles

Total Plays

Primeiro Play

Último Play

---

## MusicBrainz

Data do Single

Data do Álbum

Release Group

ISRC

País

---

## YouTube

Data do videoclipe oficial

Canal

URL

---

## ChartFM

Entrada Top20

Pico

Semanas

#1

Charts anteriores

Charts posteriores

---

# Elegibilidade

A música somente poderá participar da parada se:

Data do Single <= Data do Chart

Caso não exista:

Data do Álbum

Caso não exista:

Data do Clipe

Caso nenhuma informação exista:

Usuário poderá liberar manualmente.

---

# Importance

A variável mais importante do sistema.

Representa:

"O quanto essa música foi importante na vida do usuário."

Valor

0 a 100

Ela NÃO depende somente de plays.

Pode ser alterada manualmente.

---

## Cálculo inicial

40%

Total de Plays

+

25%

Semanas na Top20

+

15%

Quantidade de #1

+

10%

Pico

+

10%

Recência dos Plays

=

Importance

Depois disso

O usuário poderá alterar.

Nunca mais será recalculada automaticamente.

---

# Editor de Importance

Slider

0 - 100

+

★★★★★

Classificação visual

+

Campo para observações

Exemplo

"A música marcou minha adolescência."

Essas observações poderão ser utilizadas futuramente pela IA.

---

# Peak Potential

Define até onde uma música consegue chegar.

Exemplos

#1

Top 3

Top 5

Top 10

Top 20

Top 40

Top 100

Fora da parada

O algoritmo nunca sugerirá uma posição acima do Peak Potential sem autorização do usuário.

---

# Hit Level

Classificação automática.

Diamond

Platinum

Gold

Silver

Bronze

Critérios

Importance

Plays

#1

Semanas

---

# Era Weight

Nem toda música é forte em todas as épocas.

Exemplo

Mr. Brightside

2004

100

2005

95

2006

90

2010

75

2022

65

---

Outra música

Firework

2004

0

2010

100

2012

90

Isso impede que músicas descobertas muitos anos depois dominem paradas antigas apenas por terem muitos plays atualmente.

---

# Manual Adjustment

O usuário poderá aumentar ou diminuir qualquer música.

Valores

-50

até

+50

Isso será somado ao Score Final.

---

# Score

30%

Plays do período

+

30%

Importance

+

15%

Histórico Top20

+

10%

Recência do lançamento

+

10%

Data do Clipe

+

5%

Ajustes

=

Score Final

---

# Prioridades

## S

Diamond

Muito forte

Provável Top10

---

## A

Muito conhecida

Top20

---

## B

Boa candidata

Top40

---

## C

Pode entrar

Top100

---

## D

Baixa prioridade

Entradas ocasionais

---

# Permanência

O algoritmo estima quantas semanas a música ficará na parada.

Entradas

Importance

Peak Potential

Momentum

Concorrência

Histórico

Resultado

Semanas estimadas

Exemplo

18 semanas

---

# Pico

Também será calculado.

Exemplo

Entrada

#78

↓

#42

↓

#18

↓

#8

↓

#3

↓

#1

↓

#1

↓

#2

↓

#5

↓

#11

↓

Saída

---

# Confiança

Alta

Média

Baixa

Baseada na quantidade de informações disponíveis.

---

# Explicação

Toda sugestão mostrará:

Score

Importance

Motivos

Exemplo

Score

94,3

Importância

96

Peak Potential

#1

Motivos

✔ Muito ouvida

✔ Muitas semanas na Top20

✔ Diversos #1

✔ Lançamento compatível

✔ Clipe lançado antes da data

---

# Modos

## Modo Histórico

Tenta reproduzir o que o usuário realmente ouvia.

Utiliza:

Last.fm

Top20

Histórico

---

## Modo Retrospectivo

Responde:

"Se eu já conhecesse todas essas músicas naquela época, qual seria minha Hot100?"

Permite incluir músicas descobertas anos depois.

---

# Objetivo Final

O Hot100 Retrospectivo deverá permitir que qualquer usuário reconstrua sua história musical desde o ano 2000 (ou antes), utilizando uma combinação de dados reais, estimativas inteligentes e ajustes manuais.

O sistema aprende continuamente com as alterações do usuário, tornando suas sugestões cada vez mais precisas e pessoais.
