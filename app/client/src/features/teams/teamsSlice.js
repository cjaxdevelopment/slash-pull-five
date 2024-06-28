import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../axiosConfig';

export const fetchTeams = createAsyncThunk('teams/fetchTeams', async () => {
  const response = await axios.get('/api/teams');
  return response.data;
});

const teamsSlice = createSlice({
  name: 'teams',
  initialState: {
    teams: [],
  },
  reducers: {
    addTeam: (state, action) => {
      state.teams.push(action.payload);
    },
    removeTeam: (state, action) => {
      state.teams = state.teams.filter(team => team._id !== action.payload);
    },
    updateTeam: (state, action) => {
      const { id, updates } = action.payload;
      const existingTeam = state.teams.find(team => team._id === id);
      if (existingTeam) {
        Object.assign(existingTeam, updates);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTeams.fulfilled, (state, action) => {
      state.teams = action.payload;
    });
  }
});

export const { addTeam, removeTeam, updateTeam } = teamsSlice.actions;
export default teamsSlice.reducer;
