const db = require("./client");
const bcrypt = require("bcryptjs");

async function seed() {
  try {
    console.log("Seeding CAS Fitness Database...");

    // 1. Roles
    await db.query(`
      INSERT INTO roles (id, role_name) VALUES
      (1, 'SUPERUSER'), (2, 'TRAINER'), (3, 'STAFF'), (4, 'STUDENT')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Default Pre-Authorized Email
    const email = "castech7777@gmail.com";
    await db.query(
      `
      INSERT INTO authorized_emails (email)
      VALUES ($1) ON CONFLICT (email) DO NOTHING;
    `,
      [email],
    );

    // 3. Superuser Creation
    const hashedPassword = await bcrypt.hash("User@123", 10);
    await db.query(
      `
      INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
      VALUES ($1, $2, 'CAS', 'Superuser', 1, 'ACTIVE')
      ON CONFLICT (email) DO NOTHING;
    `,
      [email, hashedPassword],
    );

    // 4. Membership Plans (ids/titles/prices mirror the hardcoded cards on
    // the public Plans page so promotions can target a specific plan_id).
    await db.query(`
      INSERT INTO plans (id, title, description, price, billing_cycle) VALUES
      (1, 'Basic Student', 'Access to main gym floor and locker rooms.', 49.99, 'Monthly'),
      (2, 'Pro Performance', 'Includes 2 personal trainer sessions per month.', 89.99, 'Monthly'),
      (3, 'Elite Athlete', 'Unlimited access + custom nutrition plans.', 139.99, 'Monthly'),
      (4, 'VIP Access', '24/7 Priority door access + spa & sauna.', 199.99, 'Monthly')
      ON CONFLICT (id) DO NOTHING;
    `);
    await db.query(`SELECT setval('plans_id_seq', (SELECT MAX(id) FROM plans));`);

    console.log("Database Seeding Complete.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding Error:", err);
    process.exit(1);
  }
}

seed();
