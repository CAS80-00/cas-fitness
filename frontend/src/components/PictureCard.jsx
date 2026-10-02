import { useRef, useState } from "react";
import { ImageOff, Loader2, Trash2, Upload, X } from "lucide-react";
import styles from "../styles/PictureCard.module.css";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";

/**
 * PictureCard
 * A single carousel "card slot" in the Superuser's ribbon management grid.
 * Supports uploading/replacing the slot's image, deleting just the image
 * (the slot itself stays), and removing the slot entirely. Every action
 * calls straight through to the Object Storage + PostgreSQL-backed API and
 * persists immediately (no "unsaved changes" tracking here — only the
 * headline text below the carousel uses the Save Changes / dirty flow).
 */
export default function PictureCard({ card, apiBaseUrl, onCardUpdated, onCardRemoved }) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setIsBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${apiBaseUrl}/carousel/cards/${card.id}/image`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload image.");
      onCardUpdated(data.card);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!window.confirm("Delete this card's image? The card slot will stay empty.")) return;
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/carousel/cards/${card.id}/image`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete image.");
      onCardUpdated(data.card);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!window.confirm("Remove this card slot entirely? This cannot be undone.")) return;
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/carousel/cards/${card.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove card slot.");
      onCardRemoved(card.id);
    } catch (err) {
      setError(err.message);
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.thumbFrame}>
        {card.imageUrl ? (
          <img src={card.imageUrl} alt="Carousel card" className={styles.thumbImage} />
        ) : (
          <div className={styles.emptyThumb}>
            <ImageOff size={28} />
            <span>No image yet</span>
          </div>
        )}
        {isBusy && (
          <div className={styles.busyOverlay}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className={styles.fileInput}
      />

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className={styles.uploadButton}
        >
          <Upload size={14} />
          {card.imageUrl ? "Replace" : "Upload"}
        </button>
        {card.imageUrl && (
          <button
            type="button"
            onClick={handleDeleteImage}
            disabled={isBusy}
            className={styles.deleteImageButton}
            aria-label="Delete image"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={handleRemoveCard}
          disabled={isBusy}
          className={styles.removeCardButton}
          aria-label="Remove card slot"
        >
          <X size={14} />
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
