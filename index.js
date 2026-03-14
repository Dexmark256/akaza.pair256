import express from "express"
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys"
import pino from "pino"
import 'dotenv/config'
import path from "path"

const app = express()
const PORT = process.env.PORT || 3000

// Serve HTML files
app.use(express.static("views"))

// Ensure homepage loads
app.get("/", (req, res) => {
    res.sendFile(path.resolve("views/index.html"))
})

// WhatsApp connection
let sock

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(process.env.BOT_SESSION_NAME)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)
}

startBot()

// Generate pairing code
app.get("/pair", async (req, res) => {

    const number = req.query.number || process.env.OWNER_NUMBER

    if (!sock) {
        return res.json({ code: "Bot not ready" })
    }

    try {
        const code = await sock.requestPairingCode(number)
        res.json({ code })
    } catch (e) {
        console.error(e)
        res.json({ code: "Error generating code" })
    }
})

// Start server
app.listen(PORT, () => {
    console.log(`Pair site running on http://localhost:${PORT}`)
})
