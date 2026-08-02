import { brandAssets } from './theme';

type BrandMarkSize = 32 | 48 | 64 | 96 | 180 | 192 | 256 | 512 | 1024;

const SIZE_SRC: Record<BrandMarkSize, string> = {
  32: brandAssets.icon32,
  48: brandAssets.icon48,
  64: brandAssets.icon64,
  96: brandAssets.icon96,
  180: brandAssets.icon180,
  192: brandAssets.icon192,
  256: brandAssets.icon256,
  512: brandAssets.icon512,
  1024: brandAssets.icon1024,
};

function nearestBucket(size: number): BrandMarkSize {
  if (([32, 48, 64, 96, 180, 192, 256, 512, 1024] as const).includes(size as BrandMarkSize)) {
    return size as BrandMarkSize;
  }
  if (size <= 32) return 32;
  if (size <= 48) return 48;
  if (size <= 64) return 64;
  if (size <= 96) return 96;
  if (size <= 180) return 180;
  if (size <= 192) return 192;
  if (size <= 256) return 256;
  if (size <= 512) return 512;
  return 1024;
}

/**
 * ZRH Technology Group 官方蓝白科技 Logo — 纯品牌展示，不含业务逻辑。
 * 资源唯一来自 branding 母版派生；小尺寸优先 SVG。
 */
export function BrandMark({
  size = 32,
  className = '',
  alt = 'ZRH AI',
}: {
  size?: BrandMarkSize | number;
  className?: string;
  alt?: string;
}) {
  const key = nearestBucket(size);
  const src = size <= 64 ? brandAssets.iconSvg : SIZE_SRC[key];

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  );
}
