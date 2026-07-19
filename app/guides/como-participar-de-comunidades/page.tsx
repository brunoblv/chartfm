import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { InstitutionalInlineLink } from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Como participar de comunidades | Guias ChartFM",
  description:
    "Guia completo sobre comunidades no ChartFM: como entrar, o que são as paradas coletivas, como interagir com outros membros e como criar sua própria comunidade musical.",
  alternates: { canonical: "/guides/como-participar-de-comunidades" },
};

export default function GuideComunidades() {
  return (
    <LegalPage
      title="Como participar de comunidades"
      subtitle="Conecte-se com pessoas que ouvem o que você ouve"
      sections={[
        {
          title: "O que são as comunidades do ChartFM?",
          body: [
            "Comunidades são grupos temáticos dentro do ChartFM onde usuários com gostos musicais parecidos se reúnem para discutir lançamentos, compartilhar descobertas e construir charts coletivas. Cada comunidade tem seu próprio feed, sua própria parada semanal e seu próprio grupo de membros.",
            "Diferente de grupos genéricos em redes sociais, as comunidades do ChartFM são organizadas em torno da música. Podem existir comunidades dedicadas a um gênero específico (como indie rock ou K-Pop), a um artista, a uma era musical, a um movimento cultural ou a qualquer outra afinidade musical que faça sentido para um grupo de pessoas.",
            "A grande diferença em relação a outras plataformas é a parada coletiva: toda semana o ChartFM congela um snapshot das charts individuais dos membros (no mesmo modelo do Global 100), gerando um ranking exclusivo da comunidade.",
          ],
        },
        {
          title: "Como encontrar e entrar em uma comunidade",
          body: [
            "Acesse a página de Comunidades pelo menu lateral. Lá você encontra uma lista de todas as comunidades públicas, organizadas por número de membros e atividade recente. Use a barra de busca para filtrar por nome ou tema.",
            "Ao encontrar uma comunidade que te interessa, clique em 'Participar'. Para comunidades públicas, a entrada é imediata, você já começa a ver o feed e a parada coletiva do grupo.",
            "Você pode participar de múltiplas comunidades ao mesmo tempo. Não há limite. Muitos usuários participam de comunidades de gêneros diferentes ou de comunidades dedicadas a artistas específicos que acompanham.",
          ],
        },
        {
          title: "A parada coletiva da comunidade",
          body: [
            "O recurso mais exclusivo das comunidades no ChartFM é a parada coletiva semanal. Toda semana o sistema congela um snapshot das charts individuais dos membros e gera um ranking exclusivo daquela comunidade — igual ao Global 100, a semana já publicada não muda depois.",
            "Esse ranking usa a pontuação configurada da comunidade (pontos da parada do membro ou tabela custom). Só entram as paradas dos membros no momento do congelamento; quem entra depois não altera semanas antigas.",
            "Isso significa que a parada de uma comunidade de fãs de jazz vai refletir o que os amantes de jazz estavam ouvindo naquela semana, não o que domina o ranking global. É uma forma mais precisa de acompanhar tendências dentro de um nicho.",
          ],
        },
        {
          title: "Como interagir dentro de uma comunidade",
          body: [
            "Dentro de uma comunidade, você pode publicar posts no feed do grupo. Compartilhe opiniões sobre lançamentos, discuta posições no ranking da semana, apresente descobertas recentes ou abra discussões sobre artistas e álbuns.",
            "Posts da comunidade ficam visíveis apenas para os membros, criando um espaço mais íntimo de troca em relação ao feed geral da plataforma. Outros membros podem curtir, comentar e repostar suas publicações dentro do grupo.",
            "Acompanhe também a atividade dos outros membros: veja quais músicas eles estão chartando, quais artistas estão ganhando força dentro do grupo e como o ranking coletivo evolui semana a semana.",
          ],
        },
        {
          title: "Como criar sua própria comunidade",
          body: [
            "Qualquer usuário pode criar uma comunidade no ChartFM. Acesse 'Criar Comunidade' na página de Comunidades e defina nome, descrição, ícone e as cores do tema visual.",
            "Ao criar uma comunidade, você se torna automaticamente o administrador do grupo. Isso significa que você pode editar as configurações, moderar posts e convidar novos membros.",
            "Comunidades podem ser públicas (qualquer pessoa pode entrar) ou privadas (entrada mediante convite). Para comunidades temáticas ou de fãs, o modelo público tende a crescer mais rápido. Para grupos fechados de amigos ou colegas, o modelo privado faz mais sentido.",
            "Uma comunidade começa a ter vida quando seus membros publicam charts regularmente. Incentive quem você convida a publicar paradas semanais, é isso que alimenta a chart coletiva e torna o grupo mais dinâmico.",
          ],
        },
        {
          title: "Leia também",
          body: [
            <>
              Veja a lista de comunidades ativas em{" "}
              <InstitutionalInlineLink href="/communities">/communities</InstitutionalInlineLink>, aprenda a{" "}
              <InstitutionalInlineLink href="/guides/como-criar-sua-parada">montar sua parada semanal</InstitutionalInlineLink>{" "}
              e confira o{" "}
              <InstitutionalInlineLink href="/guides/glossario">glossário de termos</InstitutionalInlineLink> do ChartFM.
            </>,
          ],
        },
      ]}
    />
  );
}
