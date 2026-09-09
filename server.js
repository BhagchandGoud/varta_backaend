import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import { networkInterfaces } from "os";
import UserModel from "./models/UserModel.js";
import MessageModel from "./models/messageModel.js";
import path from 'path';
import helmet from 'helmet'

import dbConnection from "./connection/db.js";
import { serverRoutes } from "./serverRoutes.js";
import GEOHASH from "./algorithms/geoHash.js";
import Queue from "./algorithms/queue/messageQueue.js";
import EmailService from "./services/emailVerification.js";



import {
  processQueue,
  setAppLocals,
  handleTyping,
  handleStopTyping,
  handleMarkRead,
} from "./utils/messageProcessor.js";

dotenv.config();

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}
const port = process.env.PORT || 5000;
const app = express();

const server = createHttpServer(app);

const allowedOrigins = [
  process.env.ORIGIN,
  process.env.FRONTEND_URL,
  process.env.DEV_TUNNEL_ORIGIN,
  ...(process.env.CORS_ORIGINS || "").split(","),
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:5000",
  "https://localhost:5000",
  "http://192.168.56.1:5173",
  "https://192.168.56.1:5173",
  "http://192.168.56.1:5000",
  "https://192.168.56.2:5173",
  "https://192.168.56.1:5000",
  "http://192.168.1.144:5173",
  "https://192.168.1.144:5173",
  "http://192.168.1.144:5000",
  "https://192.168.1.144:5000",
  "https://10.10.118.168:5173",
  "https://10.0.0.2:5173"
].map((origin) => origin?.trim()).filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin && origin.endsWith(".devtunnels.ms")) return true;
  return false;
};

// Serve static files with proper CORS headers
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));



app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin denied: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(helmet());

serverRoutes(app);
dbConnection();

app.use((err, req, res, next) => {
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket.IO CORS origin denied: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  },
});

const onlineUsers = new Map();
const geoHash = new GEOHASH();

const messageQueue = new Queue();
const emailService = new EmailService();
const nearbyEmailCooldown = new Map();

let processing = false;

app.locals.messageQueue = messageQueue;
app.locals.processQueue = processQueue;

app.locals.io = io;
app.locals.onlineUsers = onlineUsers;
app.locals.geoHash = geoHash;

setAppLocals(app);

const emitOnlineUsers = () => {
  const usersArray = Array.from(onlineUsers.values());
  io.emit("online-users", usersArray);
};

io.on("connection", (socket) => {

  socket.emit("me", socket.id);

  socket.on("join", (user) => {
    if (!user || !user.userId) {
      socket.emit("join-error", { message: "Invalid user data" });
      return;
    }


    socket.userId = user.userId;
    socket.username = user.username;

    socket.join(user.userId);

    const existingUser = onlineUsers.get(user.userId);
    if (existingUser) {
      existingUser.socketId = socket.id;
    } else {
      onlineUsers.set(user.userId, {
        userId: user.userId,
        socketId: socket.id,
        name: user.username,
        latitude: null,
        longitude: null,
        geoHash: null,
        lastUpdate: null,
      });
    }
    emitOnlineUsers();
    socket.emit("join-success", { userId: user.userId });
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    handleTyping(io, { senderId, receiverId });
  });

  socket.on("stop-typing", ({ senderId, receiverId }) => {
    handleStopTyping(io, { senderId, receiverId });
  });

  socket.on(
    "markMessage-read",
    ({ message, senderId, receiverId, status, messageId }) => {
      handleMarkRead(io, { message, senderId, receiverId, status, messageId });
    },
  );

  

  socket.on("share-my-location", async (data) => {
    try {
      const { latitude, longitude } = data;

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return socket.emit("location-error", {
          success: false,
          message: "Invalid latitude or longitude.",
        });
      }


      const currentUser = onlineUsers.get(socket?.userId);

      if (!currentUser) {
        return socket.emit("location-error", {
          success: false,
          message: "User is not connected.",
        });
      }

      const hash = geoHash.encode(latitude, longitude, 7);

      currentUser.latitude = latitude;
      currentUser.longitude = longitude;
      currentUser.geoHash = hash;
      currentUser.lastUpdate = Date.now();

      const updatedUser = await UserModel.findByIdAndUpdate(
        socket.userId,
        {
          locationEnabled: true,
          location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          geoHash: hash,
          lastLocationUpdate: new Date(),
        },
        {
          returnDocument: "after",
        },
      );


      const neighbours = geoHash.neighbors(hash);
      const searchHashes = [hash, ...Object.values(neighbours)];

      const candidateUsers = Array.from(onlineUsers.values()).filter((user) => {
        return (
          user.userId !== socket.userId &&
          user.latitude != null &&
          user.longitude != null &&
          searchHashes.includes(user.geoHash)
        );
      });

      const nearbyUsers = candidateUsers
        .map((user) => {
          const distance = geoHash.haversineDistance(
            latitude,
            longitude,
            user.latitude,
            user.longitude,
          );

          return {
            userId: user.userId,
            name: user.name,
            latitude: user.latitude,
            longitude: user.longitude,
            distance: Number(distance.toFixed(2)),
          };
        })
        .filter((user) => user.distance <= 10)
        .sort((a, b) => a.distance - b.distance);

      const lastNearbyEmail = nearbyEmailCooldown.get(socket.userId) || 0;
      if (nearbyUsers.length > 0 && Date.now() - lastNearbyEmail > 10 * 60 * 1000) {
        const nearbyUserRecords = await UserModel.find({
          _id: { $in: nearbyUsers.map((user) => user.userId) },
        }).select("username email").lean();
        if (updatedUser.email && nearbyUserRecords.length > 0) {
          nearbyEmailCooldown.set(socket.userId, Date.now());
          emailService.sendNearbyUsersEmail({
            email: updatedUser.email,
            username: updatedUser.username,
            nearbyUsers: nearbyUserRecords,
          }).catch(() => {});
        }
      }


      socket.emit("nearby-users", {
        success: true,
        users: nearbyUsers,
      });

      socket.broadcast.emit("user-location-updated", {
        userId: socket.userId,
      });
    } catch (error) {

      socket.emit("location-error", {
        success: false,
        message: error.message,
      });
    }
  });

});

const start = () => {
  const srv = server.listen(port, "0.0.0.0", () => {
    const protocol = "http";
  });

  srv.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      return;
    }
    throw err;
  });
};

start();