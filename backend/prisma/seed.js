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

  // 4. 超级管理员
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
