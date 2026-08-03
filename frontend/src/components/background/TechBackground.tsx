import { ReactNode } from 'react';
import { AiNebula } from './AiNebula';
import { NeuralNetwork } from './NeuralNetwork';
import { DataFlow } from './DataFlow';
import { AiCore } from './AiCore';
import { ParticleField } from './ParticleField';
import { DigitalGlobe } from './DigitalGlobe';
import { useThemeStore } from '../../store/themeStore';

export type TechBackgroundVariant = 'landing' | 'auth' | 'home' | 'shell';

export interface TechBackgroundProps {
  /** Layer 5 / globe */
  globe?: boolean;
  globeClassName?: string;
  /**
   * cosmos variants → AI Cosmos V3.0（仅 Landing / Auth / Welcome）
   * shell（默认）→ Blue White V2 浅色网格，供 Chat / Knowledge 等业务页，避免串色。
   */
  variant?: TechBackgroundVariant;
  children?: ReactNode;
}

function isCosmosVariant(variant: TechBackgroundVariant): boolean {
  return variant === 'landing' || variant === 'auth' || variant === 'home';
}

/**
 * 背景合成层：
 * - Cosmos V3.0：深蓝宇宙 / 星云 / 神经网络 / 数据流 / AI Core
 * - Shell V2：浅色网格 + 粒子（业务模块保持 Production Impact 0 视觉）
 */
export function TechBackground({
  globe,
  globeClassName = '',
  variant = 'shell',
  children,
}: TechBackgroundProps) {
  const animationsEnabled = useThemeStore((s) => s.animationsEnabled);
  const cosmos = isCosmosVariant(variant);

  if (!cosmos) {
    return (
      <div className="relative min-h-full w-full overflow-hidden bg-zrh-bg">
        <div className="zrh-tech-grid pointer-events-none absolute inset-0" aria-hidden />
        {animationsEnabled && (
          <ParticleField className="pointer-events-none absolute inset-0 h-full w-full" />
        )}
        {globe && (
          <DigitalGlobe className={`pointer-events-none absolute ${globeClassName}`} />
        )}
        <div className="relative z-10 min-h-full">{children}</div>
      </div>
    );
  }

  const showCore = globe ?? true;

  const defaultCoreClass =
    variant === 'landing'
      ? 'absolute left-1/2 top-[8%] z-[2] h-[min(82vw,34rem)] w-[min(82vw,34rem)] -translate-x-1/2 opacity-70 sm:top-[6%]'
      : variant === 'home'
        ? 'absolute left-1/2 top-[-4.5rem] z-[2] h-60 w-60 -translate-x-1/2 opacity-65 sm:h-72 sm:w-72'
        : 'absolute left-1/2 top-1/2 z-[2] h-[min(94vw,38rem)] w-[min(94vw,38rem)] -translate-x-1/2 -translate-y-1/2 opacity-55';

  return (
    <div className="zrh-cosmos relative min-h-full w-full overflow-hidden">
      {/* Layer 1 — 深蓝渐变宇宙 */}
      <div className="zrh-cosmos-gradient pointer-events-none absolute inset-0" aria-hidden />

      {/* Layer 2 — AI Nebula ≈18% */}
      <AiNebula />

      {/* Layer 3 — Neural Network */}
      {animationsEnabled && (
        <NeuralNetwork className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
      )}

      {/* Layer 4 — Data Flow（桌面少量缓慢；手机关闭） */}
      {animationsEnabled && (
        <DataFlow className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
      )}

      {/* Layer 5 — AI Core */}
      {showCore && animationsEnabled && (
        <AiCore className={`pointer-events-none ${globeClassName || defaultCoreClass}`} />
      )}
      {showCore && !animationsEnabled && (
        <div
          className={`pointer-events-none rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.22)_0%,rgba(37,99,235,0.12)_40%,transparent_70%)] ${globeClassName || defaultCoreClass}`}
          aria-hidden
        />
      )}

      <div className="relative z-10 min-h-full">{children}</div>
    </div>
  );
}
