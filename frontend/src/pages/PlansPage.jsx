import { useEffect, useState } from "react";
import MembershipCard from "../components/MembershipCard";
import PlanDetailsModal from "../components/PlanDetailsModal";
import PlanManagement from "../components/PlanManagement";
import ConsultationCalendar from "../components/ConsultationCalendar";
import SubscriptionForm from "../components/SubscriptionForm";
import FOPCard from "../components/FOPCard";
import ShoppingCart from "../components/ShoppingCart";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import styles from "../styles/PlansPage.module.css";

/**
 * PlansPage
 * Displays membership plans from API, allows superusers to manage plans,
 * and drives the checkout flow: Plans -> SubscriptionForm -> FOPCard.
 */
export default function PlansPage({
  currentUser,
  cartItems = [],
  onAddToCart,
  onNavigate,
  onLogout,
  onAuthenticated,
  cartRequested,
  onCartRequested,
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [plans, setPlans] = useState([]);
  const [showConsultation, setShowConsultation] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState("plans");
  const [customerData, setCustomerData] = useState(null);
  const [activePromotions, setActivePromotions] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const handleRemoveFromCart = (cartId) => {
    // This would typically call a parent handler to update cartItems in App.jsx
    // For now, we'll just log it - the parent (App.jsx) manages cart state
  };

  // Opens the cart drawer when the header's cart icon routes here.
  useEffect(() => {
    if (!cartRequested) return;
    setShowCart(true);
    onCartRequested?.();
  }, [cartRequested, onCartRequested]);

  // Load plans from API
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const res = await fetch(`${apiBaseUrl}/plans`);
        const data = await res.json();
        if (res.ok) {
          setPlans(data.plans || []);
        }
      } catch (err) {
        console.error("Failed to load plans:", err);
        // Fallback to empty array; superuser can add plans via PlanManagement
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    loadPlans();
  }, [apiBaseUrl]);

  // Powers the automatic price-sync with any live Superuser promotion (see
  // MembershipCard's autoPromotion prop) — polls every 30s so a promotion
  // that just started/expired reflects here without a page reload.
  useEffect(() => {
    const loadPromotions = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/promotions/active`);
        const data = await res.json();
        if (res.ok) setActivePromotions(data.promotions || []);
      } catch {
        // Non-fatal: plan cards just show their standard price.
      }
    };
    loadPromotions();
    const interval = setInterval(loadPromotions, 30000);
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const promotionForPlan = (planId) =>
    activePromotions.find((promo) => promo.planId === planId) ||
    activePromotions.find((promo) => !promo.planId);

  const refreshPlans = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/plans`);
      const data = await res.json();
      if (res.ok) {
        const freshPlans = data.plans || [];
        setPlans(freshPlans);
        
        // If details modal is open, update it with fresh data
        if (selectedPlanDetails) {
          const updatedPlan = freshPlans.find(p => p.id === selectedPlanDetails.id);
          if (updatedPlan) {
            setSelectedPlanDetails(updatedPlan);
          }
        }
      }
    } catch (err) {
      console.error("Failed to refresh plans:", err);
    }
  };

  const startSubscription = (plan) => {
    setSelectedPlan({
      id: plan.id,
      title: plan.title,
      billingCycle: plan.billing_cycle || "monthly",
      basePrice: Number(plan.activePrice ?? plan.price),
    });
    onSetCartItem({ ...plan, addedAt: Date.now() });
    setShowCart(true);
  };

  const isSuperuser = currentUser?.roleId === 1;

  return (
    <div className={styles.page}>
      <SiteHeader
        currentUser={currentUser}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
        cartItemCount={cartItems.length}
      />

      <div className={styles.contentWrap}>
        {/* Superuser Plan Management Panel */}
        {isSuperuser && (
          <div className={styles.superuserSection}>
            <PlanManagement />
          </div>
        )}

        <div className={styles.heading}>
          <h1 className={styles.headingTitle}>Membership Plans</h1>
          <p className={styles.headingSubtitle}>
            Choose the tier that matches your goals. Flexible billing terms, cancel anytime.
          </p>
        </div>

        {checkoutStep === "plans" && (
          <div className={styles.planGrid}>
            {plansLoading ? (
              <div className={styles.loading}>Loading plans...</div>
            ) : plans.length === 0 ? (
              <div className={styles.empty}>
                {isSuperuser
                  ? "No plans yet. Use the management panel above to create plans."
                  : "No plans available at the moment. Please check back later."}
              </div>
            ) : (
              plans.map((plan) => (
                <MembershipCard
                  key={plan.id}
                  id={plan.id}
                  title={plan.title}
                  description={plan.description}
                  price={plan.price}
                  billing_cycle={plan.billing_cycle}
                  photo_url={plan.photo_url}
                  onAddToCart={onAddToCart}
                  autoPromotion={promotionForPlan(plan.id)}
                />
              ))
            )}
          </div>
        )}

        {checkoutStep === "subscription" && (
          <SubscriptionForm
            selectedPlan={selectedPlan}
            currentUser={currentUser}
            onNavigateToFOP={(data) => {
              setCustomerData(data);
              setCheckoutStep("payment");
            }}
            onBackToPlans={() => setCheckoutStep("plans")}
          />
        )}

        {checkoutStep === "payment" && <FOPCard selectedPlan={selectedPlan} userData={customerData} />}

        <div className={styles.consultationBanner}>
          <div>
            <h3 className={styles.consultationTitle}>Not sure if this fits for you?</h3>
            <p className={styles.consultationCopy}>
              No problem, let&apos;s talk. A specialist will answer all your questions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConsultation(!showConsultation)}
            className={styles.consultationButton}
          >
            Schedule a consultation
          </button>
        </div>

        {showConsultation && <ConsultationCalendar />}
      </div>

      <SiteFooter isSuperuser={isSuperuser} />

      {showCart && (
        <ShoppingCart
          cartItems={cartItems}
          onClose={() => setShowCart(false)}
          onClear={() => {
            // Clear all cart items by navigating back - parent will handle this
            setShowCart(false);
          }}
          onRemoveItem={handleRemoveFromCart}
          onContinue={() => {
            setShowCart(false);
            if (cartItems.length > 0) {
              const firstItem = cartItems[0];
              setSelectedPlan({
                id: firstItem.id,
                title: firstItem.title,
                billingCycle: firstItem.billing_cycle || "monthly",
                basePrice: Number(firstItem.activePrice ?? firstItem.price),
              });
            }
            setCheckoutStep("subscription");
          }}
        />
      )}

      {selectedPlanDetails && (
        <PlanDetailsModal
          plan={selectedPlanDetails}
          currentUser={currentUser}
          onClose={() => setSelectedPlanDetails(null)}
          onSave={refreshPlans}
        />
      )}
    </div>
  );
}
