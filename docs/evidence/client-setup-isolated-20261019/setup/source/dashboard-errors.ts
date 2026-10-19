/** Stable failures for the fail-closed Cocos Dashboard launch boundary. */
export type DashboardErrorCode =
  | "DASHBOARD_NOT_FOUND"
  | "DASHBOARD_AUTOMATION_DENIED"
  | "DASHBOARD_WINDOW_NOT_ACCESSIBLE"
  | "DASHBOARD_PROJECT_NOT_FOUND"
  | "DASHBOARD_PROJECT_AMBIGUOUS"
  | "DASHBOARD_IMPORT_FAILED"
  | "DASHBOARD_VERSION_MISMATCH"
  | "DASHBOARD_LAUNCH_TIMEOUT"
  | "DASHBOARD_OPEN_WITHOUT_BRIDGE"
  | "DASHBOARD_UNSUPPORTED_PLATFORM";

/** Dashboard failures are never silently retried through a direct Creator launch. */
export class DashboardFault extends Error {
  readonly retryable = false;

  constructor(
    public readonly code: DashboardErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DashboardFault";
  }
}
