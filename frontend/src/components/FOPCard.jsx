import { useState, useEffect } from "react";
import StripePaymentForm from "./StripePaymentForm";
import styles from "../styles/FOPCard.module.css";

/**
 * FOPCard - Updated to use Stripe
 * Props: selectedPlan (can be single plan or object with items array), userData.
 * Handles multiple items and calculates total for payment.
 */
export default function FOPCard({ selectedPlan, userData }) {
  const [promoCode, setPromoCode] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [isMultiItem, setIsMultiItem] = useState(false);

  // Determine if we have multiple items or single plan
  useEffect(() => {
    if (!selectedPlan) {
      console.error('FOPCard: selectedPlan is null or undefined');
      return;
    }
    
    console.error('FOPCard: selectedPlan received:', JSON.stringify(selectedPlan, null, 2));
    
    if (selectedPlan.items && Array.isArray(selectedPlan.items) && selectedPlan.items.length > 0) {
      // Multiple items from cart
      console.error(`FOPCard: Detected ${selectedPlan.items.length} items`);
      console.error('FOPCard items detail:', JSON.stringify(selectedPlan.items, null, 2));
      setCartItems(selectedPlan.items);
      setDiscountedPrice(selectedPlan.totalAmount);
      setIsMultiItem(true);
    } else {
      // Single plan (legacy format)
      console.error('FOPCard: Single plan or no items array detected');
      setCartItems([]);
      setDiscountedPrice(selectedPlan?.basePrice || 0);
      setIsMultiItem(false);
    }
  }, [selectedPlan]);

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    const baseAmount = selectedPlan.items 
      ? selectedPlan.totalAmount 
      : selectedPlan?.basePrice || 0;
    
    if (code === "CASFIT20") {
      const discount = baseAmount * 0.8;
      setDiscountedPrice(discount);
      setStatusMsg({ type: "success", text: "20% promo code applied!" });
    } else if (code === "") {
      setStatusMsg({ type: "error", text: "Please enter a promo code" });
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

      {/* Plan Summary or Cart Items */}
      {isMultiItem && cartItems.length > 0 ? (
        <div className={styles.cartSummary}>
          <h3 className={styles.cartTitle}>Order Summary</h3>
          {cartItems.map((item, idx) => (
            <div key={idx} className={styles.cartItemRow}>
              <span className={styles.itemName}>{item.title}</span>
              <span className={styles.itemPrice}>${Number(item.activePrice || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.cartDivider}></div>
          <div className={styles.cartTotalRow}>
            <span className={styles.totalLabel}>Total:</span>
            <span className={styles.totalPrice}>${discountedPrice.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className={styles.planSummary}>
          <div>
            <p className={styles.planTitle}>{selectedPlan?.title || "Gym Membership"}</p>
            <p className={styles.planCycle}>{selectedPlan?.billingCycle || "Monthly"}</p>
          </div>
          <div className={styles.priceColumn}>
            {discountedPrice < (selectedPlan?.basePrice || 0) && (
              <span className={styles.originalPrice}>${selectedPlan?.basePrice}</span>
            )}
            <span className={styles.finalPrice}>${discountedPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

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
        cartItems={cartItems}
      />
    </div>
  );
}
