import { useEffect, useRef } from 'react';
import { COSMOS, canvasDpr, particleBudget, prefersReducedMotion } from './performance';

/**
 * Layer 3 — Neural Network
 * 数百蓝色节点；近距自动连线；手机 60% 密度；后台暂停。
 */
export function NeuralNetwork({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = canvasDpr();
    const count = particleBudget(160);

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
    }
    const nodes: Node[] = [];
    const init = () => {
      nodes.length = 0;
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.045 * dpr,
          vy: (Math.random() - 0.5) * 0.045 * dpr,
          r: (Math.random() * 0.9 + 0.45) * dpr,
        });
      }
    };
    init();

    const linkDist = 92 * dpr;
    // Limit neighbor scan window to keep O(n) practical at ~160 nodes
    const neighborWindow = 28;

    const render = () => {
      if (!running) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;

        const end = Math.min(nodes.length, i + neighborWindow);
        for (let j = i + 1; j < end; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            ctx.globalAlpha = (1 - d / linkDist) * 0.22;
            ctx.strokeStyle = COSMOS.soft;
            ctx.lineWidth = 0.6 * dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = COSMOS.light;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
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
