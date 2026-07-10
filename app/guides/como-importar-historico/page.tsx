import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como importar seu histórico do Last.fm ou Spotify | Guias ChartFM",
  description:
    "Passo a passo para importar suas músicas mais ouvidas do Last.fm ou do Spotify direto na criação da sua parada semanal.",
  alternates: { canonical: "/guides/como-importar-historico" },
};

export default function GuideImportarHistorico() {
  return (
    <LegalPage
      title="Como importar seu histórico do Last.fm ou Spotify"
      subtitle="Monte sua parada semanal a partir do que você já ouviu"
      sections={[
        {
          title: "O que é a importação de histórico?",
          body: [
            "Na tela de criação de parada (/create), além de adicionar músicas manualmente, você pode importar automaticamente as faixas mais ouvidas da sua conta do Last.fm ou as tocadas recentemente no Spotify.",
            "A importação preenche sua parada com uma lista pronta de músicas, que você ainda pode reordenar, remover ou completar antes de publicar. Ela não publica nada sozinha — o passo de publicação continua manual.",
          ],
        },
        {
          title: "Antes de importar: conecte sua conta",
          body: [
            "Para importar do Last.fm, você precisa ter um nome de usuário Last.fm configurado nas configurações de perfil (/settings). Sem isso, o botão de importação fica desabilitado.",
            "Para importar do Spotify, você precisa conectar sua conta Spotify. Se ainda não conectou, a própria tela de importação mostra um botão 'Conectar' que leva à autorização do Spotify.",
          ],
        },
        {
          title: "Importar do Last.fm",
          body: [
            "Clique no botão de importação do Last.fm na tela de criação de parada. Um modal se abre mostrando sua conta conectada e um controle deslizante para escolher quantas músicas importar, de 1 até 200.",
            "Se a parada é da semana atual, a importação busca suas top tracks do último mês no Last.fm, na mesma ordem oficial do ranking mensal do Last.fm.",
            "Se você está criando a parada de uma semana passada, a importação busca os scrobbles do mês civil correspondente e ordena as músicas por número de execuções (plays) naquele período.",
            "Clique em 'Importar' para preencher a lista. As músicas substituem o que já estava na lista de entradas naquele momento.",
          ],
        },
        {
          title: "Importar do Spotify",
          body: [
            "Clique no botão de importação do Spotify. O modal mostra o status da conexão e um controle deslizante para escolher quantas músicas importar, de 10 até 50 (o padrão é 20).",
            "A importação traz as músicas tocadas mais recentemente na sua conta Spotify, ordenadas da mais recente para a mais antiga.",
            "Clique em 'Importar' para preencher a lista com essas faixas.",
          ],
        },
        {
          title: "Depois de importar",
          body: [
            "Revise a lista importada: reordene as posições, remova músicas que não fazem sentido para aquela semana e adicione outras manualmente se quiser.",
            "Se sua parada tem um tamanho definido nas configurações (por exemplo, 50 posições), músicas além dessa posição são descartadas automaticamente ao publicar. Vale a pena importar mais músicas do que o tamanho da sua parada, para ter opções na hora de reordenar.",
            "A importação não publica a parada. Depois de ajustar a lista, use o botão de publicação normalmente.",
          ],
        },
        {
          title: "Dicas",
          body: [
            "Você pode importar de novo quantas vezes quiser antes de publicar — cada nova importação substitui a lista atual.",
            "Combine os dois métodos: importe do Last.fm para pegar o volume do mês e depois complete manualmente com músicas do Spotify que você ouviu nos últimos dias, ou vice-versa.",
            "Se uma importação falhar por erro de conexão, tente novamente. Se o Spotify pedir reconexão, o botão de conectar aparece de novo no modal.",
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Comece a criação em{" "}
              <InstitutionalInlineLink href="/create">/create</InstitutionalInlineLink>, veja o passo a passo
              completo em{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">
                como criar sua parada semanal
              </InstitutionalInlineLink>{" "}
              e conecte suas contas em{" "}
              <InstitutionalInlineLink href="/settings">/settings</InstitutionalInlineLink>.
            </>,
          ],
        },
      ]}
    />
  );
}
