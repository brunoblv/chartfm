import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | Chartify",
  description: "Como o Chartify coleta, usa e protege dados pessoais.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      subtitle="Como tratamos dados pessoais, cookies e escolhas de privacidade."
      updatedAt="03/05/2026"
      sections={[
        {
          title: "1. Dados que coletamos",
          body: [
            "Coletamos dados informados ou gerados durante o uso do Chartify, como nome, e-mail, imagem de perfil, identificador do Google, handle, bio, gêneros musicais, paradas publicadas, curtidas, comentários, reposts, comunidades, posts e preferências de conta.",
            "Também coletamos dados técnicos necessários para segurança, login, prevenção de abuso e funcionamento do serviço, como cookies de sessão, registros de acesso e informações básicas do dispositivo ou navegador.",
          ],
        },
        {
          title: "2. Como usamos os dados",
          body: [
            "Usamos seus dados para criar e manter sua conta, permitir login, publicar paradas musicais, mostrar perfis, calcular rankings, enviar notificações, moderar comunidades, responder solicitações e melhorar a experiência do produto.",
            "Quando houver anúncios ou medição de audiência, poderemos usar cookies e tecnologias semelhantes para medir desempenho, limitar repetição de anúncios e, se você consentir, personalizar conteúdo publicitário.",
          ],
        },
        {
          title: "3. Cookies e consentimento",
          body: [
            "Cookies essenciais são usados para manter login, segurança e recursos básicos. Esses cookies são necessários para o site funcionar.",
            "Cookies não essenciais, como analytics e publicidade personalizada, dependem do seu consentimento. Você pode aceitar todos os cookies ou manter apenas os essenciais pelo banner exibido no site.",
          ],
        },
        {
          title: "4. Compartilhamento",
          body: [
            "Podemos compartilhar dados com provedores necessários ao funcionamento do Chartify, como autenticação Google, hospedagem, banco de dados, ferramentas de segurança, analytics e plataformas de anúncios, sempre limitado à finalidade aplicável.",
            "Paradas, perfis, comentários, comunidades e posts marcados como públicos podem ser vistos por outros usuários e visitantes.",
          ],
        },
        {
          title: "5. Seus direitos pela LGPD",
          body: [
            "Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, eliminação, anonimização quando aplicável, informações sobre compartilhamento e revisão de consentimentos.",
            "Para exercer seus direitos, entre em contato pela página de contato. Podemos solicitar informações adicionais para confirmar sua identidade antes de atender ao pedido.",
          ],
        },
        {
          title: "6. Retenção e segurança",
          body: [
            "Mantemos dados pelo tempo necessário para prestar o serviço, cumprir obrigações legais, resolver disputas e proteger usuários. Quando possível, removemos ou anonimizamos dados que não sejam mais necessários.",
            "Adotamos medidas técnicas e organizacionais para proteger dados pessoais, mas nenhum sistema é completamente imune a incidentes.",
          ],
        },
        {
          title: "7. Alterações",
          body: [
            "Esta política pode ser atualizada para refletir mudanças no produto, exigências legais ou novos parceiros. A data de atualização indica a versão mais recente.",
          ],
        },
      ]}
    />
  );
}
