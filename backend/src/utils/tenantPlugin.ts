import { Schema } from 'mongoose';
import { tenantContext } from './tenantContext';

export function tenantPlugin(schema: Schema) {
  // If the schema matches global collections, skip applying the plugin
  const collectionName = (schema as any).options?.collection;
  const excludedCollections = ['plans', 'featureFlags', 'restaurant_requests'];
  
  if (collectionName && excludedCollections.includes(collectionName)) {
    return;
  }

  // 1. Add tenantId field to all schemas using the plugin
  schema.add({
    tenantId: {
      type: String,
      required: false,
      index: true,
    },
  });

  // Helper to add tenantId to queries
  const addTenantIdToQuery = function (this: any) {
    // If the query is marked to bypass tenant filtering, do nothing
    if (this.getOptions()?.bypassTenant) {
      return;
    }

    if (process.env.NODE_ENV === 'test' && !this.getOptions()?.enforceTenantInTest) {
      return;
    }

    const context = tenantContext.getStore();
    if (context && context.tenantId) {
      this.where({ tenantId: context.tenantId });
    }
  };

  // Register query middleware hooks
  schema.pre('find', addTenantIdToQuery);
  schema.pre('findOne', addTenantIdToQuery);
  schema.pre('findOneAndUpdate', addTenantIdToQuery);
  schema.pre('updateOne', addTenantIdToQuery);
  schema.pre('updateMany', addTenantIdToQuery);
  schema.pre('deleteOne', addTenantIdToQuery);
  schema.pre('deleteMany', addTenantIdToQuery);
  schema.pre('countDocuments', addTenantIdToQuery);
  schema.pre('distinct', addTenantIdToQuery);

  // Register aggregation middleware hook
  schema.pre('aggregate', function (this: any) {
    if (this.options?.bypassTenant) {
      return;
    }

    if (process.env.NODE_ENV === 'test' && !this.options?.enforceTenantInTest) {
      return;
    }

    const context = tenantContext.getStore();
    if (context && context.tenantId) {
      const pipeline = this.pipeline();
      // Inject $match stage at the beginning of the pipeline
      pipeline.unshift({ $match: { tenantId: context.tenantId } });
    }
  });

  // Register pre-save hook to auto-populate tenantId from request context if missing
  schema.pre('save', function (next) {
    const context = tenantContext.getStore();
    if (context && context.tenantId && !this.get('tenantId')) {
      this.set('tenantId', context.tenantId);
    }
    next();
  });
}
