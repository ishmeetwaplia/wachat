require('dotenv').config(); 
const express = require('express');
const connectDB = require('./config/db');
const tenantResolver = require('./middleware/tenantResolver');
const cors = require('cors');
const http = require('http')
const { Server } = require('socket.io');
const path = require("path");
const fs = require("fs");
// const axios = require('axios');

const tenantRoutes = require('./routes/tenant');
const userRoutes = require('./routes/user');
const siteRoutes = require('./routes/site');
const projectRoutes = require('./routes/project');
const groupRoutes = require('./routes/group');
const conntactRoutes = require('./routes/contact');
const templateRoutes = require('./routes/template');
const messageRoutes = require('./routes/message');
const webhookRoutes = require('./routes/webhook');
const teamMemberRoutes = require('./routes/teamMember'); 
const whatsappRoutes = require('./routes/whatsapp'); 
const conversationRoutes = require('./routes/conversation');
const dashboardRoutes = require('./routes/dashboardRoutes');
const projectDashboardRoutes = require('./routes/projectDashboard');
const flowRoutes = require('./routes/flowRoutes');
const catalogRoutes = require('./routes/catalog');

connectDB();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const allowedOrigins = [
  'http://localhost:5173',
  'https://wachatfinal.onrender.com',
  'https://c1d2faae5baf.ngrok-free.app',
  "http://192.168.1.86:5173/",
  "http://172.16.0.2:5173/",
  "https://sabnode.netlify.app",
  "https://grand-chebakia-1cba30.netlify.app",
  "https://wachaat.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-Domain'
  ]
}));
app.set('trust proxy', true);
app.use((req, res, next) => {
  const referer = req.headers.referer;
  if(referer && /WAITFOR|SLEEP|DELAY|BENCHMARK|--/i.test(referer)) {
    console.warn('Potential SQL injection attempt in Referer header: ', referer);
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Bad Request"
    });
  }
  next();
});

app.use('/api/webhook', webhookRoutes);
app.use('/api/site', siteRoutes);
app.use('/api', tenantResolver);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/whatsapp/', whatsappRoutes); 
app.use('/api/templates', templateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects/:projectId/groups', groupRoutes);
app.use('/api/projects/:projectId/contacts', conntactRoutes);
app.use('/api/projects/:projectId/conversations', conversationRoutes);
app.use('/api/projects/:projectId/flows', flowRoutes);
app.use('/api/projects/', projectDashboardRoutes);
app.use('/api/projects/:projectId/messages', messageRoutes);
app.use('/api/projects/:projectId/team-member', teamMemberRoutes);
app.use('/api/catalog', catalogRoutes);

// app.get('/auth/facebook/login', (req, res) => {
//   const redirectUri = encodeURIComponent(`https://wachat.matkadash.in/auth/facebook/callback`);
//   const scope = [
//     'whatsapp_business_messaging',
//     'whatsapp_business_management',
//     'business_management',
//     'pages_manage_metadata'
//   ].join(',');
//   const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=704878479078160&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
//   res.redirect(authUrl);
// });

// app.get('/auth/facebook/callback', async (req, res) => {
//   const { code, error } = req.query;
//   if (error) {
//     console.error('Facebook OAuth Error:', req.query.error_description);
//     return res.status(400).send('Authentication failed: ' + req.query.error_description);
//   }

//   if (!code) {
//     return res.status(400).send('Missing authorization code.');
//   }

//   const redirectUri = `https://wachat.matkadash.in/auth/facebook/callback`;

//   try {
//     const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
//       params: {
//         client_id: "704878479078160",
//         client_secret: "7a262e581162c5d2c8900a734d73fa59",
//         redirect_uri: redirectUri,
//         code
//       }
//     });

//     console.log("=============tokenRes", tokenRes);

//     const access_token = tokenRes.data.access_token;

//     // Step 3: Get business and WABA info
//     const bizRes = await axios.get('https://graph.facebook.com/v19.0/me/owned_businesses', {
//       params: { access_token }
//     });

//     const business_id = bizRes.data.data[0]?.id;

//     const wabaRes = await axios.get(`https://graph.facebook.com/v19.0/${business_id}/client_whatsapp_business_accounts`, {
//       params: { access_token }
//     });

//     const waba_id = wabaRes.data.data[0]?.id;

//     const phoneNumberRes = await axios.get(`https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`, {
//       params: { access_token }
//     });

//     const phone_number_id = phoneNumberRes.data.data[0]?.id;

//     // Step 4: Set webhook to your global URL
//     await axios.post(`https://graph.facebook.com/v19.0/704878479078160/subscriptions`, {
//       object: 'whatsapp_business_account',
//       callback_url: `https://wachat.matkadash.in/api/webhook/whatsapp`,
//       fields: 'messages,message_deliveries,message_reads',
//       verify_token: "token"
//     }, {
//       params: { access_token }
//     });

//     // Step 5: Store in DB
//     // await oauth.findOneAndUpdate(
//     //   { facebookUserId: req.query.user_id || 'default' },
//     //   {
//     //     facebookUserId: req.query.user_id || 'default',
//     //     access_token,
//     //     business_id,
//     //     waba_id,
//     //     phone_number_id
//     //   },
//     //   { upsert: true, new: true }
//     // );

//     // Redirect to frontend
//     res.redirect(`http://localhost:5173/success`);
//   } catch (err) {
//     console.error(err?.response?.data || err.message);
//     res.status(500).send("OAuth failed");
//   }
// });

// app.post('/api/webhook/whatsapp', async (req, res) => {
//   const payload = req.body;
//   console.log('Incoming Webhook:', JSON.stringify(payload, null, 2));
//   res.sendStatus(200);
// });

const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const logFile = path.join(__dirname, "server.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false
  });
  const timestampedMessage = `[${timestamp}] ${message}\n`;

  logStream.write(timestampedMessage);
  originalConsoleLog(timestampedMessage);
};

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));