import { useEffect, useRef } from 'react';
import { COSMOS, canvasDpr, isMobileViewport, prefersReducedMotion } from './performance';

/**
 * Layer 5 — AI Core（Logo 后方巨大能量球）
 * 8–10s 呼吸；禁止旋转；仅允许蓝白宇宙色板。
 */
export function AiCore({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();
    const dpr = canvasDpr();
    const N = reduced ? 140 : mobile ? 220 : 380;

    const points: Array<{ x: number; y: number; z: number }> = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
    }

    // Fixed view — no spin
    const viewAngle = 0.42;
    const cosA = Math.cos(viewAngle);
    const sinA = Math.sin(viewAngle);

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let t0 = performance.now();

    const draw = (breath: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * (0.4 + breath * 0.025);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.45);
      glow.addColorStop(0, `rgba(96,165,250,${0.22 + breath * 0.08})`);
      glow.addColorStop(0.35, `rgba(37,99,235,${0.14 + breath * 0.05})`);
      glow.addColorStop(0.7, 'rgba(30,58,138,0.08)');
      glow.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const p of points) {
        const x = p.x * cosA - p.z * sinA;
        const z = p.x * sinA + p.z * cosA;
        const depth = (z + 1) / 2;
        if (depth < 0.28) continue;
        const sx = cx + x * R;
        const sy = cy + p.y * R;
        const alpha = (0.14 + depth * 0.55) * (0.88 + breath * 0.12);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = depth > 0.7 ? COSMOS.mist : COSMOS.light;
        ctx.beginPath();
        ctx.arc(sx, sy, (0.5 + depth * 1.05) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 0.2 + breath * 0.1;
      ctx.strokeStyle = COSMOS.soft;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw(0.5);
      return () => observer.disconnect();
    }

    const render = (now: number) => {
      if (!running) return;
      // ~9s breath cycle
      const breath = 0.5 + 0.5 * Math.sin(((now - t0) / 9000) * Math.PI * 2);
      draw(breath);
      raf = requestAnimationFrame(render);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) {
        t0 = performance.now();
        raf = requestAnimationFrame(render);
      } else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
