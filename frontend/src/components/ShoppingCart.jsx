import { useEffect, useState } from "react";
import styles from "../styles/ShoppingCart.module.css";

const HOLD_SECONDS = 10 * 60;

/**
 * ShoppingCart
 * Slide-out drawer modal. Empty state prompts the user back to Plans;
 * the active-reservation state shows a 10-minute MM:SS countdown and
 * purges the cart automatically on expiry.
 */
export default function ShoppingCart({ cartItem, onClose, onClear, onContinue }) {
  const [remainingSeconds, setRemainingSeconds] = useState(HOLD_SECONDS);

  useEffect(() => {
    if (!cartItem?.addedAt) return undefined;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - cartItem.addedAt) / 1000);
      const remaining = HOLD_SECONDS - elapsed;
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClear();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cartItem, onClear]);

  const mm = String(Math.max(Math.floor(remainingSeconds / 60), 0)).padStart(2, "0");
  const ss = String(Math.max(remainingSeconds % 60, 0)).padStart(2, "0");

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <span className={styles.logo}>CAS</span>
          <button type="button" onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        {!cartItem ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Your cart is empty</p>
            <button type="button" onClick={onClose} className={styles.viewPlansButton}>
              View Plans
            </button>
          </div>
        ) : (
          <div className={styles.activeState}>
            <div className={styles.itemCard}>
              <h4 className={styles.itemTitle}>{cartItem.title}</h4>
              <p className={styles.itemDescription}>{cartItem.description}</p>
              <p className={styles.itemPrice}>${cartItem.activePrice?.toFixed(2)}</p>
            </div>
            <div className={styles.timerBox}>
              <p className={styles.timerLabel}>Remaining time to complete purchase</p>
              <p className={styles.timerValue}>
                {mm}:{ss}
              </p>
            </div>
            <button type="button" onClick={onContinue} className={styles.continueButton}>
              Continue to payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
