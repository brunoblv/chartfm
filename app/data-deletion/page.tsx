import type { Metadata } from "next";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import {
  InstitutionalCallout,
  InstitutionalDivider,
  InstitutionalInlineLink,
  InstitutionalList,
  InstitutionalParagraph,
  InstitutionalSection,
  InstitutionalTitle,
} from "@/components/institutional/InstitutionalPrimitives";

export const metadata: Metadata = {
  title: "Exclusão de Dados | ChartFM",
  description:
    "Instruções para solicitar a exclusão da sua conta e dos seus dados pessoais no ChartFM, conforme a LGPD.",
  alternates: { canonical: "/data-deletion" },
};

const DELETED_DATA = [
  "Dados de cadastro (nome, e-mail e senha)",
  "Perfil, bio, avatar e preferências da conta",
  "Paradas criadas, curtidas, reposts e comentários",
  "Publicações, respostas e interações em comunidades",
  "Notificações e histórico de atividade vinculado à conta",
];

export default function DataDeletionPage() {
  return (
    <InstitutionalLayout>
      <InstitutionalTitle
        updatedAt="julho de 2026"
        subtitle="Como solicitar a exclusão da sua conta e dos seus dados pessoais no ChartFM."
      >
        Exclusão de dados
      </InstitutionalTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
        <InstitutionalSection title="1. Visão geral">
          <InstitutionalParagraph>
            Você pode solicitar a exclusão da sua conta e dos dados pessoais associados a ela a qualquer momento.
            A exclusão é permanente e não pode ser desfeita após a confirmação.
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Para informações gerais sobre como tratamos seus dados, consulte nossa{" "}
              <InstitutionalInlineLink href="/privacy-policy">Política de Privacidade</InstitutionalInlineLink>.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="2. Excluir pela plataforma (recomendado)">
          <InstitutionalParagraph>
            Se você tem acesso à sua conta, a forma mais rápida de excluir seus dados é diretamente nas
            configurações:
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                "Faça login no ChartFM com a conta que deseja excluir",
                "Acesse Configurações (ícone de engrenagem no menu ou em /settings)",
                "Abra a aba Conta",
                "Role até a seção Excluir conta e clique em Excluir minha conta",
                "Confirme a exclusão no aviso exibido",
              ]}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <InstitutionalCallout>
              Após a confirmação, sua conta e todos os dados vinculados a ela são removidos imediatamente do
              ChartFM.
            </InstitutionalCallout>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="3. Solicitar exclusão por e-mail">
          <InstitutionalParagraph>
            Se você não consegue acessar sua conta ou prefere solicitar a exclusão por outro canal, envie um
            e-mail para{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span> com o assunto{" "}
            <strong style={{ color: "var(--text)" }}>Exclusão de dados</strong> e inclua:
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList
              items={[
                "O e-mail associado à sua conta no ChartFM",
                "Seu nome de usuário (handle), se souber",
                "Uma confirmação de que deseja excluir permanentemente a conta e todos os dados vinculados",
              ]}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Para sua segurança, podemos solicitar informações adicionais para confirmar que você é o titular da
              conta antes de processar a exclusão.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="4. O que é excluído">
          <InstitutionalParagraph>
            Ao excluir sua conta, removemos permanentemente os seguintes dados:
          </InstitutionalParagraph>
          <div style={{ marginTop: 10 }}>
            <InstitutionalList items={DELETED_DATA} />
          </div>
          <div style={{ marginTop: 10 }}>
            <InstitutionalParagraph>
              Dados agregados e anonimizados usados apenas para estatísticas gerais da plataforma podem ser
              mantidos, desde que não permitam a sua identificação.
            </InstitutionalParagraph>
          </div>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="5. Prazo de processamento">
          <InstitutionalParagraph>
            Exclusões feitas pela plataforma são processadas imediatamente. Solicitações por e-mail são
            respondidas em até <strong style={{ color: "var(--text)" }}>15 dias úteis</strong>, conforme previsto
            pela LGPD.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="6. Outros direitos">
          <InstitutionalParagraph>
            Além da exclusão, você pode solicitar acesso, correção ou portabilidade dos seus dados. Na aba Conta
            das configurações, use a opção Baixar meus dados para exportar uma cópia em JSON. Para outras
            solicitações, entre em contato pelo e-mail{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>.
          </InstitutionalParagraph>
        </InstitutionalSection>

        <InstitutionalDivider />

        <InstitutionalSection title="7. Contato">
          <InstitutionalParagraph>
            Dúvidas sobre exclusão de dados ou privacidade:{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>contato@chartfm.com.br</span>
          </InstitutionalParagraph>
        </InstitutionalSection>
      </div>
    </InstitutionalLayout>
  );
}
