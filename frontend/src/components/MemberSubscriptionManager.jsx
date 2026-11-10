import { useEffect, useState } from "react";
import styles from "../styles/MemberSubscriptionManager.module.css";

/**
 * MemberSubscriptionManager
 * Allows superusers to view, create, update, and delete member subscriptions.
 * Props: memberId, onSubscriptionUpdate
 */
export default function MemberSubscriptionManager({ memberId, onSubscriptionUpdate }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    planId: "",
    status: "ACTIVE",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    autoRenew: true,
  });

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: `Bearer ${token}` };
  };

  // Load subscriptions
  useEffect(() => {
    const loadSubscriptions = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${apiBaseUrl}/admin/subscriptions/user/${memberId}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (res.ok) {
          setSubscriptions(data.subscriptions || []);
        } else {
          setError(data.error || "Failed to load subscriptions");
        }
      } catch (err) {
        setError("Failed to load subscriptions: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    // Load plans
    const loadPlans = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/plans`);
        const data = await res.json();
        if (res.ok) {
          setPlans(data.plans || []);
        }
      } catch {
        // Non-fatal
      }
    };

    loadSubscriptions();
    loadPlans();
  }, [memberId, apiBaseUrl]);

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    if (!formData.planId) {
      setError("Please select a plan");
      return;
    }

    try {
      setError("");
      const res = await fetch(`${apiBaseUrl}/admin/subscriptions`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: memberId,
          planId: Number(formData.planId),
          status: formData.status,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          autoRenew: formData.autoRenew,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("Subscription created successfully!");
        setSubscriptions([...subscriptions, data.subscription]);
        setShowForm(false);
        setFormData({
          planId: "",
          status: "ACTIVE",
          startDate: new Date().toISOString().split("T")[0],
          endDate: "",
          autoRenew: true,
        });
        onSubscriptionUpdate?.();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to create subscription");
      }
    } catch (err) {
      setError("Error creating subscription: " + err.message);
    }
  };

  const handleUpdateSubscription = async (subscriptionId, status) => {
    try {
      setError("");
      const res = await fetch(`${apiBaseUrl}/admin/subscriptions/${subscriptionId}`, {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubscriptions(
          subscriptions.map((sub) =>
            sub.id === subscriptionId ? { ...sub, status: data.subscription.status } : sub,
          ),
        );
        setSuccess("Subscription updated successfully!");
        onSubscriptionUpdate?.();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update subscription");
      }
    } catch (err) {
      setError("Error updating subscription: " + err.message);
    }
  };

  const handleDeleteSubscription = async (subscriptionId) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;

    try {
      setError("");
      const res = await fetch(`${apiBaseUrl}/admin/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json();
      if (res.ok) {
        setSubscriptions(subscriptions.filter((sub) => sub.id !== subscriptionId));
        setSuccess("Subscription deleted successfully!");
        onSubscriptionUpdate?.();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to delete subscription");
      }
    } catch (err) {
      setError("Error deleting subscription: " + err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateRenewalDate = (startDate, billingCycle, endDate) => {
    // If end_date is already set, use it
    if (endDate) {
      return new Date(endDate);
    }

    // Calculate based on billing cycle
    const start = new Date(startDate);
    const renewalDate = new Date(start);

    if (billingCycle === 'MONTHLY' || billingCycle === 'month') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else if (billingCycle === 'QUARTERLY' || billingCycle === 'quarter') {
      renewalDate.setMonth(renewalDate.getMonth() + 3);
    } else if (billingCycle === 'YEARLY' || billingCycle === 'year') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else if (billingCycle === 'WEEKLY' || billingCycle === 'week') {
      renewalDate.setDate(renewalDate.getDate() + 7);
    }

    return renewalDate;
  };

  if (loading) {
    return <div className={styles.container}>Loading subscriptions...</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Subscriptions</h3>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {/* Current Subscriptions */}
      {subscriptions.length > 0 ? (
        <div className={styles.subscriptionsList}>
          {subscriptions.map((sub) => (
            <div key={sub.id} className={styles.subscriptionCard}>
              <div className={styles.subscriptionHeader}>
                <h4>{sub.planTitle || `Plan ${sub.planId}`}</h4>
                <span className={`${styles.badge} ${styles[`badge-${sub.status.toLowerCase()}`]}`}>
                  {sub.status}
                </span>
              </div>
              <div className={styles.subscriptionDetails}>
                <p>
                  <strong>Price:</strong> ${Number(sub.planPrice || 0).toFixed(2)}/{sub.billingCycle}
                </p>
                <p>
                  <strong>Start Date:</strong> {formatDate(sub.startDate)}
                </p>
                <p>
                  <strong>Renewal Date:</strong> {formatDate(calculateRenewalDate(sub.startDate, sub.billingCycle, sub.endDate))}
                </p>
                {sub.nextRenewalDate && (
                  <p>
                    <strong>Next Payment:</strong> {formatDate(sub.nextRenewalDate)}
                  </p>
                )}
                {sub.renewalFrequency && (
                  <p>
                    <strong>Renewal Frequency:</strong> {sub.renewalFrequency}
                  </p>
                )}
                <p>
                  <strong>Auto-Renew:</strong> {sub.autoRenew ? "Yes" : "No"}
                </p>
              </div>
              <div className={styles.subscriptionActions}>
                {sub.status !== "CANCELLED" && (
                  <button
                    onClick={() => handleUpdateSubscription(sub.id, "CANCELLED")}
                    className={styles.cancelButton}
                  >
                    Cancel Subscription
                  </button>
                )}
                <button
                  onClick={() => handleDeleteSubscription(sub.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.noSubscriptions}>No active subscriptions</p>
      )}

      {/* Add Subscription Button */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className={styles.addButton}>
          + Add Subscription
        </button>
      )}

      {/* Create Subscription Form */}
      {showForm && (
        <form onSubmit={handleCreateSubscription} className={styles.form}>
          <h4>Create New Subscription</h4>

          <div className={styles.formGroup}>
            <label htmlFor="planId">Plan</label>
            <select
              id="planId"
              value={formData.planId}
              onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
              required
            >
              <option value="">Select a plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} - ${Number(plan.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="endDate">End Date (Optional)</label>
            <input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
              />
              Auto-Renew
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              Create Subscription
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={styles.cancelFormButton}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
