import React from "react";

export type GjuIconName =
  | "refresh"
  | "user"
  | "logOut"
  | "trash"
  | "check"
  | "x"
  | "camera"
  | "fileText"
  | "userPlus"
  | "edit"
  | "plus";

type GjuIconProps = {
  name: GjuIconName;
  className?: string;
  title?: string;
};

function path(
  d: string,
  key: string,
  extra: Record<string, string | number> = {}
) {
  return React.createElement("path", {
    d,
    key,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    ...extra
  });
}

function circle(
  cxValue: number,
  cyValue: number,
  radius: number,
  key: string
) {
  return React.createElement("circle", {
    key,
    cx: cxValue,
    cy: cyValue,
    r: radius,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8
  });
}

function iconPaths(name: GjuIconName): React.ReactNode[] {
  switch (name) {
    case "refresh":
      return [
        path("M20 5v5h-5", "refresh-1"),
        path("M4 19v-5h5", "refresh-2"),
        path("M18.4 10A8 8 0 0 0 6.7 6.3L4 10", "refresh-3"),
        path("M5.6 14A8 8 0 0 0 17.3 17.7L20 14", "refresh-4")
      ];
    case "user":
      return [
        circle(12, 8, 3.5, "user-1"),
        path("M5 20a7 7 0 0 1 14 0", "user-2")
      ];
    case "logOut":
      return [
        path("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "logout-1"),
        path("M16 17l5-5-5-5", "logout-2"),
        path("M21 12H9", "logout-3")
      ];
    case "trash":
      return [
        path("M4 7h16", "trash-1"),
        path("M10 11v6", "trash-2"),
        path("M14 11v6", "trash-3"),
        path("M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13", "trash-4"),
        path("M9 4h6", "trash-5")
      ];
    case "check":
      return [path("M5 12.5l4.5 4.5L19 7.5", "check-1")];
    case "x":
      return [
        path("M6 6l12 12", "x-1"),
        path("M18 6 6 18", "x-2")
      ];
    case "camera":
      return [
        path("M4 8h4l2-3h4l2 3h4v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "camera-1"),
        circle(12, 13.5, 3.5, "camera-2")
      ];
    case "fileText":
      return [
        path("M8 3h6l5 5v13a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2", "file-1"),
        path("M14 3v5h5", "file-2"),
        path("M9 13h6", "file-3"),
        path("M9 17h6", "file-4")
      ];
    case "userPlus":
      return [
        circle(10, 8.5, 3.5, "userplus-1"),
        path("M4.5 19a5.5 5.5 0 0 1 11 0", "userplus-2"),
        path("M19 8v6", "userplus-3"),
        path("M16 11h6", "userplus-4")
      ];
    case "edit":
      return [
        path("M4 20h4l10-10-4-4L4 16z", "edit-1"),
        path("M13 5l4 4", "edit-2"),
        path("M15 3l4 4", "edit-3")
      ];
    case "plus":
      return [
        path("M12 5v14", "plus-1"),
        path("M5 12h14", "plus-2")
      ];
  }
}

export function GjuIcon({ name, className, title }: GjuIconProps) {
  const children: React.ReactNode[] = [...iconPaths(name)];
  if (title) {
    children.unshift(React.createElement("title", { key: "title" }, title));
  }

  return React.createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      className,
      width: 18,
      height: 18,
      fill: "none",
      "aria-hidden": title ? undefined : true,
      role: title ? "img" : "presentation"
    },
    ...children
  );
}
