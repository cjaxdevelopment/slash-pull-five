import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../axiosConfig';

export const fetchPlayers = createAsyncThunk('players/fetchPlayers', async () => {
  const response = await axios.get('/api/players');
  return response.data;
});

export const updatePlayer = createAsyncThunk('players/updatePlayer', async ({ id, updates }) => {
  const response = await axios.patch(`/api/players/players/${id}`, updates);
  return response.data;
});

const playersSlice = createSlice({
  name: 'players',
  initialState: {
    players: [],
  },
  reducers: {
    addPlayer: (state, action) => {
      state.players.push(action.payload);
    },
    removePlayer: (state, action) => {
      state.players = state.players.filter(player => player._id !== action.payload);
    },
    updateLocalPlayer: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.players.findIndex(player => player._id === id);
      if (index !== -1) {
        state.players[index] = { ...state.players[index], ...updates };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlayers.fulfilled, (state, action) => {
        state.players = action.payload;
      })
      .addCase(updatePlayer.fulfilled, (state, action) => {
        const updatedPlayer = action.payload;
        const index = state.players.findIndex(player => player._id === updatedPlayer._id);
        if (index !== -1) {
          state.players[index] = updatedPlayer;
        }
      });
  }
});

export const { addPlayer, removePlayer, updateLocalPlayer } = playersSlice.actions;
export default playersSlice.reducer;
