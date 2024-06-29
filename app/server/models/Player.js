const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  class: { type: String, required: true },
  spec: { type: String, required: true },
  offspec: { type: String },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
