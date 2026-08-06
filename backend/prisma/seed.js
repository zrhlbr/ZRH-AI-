/**
 * ZRH AI 数据库种子脚本（幂等，可重复执行）
 * - 角色：SUPER_ADMIN / ADMIN / USER / VIP / ENTERPRISE
 * - 权限目录：菜单 / 按钮 / API 三类（含 V1.2 User Center / Admin / Super Admin）
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
  // 阶段 5：Knowledge Platform
  { code: 'menu:knowledge', type: 'MENU', name: '知识平台菜单' },
  { code: 'api:knowledge:read', type: 'API', name: '知识平台读取接口' },
  { code: 'api:knowledge:write', type: 'API', name: '知识平台写入接口' },
  { code: 'api:knowledge:delete', type: 'API', name: '知识平台删除接口' },
  { code: 'api:knowledge:admin', type: 'API', name: '知识平台管理接口' },
  // 阶段 6：Enterprise RAG Engine
  { code: 'menu:rag', type: 'MENU', name: '企业 RAG 引擎菜单' },
  { code: 'api:rag:read', type: 'API', name: 'RAG 读取接口' },
  { code: 'api:rag:write', type: 'API', name: 'RAG 问答接口' },
  { code: 'api:rag:admin', type: 'API', name: 'RAG 管理接口' },
  // 阶段 7：Agent Center
  { code: 'menu:agents', type: 'MENU', name: 'Agent Center 菜单' },
  { code: 'api:agents:read', type: 'API', name: 'Agent 读取接口' },
  { code: 'api:agents:write', type: 'API', name: 'Agent 管理接口' },
  { code: 'api:agents:chat', type: 'API', name: 'Agent 对话接口' },
  { code: 'api:agents:admin', type: 'API', name: 'Agent 管理后台接口' },
  // 阶段 8：Tools & MCP
  { code: 'menu:tools', type: 'MENU', name: 'Tool Center 菜单' },
  { code: 'menu:mcp', type: 'MENU', name: 'MCP Center 菜单' },
  { code: 'api:tools:read', type: 'API', name: 'Tool 读取接口' },
  { code: 'api:tools:execute', type: 'API', name: 'Tool 执行接口' },
  { code: 'api:tools:admin', type: 'API', name: 'Tool 管理接口' },
  { code: 'api:mcp:read', type: 'API', name: 'MCP 读取接口' },
  { code: 'api:mcp:write', type: 'API', name: 'MCP 连接接口' },
  { code: 'api:mcp:admin', type: 'API', name: 'MCP 管理接口' },
  // 阶段 9：Workflow Engine
  { code: 'menu:workflows', type: 'MENU', name: 'Workflow Center 菜单' },
  { code: 'api:workflows:read', type: 'API', name: 'Workflow 读取接口' },
  { code: 'api:workflows:execute', type: 'API', name: 'Workflow 执行接口' },
  { code: 'api:workflows:admin', type: 'API', name: 'Workflow 管理接口' },
  // 阶段 10：Business Integration
  { code: 'menu:business', type: 'MENU', name: 'Business Dashboard 菜单' },
  { code: 'api:business:read', type: 'API', name: 'Business 读取接口' },
  { code: 'api:business:execute', type: 'API', name: 'Business 执行接口' },
  { code: 'api:business:admin', type: 'API', name: 'Business 管理接口' },
  // V1.2 P1：User Center / Admin / Super Admin
  { code: 'menu:account', type: 'MENU', name: '用户中心菜单' },
  { code: 'menu:admin', type: 'MENU', name: 'Admin 后台菜单' },
  { code: 'menu:superadmin', type: 'MENU', name: 'Super Admin 菜单' },
  { code: 'api:user-center:read', type: 'API', name: '用户中心读取' },
  { code: 'api:user-center:write', type: 'API', name: '用户中心写入' },
  { code: 'api:users:read', type: 'API', name: '用户管理读取' },
  { code: 'api:users:admin', type: 'API', name: '用户管理变更' },
  { code: 'api:roles:read', type: 'API', name: '角色权限读取' },
  { code: 'api:admin:read', type: 'API', name: 'Admin 读取' },
  { code: 'api:admin:write', type: 'API', name: 'Admin 写入' },
  { code: 'api:superadmin:read', type: 'API', name: 'Super Admin 读取' },
  { code: 'api:superadmin:write', type: 'API', name: 'Super Admin 写入' },
  // V1.2 P2：Developer Agent
  { code: 'menu:developer', type: 'MENU', name: 'Developer Agent 菜单' },
  { code: 'api:developer:read', type: 'API', name: 'Developer 读取' },
  { code: 'api:developer:chat', type: 'API', name: 'Developer 对话' },
  { code: 'api:developer:write', type: 'API', name: 'Developer 写入/审批' },
  { code: 'api:developer:terminal', type: 'API', name: 'Developer 终端' },
  { code: 'api:developer:admin', type: 'API', name: 'Developer 管理' },
];

/**
 * UX V4.0：USER / VIP 彻底消费者化 —— 仅保留首页、AI 对话、个人中心权限。
 * 访问 Developer / MCP / Workflow / Business / Server / System / Health / Monitor
 * 等企业接口时由 PermissionsGuard 返回 403 Forbidden。
 * 企业级权限仅保留在 ENTERPRISE / ADMIN / SUPER_ADMIN 角色。
 */
const USER_BASE_PERMISSIONS = [
  'menu:home',
  'menu:chat',
  'menu:account',
  'api:auth:profile',
  'api:user-center:read',
  'api:user-center:write',
  'api:chat:read',
  'api:chat:write',
  'api:chat:delete',
  'api:prompts:read',
  'api:parameters:write',
];

/** 企业角色保留全部企业能力（后台功能不变） */
const ENTERPRISE_PERMISSIONS = [
  ...USER_BASE_PERMISSIONS,
  'menu:status',
  'button:status:refresh',
  'api:system:cpu',
  'api:system:memory',
  'api:system:network',
  'api:system:storage',
  'api:system:docker',
  'api:ollama:read',
  'api:ai:read',
  'menu:knowledge',
  'api:knowledge:read',
  'api:knowledge:write',
  'api:knowledge:delete',
  'menu:rag',
  'api:rag:read',
  'api:rag:write',
  'menu:agents',
  'api:agents:read',
  'api:agents:chat',
  'menu:tools',
  'api:tools:read',
  'api:tools:execute',
  'menu:mcp',
  'api:mcp:read',
  'menu:workflows',
  'api:workflows:read',
  'api:workflows:execute',
  'menu:business',
  'api:business:read',
  'api:business:execute',
];

