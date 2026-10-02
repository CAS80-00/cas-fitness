import { useState } from "react";
import styles from "../styles/SiteFooter.module.css";
import LegalContentModal from "./LegalContentModal";

/**
 * SiteFooter
 * Shared footer with copyright and legal modal triggers, reused on
 * Landing, Plans, and About Us pages for a consistent system layout.
 */
export default function SiteFooter({ isSuperuser = false }) {
  const [legalModal, setLegalModal] = useState(null);

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.copyright}>© CAS Fitness 2026. All rights Reserved.</div>
        <div className={styles.legalLinks}>
          <button type="button" onClick={() => setLegalModal("terms")} className={styles.legalLink}>
            Terms and Conditions
          </button>
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className={styles.legalLink}
          >
            Privacy Policy
          </button>
        </div>
        <div className={styles.cookieSpacer} aria-hidden="true" />
      </footer>

      <LegalContentModal
        title="Terms and Conditions"
        pageKey="terms-and-conditions"
        open={legalModal === "terms"}
        onClose={() => setLegalModal(null)}
        isSuperuser={isSuperuser}
      />
      <LegalContentModal
        title="Privacy Policy"
        pageKey="privacy-policy"
        open={legalModal === "privacy"}
        onClose={() => setLegalModal(null)}
        isSuperuser={isSuperuser}
      />
    </>
  );
}
