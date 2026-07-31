/**
 * ZRH AI 数据库种子脚本（幂等，可重复执行）
 * - 三个角色：SUPER_ADMIN / ADMIN / USER
 * - 权限目录：菜单 / 按钮 / API 三类
 * - 超级管理员初始账号（用户名/密码来自环境变量）
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PERMISSIONS = [
  // 菜单权限
  { code: 'menu:home', type: 'MENU', name: '首页菜单' },
  { code: 'menu:status', type: 'MENU', name: '系统状态菜单' },
  // 按钮权限
  { code: 'button:status:refresh', type: 'BUTTON', name: '状态刷新按钮' },
  { code: 'button:user:manage', type: 'BUTTON', name: '用户管理按钮' },
  // API 权限
  { code: 'api:system:cpu', type: 'API', name: 'CPU 监控接口' },
  { code: 'api:system:memory', type: 'API', name: '内存监控接口' },
  { code: 'api:system:gpu', type: 'API', name: 'GPU 监控接口' },
  { code: 'api:system:network', type: 'API', name: '网络监控接口' },
  { code: 'api:system:storage', type: 'API', name: '存储监控接口' },
  { code: 'api:system:docker', type: 'API', name: 'Docker 监控接口' },
  { code: 'api:ollama:read', type: 'API', name: 'Ollama 读取接口' },
  { code: 'api:auth:profile', type: 'API', name: '用户资料接口' },
  // 阶段 3：AI 对话核心
  { code: 'menu:chat', type: 'MENU', name: 'AI 对话菜单' },
  { code: 'api:chat:read', type: 'API', name: '对话读取接口' },
  { code: 'api:chat:write', type: 'API', name: '对话写入接口' },
  { code: 'api:chat:delete', type: 'API', name: '对话删除接口' },
  { code: 'api:prompts:read', type: 'API', name: 'Prompt 模板接口' },
  { code: 'api:parameters:write', type: 'API', name: '生成参数设置接口' },
  // 阶段 4：AI Gateway / 模型管理
  { code: 'menu:ai-models', type: 'MENU', name: 'AI 模型管理菜单' },
  { code: 'api:ai:read', type: 'API', name: 'AI Gateway 读取接口' },
  { code: 'api:ai:write', type: 'API', name: 'AI Gateway 写入接口' },
  { code: 'api:ai:admin', type: 'API', name: 'AI Gateway 管理接口' },
];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code), // 全部权限
  ADMIN: PERMISSIONS.filter((p) => p.code !== 'button:user:manage').map((p) => p.code),
  USER: [
    'menu:home',
    'menu:status',
    'menu:chat',
    'button:status:refresh',
    'api:system:cpu',
    'api:system:memory',
    'api:system:network',
    'api:system:storage',
    'api:system:docker',
    'api:ollama:read',
    'api:auth:profile',
    'api:chat:read',
    'api:chat:write',
    'api:chat:delete',
    'api:prompts:read',
    'api:parameters:write',
    'api:ai:read',
  ],
};

// 阶段 3：默认模型配置（与 Ollama 实时清单合并）
const MODEL_CONFIGS = [
  { name: 'qwen3:8b', displayName: 'Qwen3 8B', isDefault: true, sortOrder: 1 },
  { name: 'deepseek-r1:8b', displayName: 'DeepSeek R1 8B', isDefault: false, sortOrder: 2 },
  { name: 'deepseek-coder:latest', displayName: 'DeepSeek Coder', isDefault: false, sortOrder: 3 },
];

// 阶段 3：内置 Prompt 模板（后续 AI Agent 直接调用）
const PROMPT_TEMPLATES = [
  {
    code: 'default.system',
    name: '默认系统提示',
    role: 'system',
    isDefault: true,
    content:
      'You are ZRH AI, a helpful assistant inside the ZRH ecosystem. Answer accurately and concisely. Use Markdown for structure, code blocks for code, and tables for comparisons when helpful.',
  },
  {
    code: 'role.coder',
    name: '编程助手',
    role: 'system',
    isDefault: false,
    content:
      'You are a senior software engineer assistant. Provide correct, runnable code with brief explanations. Prefer code blocks with language tags and keep prose minimal.',
  },
  {
    code: 'role.translator',
    name: '翻译助手',
    role: 'system',
    isDefault: false,
    content:
      'You are a professional translator for Chinese, English and Burmese. Translate faithfully, keep formatting, and note ambiguities briefly.',
  },
];

async function main() {
  // 1. 权限目录
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { name: p.name, type: p.type }, create: p });
  }
  console.log(`[seed] permissions: ${PERMISSIONS.length}`);

  // 2. 角色
  const roles = {};
  for (const [code, name] of [
    ['SUPER_ADMIN', '超级管理员'],
    ['ADMIN', '普通管理员'],
    ['USER', '普通用户'],
  ]) {
    roles[code] = await prisma.role.upsert({ where: { code }, update: { name }, create: { code, name } });
  }
  console.log('[seed] roles: SUPER_ADMIN / ADMIN / USER');

  // 3. 角色-权限映射（全量重建，幂等）
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roles[roleCode];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log('[seed] role-permission mappings rebuilt');

  // 3.5 阶段 3：模型配置（幂等，不覆盖用户后续修改的 enabled/isDefault）
  for (const m of MODEL_CONFIGS) {
    await prisma.modelConfig.upsert({
      where: { name: m.name },
      update: { displayName: m.displayName, sortOrder: m.sortOrder },
      create: { ...m, enabled: true },
    });
  }
  console.log(`[seed] model configs: ${MODEL_CONFIGS.length}`);

  // 3.7 阶段 4：AI Provider 与模型注册表
  const AI_PROVIDERS = [
    { code: 'ollama', name: 'Ollama', description: '本地 Ollama 服务', enabled: true, sortOrder: 1 },
    { code: 'openai', name: 'OpenAI', description: 'OpenAI API（预留）', enabled: false, sortOrder: 2 },
    { code: 'claude', name: 'Claude', description: 'Anthropic Claude（预留）', enabled: false, sortOrder: 3 },
    { code: 'gemini', name: 'Gemini', description: 'Google Gemini（预留）', enabled: false, sortOrder: 4 },
    { code: 'kimi', name: 'Kimi', description: 'Moonshot Kimi（预留）', enabled: false, sortOrder: 5 },
    { code: 'vllm', name: 'vLLM', description: 'vLLM（预留）', enabled: false, sortOrder: 6 },
    { code: 'sglang', name: 'SGLang', description: 'SGLang（预留）', enabled: false, sortOrder: 7 },
    { code: 'mock', name: 'Mock', description: '仅用于测试', enabled: false, sortOrder: 99 },
  ];
  for (const p of AI_PROVIDERS) {
    await prisma.aIProvider.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, enabled: p.enabled, sortOrder: p.sortOrder },
      create: p,
    });
  }
  console.log(`[seed] ai providers: ${AI_PROVIDERS.length}`);

  const ollama = await prisma.aIProvider.findUnique({ where: { code: 'ollama' } });
  const AI_MODELS = [
    { name: 'qwen3:8b', displayName: 'Qwen3 8B', isDefault: true, contextLength: 8192 },
    { name: 'deepseek-r1:8b', displayName: 'DeepSeek R1 8B', isDefault: false, contextLength: 8192 },
    { name: 'deepseek-coder:latest', displayName: 'DeepSeek Coder', isDefault: false, contextLength: 8192 },
  ];
  for (const m of AI_MODELS) {
    await prisma.aIModel.upsert({
      where: { providerCode_name: { providerCode: ollama.code, name: m.name } },
      update: { displayName: m.displayName, contextLength: m.contextLength },
      create: { ...m, providerCode: ollama.code, enabled: true },
    });
  }
  console.log(`[seed] ai models: ${AI_MODELS.length}`);

  const CAPABILITIES = [
    { code: 'code', name: '代码', description: '擅长编程与代码生成' },
    { code: 'reasoning', name: '推理', description: '擅长逻辑推理' },
    { code: 'multilingual', name: '多语言', description: '支持中文、英文、缅文等' },
  ];
  for (const c of CAPABILITIES) {
    await prisma.modelCapability.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: c,
    });
  }
  // 绑定能力标签
  const codeCap = await prisma.modelCapability.findUnique({ where: { code: 'code' } });
  const reasoningCap = await prisma.modelCapability.findUnique({ where: { code: 'reasoning' } });
  const multilingualCap = await prisma.modelCapability.findUnique({ where: { code: 'multilingual' } });
  const qwen = await prisma.aIModel.findUnique({ where: { providerCode_name: { providerCode: 'ollama', name: 'qwen3:8b' } } });
  const r1 = await prisma.aIModel.findUnique({ where: { providerCode_name: { providerCode: 'ollama', name: 'deepseek-r1:8b' } } });
  const coder = await prisma.aIModel.findUnique({ where: { providerCode_name: { providerCode: 'ollama', name: 'deepseek-coder:latest' } } });
  await prisma.aIModelCapability.upsert({ where: { modelId_capabilityId: { modelId: qwen.id, capabilityId: multilingualCap.id } }, update: {}, create: { modelId: qwen.id, capabilityId: multilingualCap.id } });
  await prisma.aIModelCapability.upsert({ where: { modelId_capabilityId: { modelId: r1.id, capabilityId: reasoningCap.id } }, update: {}, create: { modelId: r1.id, capabilityId: reasoningCap.id } });
  await prisma.aIModelCapability.upsert({ where: { modelId_capabilityId: { modelId: coder.id, capabilityId: codeCap.id } }, update: {}, create: { modelId: coder.id, capabilityId: codeCap.id } });
  console.log(`[seed] model capabilities: ${CAPABILITIES.length}`);

  // 3.6 阶段 3：内置 Prompt 模板
  for (const p of PROMPT_TEMPLATES) {
    await prisma.promptTemplate.upsert({
      where: { code: p.code },
      update: { name: p.name, role: p.role, content: p.content, isDefault: p.isDefault },
      create: { ...p, builtin: true },
    });
  }
  console.log(`[seed] prompt templates: ${PROMPT_TEMPLATES.length}`);

  // 4. 超级管理员
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    console.warn('[seed] ADMIN_INITIAL_PASSWORD 未设置，跳过超管创建');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { roleId: roles.SUPER_ADMIN.id, passwordHash },
    create: {
      username,
      displayName: 'ZRH Administrator',
      passwordHash,
      roleId: roles.SUPER_ADMIN.id,
    },
  });
  console.log(`[seed] super admin ready: ${username}`);
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
