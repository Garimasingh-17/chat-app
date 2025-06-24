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
let privateMessages = {}; // "user1_user2" => [messages]
let groups = {}; // groupName => [members]
let groupMessages = {};

const fs = require('fs');
const path = require('path');

const GROUPS_FILE = path.join(__dirname, 'groups.json');
const PRIVATE_MESSAGES_FILE = './privateMessages.json';
const GROUP_MESSAGES_FILE = './groupMessages.json';


function getKey(user1, user2) {
  return [user1, user2].sort().join('_');
}

function sendUserList() {
  io.emit('user_list', {
    all: Array.from(allUsers),
    online: Object.keys(users),
  });
}


try {
  if (fs.existsSync(GROUPS_FILE)) {
    const data = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
    groups = data.groups || {};
    groupMessages = data.groupMessages || {};
    console.log('📂 Loaded groups from file');
  }
} catch (err) {
  console.error('❌ Error loading groups file:', err);
}



try {
  if (fs.existsSync(PRIVATE_MESSAGES_FILE)) {
    privateMessages = JSON.parse(fs.readFileSync(PRIVATE_MESSAGES_FILE, 'utf8'));
    console.log('✅ Loaded private messages from file');
  }
} catch (err) {
  console.error('❌ Error loading private messages:', err);
}

