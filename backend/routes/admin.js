const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const multer = require("multer");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");
const { uploadPlanPhoto, deletePlanPhoto } = require("../services/plansStorage");

// Every route below is Superuser-only.
router.use(authenticateToken, requireSuperuser);

// Multer for plan photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const isProduction = process.env.NODE_ENV === "production";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateTemporaryPassword() {
  // 10 chars, alphanumeric + one guaranteed symbol so it satisfies the
  // app's own password-strength rules if the user keeps it as-is.
  return `Cas${crypto.randomBytes(5).toString("hex")}@1`;
}

async function sendActivationEmail({ email, firstName, temporaryPassword }) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Your CAS Fitness account is ready",
        text: `Hi ${firstName},\n\nAn account has been created for you at CAS Fitness.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nLog in and change your password as soon as possible.`,
      });
      return { delivered: true };
    } catch (err) {
      console.error("Activation email failed:", err.message);
      return {
        delivered: false,
        ...(!isProduction && {
          devNote: `Email delivery failed (${err.message}). Showing the temporary password for local testing only.`,
        }),
      };
    }
  }
  return {
    delivered: false,
    ...(!isProduction && {
      devNote: "SMTP isn't configured. Showing the temporary password for local testing only.",
    }),
  };
}

function toUserResponse(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    statusStartsAt: row.status_starts_at,
    statusEndsAt: row.status_ends_at,
    roleId: row.role_id,
    roleName: row.role_name,
    createdAt: row.created_at,
  };
}

