import React, { useEffect, useRef } from 'react';

const Background = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Handle resizing
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Glowing blur orbs
    const orbs = [
      {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.min(width, height) * 0.4,
        color: 'rgba(99, 102, 241, 0.12)', // Indigo
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      },
      {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.min(width, height) * 0.5,
        color: 'rgba(167, 139, 250, 0.08)', // Purple
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      },
      {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.min(width, height) * 0.35,
        color: 'rgba(45, 212, 191, 0.06)', // Teal/Cyan
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
      },
    ];

    // Ribbon wave state
    let phase = 0;

    // Draw function
    const draw = () => {
      // Clear with dark backdrop
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw glowing orbs
      orbs.forEach((orb) => {
        // Move orbs and bounce off edges
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x < -orb.radius) orb.x = width + orb.radius;
        if (orb.x > width + orb.radius) orb.x = -orb.radius;
        if (orb.y < -orb.radius) orb.y = height + orb.radius;
        if (orb.y > height + orb.radius) orb.y = -orb.radius;

        // Draw radial gradient for glowing orb
        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          orb.radius
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'rgba(10, 10, 15, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Draw flowing light ribbons (silk-like waving lines)
      phase += 0.0015;
      
      const drawRibbon = (yOffset, amplitude, frequency, speedCoeff, color1, color2) => {
        const localPhase = phase * speedCoeff;
        ctx.lineWidth = 1.5;
        
        // Gradient for the stroke across the width
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        grad.addColorStop(0.2, color1);
        grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.4)');
        grad.addColorStop(0.8, color2);
        grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
        
        ctx.strokeStyle = grad;
        ctx.beginPath();

        for (let x = 0; x <= width; x += 15) {
          // Complex wave: sum of two sines for natural flowing look
          const y = yOffset + 
            Math.sin(x * frequency + localPhase) * amplitude + 
            Math.cos(x * frequency * 0.6 - localPhase * 1.4) * (amplitude * 0.4);
            
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };

      // Draw 3 layers of ribbons at different depths/speeds
      drawRibbon(height * 0.45, 60, 0.0012, 1.0, 'rgba(99, 102, 241, 0.15)', 'rgba(167, 139, 250, 0.15)');
      drawRibbon(height * 0.5, 45, 0.0018, 0.7, 'rgba(129, 140, 248, 0.12)', 'rgba(45, 212, 191, 0.12)');
      drawRibbon(height * 0.55, 75, 0.0009, 1.3, 'rgba(167, 139, 250, 0.1)', 'rgba(99, 102, 241, 0.1)');

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="background-container">
      <canvas ref={canvasRef} className="background-canvas" />
      <div className="background-grid-overlay" />
    </div>
  );
};

export default Background;
