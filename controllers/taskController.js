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
    const submissionResponse = await axios.post(
      `${TII_API_BASE}/tasks/${taskId}/submit`,
      new URLSearchParams({
        track_id,
        solution: answer
      }),
      {
        headers: {
          'x-api-key': TII_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        httpsAgent,
      }
    );

    await Submission.create({
      userId: req.user.userId,
      taskId,
      answer,
      timeTakenInSeconds: timeTakenInSeconds || null,
    });

    const confidence = parseFloat(submissionResponse.data?.confidence);

    if (!isNaN(confidence) && confidence >= 0.9) {
      const user = await User.findByPk(req.user.userId);
      
      // 🎯 Update XP and Level
      user.score += 10;
      user.xp += 10;
      user.level = Math.floor(user.xp / 50) + 1;

      // 🔥 Streak Logic
      const today = new Date().toDateString(); // normalize to date
      const lastDate = user.lastSubmissionDate ? new Date(user.lastSubmissionDate).toDateString() : null;

      if (lastDate === today) {
        // Already submitted today → streak unchanged
      } else {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === yesterday) {
          user.streakCount += 1;
        } else {
          user.streakCount = 1;
        }
        user.lastSubmissionDate = new Date();
      }

      await user.save();
    }

    return res.json(submissionResponse.data);
  } catch (err) {
    console.error('❌ Submission Error:', err.message);
    return res.status(500).json({ error: 'TII submission failed', details: err.message });
  }
};