const EMPLOYEE_ROLE_IDS = [2, 3];
const MEMBER_ROLE_ID = 4;
const ALLOWED_STATUSES = ["PENDING", "PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "CANCELLED", "INACTIVE"];

/* ============================== ROLES ============================== */

router.get("/roles", async (req, res) => {
  try {
    const result = await db.query("SELECT id, role_name, permissions FROM roles ORDER BY id ASC");
    res.json({ roles: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load roles." });
  }
});

router.post("/roles", async (req, res) => {
  const roleName = String(req.body.roleName || "").trim();
  if (!roleName) {
    return res.status(400).json({ error: "Role name is required." });
  }

  try {
    const result = await db.query(
      "INSERT INTO roles (role_name, permissions) VALUES ($1, $2::jsonb) RETURNING id, role_name, permissions",
      [roleName.toUpperCase(), JSON.stringify(req.body.permissions ?? [])],
    );
    res.status(201).json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A role with that name already exists." });
    }
    res.status(500).json({ error: "Failed to create role." });
  }
});

router.patch("/roles/:id", async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE roles SET permissions = $1::jsonb WHERE id = $2 RETURNING id, role_name, permissions",
      [JSON.stringify(req.body.permissions ?? []), req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Role not found." });
    }
    res.json({ role: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role permissions." });
  }
});

/* ======================= EMPLOYEES & MEMBERS ======================= */
// Both are rows in `users`; "employee" = role_id 2/3, "member" = role_id 4.

router.get("/users", async (req, res) => {
  const type = req.query.type === "member" ? "member" : "employee";
  const search = String(req.query.search || "").trim();
  const roleFilter = type === "member" ? [MEMBER_ROLE_ID] : EMPLOYEE_ROLE_IDS;

  try {
    const params = [roleFilter];
    let whereClause = "u.role_id = ANY($1::int[])";

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        u.id::text ILIKE $${params.length}
        OR u.last_name ILIKE $${params.length}
        OR u.email ILIKE $${params.length}
        OR u.phone ILIKE $${params.length}
      )`;
    }

    const result = await db.query(
      `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status,
             u.status_starts_at, u.status_ends_at, u.role_id, u.created_at,
             r.role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT 200
    `,
      params,
    );

    res.json({ users: result.rows.map(toUserResponse) });
  } catch (err) {
    res.status(500).json({ error: "Failed to search users." });
  }
});

// GET a single user by ID
router.get("/users/:id", async (req, res) => {
  const userId = String(req.params.id).trim();

  try {
    const result = await db.query(
      `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status,
             u.status_starts_at, u.status_ends_at, u.role_id, u.created_at,
             r.role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
    `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user: toUserResponse(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user." });
  }
});

router.post("/users", async (req, res) => {
  const userType = req.body.userType === "member" ? "member" : "employee";
  const firstName = String(req.body.firstName || "").trim();
  const lastName = String(req.body.lastName || "").trim();
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();
  const roleId = userType === "member" ? MEMBER_ROLE_ID : Number(req.body.roleId) || EMPLOYEE_ROLE_IDS[0];

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "A user with that email already exists." });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const insertRes = await db.query(
      `
      INSERT INTO users (email, phone, password_hash, first_name, last_name, role_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING id, first_name, last_name, email, phone, status, status_starts_at, status_ends_at, role_id, created_at
    `,
      [email, phone || null, passwordHash, firstName, lastName, roleId],
    );

    await db.query(
      "INSERT INTO authorized_emails (email, created_by) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
      [email, req.user.userId],
    );

    const delivery = await sendActivationEmail({ email, firstName, temporaryPassword });

    const row = insertRes.rows[0];
    res.status(201).json({
      user: toUserResponse({ ...row, role_name: null }),
      delivery: { ...delivery, ...(delivery.devNote ? { temporaryPassword } : {}) },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user." });
  }
});

router.patch("/users/:id", async (req, res) => {
  const firstName = String(req.body.firstName || "").trim();
  const lastName = String(req.body.lastName || "").trim();
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();
  const roleId = req.body.roleId ? Number(req.body.roleId) : null;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  try {
    const duplicate = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [
      email,
      req.params.id,
    ]);
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: "That email is already in use by another account." });
    }

    let updateQuery = `
      UPDATE users
      SET first_name = $1, last_name = $2, email = $3, phone = $4`;
    const params = [firstName, lastName, email, phone || null];

    if (roleId) {
      params.push(roleId);
      updateQuery += `, role_id = $${params.length}`;
    }

    params.push(req.params.id);
    updateQuery += ` WHERE id = $${params.length}
      RETURNING id, first_name, last_name, email, phone, status, status_starts_at, status_ends_at, role_id, created_at`;

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // Fetch role_name
    const roleResult = await db.query("SELECT role_name FROM roles WHERE id = $1", [
      result.rows[0].role_id,
    ]);
    const roleName = roleResult.rows[0]?.role_name || null;

    res.json({ user: toUserResponse({ ...result.rows[0], role_name: roleName }) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user." });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  const permanent = Boolean(req.body.permanent);
  const startsAt = req.body.startsAt || null;
  const endsAt = permanent ? null : req.body.endsAt || null;

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const result = await db.query(
      `
      UPDATE users
      SET status = $1,
          status_starts_at = $2,
          status_ends_at = $3,
          -- Cancelling revokes all access immediately by invalidating any
          -- active sessions (mirrors the existing logout-all mechanism).
          session_version = CASE WHEN $1::varchar = 'CANCELLED' THEN session_version + 1 ELSE session_version END
      WHERE id = $4
      RETURNING id, first_name, last_name, email, phone, status, status_starts_at, status_ends_at, role_id, created_at
    `,
      [status, startsAt, endsAt, req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: toUserResponse({ ...result.rows[0], role_name: null }) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status." });
  }
});

/* ============================ PROMOTIONS ============================ */

function toPromotionResponse(row) {
  const now = new Date();
  const isCurrentlyLive =
    row.is_active && new Date(row.start_time) <= now && new Date(row.end_time) >= now;
  return {
    id: row.id,
    code: row.code,
    campaignName: row.campaign_name,
    planId: row.plan_id,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    startTime: row.start_time,
    endTime: row.end_time,
    isActive: row.is_active,
    isCurrentlyLive,
  };
}

router.get("/promotions", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM promotions ORDER BY start_time DESC",
    );
    res.json({ promotions: result.rows.map(toPromotionResponse) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load promotions." });
  }
});

router.post("/promotions", async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const campaignName = String(req.body.campaignName || "").trim();
  const discountType = req.body.discountType === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT";
  const discountValue = Number(req.body.discountValue);
  const startTime = req.body.startTime;
  const endTime = req.body.endTime;
  const planId = req.body.planId ? Number(req.body.planId) : null;
  const isActive = Boolean(req.body.isActive);

  if (!code || !campaignName || !startTime || !endTime || Number.isNaN(discountValue)) {
    return res.status(400).json({ error: "Missing required promotion fields." });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO promotions (code, campaign_name, plan_id, discount_type, discount_value, start_time, end_time, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [code, campaignName, planId, discountType, discountValue, startTime, endTime, isActive],
    );
    res.status(201).json({ promotion: toPromotionResponse(result.rows[0]) });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A promotion with that code already exists." });
    }
    res.status(500).json({ error: "Failed to create promotion." });
  }
});

router.patch("/promotions/:id", async (req, res) => {
  const campaignName = String(req.body.campaignName || "").trim();
  const discountType = req.body.discountType === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT";
  const discountValue = Number(req.body.discountValue);
  const startTime = req.body.startTime;
  const endTime = req.body.endTime;
  const planId = req.body.planId ? Number(req.body.planId) : null;
  const isActive = Boolean(req.body.isActive);

  try {
    const result = await db.query(
      `
      UPDATE promotions
      SET campaign_name = $1, plan_id = $2, discount_type = $3, discount_value = $4,
          start_time = $5, end_time = $6, is_active = $7
      WHERE id = $8
      RETURNING *
    `,
      [campaignName, planId, discountType, discountValue, startTime, endTime, isActive, req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Promotion not found." });
    }
    res.json({ promotion: toPromotionResponse(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update promotion." });
  }
});

router.delete("/promotions/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM promotions WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete promotion." });
  }
});

/* ============================== PLANS ============================== */

// Create a new plan with optional photo upload
router.post("/plans", upload.single("photo"), async (req, res) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const price = Number(req.body.price);
  const billingCycle = String(req.body.billing_cycle || "monthly").trim();

  if (!title || !description || Number.isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Title, description, and valid price are required." });
  }

  try {
    let photoUrl = null;
    let photoStorageKey = null;

    if (req.file) {
      try {
        const { storageKey, publicPath } = uploadPlanPhoto(req.file.buffer, req.file.mimetype);
        photoStorageKey = storageKey;
        photoUrl = publicPath;
      } catch (photoErr) {
        return res.status(400).json({ error: "Failed to upload photo: " + photoErr.message });
      }
    }

    const result = await db.query(
      `
      INSERT INTO plans (title, description, price, billing_cycle, photo_url, photo_storage_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, description, price, billing_cycle, photo_url, created_at
    `,
      [title, description, price, billingCycle, photoUrl, photoStorageKey],
    );

    res.status(201).json({ plan: result.rows[0] });
  } catch (err) {
    if (req.file) {
      // Clean up uploaded photo on DB error
      deletePlanPhoto(req.file.filename);
    }
    console.error("Error creating plan:", err.message, err.stack);
    res.status(500).json({ error: "Failed to create plan: " + err.message });
  }
});

// Update an existing plan with optional photo replacement
router.put("/plans/:id", upload.single("photo"), async (req, res) => {
  const planId = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const price = Number(req.body.price);
  const billingCycle = String(req.body.billing_cycle || "monthly").trim();

  if (!title || !description || Number.isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Title, description, and valid price are required." });
  }

  try {
    // Fetch existing plan to get current photo info
    const existing = await db.query("SELECT photo_storage_key FROM plans WHERE id = $1", [planId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found." });
    }

    let photoUrl = existing.rows[0].photo_url;
    let photoStorageKey = existing.rows[0].photo_storage_key;

    // Handle photo update
    if (req.file) {
      try {
        // Delete old photo if it exists
        if (photoStorageKey) {
          deletePlanPhoto(photoStorageKey);
        }
        // Upload new photo
        const { storageKey, publicPath } = uploadPlanPhoto(req.file.buffer, req.file.mimetype);
        photoStorageKey = storageKey;
        photoUrl = publicPath;
      } catch (photoErr) {
        return res.status(400).json({ error: "Failed to upload photo: " + photoErr.message });
      }
    }

    const result = await db.query(
      `
      UPDATE plans
      SET title = $1, description = $2, price = $3, billing_cycle = $4, photo_url = $5, photo_storage_key = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING id, title, description, price, billing_cycle, photo_url, updated_at
    `,
      [title, description, price, billingCycle, photoUrl, photoStorageKey, planId],
    );

    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error("Error updating plan:", err.message, err.stack);
    res.status(500).json({ error: "Failed to update plan: " + err.message });
  }
});

// Delete a plan (with photo cleanup)
router.delete("/plans/:id", async (req, res) => {
  const planId = Number(req.params.id);

  try {
    // Fetch plan to get photo storage key
    const result = await db.query("SELECT photo_storage_key FROM plans WHERE id = $1", [planId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const photoStorageKey = result.rows[0].photo_storage_key;

    // Delete from database
    await db.query("DELETE FROM plans WHERE id = $1", [planId]);

    // Delete photo from storage
    if (photoStorageKey) {
      deletePlanPhoto(photoStorageKey);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting plan:", err.message, err.stack);
    res.status(500).json({ error: "Failed to delete plan: " + err.message });
  }
});

/* ============================ SUBSCRIPTIONS ============================ */

// GET subscriptions for a specific user
router.get("/subscriptions/user/:userId", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT us.id, us.user_id, us.plan_id, us.status, us.start_date, us.end_date, us.auto_renew,
             p.title as plan_title, p.price as plan_price, p.billing_cycle
      FROM user_subscriptions us
      LEFT JOIN plans p ON p.id = us.plan_id
      WHERE us.user_id = $1
      ORDER BY us.start_date DESC
    `,
      [req.params.userId],
    );

    res.json({
      subscriptions: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        planTitle: row.plan_title,
        planPrice: row.plan_price,
        billingCycle: row.billing_cycle,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        autoRenew: row.auto_renew,
      })),
    });
  } catch (err) {
    console.error("Error fetching subscriptions:", err.message);
    res.status(500).json({ error: "Failed to fetch subscriptions." });
  }
});

