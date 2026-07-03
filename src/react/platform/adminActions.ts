import type { GjuIconName } from "../design-system";
import type { ReactAdminActions } from "./types";

export type AdminHeaderAction = {
  key: "account" | "refresh" | "logout";
  label: string;
  icon: GjuIconName;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  ariaBusy?: boolean;
  onSelect: () => Promise<void> | void;
};

export function adminHeaderActions(
  actions: ReactAdminActions,
  { refreshing = false }: { refreshing?: boolean } = {}
): AdminHeaderAction[] {
  return [
    {
      key: "account",
      label: "내 정보",
      icon: "user",
      onSelect: () => actions.setAdminView("account")
    },
    {
      key: "refresh",
      label: refreshing ? "새로고침 중" : "새로고침",
      icon: "refresh",
      disabled: refreshing,
      ariaBusy: refreshing,
      onSelect: () => actions.refreshAdminData()
    },
    {
      key: "logout",
      label: "나가기",
      icon: "logOut",
      tone: "danger",
      onSelect: () => actions.logout()
    }
  ];
}
