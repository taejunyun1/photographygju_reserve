type LegacyAdminPanelProps = {
  renderHtml: () => string;
};

function stripLegacyAdminChrome(html: string) {
  const markup = html.trim();
  const legacyShellMatch = markup.match(
    /<section class="admin-main"[^>]*>([\s\S]*?)<\/section>\s*(?:<nav class="admin-mobile-nav"[\s\S]*?<\/nav>)?[\s\S]*?<\/main>/i
  );
  const content = legacyShellMatch?.[1] || markup;

  return content
    .replace(/<header class="admin-mobile-header"[\s\S]*?<\/header>/gi, "")
    .replace(/<header class="admin-header"[\s\S]*?<\/header>/gi, "")
    .replace(/<nav class="admin-mobile-nav"[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside class="sidebar"[\s\S]*?<\/aside>/gi, "")
    .trim();
}

export function LegacyAdminPanel({ renderHtml }: LegacyAdminPanelProps) {
  return (
    <div
      className="gju-legacy-admin-panel"
      dangerouslySetInnerHTML={{ __html: stripLegacyAdminChrome(renderHtml()) }}
    />
  );
}
