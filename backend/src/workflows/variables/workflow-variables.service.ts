import { Injectable } from '@nestjs/common';

/**
 * Workflow Variables：全局 / 局部 / 上下文 / 运行 / 环境（白名单）。
 */
@Injectable()
export class WorkflowVariablesService {
  private readonly envAllow = new Set([
    'NODE_ENV',
    'BACKEND_PORT',
    'WEB_ORIGIN',
    'TZ',
  ]);

  createContext(input: {
    input?: Record<string, unknown>;
    defaults?: Record<string, unknown>;
    global?: Record<string, unknown>;
  }) {
    const env: Record<string, string> = {};
    for (const key of this.envAllow) {
      const v = process.env[key];
      if (v !== undefined) env[key] = v;
    }
    return {
      input: { ...(input.defaults ?? {}), ...(input.input ?? {}) },
      global: { ...(input.global ?? {}) },
      vars: {} as Record<string, unknown>,
      ctx: {} as Record<string, unknown>,
      env,
      run: {
        startedAt: new Date().toISOString(),
      } as Record<string, unknown>,
    };
  }

  setVar(
    ctx: ReturnType<WorkflowVariablesService['createContext']>,
    key: string,
    value: unknown,
    scope: 'vars' | 'global' | 'ctx' | 'run' = 'vars',
  ) {
    ctx[scope][key] = value;
  }

  /** 解析 {{input.x}} / {{vars.y}} / {{env.NODE_ENV}} */
  resolveString(
    template: string,
    ctx: ReturnType<WorkflowVariablesService['createContext']>,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) => {
      const val = this.getPath(ctx, path);
      if (val === undefined || val === null) return '';
      return typeof val === 'string' ? val : JSON.stringify(val);
    });
  }

  resolveValue(
    value: unknown,
    ctx: ReturnType<WorkflowVariablesService['createContext']>,
  ): unknown {
    if (typeof value === 'string') {
      if (/^\{\{\s*[a-zA-Z0-9_.]+\s*\}\}$/.test(value.trim())) {
        const path = value.trim().replace(/^\{\{\s*|\s*\}\}$/g, '');
        return this.getPath(ctx, path);
      }
      return this.resolveString(value, ctx);
    }
    if (Array.isArray(value)) return value.map((v) => this.resolveValue(v, ctx));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.resolveValue(v, ctx);
      }
      return out;
    }
    return value;
  }

  private getPath(
    ctx: ReturnType<WorkflowVariablesService['createContext']>,
    path: string,
  ): unknown {
    const parts = path.split('.');
    let cur: unknown = ctx;
    for (const p of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  /**
   * 安全条件：支持 vars.x == true|false|number|"string" / != / > / < / >= / <=
   */
  evaluateCondition(
    expression: string,
    ctx: ReturnType<WorkflowVariablesService['createContext']>,
  ): boolean {
    const expr = expression.trim();
    const m = expr.match(
      /^([a-zA-Z0-9_.]+)\s*(==|!=|>=|<=|>|<)\s*(true|false|null|-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')$/,
    );
    if (!m) return Boolean(this.getPath(ctx, expr));
    const left = this.getPath(ctx, m[1]);
    const op = m[2];
    let right: unknown = m[3];
    if (right === 'true') right = true;
    else if (right === 'false') right = false;
    else if (right === 'null') right = null;
    else if (/^-?\d/.test(String(right))) right = Number(right);
    else right = String(right).slice(1, -1);

    switch (op) {
      case '==':
        return left == right; // eslint-disable-line eqeqeq
      case '!=':
        return left != right; // eslint-disable-line eqeqeq
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      default:
        return false;
    }
  }
}
