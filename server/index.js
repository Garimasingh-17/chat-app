const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const users = {}; // username -> socket.id
const allUsers = new Set();
const privateMessages = {}; // "user1_user2" => [messages]

function getKey(user1, user2) {
  return [user1, user2].sort().join('_');
}

function sendUserList() {
  io.emit('user_list', {
    all: Array.from(allUsers),
    online: Object.keys(users),
  });
}

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('register_user', (username) => {
    users[username] = socket.id;
    allUsers.add(username);
    sendUserList();
  });

  socket.on('sync_users', (usernames) => {
    usernames.forEach((name) => allUsers.add(name));
    sendUserList();
  });

  socket.on('private_message', ({ to, from, message, image, file }) => {
    const time = new Date().toLocaleTimeString();
    const msg = { from, to, message, image, file, time, read: false };

    const key = getKey(from, to);
    if (!privateMessages[key]) privateMessages[key] = [];
    privateMessages[key].push(msg);

    const toSocket = users[to];
    const fromSocket = users[from];

    if (toSocket && to !== from) io.to(toSocket).emit('private_message', msg);
    if (fromSocket) io.to(fromSocket).emit('private_message', msg);
  });

  socket.on('fetch_history', ({ from, to }) => {
    const key = getKey(from, to);
    socket.emit('chat_history', privateMessages[key] || []);
  });

  socket.on('read_receipt', ({ from, to }) => {
    const key = getKey(from, to);
    if (privateMessages[key]) {
      privateMessages[key].forEach((msg) => {
        if (msg.from === to && msg.to === from) msg.read = true;
      });

      const senderSocket = users[to];
      if (senderSocket) {
        io.to(senderSocket).emit('read_receipt_ack', { from, to });
      }
    }
  });

  socket.on('disconnect', () => {
    for (const [user, id] of Object.entries(users)) {
      if (id === socket.id) {
        delete users[user];
        break;
      }
    }
    sendUserList();
  });
});

server.listen(4000, () => {
  console.log('✅ Server running at http://localhost:4000');
});
