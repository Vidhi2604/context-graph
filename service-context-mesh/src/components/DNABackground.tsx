'use client';

import { useEffect, useRef } from 'react';

export default function DNABackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animId: number;
    let offset = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const AMPLITUDE = 38;
    const WAVELENGTH = 200;
    const DOT_SPACING = 20;
    const RUNG_SPACING = 40;
    const BRIDGE_SPACING = 120; // x distance between inter-row connections
    const BASE_DOT_RADIUS = 2.8;
    const SPEED = 0.6;
    const ROWS = 3;

    const strandY = (x: number, centerY: number, phase: number) =>
      centerY + AMPLITUDE * Math.sin((2 * Math.PI * (x + offset)) / WAVELENGTH + phase);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      offset += SPEED;

      const rowSpacing = height / (ROWS + 1);

      for (let row = 0; row < ROWS; row++) {
        const centerY = rowSpacing * (row + 1);

        // --- connecting rungs ---
        const rungStart = -(RUNG_SPACING - (offset % RUNG_SPACING));
        for (let x = rungStart; x < width + RUNG_SPACING; x += RUNG_SPACING) {
          const y1 = strandY(x, centerY, 0);
          const y2 = strandY(x, centerY, Math.PI);
          const depth = (Math.sin((2 * Math.PI * (x + offset)) / WAVELENGTH) + 1) / 2;

          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.04 + depth * 0.1})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // --- dots on both strands ---
        const dotStart = -(DOT_SPACING - (offset % DOT_SPACING));
        for (let x = dotStart; x < width + DOT_SPACING; x += DOT_SPACING) {
          for (let strand = 0; strand < 2; strand++) {
            const phase = strand === 0 ? 0 : Math.PI;
            const y = strandY(x, centerY, phase);
            const depth = (Math.sin((2 * Math.PI * (x + offset)) / WAVELENGTH + phase) + 1) / 2;
            const alpha = 0.18 + depth * 0.62;
            const radius = BASE_DOT_RADIUS * (0.55 + depth * 0.65);

            // Soft glow
            ctx.shadowColor = `rgba(52, 211, 153, ${alpha * 0.75})`;
            ctx.shadowBlur = 7 + depth * 5;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
            ctx.fill();

            ctx.shadowBlur = 0;
          }
        }
      }

      // --- inter-row bridges ---
      for (let row = 0; row < ROWS - 1; row++) {
        const centerY1 = rowSpacing * (row + 1);
        const centerY2 = rowSpacing * (row + 2);

        const bridgeStart = -(BRIDGE_SPACING - (offset % BRIDGE_SPACING));
        for (let x = bridgeStart; x < width + BRIDGE_SPACING; x += BRIDGE_SPACING) {
          // connect bottom strand of row[i] → top strand of row[i+1]
          const y1 = strandY(x, centerY1, Math.PI);
          const y2 = strandY(x, centerY2, 0);
          const depth = (Math.sin((2 * Math.PI * (x + offset)) / WAVELENGTH + Math.PI) + 1) / 2;
          const alpha = 0.35 + depth * 0.4;
          const curl = 28;

          ctx.shadowColor = `rgba(52, 211, 153, ${alpha * 0.6})`;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.bezierCurveTo(
            x + curl, y1 + (y2 - y1) * 0.33,
            x - curl, y1 + (y2 - y1) * 0.67,
            x, y2
          );
          ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // small dot at each bridge endpoint
          for (const [bx, by] of [[x, y1], [x, y2]] as [number, number][]) {
            ctx.shadowColor = `rgba(52, 211, 153, ${alpha})`;
            ctx.shadowBlur = 7;
            ctx.beginPath();
            ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52, 211, 153, ${alpha + 0.1})`;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.45 }}
    />
  );
}
