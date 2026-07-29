export const CATEGORY_CODES = Object.freeze({
  Body: "CAM",
  Lens: "LEN",
  Lighting: "LGT",
  Audio: "AUD",
  Drone: "DRN",
  Other: "ETC"
});

const CATEGORY_ALIASES = Object.freeze({
  body: "Body",
  camera: "Body",
  바디: "Body",
  카메라: "Body",
  lens: "Lens",
  렌즈: "Lens",
  lighting: "Lighting",
  light: "Lighting",
  조명: "Lighting",
  audio: "Audio",
  오디오: "Audio",
  drone: "Drone",
  드론: "Drone",
  other: "Other",
  기타: "Other"
});

export const BRAND_ALIASES = Object.freeze([
  { code: "SNY", brand: "Sony", aliases: ["SONY", "소니"] },
  { code: "CAN", brand: "Canon", aliases: ["CANON", "캐논"] },
  { code: "SIG", brand: "Sigma", aliases: ["SIGMA", "시그마"] },
  { code: "NIK", brand: "Nikon", aliases: ["NIKON", "니콘"] },
  { code: "LEI", brand: "Leica", aliases: ["LEICA", "라이카"] },
  { code: "SAM", brand: "Samyang", aliases: ["SAMYANG", "삼양"] },
  { code: "APT", brand: "Aputure", aliases: ["APUTURE"] },
  { code: "ROD", brand: "Rode", aliases: ["RODE", "RØDE", "로데"] },
  { code: "ZOM", brand: "Zoom", aliases: ["ZOOM"] },
  { code: "ATM", brand: "Atomos", aliases: ["ATOMOS", "아토모스"] },
  { code: "PFT", brand: "Profoto", aliases: ["PROFOTO", "프로포토"] },
  { code: "DJI", brand: "DJI", aliases: ["DJI"] },
  { code: "GIT", brand: "Gitzo", aliases: ["GITZO", "짓조"] },
  { code: "BEL", brand: "Belden", aliases: ["BELDEN", "벨덴"] },
  { code: "SEN", brand: "Sennheiser", aliases: ["SENNHEISER", "젠하이저"] },
  { code: "FOM", brand: "Fomex", aliases: ["FOMEX", "포맥스"] },
  { code: "TAS", brand: "Tascam", aliases: ["TASCAM"] },
  { code: "HAR", brand: "Harman", aliases: ["HARMAN", "하만"] },
  { code: "SEK", brand: "Sekonic", aliases: ["SEKONIC", "세코닉"] },
  { code: "HRS", brand: "Horusbennu", aliases: ["HORUSBENNU", "호르스벤누"] },
  { code: "PEL", brand: "Pelican", aliases: ["PELICAN", "펠리칸"] },
  { code: "BWP", brand: "B+W", aliases: ["B+W", "BW"] }
]);

const PRODUCT_ALIASES = Object.freeze([
  [/매빅\s*2\s*프로|MAVIC\s*2\s*PRO/i, "MAVIC2PRO"],
  [/매빅\s*2\s*줌|MAVIC\s*2\s*ZOOM/i, "MAVIC2ZOOM"],
  [/매빅\s*에어|MAVIC\s*AIR/i, "MAVICAIR"],
  [/매빅\s*3|MAVIC\s*3/i, "MAVIC3"],
  [/스파크|SPARK/i, "SPARK"],
  [/카메라\s*어댑터\s*카메라\s*고정용|카메라\s*고정용.*360|360.*카메라\s*고정용/i, "360CAMADPT"],
  [/카메라\s*어댑터\s*삼각대\s*고정용|삼각대\s*고정용.*360|360.*삼각대\s*고정용/i, "360TRIPODADPT"],
  [/오즈모\s*포켓|OSMO\s*POCKET/i, "OSMOPOCKET"],
  [/오즈모\s*짐벌|OSMO\s*GIMBAL/i, "OSMOGIMBAL"],
  [/붐\s*마이크\s*폴|BOOM\s*POLE/i, "BOOMPOLE"],
  [/샷건\s*마이크|샷건마이크|SHOTGUN/i, "SHOTGUN"],
  [/쇼크\s*마운트|SHOCK\s*MOUNT/i, "SHOCKMOUNT"],
  [/블림프|BLIMP/i, "BLIMP"],
  [/미확인\s*렌즈|UNKNOWN\s*LENS/i, "UNKNOWNLENS"],
  [/펠리칸\s*케이스\s*1510|PELICAN\s*CASE\s*1510/i, "CASE1510"],
  [/삼각대|TRIPOD/i, "TRIPOD"],
  [/노출계|EXPOSURE\s*METER/i, "EXPOSUREMETER"],
  [/스팟\s*미터|스팟미터|SPOT\s*METER/i, "SPOTMETER"],
  [/컬러\s*미터|컬러미터|COLOR\s*METER/i, "COLORMETER"],
  [/셔틀러|SHUTTLER/i, "SHUTTLER"],
  [/전동\s*슬라이더|SLIDER/i, "SLIDER"],
  [/장비|EQUIPMENT/i, "EQUIPMENT"]
]);

