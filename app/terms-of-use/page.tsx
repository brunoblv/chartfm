import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalDivider,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Termos de Uso | ChartFM",
  description: "Leia os Termos de Uso do ChartFM. Regras para contas, conteúdo e conduta na plataforma.",
  alternates: { canonical: "/terms-of-use" },
};

export default function TermsPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle updatedAt="junho de 2025">Termos de Uso</InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title="1. Aceitação dos termos">
          <InstitutionalParagraph>
            Ao criar uma conta ou usar o ChartFM, você concorda com estes Termos de Uso. Se você não concorda, não
            utilize a plataforma.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="2. O que você pode fazer">
          <InstitutionalParagraph>Ao usar o ChartFM você pode:</InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                "Criar e publicar paradas musicais pessoais",
                "Seguir outros usuários e ver as paradas deles",
                "Comentar, curtir e compartilhar conteúdo da plataforma",
                "Usar o conteúdo da plataforma para fins pessoais e não comerciais",
              ]}
            />
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="3. O que não é permitido">
          <InstitutionalList
            items={[
              "Publicar conteúdo ofensivo, discriminatório ou ilegal",
              "Usar a plataforma para spam ou publicidade não autorizada",
              "Criar contas falsas ou se passar por outra pessoa",
              "Tentar acessar dados de outros usuários sem permissão",
              "Fazer uso automatizado da plataforma sem autorização prévia",
            ]}
          />
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="4. Conteúdo que você publica">
          <InstitutionalParagraph>
            Você é responsável pelo que publica no ChartFM. Ao publicar conteúdo, você confirma que tem o direito de
            fazê-lo e que ele não viola direitos de terceiros. O ChartFM pode remover conteúdo que viole estes termos
            sem aviso prévio.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="5. Suspensão de conta">
          <InstitutionalParagraph>
            O ChartFM pode suspender ou encerrar contas que violem estes termos. Em casos graves, a suspensão pode
            ocorrer sem notificação prévia.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="6. Disponibilidade do serviço">
          <InstitutionalParagraph>
            O ChartFM pode passar por manutenções ou interrupções ocasionais. Fazemos o possível para manter o serviço
            disponível, mas não garantimos disponibilidade ininterrupta.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="7. Alterações nestes termos">
          <InstitutionalParagraph>
            Podemos atualizar estes termos quando necessário. Quando isso acontecer, publicaremos a nova versão nesta
            página e informaremos a data da última atualização. O uso continuado da plataforma após a atualização
            indica aceitação dos novos termos.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="8. Contato">
          <InstitutionalParagraph>
            Em caso de dúvidas sobre estes termos, entre em contato pelo e-mail{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