// POST: Create a new subscription for a user
router.post("/subscriptions", async (req, res) => {
  const userId = String(req.body.userId || "").trim();
  const planId = Number(req.body.planId);
  const status = String(req.body.status || "ACTIVE").toUpperCase();
  const startDate = req.body.startDate || new Date().toISOString();
  const endDate = req.body.endDate || null;
  const autoRenew = Boolean(req.body.autoRenew);

  if (!userId || Number.isNaN(planId)) {
    return res.status(400).json({ error: "User ID and Plan ID are required." });
  }

  if (!["ACTIVE", "INACTIVE", "CANCELLED", "EXPIRED"].includes(status)) {
    return res.status(400).json({ error: "Invalid subscription status." });
  }

  try {
    // Verify user exists
    const userRes = await db.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify plan exists
    const planRes = await db.query("SELECT id FROM plans WHERE id = $1", [planId]);
    if (planRes.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const result = await db.query(
      `
      INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, auto_renew)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, plan_id, status, start_date, end_date, auto_renew
    `,
      [userId, planId, status, startDate, endDate, autoRenew],
    );

    const subscription = result.rows[0];
    res.status(201).json({
      subscription: {
        id: subscription.id,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        autoRenew: subscription.auto_renew,
      },
    });
  } catch (err) {
    console.error("Error creating subscription:", err.message);
    res.status(500).json({ error: "Failed to create subscription." });
  }
});

// PUT: Update a subscription
router.put("/subscriptions/:id", async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const status = req.body.status ? String(req.body.status).toUpperCase() : null;
  const endDate = req.body.endDate || null;
  const autoRenew = req.body.autoRenew !== undefined ? Boolean(req.body.autoRenew) : null;

  if (status && !["ACTIVE", "INACTIVE", "CANCELLED", "EXPIRED"].includes(status)) {
    return res.status(400).json({ error: "Invalid subscription status." });
  }

  try {
    let updateQuery = "UPDATE user_subscriptions SET";
    const params = [];
    const updates = [];

    if (status !== null) {
      updates.push(` status = $${params.length + 1}`);
      params.push(status);
    }
    if (endDate !== null) {
      updates.push(` end_date = $${params.length + 1}`);
      params.push(endDate);
    }
    if (autoRenew !== null) {
      updates.push(` auto_renew = $${params.length + 1}`);
      params.push(autoRenew);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    updateQuery += updates.join(",");
    params.push(subscriptionId);
    updateQuery += ` WHERE id = $${params.length} RETURNING id, user_id, plan_id, status, start_date, end_date, auto_renew`;

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found." });
    }

    const subscription = result.rows[0];
    res.json({
      subscription: {
        id: subscription.id,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        autoRenew: subscription.auto_renew,
      },
    });
  } catch (err) {
    console.error("Error updating subscription:", err.message);
    res.status(500).json({ error: "Failed to update subscription." });
  }
});

