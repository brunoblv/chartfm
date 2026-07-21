import { pushPoints } from "@/lib/push-scoring";

type TFn = (key: string, params?: Record<string, string | number>) => string;

export function getSteps(t: TFn) {
  return [
    { num: "01", title: t("push.step1Title"), desc: t("push.step1Desc") },
    { num: "02", title: t("push.step2Title"), desc: t("push.step2Desc") },
    { num: "03", title: t("push.step3Title"), desc: t("push.step3Desc") },
    { num: "04", title: t("push.step4Title"), desc: t("push.step4Desc") },
  ] as const;
}

export function getScoreRows(t: TFn) {
  return [
    { rank: "#1", label: t("push.scoreRow1Label"), pts: 20, variant: "accent" as const },
    { rank: "#10", label: t("push.scoreRow2Label"), pts: pushPoints(10, 20), variant: "muted" as const },
    { rank: "#20", label: t("push.scoreRow3Label"), pts: 1, variant: "dim" as const },
  ];
}
