import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Contato | Chartify",
  description: "Canais de contato do Chartify.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contato"
      subtitle="Fale com o Chartify sobre suporte, privacidade ou parcerias."
      sections={[
        {
          title: "Suporte e privacidade",
          body: [
            "Para suporte, pedidos relacionados a dados pessoais, revisão de consentimento, remoção de conteúdo ou dúvidas sobre LGPD, envie uma mensagem para: contato@chartify.app.",
            "Ao escrever, inclua o e-mail da sua conta, seu handle e uma descrição objetiva do pedido para que possamos localizar as informações corretas.",
          ],
        },
        {
          title: "Prazos",
          body: [
            "Pedidos de privacidade serão analisados conforme a LGPD e podem exigir confirmação de identidade. Responderemos assim que possível, considerando a complexidade do pedido.",
          ],
        },
        {
          title: "Parcerias e anúncios",
          body: [
            "Para assuntos comerciais, parcerias, publicidade ou imprensa, use o mesmo contato e indique o tema no assunto da mensagem.",
          ],
        },
      ]}
    />
  );
}
