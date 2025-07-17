const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise'); // Use promise-based mysql2
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Session setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use(express.static('public'));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// DB connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Multer setup
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
  })
});

// Runtime storage
const broadcasters = new Set();
const viewers = new Map();
const activeUsers = new Map();
const streamSocketMap = new Map();

// WebSocket
io.on('connection', socket => {
  console.log('🔌 User connected:', socket.id);

  socket.on('login-user-id', (userId) => {
    activeUsers.set(socket.id, userId);
  });

  socket.on('broadcaster', () => {
    broadcasters.add(socket.id);
    io.emit('broadcaster-list', [...broadcasters]);
  });

  socket.on('watcher-ready', () => {
    socket.emit('broadcaster-list', [...broadcasters]);
  });

  socket.on('watcher', (streamId) => {
    if (viewers.has(socket.id)) return;

    const broadcasterSocketId = streamSocketMap.get(streamId);
    if (broadcasterSocketId) {
      viewers.set(socket.id, broadcasterSocketId);
      io.to(broadcasterSocketId).emit('watcher', socket.id);
    }
    socket.emit('watcher-accepted', { streamId });
  });

  socket.on('offer', (id, message) => {
    io.to(id).emit('offer', socket.id, message);
  });

  socket.on('answer', (id, message) => {
    io.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    io.to(id).emit('candidate', socket.id, message);
  });

  socket.on('start-stream', async ({ title, thumbnail }) => {
    const userId = activeUsers.get(socket.id);
    if (!userId) return;

    try {
      const [result] = await db.execute(
        'INSERT INTO streams (streamer_id, stream_title, is_live, thumbnail) VALUES (?, ?, 1, ?)',
        [userId, title, thumbnail]
      );
      const streamId = result.insertId;
      streamSocketMap.set(streamId, socket.id);
      broadcasters.add(socket.id);
      io.emit('broadcaster-list', [...broadcasters]);
    } catch (err) {
      console.error('Error starting stream:', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log('Disconnected:', socket.id);

    if (broadcasters.has(socket.id)) {
      broadcasters.delete(socket.id);
      io.emit('broadcaster-disconnected', socket.id);
    }

    if (viewers.has(socket.id)) {
      const broadcasterId = viewers.get(socket.id);
      io.to(broadcasterId).emit('viewer-disconnected', socket.id);
      viewers.delete(socket.id);
    }

    const userId = activeUsers.get(socket.id);
    if (userId) {
      try {
        await db.execute('UPDATE streams SET is_live = 0 WHERE streamer_id = ? AND is_live = 1', [userId]);
      } catch (err) {
        console.error('Error updating stream status on disconnect:', err);
      }
    }

    for (const [streamId, sockId] of streamSocketMap.entries()) {
      if (sockId === socket.id) {
        streamSocketMap.delete(streamId);
      }
    }

    activeUsers.delete(socket.id);
    io.emit('broadcaster-list', [...broadcasters]);
  });
});

// API Endpoints

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [results] = await db.execute(
      'SELECT user_id, user_type FROM users WHERE username = ? AND password = ?',
      [username, password]
    );

    if (results.length > 0) {
      const { user_id, user_type } = results[0];
      req.session.user_id = user_id;
      req.session.user_type = user_type;

      res.json({
        success: true,
        redirect: user_type === 'streamer' ? '/index.html' : '/viewer.html'
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/session-user', (req, res) => {
  if (req.session.user_id) {
    res.json({
      user_id: req.session.user_id,
      user_type: req.session.user_type
    });
  } else {
    res.status(401).json({ message: 'Not logged in' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Error logging out");
    res.send("Logged out");
  });
});

app.post('/upload-thumbnail', upload.single('thumbnail'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ filename: `uploads/${req.file.filename}` });
});

app.post('/post', async (req, res) => {
  const { stream_id, chat } = req.body;
  const user_id = req.session.user_id;

  if (!stream_id || !chat || !user_id) {
    return res.status(400).send('All fields required');
  }

  try {
    await db.execute('INSERT INTO chats (stream_id, chat, user_id) VALUES (?, ?, ?)', [
      stream_id,
      chat,
      user_id
    ]);
    res.send('Chat inserted successfully');
  } catch (err) {
    console.error('Error inserting chat:', err);
    res.status(500).send('Chat insert failed');
  }
});

app.get('/live-streams', async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT streams.stream_id, streams.stream_title, streams.is_live, 
             streams.thumbnail, users.username
      FROM streams 
      JOIN users ON streams.streamer_id = users.user_id 
      WHERE is_live = 1;
    `);
    res.json(results);
  } catch (err) {
    console.error('Error fetching streams:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/chats', async (req, res) => {
  const streamId = req.query.stream_id;

  if (!streamId) return res.status(400).send("Stream ID is required");

  try {
    const [rows] = await db.execute(`
      SELECT chats.chat, users.username 
      FROM chats
      JOIN users ON chats.user_id = users.user_id
      WHERE chats.stream_id = ?
      ORDER BY chats.chat_id DESC
      LIMIT 10
    `, [streamId]);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).send("Server error");
  }
});

app.post('/signup', upload.single('image'), async (req, res) => {
  try {
    const { username, password, user_type } = req.body;
    const image = req.file?.filename;

    if (!username || !password || !user_type || !image) {
      return res.status(400).send('All fields required');
    }

    await db.execute(
      `INSERT INTO users (username, password, user_type, image) VALUES (?, ?, ?, ?)`,
      [username, password, user_type, image]
    );

    res.status(201).send('Signed up successfully');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).send('Signup failed');
  }
});
app.get('/search-stream', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json([]);
  }

  try {
    const [results] = await db.execute(`
      SELECT streams.stream_id, streams.stream_title, streams.thumbnail, streams.is_live, users.username
      FROM streams
      JOIN users ON streams.streamer_id = users.user_id
      WHERE streams.stream_title LIKE ?
    `, [`${query}%`]);

    res.json(results);
  } catch (err) {
    console.error('Search query failed:', err);
    res.status(500).json([]);
  }
});


// Start server
server.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});
