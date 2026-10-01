import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const dict = {
  en: {
    dashboard: "Dashboard", courses: "Courses", calendar: "Calendar", grades: "Grades",
    notifications: "Notifications", ai: "AI Assistant", chat: "Chat Room", documents: "My Documents", assignments: "Assignments", badges: "Badges",
    teacher: "Teacher Tools", admin: "Admin", settings: "Settings", signout: "Sign out",
  },
  ur: {
    dashboard: "ڈیش بورڈ", courses: "کورسز", calendar: "کیلنڈر", grades: "نمبرات",
    notifications: "اطلاعات", ai: "اے آئی معاون", chat: "چیٹ روم", documents: "میری دستاویزات", assignments: "اسائنمنٹس", badges: "بیجز",
    teacher: "اساتذہ ٹولز", admin: "ایڈمن", settings: "ترتیبات", signout: "سائن آؤٹ",
  },
};
type Lang = keyof typeof dict;
type Key = keyof (typeof dict)["en"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en", setLang: () => {}, t: (k) => dict.en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const l = localStorage.getItem("lang");
    if (l === "ur" || l === "en") setLangState(l);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[lang][k] }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    localStorage.setItem("theme", d ? "dark" : "light");
    document.documentElement.classList.toggle("dark", d);
  };
  return { dark, toggle };
}
