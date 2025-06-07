const axios = require('axios');
const https = require('https');
const { Submission, User } = require('../models');

const { TII_API_BASE, TII_API_KEY } = process.env;

// Dev-only agent (ignore SSL warnings)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function submitTaskAnswer(req, res) {
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
    // Submit to TII
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

    // Save locally
    await Submission.create({
      userId: req.user.userId,
      taskId,
      answer,
      timeTakenInSeconds: timeTakenInSeconds || null
    });

    // XP & Score Logic
    const confidence = parseFloat(submissionResponse.data?.confidence);

    if (!isNaN(confidence) && confidence >= 0.9) {
      const user = await User.findByPk(req.user.userId);
      user.score += 10;
      user.xp += 10;

      // Update level (50 XP per level)
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
}

module.exports = {
  submitTaskAnswer
};
