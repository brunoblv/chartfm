import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso | ChartFM",
  description: "Regras de uso da plataforma ChartFM.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      subtitle="Regras para usar, publicar e participar do ChartFM."
      updatedAt="03/05/2026"
      sections={[
        {
          title: "1. Aceite dos termos",
          body: [
            "Ao acessar ou usar o ChartFM, você concorda com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não utilize a plataforma.",
          ],
        },
        {
          title: "2. Conta e autenticação",
          body: [
            "Você é responsável pelas atividades realizadas na sua conta. O login pode ser feito por provedores externos, como Google, sujeitos também aos termos desses provedores.",
            "Podemos recusar, suspender ou remover contas que violem estes termos, a lei, direitos de terceiros ou a segurança da comunidade.",
          ],
        },
        {
          title: "3. Conteúdo do usuário",
          body: [
            "Você mantém responsabilidade pelo conteúdo que publica, incluindo paradas, comentários, posts, imagens, nomes e descrições. Ao publicar, você nos autoriza a exibir esse conteúdo dentro do ChartFM.",
            "Não publique conteúdo ilegal, ofensivo, discriminatório, enganoso, que viole direitos autorais ou que exponha dados pessoais de terceiros sem autorização.",
          ],
        },
        {
          title: "4. Rankings e disponibilidade",
          body: [
            "Paradas, rankings globais e estatísticas podem ser recalculados, corrigidos ou indisponibilizados em caso de erro técnico, abuso, moderação ou manutenção.",
            "O ChartFM pode mudar recursos, limites, formatos e critérios de exibição para melhorar a plataforma.",
          ],
        },
        {
          title: "5. Publicidade e cookies",
          body: [
            "O ChartFM pode exibir anúncios e usar cookies conforme descrito na Política de Privacidade. Cookies não essenciais dependem do consentimento do usuário quando exigido por lei.",
          ],
        },
        {
          title: "6. Encerramento",
          body: [
            "Você pode parar de usar o serviço a qualquer momento. Determinados dados podem ser mantidos quando necessário para cumprir obrigações legais, prevenir fraude, resolver disputas ou preservar registros públicos da plataforma.",
          ],
        },
        {
          title: "7. Limitação de responsabilidade",
          body: [
            "O ChartFM é fornecido no estado em que se encontra. Embora trabalhemos para manter estabilidade e segurança, não garantimos disponibilidade ininterrupta ou ausência total de erros.",
          ],
        },
      ]}
    />
  );
}
