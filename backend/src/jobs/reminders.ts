import cron from "node-cron";
import { pool } from "../db";
import { sendAppointmentReminder } from "../services/email";

export function startReminderJob() {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const windowStart = new Date(in24h.getTime() - 15 * 60 * 1000);

      const result = await pool.query(
        `SELECT a.id, a.title, a.appointment_at, a.veterinarian, a.location,
                u.email, u.name AS user_name,
                p.name AS pet_name
         FROM appointments a
         JOIN users u ON u.id = a.user_id
         JOIN pets p ON p.id = a.pet_id
         WHERE a.reminder_sent = FALSE
           AND a.appointment_at >= $1
           AND a.appointment_at <= $2`,
        [windowStart, in24h]
      );

      for (const row of result.rows) {
        const sent = await sendAppointmentReminder(
          row.email,
          row.user_name,
          row.pet_name,
          row.title,
          new Date(row.appointment_at),
          row.veterinarian,
          row.location
        );

        if (sent) {
          await pool.query(
            "UPDATE appointments SET reminder_sent = TRUE WHERE id = $1",
            [row.id]
          );
          console.log(`Reminder sent for appointment ${row.id}`);
        }
      }
    } catch (err) {
      console.error("Reminder job error:", err);
    }
  });

  console.log("Appointment reminder cron job started");
}