try {
  if (fs.existsSync(GROUP_MESSAGES_FILE)) {
    groupMessages = JSON.parse(fs.readFileSync(GROUP_MESSAGES_FILE, 'utf8'));
    console.log('✅ Loaded group messages from file');
  }
} catch (err) {
  console.error('❌ Error loading group messages:', err);
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
    const unreadCounts = {};
userGroups.forEach(group => {
  const messages = groupMessages[group] || [];
  const unread = messages.filter(m => !m.readBy || !m.readBy.includes(username));
  unreadCounts[group] = unread.length;
});


socket.on('delete_private_message', ({ from, to, timestamp }) => {
  const key = getKey(from, to);
  if (!privateMessages[key]) return;

  privateMessages[key] = privateMessages[key].filter(msg => msg.time !== timestamp);

  // Save changes
  fs.writeFileSync(PRIVATE_MESSAGES_FILE, JSON.stringify(privateMessages, null, 2));

  // Notify both users
  const toSocket = users[to];
  const fromSocket = users[from];
  const payload = { time: timestamp, from, to };

  if (toSocket) io.to(toSocket).emit('private_message_deleted', payload);
  if (fromSocket) io.to(fromSocket).emit('private_message_deleted', payload);
});


socket.on('delete_group_message', ({ groupName, timestamp }) => {
  if (!groupMessages[groupName]) return;

  groupMessages[groupName] = groupMessages[groupName].filter(msg => msg.time !== timestamp);

  // Save changes
  fs.writeFileSync(GROUP_MESSAGES_FILE, JSON.stringify(groupMessages, null, 2));

  // Notify group members
  io.to(groupName).emit('group_message_deleted', { time: timestamp, groupName });
});


socket.emit('group_unread_counts', unreadCounts);

    // After emitting group_list to socket
userGroups.forEach(group => {
  socket.join(group); // 🔁 Join the user to each of their groups
});

  });

  // Create group
  socket.on('create_group', ({ name, members }) => {
    if (!groups[name]) {
      const fullMembers = Array.from(new Set([...members, socket.username]));
      groups[name] = fullMembers;
      fs.writeFileSync(GROUPS_FILE, JSON.stringify({
  groups,
  groupMessages
}, null, 2));

      groupMessages[name] = [];

      console.log(`✅ Group created: ${name} -> [${fullMembers.join(', ')}]`);

      fullMembers.forEach(member => {
        const sockId = users[member];
        if (sockId) {
          const userGroups = Object.entries(groups)
            .filter(([_, groupMembers]) => groupMembers.includes(member))
            .map(([groupName]) => groupName);
          io.to(sockId).emit('group_list', userGroups);
          const memberSocket = io.sockets.sockets.get(sockId);
        if (memberSocket) {
          memberSocket.join(name); // This line ensures the group broadcast will work
        }
        }
      });
    }
  });


  socket.on('get_group_members', ({ groupName }) => {
  const members = groups[groupName] || [];
  socket.emit('group_members', { groupName, members });
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
    
  fs.writeFileSync(PRIVATE_MESSAGES_FILE, JSON.stringify(privateMessages, null, 2));


  });




  
  
  // Fetch private history
  socket.on('fetch_history', ({ from, to }) => {
    const key = getKey(from, to);
    socket.emit('chat_history', privateMessages[key] || []);
  });

  // Group message
 socket.on('group_message', ({ groupName, from, message, file, image, forwarded }) => {
  const time = new Date().toLocaleTimeString();
  const msg = {
    from,
    to: groupName,
    message,
    file,
    image,
    time,
    forwarded,
    readBy: [from], // sender has read
  };

  if (!groupMessages[groupName]) groupMessages[groupName] = [];
  groupMessages[groupName].push(msg);

  io.to(groupName).emit('group_message', msg);

    fs.writeFileSync(GROUP_MESSAGES_FILE, JSON.stringify(groupMessages, null, 2));


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

  socket.on('mark_group_read', ({ groupName, username }) => {
  const msgs = groupMessages[groupName] || [];
msgs.forEach((msg) => {
  // Initialize readBy if it's undefined
  if (!Array.isArray(msg.readBy)) {
    msg.readBy = [];
  }

  if (!msg.readBy.includes(username)) {
    msg.readBy.push(username);
  }
});


  // Notify everyone in the group about the updated read status
  io.to(groupName).emit('group_read_update', {
    groupName,
    messages: msgs,
  });
});


socket.on('add_to_group', ({ groupName, newMembers }) => {
  if (!groups[groupName]) return;

  const addedUsers = [];

  newMembers.forEach((user) => {
    if (!groups[groupName].includes(user)) {
      groups[groupName].push(user);
      addedUsers.push(user);
    }
  });

  if (addedUsers.length > 0) {
    const msg = {
      from: 'System',
      to: groupName,
      message: `✅ ${addedUsers.join(', ')} added to the group.`,
      isSystem: true,
      time: new Date().toLocaleTimeString(),
    };

    groupMessages[groupName] = groupMessages[groupName] || [];
    groupMessages[groupName].push(msg);

    io.to(groupName).emit('group_message', msg);
    fs.writeFileSync(GROUPS_FILE, JSON.stringify({ groups, groupMessages }, null, 2));
  }
});


socket.on('get_group_members', ({ groupName }) => {
  const members = groups[groupName] || [];
  io.to(socket.id).emit('group_members', { groupName, members });
});



socket.on('leave_group', ({ groupName, username }) => {
  if (!groups[groupName]) return;

  // Remove the user from the group
  groups[groupName] = groups[groupName].filter((user) => user !== username);

  // If no users left in the group, you can optionally delete the group
  if (groups[groupName].length === 0) {
    delete groups[groupName];
  }

  // Save changes to file (if persistent)
  fs.writeFileSync(GROUPS_FILE, JSON.stringify({ groups, groupMessages }, null, 2));

  // Remove user from room
  socket.leave(groupName);

  // Notify others in the group
  io.to(groupName).emit('group_update', {
    groupName,
    members: groups[groupName],
    leftBy: username,
  });

  // Send confirmation to the user
  socket.emit('left_group', { groupName });
});


socket.on('remove_from_group', ({ groupName, member }) => {
  if (!groups[groupName]) return;

  groups[groupName] = groups[groupName].filter((user) => user !== member);

  // Optionally delete group if empty
  if (groups[groupName].length === 0) {
    delete groups[groupName];
  }

  // System message to group
  const msg = {
    from: 'System',
    to: groupName,
    message: `❌ ${member} was removed from the group.`,
    isSystem: true,
    time: new Date().toLocaleTimeString(),
  };

  groupMessages[groupName] = groupMessages[groupName] || [];
  groupMessages[groupName].push(msg);

  io.to(groupName).emit('group_message', msg);
  io.to(groupName).emit('group_update', {
    groupName,
    members: groups[groupName],
    removedBy: socket.username || 'admin',
    removedUser: member,
  });

  fs.writeFileSync(GROUPS_FILE, JSON.stringify({ groups, groupMessages }, null, 2));
});



socket.on('add_to_group', ({ groupName, newMember }) => {
  if (!groups[groupName]) return;

  if (!groups[groupName].includes(newMember)) {
    groups[groupName].push(newMember);

    // Send system message to group
    const msg = {
      from: 'System',
      to: groupName,
      message: `✅ ${newMember} was added to the group.`,
      isSystem: true,
      time: new Date().toLocaleTimeString(),
    };

    groupMessages[groupName] = groupMessages[groupName] || [];
    groupMessages[groupName].push(msg);

    io.to(groupName).emit('group_message', msg);

    // Save to file
    fs.writeFileSync(GROUPS_FILE, JSON.stringify({ groups, groupMessages }, null, 2));
  }
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