const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const users = {}; // username -> socket.id
const privateMessages = {}; // "alice_bob" => [ { from, to, message, image, time } ]

function getKey(user1, user2) {
  return [user1, user2].sort().join('_');
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('register_user', (username) => {
    users[username] = socket.id;
    io.emit('user_list', Object.keys(users));
  });

  socket.on('private_message', ({ to, from, message, image }) => {
    const time = new Date().toLocaleTimeString();
    const msg = { from, to, message, image, time };

    const key = getKey(from, to);
    if (!privateMessages[key]) privateMessages[key] = [];
    privateMessages[key].push(msg);

    // Send to receiver if online
    const recipientSocket = users[to];
    if (recipientSocket && to !== from) {
      io.to(recipientSocket).emit('private_message', msg);
    }

    // Always send to sender
    const senderSocket = users[from];
    if (senderSocket) {
      io.to(senderSocket).emit('private_message', msg);
    }
  });

  socket.on('fetch_history', ({ from, to }) => {
    const key = getKey(from, to);
    socket.emit('chat_history', privateMessages[key] || []);
  });

  socket.on('disconnect', () => {
    for (const [name, id] of Object.entries(users)) {
      if (id === socket.id) {
        delete users[name];
        break;
      }
    }
    io.emit('user_list', Object.keys(users));
  });
});

server.listen(4000, () => {
  console.log('✅ Server running on http://localhost:4000');
});
