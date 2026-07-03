export type LegacyState = Record<string, unknown> & {
  adminView?: string;
  adminRefresh?: { refreshing?: boolean };
  user?: { role?: string; name?: string; email?: string; studentId?: string };
  summary?: Record<string, unknown> | null;
  adminUsers?: unknown[];
  adminEquipment?: unknown[];
  adminSessions?: unknown[];
  adminLogs?: unknown[];
};

export type ReactAdminActions = {
  setAdminView(view: string): Promise<void> | void;
  refreshAdminData(): Promise<void>;
  logout(): Promise<void> | void;
  render(): void;
};

export type ReactAdminMountOptions = {
  root: HTMLElement;
  state: LegacyState;
  actions: ReactAdminActions;
  legacyRenderAdminContent: () => string;
};

declare global {
  interface Window {
    GJU_REACT_ADMIN_ENABLED?: boolean;
    GJUReactAdmin?: {
      mount(options: ReactAdminMountOptions): void;
      update?(options: ReactAdminMountOptions): void;
      unmount(): void;
    };
  }
}
