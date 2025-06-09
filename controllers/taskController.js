const axios = require('axios');
const https = require('https');
const { Submission, User } = require('../models');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const { TII_API_KEY, TII_API_BASE } = process.env;

exports.submitTaskAnswer = async (req, res) => {
  const { track_id } = req.params;
  const { taskId, answer, timeTakenInSeconds } = req.body;

  if (!track_id || !taskId || !answer) {
    return res.status(400).json({ error: 'Missing track_id, taskId, or answer' });
  }

  try {
    // ✅ Step 1: Submit to TII API
    const submissionResponse = await axios.post(
      `${TII_API_BASE}/tasks/${taskId}/submit`,
      new URLSearchParams({ track_id, solution: answer }),
      {
        headers: {
          'x-api-key': TII_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        httpsAgent,
      }
    );

    // ✅ Step 2: Save submission locally
    await Submission.create({
      userId: req.user.userId,
      taskId,
      answer,
      timeTakenInSeconds: timeTakenInSeconds || null,
    });

    const confidence = parseFloat(submissionResponse.data?.confidence);
    let newBadge = null;

    // ✅ Step 3: If confidence ≥ 0.9, update user gamification state
    if (!isNaN(confidence) && confidence >= 0.9) {
      const user = await User.findByPk(req.user.userId);

      // Increment XP and score
      user.score += 10;
      user.xp += 10;
      user.level = Math.floor(user.xp / 50) + 1;

      // ✅ Streak logic
      const today = new Date().toDateString();
      const lastDate = user.lastSubmissionDate ? new Date(user.lastSubmissionDate).toDateString() : null;
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastDate !== today) {
        user.streakCount = (lastDate === yesterday) ? user.streakCount + 1 : 1;
        user.lastSubmissionDate = new Date();
      }

      // ✅ Badge logic
      const unlockedBadges = [];
      const badges = Array.isArray(user.badges) ? user.badges : [];

      if (!badges.includes('first_task')) unlockedBadges.push('first_task');
      if (!badges.includes('streak_3') && user.streakCount >= 3) unlockedBadges.push('streak_3');
      if (!badges.includes('level_5') && user.level >= 5) unlockedBadges.push('level_5');

      if (unlockedBadges.length > 0) {
        user.badges = [...badges, ...unlockedBadges];
        newBadge = unlockedBadges[0]; // Only send one badge to trigger UI
      }

      await user.save();
    }

    // ✅ Step 4: Respond to client
    return res.json({
      ...submissionResponse.data,
      newBadge,
    });

  } catch (err) {
    console.error('❌ Submission Error:', err.message);
    return res.status(500).json({ error: 'TII submission failed', details: err.message });
  }
};