const PRODUCT_NOISE = /\b(BODY|LENS|CAMERA|LIGHTING|LIGHT|AUDIO|DRONE)\b|카메라|바디|렌즈|조명|오디오|드론|마이크/g;

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function searchText(value) {
  return text(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9가-힣+]+/g, " ")
    .trim();
}

function compact(value) {
  return searchText(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeTags(value) {
  const values = Array.isArray(value) ? value : text(value).split(/[|,]/);
  return [...new Set(values.map(text).filter(Boolean))];
}

function normalizeModel(value) {
  return searchText(value)
    .replace(/A7\s*(?:MARK\s*)?(?:III|3)/g, "A7M3")
    .replace(/A7MIII/g, "A7M3")
    .replace(/(\d+)\s+(\d+)\s*MM/g, "$1$2")
    .replace(/(\d+)\s*MM/g, "$1")
    .replace(/F\s*2\s*8/g, "F28")
    .replace(/F\s*3\s*5\s+5\s*6/g, "F3556")
    .replace(/\s+/g, "");
}

function categoryFor(input) {
  const explicit = text(input.category);
  const canonical = CATEGORY_CODES[explicit]
    ? explicit
    : CATEGORY_ALIASES[explicit.toLowerCase()];
  if (canonical) return canonical;

  const source = searchText([
    input.name,
    input.model,
    ...normalizeTags(input.functionTags)
  ].join(" "));
  if (/렌즈|LENS|MACRO|\bGM\b|\d+\s*MM/.test(source)) return "Lens";
  if (/마이크|레코더|XLR|AUDIO|RECORDER/.test(source)) return "Audio";
  if (/조명|라이트|LED|FLASH|LIGHT/.test(source)) return "Lighting";
  if (/드론|매빅|MAVIC|SPARK|DRONE/.test(source)) return "Drone";
  if (/카메라|BODY|EOS|CAMERA/.test(source)) return "Body";
  return "Other";
}

function matchingBrand(value) {
  const source = searchText(value);
  const matches = [];
  for (const entry of BRAND_ALIASES) {
    for (const alias of entry.aliases) {
      const index = source.lastIndexOf(searchText(alias));
      if (index >= 0) matches.push({ entry, index });
    }
  }
  matches.sort((left, right) => right.index - left.index);
  return matches[0]?.entry || null;
}

function brandFor(input) {
  const explicit = text(input.brand);
  const match = matchingBrand(explicit) || matchingBrand(input.name);
  if (match) return { brand: match.brand, brandCode: match.code, warning: "" };

  const asciiBrand = compact(explicit);
  if (asciiBrand) {
    return {
      brand: explicit,
      brandCode: asciiBrand.slice(0, 3).padEnd(3, "X"),
      warning: ""
    };
  }
  return {
    brand: "Generic",
    brandCode: "GEN",
    warning: "브랜드 정보를 확인하세요."
  };
}

function productAlias(value) {
  const source = text(value);
  return PRODUCT_ALIASES.find(([pattern]) => pattern.test(source))?.[1] || "";
}

function productKeyFor(input) {
  const raw = text(input.model) || text(input.name);
  const alias = productAlias(raw);
  if (alias) return alias;

  let candidate = searchText(raw);
  for (const entry of BRAND_ALIASES) {
    for (const brandAlias of entry.aliases) {
      candidate = candidate.replaceAll(searchText(brandAlias), " ");
    }
  }
  candidate = candidate.replace(PRODUCT_NOISE, " ");
  return compact(normalizeModel(candidate)).slice(0, 16);
}

export function inferEquipmentIdentity(input = {}) {
  const category = categoryFor(input);
  const brand = brandFor(input);
  const productKey = productKeyFor(input);
  const warnings = [brand.warning].filter(Boolean);
  if (!productKey) warnings.push("제품 또는 모델 정보를 확인하세요.");
  return {
    category,
    categoryCode: CATEGORY_CODES[category],
    brand: brand.brand,
    brandCode: brand.brandCode,
    model: normalizeModel(input.model || productKey),
    productKey,
    functionTags: normalizeTags(input.functionTags),
    warnings
  };
}

function escapedRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function allocateEquipmentCodes({
  items = [],
  input = {},
  quantity = 1
} = {}) {
  const identity = inferEquipmentIdentity(input);
  const productKey = identity.productKey || "UNKNOWN";
  const prefix = `${identity.categoryCode}-${identity.brandCode}-${productKey}`;
  const matcher = new RegExp(`^${escapedRegExp(prefix)}-(\\d{3,})$`);
  const maximum = items.reduce((value, item) => {
    const match = String(item.code || "").match(matcher);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  const count = Math.max(1, Number(quantity) || 1);
  const codes = Array.from({ length: count }, (_, index) =>
    `${prefix}-${String(maximum + index + 1).padStart(3, "0")}`
  );
  return { identity, codes };
}

export function equipmentMigrationFingerprint(items = []) {
  return [...items]
    .sort((left, right) =>
      String(left.createdAt || "").localeCompare(String(right.createdAt || "")) ||
      String(left.id || "").localeCompare(String(right.id || ""))
    )
    .map((item) => `${item.id}|${item.code || ""}|${item.updatedAt || ""}`)
    .join("\n");
}

export function buildEquipmentCodeMigrationPreview(items = []) {
  const ordered = [...items].sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || "")) ||
    String(left.id || "").localeCompare(String(right.id || ""))
  );
  const counters = new Map();
  const mappings = ordered.map((item) => {
    const identity = inferEquipmentIdentity(item);
    const productKey = identity.productKey || "UNKNOWN";
    const group = `${identity.categoryCode}-${identity.brandCode}-${productKey}`;
    const sequence = (counters.get(group) || 0) + 1;
    counters.set(group, sequence);
    return {
      equipmentId: item.id,
      oldCode: String(item.code || ""),
      newCode: `${group}-${String(sequence).padStart(3, "0")}`,
      identity,
      warnings: identity.warnings
    };
  });
  return {
    fingerprint: equipmentMigrationFingerprint(ordered),
    codeVersion: 2,
    items: mappings,
    warningCount: mappings.filter((item) => item.warnings.length > 0).length
  };
}

export function equipmentSearchScore(item = {}, query = "") {
  const needle = searchText(query);
  if (!needle) return 1;
  if (searchText(item.code) === needle) return 400;
  if ((item.legacyCodes || []).some((code) => searchText(code) === needle)) {
    return 350;
  }
  if ([item.name, item.model, item.productKey]
    .some((value) => searchText(value).includes(needle))) {
    return 200;
  }
  if ([
    item.brand,
    item.brandCode,
    item.category,
    item.facility,
    item.source,
    item.notes,
    ...(item.functionTags || [])
  ].some((value) => searchText(value).includes(needle))) {
    return 100;
  }
  return 0;
}
