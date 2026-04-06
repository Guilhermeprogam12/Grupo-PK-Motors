const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json({ limit: '60mb' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let client;

function iniciarCliente() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--shm-size=1gb']
        }
    });

    client.on('qr', (qr) => {
        qrcode.toDataURL(qr, (err, url) => { io.emit('qr', url); });
    });

    client.on('ready', () => {
        console.log('✅ Shineray PK Motors Conectada!');
        io.emit('ready', true);
    });

    client.initialize().catch(err => console.error("Erro na inicialização:", err));
}

app.post('/logout', async (req, res) => {
    try {
        await client.logout();
        await client.destroy();
        if (fs.existsSync('./.wwebjs_auth')) {
            fs.rmSync('./.wwebjs_auth', { recursive: true, force: true });
        }
        iniciarCliente();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/contacts', async (req, res) => {
    try {
        // Força uma espera curta para garantir sincronização da agenda
        const contacts = await client.getContacts();
        const filtered = contacts
            .filter(c => c.isMyContact && c.id.server === 'c.us')
            .map(c => ({ id: c.id._serialized, name: c.name || c.pushname || 'Cliente' }))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.json(filtered);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/send', async (req, res) => {
    const { number, message, media } = req.body;
    try {
        // Limpeza rigorosa do número para o envio manual
        let cleanNumber = number.replace(/\D/g, '');
        if (!cleanNumber.endsWith('@c.us')) {
            cleanNumber += '@c.us';
        }

        if (media && media.data) {
            const file = new MessageMedia(media.mimetype, media.data, media.filename);
            await client.sendMessage(cleanNumber, file, { caption: message });
        } else {
            await client.sendMessage(cleanNumber, message);
        }
        res.json({ success: true });
    } catch (err) { 
        console.error("Erro no envio:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

iniciarCliente();
server.listen(3000, () => console.log('🚀 Sistema Online: http://localhost:3000'));