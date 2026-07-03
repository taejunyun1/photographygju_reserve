import { useEffect, useRef } from "react";

type LegacyAdminPanelProps = {
  renderHtml: () => string;
};

export function LegacyAdminPanel({ renderHtml }: LegacyAdminPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = renderHtml();
    }
  });

  return <div className="gju-legacy-admin-panel" ref={ref} />;
}
