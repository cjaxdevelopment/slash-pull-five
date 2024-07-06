// playersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../axiosConfig';

export const fetchPlayers = createAsyncThunk('players/fetchPlayers', async () => {
  const response = await axios.get('/api/players');
  return response.data;
});

export const addPlayer = createAsyncThunk('players/addPlayer', async (player) => {
  const response = await axios.post('/api/players', player);
  return response.data;
});

export const updatePlayer = createAsyncThunk('players/updatePlayer', async ({ id, updates }) => {
  const response = await axios.patch(`/api/players/${id}`, updates);
  return response.data;
});

export const deletePlayer = createAsyncThunk('players/deletePlayer', async (id) => {
  await axios.delete(`/api/players/${id}`);
  return id;
});

const playersSlice = createSlice({
  name: 'players',
  initialState: {
    players: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    updateLocalPlayer: (state, action) => {
      const { id, updates } = action.payload;
      const existingPlayer = state.players.find(player => player._id === id);
      if (existingPlayer) {
        Object.assign(existingPlayer, updates);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlayers.fulfilled, (state, action) => {
        state.players = action.payload;
      })
      .addCase(addPlayer.fulfilled, (state, action) => {
        state.players.push(action.payload);
      })
      .addCase(updatePlayer.fulfilled, (state, action) => {
        const index = state.players.findIndex(player => player._id === action.payload._id);
        if (index !== -1) {
          state.players[index] = action.payload;
        }
      })
      .addCase(deletePlayer.fulfilled, (state, action) => {
        state.players = state.players.filter(player => player._id !== action.payload);
      });
  },
});

export const { updateLocalPlayer } = playersSlice.actions;
export default playersSlice.reducer;
