const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const readline = require('readline')
const path = require('path')
const log = require('./utils/logger')
const config = require('./config')
const { runCommand } = require('./command')
const { getSender, getMessageText, parseCommand, isOwner, isGroup } = require('./lib/functions')
const { getUser, updateUser } = require('./data/database')

// ─────────────────────────────────────────
//         AKAZA BOT — ENTRY POINT
// ─────────────────────────────────────────

// Load all plugins
require('./plugins/menu')

const store = makeInMemoryStore({})

// ── READLINE HELPER ───────────────────────
const question = (prompt) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  )
}

// ── MAIN BOT FUNCTION ─────────────────────
const startAkaza = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, 'sessions', config.sessionName)
  )

  const { version } = await fetchLatestBaileysVersion()
  log.info(`Using WA v${version.join('.')}`)

  // Ask user for connection method if not yet authenticated
  let usePairingCode = false
  let phoneNumber = ''

  if (!state.creds.registered) {
    console.log(`
╔══════════════════════════════╗
║   🔥  AKAZA-MD  — STARTUP 🔥  ║
╚══════════════════════════════╝

How would you like to connect Akaza?
  [1] QR Code  (scan with WhatsApp)
  [2] Pairing Code  (enter code on WhatsApp)
    `)

    const choice = await question('Enter choice (1 or 2): ')

    if (choice === '2') {
      usePairingCode = true
      phoneNumber = await question('Enter your WhatsApp number (e.g. 2348012345678): ')
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '') // strip non-digits
    }
  }

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    browser: ['Akaza-MD', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  })

  store.bind(sock.ev)

  // ── REQUEST PAIRING CODE ──────────────
  if (usePairingCode && !sock.authState.creds.registered) {
    await new Promise((r) => setTimeout(r, 2000)) // wait for socket to be ready
    try {
      const code = await sock.requestPairingCode(phoneNumber)
      const formatted = code.match(/.{1,4}/g)?.join('-') || code
      console.log(`
╔══════════════════════╗
║  🔑  PAIRING CODE     ║
╠══════════════════════╣
║   ${formatted.padEnd(20)}  ║
╚══════════════════════╝

👉 Open WhatsApp → Linked Devices → Link a Device
   → Link with phone number → Enter the code above
      `)
    } catch (err) {
      log.error(`Failed to get pairing code: ${err.message}`)
    }
  }

  // ── SAVE CREDENTIALS ──────────────────
  sock.ev.on('creds.update', saveCreds)

  // ── CONNECTION HANDLER ────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    // Show QR if user chose QR method
    if (qr && !usePairingCode) {
      console.log(`
╔══════════════════════╗
║  📷  SCAN QR CODE     ║
╚══════════════════════╝
      `)
      qrcode.generate(qr, { small: true })
      console.log('👉 Open WhatsApp → Linked Devices → Link a Device → Scan QR\n')
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      log.warn(`Connection closed. Status code: ${statusCode}`)

      if (shouldReconnect) {
        log.connection('Reconnecting Akaza...')
        startAkaza()
      } else {
        log.error('Akaza was logged out! Delete the sessions folder and restart.')
        process.exit(1)
      }
    }

    if (connection === 'open') {
      console.log(`
╔══════════════════════════════╗
║  ✅  AKAZA IS NOW CONNECTED!  ║
╚══════════════════════════════╝
      `)
      log.success('Akaza connected to WhatsApp successfully! 🔥')
    }
  })

  // ── MESSAGE HANDLER ───────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message) continue
      if (msg.key.fromMe) continue

      const sender = getSender(msg)
      const chatJid = msg.key.remoteJid
      const text = getMessageText(msg)
      const inGroup = isGroup(chatJid)
      const senderIsOwner = isOwner(sender)

      // Track & block banned users
      try {
        const user = getUser(sender)
        updateUser(sender, {
          name: msg.pushName || user.name,
          messageCount: (user.messageCount || 0) + 1,
        })
        if (user.banned) {
          log.warn(`Blocked banned user: ${sender}`)
          continue
        }
      } catch (err) {
        log.error(`DB error: ${err.message}`)
      }

      // Reply helper
      const reply = async (text) => {
        await sock.sendMessage(chatJid, { text }, { quoted: msg })
      }

      // React helper
      const react = async (emoji) => {
        await sock.sendMessage(chatJid, {
          react: { text: emoji, key: msg.key },
        })
      }

      // Command context
      const context = {
        sock,
        msg,
        sender,
        chatJid,
        inGroup,
        isOwner: senderIsOwner,
        args: [],
        reply,
        react,
        store,
      }

      // Route commands
      if (text) {
        const parsed = parseCommand(text, config.prefix)
        if (parsed) {
          context.args = parsed.args
          log.command(sender, parsed.command)
          const found = await runCommand(parsed.command, context)
          if (!found) {
            await reply(config.messages.unknownCommand(config.prefix))
          }
        }
      }
    }
  })

  // ── GROUP UPDATES ─────────────────────
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    log.info(`Group event [${action}] in ${id}`)
  })

  return sock
}

// ── START PAIRING SERVER ──────────────────
const { startServer } = require('./server')
startServer()

// ── BOOT ──────────────────────────────────
console.log(`
  ___  _  __   ___  ____ ___       __  __ ____  
 / _ \\| |/ /  / _ \\|_  // _ \\     |  \\/  |  _ \\ 
| | | | ' /  | | | |/ /| | | |    | |\\/| | | | |
| |_| | . \\  | |_| / /_| |_| |    | |  | | |_| |
 \\___/|_|\\_\\  \\___/____||\\___/     |_|  |_|____/ 
                          
         🔥 Akaza-MD — WhatsApp Bot 🔥
`)

startAkaza().catch((err) => {
  log.error(`Fatal error: ${err.message}`)
  process.exit(1)
})
