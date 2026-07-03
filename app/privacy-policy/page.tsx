import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Política de Privacidade | ChartFM",
  description:
    "Saiba como o ChartFM coleta, usa e protege seus dados pessoais, incluindo cookies e direitos pela LGPD.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="julho de 2026">Política de Privacidade</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title="1. Quem somos">
          <InstitutionalParagraph>
            O ChartFM é uma plataforma de paradas musicais criadas por usuários. Esta política explica como coletamos,
            usamos e protegemos os seus dados pessoais.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="2. Dados que coletamos">
          <InstitutionalParagraph>Coletamos apenas os dados necessários para o funcionamento da plataforma:</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>Dados de cadastro:</strong> nome, e-mail e senha (armazenada de
                forma criptografada)
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Dados de uso:</strong> paradas criadas, músicas votadas e
                interações com outros usuários
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Dados técnicos:</strong> endereço IP, tipo de dispositivo e
                navegador, para segurança e diagnóstico
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Cookies:</strong> utilizamos cookies para manter sua sessão
                ativa e para exibir anúncios relevantes por meio do Google AdSense
              </li>
            </ul>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="3. Como usamos seus dados">
          <InstitutionalList
            items={[
              "Para criar e manter sua conta",
              "Para exibir seu conteúdo e o de outros usuários",
              "Para enviar notificações sobre atividades na plataforma (se você optar por receber)",
              "Para melhorar o funcionamento do serviço com base em dados de uso",
              "Para exibir anúncios por meio do Google AdSense, que pode usar cookies para personalizar os anúncios exibidos",
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="4. Google AdSense e anúncios">
          <InstitutionalParagraph>
            Usamos o Google AdSense para exibir anúncios no ChartFM. O Google pode usar cookies para exibir anúncios com
            base em suas visitas anteriores a este e a outros sites. Você pode optar por não receber anúncios
            personalizados acessando as{" "}
            <Link href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              configurações de anúncios do Google
            </Link>
            .
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Para saber mais sobre como o Google usa dados em parceiros que utilizam seus serviços, acesse{" "}
              <Link
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                policies.google.com/technologies/partner-sites
              </Link>
              .
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="5. Cookies">
          <InstitutionalParagraph>Utilizamos dois tipos de cookies:</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
              <li>
                <strong style={{ color: "var(--text)" }}>Cookies funcionais:</strong> necessários para manter sua sessão
                ativa e lembrar suas preferências
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Cookies de publicidade:</strong> usados pelo Google AdSense
                para exibir anúncios relevantes
              </li>
            </ul>
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar algumas
              funcionalidades da plataforma.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="6. Compartilhamento de dados">
          <InstitutionalParagraph>
            Não vendemos seus dados pessoais. Compartilhamos informações apenas com:
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                "Provedores de serviço que nos ajudam a operar a plataforma (como hospedagem e autenticação)",
                "O Google, para fins de exibição de anúncios via AdSense",
                "Autoridades competentes, quando exigido por lei",
              ]}
            />
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="7. Seus direitos">
          <InstitutionalParagraph>
            De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                "Saber quais dados temos sobre você",
                "Corrigir dados incorretos",
                "Solicitar a exclusão dos seus dados",
                "Revogar o consentimento para uso dos seus dados",
              ]}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Para exercer esses direitos, entre em contato pelo e-mail{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="8. Segurança">
          <InstitutionalParagraph>
            Utilizamos práticas de segurança padrão do mercado para proteger seus dados, incluindo criptografia de senha
            e conexões HTTPS. Nenhum sistema é 100% seguro, mas fazemos o possível para manter seus dados protegidos.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="9. Alterações nesta política">
          <InstitutionalParagraph>
            Podemos atualizar esta política quando necessário. Publicaremos sempre a data da última atualização no topo
            desta página. Em caso de mudanças significativas, comunicaremos os usuários por e-mail ou por aviso dentro
            da plataforma.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="10. Contato">
          <InstitutionalParagraph>
            Dúvidas sobre privacidade:{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
