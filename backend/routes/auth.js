const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const db = require("../db/client");
const { authenticateToken } = require("../middleware/authMiddleware");

// Strict Rate Limiter for Authentication Attempts
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10,
  message: { error: "Too many authentication attempts. Try again later." },
});

// Throttles the unauthenticated OTP / password-reset endpoints, which would
// otherwise allow code brute-forcing and message spam.
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests. Try again later." },
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function isStrongPassword(password) {
  const value = String(password || "");
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[@#%]/.test(value)
  );
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "hidden";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "hidden";
  return `***-***-${digits.slice(-4)}`;
}

function issueJwt(user) {
  return jwt.sign(
    {
      userId: user.id,
      roleId: user.role_id,
      sessionVersion: user.session_version,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
}

// Dev-mode OTP fallback: when running outside production and the actual
// SMS/email provider isn't configured (or the send call fails — e.g. a
// Twilio trial account rejecting free-form message bodies), the raw code is
// surfaced in the API response so the flow can still be tested locally.
// This is never included in production and never included when the
// message was actually delivered successfully.
const isProduction = process.env.NODE_ENV === "production";

async function deliverOtpCode({ user, code, deliveryMethod }) {
  const method = deliveryMethod === "sms" ? "sms" : "email";

  if (method === "sms" && user.phone) {
    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    ) {
      try {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        );
        await client.messages.create({
          to: user.phone,
          from: process.env.TWILIO_PHONE_NUMBER,
          body: `Your CAS Fitness verification code is ${code}. It expires in 5 minutes.`,
        });
        return { method: "sms", destination: maskPhone(user.phone), delivered: true };
      } catch (err) {
        console.error("SMS delivery failed:", err.message);
        return {
          method: "sms",
          destination: maskPhone(user.phone),
          delivered: false,
          ...(!isProduction && {
            devCode: code,
            devNote: `SMS delivery failed (${err.message}). Showing the code for local testing only.`,
          }),
        };
      }
    }
    return {
      method: "sms",
      destination: maskPhone(user.phone),
      delivered: false,
      ...(!isProduction && {
        devCode: code,
        devNote: "Twilio isn't configured. Showing the code for local testing only.",
      }),
    };
  }

  const targetEmail = user.email;
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
        to: targetEmail,
        subject: "CAS Fitness Verification Code",
        text: `Your CAS Fitness verification code is ${code}. It expires in 5 minutes.`,
      });
      return { method: "email", destination: maskEmail(targetEmail), delivered: true };
    } catch (err) {
      console.error("Email delivery failed:", err.message);
      return {
        method: "email",
        destination: maskEmail(targetEmail),
        delivered: false,
        ...(!isProduction && {
          devCode: code,
          devNote: `Email delivery failed (${err.message}). Showing the code for local testing only.`,
        }),
      };
    }
  }

  return {
    method: "email",
    destination: maskEmail(targetEmail),
    delivered: false,
    ...(!isProduction && {
      devCode: code,
      devNote: "SMTP isn't configured. Showing the code for local testing only.",
    }),
  };
}

async function createOtp({ userId, purpose, code }) {
  await db.query(
    `
    INSERT INTO otp_codes (user_id, code, purpose, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
  `,
    [userId, code, purpose],
  );
}

