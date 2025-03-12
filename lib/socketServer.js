// lib/socketServer.js
let ioInstance;

export function initIO(server) {
  const { Server } = require("socket.io");
  ioInstance = new Server(server, { cors: { origin: "*" } });
  
  ioInstance.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
  });
  
  return ioInstance;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO instance has not been initialized.");
  }
  return ioInstance;
}
