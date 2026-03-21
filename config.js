require('dotenv').config()

// ─────────────────────────────────────────
//         AKAZA BOT — CONFIGURATION
// ─────────────────────────────────────────

const config = {
  // Bot identity
  botName: process.env.BOT_NAME || 'Akaza',
  prefix: process.env.PREFIX || '.',

  // Owner settings
  ownerNumber: process.env.OWNER_NUMBER + '@s.whatsapp.net',
  ownerName: 'Boss',

  // Session
  sessionName: process.env.SESSION_NAME || 'akaza_auth',

  // Debug mode
  debug: process.env.DEBUG === 'true',

  // Bot messages
  messages: {
    ownerOnly: '❌ This command is for my owner only.',
    unknownCommand: (prefix) => `❓ Unknown command. Type *${prefix}help* to see available commands.`,
    error: '⚠️ Something went wrong while executing that command.',
  },
}

module.exports = config
