import { configureStore } from '@reduxjs/toolkit';
import teamsReducer from './features/teams/teamsSlice';
import playersReducer from './features/players/playersSlice';

export const store = configureStore({
  reducer: {
    teams: teamsReducer,
    players: playersReducer,
  },
});
