import { useCallback, useEffect, useMemo, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import AppLayout from "./layout/AppLayout";
import LandingPage from "./pages/LandingPage";
import PlansPage from "./pages/PlansPage";
import AboutUsPage from "./pages/AboutUsPage";
import StudentProfile from "./pages/StudentProfile";
import EmployeeProfile from "./pages/EmployeeProfile";
import SuperuserDashboard from "./pages/SuperuserDashboard";
import ConfirmationPage from "./pages/ConfirmationPage";
import ShoppingCart from "./components/ShoppingCart";

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
  const [cartItems, setCartItems] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [cartRequestedByHeader, setCartRequestedByHeader] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [graceSeconds, setGraceSeconds] = useState(120);
  const [confirmationData, setConfirmationData] = useState({});

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

  const handleNavigate = useCallback((newRoute, data = {}) => {
    if (newRoute === "cart") {
      setShowCartDrawer(true);
      setCartRequestedByHeader(true);
    } else {
      setConfirmationData(data);
      // Clear cart when navigating to confirmation page after successful payment
      if (newRoute === "confirmation") {
        setCartItems([]);
      }
      setRoute(newRoute);
    }
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
    const newItem = {
      ...item,
      addedAt: Date.now(),
      cartId: Date.now(), // Unique ID for cart items
    };
    setCartItems((prev) => [...prev, newItem]);
  }, []);

  const handleRemoveFromCart = useCallback((cartId) => {
    setCartItems((prev) => prev.filter((item) => item.cartId !== cartId));
  }, []);

  const renderPage = useMemo(() => {
    if (!currentUser) {
      switch (route) {
        case "confirmation":
          return <ConfirmationPage onNavigate={handleNavigate} currentUser={currentUser} onLogout={logout} onAuthenticated={handleAuthenticated} cartItems={cartItems} customerName={confirmationData.customerName} customerEmail={confirmationData.customerEmail} />;
        case "plans":
          return <PlansPage currentUser={currentUser} cartItems={cartItems} onAddToCart={handleAddToCart} onNavigate={handleNavigate} cartRequested={cartRequestedByHeader} onCartRequested={() => setCartRequestedByHeader(false)} />;
        case "about":
          return <AboutUsPage currentUser={currentUser} cartItems={cartItems} onNavigate={handleNavigate} />;
        default:
          return (
            <LandingPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onLogout={logout}
              onAuthenticated={handleAuthenticated}
              cartItems={cartItems}
            />
          );
      }
    }

    // Authenticated user routing
    switch (route) {
      case "confirmation":
        return <ConfirmationPage onNavigate={handleNavigate} currentUser={currentUser} onLogout={logout} onAuthenticated={handleAuthenticated} cartItems={cartItems} customerName={confirmationData.customerName} customerEmail={confirmationData.customerEmail} />;
      case "profile":
        return currentUser.roleId === 1 ? (
          <SuperuserDashboard
            currentUser={currentUser}
            cartItems={cartItems}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        ) : currentUser.roleId === 4 ? (
          <StudentProfile
            currentUser={currentUser}
            cartItems={cartItems}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        ) : (
          <EmployeeProfile
            currentUser={currentUser}
            cartItems={cartItems}
            onLogout={logout}
            onNavigate={handleNavigate}
            onAuthenticated={handleAuthenticated}
          />
        );
      case "plans":
        return <PlansPage currentUser={currentUser} cartItems={cartItems} onAddToCart={handleAddToCart} onNavigate={handleNavigate} onLogout={logout} onAuthenticated={handleAuthenticated} cartRequested={cartRequestedByHeader} onCartRequested={() => setCartRequestedByHeader(false)} />;
      case "about":
        return <AboutUsPage currentUser={currentUser} cartItems={cartItems} onNavigate={handleNavigate} onLogout={logout} onAuthenticated={handleAuthenticated} />;
      case "home":
      default:
        return (
          <LandingPage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onLogout={logout}
            onAuthenticated={handleAuthenticated}
            cartItems={cartItems}
          />
        );
    }
  }, [
    currentUser,
    route,
    cartItems,
    handleNavigate,
    handleAuthenticated,
    handleAddToCart,
    logout,
    cartRequestedByHeader,
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
      
      {showCartDrawer && (
        <ShoppingCart
          cartItems={cartItems}
          onClose={() => setShowCartDrawer(false)}
          onClear={() => {
            setCartItems([]);
            setShowCartDrawer(false);
          }}
          onRemoveItem={handleRemoveFromCart}
          onKeepPurchasing={() => {
            setShowCartDrawer(false);
            setRoute("plans");
          }}
          onContinue={() => {
            setShowCartDrawer(false);
            if (cartItems.length > 0) {
              // Route to PlansPage with cartRequested to trigger multi-item checkout flow
              setRoute("plans");
              setCartRequestedByHeader(true);
            }
          }}
        />
      )}

    </HelmetProvider>
  );
}

export default App;
