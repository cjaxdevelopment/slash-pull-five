const express = require('express');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const Player = require('../models/Player');

const router = express.Router();

// Get user-specific teams
router.get('/', auth, async (req, res) => {
  try {
    const teams = await Team.find({ userId: req.user._id });
    res.send(teams);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get a specific team
router.get('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, userId: req.user._id });
    if (!team) {
      return res.status(404).send('Team not found');
    }
    res.send(team);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Add a team
router.post('/', auth, async (req, res) => {
  const { name, description, color } = req.body;
  const team = new Team({ name, description, color, userId: req.user._id });
  try {
    await team.save();
    res.status(201).send(team);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Update a team
router.patch('/:id', auth, async (req, res) => {
  const updates = req.body;
  try {
    const team = await Team.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true });
    if (!team) return res.status(404).send('Team not found');
    res.send(team);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Remove a team
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!team) return res.status(404).send('Team not found');
    res.send(team);
  } catch (err) {
    res.status(500).send(err);
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

module.exports = router;
