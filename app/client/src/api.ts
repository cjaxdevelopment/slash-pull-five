import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  Session,
  Snapshot,
  ProfessionDirectory,
  ProfessionSnapshot,
  RecipeCoverage,
  RecipeMaterials,
} from '@spf/shared';
let csrfToken: string | undefined;
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'same-origin',
    prepareHeaders: (headers) => {
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
      return headers;
    },
  }),
  tagTypes: ['Session', 'Workspace', 'Professions'],
  endpoints: (build) => ({
    professions: build.query<
      ProfessionDirectory,
      { q: string; profession: string; expansion: string; character: string; page: number }
    >({
      query: (filters) => ({ url: '/profs', params: filters }),
      providesTags: ['Professions'],
    }),
    professionCharacter: build.query<{ snapshot: ProfessionSnapshot | null }, string>({
      query: (id) => `/profs/characters/${id}`,
      providesTags: ['Professions'],
    }),
    recipeMaterials: build.query<RecipeMaterials, number>({
      query: (id) => `/profs/recipes/${id}/materials`,
      providesTags: ['Professions'],
    }),
    recipeProviders: build.query<{ characterIds: string[] }, number>({
      query: (id) => `/profs/recipes/${id}/providers`,
      providesTags: ['Professions'],
    }),
    recipeCoverage: build.query<
      RecipeCoverage,
      { id: number; profession: string; expansion: string }
    >({
      query: ({ id, ...params }) => ({ url: `/profs/recipes/${id}/coverage`, params }),
      providesTags: ['Professions'],
    }),
    professionCommand: build.mutation<
      { ok: boolean },
      { path: string; method?: 'POST' | 'PUT'; body?: unknown }
    >({
      query: ({ path, method = 'POST', body }) => ({ url: `/profs/${path}`, method, body }),
      invalidatesTags: ['Professions'],
    }),
    prioritizeRecipeDetails: build.mutation<{ ok: boolean }, number[]>({
      query: (recipeIds) => ({ url: '/profs/recipe-details', method: 'POST', body: { recipeIds } }),
    }),
    session: build.query<Session, void>({
      query: () => '/session',
      transformResponse: (s: Session) => {
        csrfToken = s.csrfToken;
        return s;
      },
      providesTags: ['Session'],
    }),
    login: build.mutation<{ ok: boolean }, { username: string; password: string }>({
      query: (body) => ({ url: '/login', method: 'POST', body }),
      invalidatesTags: ['Session', 'Workspace', 'Professions'],
    }),
    logout: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/logout', method: 'POST' }),
      invalidatesTags: ['Session'],
    }),
    snapshot: build.query<Snapshot, string>({
      query: (id) => `/guilds/${id}/snapshot`,
      providesTags: ['Workspace'],
    }),
    command: build.mutation<
      { id?: string; url?: string; charactersCreated?: number },
      { guildId: string; path: string; method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }
    >({
      query: ({ guildId, path, method, body }) => ({
        url: `/guilds/${guildId}/${path}`,
        method,
        body,
      }),
      invalidatesTags: ['Workspace'],
    }),
  }),
});
export const {
  useProfessionsQuery,
  useProfessionCharacterQuery,
  useRecipeCoverageQuery,
  useRecipeProvidersQuery,
  useRecipeMaterialsQuery,
  useProfessionCommandMutation,
  usePrioritizeRecipeDetailsMutation,
  useSessionQuery,
  useLoginMutation,
  useLogoutMutation,
  useSnapshotQuery,
  useCommandMutation,
} = api;
export function errorMessage(error: unknown): string {
  const e = error as { data?: { error?: string }; message?: string };
  return (
    e?.data?.error ||
    e?.message ||
    'Unable to reach the server. Check your connection and try again.'
  );
}
