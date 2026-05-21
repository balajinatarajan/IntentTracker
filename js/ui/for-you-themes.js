// Theme taxonomy for the For You page (Feature 3).
// Pure constants — no side effects, no DOM access. Safe to import from
// modules that run on any page (e.g. journey-pill.js on vertical pages
// AND index.html, where the for-you.html bootstrap MUST NOT run).
// See working/plans/for-you-page.md §5.1.

export const THEMES = [
  { id: "beaches",   label: "Beaches",   tags: ["beach", "tropical", "caribbean"] },
  { id: "romantic",  label: "Romantic",  tags: ["romantic", "couples", "adults-only", "honeymoon"] },
  { id: "urban",     label: "Urban",     tags: ["urban", "city", "downtown", "nightlife"] },
  { id: "adventure", label: "Adventure", tags: ["adventure", "nature", "wildlife", "ski", "mountain"] },
  { id: "budget",    label: "Budget",    tags: ["budget", "casual", "street-food"] },
  { id: "luxury",    label: "Luxury",    tags: ["luxury", "fine-dining", "spa", "boutique", "overwater"] },
];

export const PILL_THEME_LOOKUP = {
  beach:         "beaches",
  tropical:      "beaches",
  caribbean:     "beaches",
  romantic:      "romantic",
  couples:       "romantic",
  "adults-only": "romantic",
  honeymoon:     "romantic",
  urban:         "urban",
  city:          "urban",
  downtown:      "urban",
  nightlife:     "urban",
  adventure:     "adventure",
  nature:        "adventure",
  wildlife:      "adventure",
  ski:           "adventure",
  mountain:      "adventure",
  budget:        "budget",
  casual:        "budget",
  "street-food": "budget",
  luxury:        "luxury",
  "fine-dining": "luxury",
  spa:           "luxury",
  boutique:      "luxury",
  overwater:     "luxury",
};

// Region/group tags that should NOT count for "top tag" computation.
// NOTE: `caribbean` intentionally appears here AND in THEMES.beaches.tags — the two
// uses are independent. Slicing uses THEMES.beaches.tags raw; the pill's top-tag
// selection filters against this blacklist. Do not "fix" the apparent duplication.
export const PILL_TAG_BLACKLIST = new Set([
  "southeast-asia", "europe", "east-asia", "south-asia", "north-america",
  "central-america", "south-america", "africa", "middle-east", "caribbean",
  "all-inclusive",
]);

export const PAGE_GROUP_TO_THEMES = {
  hotels:          ["urban"],
  "all-inclusive": ["beaches"],
  resorts:         ["luxury"],
  dining:          ["luxury"],
};
