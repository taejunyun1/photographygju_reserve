type LegacyAdminPanelProps = {
  renderHtml: () => string;
};

const LEGACY_CHROME_CLASS_NAMES = [
  "admin-mobile-header",
  "admin-header",
  "admin-mobile-nav",
  "sidebar"
] as const;

const VOID_TAG_NAMES = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

type TagMatch = {
  tagName: string;
  openStart: number;
  openEnd: number;
};

type TagBounds = {
  innerStart: number;
  innerEnd: number;
  end: number;
};

function findElementByClasses(html: string, classNames: readonly string[], startIndex = 0): TagMatch | null {
  const classSet = new Set(classNames);
  const tagPattern = /<([a-z0-9:-]+)\b([^>]*)>/gi;
  tagPattern.lastIndex = startIndex;

  for (let match = tagPattern.exec(html); match; match = tagPattern.exec(html)) {
    const classMatch = match[2]?.match(/\bclass\s*=\s*(['"])(.*?)\1/i);
    if (!classMatch) continue;

    const classes = classMatch[2].split(/\s+/).filter(Boolean);
    if (!classes.some((className) => classSet.has(className))) continue;

    return {
      tagName: match[1].toLowerCase(),
      openStart: match.index,
      openEnd: tagPattern.lastIndex
    };
  }

  return null;
}

function isSelfClosingTag(tagName: string, tagMarkup: string) {
  return VOID_TAG_NAMES.has(tagName) || /\/\s*>$/.test(tagMarkup);
}

function findElementBounds(html: string, match: TagMatch): TagBounds | null {
  const openTagMarkup = html.slice(match.openStart, match.openEnd);
  if (isSelfClosingTag(match.tagName, openTagMarkup)) {
    return {
      innerStart: match.openEnd,
      innerEnd: match.openEnd,
      end: match.openEnd
    };
  }

  const tagPattern = new RegExp(`<(/?)${match.tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = match.openEnd;

  let depth = 1;
  for (let nestedMatch = tagPattern.exec(html); nestedMatch; nestedMatch = tagPattern.exec(html)) {
    const tagMarkup = nestedMatch[0];
    const isClosingTag = nestedMatch[1] === "/";

    if (isClosingTag) {
      depth -= 1;
      if (depth === 0) {
        return {
          innerStart: match.openEnd,
          innerEnd: nestedMatch.index,
          end: tagPattern.lastIndex
        };
      }
      continue;
    }

    if (!isSelfClosingTag(match.tagName, tagMarkup)) {
      depth += 1;
    }
  }

  return null;
}

function stripChromeElementsFromMarkup(html: string) {
  let result = "";
  let cursor = 0;

  while (cursor < html.length) {
    const chromeMatch = findElementByClasses(html, LEGACY_CHROME_CLASS_NAMES, cursor);
    if (!chromeMatch) {
      result += html.slice(cursor);
      break;
    }

    result += html.slice(cursor, chromeMatch.openStart);

    const chromeBounds = findElementBounds(html, chromeMatch);
    if (!chromeBounds) {
      return html;
    }

    cursor = chromeBounds.end;
  }

  return result.trim();
}

function stripLegacyAdminChromeWithTemplate(html: string) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }

  const template = document.createElement("template");
  if (!("content" in template)) {
    return null;
  }

  template.innerHTML = html;

  const legacyShell = template.content.querySelector(".admin-shell");
  if (!legacyShell) {
    return html;
  }

  const legacyMain = legacyShell.querySelector(".admin-main");
  if (!legacyMain) {
    return html;
  }

  for (const className of LEGACY_CHROME_CLASS_NAMES) {
    legacyMain.querySelectorAll(`.${className}`).forEach((node) => node.remove());
  }

  return legacyMain.innerHTML.trim();
}

function stripLegacyAdminChromeWithoutDocument(html: string) {
  const legacyShell = findElementByClasses(html, ["admin-shell"]);
  if (!legacyShell) {
    return html;
  }

  const legacyShellBounds = findElementBounds(html, legacyShell);
  if (!legacyShellBounds) {
    return html;
  }

  const legacyMain = findElementByClasses(html, ["admin-main"], legacyShellBounds.innerStart);
  if (!legacyMain || legacyMain.openStart >= legacyShellBounds.innerEnd) {
    return html;
  }

  const legacyMainBounds = findElementBounds(html, legacyMain);
  if (!legacyMainBounds || legacyMainBounds.end > legacyShellBounds.innerEnd) {
    return html;
  }

  return stripChromeElementsFromMarkup(html.slice(legacyMainBounds.innerStart, legacyMainBounds.innerEnd));
}

function stripLegacyAdminChrome(html: string) {
  return stripLegacyAdminChromeWithTemplate(html) ?? stripLegacyAdminChromeWithoutDocument(html);
}

export function LegacyAdminPanel({ renderHtml }: LegacyAdminPanelProps) {
  return (
    <div
      className="gju-legacy-admin-panel"
      dangerouslySetInnerHTML={{ __html: stripLegacyAdminChrome(renderHtml()) }}
    />
  );
}
