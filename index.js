import express from "express"
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys"
import pino from "pino"
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static("views")) // serve static HTML page

// WhatsApp connection
let sock

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(process.env.BOT_SESSION_NAME)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false // we use pairing code instead
    })

    sock.ev.on("creds.update", saveCreds)
}

startBot()

// Endpoint to generate pair code
app.get("/pair", async (req, res) => {
    if (!sock) return res.json({ code: "Bot not ready" })
    try {
        const code = await sock.requestPairingCode(process.env.OWNER_NUMBER)
        res.json({ code })
    } catch (e) {
        res.json({ code: "Error generating code" })
        console.error(e)
    }
})

// Start server
app.listen(PORT, () => {
    console.log(`Pair site running on http://localhost:${PORT}`)
})
