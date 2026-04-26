export interface Utility {
  slug: string;
  label: string;
  tagline: string;
}

export const UTILITIES: Utility[] = [
  {
    slug: "/",
    label: "NRIC / FIN",
    tagline: "Generate and validate Singapore NRIC and FIN numbers",
  },
  {
    slug: "/datetime",
    label: "Date / Time",
    tagline: "Convert Unix, UTC, SGT, and local timestamps",
  },
  {
    slug: "/hdb",
    label: "HDB Cost",
    tagline: "Estimate upfront cash + CPF needed for an HDB resale flat",
  },
];