// DELETE: Remove a subscription
router.delete("/subscriptions/:id", async (req, res) => {
  try {
    const result = await db.query("DELETE FROM user_subscriptions WHERE id = $1 RETURNING id", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subscription not found." });
    }

    res.json({ success: true, message: "Subscription deleted." });
  } catch (err) {
    console.error("Error deleting subscription:", err.message);
    res.status(500).json({ error: "Failed to delete subscription." });
  }
});

// ============================================================================
// CALENDAR SLOT MANAGEMENT
// ============================================================================

// POST: Create trainer availability slots (Workout Calendar)
router.post("/trainer-slots", async (req, res) => {
  try {
    const { trainerId, dayOfWeek, startTime, endTime, locationFormat } = req.body;

    if (!trainerId || dayOfWeek === undefined || !startTime || !endTime || !locationFormat) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: "Day of week must be 0-6." });
    }

    if (!["IN_PERSON", "VIDEO", "STUDENT_CHOICE"].includes(locationFormat)) {
      return res.status(400).json({ error: "Invalid location format." });
    }

    const result = await db.query(
      `
      INSERT INTO trainer_availability (trainer_id, day_of_week, start_time, end_time, location_format)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, trainer_id, day_of_week, start_time, end_time, location_format
      `,
      [trainerId, dayOfWeek, startTime, endTime, locationFormat],
    );

    const slot = result.rows[0];
    res.status(201).json({
      slot: {
        id: slot.id,
        trainerId: slot.trainer_id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        locationFormat: slot.location_format,
      },
    });
  } catch (err) {
    console.error("Error creating trainer slot:", err.message);
    res.status(500).json({ error: "Failed to create trainer slot." });
  }
});

