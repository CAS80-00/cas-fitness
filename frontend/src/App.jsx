import { useCallback, useEffect, useMemo, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import AppLayout from "./layout/AppLayout";
import LandingPage from "./pages/LandingPage";
import PlansPage from "./pages/PlansPage";
import AboutUsPage from "./pages/AboutUsPage";
import StudentProfile from "./pages/StudentProfile";
import EmployeeProfile from "./pages/EmployeeProfile";
import SuperuserDashboard from "./pages/SuperuserDashboard";

const INACTIVITY_MS = 20 * 60 * 1000;

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem("cas_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  
  const [route, setRoute] = useState(() => {
    // If user is already logged in, start at profile; otherwise at home
    const raw = localStorage.getItem("cas_user");
    return raw ? "profile" : "home";
  });
  const [cartItem, setCartItem] = useState(null);
  const [cartRequested, setCartRequested] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [graceSeconds, setGraceSeconds] = useState(120);

  const isSuperuser = currentUser?.roleId === 1;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const logout = useCallback(async () => {
    const token = localStorage.getItem("cas_jwt");
    if (token) {
      try {
        await fetch(`${apiBaseUrl}/auth/logout-all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout API call failed:", error);
      }
    }

    localStorage.removeItem("cas_jwt");
    localStorage.removeItem("cas_user");
    setCurrentUser(null);
    setRoute("home");
  }, [apiBaseUrl]);

  const handleSessionInvalidated = useCallback(() => {
    logout();
  }, [logout]);

  const handleInactivityWarning = useCallback(() => {
    setShowInactivityModal(true);
  }, []);

  const handleExtendSession = useCallback(() => {
    setShowInactivityModal(false);
    setGraceSeconds(120);
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    let inactivityTimer;
    let graceTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(graceTimer);
      setGraceSeconds(120);
      setShowInactivityModal(false);

      inactivityTimer = setTimeout(() => {
        handleInactivityWarning();

        graceTimer = setTimeout(() => {
          handleSessionInvalidated();
        }, 120 * 1000);
      }, INACTIVITY_MS);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);

    inactivityTimer = setTimeout(() => {
      handleInactivityWarning();

      graceTimer = setTimeout(() => {
        handleSessionInvalidated();
      }, 120 * 1000);
    }, INACTIVITY_MS);

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(inactivityTimer);
      clearTimeout(graceTimer);
    };
  }, [currentUser, handleInactivityWarning, handleSessionInvalidated]);

  useEffect(() => {
    if (!showInactivityModal) return undefined;

    const timer = setInterval(() => {
      setGraceSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [showInactivityModal]);

  const handleNavigate = useCallback((newRoute) => {
    setRoute(newRoute);
    setCartItem(null);
    setCartRequested(false);
  }, []);

  const handleAuthenticated = useCallback(
    (user) => {
      setCurrentUser(user);
      localStorage.setItem("cas_user", JSON.stringify(user));
      // Automatically navigate to profile for authenticated users
      setRoute("profile");
    },
    [],
  );

  const handleAddToCart = useCallback((item) => {
    setCartItem(item);
    setCartRequested(true);
  }, []);

  const renderPage = useMemo(() => {
    if (!currentUser) {
      switch (route) {
        case "plans":
          return <PlansPage currentUser={currentUser} onAddToCart={handleAddToCart} onNavigate={handleNavigate} />;
        case "about":
          return <AboutUsPage currentUser={currentUser} onNavigate={handleNavigate} />;
        default:
          return (
            <LandingPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onLogout={logout}
              onAuthenticated={handleAuthenticated}
              cartItem={cartItem}
              cartRequested={cartRequested}
              onCartRequested={() => setCartRequested(false)}
            />
          );
      }
    }

    // Authenticated user routing
    switch (route) {
      case "profile":
        return currentUser.roleId === 1 ? (
          <SuperuserDashboard
            currentUser={currentUser}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        ) : currentUser.roleId === 4 ? (
          <StudentProfile
            currentUser={currentUser}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        ) : (
          <EmployeeProfile
            currentUser={currentUser}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        );
      case "plans":
        return <PlansPage currentUser={currentUser} onAddToCart={handleAddToCart} onNavigate={handleNavigate} onLogout={logout} onAuthenticated={handleAuthenticated} />;
      case "about":
        return <AboutUsPage currentUser={currentUser} onNavigate={handleNavigate} onLogout={logout} onAuthenticated={handleAuthenticated} />;
      case "home":
      default:
        return (
          <LandingPage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onLogout={logout}
            onAuthenticated={handleAuthenticated}
            cartItem={cartItem}
            cartRequested={cartRequested}
            onCartRequested={() => setCartRequested(false)}
          />
        );
    }
  }, [
    currentUser,
    route,
    cartItem,
    cartRequested,
    handleNavigate,
    handleAuthenticated,
    handleAddToCart,
    logout,
  ]);

  return (
    <HelmetProvider>
      <AppLayout
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={logout}
        showInactivityModal={showInactivityModal}
        graceSeconds={graceSeconds}
        onExtendSession={handleExtendSession}
        onSessionInvalidated={handleSessionInvalidated}
      >
        {renderPage}
      </AppLayout>
    </HelmetProvider>
  );
}

export default App;
