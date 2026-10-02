import { useEffect, useState } from "react";
import { useCookieConsent } from "../hooks/useCookieConsent";
import styles from "../styles/CookieConsentBanner.module.css";

export default function CookieConsentBanner() {
  const { consentState, savePreferences } = useCookieConsent();
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState(consentState.analyticsAllowed);
  const [marketing, setMarketing] = useState(consentState.marketingAllowed);

  useEffect(() => {
    setAnalytics(consentState.analyticsAllowed);
    setMarketing(consentState.marketingAllowed);
  }, [consentState.analyticsAllowed, consentState.marketingAllowed]);

  if (consentState.hasConsent && !showModal) {
    return (
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={styles.manageButton}
      >
        Manage Cookie Preferences
      </button>
    );
  }

  return (
    <>
      {/* Banner */}
      {!consentState.hasConsent && (
        <div className={styles.banner}>
          <div className={styles.bannerInner}>
            <div className={styles.bannerCopy}>
              <h3 className={styles.bannerHeadline}>We Respect Your Privacy</h3>
              <p className={styles.bannerBody}>
                We use essential cookies to keep our site secure and functioning
                properly. With your consent, we also use analytical and
                marketing cookies to improve your training experience. Read our
                Privacy Policy for details.
              </p>
            </div>
            <div className={styles.bannerActions}>
              {/* Equal visual weight: Accept All and Reject All share the
                  same classes so neither choice is visually favored. */}
              <button
                type="button"
                onClick={() => savePreferences(true, true)}
                className={styles.acceptButton}
              >
                Accept All
              </button>
              <button
                type="button"
                onClick={() => savePreferences(false, false)}
                className={styles.rejectButton}
              >
                Reject All
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className={styles.customizeLink}
              >
                Customize Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Cookie Preferences</h2>

            <div className={styles.categoryList}>
              <div className={styles.categoryRow}>
                <div>
                  <p className={styles.categoryLabel}>Strictly Necessary</p>
                  <p className={styles.categoryDescription}>
                    Required for authentication, security, and cart session
                    state.
                  </p>
                </div>
                <input type="checkbox" checked disabled className={styles.checkboxLocked} />
              </div>

              <div className={styles.categoryRow}>
                <div>
                  <p className={styles.categoryLabel}>Analytics & Performance</p>
                  <p className={styles.categoryDescription}>
                    Allows us to analyze site performance and usage statistics.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className={styles.checkbox}
                />
              </div>

              <div className={styles.categoryRow}>
                <div>
                  <p className={styles.categoryLabel}>Marketing & Targeting</p>
                  <p className={styles.categoryDescription}>
                    Used to deliver targeted fitness promotions and media
                    tracking.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className={styles.checkbox}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" onClick={() => setShowModal(false)} className={styles.cancelButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  savePreferences(analytics, marketing);
                  setShowModal(false);
                }}
                className={styles.saveButton}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
