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
const groups = {}; // groupName => [members]
const groupMessages = {};

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
    socket.username = username;
    allUsers.add(username);
    sendUserList();

    // Send groups that user is a part of
    const userGroups = Object.entries(groups)
      .filter(([_, members]) => members.includes(username))
      .map(([name]) => name);
    socket.emit('group_list', userGroups);
  });

  // Create group
  socket.on('create_group', ({ name, members }) => {
    if (!groups[name]) {
      const fullMembers = Array.from(new Set([...members, socket.username]));
      groups[name] = fullMembers;
      groupMessages[name] = [];

      console.log(`✅ Group created: ${name} -> [${fullMembers.join(', ')}]`);

      fullMembers.forEach(member => {
        const sockId = users[member];
        if (sockId) {
          const userGroups = Object.entries(groups)
            .filter(([_, groupMembers]) => groupMembers.includes(member))
            .map(([groupName]) => groupName);
          io.to(sockId).emit('group_list', userGroups);
        }
      });
    }
  });

  // Send private message
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

  // Fetch private history
  socket.on('fetch_history', ({ from, to }) => {
    const key = getKey(from, to);
    socket.emit('chat_history', privateMessages[key] || []);
  });

  // Group message
  socket.on('group_message', ({ groupName, from, message, file, image, forwarded }) => {
    const time = new Date().toLocaleTimeString();
    const msg = { from, to: groupName, message, file, image, time, forwarded };

    if (!groupMessages[groupName]) groupMessages[groupName] = [];
    groupMessages[groupName].push(msg);

    const members = groups[groupName] || [];
    members.forEach((member) => {
      const memberSocket = users[member];
      if (memberSocket) {
        io.to(memberSocket).emit('group_message', msg);
      }
    });
  });

  // Read receipt
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

  // Fetch group history
  socket.on('fetch_group_history', ({ groupName }) => {
    socket.emit('chat_history', groupMessages[groupName] || []);
  });

  // Sync all users
  socket.on('sync_users', (usernames) => {
    usernames.forEach((name) => allUsers.add(name));
    sendUserList();
  });

  // Handle disconnect
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
