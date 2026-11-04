import { useState } from "react";
import StripePaymentForm from "./StripePaymentForm";
import styles from "../styles/FOPCard.module.css";

/**
 * FOPCard - Updated to use Stripe
 * Props: selectedPlan ({ id, title, basePrice, billingCycle }), userData.
 * Handles promo application and Stripe payment processing.
 */
export default function FOPCard({ selectedPlan, userData }) {
  const [promoCode, setPromoCode] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState(selectedPlan?.basePrice);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === "CASFIT20") {
      const discount = selectedPlan.basePrice * 0.8;
      setDiscountedPrice(discount);
      setStatusMsg({ type: "success", text: "Promo code applied!" });
    } else {
      setStatusMsg({ type: "error", text: "Invalid promo code" });
    }
  };

  const handlePaymentSuccess = (data) => {
    setStatusMsg({
      type: "success",
      text: userData
        ? "Thank you for your payment! Your plan is now active."
        : "You will receive an email with instructions soon. Thank you for your purchase and welcome to the CAS Gym community.",
    });
  };

  const handlePaymentError = (error) => {
    setStatusMsg({
      type: "error",
      text: error || "Payment failed. Please try again.",
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.brand}>CAS FITNESS</div>
        <span className={styles.secureLabel}>Secure Payment Powered by Stripe</span>
      </div>

      <p className={styles.motivationalQuote}>
        &ldquo;Small daily efforts yield massive long-term results. Let&rsquo;s get those results!&rdquo;
      </p>

      {/* Plan Summary */}
      <div className={styles.planSummary}>
        <div>
          <p className={styles.planTitle}>{selectedPlan?.title || "Gym Membership"}</p>
          <p className={styles.planCycle}>{selectedPlan?.billingCycle || "Monthly"}</p>
        </div>
        <div className={styles.priceColumn}>
          {discountedPrice < selectedPlan?.basePrice && (
            <span className={styles.originalPrice}>${selectedPlan?.basePrice}</span>
          )}
          <span className={styles.finalPrice}>${discountedPrice}</span>
        </div>
      </div>

      {/* Promo Code Input */}
      <div className={styles.promoRow}>
        <input
          type="text"
          placeholder="Promo Code"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          className={styles.promoInput}
        />
        <button type="button" onClick={handleApplyPromo} className={styles.promoButton}>
          Apply
        </button>
      </div>

      {statusMsg && (
        <div className={statusMsg.type === "success" ? styles.statusSuccess : styles.statusError}>
          {statusMsg.text}
        </div>
      )}

      {/* Stripe Payment Form */}
      <StripePaymentForm
        amount={discountedPrice}
        planId={selectedPlan?.id}
        userEmail={userData?.email || "guest@casfitness.com"}
        userName={userData?.name || "Guest"}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        isGuest={!userData}
      />
    </div>
  );
}
