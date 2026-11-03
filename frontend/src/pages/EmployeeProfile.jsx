import { useState } from "react";
import CalendarSlotManagement from "../components/CalendarSlotManagement";
import TrainerConsolidatedCalendar from "../components/TrainerConsolidatedCalendar";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import styles from "../styles/EmployeeProfile.module.css";

/**
 * EmployeeProfile
 * Login guard blocks SUSPENDED/CANCELLED accounts. Renders the read-only
 * employee panel plus slot creation and consolidated calendar.
 */
export default function EmployeeProfile({ currentUser, onLogout, onNavigate, onAuthenticated, cartItems = [] }) {
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

  if (!currentUser || currentUser.status === "SUSPENDED" || currentUser.status === "CANCELLED") {
    return (
      <div className={styles.guardPage}>
        <SiteHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onAuthenticated={onAuthenticated}
            cartItemCount={cartItems.length}
          />
        <div className={styles.guardCardWrap}>
          <div className={styles.guardCard}>
            Account suspended or inactive. Please contact your system administrator.
          </div>
        </div>
      </div>
    );
  }

  const handleSlotChanged = () => {
    // Increment trigger to refresh calendar
    setCalendarRefreshTrigger(prev => prev + 1);
  };

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
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Employee Profile</h1>
            <p className={styles.headerSubtitle}>ID: {currentUser.id}</p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <p>
            Name: {currentUser.firstName} {currentUser.lastName}
          </p>
          <p>Email: {currentUser.email}</p>
          <p>Status: ACTIVE</p>
          <p>Role: Employee</p>
        </div>

        <CalendarSlotManagement employeeId={currentUser.id} isEmployee={true} onSlotChanged={handleSlotChanged} />

        <TrainerConsolidatedCalendar employeeId={currentUser.id} refreshTrigger={calendarRefreshTrigger} />
      </div>

      <SiteFooter isSuperuser={currentUser?.roleId === 1} />
    </div>
  );
}
