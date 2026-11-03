import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus } from "lucide-react";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import CarouselRibbon from "../components/CarouselRibbon";
import PictureCard from "../components/PictureCard";
import UnsavedChangesModal from "../components/UnsavedChangesModal";
import heroImage from "../assets/hero.png";
import styles from "../styles/LandingPage.module.css";

// Graceful default so the public ribbon never looks broken before any
// carousel cards have been configured in the database.
const FALLBACK_IMAGES = [heroImage];

/**
 * LandingPage
 * Public entry point: SEO metadata via react-helmet-async, a Superuser-
 * editable carousel ribbon + headline (see SUPERUSER CMS flow below), and
 * the AuthCard for unauthenticated visitors (rendered inside SiteHeader).
 *
 * Superuser CMS & live editing flow:
 *  - Header and Footer stay static/unchanged; only the Body (carousel +
 *    headline) becomes an inline-editable view for Superusers.
 *  - Carousel card add/remove and image upload/delete persist immediately
 *    to Object Storage + PostgreSQL (see backend/routes/carousel.js) — no
 *    "unsaved changes" tracking applies to those actions.
 *  - The headline textarea is drafted locally (`isDirty`) until "Save
 *    Changes" is clicked. Attempting to log out, navigate away, or close
 *    the tab with unsaved headline edits triggers a confirmation modal.
 */
export default function LandingPage({ currentUser, onAuthenticated, onLogout, onNavigate, cartItems = [] }) {
  const isSuperuser = currentUser?.roleId === 1;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const [cards, setCards] = useState([]);
  const [headline, setHeadline] = useState("");
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSavingHeadline, setIsSavingHeadline] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const pendingActionRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const loadCards = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/carousel`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load carousel.");
      setCards(data.cards || []);
    } catch {
      // Public ribbon falls back to the local default image; Superuser grid
      // simply starts empty and can add cards manually.
      setCards([]);
    }
  }, [apiBaseUrl]);

  const loadHeadline = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/landing-content`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load headline.");
      setHeadline(data.headline);
      setHeadlineDraft(data.headline);
    } catch {
      // Leave headline blank on failure rather than showing a stale value.
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadCards();
    loadHeadline();
  }, [loadCards, loadHeadline]);

  // Native browser prompt for an actual tab close/refresh — a custom modal
  // isn't possible for this specific case, so this is the closest the
  // platform allows to the same "unsaved changes" warning.
  useEffect(() => {
    if (!isSuperuser) return undefined;
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSuperuser, isDirty]);

  const handleCardUpdated = (updatedCard) => {
    setCards((prev) => prev.map((card) => (card.id === updatedCard.id ? updatedCard : card)));
  };

  const handleCardRemoved = (id) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  const handleAddCard = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/carousel/cards`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add card slot.");
      setCards((prev) => [...prev, data.card]);
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const handleHeadlineChange = (value) => {
    setHeadlineDraft(value);
    setIsDirty(true);
    setSaveStatus("");
  };

  const saveHeadline = async () => {
    setIsSavingHeadline(true);
    setSaveError("");
    try {
      const res = await fetch(`${apiBaseUrl}/landing-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ headline: headlineDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save headline.");
      await loadHeadline();
      setIsDirty(false);
      setSaveStatus("Changes saved successfully.");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setSaveError(err.message);
      throw err;
    } finally {
      setIsSavingHeadline(false);
    }
  };

  const discardHeadline = () => {
    setHeadlineDraft(headline);
    setIsDirty(false);
    setSaveError("");
  };

  // Guards Superuser navigation/logout so unsaved headline edits aren't
  // silently lost. Carousel card actions persist instantly and never need
  // this guard.
  const runOrGuard = (action) => {
    if (isSuperuser && isDirty) {
      pendingActionRef.current = action;
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const guardedNavigate = (target) => runOrGuard(() => onNavigate(target));
  const guardedLogout = () => runOrGuard(() => onLogout());

  const resolveUnsavedYes = async () => {
    try {
      await saveHeadline();
      setShowUnsavedModal(false);
      pendingActionRef.current?.();
    } catch {
      // Keep the modal open with the error surfaced below the headline
      // editor so the Superuser can retry instead of silently navigating
      // away with a failed save.
      setShowUnsavedModal(false);
    } finally {
      pendingActionRef.current = null;
    }
  };

  const resolveUnsavedNo = () => {
    discardHeadline();
    setShowUnsavedModal(false);
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const publicImages = cards.filter((card) => card.imageUrl).map((card) => card.imageUrl);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>CAS Fitness | Elite Personal Training & Gym Facilities</title>
        <meta
          name="description"
          content="Join CAS Fitness. Judgment-free, tailored exercise regimens, and 24/7 facility access."
        />
        <link rel="canonical" href="https://casfitness.com/home" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "CAS Fitness",
            url: "https://casfitness.com",
            logo: "https://casfitness.com/logo.png",
          })}
        </script>
      </Helmet>

      <SiteHeader
        currentUser={currentUser}
        onNavigate={guardedNavigate}
        onLogout={guardedLogout}
        onAuthenticated={onAuthenticated}
        cartItemCount={cartItems.length}
      />

      <main className={styles.main}>
        {isSuperuser ? (
          <div className={styles.editableBody}>
            <p className={styles.editModeBanner}>Superuser editing mode — changes to cards save instantly.</p>

            <div className={styles.cardGrid}>
              {cards.map((card) => (
                <PictureCard
                  key={card.id}
                  card={card}
                  apiBaseUrl={apiBaseUrl}
                  onCardUpdated={handleCardUpdated}
                  onCardRemoved={handleCardRemoved}
                />
              ))}
              <button type="button" onClick={handleAddCard} className={styles.addCardButton}>
                <Plus size={22} />
                <span>Add Card</span>
              </button>
            </div>

            <div className={styles.headlineEditor}>
              <label htmlFor="landing-headline" className={styles.headlineLabel}>
                Headline text
              </label>
              <textarea
                id="landing-headline"
                rows={3}
                value={headlineDraft}
                onChange={(event) => handleHeadlineChange(event.target.value)}
                className={styles.headlineTextarea}
              />
              <div className={styles.headlineActions}>
                <div className={styles.headlineStatus}>
                  {isDirty && <span className={styles.dirtyBadge}>Unsaved changes</span>}
                  {saveStatus && <span className={styles.successText}>{saveStatus}</span>}
                  {saveError && <span className={styles.errorText}>{saveError}</span>}
                </div>
                <button
                  type="button"
                  onClick={saveHeadline}
                  disabled={!isDirty || isSavingHeadline}
                  className={styles.saveHeadlineButton}
                >
                  {isSavingHeadline ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.heroColumn}>
            <CarouselRibbon images={publicImages.length > 0 ? publicImages : FALLBACK_IMAGES} />
            <h1 className={styles.headline}>{headline}</h1>
          </div>
        )}
      </main>

      <UnsavedChangesModal open={showUnsavedModal} onSave={resolveUnsavedYes} onDiscard={resolveUnsavedNo} />

      <SiteFooter isSuperuser={isSuperuser} />
    </div>
  );
}
