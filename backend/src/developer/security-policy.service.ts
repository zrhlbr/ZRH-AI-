import { ForbiddenException, Injectable } from '@nestjs/common';
import * as path from 'path';

const ENV_DENY =
  /(^|\/|\\)(\.env($|\.|\/|\\)|credentials\.json$|.*\.(pem|key|p12|pfx)$|(^|\/|\\)id_rsa($|\.)|(^|\/|\\)\.ssh(\/|\\))/i;
const SECRET_RE =
  /(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*['"]?[^\s'"]+/gi;

@Injectable()
export class SecurityPolicyService {
  whitelistRoot(): string {
    return path.resolve(process.env.DEV_WORKSPACES_ROOT || path.join(process.cwd(), 'workspaces'));
  }

  assertRelativeSafe(relPath: string) {
    if (!relPath) return;
    const norm = relPath.replace(/\\/g, '/');
    if (norm.includes('..') || path.isAbsolute(norm) || ENV_DENY.test(norm)) {
      throw new ForbiddenException('path denied by security policy');
    }
  }

  isEnvPath(relPath: string): boolean {
    return ENV_DENY.test(relPath.replace(/\\/g, '/'));
  }

  redact(text: string): string {
    return String(text || '')
      .replace(SECRET_RE, '$1=***')
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***');
  }

  assertCommandSafe(command: string, _allowDangerous = false) {
    const c = command.trim();
    if (!c) throw new ForbiddenException('empty command');
    if (/[;&|`$<>]|\n|\r/.test(c)) {
      throw new ForbiddenException('shell metacharacters denied');
    }
    if (/git\s+push\s+[^\n]*--force|git\s+push\s+-f\b/i.test(c)) {
      throw new ForbiddenException('force push denied by default');
    }
    if (/git\s+reset\s+--hard/i.test(c)) {
      throw new ForbiddenException('git reset --hard requires dangerous approval');
    }
    if (/git\s+clean\b/i.test(c)) {
      throw new ForbiddenException('git clean requires dangerous approval');
    }
  }
}
