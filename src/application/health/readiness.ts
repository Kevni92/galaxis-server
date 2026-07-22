export type ReadinessResult = Readonly<{ ready: true }> | Readonly<{ ready: false }>;

/** Port used by the HTTP adapter to check infrastructure without knowing its implementation. */
export interface ReadinessProbe {
  check(): Promise<ReadinessResult>;
}

/** A0 has no external infrastructure yet; Issue #4 will replace this with a database probe. */
export class NoExternalDependenciesReadinessProbe implements ReadinessProbe {
  public async check(): Promise<ReadinessResult> {
    return { ready: true };
  }
}
