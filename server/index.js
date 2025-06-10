// server.js or index.js (backend)
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let users = {}; // socket.id -> username

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (username) => {
    users[socket.id] = username;

    // Send updated user list to all clients
    io.emit("user_list", Object.values(users));
  });

  socket.on("send_message", (data) => {
    const targetSocketId = Object.keys(users).find(
      (id) => users[id] === data.to
    );
    if (targetSocketId) {
      io.to(targetSocketId).emit("receive_message", data);
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("user_list", Object.values(users));
  });
});

server.listen(4000, () => {
  console.log("Server is running on port 4000");
});
