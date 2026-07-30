import { useEffect, useRef } from 'react';

/**
 * 数字地球 —— Canvas 2D 点阵球体，绕 Y 轴缓慢旋转。
 * 轻量化：约 700 点 + 赤道/纬线弧，DPR 自适应，标签页隐藏时暂停。
 */
export function DigitalGlobe({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 球面均匀点（斐波那契螺旋）
    const N = 700;
    const points: Array<{ x: number; y: number; z: number }> = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--zrh-accent')
      .trim() || '#d4af37';

    let angle = 0;
    const render = () => {
      if (!running) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.38;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 球体光晕
      const grad = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.35);
      grad.addColorStop(0, 'rgba(212,175,55,0.06)');
      grad.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 点阵
      for (const p of points) {
        // 绕 Y 轴旋转
        const x = p.x * cosA - p.z * sinA;
        const z = p.x * sinA + p.z * cosA;
        const depth = (z + 1) / 2; // 0 背面 → 1 正面
        if (depth < 0.28) continue; // 背面点省略，提升性能与立体感
        const sx = cx + x * R;
        const sy = cy + p.y * R;
        const alpha = 0.15 + depth * 0.65;
        const size = (0.6 + depth * 1.1) * dpr;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 轮廓圆
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = accent;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
      angle += 0.0018; // 克制转速
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
