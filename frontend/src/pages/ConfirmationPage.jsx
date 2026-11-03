import { useCallback } from 'react';
import { CheckCircle, Home } from 'lucide-react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import styles from '../styles/ConfirmationPage.module.css';

export default function ConfirmationPage({ onNavigate, currentUser, onLogout, onAuthenticated, cartItems = [] }) {
  const handleReturnHome = useCallback(() => {
    onNavigate('landing');
  }, [onNavigate]);

  return (
    <div className={styles.page}>
      <SiteHeader 
        currentUser={currentUser} 
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
        cartItemCount={cartItems.length}
      />

      <main className={styles.main}>
        <div className={styles.contentWrap}>
          <div className={styles.successCard}>
            <div className={styles.iconContainer}>
              <CheckCircle size={120} className={styles.successIcon} />
            </div>

            <h1 className={styles.title}>Purchase Successful!</h1>
            <p className={styles.subtitle}>Thank you for your purchase</p>

            <div className={styles.messageSection}>
              <p className={styles.mainText}>
                Your order has been received and is being processed.
              </p>

              <div className={styles.infoBox}>
                <div className={styles.infoHeader}>
                  <span className={styles.infoIcon}>📌</span>
                  <h3>What Happens Next?</h3>
                </div>
                <p>
                  A member of our team will contact you <strong>within 24 hours</strong> with instructions to activate your account. 
                  Please keep an eye on your email and phone for our contact.
                </p>
              </div>

              <div className={styles.infoBox}>
                <div className={styles.infoHeader}>
                  <span className={styles.infoIcon}>✉️</span>
                  <h3>Confirmation Email Sent</h3>
                </div>
                <p>
                  A detailed confirmation email has been sent to your email address with all purchase information and account activation instructions.
                </p>
              </div>

              <div className={styles.infoBox}>
                <div className={styles.infoHeader}>
                  <span className={styles.infoIcon}>💬</span>
                  <h3>Need Help?</h3>
                </div>
                <p>
                  If you have any questions or concerns, please don't hesitate to reach out to our support team.
                </p>
              </div>
            </div>

            <button className={styles.ctaButton} onClick={handleReturnHome}>
              <Home size={18} />
              Return to Home
            </button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
