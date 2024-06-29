const express = require('express');
const User = require('../models/User'); // Assuming the correct path to your User model
const router = express.Router();

// Get user details by user ID endpoint
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Update user details by user ID endpoint
router.put('/:id', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