/**
 * Phase 0.5：专用 Developer 角色权限（赵总批准）。
 * ADMIN 不再继承任何 Developer 权限；ENTERPRISE / USER / VIP 一律 403。
 * DEVELOPER：工作台 + plan/diff/terminal/git（受控）。
 * DEV_LEAD：在 DEVELOPER 之上加管理（workspace 创建、危险操作确认）。
 */
const DEVELOPER_ROLE_PERMISSIONS = [
  ...USER_BASE_PERMISSIONS,
  'menu:developer',
  'api:developer:read',
  'api:developer:chat',
  'api:developer:write',
  'api:developer:terminal',
];
const DEV_LEAD_PERMISSIONS = [...DEVELOPER_ROLE_PERMISSIONS, 'api:developer:admin'];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code), // 全部权限
  ADMIN: PERMISSIONS.filter(
    (p) =>
      p.code !== 'button:user:manage' &&
      p.code !== 'menu:superadmin' &&
      !p.code.startsWith('api:superadmin:') &&
      // Phase 0.5: ADMIN 不再自动拥有 Developer 权限（默认 403）
      p.code !== 'menu:developer' &&
      !p.code.startsWith('api:developer:'),
  ).map((p) => p.code),
  USER: USER_BASE_PERMISSIONS,
  VIP: USER_BASE_PERMISSIONS,
  ENTERPRISE: ENTERPRISE_PERMISSIONS,
  DEVELOPER: DEVELOPER_ROLE_PERMISSIONS,
  DEV_LEAD: DEV_LEAD_PERMISSIONS,
};

