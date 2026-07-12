import React, { useState } from "react";

import { GjuButton, GjuCard, GjuDialog, GjuStatusBadge } from "../../design-system";
import { ScreenHeader } from "../components/StudentPrimitives";
import type {
  StudentAccountDeletion,
  StudentActions,
  StudentPasswordChange,
  StudentProfileUpdate,
  StudentState,
  StudentUser
} from "../types";

type PasswordFormState = StudentPasswordChange & { confirmPassword: string };
type AccountDeletionFormState = { currentPassword: string; confirmText: string };

const APPROVAL_LABELS: Record<string, string> = {
  approval_pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "대여금지"
};

const NOTIFICATION_PERMISSION_LABELS: Record<string, string> = {
  granted: "허용됨",
  denied: "거부됨",
  prompt: "확인 필요",
  "prompt-with-rationale": "설명 후 확인 필요",
  unknown: "확인 중"
};

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function profilePayload(profile: StudentProfileUpdate): StudentProfileUpdate {
  const name = profile.name.trim();
  if (!name) throw new Error("이름을 입력하세요.");
  return { name, phone: profile.phone.trim() };
}

function passwordPayload(form: PasswordFormState): StudentPasswordChange {
  if (!form.currentPassword) throw new Error("현재 비밀번호를 입력하세요.");
  if (form.newPassword.length < 8) throw new Error("새 비밀번호는 8자 이상 입력하세요.");
  if (form.newPassword !== form.confirmPassword) throw new Error("새 비밀번호 확인이 일치하지 않습니다.");
  return { currentPassword: form.currentPassword, newPassword: form.newPassword };
}

function deletionPayload(form: AccountDeletionFormState): StudentAccountDeletion {
  if (!form.currentPassword) throw new Error("현재 비밀번호를 입력하세요.");
  if (form.confirmText.trim() !== "계정 삭제") throw new Error("확인 문구에 '계정 삭제'를 입력하세요.");
  return { currentPassword: form.currentPassword, confirmText: "계정 삭제" };
}

export async function submitProfileUpdate(actions: StudentActions, profile: StudentProfileUpdate): Promise<void> {
  await actions.updateProfile(profilePayload(profile));
}

export async function submitPasswordChange(actions: StudentActions, form: PasswordFormState): Promise<void> {
  await actions.changePassword(passwordPayload(form));
}

export async function submitAccountDeletion(actions: StudentActions, form: AccountDeletionFormState): Promise<void> {
  await actions.deleteAccount(deletionPayload(form));
}

function FormMessage({ error, success }: { error: string; success: string }) {
  if (error) return <p className="student-react-submit-error" role="alert">{error}</p>;
  return success ? <p className="student-react-form-success" role="status">{success}</p> : null;
}

function ProfileForm({ user, actions }: { user: StudentUser; actions: StudentActions }) {
  const [form, setForm] = useState<StudentProfileUpdate>({ name: user.name || "", phone: user.phone || "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <GjuCard title="개인정보 수정">
      <form className="report-form" onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError("");
        setSuccess("");
        try {
          await submitProfileUpdate(actions, form);
          setSuccess("개인정보를 저장했습니다.");
        } catch (submissionError) {
          setError(messageFrom(submissionError));
        } finally {
          setPending(false);
        }
      }}>
        <div className="field"><label htmlFor="student-profile-name">이름</label><input id="student-profile-name" className="input" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
        <div className="field"><label htmlFor="student-profile-phone">연락처</label><input id="student-profile-phone" className="input" inputMode="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div>
        <FormMessage error={error} success={success} />
        <GjuButton type="submit" icon="check" loading={pending}>개인정보 저장</GjuButton>
      </form>
    </GjuCard>
  );
}

function PasswordForm({ actions }: { actions: StudentActions }) {
  const [form, setForm] = useState<PasswordFormState>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <GjuCard title="비밀번호 변경">
      <form className="report-form" onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError("");
        try {
          await submitPasswordChange(actions, form);
          setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (submissionError) {
          setError(messageFrom(submissionError));
        } finally {
          setPending(false);
        }
      }}>
        <div className="field"><label htmlFor="student-current-password">현재 비밀번호</label><input id="student-current-password" className="input" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} /></div>
        <div className="field"><label htmlFor="student-new-password">새 비밀번호</label><input id="student-new-password" className="input" type="password" autoComplete="new-password" minLength={8} required value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} /></div>
        <div className="field"><label htmlFor="student-confirm-password">새 비밀번호 확인</label><input id="student-confirm-password" className="input" type="password" autoComplete="new-password" minLength={8} required value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></div>
        <FormMessage error={error} success="" />
        <GjuButton type="submit" icon="check" loading={pending}>비밀번호 변경</GjuButton>
      </form>
    </GjuCard>
  );
}

