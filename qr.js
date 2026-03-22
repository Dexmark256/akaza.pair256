const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();

    async function AKAZA_QR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) await res.end(await QRCode.toBuffer(qr));

                if (connection === "open") {
                    await delay(5000);

                    const rf = __dirname + `/temp/${id}/creds.json`;

                    try {
                        const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const session_id = "akaza~" + string_session;

                        // Send session ID
                        let code = await sock.sendMessage(sock.user.id, { text: session_id });

                        // Send welcome message
                        const welcomeMsg =
`*Hey there, AKAZA-MD User!* 👋🔥

Thanks for using *AKAZA-MD* — your session has been successfully created!

🔐 *Session ID:* Sent above
⚠️ *Keep it safe!* Do NOT share this with anyone.

━━━━━━━━━━━━━━━━━━━━

*✅ Stay Updated:*
Join our official WhatsApp Channel:
https://whatsapp.com/channel/0029VbA6MSYJUM2TVOzCSb2A

*💻 Source Code:*
https://github.com/Dexmark256/akaza.pair256

━━━━━━━━━━━━━━━━━━━━

> *🔥 Powered by AKAZA-MD*`;

                        await sock.sendMessage(sock.user.id, {
                            text: welcomeMsg,
                            contextInfo: {
                                externalAdReply: {
                                    title: "🔥 AKAZA-MD Connected ✅",
                                    body: "Session Generated Successfully!",
                                    thumbnailUrl: "https://files.catbox.moe/qzm8n5.jpg",
                                    sourceUrl: "https://github.com/Dexmark256/akaza.pair256",
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }
                            }
                        }, { quoted: code });

                    } catch (e) {
                        console.error("[AKAZA-QR] Session upload error:", e);
                        let errMsg = await sock.sendMessage(sock.user.id, { text: String(e) });

                        await sock.sendMessage(sock.user.id, {
                            text: `⚠️ *AKAZA-MD* — Session created but upload failed.\nPlease retry.\n\n> 🔥 Powered by AKAZA-MD`,
                            contextInfo: {
                                externalAdReply: {
                                    title: "🔥 AKAZA-MD",
                                    body: "Session Error — Please Retry",
                                    thumbnailUrl: "https://files.catbox.moe/qzm8n5.jpg",
                                    sourceUrl: "https://github.com/Dexmark256/akaza.pair256",
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }
                            }
                        }, { quoted: errMsg });
                    }

                    await delay(10);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);
                    console.log(`[AKAZA-QR] ✅ ${sock.user.id} paired via QR`);
                    await delay(10);
                    process.exit();

                } else if (
                    connection === "close" &&
                    lastDisconnect?.error?.output?.statusCode !== 401
                ) {
                    await delay(10);
                    AKAZA_QR_CODE();
                }
            });

        } catch (err) {
            console.error("[AKAZA-QR] Service error:", err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "❗ Service Unavailable — Try Again" });
            }
        }
    }

    await AKAZA_QR_CODE();
});

// Auto-restart every 30 minutes to keep clean
setInterval(() => {
    console.log("[AKAZA-QR] ♻️ Auto-restarting process...");
    process.exit();
}, 1800000);

module.exports = router;
