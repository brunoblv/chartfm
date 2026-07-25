import {
  BarChart2,
  BookOpen,
  Calculator,
  Calendar,
  Compass,
  Download,
  Lock,
  Music,
  Search,
  Star,
  Trophy,
  Users,
  Users2,
} from "lucide-react";

type GuideEntry = { key: string; icon: React.ReactNode; href?: string };

// title/body vivem no catálogo i18n (namespace "guides", chaves `${key}Title`/`${key}Body`); aqui só ficam as chaves.
export const GUIDES: GuideEntry[] = [
  {
    key: "cardCriarParada",
    icon: <Music size={20} />,
    href: "/guides/como-criar-sua-parada",
  },
  {
    key: "cardTemporadas",
    icon: <Calendar size={20} />,
  },
  {
    key: "cardSeguir",
    icon: <Users size={20} />,
  },
  {
    key: "cardFeed",
    icon: <Search size={20} />,
  },
  {
    key: "cardPontuacao",
    icon: <BarChart2 size={20} />,
    href: "/guides/como-funciona-o-global-100",
  },
  {
    key: "cardPrivacidade",
    icon: <Lock size={20} />,
  },
  {
    key: "cardComunidades",
    icon: <Users2 size={20} />,
    href: "/guides/como-participar-de-comunidades",
  },
  {
    key: "cardDescobrir",
    icon: <Compass size={20} />,
    href: "/guides/como-descobrir-musicas",
  },
  {
    key: "cardAvaliar",
    icon: <Star size={20} />,
    href: "/guides/como-avaliar-albuns",
  },
  {
    key: "cardImportar",
    icon: <Download size={20} />,
    href: "/guides/como-importar-historico",
  },
  {
    key: "cardCopa",
    icon: <Trophy size={20} />,
    href: "/guides/como-funciona-a-copa",
  },
  {
    key: "cardFormula",
    icon: <Calculator size={20} />,
    href: "/guides/como-funciona-a-pontuacao",
  },
  {
    key: "cardGlossario",
    icon: <BookOpen size={20} />,
    href: "/guides/glossario",
  },
];

// question/answer vivem no catálogo i18n (namespace "faq"); aqui só ficam as chaves.
export const FAQ_ITEMS: { questionKey: string; answerKey: string }[] = [
  { questionKey: "faq.q1", answerKey: "faq.a1" },
  { questionKey: "faq.q2", answerKey: "faq.a2" },
  { questionKey: "faq.q3", answerKey: "faq.a3" },
  { questionKey: "faq.q4", answerKey: "faq.a4" },
  { questionKey: "faq.q5", answerKey: "faq.a5" },
  { questionKey: "faq.q6", answerKey: "faq.a6" },
  { questionKey: "faq.q7", answerKey: "faq.a7" },
  { questionKey: "faq.q8", answerKey: "faq.a8" },
  { questionKey: "faq.q9", answerKey: "faq.a9" },
  { questionKey: "faq.q10", answerKey: "faq.a10" },
  { questionKey: "faq.q11", answerKey: "faq.a11" },
  { questionKey: "faq.q12", answerKey: "faq.a12" },
];
