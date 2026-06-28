import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import he from "./he.json";
import en from "./en.json";

void i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he },
    en: { translation: en },
  },
  lng: "he",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** setUiDirection switches the document language and direction for the UI
 *  chrome. Per-subject activity direction is handled separately. */
export function setUiDirection(lang: string): void {
  void i18n.changeLanguage(lang);
  const dir = lang === "he" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export default i18n;
