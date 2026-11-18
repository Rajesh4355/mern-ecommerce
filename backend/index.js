const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/Auth");
const productRoutes = require("./routes/Product");
const orderRoutes = require("./routes/Order");
const cartRoutes = require("./routes/Cart");
const brandRoutes = require("./routes/Brand");
const categoryRoutes = require("./routes/Category");
const userRoutes = require("./routes/User");
const addressRoutes = require("./routes/Address");
const reviewRoutes = require("./routes/Review");
const wishlistRoutes = require("./routes/Wishlist");
const { connectToDB } = require("./database/db");
const { isMongoReady } = require("./database/memoryModel");

// server init
const server = express();
server.set("trust proxy", 1);

const configuredOrigin =
  process.env.ORIGIN && !process.env.ORIGIN.includes("your-frontend-domain")
    ? process.env.ORIGIN
    : true;

// middlewares
server.use(
  cors({
    origin: configuredOrigin,
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);
server.use(express.json());
server.use(cookieParser());
server.use(morgan("tiny"));

// API routes mounted under /api
server.use("/api/auth", authRoutes);
server.use("/api/users", userRoutes);
server.use("/api/products", productRoutes);
server.use("/api/orders", orderRoutes);
server.use("/api/cart", cartRoutes);
server.use("/api/brands", brandRoutes);
server.use("/api/categories", categoryRoutes);
server.use("/api/address", addressRoutes);
server.use("/api/reviews", reviewRoutes);
server.use("/api/wishlist", wishlistRoutes);

server.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "running",
    database: isMongoReady() ? "mongodb" : "in-memory",
  });
});

// Serve frontend production build
const frontendBuildPath = path.join(__dirname, "..", "frontend", "build");
if (fs.existsSync(frontendBuildPath)) {
  server.use(express.static(frontendBuildPath));
  server.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
}

// Graceful Mongoose offline error middleware
server.use((err, req, res, next) => {
  if (
    err.name === "MongooseError" ||
    err.name === "MongoNetworkError" ||
    (err.message && err.message.includes("buffering timed out"))
  ) {
    console.warn("[AI Studio] Database offline — returning mock empty response");
    if (req.method === "GET") {
      return res.json(req.path.endsWith("s") || req.path.endsWith("s/") ? [] : {});
    }
    return res.status(503).json({ error: "Service temporarily unavailable (database offline)" });
  }
  next(err);
});

const PORT = parseInt(process.env.PORT || "3000", 10);

connectToDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`server [STARTED] ~ http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize server:", err);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`server [STARTED] ~ http://0.0.0.0:${PORT}`);
    });
  });