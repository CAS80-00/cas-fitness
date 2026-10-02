import { useState } from "react";
import styles from "../styles/FOPCard.module.css";

const COUNTRIES = ["United States", "Canada", "United Kingdom", "Australia"];

/** Detects card brand from the leading digits to size the CVC field and label it. */
function detectCardBrand(digitsOnly) {
  if (/^3[47]/.test(digitsOnly)) return "AMEX";
  if (/^4/.test(digitsOnly)) return "VISA";
  if (/^5[1-5]/.test(digitsOnly)) return "MASTERCARD";
  if (/^6(?:011|5)/.test(digitsOnly)) return "DISCOVER";
  return null;
}

/**
 * FOPCard
 * Props: selectedPlan ({ title, basePrice, billingCycle }), userData.
 * Handles promo application, card auto-formatting (brand-aware CVC length,
 * MM/YY auto-slash with past-date validation), the .env test-card bypass,
 * and success/failure messaging per user auth state.
 */
export default function FOPCard({ selectedPlan, userData }) {
  const [cardNumber, setCardNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [expError, setExpError] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("United States");
  const [promoCode, setPromoCode] = useState("");
  const [discountedPrice, setDiscountedPrice] = useState(selectedPlan?.basePrice);
  const [statusMsg, setStatusMsg] = useState(null);

  const cardBrand = detectCardBrand(cardNumber.replace(/\s/g, ""));
  const isAmex = cardBrand === "AMEX";

  // Auto-formatting Card Number: 15 digits (grouped 4-6-5) for Amex, 16 for others.
  const handleCardChange = (e) => {
    const maxLength = isAmex ? 15 : 16;
    const val = e.target.value.replace(/\D/g, "").substring(0, maxLength);
    setCardNumber(val.replace(/(\d{4})(?=\d)/g, "$1 "));
  };

  // Expiration Auto-slash + past-date validation
  const handleExpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").substring(0, 4);
    const formatted = val.length >= 3 ? `${val.substring(0, 2)}/${val.substring(2)}` : val;
    setExpDate(formatted);

    if (val.length === 4) {
      const month = Number(val.substring(0, 2));
      const year = 2000 + Number(val.substring(2));
      const expiryDate = new Date(year, month, 0, 23, 59, 59);
      setExpError(expiryDate < new Date() ? "Card expiration date is in the past." : "");
    } else {
      setExpError("");
    }
  };

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === "CASFIT20") {
      const discount = selectedPlan.basePrice * 0.8;
      setDiscountedPrice(discount);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (expError) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/payments/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNumber,
          expDate,
          cvc,
          zip,
          country,
          amount: discountedPrice,
          planId: selectedPlan?.id,
          userId: userData?.id,
          promoCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed, review your information and try again.");

      setStatusMsg({
        type: "success",
        text: userData
          ? "Thank you for your payment! Your plan is now active."
          : "You will receive an email with instructions soon. Thank you for your purchase and welcome to the CAS Gym community.",
      });
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.brand}>CAS FITNESS</div>
        <span className={styles.secureLabel}>Secure Payment Gate</span>
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

      {/* Payment Form */}
      <form onSubmit={handlePaymentSubmit} className={styles.form}>
        <input type="text" placeholder="Name on Card" required className={styles.input} />

        <div className={styles.cardNumberRow}>
          <input
            type="text"
            placeholder="4000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardChange}
            required
            className={styles.cardNumberInput}
          />
          {cardBrand && <span className={styles.cardBrandBadge}>{cardBrand}</span>}
        </div>

        <div className={styles.grid2}>
          <div>
            <input
              type="text"
              placeholder="MM/YY"
              value={expDate}
              onChange={handleExpChange}
              required
              className={styles.monoInput}
            />
            {expError && <p className={styles.fieldError}>{expError}</p>}
          </div>
          <input
            type="text"
            placeholder={isAmex ? "1234" : "123"}
            value={cvc}
            onChange={(e) => setCvc(e.target.value.substring(0, isAmex ? 4 : 3))}
            required
            className={styles.monoInput}
          />
        </div>

        <div className={styles.grid2}>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={styles.input}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="ZIP / Postal Code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            required
            className={styles.input}
          />
        </div>

        <button type="submit" className={styles.submitButton}>
          Pay Now (${discountedPrice})
        </button>
      </form>
    </div>
  );
}
