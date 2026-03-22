// Tag taxonomy for intent classification
export const regions = {
  "southeast-asia": { label: "Southeast Asia", keywords: ["bali", "thailand", "vietnam", "phuket", "indonesia", "cambodia", "laos", "myanmar"] },
  "europe": { label: "Europe", keywords: ["paris", "france", "spain", "barcelona", "prague", "czech", "lisbon", "portugal", "greece", "santorini", "iceland", "amsterdam", "netherlands", "switzerland", "alps", "italy", "germany"] },
  "east-asia": { label: "East Asia", keywords: ["tokyo", "japan", "kyoto", "korea", "china", "taiwan"] },
  "south-asia": { label: "South Asia", keywords: ["maldives", "sri lanka", "india", "nepal"] },
  "caribbean": { label: "Caribbean", keywords: ["cancun", "mexico", "jamaica", "bahamas", "cuba", "caribbean"] },
  "north-america": { label: "North America", keywords: ["new york", "nyc", "hawaii", "maui", "usa", "canada"] },
  "south-america": { label: "South America", keywords: ["peru", "machu picchu", "patagonia", "argentina", "brazil", "colombia"] },
  "central-america": { label: "Central America", keywords: ["costa rica", "panama", "belize", "guatemala"] },
  "africa": { label: "Africa", keywords: ["morocco", "marrakech", "cape town", "south africa", "kenya", "tanzania", "safari"] },
  "middle-east": { label: "Middle East", keywords: ["dubai", "uae", "oman", "jordan", "israel"] }
};

export const tripTypes = {
  "romantic": { label: "Romantic Getaway", keywords: ["romantic", "honeymoon", "couples", "anniversary", "love", "valentine"] },
  "adventure": { label: "Adventure", keywords: ["adventure", "hiking", "trekking", "surfing", "diving", "climbing", "extreme", "zip-line"] },
  "family": { label: "Family-Friendly", keywords: ["family", "kids", "children", "family-friendly", "child", "resort"] },
  "solo": { label: "Solo Travel", keywords: ["solo", "backpacking", "backpacker", "alone", "independent"] },
  "culture": { label: "Cultural Experience", keywords: ["culture", "history", "museum", "temple", "heritage", "art", "architecture"] }
};

export const priceTiers = {
  "budget": { label: "Budget-Friendly", max: 800, keywords: ["budget", "cheap", "affordable", "value", "inexpensive", "deal"] },
  "mid-range": { label: "Mid-Range", max: 1500, keywords: ["mid-range", "moderate", "reasonable", "mid"] },
  "luxury": { label: "Luxury", max: Infinity, keywords: ["luxury", "premium", "exclusive", "high-end", "5-star", "splurge", "upscale"] }
};

export const activityTypes = {
  "beach": { label: "Beach & Coast", keywords: ["beach", "coast", "ocean", "sea", "island", "snorkeling", "swimming", "surf"] },
  "city": { label: "City Break", keywords: ["city", "urban", "downtown", "metropolitan", "nightlife", "shopping"] },
  "nature": { label: "Nature & Outdoors", keywords: ["nature", "mountain", "forest", "wildlife", "national park", "hiking", "glacier"] },
  "food": { label: "Food & Culinary", keywords: ["food", "cuisine", "culinary", "restaurant", "street food", "wine", "tasting"] }
};

// Match a search query against all taxonomies and return matched tags
export function matchQueryToTags(query) {
  const q = query.toLowerCase().trim();
  const matched = [];

  for (const [tag, config] of Object.entries({ ...regions, ...tripTypes, ...priceTiers, ...activityTypes })) {
    if (config.keywords.some(kw => q.includes(kw)) || q.includes(tag)) {
      matched.push(tag);
    }
  }

  return matched;
}
