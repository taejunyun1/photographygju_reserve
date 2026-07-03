import type { GjuIconName } from "../design-system";
import type { ReactAdminActions } from "./types";

export type AdminHeaderAction = {
  key: "account" | "refresh" | "logout";
  label: string;
  icon: GjuIconName;
  tone?: "neutral" | "danger";
  onSelect: () => Promise<void> | void;
};

export function adminHeaderActions(actions: ReactAdminActions): AdminHeaderAction[] {
  return [
    {
      key: "account",
      label: "내 정보",
      icon: "user",
      onSelect: () => actions.setAdminView("account")
    },
    {
      key: "refresh",
      label: "새로고침",
      icon: "refresh",
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
