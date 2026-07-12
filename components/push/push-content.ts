import { pushPoints } from "@/lib/push-scoring";

export const STEPS = [
  {
    num: "01",
    title: "Indique uma música",
    desc: "Envie a música que você quer que a comunidade conheça nesta semana",
  },
  {
    num: "02",
    title: "Ouça a playlist",
    desc: "Uma playlist no Spotify é criada com todas as indicações da rodada",
  },
  {
    num: "03",
    title: "Rankeie as músicas",
    desc: "Coloque as músicas em ordem de preferência. Do 1º ao último",
  },
  {
    num: "04",
    title: "Confira o ranking",
    desc: "Os pontos são somados e o ranking da semana é revelado para todos",
  },
] as const;

export const SCORE_ROWS = [
  { rank: "#1", label: "1º no ranking de alguém", pts: 20, variant: "accent" as const },
  { rank: "#10", label: "10º no ranking de alguém", pts: pushPoints(10, 20), variant: "muted" as const },
  { rank: "#20", label: "Último no ranking (20º)", pts: 1, variant: "dim" as const },
];
