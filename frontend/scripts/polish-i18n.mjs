import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = path.join(__dirname, '../src/i18n/locales');

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const zhExtra = {
  'common.on': '开启',
  'common.off': '关闭',
  'common.retry': '重试',
  'common.empty': '暂无内容',
  'common.error': '加载失败',
  'common.success': '操作成功',
  'admin.openModule': '打开模块',
  'admin.backDashboard': '返回仪表盘',
  'admin.auditTrail': '审计与安全轨迹',
  'admin.logsHint': '企业操作审计可在用户中心查看登录记录；系统健康状态请进入运行状态页。',
  'admin.hubKnowledge': '进入知识库管理文档、文件夹、标签与检索。',
  'admin.hubModels': '进入模型中心查看与管理可用 AI 模型。',
  'admin.hubAgents': '进入智能体中心配置与运行企业 Agent。',
  'admin.hubWorkflows': '进入工作流引擎设计、调度与执行。',
  'admin.hubMcp': '进入 MCP 网关管理连接器与会话。',
  'admin.hubBusiness': '进入业务中枢查看企业系统连接。',
  'admin.hubMonitor': '进入系统状态页查看运行时与基础设施。',
  'admin.hubSettings': '进入超级管理配置中心管理安全与系统参数。',
  'admin.hubSeo': '品牌与站点元信息由 ZRH AI 统一管理。',
  'admin.hubI18n': '界面支持中文 / 缅文 / 英文，可在顶栏随时切换。',
  'admin.manageShell': '企业管理控制台',
  'admin.noTouchV11': '通过正式模块入口管理企业能力。',
  'developer.runnerOk': 'Runner 在线',
  'developer.runnerDown': 'Runner 离线',
  'developer.index': '重建索引',
  'developer.indexOk': '索引已更新',
  'chat.brandGroup': 'ZRH 科技集团',
  'superadmin.configKey': '配置键',
  'superadmin.configGroup': '分组',
  'superadmin.configValue': '配置值',
  'superadmin.secret': '敏感',
};

const enExtra = {
  'common.on': 'On',
  'common.off': 'Off',
  'common.retry': 'Retry',
  'common.empty': 'Nothing here yet',
  'common.error': 'Something went wrong',
  'common.success': 'Done',
  'admin.openModule': 'Open module',
  'admin.backDashboard': 'Back to dashboard',
  'admin.auditTrail': 'Audit & security trail',
  'admin.logsHint': 'Review login activity in Account. System health is available on the Status page.',
  'admin.hubKnowledge': 'Manage documents, folders, tags, and search in Knowledge.',
  'admin.hubModels': 'Review and manage available AI models.',
  'admin.hubAgents': 'Configure and run enterprise Agents.',
  'admin.hubWorkflows': 'Design, schedule, and execute workflows.',
  'admin.hubMcp': 'Manage MCP connectors and sessions.',
  'admin.hubBusiness': 'Inspect enterprise business connectors.',
  'admin.hubMonitor': 'Open runtime and infrastructure status.',
  'admin.hubSettings': 'Manage security and system configuration in Super Admin.',
  'admin.hubSeo': 'Brand and site metadata are managed by ZRH AI.',
  'admin.hubI18n': 'The UI supports Chinese, Myanmar, and English from the top bar.',
  'admin.manageShell': 'Enterprise admin console',
  'admin.noTouchV11': 'Manage enterprise capabilities via official module pages.',
  'developer.runnerOk': 'Runner online',
  'developer.runnerDown': 'Runner offline',
  'developer.index': 'Rebuild index',
  'developer.indexOk': 'Index updated',
  'chat.brandGroup': 'ZRH Technology Group',
  'superadmin.configKey': 'Key',
  'superadmin.configGroup': 'Group',
  'superadmin.configValue': 'Value',
  'superadmin.secret': 'Secret',
};

