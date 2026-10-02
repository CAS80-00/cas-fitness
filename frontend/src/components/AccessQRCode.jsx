import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import styles from "../styles/AccessQRCode.module.css";

/**
 * AccessQRCode
 * Renders the member's gym-entry QR pass. Requires an ACTIVE subscription;
 * otherwise shows a locked/denied state. The pass token auto-refreshes
 * every 30 seconds with a visible countdown ring.
 *
 * Props: userId, activeSubscription ({ status })
 */
export default function AccessQRCode({ userId, activeSubscription }) {
  const [qrToken, setQrToken] = useState("");
  const [countdown, setCountdown] = useState(30);

  const isAccessAllowed =
    activeSubscription && activeSubscription.status === "ACTIVE";

  const fetchPassToken = useCallback(async () => {
    if (!isAccessAllowed) return;
    try {
      const token = localStorage.getItem("cas_jwt");
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "/api"}/members/generate-pass`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        },
      );
      const data = await res.json();
      if (data.token) {
        setQrToken(data.token);
        setCountdown(30);
      }
    } catch (error) {
      console.error("Error fetching member pass:", error);
    }
  }, [isAccessAllowed, userId]);

  useEffect(() => {
    if (!isAccessAllowed) return undefined;
    fetchPassToken();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchPassToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userId, isAccessAllowed, fetchPassToken]);

  if (!isAccessAllowed) {
    return (
      <div className={styles.deniedCard}>
        <div className={styles.deniedIcon}>🔒</div>
        <div className={styles.deniedMessage}>
          Access Denied: No active membership found. Please renew your plan.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Gym Entry Pass</h3>
      <div className={styles.qrFrame}>
        {qrToken ? (
          <QRCodeSVG value={qrToken} size={220} level="H" includeMargin />
        ) : (
          <div className={styles.qrPlaceholder} />
        )}
      </div>

      <div className={styles.countdownRow}>
        <div className={styles.countdownRing}>
          <svg className={styles.countdownSvg}>
            <circle
              cx="16"
              cy="16"
              r="14"
              strokeWidth="3"
              fill="transparent"
              className={styles.countdownTrack}
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              strokeWidth="3"
              fill="transparent"
              strokeDasharray={88}
              strokeDashoffset={88 - (88 * countdown) / 30}
              className={styles.countdownProgress}
            />
          </svg>
          <span className={styles.countdownLabel}>{countdown}</span>
        </div>
        <span className={styles.refreshHint}>Pass auto-refreshes every 30s</span>
      </div>
    </div>
  );
}
