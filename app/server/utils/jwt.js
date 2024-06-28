const jwt = require('jsonwebtoken');

const createToken = (user) => {
  const payload = {
    userId: user._id,
    // include other necessary user info if needed
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  return token;
};

module.exports = createToken;
