import React, { useEffect, useRef } from 'react';

const ParticleSphere = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Set container sizes
    let width = (canvas.width = canvas.parentElement.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement.clientHeight || 400);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Track mouse
    let mouseX = 0;
    let mouseY = 0;
    let isHovered = false;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      mouseY = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
    };

    const handleMouseEnter = () => {
      isHovered = true;
    };

    const handleMouseLeave = () => {
      isHovered = false;
      mouseX = 0;
      mouseY = 0;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Sphere point setup
    const points = [];
    const numPoints = 750;
    
    // Distribute points uniformly on a sphere using Fibonacci spiral
    for (let i = 0; i < numPoints; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      points.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi)
      });
    }

    // Rotational velocities
    let currentRX = 0.002;
    let currentRY = 0.003;

    // Draw frame
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;

      // Target velocities based on mouse hover
      const targetRX = 0.002 + (isHovered ? mouseY * 0.015 : 0);
      const targetRY = 0.004 + (isHovered ? mouseX * 0.015 : 0);

      // Smooth interpolation (lerp)
      currentRX += (targetRX - currentRX) * 0.05;
      currentRY += (targetRY - currentRY) * 0.05;

      const cosX = Math.cos(currentRX);
      const sinX = Math.sin(currentRX);
      const cosY = Math.cos(currentRY);
      const sinY = Math.sin(currentRY);

      // Sort points by z value (painter's algorithm) to render back dots first
      const projected = points.map((p) => {
        // Rotate around Y-axis
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.z * cosY + p.x * sinY;

        // Rotate around X-axis
        let y2 = p.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y * sinX;

        // Update the point's position for continuous rotation
        p.x = x1;
        p.y = y2;
        p.z = z2;

        // Projection
        const distance = 2.0; // camera distance
        const perspective = distance / (distance + z2);
        
        return {
          sx: centerX + x1 * radius * perspective,
          sy: centerY + y2 * radius * perspective,
          sz: z2, // depth
          perspective
        };
      });

      // Sort by depth (back to front)
      projected.sort((a, b) => a.sz - b.sz);

      // Draw projected points
      projected.forEach((pt) => {
        const szNormalized = (pt.sz + 1) / 2; // 0 (back) to 1 (front)
        
        // Depth-based settings
        const size = (szNormalized * 1.8) + 0.6; // size: 0.6 to 2.4px
        const opacity = (szNormalized * 0.75) + 0.15; // opacity: 0.15 to 0.90
        
        // Color mapping: Front points are Cyan/Teal, back points are Violet/Indigo
        const r = Math.floor(99 * (1 - szNormalized) + 45 * szNormalized);
        const g = Math.floor(102 * (1 - szNormalized) + 212 * szNormalized);
        const b = Math.floor(241 * (1 - szNormalized) + 191 * szNormalized);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="particle-sphere-container">
      <canvas ref={canvasRef} className="particle-sphere-canvas" />
    </div>
  );
};

export default ParticleSphere;
