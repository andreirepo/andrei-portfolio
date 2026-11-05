import type { LocaleSchema } from "@/src/types";

type T = (key: keyof LocaleSchema | string) => string;

/** Bump when the PDF is replaced so clients skip the cached copy. */
export const RESUME_VERSION = "1";
export const RESUME_HREF = `/assets/AndreiRepoResume.pdf?v=${RESUME_VERSION}`;

export function buildNav(t: T, locale: string, isHome = false) {
  // Labels are capitalised for display; the anchors stay lowercase because the
  // section ids are `title.value.toLowerCase()`.
  const anchor = (key: "nav.projects" | "nav.experience") => `#${t(key).toLowerCase()}`;
  return [
    { path: anchor("nav.projects"), text: t("nav.projects") },
    { path: anchor("nav.experience"), text: t("nav.experience") },
    // blog is the only destination that leaves the page sections
    { path: isHome ? `#blog` : `/${locale}/blog/`, text: t("nav.blog"), divider: true },
  ];
}

export function buildFooter(t: T) {
  return {
    // Fixed id rather than the nav label: the nav no longer has a contact
    // item, but existing /#contact links should keep resolving.
    id: "contact",
    email_label: { key: "contact.email_label", value: t("contact.email_label") },
    email_url: { key: "contact.email_url", value: t("contact.email_url") },
    github_label: { key: "contact.github_label", value: t("contact.github_label") },
    github_url: { key: "contact.github_url", value: t("contact.github_url") },
    linkedin_label: { key: "contact.linkedin_label", value: t("contact.linkedin_label") },
    linkedin_url: { key: "contact.linkedin_url", value: t("contact.linkedin_url") },
  };
}
