const express = require('express')
const path = require('path')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const log = require('./utils/logger')
const config = require('./config')

// ─────────────────────────────────────────
//       AKAZA BOT — PAIRING SERVER
// ─────────────────────────────────────────

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Store active pairing sessions
const pairingSessions = new Map()

/**
 * Create a temporary WhatsApp socket just for pairing
 * Once paired, the session is saved and the socket is closed
 */
const createPairingSocket = async (phoneNumber) => {
  const sessionId = `pair_${phoneNumber}_${Date.now()}`
  const sessionPath = path.join(__dirname, 'sessions', sessionId)

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    browser: ['Akaza-MD', 'Chrome', '1.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  // Wait for socket to be ready then request pairing code
  await new Promise((r) => setTimeout(r, 2000))

  const code = await sock.requestPairingCode(phoneNumber)
  const formatted = code.match(/.{1,4}/g)?.join('-') || code

  // Store session info
  pairingSessions.set(phoneNumber, { sock, sessionId, sessionPath })

  // Auto cleanup after 5 minutes
  setTimeout(() => {
    try {
      sock.end()
      pairingSessions.delete(phoneNumber)
      log.info(`Pairing session cleaned up for ${phoneNumber}`)
    } catch {}
  }, 5 * 60 * 1000)

  // On successful connection, rename session to main session
  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      log.success(`Pairing successful for ${phoneNumber}!`)
      pairingSessions.delete(phoneNumber)
    }
    if (connection === 'close') {
      pairingSessions.delete(phoneNumber)
    }
  })

  return formatted
}

// ── ROUTES ────────────────────────────────

// Serve pairing site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Generate pairing code
app.post('/pair', async (req, res) => {
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' })
  }

  // Sanitize: digits only
  const sanitized = phone.replace(/[^0-9]/g, '')

  if (sanitized.length < 10 || sanitized.length > 15) {
    return res.status(400).json({ success: false, message: 'Invalid phone number format.' })
  }

  // Prevent duplicate pairing requests
  if (pairingSessions.has(sanitized)) {
    return res.status(429).json({ success: false, message: 'A pairing request is already active for this number. Please wait.' })
  }

  try {
    log.info(`Pairing request received for: ${sanitized}`)
    const code = await createPairingSocket(sanitized)
    return res.json({ success: true, code })
  } catch (err) {
    log.error(`Pairing error for ${sanitized}: ${err.message}`)
    return res.status(500).json({ success: false, message: 'Failed to generate pairing code. Please try again.' })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: config.botName, uptime: process.uptime() })
})

// ── START SERVER ──────────────────────────
const startServer = () => {
  app.listen(PORT, () => {
    log.success(`Akaza pairing server running at http://localhost:${PORT}`)
  })
}

module.exports = { startServer }
                            
