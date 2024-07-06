const express = require('express');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const router = express.Router();

// Get all teams
router.get('/', auth, async (req, res) => {
  try {
    const teams = await Team.find({ userId: req.user._id });
    res.send(teams);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Add a new team
router.post('/', auth, async (req, res) => {
  const { name, description, color } = req.body;
  try {
    const team = new Team({ name, description, color, userId: req.user._id });
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
    const team = await Team.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!team) return res.status(404).send('Team not found');
    res.send(team);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Delete a team
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).send('Team not found');
    res.send(team);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
