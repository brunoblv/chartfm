import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | ChartFM",
  description: "Saiba como o ChartFM coleta, usa e protege seus dados pessoais. Inclui cookies, direitos pela LGPD, compartilhamento e retenção de dados.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      subtitle="Como coletamos, usamos e protegemos seus dados pessoais."
      updatedAt="03/05/2026"
      sections={[
        {
          title: "1. Dados que coletamos",
          body: [
            "Ao criar uma conta ou usar o ChartFM, coletamos informações que você nos fornece diretamente: nome, endereço de e-mail, imagem de perfil, identificador de conta Google (quando o login é feito via Google), nome de usuário (handle), biografia, gêneros musicais preferidos e qualquer outra informação que você adicione ao seu perfil.",
            "Também coletamos o conteúdo que você cria na plataforma: paradas semanais e suas faixas, avaliações e notas de álbuns, comentários, reposts, curtidas, participações em comunidades, posts em comunidades e interações com outros usuários.",
            "Além disso, coletamos automaticamente dados técnicos necessários para o funcionamento seguro do serviço: cookies de sessão, registros de acesso (endereço IP, horário, recurso acessado), tipo e versão do navegador, sistema operacional e informações básicas do dispositivo. Esses dados são usados para monitoramento de segurança, prevenção de abuso, gerenciamento de login e melhoria do serviço.",
          ],
        },
        {
          title: "2. Como usamos seus dados",
          body: [
            "Seus dados de conta são usados para criar e manter seu perfil, autenticar suas sessões de login, exibir seu perfil público para outros usuários e enviar notificações sobre atividade nas suas paradas, seguidores e comunidades.",
            "Seu conteúdo de paradas e reviews é usado para calcular rankings globais e de comunidades, exibir suas paradas públicas no seu perfil e nas superfícies de descoberta, e gerar dados agregados de tendências (artistas e músicas em alta) visíveis a todos os usuários.",
            "Dados técnicos são usados para manter a segurança da plataforma, detectar e prevenir abusos, diagnosticar problemas técnicos e melhorar a confiabilidade e o desempenho do serviço. Também podemos usar dados técnicos agregados e anonimizados para entender padrões de uso.",
            "Quando a publicidade estiver ativa na plataforma, poderemos usar cookies e tecnologias semelhantes para medir o desempenho de anúncios, limitar a frequência com que você vê o mesmo anúncio e — se você tiver dado consentimento — exibir anúncios baseados em interesses. O uso de dados para publicidade está sempre sujeito às suas escolhas de consentimento de cookies.",
          ],
        },
        {
          title: "3. Cookies e consentimento",
          body: [
            "O ChartFM usa duas categorias de cookies. Cookies essenciais são estritamente necessários para o funcionamento da plataforma: mantêm sua sessão de login, protegem contra ataques CSRF e habilitam recursos de segurança básicos. Esses cookies são definidos sempre que você usa o site e não podem ser desativados sem comprometer funcionalidades fundamentais.",
            "Cookies não essenciais — incluindo cookies de analytics e publicidade — são definidos apenas se você der consentimento. Na sua primeira visita ao ChartFM, um banner de consentimento explica suas opções. Você pode aceitar todos os cookies, aceitar apenas os essenciais ou ajustar suas preferências a qualquer momento. Sua escolha é armazenada e respeitada nas visitas seguintes.",
            "Você também pode gerenciar cookies diretamente pelas configurações do seu navegador. Limpar cookies ou bloquear cookies de terceiros pode afetar alguns recursos da plataforma.",
          ],
        },
        {
          title: "4. Compartilhamento de dados",
          body: [
            "Compartilhamos seus dados com fornecedores terceiros apenas na medida necessária para operar o ChartFM. Esses fornecedores incluem: Google (autenticação via OAuth), provedores de hospedagem e banco de dados, serviços de segurança e detecção de bots, serviços de envio de e-mail, plataformas de analytics e redes de publicidade.",
            "Cada fornecedor recebe apenas os dados necessários para sua função específica e está vinculado a acordos de processamento de dados que restringem uso ou divulgação adicionais. Não vendemos seus dados pessoais a terceiros.",
            "Conteúdo que você marca como público — paradas, reviews, comentários, posts em comunidades e seu perfil público — é acessível a todos os visitantes do ChartFM, incluindo usuários não logados e rastreadores de mecanismos de busca. Se você tornar uma parada privada, ela é removida das superfícies públicas.",
          ],
        },
        {
          title: "5. Seus direitos pela LGPD",
          body: [
            "A Lei Geral de Proteção de Dados (Lei 13.709/2018) garante os seguintes direitos em relação aos seus dados pessoais mantidos pelo ChartFM: confirmação de que tratamos seus dados, acesso a uma cópia dos seus dados, correção de dados incorretos ou incompletos, anonimização ou exclusão de dados desnecessários ou excessivos, portabilidade de dados, informações sobre terceiros com quem compartilhamos seus dados e retirada de consentimento para tratamentos baseados em consentimento.",
            "Para exercer qualquer desses direitos, entre em contato pelo contato@chartfm.app com o assunto 'Pedido de Privacidade — LGPD'. Podemos solicitar confirmação de identidade antes de atender pedidos que envolvam acesso ou modificação de dados sensíveis da conta. Responderemos dentro dos prazos exigidos pela legislação aplicável.",
          ],
        },
        {
          title: "6. Retenção e segurança",
          body: [
            "Mantemos seus dados pessoais pelo tempo em que sua conta estiver ativa e por um período razoável após o encerramento, para cumprir obrigações legais, resolver disputas, fazer cumprir nossos acordos e preservar a integridade dos registros da plataforma. Quando os dados não são mais necessários para esses fins, os excluímos ou anonimizamos.",
            "Conteúdo público publicado — como paradas que contribuíram para rankings globais — pode ser mantido de forma agregada ou anonimizada mesmo após a exclusão de uma conta, pois remover dados históricos de ranking afetaria os registros de outros usuários.",
            "Adotamos medidas técnicas e organizacionais de segurança para proteger seus dados: conexões criptografadas (HTTPS), controles de acesso, armazenamento seguro de credenciais e revisão periódica de nossa postura de segurança. Nenhum sistema baseado na internet é completamente imune a incidentes. Em caso de violação que afete seus direitos, notificaremos você conforme exigido por lei.",
          ],
        },
        {
          title: "7. Crianças",
          body: [
            "O ChartFM não é direcionado a crianças menores de 13 anos. Não coletamos conscientemente dados pessoais de crianças menores de 13 anos. Se você acredita que uma criança menor de 13 anos criou uma conta, entre em contato e investigaremos e removeremos a conta se confirmado.",
          ],
        },
        {
          title: "8. Alterações nesta política",
          body: [
            "Podemos atualizar esta Política de Privacidade para refletir mudanças na plataforma, novos requisitos legais ou práticas de dados atualizadas. Quando fizermos alterações significativas, atualizaremos a data exibida no topo desta página. Recomendamos que você revise esta página periodicamente. O uso continuado do ChartFM após uma atualização constitui aceitação da política revisada.",
          ],
        },
      ]}
    />
  );
}
