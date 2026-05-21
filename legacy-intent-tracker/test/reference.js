// Test reference file — maps CSS selectors to item metadata
// Each selector must uniquely identify one element on the page
const REFERENCE = {
  items: {
    "#card-sunset-resort":            { id: "sunset-resort",   name: "Sunset Resort",   tags: "beach, luxury, spa",     group: "resorts", price: "luxury" },
    "#card-mountain-lodge":           { id: "mountain-lodge",  name: "Mountain Lodge",  tags: "mountain, adventure",    group: "lodges",  price: "mid-range" },
    "#card-city-hotel":               { id: "city-hotel",      name: "City Hotel",      tags: "urban, business",        group: "hotels",  price: "budget" },
    ".featured > .card:nth-child(1)": { id: "tropical-villa",  name: "Tropical Villa",  tags: "beach, romantic, pool",  group: "villas",  price: "luxury" },
    "[data-property='alpine']":       { id: "alpine-chalet",   name: "Alpine Chalet",   tags: "mountain, ski, cozy",    group: "chalets", price: "mid-range" },
    ".deals-section .card":           { id: "budget-inn",      name: "Budget Inn",      tags: "budget, family",         group: "hotels",  price: "budget" },
  }
};
