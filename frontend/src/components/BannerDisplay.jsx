import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from '../styles/BannerDisplay.module.css';

export default function BannerDisplay({ page }) {
  const [banners, setBanners] = useState([]);
  const [dismissedBanners, setDismissedBanners] = useState(new Set());

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    fetchActiveBanners();
  }, [page]);

  const fetchActiveBanners = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/banners/active/${page}`);
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      }
    } catch (err) {
      console.error('Error fetching banners:', err);
    }
  };

  const dismissBanner = (bannerId) => {
    setDismissedBanners(prev => new Set([...prev, bannerId]));
  };

  const visibleBanners = banners.filter(b => !dismissedBanners.has(b.id));

  if (visibleBanners.length === 0) return null;

  return (
    <div className={styles.bannersContainer}>
      {visibleBanners.map(banner => (
        <div
          key={banner.id}
          className={styles.banner}
          style={{ backgroundColor: banner.background_color }}
        >
          <button
            onClick={() => dismissBanner(banner.id)}
            className={styles.dismissButton}
            style={{ color: banner.text_color }}
            aria-label="Dismiss banner"
          >
            <X size={24} />
          </button>
          
          <div className={styles.marqueeContainer}>
            <div className={styles.marqueeContent} style={{ color: banner.text_color }}>
              <span className={styles.marqueeText}>
                <strong>{banner.title}:</strong> {banner.content}
              </span>
              <span className={styles.marqueeText}>
                <strong>{banner.title}:</strong> {banner.content}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

