import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { summarizeFile as summarizeWithAnthropic } from "../services/anthropic";
import { summarizeFile as summarizeWithOpenAI } from "../services/openai";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image files are allowed"));
    }
  },
});

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  const { pet_id, from, to } = req.query;

  try {
    let query = `
      SELECT cf.id, cf.pet_id, cf.original_name, cf.mime_type, cf.summary, cf.uploaded_at,
             p.name AS pet_name
      FROM clinical_files cf
      JOIN pets p ON p.id = cf.pet_id
      WHERE cf.user_id = $1
    `;
    const params: (string | number)[] = [req.userId!];
    let paramIndex = 2;

    if (pet_id) {
      query += ` AND cf.pet_id = $${paramIndex++}`;
      params.push(Number(pet_id));
    }
    if (from) {
      query += ` AND cf.uploaded_at >= $${paramIndex++}`;
      params.push(String(from));
    }
    if (to) {
      query += ` AND cf.uploaded_at <= $${paramIndex++}`;
      params.push(String(to));
    }

    query += " ORDER BY cf.uploaded_at DESC";

    const result = await pool.query(query, params);
    res.json({ files: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.post("/", upload.single("file"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const petId = Number(req.body.pet_id);
  if (!petId) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "pet_id is required" });
    return;
  }

  try {
    const petCheck = await pool.query(
      "SELECT id FROM pets WHERE id = $1 AND user_id = $2",
      [petId, req.userId]
    );
    if (petCheck.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    let summary: string | null = null;
    const userResult = await pool.query(
      "SELECT openai_api_key, anthropic_api_key FROM users WHERE id = $1",
      [req.userId]
    );
    const { openai_api_key, anthropic_api_key } = userResult.rows[0] || {};

    if (anthropic_api_key) {
      try {
        summary = await summarizeWithAnthropic(req.file.path, req.file.mimetype, anthropic_api_key);
      } catch (err) {
        console.error("Anthropic summarization failed:", err);
      }
    } else if (openai_api_key) {
      try {
        summary = await summarizeWithOpenAI(req.file.path, req.file.mimetype, openai_api_key);
      } catch (err) {
        console.error("OpenAI summarization failed:", err);
      }
    }

    const result = await pool.query(
      `INSERT INTO clinical_files (pet_id, user_id, filename, original_name, mime_type, file_path, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, pet_id, original_name, mime_type, summary, uploaded_at`,
      [
        petId,
        req.userId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.path,
        summary,
      ]
    );

    res.status(201).json({ file: result.rows[0] });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.get("/:id/download", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT file_path, original_name, mime_type FROM clinical_files WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = result.rows[0];
    res.download(file.file_path, file.original_name, {
      headers: { "Content-Type": file.mime_type },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT file_path FROM clinical_files WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const filePath = result.rows[0].file_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query("DELETE FROM clinical_files WHERE id = $1", [req.params.id]);
    res.json({ message: "File deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