// 阶段 3：默认模型配置（与 Ollama 实时清单合并）
const MODEL_CONFIGS = [
  { name: 'qwen3:8b', displayName: 'Qwen3 8B', isDefault: true, sortOrder: 1 },
  { name: 'qwen2.5-coder:7b', displayName: 'Qwen2.5 Coder 7B', isDefault: false, sortOrder: 2 },
  { name: 'deepseek-r1:8b', displayName: 'DeepSeek R1 8B', isDefault: false, sortOrder: 3 },
  { name: 'deepseek-coder:latest', displayName: 'DeepSeek Coder 1B (baseline only)', isDefault: false, sortOrder: 4 },
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
    ['VIP', 'VIP 用户'],
    ['ENTERPRISE', '企业用户'],
    ['DEVELOPER', 'Code Engineer 开发工程师'],
    ['DEV_LEAD', 'Code Engineer 开发负责人'],
  ]) {
    roles[code] = await prisma.role.upsert({ where: { code }, update: { name }, create: { code, name } });
  }
  console.log('[seed] roles: SUPER_ADMIN / ADMIN / USER / VIP / ENTERPRISE / DEVELOPER / DEV_LEAD');

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
    { name: 'qwen3:8b', displayName: 'Qwen3 8B', isDefault: true, contextLength: 40960 },
    { name: 'qwen2.5-coder:7b', displayName: 'Qwen2.5 Coder 7B', isDefault: false, contextLength: 32768 },
    { name: 'deepseek-r1:8b', displayName: 'DeepSeek R1 8B', isDefault: false, contextLength: 32768 },
    { name: 'deepseek-coder:latest', displayName: 'DeepSeek Coder 1B (baseline only)', isDefault: false, contextLength: 16384 },
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

  // 3.8 阶段 5：Embedding / Vector Provider 注册
  const EMBEDDING_PROVIDERS = [
    { code: 'ollama', name: 'Ollama Embedding', description: '本地 Ollama Embedding（nomic-embed-text）', enabled: true, isDefault: true, dimension: 768, config: { model: 'nomic-embed-text' } },
    { code: 'openai', name: 'OpenAI Embedding', description: 'OpenAI text-embedding（预留）', enabled: false, isDefault: false, dimension: 1536, config: { model: 'text-embedding-3-small' } },
    { code: 'bge', name: 'BGE Embedding', description: 'BAAI BGE（预留）', enabled: false, isDefault: false, dimension: 768, config: {} },
    { code: 'jina', name: 'Jina Embedding', description: 'Jina AI Embedding（预留）', enabled: false, isDefault: false, dimension: 768, config: {} },
  ];
  for (const p of EMBEDDING_PROVIDERS) {
    await prisma.embeddingProvider.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, enabled: p.enabled, isDefault: p.isDefault, dimension: p.dimension, config: p.config },
      create: p,
    });
  }
  console.log(`[seed] embedding providers: ${EMBEDDING_PROVIDERS.length}`);

  const VECTOR_PROVIDERS = [
    { code: 'pgvector', name: 'PostgreSQL JSONB', description: 'PostgreSQL JSONB 向量存储（阶段 5 基础）', enabled: true, isDefault: true, config: { table: 'knowledge_vectors' } },
    { code: 'milvus', name: 'Milvus', description: 'Milvus（预留）', enabled: false, isDefault: false, config: {} },
    { code: 'qdrant', name: 'Qdrant', description: 'Qdrant（预留）', enabled: false, isDefault: false, config: {} },
    { code: 'chroma', name: 'Chroma', description: 'Chroma（预留）', enabled: false, isDefault: false, config: {} },
    { code: 'faiss', name: 'FAISS', description: 'FAISS（预留）', enabled: false, isDefault: false, config: {} },
  ];
  for (const p of VECTOR_PROVIDERS) {
    await prisma.vectorProvider.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, enabled: p.enabled, isDefault: p.isDefault, config: p.config },
      create: p,
    });
  }
  console.log(`[seed] vector providers: ${VECTOR_PROVIDERS.length}`);

  // 3.9 阶段 6：部门 + 同义词/业务词
  const DEPARTMENTS = [
    { code: 'HQ', name: '总部' },
    { code: 'IT', name: '信息技术部' },
    { code: 'OPS', name: '运营部' },
  ];
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
  }
  console.log(`[seed] departments: ${DEPARTMENTS.length}`);

  const RAG_SYNONYMS = [
    { term: '知识库', synonyms: JSON.stringify(['知识平台', 'Knowledge', 'KB', '文档库']), language: 'zh-CN', category: 'synonym' },
    { term: 'RAG', synonyms: JSON.stringify(['检索增强生成', 'Retrieval Augmented Generation']), language: '*', category: 'abbreviation' },
    { term: 'ZRH', synonyms: JSON.stringify(['赵氏控股', 'ZRH Group']), language: '*', category: 'business' },
    { term: 'embedding', synonyms: JSON.stringify(['向量化', 'embed', '嵌入']), language: '*', category: 'synonym' },
    { term: 'KB', synonyms: JSON.stringify(['knowledge base', '知识库']), language: 'en-US', category: 'abbreviation' },
  ];
  for (const s of RAG_SYNONYMS) {
    await prisma.ragSynonym.upsert({
      where: { term_language_category: { term: s.term, language: s.language, category: s.category } },
      update: { synonyms: s.synonyms, enabled: true },
      create: s,
    });
  }
  console.log(`[seed] rag synonyms: ${RAG_SYNONYMS.length}`);

  // 3.10 阶段 7：Skills + 默认 Agents
  const AGENT_SKILLS = [
    { code: 'chat', name: 'Chat', description: '通用对话', category: 'core', enabled: true, reserved: false },
    { code: 'rag', name: 'RAG', description: '企业检索增强生成', category: 'core', enabled: true, reserved: false },
    { code: 'knowledge_search', name: 'Knowledge Search', description: '知识检索', category: 'core', enabled: true, reserved: false },
    { code: 'summarize', name: 'Summarize', description: '文档/对话总结', category: 'core', enabled: true, reserved: false },
    { code: 'translate', name: 'Translate', description: '中缅英翻译', category: 'core', enabled: true, reserved: false },
    { code: 'code', name: 'Code', description: '代码开发与分析', category: 'core', enabled: true, reserved: false },
    { code: 'image', name: 'Image', description: '图像能力（预留）', category: 'media', enabled: false, reserved: true },
    { code: 'video', name: 'Video', description: '视频能力（预留）', category: 'media', enabled: false, reserved: true },
    { code: 'tool', name: 'Tool', description: '外部工具（预留）', category: 'tool', enabled: false, reserved: true },
  ];
  for (const s of AGENT_SKILLS) {
    await prisma.agentSkill.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, category: s.category, enabled: s.enabled, reserved: s.reserved },
      create: s,
    });
  }
  console.log(`[seed] agent skills: ${AGENT_SKILLS.length}`);

  const DEFAULT_AGENTS = [
    {
      code: 'developer',
      name: 'Developer Agent',
      description: '代码开发、代码分析与 Bug 修复',
      avatar: 'code',
      systemPrompt:
        'You are ZRH Developer Agent. Help with coding, code review, debugging and architecture. Prefer concise, correct answers with Markdown code blocks.',
      defaultModel: 'ollama:deepseek-coder:latest',
      skills: ['chat', 'code', 'summarize'],
      sortOrder: 1,
    },
    {
      code: 'knowledge',
      name: 'Knowledge Agent',
      description: '企业知识查询、RAG 与文档总结',
      avatar: 'book',
      systemPrompt:
        'You are ZRH Knowledge Agent. Answer from enterprise knowledge via RAG when available. Cite sources as [#n]. Summarize documents clearly.',
      defaultModel: null,
      defaultKnowledgeScope: 'all',
      skills: ['chat', 'rag', 'knowledge_search', 'summarize'],
      sortOrder: 2,
    },
    {
      code: 'translation',
      name: 'Translation Agent',
      description: '中文 / 缅文 / 英文翻译',
      avatar: 'languages',
      systemPrompt:
        'You are ZRH Translation Agent for Chinese, Burmese and English. Translate faithfully, preserve formatting, and note ambiguities briefly.',
      defaultModel: null,
      skills: ['chat', 'translate'],
      sortOrder: 3,
    },
    {
      code: 'document',
      name: 'Document Agent',
      description: '文档解析、分类与整理',
      avatar: 'file',
      systemPrompt:
        'You are ZRH Document Agent. Help parse, classify, organize and extract structure from documents. Be systematic and structured.',
      defaultModel: null,
      skills: ['chat', 'summarize', 'knowledge_search'],
      sortOrder: 4,
    },
    {
      code: 'assistant',
      name: 'Assistant Agent',
      description: '通用聊天与任务协助',
      avatar: 'sparkles',
      systemPrompt:
        'You are ZRH Assistant Agent. Help with general chat and task assistance inside the ZRH ecosystem. Be concise, friendly and accurate.',
      defaultModel: null,
      skills: ['chat', 'summarize'],
      sortOrder: 5,
    },
  ];
  for (const a of DEFAULT_AGENTS) {
    const agent = await prisma.agent.upsert({
      where: { code: a.code },
      update: {
        name: a.name,
        description: a.description,
        avatar: a.avatar,
        systemPrompt: a.systemPrompt,
        defaultModel: a.defaultModel,
        defaultKnowledgeScope: a.defaultKnowledgeScope ?? null,
        status: 'active',
        enabled: true,
        builtin: true,
        version: '1.0.0',
        sortOrder: a.sortOrder,
      },
      create: {
        code: a.code,
        name: a.name,
        description: a.description,
        avatar: a.avatar,
        systemPrompt: a.systemPrompt,
        defaultModel: a.defaultModel,
        defaultKnowledgeScope: a.defaultKnowledgeScope ?? null,
        status: 'active',
        enabled: true,
        builtin: true,
        version: '1.0.0',
        sortOrder: a.sortOrder,
      },
    });
    for (const skillCode of a.skills) {
      const skill = await prisma.agentSkill.findUnique({ where: { code: skillCode } });
      if (!skill) continue;
      await prisma.agentSkillBinding.upsert({
        where: { agentId_skillId: { agentId: agent.id, skillId: skill.id } },
        update: {},
        create: { agentId: agent.id, skillId: skill.id },
      });
    }
  }
  console.log(`[seed] default agents: ${DEFAULT_AGENTS.length}`);

  // 3.11 阶段 8：Tool categories + builtin tools + MCP connectors
  const TOOL_CATEGORIES = [
    { code: 'knowledge', name: 'Knowledge', description: '知识与检索', sortOrder: 1 },
    { code: 'language', name: 'Language', description: '语言处理', sortOrder: 2 },
    { code: 'developer', name: 'Developer', description: '开发工具', sortOrder: 3 },
    { code: 'system', name: 'System', description: '系统与运维', sortOrder: 4 },
    { code: 'data', name: 'Data', description: '数据查询', sortOrder: 5 },
  ];
  for (const c of TOOL_CATEGORIES) {
    await prisma.toolCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
      create: c,
    });
  }
  const cat = Object.fromEntries(
    (await prisma.toolCategory.findMany()).map((c) => [c.code, c.id]),
  );

  const BUILTIN_TOOLS = [
    { code: 'knowledge_search', name: 'Knowledge Search', category: 'knowledge', executorCode: 'knowledge_search', description: '企业知识关键词/混合检索', inputSchema: { query: 'string', topK: 'number?' } },
    { code: 'rag_search', name: 'RAG Search', category: 'knowledge', executorCode: 'rag_search', description: 'RAG 检索（含重排引用）', inputSchema: { query: 'string', mode: 'string?' } },
    { code: 'document_parser', name: 'Document Parser', category: 'knowledge', executorCode: 'document_parser', description: '解析文本/Markdown 内容', inputSchema: { content: 'string', filename: 'string?' } },
    { code: 'translation', name: 'Translation', category: 'language', executorCode: 'translation', description: '中缅英翻译', inputSchema: { text: 'string', targetLang: 'string' } },
    { code: 'code_execute', name: 'Code Execute', category: 'developer', executorCode: 'code_execute', description: '沙箱表达式执行（受限）', inputSchema: { expression: 'string' }, timeoutMs: 3000 },
    { code: 'file_manager', name: 'File Manager', category: 'system', executorCode: 'file_manager', description: '知识库存储目录只读文件操作', inputSchema: { action: 'list|exists|readMeta', path: 'string?' } },
    { code: 'http_request', name: 'HTTP Request', category: 'system', executorCode: 'http_request', description: '受控 HTTP 请求（白名单）', inputSchema: { url: 'string', method: 'GET?' } },
    { code: 'database_query', name: 'Database Query', category: 'data', executorCode: 'database_query', description: '只读统计查询', inputSchema: { metric: 'string' } },
    { code: 'system_health', name: 'System Health', category: 'system', executorCode: 'system_health', description: '系统健康快照', inputSchema: {} },
    { code: 'calculator', name: 'Calculator', category: 'developer', executorCode: 'calculator', description: '安全计算器', inputSchema: { expression: 'string' } },
  ];
  for (const t of BUILTIN_TOOLS) {
    await prisma.toolDefinition.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        categoryId: cat[t.category],
        enabled: true,
        builtin: true,
        executorCode: t.executorCode,
        inputSchema: t.inputSchema,
        timeoutMs: t.timeoutMs ?? 15000,
        version: '1.0.0',
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        categoryId: cat[t.category],
        enabled: true,
        builtin: true,
        executorCode: t.executorCode,
        inputSchema: t.inputSchema,
        timeoutMs: t.timeoutMs ?? 15000,
        version: '1.0.0',
        maxRetries: 1,
      },
    });
  }
  console.log(`[seed] builtin tools: ${BUILTIN_TOOLS.length}`);

  // P2 Developer Agent: filesystem/git via Dev Runner; docker/postgres/github mediated by Gateway
  const MCP_SERVERS = [
    {
      code: 'filesystem',
      name: 'Filesystem',
      description: 'Workspace filesystem via ZRH Dev Runner',
      transport: 'runner',
      enabled: true,
      status: 'online',
      reserved: false,
    },
    {
      code: 'git',
      name: 'Git',
      description: 'Workspace git via ZRH Dev Runner (dangerous ops blocked)',
      transport: 'runner',
      enabled: true,
      status: 'online',
      reserved: false,
    },
    {
      code: 'docker',
      name: 'Docker',
      description: 'Docker status via System module (no docker.sock on runner)',
      transport: 'gateway',
      enabled: true,
      status: 'online',
      reserved: false,
    },
    {
      code: 'postgresql',
      name: 'PostgreSQL',
      description: 'Read-only PostgreSQL metadata via Gateway',
      transport: 'gateway',
      enabled: true,
      status: 'online',
      reserved: false,
    },
    {
      code: 'github',
      name: 'GitHub',
      description: 'GitHub REST via Gateway (requires GITHUB_TOKEN)',
      transport: 'gateway',
      enabled: true,
      status: 'online',
      reserved: false,
    },
    { code: 'gitlab', name: 'GitLab', description: 'GitLab MCP Connector（预留）' },
    { code: 'mysql', name: 'MySQL', description: 'MySQL MCP Connector（预留）' },
    { code: 'redis', name: 'Redis', description: 'Redis MCP Connector（预留）' },
    { code: 'ollama', name: 'Ollama', description: 'Ollama MCP Connector（预留）' },
    { code: 'web_search', name: 'Web Search', description: 'Web Search MCP（预留）' },
    { code: 'browser', name: 'Browser', description: 'Browser MCP（预留）' },
  ];
  for (const s of MCP_SERVERS) {
    const transport = s.transport || 'stub';
    const enabled = s.enabled === true;
    const reserved = s.reserved !== false && !enabled;
    const status = s.status || (enabled ? 'online' : 'reserved');
    await prisma.mcpServer.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        transport,
        enabled,
        status,
        reserved,
        builtin: true,
        version: '0.1.0',
      },
      create: {
        code: s.code,
        name: s.name,
        description: s.description,
        transport,
        enabled,
        status,
        reserved,
        builtin: true,
        version: '0.1.0',
      },
    });
  }
  console.log(`[seed] mcp servers: ${MCP_SERVERS.length}`);

  // 3.12 阶段 9：Workflow categories + default templates
  const linearGraph = (steps) => {
    const nodes = [{ id: 'start', type: 'start', label: 'Start', config: {} }];
    const edges = [];
    let prev = 'start';
    steps.forEach((step, i) => {
      const id = step.id || `n${i + 1}`;
      nodes.push({
        id,
        type: step.type,
        label: step.label,
        config: step.config || {},
      });
      edges.push({ id: `e_${prev}_${id}`, from: prev, to: id });
      prev = id;
    });
    nodes.push({ id: 'end', type: 'end', label: 'End', config: {} });
    edges.push({ id: `e_${prev}_end`, from: prev, to: 'end' });
    return { nodes, edges };
  };

  const WF_CATEGORIES = [
    { code: 'knowledge', name: 'Knowledge', description: '知识与文档', sortOrder: 1 },
    { code: 'language', name: 'Language', description: '语言与翻译', sortOrder: 2 },
    { code: 'agent', name: 'Agent', description: 'Agent 协作', sortOrder: 3 },
    { code: 'ops', name: 'Operations', description: '运维巡检', sortOrder: 4 },
    { code: 'integration', name: 'Integration', description: '工具与 MCP', sortOrder: 5 },
  ];
  for (const c of WF_CATEGORIES) {
    await prisma.workflowCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
      create: c,
    });
  }
  const wfCat = Object.fromEntries(
    (await prisma.workflowCategory.findMany()).map((c) => [c.code, c.id]),
  );

  const WF_TEMPLATES = [
    {
      code: 'tpl_knowledge_search',
      name: '知识检索流程',
      category: 'knowledge',
      description: '经 Tool Manager 执行 Knowledge Search',
      graph: linearGraph([
        { type: 'tool', label: 'Knowledge Search', config: { toolCode: 'knowledge_search', args: { query: '{{input.query}}', topK: 5 } } },
      ]),
      variables: { defaults: { query: 'overview' } },
    },
    {
      code: 'tpl_document_parse',
      name: '文档解析流程',
      category: 'knowledge',
      description: '经 Tool Manager 解析文档内容',
      graph: linearGraph([
        { type: 'tool', label: 'Document Parser', config: { toolCode: 'document_parser', args: { content: '{{input.content}}', filename: 'note.md' } } },
      ]),
      variables: { defaults: { content: '# Hello ZRH' } },
    },
    {
      code: 'tpl_translation',
      name: '多语言翻译流程',
      category: 'language',
      description: 'Agent Center Translation Agent → Tool Manager',
      graph: linearGraph([
        { type: 'agent', label: 'Translation Agent', config: { agentCode: 'translation', message: '{{input.text}}' } },
      ]),
      variables: { defaults: { text: '你好，世界' } },
    },
    {
      code: 'tpl_agent_collab',
      name: 'Agent 协作流程',
      category: 'agent',
      description: 'Assistant → Knowledge 协作（经 Agent Center）',
      graph: linearGraph([
        { type: 'agent', label: 'Assistant', config: { agentCode: 'assistant', message: '{{input.message}}' } },
        { type: 'agent', label: 'Knowledge', config: { agentCode: 'knowledge', message: '{{input.message}}' } },
      ]),
      variables: { defaults: { message: '总结企业知识库能力' } },
    },
    {
      code: 'tpl_rag_ask',
      name: 'RAG 问答流程',
      category: 'knowledge',
      description: '经 Tool Manager 执行 RAG Search',
      graph: linearGraph([
        { type: 'tool', label: 'RAG Search', config: { toolCode: 'rag_search', args: { query: '{{input.query}}', mode: 'hybrid' } } },
      ]),
      variables: { defaults: { query: '什么是 ZRH AI' } },
    },
    {
      code: 'tpl_document_import',
      name: '文档导入流程',
      category: 'knowledge',
      description: 'File Manager → Document Parser（经 Tool Manager）',
      graph: linearGraph([
        { type: 'tool', label: 'File Manager', config: { toolCode: 'file_manager', args: { action: 'list', path: '' } } },
        { type: 'tool', label: 'Document Parser', config: { toolCode: 'document_parser', args: { content: '{{input.content}}', filename: 'import.md' } } },
      ]),
      variables: { defaults: { content: '# Import document' } },
    },
    {
      code: 'tpl_embedding_rebuild',
      name: 'Embedding 重建流程',
      category: 'ops',
      description: '健康检查 + 只读统计（经 Tool Manager，不直连向量库）',
      graph: linearGraph([
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
        { type: 'tool', label: 'DB Overview', config: { toolCode: 'database_query', args: { metric: 'overview' } } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'tpl_toolchain',
      name: '工具链调用流程',
      category: 'integration',
      description: 'Calculator → System Health 工具链',
      graph: linearGraph([
        { type: 'tool', label: 'Calculator', config: { toolCode: 'calculator', args: { expression: '{{input.expression}}' } } },
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
      ]),
      variables: { defaults: { expression: '1+2*3' } },
    },
    {
      code: 'tpl_mcp_execute',
      name: 'MCP 工具执行流程',
      category: 'integration',
      description: '经 MCP Gateway stub 执行（不直连外部）',
      graph: linearGraph([
        { type: 'mcp', label: 'Filesystem MCP', config: { serverCode: 'filesystem', action: 'list', autoEnable: true } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'tpl_health_patrol',
      name: '系统健康巡检流程',
      category: 'ops',
      description: '健康检查 + 条件分支 + 只读统计',
      graph: {
        nodes: [
          { id: 'start', type: 'start', label: 'Start', config: {} },
          { id: 'health', type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
          { id: 'cond', type: 'condition', label: 'Health OK?', config: { expression: 'vars.lastOk == true', trueTo: 'db', falseTo: 'end' } },
          { id: 'db', type: 'tool', label: 'DB Overview', config: { toolCode: 'database_query', args: { metric: 'overview' } } },
          { id: 'end', type: 'end', label: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'health' },
          { id: 'e2', from: 'health', to: 'cond' },
          { id: 'e3', from: 'cond', to: 'db', when: 'true' },
          { id: 'e4', from: 'cond', to: 'end', when: 'false' },
          { id: 'e5', from: 'db', to: 'end' },
        ],
      },
      variables: { defaults: {} },
    },
  ];

  for (const t of WF_TEMPLATES) {
    await prisma.workflowDefinition.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        categoryId: wfCat[t.category],
        enabled: true,
        builtin: true,
        template: true,
        status: 'active',
        graph: t.graph,
        variables: t.variables,
        version: '1.0.0',
        timeoutMs: 120000,
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        categoryId: wfCat[t.category],
        enabled: true,
        builtin: true,
        template: true,
        status: 'active',
        graph: t.graph,
        variables: t.variables,
        version: '1.0.0',
        timeoutMs: 120000,
        maxRetries: 0,
      },
    });
  }
  console.log(`[seed] workflow templates: ${WF_TEMPLATES.length}`);

  // 3.13 阶段 10：Business workflows + systems + connectors
  if (!wfCat.integration) {
    await prisma.workflowCategory.upsert({
      where: { code: 'integration' },
      update: { name: 'Integration' },
      create: { code: 'integration', name: 'Integration', description: '业务集成', sortOrder: 5 },
    });
    Object.assign(
      wfCat,
      Object.fromEntries((await prisma.workflowCategory.findMany()).map((c) => [c.code, c.id])),
    );
  }

  const BIZ_WF = [
    {
      code: 'biz_accounting_qa',
      name: '会计系统财务问答',
      category: 'knowledge',
      description: 'Accounting → Workflow → Agent/Knowledge',
      graph: linearGraph([
        { type: 'agent', label: 'Knowledge Agent', config: { agentCode: 'knowledge', message: '{{input.query}}' } },
        { type: 'tool', label: 'RAG Search', config: { toolCode: 'rag_search', args: { query: '{{input.query}}' } } },
      ]),
      variables: { defaults: { query: '本月收支概况' } },
    },
    {
      code: 'biz_accounting_query',
      name: '会计系统只读查询',
      category: 'ops',
      description: '收支/库存/商品只读查询门禁流程',
      graph: linearGraph([
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
        { type: 'tool', label: 'DB Overview', config: { toolCode: 'database_query', args: { metric: 'overview' } } },
      ]),
      variables: { defaults: { metric: 'balance' } },
    },
    {
      code: 'biz_accounting_write_approval',
      name: '会计系统写入审批',
      category: 'ops',
      description: '资金写操作必须审批',
      graph: linearGraph([
        { type: 'approval', label: 'Finance Approval', config: { message: 'Approve accounting write?' } },
        { type: 'tool', label: 'Audit Health', config: { toolCode: 'system_health', args: {} } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'biz_zrhpay_query',
      name: 'ZRHPay 只读查询',
      category: 'integration',
      description: '钱包/汇率/交易只读',
      graph: linearGraph([
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
        { type: 'mcp', label: 'Redis MCP stub', config: { serverCode: 'redis', action: 'ping', autoEnable: true } },
      ]),
      variables: { defaults: { queryType: 'wallet' } },
    },
    {
      code: 'biz_zrhpay_write_approval',
      name: 'ZRHPay 资金写审批',
      category: 'integration',
      description: '资金写操作预留审批',
      graph: linearGraph([
        { type: 'approval', label: 'Payment Approval', config: { message: 'Approve ZRHPay write?' } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'biz_router_status',
      name: 'Router OS 状态巡检',
      category: 'ops',
      description: '设备/CPU/内存/网络只读状态',
      graph: linearGraph([
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
        { type: 'mcp', label: 'Docker MCP stub', config: { serverCode: 'docker', action: 'status', autoEnable: true } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'biz_router_config_approval',
      name: 'Router OS 配置审批',
      category: 'ops',
      description: '配置修改必须审批，禁止直改',
      graph: linearGraph([
        { type: 'approval', label: 'Router Config Approval', config: { message: 'Approve router config change?' } },
        { type: 'tool', label: 'Health Recheck', config: { toolCode: 'system_health', args: {} } },
      ]),
      variables: { defaults: {} },
    },
    {
      code: 'biz_knowledge_search',
      name: '业务知识检索',
      category: 'knowledge',
      description: 'Knowledge Platform 统一知识来源',
      graph: linearGraph([
        { type: 'tool', label: 'Knowledge Search', config: { toolCode: 'knowledge_search', args: { query: '{{input.query}}', topK: 5 } } },
      ]),
      variables: { defaults: { query: '企业制度' } },
    },
    {
      code: 'biz_document_center',
      name: '文档中心流程',
      category: 'knowledge',
      description: '制度/合同/说明书/技术文档',
      graph: linearGraph([
        { type: 'tool', label: 'File Manager', config: { toolCode: 'file_manager', args: { action: 'list', path: '' } } },
        { type: 'tool', label: 'Document Parser', config: { toolCode: 'document_parser', args: { content: '{{input.content}}', filename: 'policy.md' } } },
      ]),
      variables: { defaults: { content: '# 制度文档' } },
    },
    {
      code: 'biz_platform_health',
      name: '业务平台健康巡检',
      category: 'ops',
      description: 'Dashboard 健康聚合流程',
      graph: linearGraph([
        { type: 'tool', label: 'System Health', config: { toolCode: 'system_health', args: {} } },
        { type: 'tool', label: 'Calculator', config: { toolCode: 'calculator', args: { expression: '1+1' } } },
      ]),
      variables: { defaults: {} },
    },
  ];

  for (const t of BIZ_WF) {
    await prisma.workflowDefinition.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        categoryId: wfCat[t.category] ?? wfCat.ops,
        enabled: true,
        builtin: true,
        template: true,
        status: 'active',
        graph: t.graph,
        variables: t.variables,
        version: '1.0.0',
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        categoryId: wfCat[t.category] ?? wfCat.ops,
        enabled: true,
        builtin: true,
        template: true,
        status: 'active',
        graph: t.graph,
        variables: t.variables,
        version: '1.0.0',
        timeoutMs: 120000,
        maxRetries: 0,
      },
    });
  }
  console.log(`[seed] business workflows: ${BIZ_WF.length}`);

  await prisma.company.upsert({
    where: { code: 'ZRH' },
    update: { name: 'ZRH Group', enabled: true },
    create: { code: 'ZRH', name: 'ZRH Group', enabled: true },
  });

  const BIZ_SYSTEMS = [
    {
      code: 'zrh_accounting',
      name: 'ZRH Accounting System',
      kind: 'accounting',
      description: '财务问答 / 收支 / 库存 / 商品 / 统计 / 报表（写操作审批）',
      connector: { code: 'accounting_stub', name: 'Accounting Connector', transport: 'stub' },
      actions: [
        { actionCode: 'qa', workflowCode: 'biz_accounting_qa', name: '财务问答', isDefault: true, readOnly: true },
        { actionCode: 'balance_query', workflowCode: 'biz_accounting_query', name: '收支查询', readOnly: true },
        { actionCode: 'inventory_query', workflowCode: 'biz_accounting_query', name: '库存查询', readOnly: true },
        { actionCode: 'product_query', workflowCode: 'biz_accounting_query', name: '商品查询', readOnly: true },
        { actionCode: 'stats', workflowCode: 'biz_accounting_query', name: '统计分析', readOnly: true },
        { actionCode: 'report', workflowCode: 'biz_accounting_query', name: '报表生成', readOnly: true },
        { actionCode: 'write', workflowCode: 'biz_accounting_write_approval', name: '资金写入（审批）', requiresApproval: true, readOnly: false },
      ],
    },
    {
      code: 'zrhpay',
      name: 'ZRHPay',
      kind: 'payment',
      description: '钱包 / 汇率 / 交易 / 用户 / 商户只读；资金写审批',
      connector: { code: 'zrhpay_stub', name: 'ZRHPay Connector', transport: 'stub' },
      actions: [
        { actionCode: 'wallet_query', workflowCode: 'biz_zrhpay_query', name: '钱包查询', isDefault: true, readOnly: true },
        { actionCode: 'rate_query', workflowCode: 'biz_zrhpay_query', name: '汇率查询', readOnly: true },
        { actionCode: 'tx_query', workflowCode: 'biz_zrhpay_query', name: '交易查询', readOnly: true },
        { actionCode: 'user_query', workflowCode: 'biz_zrhpay_query', name: '用户信息查询', readOnly: true },
        { actionCode: 'merchant_query', workflowCode: 'biz_zrhpay_query', name: '商户信息查询', readOnly: true },
        { actionCode: 'write', workflowCode: 'biz_zrhpay_write_approval', name: '资金写入（审批）', requiresApproval: true, readOnly: false },
      ],
    },
    {
      code: 'zrh_router',
      name: 'ZRH Router OS',
      kind: 'router',
      description: '设备状态巡检；配置修改必须审批',
      connector: { code: 'router_stub', name: 'Router OS Connector', transport: 'stub' },
      actions: [
        { actionCode: 'device_status', workflowCode: 'biz_router_status', name: '设备状态', isDefault: true, readOnly: true },
        { actionCode: 'cpu', workflowCode: 'biz_router_status', name: 'CPU', readOnly: true },
        { actionCode: 'memory', workflowCode: 'biz_router_status', name: '内存', readOnly: true },
        { actionCode: 'temperature', workflowCode: 'biz_router_status', name: '温度', readOnly: true },
        { actionCode: 'clients', workflowCode: 'biz_router_status', name: '在线终端', readOnly: true },
        { actionCode: 'network', workflowCode: 'biz_router_status', name: '网络状态', readOnly: true },
        { actionCode: 'vpn', workflowCode: 'biz_router_status', name: 'VPN 状态', readOnly: true },
        { actionCode: 'logs', workflowCode: 'biz_router_status', name: '系统日志', readOnly: true },
        { actionCode: 'config_change', workflowCode: 'biz_router_config_approval', name: '配置修改（审批）', requiresApproval: true, readOnly: false },
      ],
    },
    {
      code: 'knowledge',
      name: 'Knowledge Platform',
      kind: 'knowledge',
      description: '全业务统一知识来源',
      connector: { code: 'knowledge_bridge', name: 'Knowledge Bridge', transport: 'tool' },
      actions: [
        { actionCode: 'search', workflowCode: 'biz_knowledge_search', name: '知识检索', isDefault: true, readOnly: true },
      ],
    },
    {
      code: 'document',
      name: 'Document Center',
      kind: 'document',
      description: '制度 / 合同 / 说明书 / 技术文档',
      connector: { code: 'document_bridge', name: 'Document Bridge', transport: 'tool' },
      actions: [
        { actionCode: 'manage', workflowCode: 'biz_document_center', name: '文档管理', isDefault: true, readOnly: true },
      ],
    },
  ];

  for (const s of BIZ_SYSTEMS) {
    const system = await prisma.businessSystem.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        kind: s.kind,
        enabled: true,
        status: 'online',
        version: '1.0.0',
        readOnlyDefault: true,
        writeRequiresApproval: true,
        companyCode: 'ZRH',
      },
      create: {
        code: s.code,
        name: s.name,
        description: s.description,
        kind: s.kind,
        enabled: true,
        status: 'online',
        version: '1.0.0',
        readOnlyDefault: true,
        writeRequiresApproval: true,
        companyCode: 'ZRH',
      },
    });
    await prisma.businessConnector.upsert({
      where: { systemId_code: { systemId: system.id, code: s.connector.code } },
      update: {
        name: s.connector.name,
        transport: s.connector.transport,
        enabled: true,
        status: 'ready',
        healthStatus: 'healthy',
      },
      create: {
        systemId: system.id,
        code: s.connector.code,
        name: s.connector.name,
        transport: s.connector.transport,
        enabled: true,
        status: 'ready',
        healthStatus: 'healthy',
      },
    });
    for (const a of s.actions) {
      await prisma.businessSystemWorkflow.upsert({
        where: { systemId_actionCode: { systemId: system.id, actionCode: a.actionCode } },
        update: {
          workflowCode: a.workflowCode,
          name: a.name,
          isDefault: a.isDefault ?? false,
          requiresApproval: a.requiresApproval ?? false,
          readOnly: a.readOnly ?? true,
        },
        create: {
          systemId: system.id,
          actionCode: a.actionCode,
          workflowCode: a.workflowCode,
          name: a.name,
          isDefault: a.isDefault ?? false,
          requiresApproval: a.requiresApproval ?? false,
          readOnly: a.readOnly ?? true,
        },
      });
    }
  }
  console.log(`[seed] business systems: ${BIZ_SYSTEMS.length}`);

  // 4. Mail Center V1.0 — default SMTP/code policy keys + multilingual templates
  const MAIL_DEFAULTS = [
    { key: 'mail.smtp.host', value: '', group: 'smtp', secret: false },
    { key: 'mail.smtp.port', value: '587', group: 'smtp', secret: false },
    { key: 'mail.smtp.username', value: '', group: 'smtp', secret: false },
    { key: 'mail.smtp.password', value: '', group: 'smtp', secret: true },
    { key: 'mail.smtp.encryption', value: 'starttls', group: 'smtp', secret: false },
    { key: 'mail.smtp.fromEmail', value: '', group: 'smtp', secret: false },
    { key: 'mail.smtp.fromName', value: 'ZRH AI', group: 'smtp', secret: false },
    { key: 'mail.smtp.replyTo', value: '', group: 'smtp', secret: false },
    { key: 'mail.smtp.connectionTimeoutMs', value: '15000', group: 'smtp', secret: false },
    { key: 'mail.code.length', value: '6', group: 'mail', secret: false },
    { key: 'mail.code.ttlSeconds', value: '600', group: 'mail', secret: false },
    { key: 'mail.code.intervalSeconds', value: '60', group: 'mail', secret: false },
    { key: 'mail.code.dailyLimit', value: '20', group: 'mail', secret: false },
    { key: 'mail.code.maxRetries', value: '3', group: 'mail', secret: false },
  ];
  for (const c of MAIL_DEFAULTS) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    });
  }

  const tplVars = JSON.stringify(['code', 'ttlMinutes', 'appName', 'username', 'message']);
  const mailTemplates = [
    ['register_code', {
      'zh-CN': ['{{appName}} 注册验证码', '<p>您的注册验证码是 <strong>{{code}}</strong>，{{ttlMinutes}} 分钟内有效。</p>', '您的注册验证码是 {{code}}，{{ttlMinutes}} 分钟内有效。'],
      'en-US': ['{{appName}} registration code', '<p>Your registration code is <strong>{{code}}</strong>. Valid for {{ttlMinutes}} minutes.</p>', 'Your registration code is {{code}}. Valid for {{ttlMinutes}} minutes.'],
      'my-MM': ['{{appName}} registration code (my)', '<p>Code <strong>{{code}}</strong> ({{ttlMinutes}} min).</p>', 'Code {{code}} ({{ttlMinutes}} min).'],
    }],
    ['login_code', {
      'zh-CN': ['{{appName}} 登录验证码', '<p>您的登录验证码是 <strong>{{code}}</strong>，{{ttlMinutes}} 分钟内有效。</p>', '您的登录验证码是 {{code}}，{{ttlMinutes}} 分钟内有效。'],
      'en-US': ['{{appName}} login code', '<p>Your login code is <strong>{{code}}</strong>. Valid for {{ttlMinutes}} minutes.</p>', 'Your login code is {{code}}. Valid for {{ttlMinutes}} minutes.'],
      'my-MM': ['{{appName}} login code (my)', '<p>Code <strong>{{code}}</strong> ({{ttlMinutes}} min).</p>', 'Code {{code}} ({{ttlMinutes}} min).'],
    }],
    ['forgot_password', {
      'zh-CN': ['{{appName}} 密码重置', '<p>您好 {{username}}，重置令牌：<strong>{{code}}</strong>，{{ttlMinutes}} 分钟内有效。</p>', '您好 {{username}}，重置令牌：{{code}}，{{ttlMinutes}} 分钟内有效。'],
      'en-US': ['{{appName}} password reset', '<p>Hi {{username}}, reset token: <strong>{{code}}</strong>. Valid for {{ttlMinutes}} minutes.</p>', 'Hi {{username}}, reset token: {{code}}. Valid for {{ttlMinutes}} minutes.'],
      'my-MM': ['{{appName}} password reset (my)', '<p>{{username}}: <strong>{{code}}</strong> ({{ttlMinutes}} min).</p>', '{{username}}: {{code}} ({{ttlMinutes}} min).'],
    }],
    ['change_email', {
      'zh-CN': ['{{appName}} 邮箱变更验证', '<p>验证码 <strong>{{code}}</strong>，{{ttlMinutes}} 分钟内有效。</p>', '验证码 {{code}}，{{ttlMinutes}} 分钟内有效。'],
      'en-US': ['{{appName}} email change verification', '<p>Code <strong>{{code}}</strong>, valid {{ttlMinutes}} minutes.</p>', 'Code {{code}}, valid {{ttlMinutes}} minutes.'],
      'my-MM': ['{{appName}} email change (my)', '<p>Code <strong>{{code}}</strong> ({{ttlMinutes}} min).</p>', 'Code {{code}} ({{ttlMinutes}} min).'],
    }],
    ['system_notice', {
      'zh-CN': ['{{appName}} 系统通知', '<p>{{message}}</p>', '{{message}}'],
      'en-US': ['{{appName}} system notice', '<p>{{message}}</p>', '{{message}}'],
      'my-MM': ['{{appName}} system notice (my)', '<p>{{message}}</p>', '{{message}}'],
    }],
    ['welcome', {
      'zh-CN': ['欢迎使用 {{appName}}', '<p>欢迎 {{username}} 加入 {{appName}}。</p>', '欢迎 {{username}} 加入 {{appName}}。'],
      'en-US': ['Welcome to {{appName}}', '<p>Welcome {{username}} to {{appName}}.</p>', 'Welcome {{username}} to {{appName}}.'],
      'my-MM': ['Welcome to {{appName}} (my)', '<p>Welcome {{username}}.</p>', 'Welcome {{username}}.'],
    }],
    ['invite_user', {
      'zh-CN': ['{{appName}} 用户邀请', '<p>您被邀请加入 {{appName}}。邀请码：{{code}}</p>', '您被邀请加入 {{appName}}。邀请码：{{code}}'],
      'en-US': ['{{appName}} invitation', '<p>You are invited to {{appName}}. Code: {{code}}</p>', 'You are invited to {{appName}}. Code: {{code}}'],
      'my-MM': ['{{appName}} invitation (my)', '<p>Code: {{code}}</p>', 'Code: {{code}}'],
    }],
    ['invite_employee', {
      'zh-CN': ['{{appName}} 员工邀请', '<p>员工邀请码：{{code}}</p>', '员工邀请码：{{code}}'],
      'en-US': ['{{appName}} employee invite', '<p>Employee invite code: {{code}}</p>', 'Employee invite code: {{code}}'],
      'my-MM': ['{{appName}} employee invite (my)', '<p>Code: {{code}}</p>', 'Code: {{code}}'],
    }],
    ['org_invite', {
      'zh-CN': ['{{appName}} 组织邀请', '<p>组织邀请码：{{code}}</p>', '组织邀请码：{{code}}'],
      'en-US': ['{{appName}} organization invite', '<p>Organization invite code: {{code}}</p>', 'Organization invite code: {{code}}'],
      'my-MM': ['{{appName}} org invite (my)', '<p>Code: {{code}}</p>', 'Code: {{code}}'],
    }],
  ];
  let tplCount = 0;
  for (const [type, locales] of mailTemplates) {
    for (const [locale, parts] of Object.entries(locales)) {
      await prisma.mailTemplate.upsert({
        where: { type_locale: { type, locale } },
        update: {
          subject: parts[0],
          htmlBody: parts[1],
          textBody: parts[2],
          variables: tplVars,
          enabled: true,
        },
        create: {
          type,
          locale,
          subject: parts[0],
          htmlBody: parts[1],
          textBody: parts[2],
          variables: tplVars,
          enabled: true,
          version: 1,
        },
      });
      tplCount += 1;
    }
  }
  console.log('[seed] mail configs: ' + MAIL_DEFAULTS.length + ', templates: ' + tplCount);

  // 5. 超级管理员
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    console.warn('[seed] ADMIN_INITIAL_PASSWORD 未设置，跳过超管创建');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const itDept = await prisma.department.findUnique({ where: { code: 'IT' } });
  await prisma.user.upsert({
    where: { username },
    update: { roleId: roles.SUPER_ADMIN.id, passwordHash, departmentId: itDept?.id ?? null },
    create: {
      username,
      displayName: 'ZRH Administrator',
      passwordHash,
      roleId: roles.SUPER_ADMIN.id,
      departmentId: itDept?.id ?? null,
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
