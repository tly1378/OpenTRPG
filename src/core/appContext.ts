export function createAppContext<TContext extends Record<string, unknown>>(context: TContext): TContext {
  return context;
}