// GET: Get trainer availability slots
router.get("/trainer-slots/:trainerId", async (req, res) => {
  try {
    const { trainerId } = req.params;

    const result = await db.query(
      `
      SELECT id, trainer_id, day_of_week, start_time, end_time, location_format
      FROM trainer_availability
      WHERE trainer_id = $1
      ORDER BY day_of_week, start_time
      `,
      [trainerId],
    );

    res.json({
      slots: result.rows.map((slot) => ({
        id: slot.id,
        trainerId: slot.trainer_id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        locationFormat: slot.location_format,
      })),
    });
  } catch (err) {
    console.error("Error fetching trainer slots:", err.message);
    res.status(500).json({ error: "Failed to fetch trainer slots." });
  }
});

// PUT: Update trainer availability slot
router.put("/trainer-slots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, locationFormat } = req.body;

    const updates = [];
    const params = [];

    if (dayOfWeek !== undefined) {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ error: "Day of week must be 0-6." });
      }
      updates.push(`day_of_week = $${params.length + 1}`);
      params.push(dayOfWeek);
    }
    if (startTime) {
      updates.push(`start_time = $${params.length + 1}`);
      params.push(startTime);
    }
    if (endTime) {
      updates.push(`end_time = $${params.length + 1}`);
      params.push(endTime);
    }
    if (locationFormat) {
      if (!["IN_PERSON", "VIDEO", "STUDENT_CHOICE"].includes(locationFormat)) {
        return res.status(400).json({ error: "Invalid location format." });
      }
      updates.push(`location_format = $${params.length + 1}`);
      params.push(locationFormat);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    params.push(id);
    const result = await db.query(
      `
      UPDATE trainer_availability
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, trainer_id, day_of_week, start_time, end_time, location_format
      `,
      params,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Slot not found." });
    }

    const slot = result.rows[0];
    res.json({
      slot: {
        id: slot.id,
        trainerId: slot.trainer_id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        locationFormat: slot.location_format,
      },
    });
  } catch (err) {
    console.error("Error updating trainer slot:", err.message);
    res.status(500).json({ error: "Failed to update trainer slot." });
  }
});

// DELETE: Delete trainer availability slot
router.delete("/trainer-slots/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM trainer_availability WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Slot not found." });
    }

    res.json({ success: true, message: "Trainer slot deleted." });
  } catch (err) {
    console.error("Error deleting trainer slot:", err.message);
    res.status(500).json({ error: "Failed to delete trainer slot." });
  }
});

