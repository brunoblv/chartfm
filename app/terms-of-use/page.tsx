import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso | ChartFM",
  description: "Leia os Termos de Uso do ChartFM. Regras para contas, conteúdo, comunidades, rankings, publicidade e conduta na plataforma.",
  alternates: { canonical: "/terms-of-use" },
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
            "Ao acessar ou usar o ChartFM — incluindo seu site, aplicativo, APIs e quaisquer serviços associados — você concorda em se vincular a estes Termos de Uso e à nossa Política de Privacidade. Se você não concordar com estes termos, não deve usar a plataforma.",
            "Podemos atualizar estes Termos a qualquer momento. Quando isso ocorrer, atualizaremos a data exibida acima. O uso continuado do ChartFM após a publicação de uma alteração constitui sua aceitação dos Termos atualizados.",
          ],
        },
        {
          title: "2. Contas e autenticação",
          body: [
            "Para acessar a maioria das funcionalidades do ChartFM, você precisa criar uma conta. Você pode fazer login com sua conta Google, sujeito também aos termos de serviço do Google. Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas as atividades realizadas na sua conta.",
            "Você deve fornecer informações precisas ao configurar seu perfil. Não é permitido criar contas em nome de outras pessoas sem autorização, personificar outra pessoa ou usar o ChartFM de maneiras que distorçam sua identidade.",
            "O ChartFM reserva o direito de recusar, suspender ou remover permanentemente contas que violem estes Termos, a legislação aplicável, direitos de terceiros ou a segurança e integridade da comunidade. Sempre que possível, notificaremos você antes de tomar uma medida, mas podemos agir imediatamente se as circunstâncias exigirem.",
          ],
        },
        {
          title: "3. Conteúdo do usuário",
          body: [
            "Você mantém a propriedade do conteúdo que cria no ChartFM, incluindo suas paradas semanais, reviews, comentários, posts em comunidades e informações de perfil. Ao publicar conteúdo, você concede ao ChartFM uma licença não exclusiva, mundial e gratuita para exibir, agregar e distribuir esse conteúdo dentro da plataforma e em conexão com seus serviços.",
            "Você é o único responsável pelo conteúdo que publica. Você declara que tem o direito de publicá-lo, que ele não infringe direitos de propriedade intelectual de terceiros e que está em conformidade com a legislação aplicável.",
            "É proibido publicar conteúdo ilegal, difamatório, ameaçador, abusivo, obsceno ou discriminatório. Também é proibido publicar conteúdo que viole direitos autorais ou outros direitos de propriedade intelectual, exponha dados pessoais de outra pessoa sem seu consentimento, personifique qualquer pessoa ou entidade, promova atividade ilegal ou contenha código malicioso.",
            "Podemos remover conteúdo que viole estas regras, sem aviso prévio, a nosso exclusivo critério. Violações repetidas podem resultar em suspensão ou encerramento da conta.",
          ],
        },
        {
          title: "4. Rankings, paradas e funcionalidades da plataforma",
          body: [
            "O sistema de ranking semanal do ChartFM agrega as paradas dos usuários para produzir rankings globais e de comunidades. Esses rankings refletem a atividade da comunidade e são recalculados a cada semana. Reservamos o direito de ajustar algoritmos de ranking, corrigir erros, remover dados fraudulentos ou suspender temporariamente os cálculos de ranking para manutenção.",
            "Snapshots semanais são arquivados após o fechamento do ciclo. Dados arquivados são somente leitura e refletem a atividade daquela semana específica. Não garantimos que snapshots históricos serão preservados indefinidamente.",
            "Funcionalidades da plataforma — incluindo formatos de parada, critérios de ranking, ferramentas de comunidade, sistemas de review e tipos de notificação — podem mudar ao longo do tempo conforme melhoramos o produto. Tentaremos avisar com antecedência sobre mudanças significativas, mas nos reservamos o direito de modificar ou descontinuar funcionalidades sem aviso prévio.",
          ],
        },
        {
          title: "5. Comunidades",
          body: [
            "Comunidades são espaços criados por usuários no ChartFM. Criadores e administradores de comunidades são responsáveis por definir e aplicar regras adequadas dentro de suas comunidades, consistentes com estes Termos.",
            "O ChartFM não é responsável pela conduta dos membros de comunidades ou pelo conteúdo de posts em comunidades. No entanto, reservamos o direito de remover comunidades ou conteúdo que violem estes Termos e de suspender ou remover administradores que não mantenham um ambiente seguro.",
          ],
        },
        {
          title: "6. Publicidade e cookies",
          body: [
            "O ChartFM pode exibir anúncios para sustentar a plataforma. A publicidade pode ser fornecida por redes de terceiros que utilizam cookies e tecnologias semelhantes para medir o desempenho dos anúncios e, com seu consentimento, exibir anúncios relevantes.",
            "Suas preferências de cookies e publicidade são reguladas pela nossa Política de Privacidade e pelo banner de consentimento exibido na sua primeira visita. Você pode alterar suas preferências a qualquer momento.",
          ],
        },
        {
          title: "7. Encerramento",
          body: [
            "Você pode parar de usar o ChartFM a qualquer momento. Pode solicitar a exclusão da conta pelo e-mail contato@chartfm.app. Após a exclusão, seu perfil e dados privados serão removidos do uso ativo, sujeito aos requisitos de retenção descritos em nossa Política de Privacidade.",
            "Podemos encerrar ou suspender seu acesso caso você viole estes Termos, adote comportamento que prejudique a plataforma ou outros usuários, ou conforme exigido por lei. Após o encerramento, sua licença para usar o ChartFM termina imediatamente.",
          ],
        },
        {
          title: "8. Limitação de responsabilidade",
          body: [
            "O ChartFM é fornecido no estado em que se encontra e conforme disponível. Trabalhamos para manter um serviço confiável, seguro e agradável, mas não garantimos acesso ininterrupto, operação sem erros ou que todo o conteúdo da plataforma seja preciso ou completo.",
            "Na máxima extensão permitida pela legislação aplicável, o ChartFM não é responsável por quaisquer danos indiretos, incidentais, especiais, consequentes ou punitivos decorrentes do uso ou da incapacidade de usar a plataforma.",
          ],
        },
        {
          title: "9. Legislação aplicável",
          body: [
            "Estes Termos são regidos pelas leis do Brasil. Quaisquer disputas decorrentes destes Termos ou do uso do ChartFM estarão sujeitas à jurisdição dos tribunais brasileiros, salvo se a legislação aplicável exigir de outra forma.",
          ],
        },
      ]}
    />
  );
}
