import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Session, Snapshot } from '@spf/shared';
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
  tagTypes: ['Session', 'Workspace'],
  endpoints: (build) => ({
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
      invalidatesTags: ['Session', 'Workspace'],
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
