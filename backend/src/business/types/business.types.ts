export interface BusinessSystemView {
  id: number;
  code: string;
  name: string;
  description: string | null;
  kind: string;
  enabled: boolean;
  status: string;
  version: string;
  readOnlyDefault: boolean;
  writeRequiresApproval: boolean;
  roleAccess: string | null;
  companyCode: string | null;
  connectors: Array<{
    code: string;
    name: string;
    transport: string;
    enabled: boolean;
    status: string;
    healthStatus: string;
  }>;
  workflows: Array<{
    actionCode: string;
    workflowCode: string;
    name: string;
    isDefault: boolean;
    requiresApproval: boolean;
    readOnly: boolean;
  }>;
}

export interface BusinessInvokeResult {
  systemCode: string;
  action: string;
  workflowCode: string;
  workflowRunId: number;
  workflowStatus: string;
  connector: unknown;
  readOnly: boolean;
  requiresApproval: boolean;
  architecture: string;
}
