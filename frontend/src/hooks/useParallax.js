import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for parallax scrolling effect
 * Returns the current scroll position and a transform style generator
 */
export const useParallax = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Generate transform style for parallax effect
   * @param {number} speed - Parallax speed factor (0.1 = slow, 1 = same as scroll)
   * @param {string} direction - 'up' or 'down'
   * @returns {object} - Style object with transform
   */
  const getParallaxStyle = useCallback((speed = 0.5, direction = 'up') => {
    const offset = direction === 'up' ? -scrollY * speed : scrollY * speed;
    return {
      transform: `translateY(${offset}px)`,
      transition: 'transform 0.1s ease-out'
    };
  }, [scrollY]);

  /**
   * Generate transform style for horizontal parallax
   * @param {number} speed - Parallax speed factor
   * @param {string} direction - 'left' or 'right'
   */
  const getHorizontalParallaxStyle = useCallback((speed = 0.3, direction = 'left') => {
    const offset = direction === 'left' ? -scrollY * speed : scrollY * speed;
    return {
      transform: `translateX(${offset}px)`,
      transition: 'transform 0.1s ease-out'
    };
  }, [scrollY]);

  /**
   * Generate combined transform for diagonal parallax
   * @param {number} speedY - Vertical speed
   * @param {number} speedX - Horizontal speed
   * @param {number} rotation - Optional rotation factor
   */
  const getDiagonalParallaxStyle = useCallback((speedY = 0.3, speedX = 0.1, rotation = 0) => {
    const offsetY = -scrollY * speedY;
    const offsetX = scrollY * speedX;
    const rotate = scrollY * rotation;
    return {
      transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`,
      transition: 'transform 0.1s ease-out'
    };
  }, [scrollY]);

  /**
   * Generate scale effect based on scroll
   * @param {number} baseScale - Starting scale
   * @param {number} scaleSpeed - How fast to scale
   * @param {number} maxScale - Maximum scale value
   */
  const getScaleParallaxStyle = useCallback((baseScale = 1, scaleSpeed = 0.0005, maxScale = 1.5) => {
    const scale = Math.min(baseScale + scrollY * scaleSpeed, maxScale);
    return {
      transform: `scale(${scale})`,
      transition: 'transform 0.1s ease-out'
    };
  }, [scrollY]);

  /**
   * Generate opacity fade based on scroll
   * @param {number} fadeStart - Scroll position to start fading
   * @param {number} fadeEnd - Scroll position to be fully faded
   */
  const getFadeStyle = useCallback((fadeStart = 0, fadeEnd = 500) => {
    const opacity = Math.max(0, Math.min(1, 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart)));
    return { opacity };
  }, [scrollY]);

  return {
    scrollY,
    getParallaxStyle,
    getHorizontalParallaxStyle,
    getDiagonalParallaxStyle,
    getScaleParallaxStyle,
    getFadeStyle
  };
};

export default useParallax;
