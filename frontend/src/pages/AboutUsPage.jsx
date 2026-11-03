import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import BannerDisplay from "../components/BannerDisplay";
import styles from "../styles/AboutUsPage.module.css";

/**
 * AboutUsPage
 * Two-column mission statement layout (stacked on mobile) with inline
 * Superuser CMS editing for both mission text and image. Mission text has
 * unsaved-changes-aware Save/Cancel flow. Image upload/delete persists
 * immediately to Object Storage + PostgreSQL.
 */
export default function AboutUsPage({ currentUser, onNavigate, onLogout, onAuthenticated, cartItems = [] }) {
  const isSuperuser = currentUser?.roleId === 1;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const [mission, setMission] = useState("");
  const [missionDraft, setMissionDraft] = useState("");
  const [isMissionDirty, setIsMissionDirty] = useState(false);
  const [isSavingMission, setIsSavingMission] = useState(false);
  const [missionSaveStatus, setMissionSaveStatus] = useState("");
  const [missionSaveError, setMissionSaveError] = useState("");

  const [imageUrl, setImageUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageSaveError, setImageSaveError] = useState("");
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  // Load content on mount
  useEffect(() => {
    const loadContent = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/aboutus`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load content.");
        setMission(data.mission);
        setMissionDraft(data.mission);
        setImageUrl(data.imageUrl);
      } catch {
        // Fallback to defaults
      }
    };
    loadContent();
  }, [apiBaseUrl]);

  const handleMissionChange = (value) => {
    setMissionDraft(value);
    setIsMissionDirty(true);
    setMissionSaveStatus("");
  };

  const saveMission = async () => {
    setIsSavingMission(true);
    setMissionSaveError("");
    try {
      const res = await fetch(`${apiBaseUrl}/aboutus/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mission: missionDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save mission.");
      setMission(missionDraft);
      setIsMissionDirty(false);
      setMissionSaveStatus("Mission saved successfully.");
      setTimeout(() => setMissionSaveStatus(""), 3000);
    } catch (err) {
      setMissionSaveError(err.message);
    } finally {
      setIsSavingMission(false);
    }
  };

  const discardMission = () => {
    setMissionDraft(mission);
    setIsMissionDirty(false);
    setMissionSaveError("");
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingImage(true);
    setImageSaveError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${apiBaseUrl}/aboutus/image`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload image.");
      setImageUrl(data.imageUrl);
    } catch (err) {
      setImageSaveError(err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!window.confirm("Delete this image? The mission text will remain.")) return;
    setIsUploadingImage(true);
    setImageSaveError("");
    try {
      const res = await fetch(`${apiBaseUrl}/aboutus/image`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete image.");
      setImageUrl(null);
    } catch (err) {
      setImageSaveError(err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>About Us | CAS Fitness</title>
        <meta
          name="description"
          content="Learn the CAS Fitness mission and how we help members achieve real results."
        />
      </Helmet>

      <SiteHeader
        currentUser={currentUser}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
        cartItemCount={cartItems.length}
      />

      <BannerDisplay page="home" />

      <div className={styles.contentWrap}>
        <h1 className={styles.title}>About Us. Our Mission</h1>
        <div className={styles.grid}>
          <div className={styles.missionCard}>
            {isSuperuser ? (
              <>
                <textarea
                  rows={10}
                  value={missionDraft}
                  onChange={(event) => handleMissionChange(event.target.value)}
                  className={styles.textarea}
                />
                <div className={styles.missionActions}>
                  <div className={styles.missionStatus}>
                    {isMissionDirty && <span className={styles.dirtyBadge}>Unsaved changes</span>}
                    {missionSaveStatus && <span className={styles.successText}>{missionSaveStatus}</span>}
                    {missionSaveError && <span className={styles.errorText}>{missionSaveError}</span>}
                  </div>
                  <div className={styles.missionButtons}>
                    <button
                      type="button"
                      onClick={saveMission}
                      disabled={!isMissionDirty || isSavingMission}
                      className={styles.saveButton}
                    >
                      {isSavingMission ? "Saving…" : "Save Mission"}
                    </button>
                    {isMissionDirty && (
                      <button
                        type="button"
                        onClick={discardMission}
                        disabled={isSavingMission}
                        className={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.missionText}>{mission}</p>
            )}
          </div>

          <div className={styles.imageSection}>
            {imageUrl ? (
              <div className={styles.imageFrame}>
                <img src={imageUrl} alt="CAS Fitness mission" className={styles.image} />
              </div>
            ) : (
              <div className={styles.emptyImageFrame}>
                <ImageOff size={48} />
                <span>No image yet</span>
              </div>
            )}

            {isSuperuser && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className={styles.fileInput}
                />

                <div className={styles.imageActions}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className={styles.uploadButton}
                  >
                    <Upload size={14} />
                    {imageUrl ? "Replace" : "Upload"} Image
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteImage}
                      disabled={isUploadingImage}
                      className={styles.deleteImageButton}
                      aria-label="Delete image"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {isUploadingImage && (
                  <div className={styles.uploadingOverlay}>
                    <Loader2 size={20} className={styles.spinner} />
                  </div>
                )}

                {imageSaveError && <p className={styles.imageError}>{imageSaveError}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      <SiteFooter isSuperuser={isSuperuser} />
    </div>
  );
}
