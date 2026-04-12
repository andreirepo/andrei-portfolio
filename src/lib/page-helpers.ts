import type { LocaleSchema } from "@/src/types";

type T = (key: keyof LocaleSchema | string) => string;

export function buildNav(t: T, locale: string, isHome = false) {
  return [
    { path: `#${t("nav.projects")}`, text: t("nav.projects") },
    { path: isHome ? `#blog` : `/${locale}/#blog`, text: t("nav.blog") },
    { path: `#${t("nav.experience")}`, text: t("nav.experience") },
    { path: `#${t("nav.contact")}`, text: t("nav.contact") },
  ];
}

export function buildFooter(t: T) {
  return {
    id: (t("nav.contact") as string).toLowerCase(),
    status: { key: "contact.status", value: t("contact.status") },
    heading: { key: "contact.heading", value: t("contact.heading") },
    description: { key: "contact.description", value: t("contact.description") },
    email_label: { key: "contact.email_label", value: t("contact.email_label") },
    email_url: { key: "contact.email_url", value: t("contact.email_url") },
    github_label: { key: "contact.github_label", value: t("contact.github_label") },
    github_url: { key: "contact.github_url", value: t("contact.github_url") },
    linkedin_label: { key: "contact.linkedin_label", value: t("contact.linkedin_label") },
    linkedin_url: { key: "contact.linkedin_url", value: t("contact.linkedin_url") },
  };
}
