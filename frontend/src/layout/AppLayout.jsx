import styles from "../styles/AppLayout.module.css";
import CookieConsentBanner from "../components/CookieConsentBanner";

/**
 * AppLayout
 * Root visual wrapper shared by every page in the application. Keeps the
 * dark-canvas design system in one place and hosts chrome that must persist
 * across navigation: the cookie consent banner (GDPR/CCPA compliance) and
 * the 20-minute session inactivity prompt.
 *
 * Props:
 *  - children: the active page/route content
 *  - showInactivityModal: whether to render the "Are you still there?" modal
 *  - graceSeconds: remaining seconds in the 2-minute grace period
 *  - onStaySignedIn: callback for "Stay in session"
 *  - onLogout: callback for "Log me out"
 */
export default function AppLayout({
  children,
  showInactivityModal,
  graceSeconds,
  onStaySignedIn,
  onLogout,
}) {
  return (
    <div className={styles.shell}>
      {children}
      <CookieConsentBanner />

      {showInactivityModal && (
        <div className={styles.inactivityOverlay}>
          <div className={styles.inactivityCard}>
            <h2 className={styles.inactivityTitle}>Are you still there?</h2>
            <p className={styles.inactivityMessage}>
              Your session will end automatically in {graceSeconds}s unless you continue.
            </p>
            <div className={styles.inactivityActions}>
              <button type="button" onClick={onStaySignedIn} className={styles.stayButton}>
                Stay in session
              </button>
              <button type="button" onClick={onLogout} className={styles.logoutButton}>
                Log me out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
