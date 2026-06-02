import { getServerLocale } from "./server";
import { translate } from "./translate";

export async function getServerTranslations() {
  const locale = await getServerLocale();
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  return { locale, t };
}
