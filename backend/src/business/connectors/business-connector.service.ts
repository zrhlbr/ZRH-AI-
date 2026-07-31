import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Business Connector（Stub）。
 * 仅在 Workflow 门禁通过后由 BusinessAccessService 调用。
 * 禁止业务模块绕过 Workflow 直连外部系统；资金写操作不在此开放。
 */
@Injectable()
export class BusinessConnectorService {
  constructor(private readonly prisma: PrismaService) {}

  async ping(systemCode: string) {
    const connector = await this.prisma.businessConnector.findFirst({
      where: { system: { code: systemCode }, enabled: true },
      include: { system: true },
    });
    if (!connector) throw new BadRequestException(`no connector for ${systemCode}`);
    await this.prisma.businessConnector.update({
      where: { id: connector.id },
      data: { healthStatus: 'healthy', status: 'ready' },
    });
    return {
      systemCode,
      connectorCode: connector.code,
      transport: connector.transport,
      healthStatus: 'healthy',
      stub: true,
    };
  }

  /**
   * 只读业务快照。写操作一律拒绝，要求走审批 Workflow。
   */
  async read(systemCode: string, action: string, input: Record<string, unknown> = {}) {
    switch (systemCode) {
      case 'zrh_accounting':
        return this.accountingRead(action, input);
      case 'zrhpay':
        return this.zrhpayRead(action, input);
      case 'zrh_router':
        return this.routerRead(action, input);
      case 'knowledge':
        return {
          source: 'Knowledge Platform',
          note: 'Knowledge data is retrieved via Tool Manager inside Workflow',
          query: input.query ?? null,
        };
      case 'document':
        return {
          source: 'Document Center',
          categories: ['政策制度', '合同', '说明书', '技术文档'],
          note: 'Documents are accessed via Tool Manager inside Workflow',
        };
      default:
        throw new BadRequestException(`unknown business system: ${systemCode}`);
    }
  }

  private accountingRead(action: string, input: Record<string, unknown>) {
    const catalog: Record<string, unknown> = {
      qa: { answerHint: 'Use workflow agent/rag result as primary answer', topic: input.query },
      balance_query: {
        currency: 'MMK',
        income: 12500000,
        expense: 8300000,
        net: 4200000,
        period: '2026-07',
      },
      inventory_query: {
        skuCount: 128,
        lowStock: 7,
        items: [
          { sku: 'SKU-1001', name: 'Router Pro', qty: 12 },
          { sku: 'SKU-2044', name: 'SIM Card Pack', qty: 3 },
        ],
      },
      product_query: {
        products: [
          { id: 'P-01', name: 'ZRH Mesh AP', price: 189000 },
          { id: 'P-02', name: 'ZRHPay POS', price: 320000 },
        ],
      },
      stats: { orders: 842, aov: 56000, topCategory: 'Network' },
      report: {
        reportId: 'RPT-202607',
        format: 'summary',
        generatedAt: new Date().toISOString(),
        readOnly: true,
      },
    };
    if (action === 'write') {
      throw new BadRequestException('accounting write is blocked at connector; use approval workflow');
    }
    const data = catalog[action];
    if (!data) throw new BadRequestException(`unsupported accounting action: ${action}`);
    return { system: 'zrh_accounting', action, readOnly: true, stub: true, data };
  }

  private zrhpayRead(action: string, input: Record<string, unknown>) {
    if (action === 'write') {
      throw new BadRequestException('ZRHPay write is blocked at connector; use approval workflow');
    }
    const catalog: Record<string, unknown> = {
      wallet_query: { walletId: 'W-10086', balance: 1580000, currency: 'MMK', status: 'active' },
      rate_query: { base: 'USD', quote: 'MMK', rate: 2100.5, asOf: new Date().toISOString() },
      tx_query: {
        transactions: [
          { id: 'TX-1', amount: 25000, type: 'in', status: 'success' },
          { id: 'TX-2', amount: 12000, type: 'out', status: 'success' },
        ],
      },
      user_query: { userId: input.userId ?? 'U-88', kyc: 'verified', status: 'active' },
      merchant_query: { merchantId: 'M-12', name: 'ZRH Mart', status: 'active' },
    };
    const data = catalog[action];
    if (!data) throw new BadRequestException(`unsupported zrhpay action: ${action}`);
    return { system: 'zrhpay', action, readOnly: true, stub: true, data };
  }

  private routerRead(action: string, _input: Record<string, unknown>) {
    if (action === 'config_change') {
      throw new BadRequestException('router config change blocked at connector; use approval workflow');
    }
    const base = {
      deviceId: 'RTR-ZRH-01',
      model: 'ZRH Router OS',
      uptimeSec: 864000,
      cpuPercent: 23,
      memoryPercent: 41,
      temperatureC: 48,
      onlineClients: 17,
      network: { wan: 'up', lan: 'up', lossPercent: 0.1 },
      vpn: { enabled: true, peers: 3, status: 'connected' },
      logs: [
        { level: 'info', msg: 'wan link stable' },
        { level: 'warn', msg: 'client dhcp pool 80%' },
      ],
    };
    const map: Record<string, unknown> = {
      device_status: base,
      cpu: { cpuPercent: base.cpuPercent },
      memory: { memoryPercent: base.memoryPercent },
      temperature: { temperatureC: base.temperatureC },
      clients: { onlineClients: base.onlineClients },
      network: base.network,
      vpn: base.vpn,
      logs: { entries: base.logs },
    };
    const data = map[action];
    if (!data) throw new BadRequestException(`unsupported router action: ${action}`);
    return { system: 'zrh_router', action, readOnly: true, stub: true, data };
  }
}
