import { ReactNode } from 'react';
import { ParticleField } from './ParticleField';
import { DigitalGlobe } from './DigitalGlobe';
import { useThemeStore } from '../../store/themeStore';

export interface TechBackgroundProps {
  /** 是否显示数字地球（登录页大图 / 首页角落小图） */
  globe?: boolean;
  globeClassName?: string;
  children?: ReactNode;
}

/**
 * 科技背景合成层：深色底 + 科技网格 + 粒子数据流 + 可选数字地球。
 * 高级、克制、低耗；动画可在主题设置中关闭（性能优先）。
 */
export function TechBackground({ globe, globeClassName = '', children }: TechBackgroundProps) {
  const animationsEnabled = useThemeStore((s) => s.animationsEnabled);
  return (
    <div className="relative min-h-full w-full overflow-hidden bg-zrh-bg">
      <div className="zrh-tech-grid pointer-events-none absolute inset-0" />
      {animationsEnabled && (
        <ParticleField className="pointer-events-none absolute inset-0 h-full w-full" />
      )}
      {globe && (
        <DigitalGlobe
          className={`pointer-events-none absolute ${globeClassName}`}
        />
      )}
      <div className="relative z-10 min-h-full">{children}</div>
    </div>
  );
}
