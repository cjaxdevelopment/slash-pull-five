// Directory records are independent of the Forever raid composition catalog.
export interface ProfessionTier {
  professionId: number;
  profession: string;
  tierId: number;
  expansion: string;
  skill: number | null;
  maxSkill: number | null;
  recipesAvailable: boolean;
  recipes: { id: number; name: string }[];
}
export interface ProfessionSnapshot {
  tiers: ProfessionTier[];
}
export interface DirectoryCharacter {
  id: string;
  name: string;
  slug: string;
  classId: number | null;
  inRoster: boolean;
  seed: boolean;
  lastSuccess: string | null;
  lastAttempt: string | null;
  refreshAfter: string | null;
  error: string | null;
  snapshot: ProfessionSnapshot | null;
  queued: boolean;
  member: string | null;
  memberId: string | null;
  main: string | null;
  isMain: boolean | null;
  discord: string | null;
}
export interface DirectoryRecipe {
  id: number;
  name: string;
  profession: string;
  expansion: string;
  items: { id: number; name: string }[];
  detailsFetched: boolean;
  iconUrl: string | null;
  characterIds: string[];
}
export interface RecipeMaterials {
  gameVersion: string;
  items: { id: number; name: string }[];
  reagents: { id: number; name: string; quantity: number | null }[] | null;
  modifiedReagents: boolean;
  ready: boolean;
  unavailable: boolean;
}
export interface RecipeCoverage {
  characters: { id: string; state: 'known' | 'not_listed' | 'unknown'; reason: string }[];
}
export interface ProfessionDirectory {
  gameVersion: string;
  region: string;
  guild: string;
  ruleset: { id: number; name: string };
  configured: boolean;
  admin: boolean;
  rosterSynced: string | null;
  rosterError: string | null;
  rosterQueued: boolean;
  automaticRefresh: {
    enabled: boolean;
    intervalMinutes: number;
    queued: number;
    backoffUntil: string | null;
  };
  characters: DirectoryCharacter[];
  recipes: DirectoryRecipe[];
  totalRecipes: number;
  itemDetailsPending: number;
  page: number;
  pageSize: number;
  professions: string[];
  expansions: string[];
  myProfile: { discord: string; mainCharacterId: string | null };
  claims: {
    id: string;
    characterId: string;
    characterName: string;
    username: string;
    userId: string;
    status: string;
  }[];
}
