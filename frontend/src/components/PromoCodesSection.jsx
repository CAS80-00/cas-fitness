import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import styles from "../styles/PromoCodesSection.module.css";

const emptyForm = {
  code: "",
  campaignName: "",
  planId: "",
  discountType: "AMOUNT",
  discountValue: "",
  startTime: "",
  endTime: "",
};

// Converts a stored UTC ISO timestamp into the "YYYY-MM-DDTHH:mm" shape a
// <input type="datetime-local"> expects, expressed in the browser's local
// timezone (not a raw UTC-digit slice) so editing without touching the
// dates round-trips to the same instant instead of drifting by the local
// UTC offset on every save.
function toLocalInputValue(isoString) {
  const date = new Date(isoString);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

/**
 * PromoCodesSection
 * Active promotions table (Promo Code, Campaign, Date Range, Status,
 * Discount) plus Add/Edit/Delete. "Activate" saves and schedules the
 * promotion; the Status toggle reflects whether it's currently live
 * (start_time <= now <= end_time), computed server-side as isCurrentlyLive.
 * When live, matching plan cards on the public Plans page automatically
 * show the discounted price (see PlansPage.jsx).
 */
export default function PromoCodesSection({ plans, onSessionInvalidated }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [promotions, setPromotions] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  // Check if error is a session/auth error and handle it
  const handleAuthError = (errorMessage) => {
    if (
      errorMessage.includes("Session invalidated") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("expired")
    ) {
      // Clear stored auth data and notify parent to log out
      localStorage.removeItem("cas_jwt");
      localStorage.removeItem("cas_user");
      if (onSessionInvalidated) {
        onSessionInvalidated();
      }
      return true;
    }
    return false;
  };

  const loadPromotions = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/promotions`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || "Failed to load promotions.";
        if (handleAuthError(errorMsg)) {
          setError("Session expired. Please log in again.");
          return;
        }
        throw new Error(errorMsg);
      }
      setPromotions(data.promotions || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      loadPromotions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (promo) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      campaignName: promo.campaignName,
      planId: promo.planId || "",
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      startTime: toLocalInputValue(promo.startTime),
      endTime: toLocalInputValue(promo.endTime),
    });
    setShowForm(true);
  };

  const submitForm = async (event, activate) => {
    event.preventDefault();
    setError("");
    const payload = {
      code: form.code,
      campaignName: form.campaignName,
      planId: form.planId || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      isActive: activate,
    };

    try {
      const url = editingId ? `${apiBaseUrl}/admin/promotions/${editingId}` : `${apiBaseUrl}/admin/promotions`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || "Failed to save promotion.";
        if (handleAuthError(errorMsg)) {
          setError("Session expired. Please log in again.");
          return;
        }
        throw new Error(errorMsg);
      }
      setShowForm(false);
      loadPromotions();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePromotion = async (id) => {
    if (!window.confirm("Delete this promotion? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/admin/promotions/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || "Failed to delete promotion.";
        if (handleAuthError(errorMsg)) {
          setError("Session expired. Please log in again.");
          return;
        }
        throw new Error(errorMsg);
      }
      setPromotions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDiscount = (promo) =>
    promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : `$${promo.discountValue.toFixed(2)}`;

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className={styles.title}>Promocodes &amp; Campaigns</h2>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className={styles.collapsibleContent}>
          {error && <p className={styles.errorText}>{error}</p>}

          <button type="button" onClick={startAdd} className={styles.addButton}>
            <Plus size={18} />
            Add Promo Code
          </button>

          <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Promo Code</th>
              <th>Campaign Name</th>
              <th>Date Range</th>
              <th>Status</th>
              <th>Discount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promotions.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No promotions yet.
                </td>
              </tr>
            )}
            {promotions.map((promo) => (
              <tr key={promo.id}>
                <td className={styles.codeCell}>{promo.code}</td>
                <td>{promo.campaignName}</td>
                <td className={styles.dateCell}>
                  {new Date(promo.startTime).toLocaleString()} &rarr; {new Date(promo.endTime).toLocaleString()}
                </td>
                <td>
                  <span className={promo.isCurrentlyLive ? styles.statusActive : styles.statusInactive}>
                    {promo.isCurrentlyLive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>{formatDiscount(promo)}</td>
                <td className={styles.actionsCell}>
                  <button type="button" onClick={() => startEdit(promo)} className={styles.editButton}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePromotion(promo.id)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay}>
          <form className={styles.formCard} onSubmit={(e) => submitForm(e, true)}>
            <h3 className={styles.formTitle}>{editingId ? "Edit Promo Code" : "Add Promo Code"}</h3>

            <label className={styles.fieldLabel}>
              Promo Code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              Campaign Name
              <input
                required
                value={form.campaignName}
                onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              Applies To
              <select
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
                className={styles.input}
              >
                <option value="">All Plans</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.discountRow}>
              <label className={styles.fieldLabel}>
                Discount Type
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  className={styles.input}
                >
                  <option value="AMOUNT">Flat Amount ($)</option>
                  <option value="PERCENTAGE">Percentage (%)</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Discount Value
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  className={styles.input}
                />
              </label>
            </div>
            <label className={styles.fieldLabel}>
              Start Date &amp; Time
              <input
                required
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              End Date &amp; Time
              <input
                required
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={styles.input}
              />
            </label>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setShowForm(false)} className={styles.cancelButton}>
                Cancel
              </button>
              <button type="button" onClick={(e) => submitForm(e, false)} className={styles.saveDraftButton}>
                Save (Inactive)
              </button>
              <button type="submit" className={styles.activateButton}>
                Activate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
