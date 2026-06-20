const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;

let server = require('./qr');
let code = require('./pair');

require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware first
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/server', server);
app.use('/code', code);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'pair.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'qr.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'main.html'));
});

// Error handling
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════╗
║     🔥  A K A Z A - M D  🔥   ║
║    Session Generator Online   ║
╚══════════════════════════════╝
   Server running on port: ${PORT}
`);
});

module.exports = app;
