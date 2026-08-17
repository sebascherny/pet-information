import { Router, Response } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, name, species, breed, date_of_birth, sex, notes, created_at FROM pets WHERE user_id = $1 ORDER BY name",
      [req.userId]
    );
    res.json({ pets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pets" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { name, species, breed, date_of_birth, sex, notes } = req.body;

  if (!name) {
    res.status(400).json({ error: "Pet name is required" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO pets (user_id, name, species, breed, date_of_birth, sex, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, species, breed, date_of_birth, sex, notes, created_at`,
      [req.userId, name, species || null, breed || null, date_of_birth || null, sex || null, notes || null]
    );
    res.status(201).json({ pet: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create pet" });
  }
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { name, species, breed, date_of_birth, sex, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE pets SET
        name = COALESCE($1, name),
        species = COALESCE($2, species),
        breed = COALESCE($3, breed),
        date_of_birth = COALESCE($4, date_of_birth),
        sex = COALESCE($5, sex),
        notes = COALESCE($6, notes)
       WHERE id = $7 AND user_id = $8
       RETURNING id, name, species, breed, date_of_birth, sex, notes, created_at`,
      [name, species, breed, date_of_birth, sex, notes, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    res.json({ pet: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update pet" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM pets WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    res.json({ message: "Pet deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete pet" });
  }
});

export default router;
