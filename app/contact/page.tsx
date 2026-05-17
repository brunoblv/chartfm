import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Contato | ChartFM",
  description: "Fale com o ChartFM sobre suporte, pedidos de privacidade, remoção de conteúdo, parcerias ou imprensa.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contato"
      subtitle="Suporte, privacidade, parcerias e tudo mais."
      sections={[
        {
          title: "Suporte geral",
          body: [
            "Para dúvidas gerais sobre a plataforma, problemas de conta, relato de bugs ou sugestões de funcionalidades, entre em contato pelo e-mail contato@chartfm.app. Lemos todas as mensagens e respondemos o mais rápido possível, geralmente em até alguns dias úteis.",
            "Ao escrever sobre um problema de conta específico, inclua seu nome de usuário e o e-mail associado à sua conta para que possamos localizar seu perfil sem demora. Quanto mais detalhes você fornecer, mais rápido conseguimos ajudar.",
          ],
        },
        {
          title: "Privacidade e pedidos de dados (LGPD)",
          body: [
            "O ChartFM respeita seus direitos previstos na Lei Geral de Proteção de Dados (LGPD). Você pode solicitar confirmação de tratamento, acesso aos seus dados pessoais, correção de informações incorretas, exclusão ou anonimização, portabilidade, informações sobre compartilhamento e revisão ou retirada de consentimentos.",
            "Para exercer qualquer desses direitos, envie uma mensagem para contato@chartfm.app com o assunto 'Pedido de Privacidade — LGPD'. Inclua seu nome de usuário, o e-mail da sua conta e uma descrição objetiva do pedido. Podemos solicitar confirmação de identidade antes de processar pedidos que envolvam dados sensíveis.",
            "Respondemos a pedidos de privacidade dentro dos prazos exigidos por lei. A complexidade do pedido pode influenciar o tempo de resposta: confirmações simples costumam ser resolvidas rapidamente, enquanto pedidos de exclusão ou portabilidade podem levar mais tempo.",
          ],
        },
        {
          title: "Remoção de conteúdo e moderação",
          body: [
            "Se você acredita que algum conteúdo no ChartFM viola nossos Termos de Uso — incluindo violação de direitos autorais, personificação, assédio ou material ilegal — reporte pelo e-mail contato@chartfm.app com o assunto 'Conteúdo — Remoção'. Inclua o link para o conteúdo específico e uma breve explicação da violação.",
            "Para questões de direitos autorais ou propriedade intelectual, identifique a obra original, o conteúdo infrator na nossa plataforma e confirme que você está autorizado a agir em nome do titular dos direitos.",
          ],
        },
        {
          title: "Parcerias, publicidade e imprensa",
          body: [
            "O ChartFM está aberto a parcerias com artistas, gravadoras, veículos de música e marcas que queiram alcançar fãs engajados. Para propostas comerciais, oportunidades de publicidade ou co-promoção, entre em contato pelo contato@chartfm.app com 'Parceria' no assunto.",
            "Jornalistas, blogueiros e criadores de conteúdo que cobrem música, tecnologia ou cultura digital são bem-vindos para solicitar informações, dados ou entrevistas. Use o mesmo e-mail com 'Imprensa' no assunto.",
          ],
        },
        {
          title: "Prazos de resposta",
          body: [
            "Somos uma equipe pequena. Lemos todas as mensagens, mas os prazos de resposta variam. Dúvidas de suporte gerais recebem resposta em até dois a cinco dias úteis. Pedidos de privacidade são priorizados e tratados conforme os requisitos legais. Denúncias de moderação são analisadas continuamente.",
            "No momento, não oferecemos suporte por telefone. O e-mail é nosso canal principal e mais confiável.",
          ],
        },
      ]}
    />
  );
}
