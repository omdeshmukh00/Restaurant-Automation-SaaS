import { AsyncLocalStorage } from 'async_hooks';

export interface ITenantContext {
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<ITenantContext>();
