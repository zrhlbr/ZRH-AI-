import { useEffect, useRef } from 'react';

/**
 * 粒子数据流 —— 慢速漂浮粒子 + 近距连线 + 横向数据流光带。
 * 约 50 粒子，低 CPU，标签页隐藏时暂停。
 */
export function ParticleField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--zrh-accent').trim() || '#d4af37';
    const techBlue = styles.getPropertyValue('--zrh-tech-blue').trim() || '#3b82f6';

    interface Particle { x: number; y: number; vx: number; vy: number; r: number }
    const particles: Particle[] = [];
    const init = () => {
      particles.length = 0;
      const count = Math.min(50, Math.floor((canvas.width * canvas.height) / (26000 * dpr)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.12 * dpr,
          vy: (Math.random() - 0.5) * 0.12 * dpr,
          r: (Math.random() * 1.2 + 0.6) * dpr,
        });
      }
    };
    init();

    // 数据流光带
    interface Stream { y: number; x: number; speed: number; len: number }
    const streams: Stream[] = Array.from({ length: 3 }, (_, i) => ({
      y: (0.2 + i * 0.3) * canvas.height,
      x: Math.random() * canvas.width,
      speed: (0.6 + Math.random() * 0.6) * dpr,
      len: (60 + Math.random() * 80) * dpr,
    }));

    const linkDist = 110 * dpr;
    const render = () => {
      if (!running) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            ctx.globalAlpha = (1 - d / linkDist) * 0.18;
            ctx.strokeStyle = accent;
            ctx.lineWidth = dpr * 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 粒子
      ctx.fillStyle = accent;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 数据流
      for (const s of streams) {
        const grad = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, techBlue);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = grad;
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        s.x += s.speed;
        if (s.x - s.len > w) {
          s.x = 0;
          s.y = Math.random() * h;
        }
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(render);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) raf = requestAnimationFrame(render);
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
