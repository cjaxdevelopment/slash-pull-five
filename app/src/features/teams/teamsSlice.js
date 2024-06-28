import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  teams: [],
};

const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    addTeam: (state, action) => {
      state.teams.push(action.payload);
    },
    removeTeam: (state, action) => {
      state.teams = state.teams.filter(team => team.id !== action.payload);
    },
    updateTeam: (state, action) => {
      const { id, updates } = action.payload;
      const team = state.teams.find(team => team.id === id);
      if (team) {
        Object.assign(team, updates);
      }
    },
  },
});

export const { addTeam, removeTeam, updateTeam } = teamsSlice.actions;
export default teamsSlice.reducer;
