import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import AuthCard from "./AuthCard";
import styles from "../styles/SiteHeader.module.css";

/**
 * Resolves which route the "Profile" nav button should send a signed-in
 * user to, based on their role.
 */
function getProfileRoute(currentUser) {
  if (currentUser?.roleId === 1) return "superuser";
  if (currentUser?.roleId === 2 || currentUser?.roleId === 3) return "employee";
  return "student";
}

/**
 * SiteHeader
 * Shared top navigation for Landing, Plans, and About Us pages so header
 * styling/behavior stays consistent across routes.
 *
 * Layout varies by viewport/orientation (see SiteHeader.module.css, driven
 * by CSS Grid areas on the header itself):
 *  - Desktop (md+): logo+name centered on its own row; the Auth Card /
 *    Welcome+Log Out card is absolutely anchored inside the header's
 *    right side; nav row below.
 *  - Mobile landscape, signed out: logo+name top-left, nav row directly
 *    below it (left-aligned), Auth Card on the right spanning both rows.
 *  - Mobile landscape, signed in: single row — logo+name on the left,
 *    Welcome+Log Out on the right; nav row below (full width).
 *  - Mobile portrait, signed out: logo+name centered on top, nav row
 *    below that, Auth Card centered on the bottom row (fully in-flow).
 *  - Mobile portrait, signed in: single row — logo+name on the left,
 *    Welcome + Log Out on the right (opposite side); nav row below.
 *
 * Nav row never wraps: route links + cart shrink responsively to always
 * stay on one line, with links Home, Plans, About Us, growing to a 5th
 * "Profile" link once a user is signed in (plus the cart icon).
 *
 * Props:
 *  - currentUser: authenticated user object or null
 *  - onNavigate: function(routeName) for internal navigation
 *  - onLogout: function() to log the user out
 *  - onAuthenticated: function(user) called by the Auth Card on sign in
 */
export default function SiteHeader({ currentUser, onNavigate, onLogout, onAuthenticated }) {
  return (
    <header className={`${styles.header} ${currentUser ? styles.authenticated : ""}`}>
      <div className={styles.logoNameGroup}>
        <button type="button" onClick={() => onNavigate("home")} className={styles.logoButton}>
          <img src="/logo/LogoCAS.png" alt="CAS Fitness" className={styles.logoImage} />
        </button>

        <button type="button" onClick={() => onNavigate("home")} className={styles.brandNameButton}>
          <img src="/logo/LogoName.png" alt="CAS Fitness" className={styles.brandNameImage} />
        </button>
      </div>

      {currentUser ? (
        <div className={styles.welcomeSlot}>
          <div className={styles.welcomeCard}>
            <span className={styles.welcomeText}>Welcome back, {currentUser.firstName}!</span>
            <button type="button" onClick={onLogout} className={styles.logoutButton}>
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.floatingAuthCard}>
          <AuthCard onAuthenticated={onAuthenticated} />
        </div>
      )}

      <nav className={styles.nav}>
        <button type="button" onClick={() => onNavigate("home")} className={styles.navLink}>
          Home
        </button>
        <button type="button" onClick={() => onNavigate("plans")} className={styles.navLink}>
          Plans
        </button>
        <button type="button" onClick={() => onNavigate("about")} className={styles.navLink}>
          About Us
        </button>
        {currentUser ? (
          <button
            type="button"
            onClick={() => onNavigate(getProfileRoute(currentUser))}
            className={styles.navLink}
          >
            Profile
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onNavigate("cart")}
          className={styles.cartButton}
          aria-label="Shopping Cart"
        >
          <ShoppingCartIcon size={28} />
        </button>
      </nav>
    </header>
  );
}
