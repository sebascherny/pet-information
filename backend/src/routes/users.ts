import { Router, Response } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.put("/settings", async (req: AuthRequest, res: Response) => {
  const { name, email, openai_api_key, anthropic_api_key } = req.body;

  try {
    const hasOpenAiKey = Object.prototype.hasOwnProperty.call(req.body, "openai_api_key");
    const hasAnthropicKey = Object.prototype.hasOwnProperty.call(req.body, "anthropic_api_key");

    const setClauses = [
      "name = COALESCE($1, name)",
      "email = COALESCE($2, email)",
    ];
    const params: (string | null | number)[] = [name || null, email || null];
    let paramIndex = 3;

    if (hasOpenAiKey) {
      setClauses.push(`openai_api_key = $${paramIndex++}`);
      params.push(openai_api_key || null);
    }
    if (hasAnthropicKey) {
      setClauses.push(`anthropic_api_key = $${paramIndex++}`);
      params.push(anthropic_api_key || null);
    }

    params.push(req.userId!);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, name, username, email,
         openai_api_key IS NOT NULL AS has_openai_key,
         anthropic_api_key IS NOT NULL AS has_anthropic_key,
         created_at`,
      params
    );

    res.json({ user: result.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