// Verify Pre-authorized Email Step
router.post("/verify-email", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id FROM authorized_emails WHERE email = $1",
      [normalizeEmail(req.body.email)],
    );
    if (result.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Email not authorized, contact administrator" });
    }
    res.json({ authorized: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/check-duplicate", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();

  try {
    const duplicateRes = await db.query(
      `
      SELECT email, phone
      FROM users
      WHERE email = $1 OR phone = $2
      LIMIT 1
    `,
      [email, phone],
    );

    const duplicate = duplicateRes.rows[0];
    res.json({
      emailExists: Boolean(duplicate && duplicate.email === email),
      phoneExists: Boolean(duplicate && duplicate.phone === phone),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  const firstName = String(req.body.firstName || "").trim();
  const lastName = String(req.body.lastName || "").trim();
  const deliveryMethod = req.body.deliveryMethod === "sms" ? "sms" : "email";

  if (!email || !phone || !firstName || !lastName) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Password does not meet minimum strength requirements." });
  }

  try {
    const authorized = await db.query(
      "SELECT id FROM authorized_emails WHERE email = $1",
      [email],
    );
    if (authorized.rows.length === 0) {
      return res.status(403).json({ error: "Email not authorized, contact administrator" });
    }

    const existing = await db.query(
      "SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1",
      [email, phone],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email or phone already exists in the system." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await db.query(
      `
      INSERT INTO users (email, phone, password_hash, first_name, last_name, role_id, status)
      VALUES ($1, $2, $3, $4, $5, 4, 'PENDING_VERIFICATION')
      RETURNING id, email, phone
    `,
      [email, phone, passwordHash, firstName, lastName],
    );

    const user = userRes.rows[0];

    const code = generateOtpCode();
    await createOtp({ userId: user.id, purpose: "2FA", code });
    const deliveryResult = await deliverOtpCode({ user, code, deliveryMethod });

    res.status(201).json({
      success: true,
      message: "Verification code sent.",
      userId: user.id,
      delivery: deliveryResult,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Authenticate Credentials & Trigger 2FA
router.post("/login", loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const deliveryMethod = req.body.deliveryMethod === "sms" ? "sms" : "email";

  try {
    const userRes = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (userRes.rows.length === 0)
      return res
        .status(400)
        .json({ error: "Password or username does not match" });

    const user = userRes.rows[0];

    // Check Lockout
    if (
      user.account_locked_until &&
      new Date(user.account_locked_until) > new Date()
    ) {
      return res
        .status(403)
        .json({ error: "Max attempts reached, account blocked for 24 hours" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Increment Failed Login Counter
      const newAttempts = user.failed_login_attempts + 1;
      let lockSql = "UPDATE users SET failed_login_attempts = $1 WHERE id = $2";
      if (newAttempts >= 3) {
        lockSql =
          "UPDATE users SET failed_login_attempts = $1, account_locked_until = NOW() + INTERVAL '24 hours' WHERE id = $2";
      }
      await db.query(lockSql, [newAttempts, user.id]);
      return res
        .status(400)
        .json({ error: "Password or username does not match" });
    }

    // Reset Lockout Counters on Success
    await db.query(
      "UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1",
      [user.id],
    );

    if (user.temp_password_hash && user.temp_password_expires_at) {
      return res.status(200).json({
        success: true,
        requiresPasswordReset: true,
        userId: user.id,
      });
    }

    const code = generateOtpCode();
    await createOtp({ userId: user.id, purpose: "2FA", code });
    const delivery = await deliverOtpCode({ user, code, deliveryMethod });

    res.status(200).json({
      success: true,
      otpRequired: true,
      userId: user.id,
      delivery,
      requiresPasswordChange:
        user.password_updated_at &&
        new Date(user.password_updated_at) <
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/resend-otp", otpLimiter, async (req, res) => {
  const userId = req.body.userId;
  const deliveryMethod = req.body.deliveryMethod === "sms" ? "sms" : "email";

  try {
    const userRes = await db.query(
      "SELECT id, email, phone FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userRes.rows[0];
    const code = generateOtpCode();
    await createOtp({ userId: user.id, purpose: "2FA", code });
    const delivery = await deliverOtpCode({ user, code, deliveryMethod });

    res.json({ success: true, delivery });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/verify-otp", otpLimiter, async (req, res) => {
  const userId = req.body.userId;
  const code = String(req.body.code || "");
  const purpose = req.body.purpose === "PASSWORD_RESET" ? "PASSWORD_RESET" : "2FA";

  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }
  if (!code || code.trim() === "") {
    return res.status(400).json({ error: "Verification code is required." });
  }

  try {
    const otpRes = await db.query(
      `
      SELECT id, code, expires_at, failed_attempts, is_used
      FROM otp_codes
      WHERE user_id = $1
        AND purpose = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [userId, purpose],
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: "No verification code found." });
    }

    const otp = otpRes.rows[0];
    if (otp.is_used) {
      return res.status(400).json({ error: "Verification code has already been used." });
    }
    if (otp.failed_attempts >= 3) {
      return res.status(403).json({ error: "Max OTP attempts reached. Request a new code." });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: "Verification code expired." });
    }

    if (otp.code !== code) {
      await db.query(
        "UPDATE otp_codes SET failed_attempts = failed_attempts + 1 WHERE id = $1",
        [otp.id],
      );
      return res.status(400).json({ error: "Invalid verification code." });
    }

    await db.query("UPDATE otp_codes SET is_used = TRUE WHERE id = $1", [otp.id]);

    const userRes = await db.query(
      `
      UPDATE users
      SET status = CASE WHEN status IN ('PENDING', 'PENDING_VERIFICATION') THEN 'ACTIVE' ELSE status END
      WHERE id = $1
      RETURNING id, email, first_name, last_name, role_id, session_version
    `,
      [userId],
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userRes.rows[0];

    const token = issueJwt(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId: user.role_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/forgot-password", otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const genericMessage =
    "If the email address is associated with an active account, you will receive password reset instructions. Otherwise, please contact an administrator.";

  try {
    const userRes = await db.query(
      "SELECT id, email, status, account_locked_until FROM users WHERE email = $1 LIMIT 1",
      [email],
    );

    if (userRes.rows.length === 0) {
      return res.json({ message: genericMessage });
    }

    const user = userRes.rows[0];
    if (
      user.status !== "ACTIVE" ||
      (user.account_locked_until &&
        new Date(user.account_locked_until) > new Date())
    ) {
      return res.json({ message: genericMessage });
    }

    const temporaryHash = await bcrypt.hash(generateOtpCode(), 10);

    await db.query(
      `
      UPDATE users
      SET temp_password_hash = $1,
          temp_password_expires_at = NOW() + INTERVAL '15 minutes'
      WHERE id = $2
    `,
      [temporaryHash, user.id],
    );
    const otpCode = generateOtpCode();
    await createOtp({ userId: user.id, purpose: "PASSWORD_RESET", code: otpCode });
    await deliverOtpCode({ user, code: otpCode, deliveryMethod: "email" });

    res.json({ message: genericMessage });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/change-password", otpLimiter, async (req, res) => {
  const userId = req.body.userId;
  const newPassword = String(req.body.newPassword || "");
  const otpCode = String(req.body.otpCode || "");

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: "Password does not meet minimum strength requirements." });
  }

  try {
    const userRes = await db.query(
      "SELECT id, temp_password_hash, temp_password_expires_at FROM users WHERE id = $1",
      [userId],
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userRes.rows[0];
    if (!user.temp_password_hash || !user.temp_password_expires_at) {
      return res.status(400).json({ error: "No temporary password challenge exists." });
    }
    if (new Date(user.temp_password_expires_at) < new Date()) {
      return res.status(400).json({ error: "Temporary password challenge expired." });
    }

    const otpRes = await db.query(
      `
      SELECT id, code, failed_attempts, expires_at, is_used
      FROM otp_codes
      WHERE user_id = $1 AND purpose = 'PASSWORD_RESET'
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [userId],
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: "No password reset verification code found." });
    }

    const otp = otpRes.rows[0];
    if (otp.is_used || otp.failed_attempts >= 3) {
      return res.status(400).json({ error: "Invalid reset verification code." });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: "Reset verification code expired." });
    }
    if (otp.code !== otpCode) {
      await db.query(
        "UPDATE otp_codes SET failed_attempts = failed_attempts + 1 WHERE id = $1",
        [otp.id],
      );
      return res.status(400).json({ error: "Invalid reset verification code." });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      `
      UPDATE users
      SET password_hash = $1,
          temp_password_hash = NULL,
          temp_password_expires_at = NULL,
          password_updated_at = NOW()
      WHERE id = $2
    `,
      [hash, userId],
    );
    await db.query("UPDATE otp_codes SET is_used = TRUE WHERE id = $1", [otp.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/request-password-reset-otp", otpLimiter, async (req, res) => {
  const userId = req.body.userId;
  const deliveryMethod = req.body.deliveryMethod === "sms" ? "sms" : "email";

  try {
    const userRes = await db.query(
      "SELECT id, email, phone FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userRes.rows[0];
    const code = generateOtpCode();
    await createOtp({ userId: user.id, purpose: "PASSWORD_RESET", code });
    const delivery = await deliverOtpCode({ user, code, deliveryMethod });

    res.json({ success: true, delivery });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Logout Invalidation Route
router.post("/logout-all", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    await db.query(
      "UPDATE users SET session_version = session_version + 1 WHERE id = $1",
      [userId],
    );
    res.json({ success: true, message: "Sessions revoked on all devices." });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    await db.query(
      "UPDATE users SET session_version = session_version + 1 WHERE id = $1",
      [req.user.userId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

router.post("/logout-beacon", async (req, res) => {
  const rawToken = String(req.body?.token || "");
  if (!rawToken) return res.status(204).end();

  try {
    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    await db.query(
      "UPDATE users SET session_version = session_version + 1 WHERE id = $1",
      [decoded.userId],
    );
    res.status(204).end();
  } catch (err) {
    res.status(204).end();
  }
});

// Superuser (or any authenticated user) self-service profile update: name,
// last name, email, and phone. Role/status/Member ID stay server-controlled
// and are never editable through this route.
router.patch("/profile", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const firstName = String(req.body.firstName || "").trim();
  const lastName = String(req.body.lastName || "").trim();
  const email = normalizeEmail(req.body.email);
  const phone = String(req.body.phone || "").trim();

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  try {
    const duplicate = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [
      email,
      userId,
    ]);
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: "That email is already in use by another account." });
    }

    const result = await db.query(
      `
      UPDATE users
      SET first_name = $1, last_name = $2, email = $3, phone = $4
      WHERE id = $5
      RETURNING id, email, phone, first_name, last_name, role_id, status
    `,
      [firstName, lastName, email, phone || null, userId],
    );

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId: user.role_id,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile." });
  }
});

module.exports = router;
