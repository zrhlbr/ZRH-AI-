/**
 * 聊天 / 状态等用户界面的引擎显示别名。
 * 真实模型名仅在管理后台 AI 模型页展示，此处不改 API 传参。
 */

const KNOWN_ALIASES: Array<{ match: RegExp; label: string }> = [
  { match: /qwen/i, label: 'ZRH AI Engine 01' },
  { match: /deepseek[-_]?r1/i, label: 'ZRH AI Engine 02' },
  { match: /deepseek[-_]?coder/i, label: 'ZRH AI Engine 03' },
  { match: /deepseek/i, label: 'ZRH AI Engine 02' },
  { match: /llama/i, label: 'ZRH AI Engine 04' },
];

/** 稳定索引 → Engine NN（未知模型） */
function fallbackLabel(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const n = (h % 20) + 1;
  return `ZRH AI Engine ${String(n).padStart(2, '0')}`;
}

/** 将底层模型名映射为品牌引擎名（用于展示） */
export function toEngineLabel(name: string | null | undefined): string {
  if (!name) return 'ZRH AI Engine';
  const trimmed = name.trim();
  if (!trimmed) return 'ZRH AI Engine';
  for (const item of KNOWN_ALIASES) {
    if (item.match.test(trimmed)) return item.label;
  }
  return fallbackLabel(trimmed);
}

/** 按列表顺序为模型分配 Engine 01/02/03…（侧栏/首页清单优先用此保证序号连续） */
export function toEngineLabelByIndex(name: string, index: number): string {
  const known = KNOWN_ALIASES.find((item) => item.match.test(name));
  if (known) return known.label;
  return `ZRH AI Engine ${String(index + 1).padStart(2, '0')}`;
}
