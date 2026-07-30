import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { statfsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';

const execFileAsync = promisify(execFile);

/**
 * 系统监控基础数据。
 * 说明：api 运行在 Docker 容器内，CPU/内存/网络反映容器视角；
 * GPU 依赖宿主机 nvidia-smi，不可用时明确返回 available:false（不使用假数据）。
 */
@Injectable()
export class SystemService {
  cpu() {
    const cpus = os.cpus();
    const load = os.loadavg();
    return {
      available: true,
      model: cpus[0]?.model ?? 'unknown',
      cores: cpus.length,
      loadAvg: { '1m': load[0], '5m': load[1], '15m': load[2] },
      scope: 'container',
      timestamp: new Date().toISOString(),
    };
  }

  memory() {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      available: true,
      totalBytes: total,
      freeBytes: free,
      usedBytes: total - free,
      usedPercent: Number((((total - free) / total) * 100).toFixed(1)),
      scope: 'container-host-view',
      timestamp: new Date().toISOString(),
    };
  }

  async gpu() {
    try {
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu',
        '--format=csv,noheader,nounits',
      ], { timeout: 3000 });
      const [name, util, memUsed, memTotal, temp] = stdout.trim().split(',').map((s) => s.trim());
      return {
        available: true,
        name,
        utilizationPercent: Number(util),
        memoryUsedMB: Number(memUsed),
        memoryTotalMB: Number(memTotal),
        temperatureC: Number(temp),
        timestamp: new Date().toISOString(),
      };
    } catch {
      // 容器内无 nvidia-smi：如实返回不可用，阶段 4 通过宿主机 agent 扩展
      return {
        available: false,
        reason: 'nvidia-smi not accessible inside container',
        planned: 'stage-4 host agent',
        timestamp: new Date().toISOString(),
      };
    }
  }

  network() {
    const interfaces = os.networkInterfaces();
    const list = Object.entries(interfaces)
      .flatMap(([name, addrs]) =>
        (addrs ?? [])
          .filter((a) => a.family === 'IPv4' && !a.internal)
          .map((a) => ({ name, address: a.address, netmask: a.netmask })),
      );
    return {
      available: true,
      interfaces: list,
      scope: 'container',
      timestamp: new Date().toISOString(),
    };
  }

  /** Docker 引擎探活：通过只读挂载的 docker.sock 调 /_ping 与 /version */
  docker(): Promise<Record<string, unknown>> {
    const socketPath = process.env.DOCKER_SOCKET ?? '/var/run/docker.sock';
    const call = (path: string) =>
      new Promise<string>((resolve, reject) => {
        const req = http.request({ socketPath, path, method: 'GET', timeout: 3000 }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(body));
        });
        req.on('timeout', () => req.destroy(new Error('docker socket timeout')));
        req.on('error', reject);
        req.end();
      });

    return (async () => {
      try {
        const ping = await call('/_ping');
        let version: Record<string, unknown> = {};
        try {
          version = JSON.parse(await call('/version')) as Record<string, unknown>;
        } catch {
          // ping 成功即可
        }
        return {
          available: ping.trim() === 'OK',
          engineVersion: version.Version ?? null,
          apiVersion: version.ApiVersion ?? null,
          os: version.Os ?? null,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          available: false,
          reason: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
      }
    })();
  }

  storage() {
    try {
      const stats = statfsSync('/');
      const total = Number(stats.blocks) * Number(stats.bsize);
      const free = Number(stats.bavail) * Number(stats.bsize);
      return {
        available: true,
        mount: '/',
        totalBytes: total,
        freeBytes: free,
        usedBytes: total - free,
        usedPercent: Number((((total - free) / total) * 100).toFixed(1)),
        scope: 'container',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
