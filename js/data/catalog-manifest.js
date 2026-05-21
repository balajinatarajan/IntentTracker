// Shared cross-vertical catalog manifest — consumed by For You Strip (Feature 2) and For You Page (Feature 3).
export const catalogManifest = [
  // ── Hotels (hotels.html) ──────────────────────────────────────────────
  {
    id: "nyc-boutique",
    name: "NYC Boutique Hotel",
    image: "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=600&h=400&fit=crop",
    tags: ["urban", "boutique", "luxury", "nightlife"],
    group: "hotels",
    priceTier: "luxury",
    vertical: "hotels",
    url: "hotels.html",
  },
  {
    id: "london-business",
    name: "London Business Hotel",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop",
    tags: ["urban", "business", "downtown", "classic"],
    group: "hotels",
    priceTier: "mid-range",
    vertical: "hotels",
    url: "hotels.html",
  },
  {
    id: "tokyo-capsule",
    name: "Tokyo Capsule Hotel",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop",
    tags: ["urban", "budget", "unique", "solo"],
    group: "hotels",
    priceTier: "budget",
    vertical: "hotels",
    url: "hotels.html",
  },
  {
    id: "paris-luxury-suite",
    name: "Paris Luxury Suite",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&h=400&fit=crop",
    tags: ["urban", "luxury", "romantic", "boutique"],
    group: "hotels",
    priceTier: "luxury",
    vertical: "hotels",
    url: "hotels.html",
  },
  {
    id: "chicago-airport",
    name: "Chicago Airport Hotel",
    image: "https://images.unsplash.com/photo-1462539405390-d0bdb635c7d1?w=600&h=400&fit=crop",
    tags: ["urban", "budget", "business", "convenient"],
    group: "hotels",
    priceTier: "budget",
    vertical: "hotels",
    url: "hotels.html",
  },
  {
    id: "sf-downtown",
    name: "SF Downtown Hotel",
    image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=400&fit=crop",
    tags: ["urban", "downtown", "tech", "modern"],
    group: "hotels",
    priceTier: "mid-range",
    vertical: "hotels",
    url: "hotels.html",
  },

  // ── All-Inclusive / Vacations (vacations.html) ────────────────────────
  {
    id: "cancun-all-inclusive",
    name: "Cancun All-Inclusive",
    image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=600&h=400&fit=crop",
    tags: ["beach", "luxury", "caribbean", "all-inclusive", "couples"],
    group: "all-inclusive",
    priceTier: "luxury",
    vertical: "all-inclusive",
    url: "vacations.html",
  },
  {
    id: "punta-cana-resort",
    name: "Punta Cana Resort",
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&h=400&fit=crop",
    tags: ["beach", "family", "caribbean", "all-inclusive", "tropical"],
    group: "all-inclusive",
    priceTier: "mid-range",
    vertical: "all-inclusive",
    url: "vacations.html",
  },
  {
    id: "jamaica-beach-pkg",
    name: "Jamaica Beach Package",
    image: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=600&h=400&fit=crop",
    tags: ["beach", "adults-only", "caribbean", "all-inclusive", "romantic"],
    group: "all-inclusive",
    priceTier: "mid-range",
    vertical: "all-inclusive",
    url: "vacations.html",
  },
  {
    id: "aruba-luxury-stay",
    name: "Aruba Luxury Stay",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop",
    tags: ["beach", "luxury", "caribbean", "all-inclusive", "spa"],
    group: "all-inclusive",
    priceTier: "luxury",
    vertical: "all-inclusive",
    url: "vacations.html",
  },
  {
    id: "riviera-maya-family",
    name: "Riviera Maya Family",
    image: "https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=600&h=400&fit=crop",
    tags: ["beach", "family", "caribbean", "all-inclusive", "adventure"],
    group: "all-inclusive",
    priceTier: "mid-range",
    vertical: "all-inclusive",
    url: "vacations.html",
  },
  {
    id: "bahamas-couples",
    name: "Bahamas Couples",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop",
    tags: ["beach", "couples", "caribbean", "all-inclusive", "romantic"],
    group: "all-inclusive",
    priceTier: "luxury",
    vertical: "all-inclusive",
    url: "vacations.html",
  },

  // ── Resorts (resorts.html) ────────────────────────────────────────────
  {
    id: "maldives-water-villa",
    name: "Maldives Water Villa",
    image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=400&fit=crop",
    tags: ["tropical", "luxury", "spa", "romantic", "overwater"],
    group: "resorts",
    priceTier: "luxury",
    vertical: "resorts",
    url: "resorts.html",
  },
  {
    id: "aspen-ski-lodge",
    name: "Aspen Ski Lodge",
    image: "https://images.unsplash.com/photo-1520208422220-d12a3c588e6c?w=600&h=400&fit=crop",
    tags: ["ski", "adventure", "mountain", "winter", "luxury"],
    group: "resorts",
    priceTier: "luxury",
    vertical: "resorts",
    url: "resorts.html",
  },
  {
    id: "bali-spa-resort",
    name: "Bali Spa Resort",
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=400&fit=crop",
    tags: ["tropical", "wellness", "spa", "culture", "relaxation"],
    group: "resorts",
    priceTier: "mid-range",
    vertical: "resorts",
    url: "resorts.html",
  },
  {
    id: "hawaii-golf-resort",
    name: "Hawaii Golf Resort",
    image: "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=600&h=400&fit=crop",
    tags: ["tropical", "golf", "luxury", "beach", "family"],
    group: "resorts",
    priceTier: "luxury",
    vertical: "resorts",
    url: "resorts.html",
  },
  {
    id: "swiss-alps-chalet",
    name: "Swiss Alps Chalet",
    image: "https://images.unsplash.com/photo-1502786129293-79981df4e689?w=600&h=400&fit=crop",
    tags: ["ski", "mountain", "wellness", "luxury", "scenic"],
    group: "resorts",
    priceTier: "luxury",
    vertical: "resorts",
    url: "resorts.html",
  },
  {
    id: "costa-rica-eco",
    name: "Costa Rica Eco Lodge",
    image: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&h=400&fit=crop",
    tags: ["adventure", "tropical", "eco", "wildlife", "nature"],
    group: "resorts",
    priceTier: "mid-range",
    vertical: "resorts",
    url: "resorts.html",
  },

  // ── Dining (dining.html) ──────────────────────────────────────────────
  {
    id: "oceanfront-seafood",
    name: "Oceanfront Seafood",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop",
    tags: ["fine-dining", "seafood", "waterfront", "romantic"],
    group: "dining",
    priceTier: "luxury",
    vertical: "dining",
    url: "dining.html",
  },
  {
    id: "tuscany-italian",
    name: "Tuscany Italian",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop",
    tags: ["italian", "fine-dining", "wine", "romantic", "rustic"],
    group: "dining",
    priceTier: "mid-range",
    vertical: "dining",
    url: "dining.html",
  },
  {
    id: "tokyo-sushi",
    name: "Tokyo Sushi Omakase",
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&h=400&fit=crop",
    tags: ["asian", "sushi", "fine-dining", "omakase", "japanese"],
    group: "dining",
    priceTier: "luxury",
    vertical: "dining",
    url: "dining.html",
  },
  {
    id: "nyc-steakhouse",
    name: "NYC Steakhouse",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop",
    tags: ["steakhouse", "fine-dining", "american", "classic"],
    group: "dining",
    priceTier: "luxury",
    vertical: "dining",
    url: "dining.html",
  },
  {
    id: "paris-bistro",
    name: "Paris Bistro",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop",
    tags: ["french", "casual", "wine", "local-cuisine", "charming"],
    group: "dining",
    priceTier: "mid-range",
    vertical: "dining",
    url: "dining.html",
  },
  {
    id: "thai-street-food",
    name: "Thai Street Food",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop",
    tags: ["asian", "casual", "local-cuisine", "street-food", "budget"],
    group: "dining",
    priceTier: "budget",
    vertical: "dining",
    url: "dining.html",
  },
];

/**
 * Returns the subset of manifest items NOT in the current group.
 * Used by the strip to seed cross-vertical recommendations.
 * @param {string} currentGroup - e.g. "hotels", "all-inclusive", "resorts", "dining"
 */
export function getItemsForVertical(currentGroup) {
  return catalogManifest.filter((i) => i.group !== currentGroup);
}

/**
 * Returns the full manifest (defensive copy). Used by Feature 3 (For You Page).
 */
export function getAllManifestItems() {
  return catalogManifest.slice();
}

/**
 * Vertical key → human-readable label, for "From {label}" badges.
 * Note: "all-inclusive" → "Vacations" (group key ≠ page title).
 */
export const VERTICAL_LABELS = {
  hotels: "Hotels",
  "all-inclusive": "Vacations",
  resorts: "Resorts",
  dining: "Dining",
};
