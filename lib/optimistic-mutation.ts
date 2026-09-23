export type MutationToken = {
  scope: string;
  operation: string;
  version: number;
};

export class OptimisticMutationRegistry {
  private readonly active = new Map<string, MutationToken>();
  private readonly versions = new Map<string, number>();

  begin(scope: string, operation: string): MutationToken | null {
    if (this.active.has(scope)) return null;
    const version = (this.versions.get(scope) ?? 0) + 1;
    const token = { scope, operation, version };
    this.versions.set(scope, version);
    this.active.set(scope, token);
    return token;
  }

  isCurrent(token: MutationToken) {
    return this.active.get(token.scope) === token;
  }

  finish(token: MutationToken) {
    if (this.isCurrent(token)) this.active.delete(token.scope);
  }

  isPending(scope: string) {
    return this.active.has(scope);
  }
}
