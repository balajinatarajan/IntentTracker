// Seeds and clears the IntentTracker localStorage state (ik_profile + ik_journey) from a persona definition
import { getPersona } from "../data/personas.js";

const PROFILE_KEY = "ik_profile";
const JOURNEY_KEY = "ik_journey";

export function seedFromPersona(personaId) {
  const persona = getPersona(personaId);
  if (!persona) {
    throw new Error("Unknown persona: " + personaId);
  }

  const tagWeights = {};
  for (const intent of persona.intents) {
    for (const tag of intent.tags) {
      tagWeights[tag] = (tagWeights[tag] || 0) + intent.confidence;
    }
  }
  for (const tag of Object.keys(tagWeights)) {
    tagWeights[tag] = Math.round(tagWeights[tag] * 100) / 100;
  }

  const baseTimestamp = Date.now() - 3600000;
  const profile = {
    userId: "user-" + Math.random().toString(36).slice(2, 10),
    sessions: [
      {
        sessionId: "seed-" + persona.id,
        startedAt: baseTimestamp,
        intents: persona.intents.map((intent, idx) => ({
          id: "intent-seed-" + persona.id + "-" + idx,
          timestamp: baseTimestamp + idx * 60000,
          summary: deriveSummary(intent),
          tags: intent.tags,
          confidence: intent.confidence,
          category: intent.category,
          sourceEventCount: intent.sourceEventCount || 1,
          active: true
        }))
      }
    ],
    tagWeights
  };

  const transitionGraph = {};
  const pageVisitCounts = {};
  const steps = (persona.journey && persona.journey.steps) || [];
  steps.forEach(step => {
    const key = step.from.name + "->" + step.to.name;
    if (!transitionGraph[key]) {
      transitionGraph[key] = { count: 0, lastSeen: 0 };
    }
    transitionGraph[key].count++;
    transitionGraph[key].lastSeen = step.timestamp;
    pageVisitCounts[step.to.name] = (pageVisitCounts[step.to.name] || 0) + 1;
  });
  // The loop only counts `to.name` pages; the very first `from.name` was also visited once.
  if (steps.length > 0) {
    const firstFrom = steps[0].from.name;
    pageVisitCounts[firstFrom] = (pageVisitCounts[firstFrom] || 0) + 1;
  }

  const journey = {
    currentPage: null,
    currentPath: [],
    steps,
    transitionGraph,
    pageVisitCounts,
    recentPaths: []
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
}

export function clearSeed() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(JOURNEY_KEY);
}

function deriveSummary(intent) {
  const tags = intent.tags || [];
  const topTag = tags[0];
  switch (intent.category) {
    case "group_interest": {
      const group = intent.group || topTag;
      const detail = tags.find(t => t !== group) || topTag;
      return "Interested in " + group + " — " + detail;
    }
    case "tag_affinity":
      return "Interested in " + topTag;
    case "price_preference": {
      const priceTag = tags.find(t => typeof t === "string" && t.startsWith("price:")) || topTag || "";
      const tier = typeof priceTag === "string" ? priceTag.replace(/^price:/, "") : priceTag;
      return "Looking for " + tier + " options";
    }
    case "hover_interest": {
      const group = intent.group || tags[1] || topTag;
      return "Considering " + topTag + " options in " + group;
    }
    case "search_intent": {
      const query = intent.query || topTag || "";
      return 'Searched for "' + query + '"';
    }
    default:
      return tags.join(", ");
  }
}
