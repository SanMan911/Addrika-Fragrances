import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for scroll-triggered animations using IntersectionObserver
 * Elements animate when they enter the viewport
 */
export const useScrollAnimation = (options = {}) => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only trigger once when element becomes visible
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px 0px -50px 0px',
        ...options
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [isVisible, options]);

  return { ref: elementRef, isVisible };
};

/**
 * Component wrapper for scroll-triggered animations
 */
export const ScrollReveal = ({ 
  children, 
  animation = 'fade-in-up',
  delay = 0,
  duration = 600,
  threshold = 0.1,
  className = '',
  as: Component = 'div',
  ...props 
}) => {
  const { ref, isVisible } = useScrollAnimation({ threshold });

  const animationStyles = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : getInitialTransform(animation),
    transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
  };

  return (
    <Component
      ref={ref}
      className={className}
      style={animationStyles}
      {...props}
    >
      {children}
    </Component>
  );
};

/**
 * Get initial transform based on animation type
 */
const getInitialTransform = (animation) => {
  switch (animation) {
    case 'fade-in-up':
      return 'translateY(30px)';
    case 'fade-in-down':
      return 'translateY(-30px)';
    case 'fade-in-left':
      return 'translateX(-30px)';
    case 'fade-in-right':
      return 'translateX(30px)';
    case 'scale-in':
      return 'scale(0.9)';
    case 'zoom-in':
      return 'scale(0.8)';
    default:
      return 'translateY(20px)';
  }
};

/**
 * Staggered children animation component
 */
export const StaggeredReveal = ({
  children,
  animation = 'fade-in-up',
  staggerDelay = 100,
  baseDelay = 0,
  duration = 600,
  threshold = 0.1,
  className = '',
  childClassName = '',
  as: Component = 'div',
  ...props
}) => {
  const { ref, isVisible } = useScrollAnimation({ threshold });

  return (
    <Component ref={ref} className={className} {...props}>
      {Array.isArray(children) 
        ? children.map((child, index) => (
            <div
              key={index}
              className={childClassName}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'none' : getInitialTransform(animation),
                transition: `opacity ${duration}ms ease-out ${baseDelay + (index * staggerDelay)}ms, transform ${duration}ms ease-out ${baseDelay + (index * staggerDelay)}ms`,
              }}
            >
              {child}
            </div>
          ))
        : children
      }
    </Component>
  );
};

export default useScrollAnimation;
