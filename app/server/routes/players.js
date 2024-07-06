const express = require('express');
const auth = require('../middleware/auth');
const Player = require('../models/Player');
const Team = require('../models/Team');

const router = express.Router();

// Get all players
router.get('/', auth, async (req, res) => {
    try {
      const players = await Player.find({ userId: req.user._id });
      res.send(players);
    } catch (err) {
      res.status(500).send(err);
    }
  });

// Get player by ID
router.get('/:playerId', auth, async (req, res) => {
    const { playerId } = req.params;
  
    try {
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).send('Player not found');
      }
      res.send(player);
    } catch (err) {
      res.status(500).send(err);
    }
  });

// Add a new player
router.post('/', auth, async (req, res) => {
    const { name, role, class: playerClass, spec, offspec, teamId } = req.body;
    console.log('Creating player for user:', req.user._id); // Add this line
    try {
      const player = new Player({ name, role, class: playerClass, spec, offspec, teamId: teamId, userId: req.user._id });
      await player.save();
      res.status(201).send(player);
    } catch (err) {
      res.status(400).send(err);
    }
  });

// Add a player to a team
router.post('/:teamId/players', auth, async (req, res) => {
  const { name, role, class: playerClass, spec, offspec } = req.body;
  const teamId = req.params.teamId;
  try {
    const player = new Player({ name, role, class: playerClass, spec, offspec, teamId, userId: req.user._id });
    await player.save();

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).send('Team not found');
    }
    team.players.push(player._id);
    await team.save();

    res.status(201).send(player);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Get players for a team
router.get('/:teamId/players', auth, async (req, res) => {
  const teamId = req.params.teamId;

  try {
    const players = await Player.find({ teamId });
    res.send(players);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Update a player
router.patch('/:playerId', auth, async (req, res) => {
  const updates = req.body;
  try {
    const player = await Player.findByIdAndUpdate(req.params.playerId, updates, { new: true });
    if (!player) return res.status(404).send('Player not found');
    res.send(player);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Remove a player
router.delete('/:playerId', auth, async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.playerId);
    if (!player) return res.status(404).send('Player not found');

    const team = await Team.findById(player.teamId);
    if (team) {
      team.players.pull(player._id);
      await team.save();
    }

    res.send(player);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
