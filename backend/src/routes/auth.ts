import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

function getCookieOptions() {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const isLocalDev =
    frontendUrl.includes("localhost") || frontendUrl.includes("127.0.0.1");

  // Same-origin /api proxy (frontend nginx) keeps cookies first-party for Safari.
  return {
    httpOnly: true,
    secure: !isLocalDev,
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

router.post("/register", async (req, res: Response) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, username, email, created_at`,
      [name, username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    res.cookie("token", token, getCookieOptions());
    res.status(201).json({ user });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT id, name, username, email, password_hash, created_at FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    res.cookie("token", token, getCookieOptions());
    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res: Response) => {
  res.clearCookie("token", getCookieOptions());
  res.json({ message: "Logged out" });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, username, email,
         openai_api_key IS NOT NULL AS has_openai_key,
         anthropic_api_key IS NOT NULL AS has_anthropic_key,
         created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
