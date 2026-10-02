const jwt = require("jsonwebtoken");
const db = require("../db/client");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify session_version against DB to enforce invalidation
    const userRes = await db.query(
      "SELECT session_version, status FROM users WHERE id = $1",
      [decoded.userId],
    );
    if (userRes.rows.length === 0)
      return res.status(403).json({ error: "Invalid user account" });

    const user = userRes.rows[0];
    if (user.status !== "ACTIVE")
      return res.status(403).json({ error: "Account suspended or inactive" });
    if (user.session_version !== decoded.sessionVersion) {
      return res
        .status(401)
        .json({ error: "Session invalidated across devices" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ error: "Token expired or invalid signature" });
  }
};

// Must run after authenticateToken (relies on req.user.roleId from the JWT).
// SUPERUSER is seeded as roles.id = 1 (see db/seed.js).
const requireSuperuser = (req, res, next) => {
  if (!req.user || req.user.roleId !== 1) {
    return res.status(403).json({ error: "Superuser privileges required." });
  }
  next();
};

module.exports = { authenticateToken, requireSuperuser };
