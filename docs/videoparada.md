# Sistema de Geração Automática de Vídeos - ChartFM

## Objetivo

Criar um sistema totalmente automatizado para geração de vídeos das paradas do ChartFM utilizando **Remotion**.

O sistema deverá gerar vídeos verticais (Shorts, Reels e TikTok) e também vídeos horizontais ou verticais para o YouTube, utilizando automaticamente os clipes oficiais das músicas.

---

# Tecnologias

- Remotion
- FFmpeg (necessário para cortar e processar vídeos)
- yt-dlp (download dos vídeos)
- React
- Node.js

---

# Estrutura do vídeo

## Introdução

A primeira tela deve apresentar:

- Logo do ChartFM
- Nome da parada
    - Exemplo:
        - Top 20 Global
        - Top 100 Brasil
        - K-Pop Chart
- Semana da parada (quando disponível)
- Identidade visual do ChartFM

Essa tela deverá permanecer por alguns segundos antes do início da contagem.

---

## Ranking

Cada posição deverá conter:

- Número da posição
- Capa do álbum (opcional)
- Nome da música
- Nome do artista
- Lower Third já existente no projeto (reutilizar o componente já implementado no ChartFM)
- Trecho do videoclipe

---

# Transições

## Transição padrão

Criar transições utilizando o Remotion entre todas as posições.

As transições devem envolver:

- troca do número da posição
- troca das informações da música
- troca do videoclipe
- animações suaves

---

## Transição especial para estreias

Caso a música seja uma estreia na parada:

- utilizar uma animação diferenciada
- exibir um selo "NEW"
- permitir efeitos especiais exclusivos

---

# Vídeos

## Download

Utilizar:

- yt-dlp

para localizar e baixar automaticamente os vídeos.

O sistema deverá utilizar FFmpeg para:

- cortar os vídeos
- converter formatos quando necessário
- normalizar resolução
- normalizar áudio

---

## Ordem de preferência

Sempre procurar nesta ordem:

1. Official Music Video
2. Official Video
3. VEVO
4. Performance oficial
5. Live oficial (caso não exista clipe)

NUNCA utilizar:

- Audio
- Official Audio
- Lyrics
- Lyric Video
- Visualizer
- Topic
- Auto-generated
- Fan made

Caso exista um Music Video disponível.

---

## Plataformas

Caso não exista vídeo no YouTube, procurar automaticamente em:

- Vimeo
- Dailymotion
- Outras plataformas suportadas pelo yt-dlp

---

# Escolha do trecho

Por padrão:

Tentar detectar automaticamente o refrão da música para selecionar o trecho utilizado.

Caso não seja possível:

Utilizar um trecho padrão.

---

## Configuração manual

Na página administrativa deverá ser possível definir manualmente:

- URL do vídeo
- Plataforma
- Segundo inicial
- Segundo final

Essas configurações devem sempre ter prioridade sobre a detecção automática.

---

# Duração

## Shorts / Reels / TikTok

Utilizar:

6 segundos de cada música.

---

## Vídeo completo do YouTube

Utilizar:

11 segundos de cada música.

---

# Identidade visual

Utilizar a identidade visual já existente do ChartFM.

Reutilizar:

- Logo
- Cores
- Tipografia
- Componentes
- Lower Third

Evitar criar novos estilos quando já existir um componente equivalente.

---

# Tela final

Ao finalizar o ranking, apresentar:

- Logo ChartFM
- Nome da parada
- Chamada para acessar:
    - chartfm.com
- Texto:
    - Veja a parada completa no ChartFM
- Redes sociais (caso existam)

---

# Administração

Criar uma área administrativa para configurar cada música.

Campos sugeridos:

- URL do vídeo
- Plataforma
- Segundo inicial
- Segundo final
- Utilizar trecho automático (Sim/Não)
- Marcar como estreia
- Ignorar vídeo automático
- Observações

---

# Arquitetura

Separar o projeto em componentes reutilizáveis.

Exemplo:

- Intro
- PositionCard
- VideoPlayer
- LowerThird
- NewEntryAnimation
- Outro
- Transition
- Countdown
- Background

Cada componente deverá ser independente.

---

# Requisitos

- Todo o vídeo deve ser gerado automaticamente.
- Nenhuma edição manual deverá ser necessária após a configuração das músicas.
- O sistema deverá ser reutilizável para qualquer parada do ChartFM.
- O layout deverá ser responsivo para vídeos verticais e horizontais.
- As animações devem ser suaves e consistentes em todo o vídeo.
- O código deve ser organizado, modular e facilmente extensível.



 
Existem APIs que detectam o trecho mais famoso da música.

Exemplos:

Spotify Analysis
EchoNest (legado)
Essentia
modelos de IA para análise de áudio

Cache dos vídeos: se um clipe já foi baixado uma vez, reutilizar o arquivo local para evitar downloads repetidos.
Pré-renderização: baixar todos os vídeos antes de iniciar o Remotion, evitando travamentos durante a renderização.
Templates: permitir múltiplos estilos de vídeo (Global, K-Pop, Brasil, Álbuns etc.) usando o mesmo motor.
Renderização em lote: permitir gerar várias paradas de uma vez (Global, Brasil, K-pop, Álbuns, etc.) com um único comando.
o numero da posição deve ficar no canto superior esquerdo.
