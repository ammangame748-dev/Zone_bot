const mongoose = require('mongoose');

const streakUserSchema = new mongoose.Schema({
    guildId: String,
    userId: String,

    streak: { type: Number, default: 0 },

    todayMessages: { type: Number, default: 0 },

    lastDay: { type: Date, default: null },

    warned: { type: Boolean, default: false },

    dayCompleted: { type: Boolean, default: false },

    lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StreakUser', streakUserSchema);