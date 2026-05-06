const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
// ✅ Middleware
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// ✅ Upload folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));

// ✅ MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/fileuploaddb");

mongoose.connection.on("connected", () =>
  console.log("✅ MongoDB connected")
);

mongoose.connection.on("error", (err) =>
  console.error("❌ MongoDB error:", err)
);

// ✅ Schema
const fileSchema = new mongoose.Schema({
  originalName: String,
  fileName: String,
  mimeType: String,
  size: Number,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
});

const File = mongoose.model("File", fileSchema);

// ✅ Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random();
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ✅ Routes
app.get("/", (req, res) => {
  res.json({ message: "API working ✅" });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const fileDoc = new File({
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    });

    await fileDoc.save();

    res.json({ message: "Uploaded", file: fileDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/files", async (req, res) => {
  const files = await File.find().sort({ uploadedAt: -1 });
  res.json(files);
});

app.delete("/api/files/:id", async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(uploadsDir, file.fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await File.findByIdAndDelete(req.params.id);

  res.json({ message: "Deleted" });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

// ✅ Start server
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
