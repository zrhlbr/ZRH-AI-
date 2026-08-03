import { useEffect, useState } from 'react';

/**
 * Mobile Chat UI V5.0 —— 软键盘跟随。
 * 返回视觉视口与布局视口的底部差值（px）：键盘弹出时为键盘高度，
 * 键盘关闭时归零。用于 fixed 底部输入框的 bottom 偏移。
 */
export function useVisualViewportOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const update = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOffset(Math.round(next));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return offset;
}
