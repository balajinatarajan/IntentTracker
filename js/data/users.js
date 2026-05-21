// Mock Bonvoy user records keyed by id; each user maps to a persona for seeding
export const users = [
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    initials: "SC",
    email: "sarah.chen@example.com",
    tier: "Gold",
    points: 47280,
    personaId: "luxury-beach"
  }
];

export function getUser(id) {
  return users.find(u => u.id === id);
}

export function getAllUsers() {
  return users;
}
