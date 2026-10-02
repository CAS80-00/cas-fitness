import { useEffect, useState } from "react";
import styles from "../styles/CarouselRibbon.module.css";

const ROTATION_INTERVAL_MS = 7000;

/**
 * CarouselRibbon
 * Public, read-only rotating ribbon of carousel images. Advances to the
 * next image every 7 seconds in an infinite loop. Rendered for anonymous
 * visitors and authenticated non-Superuser users; Superusers instead see
 * the manageable card grid (see LandingPage.jsx).
 */
export default function CarouselRibbon({ images }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [images.length]);

  // Keep the active slide in range if the image count shrinks.
  useEffect(() => {
    if (index >= images.length && images.length > 0) setIndex(0);
  }, [images.length, index]);

  if (images.length === 0) return null;

  return (
    <div className={styles.frame}>
      <img src={images[index]} alt="CAS Fitness training" className={styles.image} />
    </div>
  );
}
