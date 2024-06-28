import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  players: [],
};

const playersSlice = createSlice({
  name: 'players',
  initialState,
  reducers: {
    addPlayer: (state, action) => {
      state.players.push(action.payload);
    },
    removePlayer: (state, action) => {
      state.players = state.players.filter(player => player.id !== action.payload);
    },
    updatePlayer: (state, action) => {
      const { id, updates } = action.payload;
      const player = state.players.find(player => player.id === id);
      if (player) {
        Object.assign(player, updates);
      }
    },
    movePlayer: (state, action) => {
      const { playerId, fromTeamId, toTeamId } = action.payload;
      const player = state.players.find(player => player.id === playerId);
      if (player) {
        player.teamId = toTeamId;
      }
    },
  },
});

export const { addPlayer, removePlayer, updatePlayer, movePlayer } = playersSlice.actions;
export default playersSlice.reducer;