function DeleteAccountForm({ actions }: { actions: StudentActions }) {
  const [form, setForm] = useState<AccountDeletionFormState>({ currentPassword: "", confirmText: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  function closeDialog() {
    if (!pending) setConfirmOpen(false);
  }
  return (
    <GjuCard title="계정 삭제" className="account-delete-card">
      <p className="muted warning-text">삭제하면 예약, 보고서, 특강 신청, 알림 설정이 함께 정리되며 되돌릴 수 없습니다.</p>
      <form className="report-form account-delete-form" onSubmit={(event) => {
        event.preventDefault();
        setError("");
        try {
          deletionPayload(form);
          setConfirmOpen(true);
        } catch (validationError) {
          setError(messageFrom(validationError));
        }
      }}>
        <div className="field"><label htmlFor="student-delete-password">현재 비밀번호</label><input id="student-delete-password" className="input" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} /></div>
        <div className="field"><label htmlFor="student-delete-confirm">확인 문구</label><input id="student-delete-confirm" className="input" placeholder="계정 삭제" autoComplete="off" required value={form.confirmText} onChange={(event) => setForm((current) => ({ ...current, confirmText: event.target.value }))} /></div>
        <FormMessage error={error} success="" />
        <GjuButton type="submit" tone="danger" icon="trash">계정 삭제</GjuButton>
      </form>
      <GjuDialog
        open={confirmOpen}
        title="계정을 영구 삭제할까요?"
        tone="danger"
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        onClose={closeDialog}
        onCancel={closeDialog}
        onConfirm={async () => {
          if (pending) return;
          setPending(true);
          setError("");
          try {
            await submitAccountDeletion(actions, form);
          } catch (submissionError) {
            setError(messageFrom(submissionError));
            setConfirmOpen(false);
          } finally {
            setPending(false);
          }
        }}
      >
        <p>예약, 보고서, 특강 신청 기록도 함께 삭제됩니다.</p>
      </GjuDialog>
    </GjuCard>
  );
}

function NotificationSettings({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const notifications = state.nativeNotifications;
  const [operation, setOperation] = useState<"" | "enable" | "sync" | "disable">("");
  const preferred = Boolean(notifications?.enabled);
  const effective = Boolean(notifications?.effective ?? notifications?.enabled);
  async function run(nextOperation: "enable" | "sync" | "disable", action: () => Promise<void> | void) {
    if (operation) return;
    setOperation(nextOperation);
    try {
      await action();
    } finally {
      setOperation("");
    }
  }
  return (
    <GjuCard title="네이티브 예약 알림" className="native-notification-card">
      <p className="muted">예약 접수와 사용 전 알림을 기기에서 받을 수 있습니다.</p>
      <div className="native-notification-grid">
        <div><span>권한</span><strong>{NOTIFICATION_PERMISSION_LABELS[notifications?.permission || "unknown"] || "확인 중"}</strong></div>
        <div><span>상태</span><strong>{effective ? "켜짐" : preferred ? "권한 필요" : "꺼짐"}</strong></div>
        <div><span>예정 알림</span><strong>{notifications?.pendingCount || 0}개</strong></div>
      </div>
      {notifications?.permission === "denied" ? <p className="muted">기기 설정에서 이 앱의 알림 권한을 허용한 뒤 다시 동기화하세요.</p> : null}
      {notifications?.supported ? (
        <div className="row-actions">
          {preferred ? (
            <>
              <GjuButton icon="refresh" loading={operation === "sync"} disabled={Boolean(operation)} onClick={() => void run("sync", actions.syncNotifications)}>동기화</GjuButton>
              <GjuButton variant="ghost" loading={operation === "disable"} disabled={Boolean(operation)} onClick={() => void run("disable", actions.disableNotifications)}>끄기</GjuButton>
            </>
          ) : <GjuButton icon="check" loading={operation === "enable"} disabled={Boolean(operation)} onClick={() => void run("enable", actions.enableNotifications)}>알림 켜기</GjuButton>}
        </div>
      ) : <p className="muted">iOS/Android 앱에서 설치 후 사용할 수 있습니다.</p>}
      {notifications?.error ? <p className="student-react-submit-error" role="alert">{notifications.error}</p> : null}
    </GjuCard>
  );
}

export function MySettingsScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const approvalTone = state.user.approvalStatus === "approved" ? "green" : state.user.approvalStatus === "rejected" ? "red" : "amber";
  const userKey = state.user.id || state.user.email || state.user.studentId || state.user.name;
  return (
    <section className="grid student-react-settings">
      <ScreenHeader title="마이" description="계정과 알림 설정을 관리합니다." />
      <GjuCard title={state.user.name}>
        <div className="property-list">
          <div><span>승인</span><GjuStatusBadge tone={approvalTone}>{APPROVAL_LABELS[state.user.approvalStatus || ""] || state.user.approvalStatus || "확인 중"}</GjuStatusBadge></div>
          <div><span>학번</span><strong>{state.user.studentId || "-"}</strong></div>
          <div><span>학년</span><strong>{state.user.grade || "-"}</strong></div>
          <div><span>신분</span><strong>{state.user.studentStatus || "-"}</strong></div>
          <div><span>이메일</span><strong>{state.user.email || "-"}</strong></div>
          <div><span>연락처</span><strong>{state.user.phone || "-"}</strong></div>
        </div>
      </GjuCard>
      <NotificationSettings state={state} actions={actions} />
      <ProfileForm key={`profile:${userKey}`} user={state.user} actions={actions} />
      <PasswordForm key={`password:${userKey}`} actions={actions} />
      <DeleteAccountForm key={`delete:${userKey}`} actions={actions} />
      <GjuCard title="개인정보 및 데이터">
        <div className="student-react-link-actions">
          <a className="button ghost" href="/privacy.html" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>
          <a className="button ghost" href="/account-deletion.html" target="_blank" rel="noopener noreferrer">계정 및 데이터 삭제 안내</a>
        </div>
      </GjuCard>
      <GjuButton tone="danger" icon="logOut" onClick={() => void actions.logout()}>로그아웃</GjuButton>
    </section>
  );
}
