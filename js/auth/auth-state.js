// Auth state: read/write the signed-in user and orchestrate persona seeding
import { getUser } from "../data/users.js";
import { seedFromPersona, clearSeed } from "./persona-seed.js";

const STORAGE_KEY = "bonvoy_user";

export function getCurrentUser() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return null;
  const user = getUser(id);
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return user;
}

export function signIn(userId) {
  const user = getUser(userId);
  if (!user) {
    throw new Error("Unknown user: " + userId);
  }
  seedFromPersona(user.personaId);
  localStorage.setItem(STORAGE_KEY, userId);
  location.reload();
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  clearSeed();
  localStorage.removeItem("ik_profile");
  localStorage.removeItem("ik_journey");
  location.reload();
}

export function isSignedIn() {
  return getCurrentUser() !== null;
}
