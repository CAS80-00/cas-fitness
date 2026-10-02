const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const cmsRoutes = require("./routes/cms");
const calendarsRoutes = require("./routes/calendars");
const paymentsRoutes = require("./routes/payments");
const membersRoutes = require("./routes/members");
const legalRoutes = require("./routes/legal");
const smsRoutes = require("./routes/sms");
const carouselRoutes = require("./routes/carousel");
const landingContentRoutes = require("./routes/landingContent");
const aboutusRoutes = require("./routes/aboutus");
const adminRoutes = require("./routes/admin");
const promotionsRoutes = require("./routes/promotions");
const plansRoutes = require("./routes/plans");

const app = express();

// Security Hardening & Headers Configuration. Cross-Origin-Resource-Policy is
// relaxed so uploaded carousel images (served below) can be embedded by the
// frontend's dev origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serves locally stored Object Storage uploads (see services/objectStorage.js).
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Register API Routes
app.use("/api/auth", authRoutes);
app.use("/api/cms", cmsRoutes);
app.use("/api/calendars", calendarsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/legal", legalRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/carousel", carouselRoutes);
app.use("/api/landing-content", landingContentRoutes);
app.use("/api/aboutus", aboutusRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/plans", plansRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Exception:", err.stack);
  res.status(500).json({ error: "Internal application error detected." });
});

module.exports = app;
