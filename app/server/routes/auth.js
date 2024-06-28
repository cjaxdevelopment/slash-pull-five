const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming the correct path to your User model
const createToken = require('../utils/jwt'); // Import createToken function

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({ username, password: hashedPassword });
    await user.save();

    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', {
      expiresIn: '1h',
    });

    res.status(201).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await User.findOne({ username });
  
      if (!user) {
        console.log('User not found');
        return res.status(400).send({ error: 'Invalid login credentials' });
      }
  
      if (!await bcrypt.compare(password, user.password)) {
        console.log('Password mismatch');
        return res.status(400).send({ error: 'Invalid login credentials' });
      }
  
      const token = createToken(user);
      console.log('Generated token:', token);
      res.send({ token });
    } catch (error) {
      console.log('Login error:', error);
      res.status(500).send({ error: 'Login failed' });
    }
  });
  

module.exports = router;
