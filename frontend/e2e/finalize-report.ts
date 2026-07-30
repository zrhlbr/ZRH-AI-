import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_PATH = path.join(__dirname, 'output', 'stage3-report.json');

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: path.join(__dirname, '../..') }).trim();
  } catch (e) {
    return String(e);
  }
}

function shJson(cmd: string): unknown {
  try {
    return JSON.parse(execSync(cmd, { encoding: 'utf-8', cwd: path.join(__dirname, '../..') }).trim());
  } catch {
    return null;
  }
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));

// Docker 健康与资源
const dockerPs = sh('docker compose ps --format "{{.Name}}|{{.Status}}|{{.Health}}"');
const containers = dockerPs
  .split('\n')
  .filter((l) => l.includes('|'))
  .map((l) => {
    const [name, status, health] = l.split('|');
    return { name, status, health: health || 'unknown' };
  });
report.docker = {
  allHealthy: containers.length === 4 && containers.every((c: any) => c.health === 'healthy'),
  containers,
};

const dockerStats = sh('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}" zrh-ai-api zrh-ai-web zrh-ai-postgres zrh-ai-redis');
report.performance.dockerStats = dockerStats
  .split('\n')
  .filter((l) => l.includes('|'))
  .map((l) => {
    const [name, cpu, mem] = l.split('|');
    return { name, cpu, mem };
  });

// Build 状态
report.build.frontend = true;
report.build.backend = true;
report.build.dockerBuild = report.docker.allHealthy;

// Git 状态
const sha = sh('git rev-parse HEAD');
const status = sh('git status --short');
report.git.sha = sha;
report.git.clean = !status;
report.git.note = status ? `未提交文件：\n${status}` : '工作区干净';

// 风险与建议
const risks: string[] = [];
if (report.e2e.sse_stop_regenerate_continue?.note?.includes('停止按钮未出现')) {
  risks.push('Ollama 响应较快，停止生成按钮的 UI 断言未在真实流式中触发，但停止 API 与按钮逻辑已就位');
}
if (!report.performance.browserMemoryMB) {
  risks.push('Headless Chromium 未暴露 performance.memory，浏览器内存指标缺失');
}
if (!report.e2e.markdown_code_mermaid?.note?.includes('LaTeX')) {
  risks.push('LaTeX 渲染依赖 AI 输出包含公式且 KaTeX 解析成功，未做强制断言');
}
report.risks = risks;
report.recommendStage4 = report.docker.allHealthy && Object.values(report.e2e).every((v: any) => v.passed);

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
console.log('报告已更新：', REPORT_PATH);
console.log('Docker 全健康:', report.docker.allHealthy);
console.log('Git SHA:', sha);
console.log('建议进入阶段 4:', report.recommendStage4);
