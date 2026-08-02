import { request, LoginResult } from './client';

/** V1.2 P1 API helpers — User Center / Admin / Super Admin */

export interface RegisterPayload {
  username?: string;
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
  emailCode?: string;
  phoneCode?: string;
  inviteCode?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  language?: string;
}

export interface UserCenterMe {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  role: string;
  roleName: string;
  profile: {
    nickname?: string | null;
    avatarUrl?: string | null;
    country?: string | null;
    language?: string | null;
    bio?: string | null;
    timezone?: string | null;
  };
  createdAt: string;
}

export interface AdminDashboard {
  users: { today: number; total: number; onlineSessions: number };
  ai: { requestsToday: number; tokensToday: number; note?: string };
  infra: {
    cpu: Record<string, unknown>;
    memory: Record<string, unknown>;
    gpu: Record<string, unknown>;
    docker: Record<string, unknown>;
  };
  modules: Record<string, boolean>;
  announcements: number;
  generatedAt: string;
}

export const v12Api = {
  login: (account: string, password: string, rememberMe?: boolean) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password, rememberMe }),
    }),

  register: (payload: RegisterPayload) =>
    request<LoginResult & { user: { id: number; username: string; role: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendCode: (target: string, channel: 'email' | 'phone', purpose: 'register' | 'reset' | 'bind') =>
    request<{
      ok: boolean;
      channel: string;
      reserved?: boolean;
      message?: string;
      expiresInSeconds: number;
      devCode?: string;
    }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ target, channel, purpose }),
    }),

  forgotPassword: (account: string, channel?: 'email' | 'phone') =>
    request<{ ok: boolean; message?: string; reserved?: boolean; devToken?: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ account, channel }),
      },
    ),

  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  // User Center
  me: () => request<UserCenterMe>('/user-center/me'),
  updateMe: (data: Partial<{
    displayName: string;
    nickname: string;
    avatarUrl: string;
    country: string;
    language: string;
    bio: string;
    timezone: string;
  }>) =>
    request<UserCenterMe>('/user-center/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/user-center/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  loginHistory: () => request<{ items: Array<Record<string, unknown>> }>('/user-center/login-history'),
  devices: () => request<{ items: Array<Record<string, unknown>> }>('/user-center/devices'),
  revokeDevice: (deviceId: string) =>
    request<{ ok: boolean }>(`/user-center/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: 'POST',
    }),
  sessions: () => request<{ items: Array<Record<string, unknown>> }>('/user-center/sessions'),
  notifications: () => request<{ items: Array<Record<string, unknown>> }>('/user-center/notifications'),
  apiTokens: () =>
    request<{ ok: boolean; reserved: boolean; items: unknown[]; message: string }>(
      '/user-center/api-tokens',
    ),

  // Admin
  adminDashboard: () => request<AdminDashboard>('/admin/dashboard'),
  adminUsers: (q?: string) =>
    request<{
      items: Array<{
        id: number;
        username: string;
        displayName: string;
        email: string | null;
        phone: string | null;
        status: string;
        role: string;
        roleName: string;
        nickname?: string | null;
        createdAt: string;
      }>;
    }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetUserStatus: (id: number, status: 'active' | 'disabled') =>
    request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  adminSetUserRole: (id: number, roleCode: string) =>
    request(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roleCode }),
    }),
  adminRoles: () =>
    request<{
      items: Array<{
        id: number;
        code: string;
        name: string;
        description: string | null;
        users: number;
        permissions: number;
      }>;
    }>('/admin/roles'),
  adminPermissions: () =>
    request<{ items: Array<{ id: number; code: string; name: string; type: string }> }>(
      '/admin/permissions',
    ),
  adminAnnouncements: () =>
    request<{ items: Array<Record<string, unknown>> }>('/admin/announcements'),
  adminUpsertAnnouncement: (data: {
    id?: number;
    title: string;
    body: string;
    locale?: string;
    published?: boolean;
  }) =>
    request('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminResetPassword: (userId: number, newPassword: string) =>
    request(`/auth/admin/reset-password/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  // Super Admin
  superOverview: () => request<Record<string, unknown>>('/superadmin/overview'),
  superConfigs: () =>
    request<{
      items: Array<{
        id: number;
        key: string;
        group: string;
        secret: boolean;
        value: string;
        updatedAt: string;
      }>;
    }>('/superadmin/configs'),
  superUpsertConfig: (data: { key: string; value: string; group?: string; secret?: boolean }) =>
    request('/superadmin/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  superLogs: () => request<Record<string, unknown>>('/superadmin/logs'),
  superOps: () => request<Record<string, unknown>>('/superadmin/ops'),
  superIntegrations: () => request<Record<string, unknown>>('/superadmin/integrations'),

  // Mail Center V1.0 (SUPER_ADMIN)
  mailStatus: () =>
    request<{
      smtp: {
        host: string;
        port: number;
        username: string;
        password: string;
        passwordConfigured: boolean;
        encryption: string;
        fromEmail: string;
        fromName: string;
        replyTo: string;
        connectionTimeoutMs: number;
        configured: boolean;
      };
      codePolicy: {
        length: number;
        ttlSeconds: number;
        intervalSeconds: number;
        dailyLimit: number;
        maxRetries: number;
      };
      runtime: Record<string, unknown>;
    }>('/superadmin/mail/status'),
  mailSaveSmtp: (data: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    encryption: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
    connectionTimeoutMs?: number;
  }) =>
    request<{
      host: string;
      port: number;
      username: string;
      password: string;
      passwordConfigured: boolean;
      encryption: string;
      fromEmail: string;
      fromName: string;
      replyTo: string;
      connectionTimeoutMs: number;
      configured: boolean;
    }>('/superadmin/mail/smtp', { method: 'POST', body: JSON.stringify(data) }),
  mailSaveCodePolicy: (data: {
    length: number;
    ttlSeconds: number;
    intervalSeconds: number;
    dailyLimit: number;
    maxRetries: number;
  }) =>
    request('/superadmin/mail/code-policy', { method: 'POST', body: JSON.stringify(data) }),
  mailTemplates: () =>
    request<{
      items: Array<{
        id: number;
        type: string;
        locale: string;
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: string;
        enabled: boolean;
        version: number;
        updatedAt: string;
      }>;
    }>('/superadmin/mail/templates'),
  mailLogs: (q?: { take?: number; skip?: number; status?: string; templateType?: string }) => {
    const params = new URLSearchParams();
    if (q?.take != null) params.set('take', String(q.take));
    if (q?.skip != null) params.set('skip', String(q.skip));
    if (q?.status) params.set('status', q.status);
    if (q?.templateType) params.set('templateType', q.templateType);
    const qs = params.toString();
    return request<{
      items: Array<{
        id: number;
        toMasked: string;
        templateType: string;
        status: string;
        provider: string;
        messageId: string | null;
        attempts: number;
        errorCode: string | null;
        errorMessage: string | null;
        createdAt: string;
        completedAt: string | null;
      }>;
      total: number;
    }>(`/superadmin/mail/logs${qs ? `?${qs}` : ''}`);
  },
  mailTestConnection: () =>
    request<{ ok: boolean; message: string }>('/superadmin/mail/test-connection', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  mailTestSend: (data: { to: string; templateType?: string; locale?: string }) =>
    request('/superadmin/mail/test-send', { method: 'POST', body: JSON.stringify(data) }),
};