const myExtra = {
  'common.on': 'ဖွင့်',
  'common.off': 'ပိတ်',
  'common.retry': 'ပြန်ကြိုးစားရန်',
  'common.empty': 'အကြောင်းအရာ မရှိသေးပါ',
  'common.error': 'ဖွင့်၍မရပါ',
  'common.success': 'အောင်မြင်ပါသည်',
  'app.name': 'ZRH AI',
  'app.tagline': 'ZRH Technology Group ၏ လုပ်ငန်းသုံး AI',
  'nav.rag': 'လုပ်ငန်း RAG',
  'nav.agents': 'Agent များ',
  'nav.tools': 'ကိရိယာများ',
  'nav.mcp': 'MCP',
  'nav.workflows': 'အလုပ်စဉ်များ',
  'nav.business': 'လုပ်ငန်းဗဟို',
  'nav.developer': 'Developer',
  'nav.admin': 'စီမံခန့်ခွဲမှု',
  'nav.superadmin': 'အထူးစီမံ',
  'account.avatar': 'ပုံရိပ်',
  'admin.title': 'စီမံခန့်ခွဲမှု',
  'admin.dashboard': 'ဒက်ရှ်ဘုတ်',
  'admin.agents': 'Agent များ',
  'admin.workflows': 'အလုပ်စဉ်များ',
  'admin.mcp': 'MCP',
  'admin.business': 'လုပ်ငန်း',
  'admin.seo': 'SEO',
  'admin.openModule': 'မော်ဂျူးဖွင့်ရန်',
  'admin.backDashboard': 'ဒက်ရှ်ဘုတ်သို့',
  'admin.auditTrail': 'စစ်ဆေးမှတ်တမ်း',
  'admin.logsHint':
    'လော့ဂ်အင်မှတ်တမ်းကို အကောင့်စာမျက်နှာတွင် ကြည့်နိုင်သည်။ စနစ်အခြေအနေကို Status တွင် ကြည့်ပါ။',
  'admin.hubKnowledge': 'ဗဟုသုတဘေ့စ်တွင် စာရွက်၊ ဖိုင်တွဲ၊ တဂ်နှင့် ရှာဖွေမှုကို စီမံပါ။',
  'admin.hubModels': 'ရရှိနိုင်သော AI မော်ဒယ်များကို စီမံပါ။',
  'admin.hubAgents': 'လုပ်ငန်း Agent များကို ပြင်ဆင်ပြီး လည်ပတ်ပါ။',
  'admin.hubWorkflows': 'အလုပ်စဉ်များကို ဒီဇိုင်း၊ အချိန်ဇယားနှင့် အကောင်အထည်ဖော်ပါ။',
  'admin.hubMcp': 'MCP ချိတ်ဆက်မှုများနှင့် ဆက်ရှင်များကို စီမံပါ။',
  'admin.hubBusiness': 'လုပ်ငန်းချိတ်ဆက်မှုများကို စစ်ဆေးပါ။',
  'admin.hubMonitor': 'စနစ်အခြေအနေစာမျက်နှာကို ဖွင့်ပါ။',
  'admin.hubSettings': 'Super Admin တွင် လုံခြုံရေးနှင့် စနစ်သတ်မှတ်ချက်များကို စီမံပါ။',
  'admin.hubSeo': 'အမှတ်တံဆိပ်နှင့် ဆိုက်အချက်အလက်ကို ZRH AI က စီမံသည်။',
  'admin.hubI18n': 'UI သည် တရုတ်၊ မြန်မာ၊ အင်္ဂလိပ်ကို ထောက်ပံ့သည်။',
  'admin.manageShell': 'လုပ်ငန်းစီမံခွင့်ကွန်ဆိုးလ်',
  'admin.noTouchV11': 'တရားဝင်မော်ဂျူးစာမျက်နှာများမှတစ်ဆင့် စီမံပါ။',
  'developer.title': 'Developer Agent',
  'developer.plan': 'အစီအစဉ်',
  'developer.diff': 'Diff',
  'developer.terminal': 'တားမီနယ်',
  'developer.runnerOk': 'Runner အွန်လိုင်း',
  'developer.runnerDown': 'Runner အော့ဖ်လိုင်း',
  'developer.index': 'အညွှန်းပြန်တည်ဆောက်',
  'developer.indexOk': 'အညွှန်းအသစ်ပြီးပါပြီ',
  'superadmin.title': 'အထူးစီမံ',
  'superadmin.ops': 'လုပ်ငန်းဆောင်ရွက်မှု',
  'superadmin.integrations': 'ပေါင်းစည်းမှုများ',
  'superadmin.configKey': 'ကီး',
  'superadmin.configGroup': 'အုပ်စု',
  'superadmin.configValue': 'တန်ဖိုး',
  'superadmin.secret': 'လျှို့ဝှက်',
  'status.ollama': 'မော်ဒယ်အင်ဂျင်',
  'status.models': 'မော်ဒယ်များ',
  'status.modelName': 'မော်ဒယ်အမည်',
  'home.stage': 'လုပ်ငန်းအဆင့်',
  'chat.tokens': 'တိုကင်',
  'chat.brandGroup': 'ZRH နည်းပညာအုပ်စု',
  'chat.aiRuntime': 'AI အပြေးအဆန်',
  'chat.model': 'မော်ဒယ်',
  'chat.temperature': 'အပူချိန်',
  'chat.topP': 'Top P',
  'chat.topK': 'Top K',
  'chat.repeatPenalty': 'ထပ်တလဲလဲ ဒဏ်',
  'chat.contextLength': 'အကြောင်းအရာအရှည်',
  'chat.maxTokens': 'အများဆုံးတိုကင်',
  'rag.title': 'လုပ်ငန်း RAG',
  'rag.subtitle': 'ပြန်ရေး၊ ရှာဖွေ၊ ပြန်စီ၊ ကိုးကားဖြင့် လုပ်ငန်းအသိပညာကို မေးမြန်းပါ',
  'rag.hitRate': 'ထိမှန်နှုန်း',
  'agents.title': 'Agent များ',
  'agents.subtitle': 'လုပ်ငန်း Agent မှတ်ပုံတင်ခြင်းနှင့် လမ်းကြောင်း',
  'agents.registry': 'မှတ်ပုံတင်',
  'agents.router': 'လမ်းကြောင်း',
  'agents.active': 'အသက်ဝင်',
  'tools.title': 'ကိရိယာများ',
  'tools.subtitle': 'ကိရိယာမှတ်ပုံတင်နှင့် ခေါ်ဆိုမှု',
  'tools.registry': 'မှတ်ပုံတင်',
  'tools.router': 'လမ်းကြောင်း',
  'tools.call': 'ခေါ်ဆိုရန်',
  'mcp.title': 'MCP',
  'mcp.subtitle': 'MCP ဂိတ်ဝေး၊ ဆာဗာနှင့် ဆက်ရှင်များ',
  'mcp.registry': 'မှတ်ပုံတင်',
  'mcp.sessions': 'ဆက်ရှင်များ',
  'mcp.servers': 'ဆာဗာများ',
  'workflows.title': 'အလုပ်စဉ်များ',
  'workflows.subtitle': 'အလုပ်စဉ်ဒီဇိုင်း၊ အချိန်ဇယားနှင့် မှတ်တမ်း',
  'workflows.registry': 'မှတ်ပုံတင်',
  'workflows.designer': 'ဒီဇိုင်နာ',
  'workflows.scheduler': 'အချိန်ဇယား',
  'workflows.logs': 'မှတ်တမ်းများ',
  'workflows.templates': 'ပုံစံများ',
  'business.title': 'လုပ်ငန်းဗဟို',
  'business.subtitle': 'လုပ်ငန်းစနစ်ချိတ်ဆက်မှုနှင့် စစ်ဆေးမှတ်တမ်း',
  'business.overview': 'ခြုံငုံသုံးသပ်',
  'business.invoke': 'ခေါ်ဆိုရန်',
  'business.connectors': 'ချိတ်ဆက်ကိရိယာများ',
  'business.workflows': 'အလုပ်စဉ်များ',
  'business.audit': 'စစ်ဆေးမှု',
  'business.systems': 'စနစ်များ',
  'business.audits24h': '၂၄ နာရီ စစ်ဆေးမှု',
};

for (const [file, extra] of [
  ['zh-CN.json', zhExtra],
  ['en-US.json', enExtra],
  ['my-MM.json', myExtra],
]) {
  const p = path.join(locales, file);
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(extra)) setPath(obj, k, v);
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
  console.log('updated', file);
}

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]],
  );
const en = Object.fromEntries(flat(JSON.parse(fs.readFileSync(path.join(locales, 'en-US.json'), 'utf8'))));
const my = Object.fromEntries(flat(JSON.parse(fs.readFileSync(path.join(locales, 'my-MM.json'), 'utf8'))));
const intentional = new Set([
  'app.name',
  'language.zh-CN',
  'language.en-US',
  'language.my-MM',
  'nav.mcp',
  'admin.mcp',
  'admin.seo',
  'chat.topP',
  'chat.topK',
  'developer.diff',
  'developer.title',
  'nav.developer',
  'mcp.title',
]);
const eq = Object.keys(en).filter(
  (k) => my[k] === en[k] && !intentional.has(k) && !/Placeholder$/i.test(k) && !k.endsWith('.topP') && !k.endsWith('.topK'),
);
console.log('remaining my==en (excl intentional):', eq.length);
console.log(eq.join('\n'));
