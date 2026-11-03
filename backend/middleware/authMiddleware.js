const jwt = require("jsonwebtoken");
const db = require("../db/client");

// Seeded role ids (see db/seed.js).
const ROLE = { SUPERUSER: 1, TRAINER: 2, STAFF: 3, STUDENT: 4 };

function extractToken(req) {
  const header = req.headers["authorization"];
  return header ? header.split(" ")[1] : null;
}

// Verifies the JWT and checks it against the user's current DB state, so
// logout (session_version bump), suspension and role changes take effect
// immediately instead of when the token expires.
// Resolves to { user } on success or { status, error } on failure.
async function resolveUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { status: 403, error: "Token expired or invalid signature" };
  }

  try {
    const userRes = await db.query(
      "SELECT status, role_id, session_version FROM users WHERE id = $1",
      [decoded.userId],
    );
    if (userRes.rows.length === 0) {
      return { status: 403, error: "Invalid user account" };
    }

    const row = userRes.rows[0];
    if (row.status !== "ACTIVE") {
      return { status: 403, error: "Account suspended or inactive" };
    }
    if (Number(decoded.sessionVersion) !== Number(row.session_version)) {
      return { status: 403, error: "Session expired. Please log in again." };
    }

    return { user: { ...decoded, roleId: row.role_id } };
  } catch (dbErr) {
    console.error("[AUTH] Database error in authenticateToken:", dbErr.message);
    return { status: 500, error: "Authentication service error" };
  }
}

const authenticateToken = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Access token required" });

  const result = await resolveUser(token);
  if (result.error) return res.status(result.status).json({ error: result.error });

  req.user = result.user;
  next();
};

// Like authenticateToken, but anonymous requests are allowed through. A token
// that is present but invalid is still rejected.
const optionalAuthenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  const result = await resolveUser(token);
  if (result.error) return res.status(result.status).json({ error: result.error });

  req.user = result.user;
  next();
};

// Must run after authenticateToken.
const requireSuperuser = (req, res, next) => {
  if (!req.user || req.user.roleId !== ROLE.SUPERUSER) {
    return res.status(403).json({ error: "Superuser privileges required." });
  }
  next();
};

// Must run after authenticateToken. Usage: requireRole(['SUPERUSER', 'STAFF'])
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: "Authentication required." });
    }

    try {
      const roleRes = await db.query(
        "SELECT role_name FROM roles WHERE id = $1",
        [req.user.roleId],
      );

      if (roleRes.rows.length === 0) {
        return res.status(403).json({ error: "User role not found." });
      }

      if (!allowedRoles.includes(roleRes.rows[0].role_name)) {
        return res.status(403).json({
          error: `Requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      next();
    } catch (err) {
      console.error("Error checking user role:", err);
      return res.status(500).json({ error: "Failed to verify user role." });
    }
  };
};

// True when the caller is the given user, or is a Superuser/Staff member.
function canAccessUser(req, targetUserId) {
  if (!req.user) return false;
  if (String(req.user.userId) === String(targetUserId)) return true;
  return [ROLE.SUPERUSER, ROLE.STAFF].includes(req.user.roleId);
}

module.exports = {
  ROLE,
  authenticateToken,
  optionalAuthenticate,
  requireSuperuser,
  requireRole,
  canAccessUser,
};