// POST: Create consultation appointment slots
router.post("/consultation-slots", async (req, res) => {
  try {
    const { employeeId, startTime, endTime, format } = req.body;

    if (!employeeId || !startTime || !endTime || !format) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!["IN_PERSON", "VIDEO"].includes(format)) {
      return res.status(400).json({ error: "Invalid format." });
    }

    const result = await db.query(
      `
      INSERT INTO consultation_appointments (client_name, client_email, employee_id, format, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, employee_id, format, start_time, end_time, status
      `,
      ["Available", "booking@casfitness.com", employeeId, format, startTime, endTime, "PENDING"],
    );

    const slot = result.rows[0];
    res.status(201).json({
      slot: {
        id: slot.id,
        employeeId: slot.employee_id,
        format: slot.format,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: slot.status,
      },
    });
  } catch (err) {
    console.error("Error creating consultation slot:", err.message);
    res.status(500).json({ error: "Failed to create consultation slot." });
  }
});

// GET: Get available consultation slots
router.get("/consultation-slots", async (req, res) => {
  try {
    const { employeeId } = req.query;

    let query = `
      SELECT id, employee_id, format, start_time, end_time, status
      FROM consultation_appointments
      WHERE status = 'PENDING'
    `;
    const params = [];

    if (employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(employeeId);
    }

    query += ` ORDER BY start_time`;

    const result = await db.query(query, params);

    res.json({
      slots: result.rows.map((slot) => ({
        id: slot.id,
        employeeId: slot.employee_id,
        format: slot.format,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: slot.status,
      })),
    });
  } catch (err) {
    console.error("Error fetching consultation slots:", err.message);
    res.status(500).json({ error: "Failed to fetch consultation slots." });
  }
});

// DELETE: Delete consultation slot
router.delete("/consultation-slots/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM consultation_appointments WHERE id = $1 AND status = 'PENDING' RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Slot not found or already booked." });
    }

    res.json({ success: true, message: "Consultation slot deleted." });
  } catch (err) {
    console.error("Error deleting consultation slot:", err.message);
    res.status(500).json({ error: "Failed to delete consultation slot." });
  }
});

/* ============== NEW: COMPREHENSIVE SLOT MANAGEMENT ============== */

// POST: Create a scheduled slot template (superuser creates recurring slots)
router.post("/slot-templates", async (req, res) => {
  try {
    const {
      userId,
      calendarType,
      startDate,
      endDate,
      startTime,
      durationMinutes,
      locationFormat,
      daysOfWeek,
    } = req.body;

    if (!userId || !calendarType || !startDate || !endDate || !startTime || !durationMinutes || !daysOfWeek) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!["WORKOUT", "CONSULTATION"].includes(calendarType)) {
      return res.status(400).json({ error: "Invalid calendar type." });
    }

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ error: "Days of week must be a non-empty array." });
    }

    const result = await db.query(
      `
      INSERT INTO scheduled_slot_templates 
      (user_id, created_by, calendar_type, start_date, end_date, start_time, duration_minutes, location_format, days_of_week)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [userId, req.user.userId, calendarType, startDate, endDate, startTime, durationMinutes, locationFormat || null, daysOfWeek],
    );

    // Generate slot instances for all matching dates in the range
    // Create continuous slots from startTime until endTime (if provided)
    const template = result.rows[0];
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const instancesInserted = [];

    // Parse start time
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    
    // Parse end time of day (from request body, defaults to 24:00 if not provided)
    let endTimeOfDay = req.body.endTimeOfDay || "23:59";
    const [endHours, endMinutes] = endTimeOfDay.split(":").map(Number);

    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (daysOfWeek.includes(dayOfWeek)) {
        const dateStr = d.toISOString().split("T")[0];

        // Generate slots continuously all day from start time until end time
        let currentHour = startHours;
        let currentMinute = startMinutes;

        while (currentHour < endHours || (currentHour === endHours && currentMinute < endMinutes)) {
          const slotStartStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
          
          // Calculate slot end time
          let slotEndHour = currentHour + Math.floor((currentMinute + durationMinutes) / 60);
          let slotEndMinute = (currentMinute + durationMinutes) % 60;
          
          // Don't create slot if it goes beyond end time of day
          if (slotEndHour > endHours || (slotEndHour === endHours && slotEndMinute > endMinutes)) {
            break;
          }

          const slotEndStr = `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMinute).padStart(2, "0")}`;

          const instanceRes = await db.query(
            `
            INSERT INTO slot_instances (user_id, template_id, calendar_type, slot_date, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [userId, template.id, calendarType, dateStr, slotStartStr, slotEndStr],
          );
          instancesInserted.push(instanceRes.rows[0]);

          // Move to next slot
          currentHour = slotEndHour;
          currentMinute = slotEndMinute;
        }
      }
    }

    res.status(201).json({
      template,
      instancesCount: instancesInserted.length,
      message: `Template created with ${instancesInserted.length} slot instances.`,
    });
  } catch (err) {
    console.error("Error creating slot template:", err.message);
    res.status(500).json({ error: "Failed to create slot template." });
  }
});

