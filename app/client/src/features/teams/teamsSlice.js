import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../axiosConfig';

export const fetchTeams = createAsyncThunk('teams/fetchTeams', async () => {
  const response = await axios.get('/api/teams');
  return response.data;
});

export const addTeam = createAsyncThunk('teams/addTeam', async (team) => {
  const response = await axios.post('/api/teams', team);
  return response.data;
});

export const updateTeam = createAsyncThunk('teams/updateTeam', async ({ id, updates }) => {
  const response = await axios.patch(`/api/teams/${id}`, updates);
  return response.data;
});

export const deleteTeam = createAsyncThunk('teams/deleteTeam', async (id) => {
  await axios.delete(`/api/teams/${id}`);
  return id;
});

const teamsSlice = createSlice({
  name: 'teams',
  initialState: {
    teams: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.teams = action.payload;
      })
      .addCase(addTeam.fulfilled, (state, action) => {
        state.teams.push(action.payload);
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        const index = state.teams.findIndex(team => team._id === action.payload._id);
        if (index !== -1) {
          state.teams[index] = action.payload;
        }
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        state.teams = state.teams.filter(team => team._id !== action.payload);
      });
  },
});

export default teamsSlice.reducer;
