import React, { useEffect, useRef, useState } from 'react';

/**
 * ParticleLogo - Creates a particle effect that reveals the logo
 * Particles fall from the top and assemble into the logo image
 */
const ParticleLogo = ({ 
  src, 
  alt, 
  className = '',
  particleCount = 150,
  animationDuration = 2500,
  particleSize = 3,
  style = {}
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match container
      const rect = container.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(scale, scale);

      // Calculate image dimensions to fit container
      const aspectRatio = img.width / img.height;
      let drawWidth = rect.width * 0.85;
      let drawHeight = drawWidth / aspectRatio;
      
      if (drawHeight > rect.height * 0.9) {
        drawHeight = rect.height * 0.9;
        drawWidth = drawHeight * aspectRatio;
      }

      const offsetX = (rect.width - drawWidth) / 2;
      const offsetY = (rect.height - drawHeight) / 2;

      // Create temporary canvas to get image data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = drawWidth;
      tempCanvas.height = drawHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0, drawWidth, drawHeight);
      
      // Get pixel data
      const imageData = tempCtx.getImageData(0, 0, drawWidth, drawHeight);
      const pixels = imageData.data;

      // Sample pixels for particles
      const particles = [];
      const step = Math.max(2, Math.floor(Math.sqrt((drawWidth * drawHeight) / particleCount)));
      
      for (let y = 0; y < drawHeight; y += step) {
        for (let x = 0; x < drawWidth; x += step) {
          const i = (y * drawWidth + x) * 4;
          const alpha = pixels[i + 3];
          
          // Only create particles for visible pixels
          if (alpha > 50) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            particles.push({
              // Target position (where particle should end up)
              targetX: x + offsetX,
              targetY: y + offsetY,
              // Starting position (above the canvas with random horizontal spread)
              x: x + offsetX + (Math.random() - 0.5) * rect.width * 0.5,
              y: -Math.random() * rect.height * 1.5 - 50,
              // Velocity
              vx: 0,
              vy: Math.random() * 2 + 1,
              // Color from image
              color: `rgba(${r}, ${g}, ${b}, ${alpha / 255})`,
              // Size variation
              size: particleSize + Math.random() * 2,
              // Delay before particle starts moving
              delay: Math.random() * 500,
              // Has reached target
              settled: false,
              // Wobble
              wobble: Math.random() * Math.PI * 2,
              wobbleSpeed: Math.random() * 0.1 + 0.02,
            });
          }
        }
      }

      particlesRef.current = particles;
      setImageLoaded(true);
      startTimeRef.current = Date.now();
      animate();
    };

    img.src = src;

    const animate = () => {
      if (!canvas || !ctx) return;
      
      const elapsed = Date.now() - startTimeRef.current;
      const rect = container.getBoundingClientRect();
      
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      let allSettled = true;
      
      particlesRef.current.forEach((particle) => {
        // Skip if still in delay period
        if (elapsed < particle.delay) {
          allSettled = false;
          return;
        }
        
        const progress = Math.min(1, (elapsed - particle.delay) / (animationDuration - particle.delay));
        const easeProgress = easeOutQuart(progress);
        
        if (!particle.settled) {
          // Interpolate position
          particle.x = particle.x + (particle.targetX - particle.x) * 0.08;
          particle.y = particle.y + (particle.targetY - particle.y) * 0.08;
          
          // Add slight wobble during falling
          if (progress < 0.8) {
            particle.wobble += particle.wobbleSpeed;
            particle.x += Math.sin(particle.wobble) * 0.5;
          }
          
          // Check if particle has settled
          const dx = Math.abs(particle.x - particle.targetX);
          const dy = Math.abs(particle.y - particle.targetY);
          
          if (dx < 0.5 && dy < 0.5) {
            particle.x = particle.targetX;
            particle.y = particle.targetY;
            particle.settled = true;
          } else {
            allSettled = false;
          }
        }
        
        // Draw particle
        ctx.beginPath();
        ctx.fillStyle = particle.color;
        ctx.arc(particle.x, particle.y, particle.size * easeProgress, 0, Math.PI * 2);
        ctx.fill();
      });
      
      if (allSettled || elapsed > animationDuration + 1000) {
        setAnimationComplete(true);
        // Draw final image for crispness
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Calculate dimensions again for final draw
        const aspectRatio = img.width / img.height;
        let drawWidth = rect.width * 0.85;
        let drawHeight = drawWidth / aspectRatio;
        
        if (drawHeight > rect.height * 0.9) {
          drawHeight = rect.height * 0.9;
          drawWidth = drawHeight * aspectRatio;
        }
        
        const offsetX = (rect.width - drawWidth) / 2;
        const offsetY = (rect.height - drawHeight) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [src, particleCount, animationDuration, particleSize]);

  // Easing function for smooth animation
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      style={{ minHeight: 'clamp(120px, 25vw, 200px)', ...style }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          opacity: animationComplete ? 0 : 1,
          transition: 'opacity 0.5s ease-out'
        }}
      />
      {/* Fallback/final image */}
      <img
        src={src}
        alt={alt}
        className="mx-auto transition-all duration-500"
        style={{ 
          opacity: animationComplete ? 1 : 0,
          maxWidth: 'min(800px, 90vw)',
          width: '85%',
          height: 'auto',
          ...style
        }}
      />
    </div>
  );
};

export default ParticleLogo;
