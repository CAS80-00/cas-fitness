require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

const app = require("./app");
const db = require("./db/client");

const PORT = process.env.PORT || 5000;

function startMaintenanceJobs() {
  // Auto-mark workout sessions complete if 5+ minutes have passed.
  setInterval(async () => {
    try {
      const result = await db.query(
        `
        UPDATE workout_sessions
        SET status = 'COMPLETED', auto_completed_at = NOW()
        WHERE status = 'SCHEDULED'
          AND end_time <= NOW() - INTERVAL '5 minutes'
          AND auto_completed_at IS NULL
        RETURNING id
      `,
      );
      
      if (result.rows.length > 0) {
        console.log(`Auto-completed ${result.rows.length} workout sessions.`);
      }
    } catch (err) {
      console.error("Workout status maintenance failed:", err.message);
    }
  }, 5 * 60 * 1000);

  // Purge stale consultation appointments and expired slot holds daily.
  setInterval(async () => {
    try {
      await db.query(
        `
        DELETE FROM consultation_appointments
        WHERE created_at < NOW() - INTERVAL '365 days'
      `,
      );
      await db.query(
        `
        UPDATE consultation_appointments
        SET reserved_until = NULL
        WHERE reserved_until IS NOT NULL
          AND reserved_until < NOW()
          AND status = 'PENDING'
      `,
      );
    } catch (err) {
      console.error("Consultation retention maintenance failed:", err.message);
    }
  }, 24 * 60 * 60 * 1000);
}

app.listen(PORT, () => {
  startMaintenanceJobs();
  console.log(`CAS Fitness Backend operational on port ${PORT}`);
});
