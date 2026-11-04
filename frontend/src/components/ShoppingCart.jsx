import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import styles from "../styles/ShoppingCart.module.css";

const HOLD_SECONDS = 10 * 60;

/**
 * ShoppingCart
 * Slide-out drawer modal. Empty state prompts the user back to Plans;
 * the active-reservation state shows a 10-minute MM:SS countdown and
 * purges the cart automatically on expiry.
 */
export default function ShoppingCart({ cartItems = [], onClose, onClear, onRemoveItem, onContinue, onKeepPurchasing }) {
  const [remainingSeconds, setRemainingSeconds] = useState(HOLD_SECONDS);
  const firstItem = cartItems?.[0];

  // Calculate total price of all items
  const totalPrice = cartItems.reduce((sum, item) => sum + (Number(item.activePrice) || 0), 0);

  useEffect(() => {
    if (!firstItem?.addedAt) return undefined;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - firstItem.addedAt) / 1000);
      const remaining = HOLD_SECONDS - elapsed;
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClear();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [firstItem, onClear]);

  const mm = String(Math.max(Math.floor(remainingSeconds / 60), 0)).padStart(2, "0");
  const ss = String(Math.max(remainingSeconds % 60, 0)).padStart(2, "0");

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <span className={styles.logo}>CAS</span>
        </div>

        {!cartItems || cartItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Your cart is empty</p>
            <button type="button" onClick={onKeepPurchasing} className={styles.viewPlansButton}>
              View Plans
            </button>
          </div>
        ) : (
          <div className={styles.activeState}>
            <div className={styles.itemsList}>
              {cartItems.map((item) => (
                <div key={item.cartId} className={styles.itemCard}>
                  <div className={styles.itemContent}>
                    <h4 className={styles.itemTitle}>{item.title}</h4>
                    <p className={styles.itemDescription}>{item.description}</p>
                    <p className={styles.itemPrice}>${item.activePrice?.toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.cartId)}
                    className={styles.removeButton}
                    aria-label="Remove item"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.timerBox}>
              <p className={styles.timerLabel}>Remaining time to complete purchase</p>
              <p className={styles.timerValue}>
                {mm}:{ss}
              </p>
            </div>
            <div className={styles.totalBox}>
              <p className={styles.totalLabel}>Total to Charge:</p>
              <p className={styles.totalPrice}>${totalPrice.toFixed(2)}</p>
            </div>
            <div className={styles.actionsContainer}>
              <button type="button" onClick={onKeepPurchasing} className={styles.keepPurchasingButton}>
                Keep Purchasing
              </button>
              <button type="button" onClick={onContinue} className={styles.continueButton}>
                Continue to payment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
