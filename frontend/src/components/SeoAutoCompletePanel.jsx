import { useState } from "react";
import styles from "../styles/SeoAutoCompletePanel.module.css";

/**
 * SeoAutoCompletePanel
 * CMS dashboard panel that calls POST /api/cms/generate-seo and populates
 * the body editor, Meta Title, Meta Description, and Slug fields. Includes
 * live character counters targeting 50-60 chars (title) and 145-155
 * chars (description).
 */
export default function SeoAutoCompletePanel({ onApplySeoData }) {
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [searchIntent, setSearchIntent] = useState("Informational");
  const [loading, setLoading] = useState(false);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleAutoGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/cms/generate-seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryKeyword,
          secondaryKeywords: secondaryKeywords.split(",").map((s) => s.trim()),
          searchIntent,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate SEO payload.");
      setMetaTitle(data.meta_title);
      setMetaDescription(data.meta_description);
      setSlug(data.slug);
      setBodyMarkdown(data.content_markdown);

      if (onApplySeoData) {
        onApplySeoData(data);
      }
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        <span>🤖</span> SEO Content Generator
      </h3>

      <div className={styles.inputGrid}>
        <div>
          <label className={styles.label}>Primary Keyword</label>
          <input
            type="text"
            value={primaryKeyword}
            onChange={(e) => setPrimaryKeyword(e.target.value)}
            placeholder="e.g., Personal Training"
            className={styles.input}
          />
        </div>

        <div>
          <label className={styles.label}>Secondary Keywords</label>
          <input
            type="text"
            value={secondaryKeywords}
            onChange={(e) => setSecondaryKeywords(e.target.value)}
            placeholder="Comma separated..."
            className={styles.input}
          />
        </div>

        <div>
          <label className={styles.label}>Search Intent</label>
          <select
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            className={styles.input}
          >
            <option value="Informational">Informational</option>
            <option value="Transactional">Transactional</option>
            <option value="Commercial">Commercial</option>
            <option value="Navigational">Navigational</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAutoGenerate}
        disabled={loading || !primaryKeyword}
        className={styles.generateButton}
      >
        {loading ? <span className={styles.spinner}>🌀</span> : "Auto-Generate Content"}
      </button>
      {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}

      {/* Editor Optimization Preview & Character Counters */}
      <div className={styles.editorSection}>
        <div>
          <label className={styles.label}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={styles.smallInput}
          />
        </div>
        <div>
          <div className={styles.counterRow}>
            <span>Meta Title</span>
            <span
              className={
                metaTitle.length >= 50 && metaTitle.length <= 60
                  ? styles.counterInRange
                  : styles.counterOutOfRange
              }
            >
              {metaTitle.length} / 60 chars (Target: 50-60)
            </span>
          </div>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className={styles.smallInput}
          />
        </div>

        <div>
          <div className={styles.counterRow}>
            <span>Meta Description</span>
            <span
              className={
                metaDescription.length >= 145 && metaDescription.length <= 155
                  ? styles.counterInRange
                  : styles.counterOutOfRange
              }
            >
              {metaDescription.length} / 155 chars (Target: 145-155)
            </span>
          </div>
          <textarea
            rows={3}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            className={styles.smallInput}
          />
        </div>
        <div>
          <label className={styles.label}>Body Markdown</label>
          <textarea
            rows={6}
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            className={styles.smallInput}
          />
        </div>
      </div>
    </div>
  );
}