// GET: Get all slot templates for a user (with optional status filter)
router.get("/slot-templates/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT st.*, u.first_name, u.last_name, u.email
      FROM scheduled_slot_templates st
      JOIN users u ON st.user_id = u.id
      WHERE st.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND st.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY st.start_date ASC`;

    const result = await db.query(query, params);
    res.json({ templates: result.rows });
  } catch (err) {
    console.error("Error fetching slot templates:", err.message);
    res.status(500).json({ error: "Failed to fetch slot templates." });
  }
});

// GET: Get all slot instances for a user (with optional date range and status filter)
router.get("/slot-instances/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, status } = req.query;

    let query = `
      SELECT si.*, u.first_name, u.last_name, u.email, 
             modified_user.first_name as modified_by_first_name, modified_user.last_name as modified_by_last_name
      FROM slot_instances si
      JOIN users u ON si.user_id = u.id
      LEFT JOIN users modified_user ON si.modified_by = modified_user.id
      WHERE si.user_id = $1
    `;
    const params = [userId];

    if (startDate) {
      query += ` AND si.slot_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND si.slot_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (status) {
      query += ` AND si.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY si.slot_date ASC, si.start_time ASC`;

    const result = await db.query(query, params);
    res.json({ instances: result.rows });
  } catch (err) {
    console.error("Error fetching slot instances:", err.message);
    res.status(500).json({ error: "Failed to fetch slot instances." });
  }
});

// PUT: Update a slot instance (member or superuser)
// Members can set: CONSULTATION, TRAINING, BREAK
// Superusers can set: SICK, NO_SHOW, VACATION, or approve PENDING slots
router.put("/slot-instances/:slotId", async (req, res) => {
  try {
    const { slotId } = req.params;
    const { status } = req.body;
    const isUserSuperuser = req.user.roleId === 1;

    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }

    // Member can only set: CONSULTATION, TRAINING, BREAK
    const memberStatuses = ["CONSULTATION", "TRAINING", "BREAK"];
    // Superuser can set: SICK, NO_SHOW, VACATION, APPROVED
    const superuserStatuses = ["SICK", "NO_SHOW", "VACATION", "APPROVED"];

    if (!isUserSuperuser && !memberStatuses.includes(status)) {
      return res.status(403).json({ error: "You can only set CONSULTATION, TRAINING, or BREAK status." });
    }

    if (isUserSuperuser && !superuserStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid superuser status." });
    }

    const result = await db.query(
      `
      UPDATE slot_instances
      SET status = $1, modified_by = $2, modified_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, req.user.userId, slotId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Slot instance not found." });
    }

    res.json({ instance: result.rows[0], message: `Slot status updated to ${status}.` });
  } catch (err) {
    console.error("Error updating slot instance:", err.message);
    res.status(500).json({ error: "Failed to update slot instance." });
  }
});

// DELETE: Delete a slot instance
router.delete("/slot-instances/:slotId", async (req, res) => {
  try {
    const { slotId } = req.params;

    const result = await db.query("DELETE FROM slot_instances WHERE id = $1 RETURNING id", [slotId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Slot instance not found." });
    }

    res.json({ success: true, message: "Slot instance deleted." });
  } catch (err) {
    console.error("Error deleting slot instance:", err.message);
    res.status(500).json({ error: "Failed to delete slot instance." });
  }
});

// DELETE: Delete a slot template (and all associated instances)
router.delete("/slot-templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;

    // Delete all instances first
    await db.query("DELETE FROM slot_instances WHERE template_id = $1", [templateId]);

    // Delete the template
    const result = await db.query("DELETE FROM scheduled_slot_templates WHERE id = $1 RETURNING id", [templateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template not found." });
    }

    res.json({ success: true, message: "Template and all associated instances deleted." });
  } catch (err) {
    console.error("Error deleting slot template:", err.message);
    res.status(500).json({ error: "Failed to delete slot template." });
  }
});

module.exports = router;
