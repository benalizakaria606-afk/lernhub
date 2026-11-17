import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "node:http";
import { Server } from "socket.io";
import OpenAI from "openai";
import db from "./db.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve("uploads")));
fs.mkdirSync("uploads", { recursive: true });

const aiLimiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Nur PDF-, PNG- und JPG-Dateien sind erlaubt."), allowed.includes(file.mimetype));
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY) }));

app.get("/api/materials", (req, res) => {
  const subject = String(req.query.subject || "");
  const rows = subject
    ? db.prepare("SELECT * FROM materials WHERE subject=? ORDER BY id DESC").all(subject)
    : db.prepare("SELECT * FROM materials ORDER BY id DESC LIMIT 40").all();
  res.json(rows);
});

app.post("/api/materials", uploadLimiter, upload.single("file"), (req, res) => {
  const subject = String(req.body.subject || "").slice(0, 60);
  const title = String(req.body.title || "").trim().slice(0, 120);
  const body = String(req.body.body || "").slice(0, 12000);
  const kind = String(req.body.kind || "Aufschrieb").slice(0, 40);
  if (!subject || !title) return res.status(400).json({ error: "Fach und Titel sind erforderlich." });
  const fileName = req.file?.originalname || null;
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare("INSERT INTO materials(subject,title,kind,body,file_name,file_url) VALUES(?,?,?,?,?,?)")
    .run(subject, title, kind, body, fileName, fileUrl);
  const item = db.prepare("SELECT * FROM materials WHERE id=?").get(info.lastInsertRowid);
  io.emit("material:new", item);
  res.status(201).json(item);
});

app.get("/api/messages", (_req, res) => {
  res.json(db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 100").all().reverse());
});

app.post("/api/messages", (req, res) => {
  const author = String(req.body.author || "Schüler/in").trim().slice(0, 32);
  const body = String(req.body.body || "").trim().slice(0, 1500);
  if (!body) return res.status(400).json({ error: "Nachricht darf nicht leer sein." });
  const info = db.prepare("INSERT INTO messages(author,body) VALUES(?,?)").run(author, body);
  const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(info.lastInsertRowid);
  io.emit("chat:new", msg);
  res.status(201).json(msg);
});

app.post("/api/ai", aiLimiter, async (req, res) => {
  const { subject, question, history = [], materialContext = "" } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Der KI-Agent ist noch nicht eingerichtet. Ein Administrator muss den API-Key auf dem Server hinterlegen." });
  if (!String(question || "").trim()) return res.status(400).json({ error: "Bitte gib zuerst eine Frage ein." });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const subjectName = String(subject || "Allgemein").slice(0, 60);
    const system = `Du bist LernHub AI, ein geduldiger Lernassistent für Schülerinnen und Schüler der Klasse 10 in Baden-Württemberg. Fach: ${subjectName}. Erkläre in einfachem, klarem Deutsch und passe die Tiefe an Klasse 10 an. Gehe Schritt für Schritt vor, nutze passende Beispiele und prüfe Verständnis. Bei Aufgaben hilf beim Lösungsweg statt nur kommentarlos die Lösung zu nennen. Erfinde keine Fakten. Wenn Unterrichtsmaterial mitgeschickt wurde, nutze es vorrangig und sage klar, wenn etwas daraus nicht hervorgeht.`;
    const messages = [
      { role: "system", content: system + (materialContext ? `\n\nMaterial aus LernHub:\n${String(materialContext).slice(0, 9000)}` : "") },
      ...history.slice(-8).filter(m => ["user", "assistant"].includes(m.role)).map(m => ({ role: m.role, content: String(m.content).slice(0, 3000) })),
      { role: "user", content: String(question).slice(0, 5000) }
    ];
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 1200
    });
    res.json({ answer: completion.choices[0]?.message?.content || "Ich konnte gerade keine Antwort erstellen." });
  } catch (err) {
    console.error("AI error:", err.message);
    res.status(500).json({ error: "Der KI-Agent konnte gerade nicht antworten. Bitte versuche es später erneut." });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: "Upload fehlgeschlagen. Maximal 8 MB pro Datei." });
  res.status(400).json({ error: err.message || "Ungültige Anfrage." });
});

io.on("connection", socket => {
  socket.emit("chat:connected", { ok: true });
});

app.use(express.static(path.resolve("dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  const index = path.resolve("dist/index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(200).send("LernHub-Server läuft. Starte für die Entwicklung zusätzlich den Vite-Client.");
});

httpServer.listen(PORT, "0.0.0.0", () => console.log(`LernHub läuft auf Port ${PORT}`));
