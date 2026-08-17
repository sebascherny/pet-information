import { Router, Response } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.pet_id, a.title, a.appointment_at, a.veterinarian, a.location, a.notes, a.reminder_sent, a.created_at,
              p.name AS pet_name
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       WHERE a.user_id = $1
       ORDER BY a.appointment_at ASC`,
      [req.userId]
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { pet_id, title, appointment_at, veterinarian, location, notes } = req.body;

  if (!pet_id || !title || !appointment_at) {
    res.status(400).json({ error: "pet_id, title, and appointment_at are required" });
    return;
  }

  try {
    const petCheck = await pool.query(
      "SELECT id FROM pets WHERE id = $1 AND user_id = $2",
      [pet_id, req.userId]
    );
    if (petCheck.rows.length === 0) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO appointments (user_id, pet_id, title, appointment_at, veterinarian, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, pet_id, title, appointment_at, veterinarian, location, notes, reminder_sent, created_at`,
      [req.userId, pet_id, title, appointment_at, veterinarian || null, location || null, notes || null]
    );

    res.status(201).json({ appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { pet_id, title, appointment_at, veterinarian, location, notes } = req.body;

  try {
    if (pet_id) {
      const petCheck = await pool.query(
        "SELECT id FROM pets WHERE id = $1 AND user_id = $2",
        [pet_id, req.userId]
      );
      if (petCheck.rows.length === 0) {
        res.status(404).json({ error: "Pet not found" });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE appointments SET
        pet_id = COALESCE($1, pet_id),
        title = COALESCE($2, title),
        appointment_at = COALESCE($3, appointment_at),
        veterinarian = COALESCE($4, veterinarian),
        location = COALESCE($5, location),
        notes = COALESCE($6, notes),
        reminder_sent = CASE WHEN $3 IS NOT NULL AND $3 != appointment_at THEN FALSE ELSE reminder_sent END
       WHERE id = $7 AND user_id = $8
       RETURNING id, pet_id, title, appointment_at, veterinarian, location, notes, reminder_sent, created_at`,
      [pet_id, title, appointment_at, veterinarian, location, notes, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM appointments WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json({ message: "Appointment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

export default router;
