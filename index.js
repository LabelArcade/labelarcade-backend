require('dotenv').config();
const express = require('express');
const axios = require('axios');
const https = require('https');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sequelize, User, Submission } = require('./models');

const app = express();
const PORT = process.env.PORT || 8080;
const { TII_API_KEY, TII_API_BASE, JWT_SECRET } = process.env;

// SSL Agent (Dev Only)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// MIDDLEWARES
app.use(cors());
app.use(express.json());

// AUTHENTICATION MIDDLEWARE
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('❌ Authorization header missing or malformed');
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token Verified:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, password: hashedPassword });

    // Generate JWT token for immediate login (mobile support)
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    console.log('✅ User Registered:', newUser.id);
    return res.json({
      message: 'User registered successfully',
      token,
      userId: newUser.id
    });

  } catch (err) {
    console.error('❌ Registration error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ JWT Token Generated for User:', user.id);

    return res.json({ token });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// USER PROFILE
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'username', 'email', 'score'],
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('❌ Profile fetch error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// FETCH TASK FROM TII
app.get('/api/tasks/next', authenticateToken, async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  console.log('🔗 Received API Key:', apiKey);

  if (!apiKey || apiKey !== TII_API_KEY) {
    return res.status(403).json({ error: 'Forbidden - Invalid API Key' });
  }

  try {
    const url = `${TII_API_BASE}/tasks/pick?lang=en&category=vqa`;
    console.log('🔗 Requesting URL:', url);

    const response = await axios.get(url, {
      headers: {
        'x-api-key': TII_API_KEY,
        'Accept': 'application/json',
      },
      httpsAgent,
    });

    console.log('✅ Task Data Fetched:', response.data);
    return res.json(response.data);
  } catch (err) {
    console.error('❌ Task Fetching Error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// SUBMIT TASK TO TII + STORE LOCALLY
app.post('/api/tasks/:track_id/submit', authenticateToken, async (req, res) => {
  const { track_id } = req.params;
  const { taskId, answer, timeTakenInSeconds } = req.body;

  console.log("🚀 [SUBMIT API CALLED]");
  console.log("📌 track_id:", track_id);
  console.log("📌 taskId:", taskId);
  console.log("📌 answer:", answer);
  console.log("📌 timeTakenInSeconds:", timeTakenInSeconds);

  if (!track_id || !taskId || !answer) {
    console.error("❌ Missing required submission fields");
    return res.status(400).json({ error: 'Missing track_id, taskId, or answer' });
  }

  try {
    const submissionResponse = await axios.post(
      `${TII_API_BASE}/tasks/${taskId}/submit`,
      new URLSearchParams({
        track_id,
        solution: answer
      }),
      {
        headers: {
          'x-api-key': TII_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        httpsAgent
      }
    );

    await Submission.create({
      userId: req.user.userId,
      taskId,
      answer,
      timeTakenInSeconds: timeTakenInSeconds || null
    });

   const confidence = parseFloat(submissionResponse.data?.confidence);

if (!isNaN(confidence) && confidence >= 0.9) {
  // 🎯 Increase score and XP
  const user = await User.findByPk(req.user.userId);

  user.score += 10;
  user.xp += 10;

  // 🧠 Calculate level: every 50 XP = +1 level
  user.level = Math.floor(user.xp / 50) + 1;

  await user.save();

  console.log(`🏆 User ${user.id} +10 XP → XP: ${user.xp}, Level: ${user.level}`);
}


    console.log('✅ Submitted to TII & saved locally:', submissionResponse.data);
    return res.json(submissionResponse.data);

  } catch (err) {
    console.error('❌ Submission to TII failed:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'TII submission failed',
      details: err.response?.data || err.message
    });
  }
});

// LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.findAll({
      attributes: ['id', 'email', 'score'],
      order: [['score', 'DESC']],
      limit: 10
    });
    res.json(topUsers);
  } catch (err) {
    console.error('❌ Leaderboard fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch leaderboard' });
  }
});

// SUBMISSION HISTORY
app.get('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await Submission.findAll({
      where: { userId: req.user.userId },
      order: [['createdAt', 'DESC']],
    });
    res.json(submissions);
  } catch (err) {
    console.error('❌ Error fetching submissions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// START SERVER
app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
  }

  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
