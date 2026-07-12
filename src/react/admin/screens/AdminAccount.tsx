import React from "react";

import { GjuCard } from "../../design-system";
import type { LegacyState, ReactAdminActions } from "../../platform/types";
import { fieldValue, stopSubmit } from "./adminScreenUtils";

type AdminAccountProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

export function AdminAccount({ state, actions }: AdminAccountProps) {
  const user = state.user || {};

  const submitProfile = stopSubmit(async (form) => {
    const payload = {
      name: fieldValue(form, "name"),
      email: fieldValue(form, "email"),
      phone: fieldValue(form, "phone")
    };
    await actions.updateAccount(payload);
  });

  const submitPassword = stopSubmit(async (form) => {
    const currentPassword = fieldValue(form, "currentPassword");
    const nextPassword = fieldValue(form, "nextPassword");
    const nextPasswordConfirm = fieldValue(form, "nextPasswordConfirm");
    if (nextPassword !== nextPasswordConfirm) {
      actions.notify("새 비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    await actions.changeAccountPassword(currentPassword, nextPassword);
    form.reset();
  });

  return (
    <section className="grid admin-react-screen">
      <GjuCard title="내 정보" eyebrow="계정">
        <form className="admin-react-form-grid" onSubmit={submitProfile}>
          <label>
            이름
            <input className="input" name="name" defaultValue={user.name || ""} required />
          </label>
          <label>
            이메일
            <input className="input" name="email" type="email" defaultValue={user.email || ""} required />
          </label>
          <label>
            연락처
            <input className="input" name="phone" defaultValue={user.phone || ""} />
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            내 정보 저장
          </button>
        </form>
      </GjuCard>
      <GjuCard title="비밀번호 변경" eyebrow="보안">
        <form className="admin-react-form-grid" onSubmit={submitPassword}>
          <label>
            현재 비밀번호
            <input className="input" name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label>
            새 비밀번호
            <input className="input" name="nextPassword" type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <label>
            새 비밀번호 확인
            <input className="input" name="nextPasswordConfirm" type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            비밀번호 변경
          </button>
        </form>
      </GjuCard>
    </section>
  );
}
