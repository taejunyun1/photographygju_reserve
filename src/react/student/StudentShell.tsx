import React, { useEffect, useRef } from "react";

import { GjuAppShell, GjuIcon, GjuIconButton } from "../design-system";
import type { StudentActions, StudentNavKey, StudentState } from "./types";

type StudentShellProps = {
  state: StudentState;
  actions: StudentActions;
  children: React.ReactNode;
};

const NAV_ITEMS: ReadonlyArray<readonly [StudentNavKey, string, "camera" | "refresh" | "fileText" | "calendar" | "user"]> = [
  ["home", "홈", "camera"],
  ["mine", "내 예약", "refresh"],
  ["reports", "보고서", "fileText"],
  ["lectures", "특강", "calendar"],
  ["notices", "공지", "fileText"]
];

const PAGE_TITLES: Record<StudentNavKey, string> = {
  home: "홈",
  reserve: "예약",
  mine: "내 예약",
  reports: "보고서",
  lectures: "비교과 특강",
  notices: "공지사항",
  my: "마이"
};

function run(action: () => Promise<void> | void) {
  void action();
}

function StudentNav({ state, actions, mobile = false }: { state: StudentState; actions: StudentActions; mobile?: boolean }) {
  return (
    <nav className={mobile ? "mobile-nav student-react-bottom-nav" : "desktop-nav student-react-desktop-nav"} aria-label="학생 메뉴">
      {NAV_ITEMS.map(([key, label, icon]) => (
        <button
          key={key}
          type="button"
          className={state.view === key ? "active student-react-nav__item" : "student-react-nav__item"}
          aria-current={state.view === key ? "page" : undefined}
          aria-label={label}
          title={label}
          data-student-view={key}
          onClick={() => run(() => actions.setView(key))}
        >
          <GjuIcon name={icon} className="student-react-nav__icon" />
          {!mobile ? <span>{label}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export function StudentShell({ state, actions, children }: StudentShellProps) {
  const title = PAGE_TITLES[state.view];
  const mobileHeadingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobileHeading = mobileHeadingRef.current;
    const contentHeading = contentRef.current?.querySelector("h1");
    const target = mobileHeading?.getClientRects().length ? mobileHeading : contentHeading;
    if (!(target instanceof HTMLElement)) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [state.view]);

  return (
    <GjuAppShell
      className="student-shell student-react-shell"
      desktopNav={<StudentNav state={state} actions={actions} />}
      header={
        <div className="top-appbar student-react-header">
          <div className="appbar-brand">
            <div className="brand-mark" aria-hidden="true">G</div>
            <div>
              <strong>GJU Photography</strong>
              <span>사진영상미디어학과 예약</span>
            </div>
          </div>
          <div className="student-appbar-actions">
            <button
              type="button"
              className="student-status-chip"
              onClick={() => run(actions.openAccount)}
              aria-label="마이 페이지 열기"
            >
              <strong>{state.user.name}</strong>
              <span>{state.user.studentStatus || "학생"}</span>
            </button>
            <GjuIconButton label="새로고침" icon="refresh" onClick={() => run(actions.refresh)} />
            <GjuIconButton label="나가기" icon="logOut" onClick={() => run(actions.logout)} />
          </div>
        </div>
      }
      mobileHeader={
        <div className="mobile-top student-react-mobile-header">
          <div className="student-react-mobile-header__title">
            <h1 ref={mobileHeadingRef} tabIndex={-1}>{title}</h1>
            <p className="sr-only">GJU Photography 예약</p>
          </div>
          <div className="student-react-mobile-header__actions">
            <GjuIconButton label="마이 페이지" icon="user" onClick={() => run(actions.openAccount)} />
          </div>
        </div>
      }
      mobileBottomNav={<StudentNav state={state} actions={actions} mobile />}
    >
      <div ref={contentRef} className="student-react-view">
        {children}
      </div>
    </GjuAppShell>
  );
}
