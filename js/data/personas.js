// Seed personas keyed by id; intents drive tagWeights, journey drives transitionGraph
export const personas = [
  {
    id: "luxury-beach",
    label: "Luxury Beach",
    description: "Honeymoons, beach resorts, romantic getaways",
    intents: [
      {
        category: "group_interest",
        tags: ["beach", "luxury"],
        confidence: 0.95,
        sourceEventCount: 6,
        group: "resorts"
      },
      {
        category: "tag_affinity",
        tags: ["romantic", "beach"],
        confidence: 0.90,
        sourceEventCount: 5
      },
      {
        category: "hover_interest",
        tags: ["luxury", "romantic"],
        confidence: 0.85,
        sourceEventCount: 4,
        group: "resorts"
      },
      {
        category: "price_preference",
        tags: ["luxury"],
        confidence: 0.90,
        sourceEventCount: 4,
        tier: "luxury"
      },
      {
        category: "search_intent",
        tags: ["beach", "romantic"],
        confidence: 0.85,
        sourceEventCount: 3,
        query: "honeymoon overwater villas"
      },
      {
        category: "tag_affinity",
        tags: ["culture", "food"],
        confidence: 0.80,
        sourceEventCount: 3
      },
      {
        category: "journey_affinity",
        tags: ["beach", "luxury"],
        confidence: 0.75,
        sourceEventCount: 3
      }
    ],
    journey: {
      steps: [
        {
          from: { name: "Home", category: "home", url: "/index.html" },
          to: { name: "Vacations", category: "vacations", url: "/vacations.html" },
          timestamp: Date.now() - 3600000
        },
        {
          from: { name: "Vacations", category: "vacations", url: "/vacations.html" },
          to: { name: "Resorts", category: "resorts", url: "/resorts.html" },
          timestamp: Date.now() - 3300000
        },
        {
          from: { name: "Resorts", category: "resorts", url: "/resorts.html" },
          to: { name: "Resorts", category: "resorts", url: "/resorts.html" },
          timestamp: Date.now() - 3000000
        },
        {
          from: { name: "Resorts", category: "resorts", url: "/resorts.html" },
          to: { name: "Vacations", category: "vacations", url: "/vacations.html" },
          timestamp: Date.now() - 2700000
        },
        {
          from: { name: "Vacations", category: "vacations", url: "/vacations.html" },
          to: { name: "Home", category: "home", url: "/index.html" },
          timestamp: Date.now() - 2400000
        }
      ]
    }
  }
];

export function getPersona(id) {
  return personas.find(p => p.id === id);
}
