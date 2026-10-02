import { useEffect, useState } from "react";
import styles from "../styles/MembershipCard.module.css";

/**
 * MembershipCard
 * Displays a membership plan with optional photo, promotion details, and add to cart.
 * Shows old price struck-out in bold red when promotion is active.
 */
export default function MembershipCard({
  id,
  title,
  description,
  price,
  photo_url,
  billing_cycle,
  details,
  promotion,
  autoPromotion,
  onAddToCart,
  onSeeDetails,
}) {
  const [activePrice, setActivePrice] = useState(Number(price));
  const [isPromotionValid, setIsPromotionValid] = useState(false);

  // Check if promotion is currently valid
  useEffect(() => {
    if (promotion) {
      const now = new Date();
      const validFrom = new Date(promotion.valid_from);
      const validTo = new Date(promotion.valid_to);
      setIsPromotionValid(now >= validFrom && now <= validTo);
      if (now >= validFrom && now <= validTo) {
        setActivePrice(Number(promotion.discounted_price));
      } else {
        setActivePrice(Number(price));
      }
    } else {
      setIsPromotionValid(false);
      setActivePrice(Number(price));
    }
  }, [promotion, price]);

  const computeAutoDiscountedPrice = () => {
    if (!autoPromotion) return Number(price);
    if (autoPromotion.discountType === "PERCENTAGE") {
      return Number(price) * (1 - autoPromotion.discountValue / 100);
    }
    return Math.max(Number(price) - autoPromotion.discountValue, 0);
  };

  // Keep the displayed price synced with the live campaign whenever no
  // manual promo code is currently applied.
  useEffect(() => {
    setActivePrice(computeAutoDiscountedPrice());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPromotion, price]);

  const showDiscountBadge = Boolean(autoPromotion || isPromotionValid);

  const billingLabel = billing_cycle === "session" ? "per session" : `/ ${billing_cycle || "mo"}`;

  return (
    <div className={styles.card}>
      {/* Photo Section */}
      {photo_url && (
        <div className={styles.photoContainer}>
          <img src={photo_url} alt={title} className={styles.photo} />
        </div>
      )}

      {/* Promotion Badge */}
      {isPromotionValid && promotion && (
        <div className={styles.promoBadge}>
          <span className={styles.promoName}>🎉 {promotion.name}</span>
          <span className={styles.hurryUp}>⏰ Hurry up!</span>
        </div>
      )}

      <div className={styles.content}>
        <div>
          <div className={styles.headerRow}>
            <h3 className={styles.planTitle}>{title}</h3>
            <span className={styles.badge}>CAS</span>
          </div>

          {/* See Details Link */}
          <button
            type="button"
            onClick={() => onSeeDetails?.({ id, title, description, price, photo_url, billing_cycle, details })}
            className={styles.seeDetailsLink}
          >
            See Details
          </button>

          <p className={styles.description}>{description}</p>

          {/* Promotion Validity */}
          {isPromotionValid && promotion && (
            <p className={styles.validity}>
              Valid until: {new Date(promotion.valid_to).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Pricing Section */}
        <div className={styles.footer}>
          <div className={styles.priceSection}>
            {showDiscountBadge && (
              <span className={styles.originalPrice}>
                ${Number(price).toFixed(2)}
              </span>
            )}
            <div className={styles.currentPrice}>
              <span className={styles.activePrice}>
                ${activePrice.toFixed(2)}
              </span>
              <span className={styles.priceUnit}>{billingLabel}</span>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={() =>
              onAddToCart({
                id,
                title,
                description,
                activePrice,
                billing_cycle: billing_cycle || "monthly",
                photo_url,
              })
            }
            className={styles.addToCartButton}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
