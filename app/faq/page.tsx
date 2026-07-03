import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalMutedCallout,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Perguntas frequentes | ChartFM",
  description:
    "Respostas para as dúvidas mais comuns sobre o ChartFM: paradas, pontuação do Global 100, Copa, privacidade, comunidades e suporte.",
  alternates: { canonical: "/faq" },
};

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "O que é o ChartFM?",
    answer:
      "O ChartFM é uma rede social para quem gosta de música e quer organizar o que está ouvindo. Cada usuário monta paradas semanais pessoais com as músicas que mais marcaram a semana, e a soma de todas as paradas publicadas forma o Global 100, o ranking coletivo da comunidade.",
  },
  {
    question: "Como eu crio minha primeira parada?",
    answer:
      "Clique em 'Criar Chart' no menu lateral ou acesse a página /create. Busque as músicas pelo nome da faixa ou do artista, adicione até 100 delas à sua lista, defina a ordem das posições e publique. O passo a passo completo está no guia Como criar sua parada semanal.",
  },
  {
    question: "Preciso pagar para usar o ChartFM?",
    answer:
      "Não. Criar conta, publicar paradas, seguir outros usuários e participar de comunidades e da Copa não têm custo no ChartFM.",
  },
  {
    question: "Como funciona a pontuação do Global 100?",
    answer:
      "Cada posição da sua parada pessoal vale pontos para o Global 100, numa curva geométrica: a 1ª posição vale 1.000 pontos e cada posição seguinte vale 95% da posição anterior. Os pontos de todas as paradas publicadas na semana são somados por música para formar o ranking. A fórmula completa e a tabela de posição por pontos estão no guia Como funciona a pontuação.",
  },
  {
    question: "Posso editar uma parada depois de publicada?",
    answer:
      "Sim. Mas a semana do Global 100 fecha toda terça-feira à meia-noite (horário de Brasília) e o snapshot daquela semana é processado poucas horas depois. Depois que o snapshot é gerado, ele fica congelado — edições feitas após o fechamento não mudam mais o histórico da semana já fechada.",
  },
  {
    question: "Minha parada pode ter qualquer gênero musical?",
    answer:
      "Sim. Não existe restrição de gênero, época ou idioma nas paradas pessoais. Você pode misturar estilos livremente — de sertanejo a K-pop na mesma lista — porque cada usuário decide sozinho o que entra na própria parada.",
  },
  {
    question: "O que é a Copa do ChartFM?",
    answer:
      "A Copa é o torneio eliminatório entre artistas do ChartFM, disputado em formato de chaveamento e movido a votos da comunidade em cada confronto — uma competição paralela ao Global 100. As regras completas, com grupos, fases e critérios de desempate, estão em /copa/regras.",
  },
  {
    question: "Como faço para importar meu histórico do Last.fm ou Spotify?",
    answer:
      "Na tela de criação de parada (/create), use o botão de importação do Last.fm ou do Spotify para preencher sua lista automaticamente com as músicas mais ouvidas nessas contas. Antes de importar, é preciso ter um usuário do Last.fm configurado em /settings ou ter conectado sua conta Spotify. A importação só preenche a lista — você ainda revisa e publica manualmente. O passo a passo está no guia Como importar seu histórico do Last.fm ou Spotify.",
  },
  {
    question: "Minhas paradas ficam públicas para todo mundo?",
    answer:
      "Por padrão, sim: seu perfil e suas paradas ficam visíveis para qualquer pessoa no ChartFM. Se preferir mais privacidade, você pode tornar sua conta privada nas configurações — a partir daí, só quem você aprovar consegue ver seu conteúdo.",
  },
  {
    question: "Como funcionam as comunidades?",
    answer:
      "Comunidades são grupos temáticos onde usuários com gostos parecidos se reúnem. Cada comunidade tem seu próprio feed e sua própria parada coletiva, formada automaticamente pela soma das paradas pessoais dos membros naquela semana. Você pode participar de quantas comunidades quiser, e qualquer usuário pode criar uma nova comunidade.",
  },
  {
    question: "Existe um limite de quantas paradas posso publicar por semana?",
    answer:
      "Sim, uma parada semanal por período: o sistema bloqueia uma segunda publicação para a mesma semana ('Você já publicou esta parada nesta semana'). A semana fecha toda terça-feira à meia-noite (horário de Brasília). Também é possível criar a parada de uma semana passada, como registro histórico.",
  },
  {
    question: "Como entro em contato com o suporte?",
    answer:
      "Pela página /support, onde você pode abrir tickets de bugs e sugestões diretamente para a equipe do ChartFM. Para parcerias, imprensa ou dúvidas gerais, use a página /contact.",
  },
];

export default function FaqPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle="Respostas para as dúvidas mais comuns sobre o ChartFM.">
        Perguntas frequentes
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {FAQ_ITEMS.map((item, index) => (
          <div key={item.question} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {index > 0 && <InstitutionalDivider />}
            <InstitutionalSection title={item.question}>
              <InstitutionalParagraph>{item.answer}</InstitutionalParagraph>
            </InstitutionalSection>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <InstitutionalMutedCallout>
          Não encontrou o que procurava? Veja os{" "}
          <InstitutionalInlineLink href="/guides">Guias</InstitutionalInlineLink> ou fale com a gente pela página{" "}
          <InstitutionalInlineLink href="/contact">Contato</InstitutionalInlineLink>.
        </InstitutionalMutedCallout>
      </div>
    </InstitutionalLayout>
  );
}
