import { useEffect, useState } from "react";
import styles from "../styles/PlanManagement.module.css";

/**
 * PlanManagement
 * Superuser-only component for managing plans: add, edit, delete, upload photos.
 * Plans can have optional promotional pricing with validity dates.
 */
export default function PlanManagement() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isReordering, setIsReordering] = useState(false);
  const [reorderingPlans, setReorderingPlans] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    billingCycle: "monthly",
    photoFile: null,
    photoPreview: null,
  });

  const [promoData, setPromoData] = useState({
    isActive: false,
    name: "",
    discountedPrice: "",
    validFrom: "",
    validTo: "",
  });

  // Load plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/plans`);
      const data = await res.json();
      if (res.ok) {
        setPlans(data.plans || []);
        setReorderingPlans(data.plans || []);
      }
    } catch (err) {
      setError("Failed to load plans: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newList = [...reorderingPlans];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setReorderingPlans(newList);
  };

  const moveDown = (index) => {
    if (index === reorderingPlans.length - 1) return;
    const newList = [...reorderingPlans];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setReorderingPlans(newList);
  };

  const saveOrder = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const planOrder = reorderingPlans.map((plan, index) => ({
        id: plan.id,
        displayOrder: index,
      }));

      const res = await fetch(`${apiBaseUrl}/plans/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ planOrder }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reorder plans.");

      setSuccessMessage("Plans reordered successfully!");
      setIsReordering(false);
      loadPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData({
          ...formData,
          photoFile: file,
          photoPreview: event.target?.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePromoChange = (e) => {
    const { name, type, value, checked } = e.target;
    setPromoData({
      ...promoData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      price: "",
      billingCycle: "monthly",
      photoFile: null,
      photoPreview: null,
    });
    setPromoData({
      isActive: false,
      name: "",
      discountedPrice: "",
      validFrom: "",
      validTo: "",
    });
    setEditingPlan(null);
  };

  const openEditForm = (plan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title,
      description: plan.description,
      price: plan.price,
      billingCycle: plan.billing_cycle || "monthly",
      photoFile: null,
      photoPreview: plan.photo_url || null,
    });

    if (plan.promotion) {
      setPromoData({
        isActive: true,
        name: plan.promotion.name,
        discountedPrice: plan.promotion.discounted_price,
        validFrom: plan.promotion.valid_from ? plan.promotion.valid_from.split("T")[0] : "",
        validTo: plan.promotion.valid_to ? plan.promotion.valid_to.split("T")[0] : "",
      });
    }

    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!formData.title || !formData.description || !formData.price) {
      setError("Title, description, and price are required.");
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("billing_cycle", formData.billingCycle);

      if (formData.photoFile) {
        formDataToSend.append("photo", formData.photoFile);
      }

      if (promoData.isActive) {
        formDataToSend.append("promotion_name", promoData.name);
        formDataToSend.append("promotion_discounted_price", promoData.discountedPrice);
        formDataToSend.append("promotion_valid_from", promoData.validFrom);
        formDataToSend.append("promotion_valid_to", promoData.validTo);
      } else {
        formDataToSend.append("remove_promotion", "true");
      }

      const url = editingPlan
        ? `${apiBaseUrl}/admin/plans/${editingPlan.id}`
        : `${apiBaseUrl}/admin/plans`;

      const method = editingPlan ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: formDataToSend,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${editingPlan ? "update" : "create"} plan.`);
      }

      setSuccessMessage(
        `Plan ${editingPlan ? "updated" : "created"} successfully!`
      );
      resetForm();
      setShowForm(false);
      loadPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm("Are you sure you want to delete this plan? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/plans/${planId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to delete plan.");
      }

      setSuccessMessage("Plan deleted successfully!");
      loadPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Manage Plans</h2>
        <div className={styles.headerActions}>
          {isReordering ? (
            <>
              <button
                type="button"
                onClick={saveOrder}
                disabled={loading}
                className={styles.saveButton}
              >
                {loading ? "Saving..." : "Save Order"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReordering(false);
                  setReorderingPlans([...plans]);
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsReordering(true);
                  setReorderingPlans([...plans]);
                }}
                className={styles.reorderButton}
              >
                🔀 Reorder Plans
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(!showForm);
                }}
                className={styles.addButton}
              >
                {showForm ? "Cancel" : "+ Add New Plan"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      {isReordering && (
        <div className={styles.reorderContainer}>
          <h3>Reorder Plans</h3>
          <p>Drag plans up or down to change their display order. The first plan will appear first.</p>
          <div className={styles.reorderList}>
            {reorderingPlans.map((plan, index) => (
              <div key={plan.id} className={styles.reorderItem}>
                <span className={styles.reorderIndex}>{index + 1}</span>
                <span className={styles.reorderTitle}>{plan.title}</span>
                <div className={styles.reorderButtons}>
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className={styles.moveButton}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === reorderingPlans.length - 1}
                    className={styles.moveButton}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className={styles.formContainer}>
          <h3 className={styles.formTitle}>
            {editingPlan ? "Edit Plan" : "Create New Plan"}
          </h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="e.g., Basic Student"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Price *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  placeholder="e.g., 49.99"
                  step="0.01"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Billing Cycle *</label>
                <select
                  name="billingCycle"
                  value={formData.billingCycle}
                  onChange={handleFormChange}
                >
                  <option value="monthly">Monthly</option>
                  <option value="session">Per Session</option>
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="e.g., Access to main gym floor and locker rooms."
                rows="3"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Plan Photo (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {formData.photoPreview && (
                <div className={styles.photoPreview}>
                  <img src={formData.photoPreview} alt="Preview" />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        photoFile: null,
                        photoPreview: null,
                      })
                    }
                    className={styles.removePhotoBtn}
                  >
                    Remove Photo
                  </button>
                </div>
              )}
            </div>

            <div className={styles.promoSection}>
              <h4>Promotion (Optional)</h4>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={promoData.isActive}
                  onChange={handlePromoChange}
                />
                Add Promotional Pricing
              </label>

              {promoData.isActive && (
                <div className={styles.promoFields}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Promotion Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={promoData.name}
                        onChange={handlePromoChange}
                        placeholder="e.g., Summer Sale"
                        required={promoData.isActive}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Discounted Price *</label>
                      <input
                        type="number"
                        name="discountedPrice"
                        value={promoData.discountedPrice}
                        onChange={handlePromoChange}
                        placeholder="e.g., 39.99"
                        step="0.01"
                        required={promoData.isActive}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Valid From *</label>
                      <input
                        type="date"
                        name="validFrom"
                        value={promoData.validFrom}
                        onChange={handlePromoChange}
                        required={promoData.isActive}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Valid To *</label>
                      <input
                        type="date"
                        name="validTo"
                        value={promoData.validTo}
                        onChange={handlePromoChange}
                        required={promoData.isActive}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formActions}>
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!isReordering && (
      <div className={styles.plansGrid}>
        {loading && !plans.length ? (
          <div className={styles.loading}>Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className={styles.empty}>No plans yet. Create your first plan!</div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className={styles.planCard}>
              {plan.photo_url && (
                <div className={styles.photoContainer}>
                  <img src={plan.photo_url} alt={plan.title} />
                </div>
              )}

              <div className={styles.planContent}>
                <h3 className={styles.planTitle}>{plan.title}</h3>
                <p className={styles.planDescription}>{plan.description}</p>

                <div className={styles.pricingSection}>
                  {plan.promotion ? (
                    <div>
                      <p className={styles.promoName}>🎉 {plan.promotion.name}</p>
                      <p className={styles.originalPrice}>
                        ${Number(plan.price).toFixed(2)}
                      </p>
                      <p className={styles.discountedPrice}>
                        ${Number(plan.promotion.discounted_price).toFixed(2)}
                      </p>
                      <p className={styles.validity}>
                        Valid until:{" "}
                        {new Date(plan.promotion.valid_to).toLocaleDateString()}
                      </p>
                      <p className={styles.hurry}>⏰ Hurry up!</p>
                    </div>
                  ) : (
                    <div>
                      <p className={styles.price}>
                        ${Number(plan.price).toFixed(2)}
                      </p>
                    </div>
                  )}
                  <p className={styles.billingCycle}>
                    / {plan.billing_cycle || "month"}
                  </p>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => openEditForm(plan)}
                    className={styles.editBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(plan.id)}
                    className={styles.deleteBtn}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
