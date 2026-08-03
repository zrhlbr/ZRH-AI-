import { useEffect, useRef } from 'react';
import { COSMOS, canvasDpr, isMobileViewport, prefersReducedMotion } from './performance';

/**
 * Layer 4 — Data Flow
 * 少量、缓慢；禁止炫酷流光 / 快速移动。手机可关闭以保性能。
 */
export function DataFlow({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) return;
    // Phone：自动简化 — 保留星云+神经网络，关闭数据流层
    if (isMobileViewport()) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = canvasDpr();

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    interface Flow {
      x: number;
      y: number;
      speed: number;
      len: number;
    }
    const flows: Flow[] = Array.from({ length: 3 }, (_, i) => ({
      x: Math.random() * 400 * dpr,
      y: (0.25 + i * 0.22) * (canvas.height || 400),
      speed: (0.18 + Math.random() * 0.12) * dpr,
      len: (48 + Math.random() * 36) * dpr,
    }));

    const render = () => {
      if (!running) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const f of flows) {
        const grad = ctx.createLinearGradient(f.x - f.len, f.y, f.x, f.y);
        grad.addColorStop(0, 'rgba(37,99,235,0)');
        grad.addColorStop(1, COSMOS.soft);
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.1 * dpr;
        ctx.beginPath();
        ctx.moveTo(f.x - f.len, f.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        f.x += f.speed;
        if (f.x - f.len > w) {
          f.x = 0;
          f.y = (0.15 + Math.random() * 0.7) * h;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(render);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) raf = requestAnimationFrame(render);
      else cancelAnimationFrame(raf);
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
