# Equipment Code and Return Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 기자재 전체에 중복 없는 표준 코드를 재발급하고, 신규 장비 자동 코드 생성·통합 검색·반납 점검 상태 연동을 관리자 화면에 추가한다.

**Architecture:** 코드 정규화와 일련번호 할당은 `core/equipment-code.mjs`의 순수 함수로 격리한다. `core.mjs`는 관리자 API, 트랜잭션 단위 데이터 변경, 감사 로그를 담당하고 JSON/SQLite 저장소는 마이그레이션 및 검사 기록 컬렉션을 보존한다. React 관리자 화면은 기존 `renderer.js` 액션 브리지를 통해 미리보기·적용·반납 검사를 호출한다.

**Tech Stack:** Node.js 18+ ESM, Cloudflare Worker, Durable Objects SQLite, React 19, TypeScript 6, 자체 Node `assert` 테스트, Playwright 1.61

## Global Constraints

- QR 코드와 실물 라벨 기능은 만들지 않는다.
- 신규 코드는 `[분류]-[브랜드]-[제품키]-[3자리 일련번호]` 형식이다.
- 코드 예시는 `CAM-SNY-A7M3-001`이며 보관 장소는 코드에 포함하지 않는다.
- 기존 장비 전체를 신규 코드 체계 `codeVersion: 2`로 재발급한다.
- 예약 연결은 표시 코드가 아니라 기존 `equipment.id`를 계속 사용한다.
- 기존 코드는 `legacyCodes`에 보존하고 관리자 검색에서만 사용한다.
- 삭제·비활성 장비의 일련번호를 재사용하지 않는다.
- 코드 적용과 반납 점검은 부분 성공 없이 하나의 저장 트랜잭션으로 처리한다.
- 파손·수리 필요 결과에는 사유가 반드시 있어야 한다.
- 새로운 런타임 의존성을 추가하지 않는다.
- 기존 작업 트리의 관련 없는 수정 파일은 변경하거나 커밋하지 않는다.

---

## File Structure

### 새 파일

- `core/equipment-code.mjs`: 브랜드·분류·모델 정규화, 제품키 생성, 코드 할당, 마이그레이션 미리보기, 검색 점수
- `scripts/equipment-code-domain-test.mjs`: 코드 생성 순수 함수 단위 테스트
- `scripts/equipment-operations-api-test.mjs`: 코드 재발급, 등록, 검색, 반납 검사 API 통합 테스트

### 수정 파일

- `core/equipment.mjs`: 기존 장비 헬퍼가 신규 코드 모듈을 사용하도록 변경
- `core.mjs`: DB 기본값·정규화·내보내기, 관리자 API, 반납 검사 트랜잭션
- `storage-sql.mjs`: 코드 마이그레이션과 반납 검사 컬렉션 저장
- `package.json`: 신규 테스트 스크립트와 릴리스 검사 연결
- `src/react/platform/types.ts`: 장비 코드·마이그레이션·검사 타입과 관리자 액션 계약
- `public/js/state.js`: 코드 마이그레이션 미리보기와 반납 검사 UI 상태
- `public/js/data.js`: 관리자 기자재 데이터 로딩 후 신규 상태 동기화
- `public/js/renderer.js`: 미리보기·적용·등록·반납 검사 API 액션
- `src/react/admin/screens/AdminEquipment.tsx`: 자동 코드 등록, 통합 검색, 재발급 탭
- `src/react/admin/screens/AdminReservations.tsx`: 장비별 반납 점검 화면
- `src/react/design-system/react-admin.css`: 코드 미리보기·경고·반납 검사 반응형 스타일
- `scripts/react-admin-render-test.mjs`: 관리자 화면 정적 렌더링 계약
- `scripts/react-admin-contract-test.mjs`: 액션·접근성·검색 계약
- `scripts/sql-storage-smoke-test.mjs`: 신규 컬렉션 SQLite 왕복 저장
- `tests/ui/react-admin.spec.mjs`: 관리자 브라우저 흐름과 모바일 오버플로

---

### Task 1: 표준 장비 코드 도메인 모듈

**Files:**
- Create: `core/equipment-code.mjs`
- Create: `scripts/equipment-code-domain-test.mjs`
- Modify: `package.json`
- Modify: `core/equipment.mjs`

**Interfaces:**
- Produces: `inferEquipmentIdentity(input)`, `allocateEquipmentCodes({ items, input, quantity })`, `buildEquipmentCodeMigrationPreview(items)`, `equipmentSearchScore(item, query)`
- Consumes: 기존 장비의 `category`, `brand`, `model`, `name`, `notes`, `code`, `legacyCodes`, `active`

- [ ] **Step 1: 코드 정규화 실패 테스트 작성**

`scripts/equipment-code-domain-test.mjs`에 다음 계약을 작성한다.

```js
import assert from "node:assert/strict";
import {
  allocateEquipmentCodes,
  buildEquipmentCodeMigrationPreview,
  equipmentSearchScore,
  inferEquipmentIdentity
} from "../core/equipment-code.mjs";

assert.deepEqual(
  inferEquipmentIdentity({
    category: "Body",
    name: "소니 A7MIII Body",
    brand: "",
    model: ""
  }),
  {
    category: "Body",
    categoryCode: "CAM",
    brand: "Sony",
    brandCode: "SNY",
    model: "A7M3",
    productKey: "A7M3",
    functionTags: [],
    warnings: []
  }
);

assert.equal(inferEquipmentIdentity({
  category: "Lens",
  name: "삼양 AF 35mm F2.8 Lens"
}).productKey, "AF35F28");

const allocated = allocateEquipmentCodes({
  items: [
    { code: "CAM-SNY-A7M3-001", active: false },
    { code: "CAM-SNY-A7M3-003", active: true }
  ],
  input: { category: "Body", brand: "Sony", model: "A7M3", name: "소니 A7M3" },
  quantity: 2
});
assert.deepEqual(allocated.codes, ["CAM-SNY-A7M3-004", "CAM-SNY-A7M3-005"]);

const preview = buildEquipmentCodeMigrationPreview([
  { id: "lens-samyang", category: "Lens", name: "삼양 AF 35mm F2.8 Lens", code: "LEN-8LENS-01" },
  { id: "lens-sony", category: "Lens", name: "소니 FE 24-70mm F2.8 Lens", code: "LEN-8LENS-01" },
  { id: "drone-air", category: "Drone", name: "DJI 매빅 에어", code: "DRN-DJI-01" },
  { id: "drone-spark", category: "Drone", name: "DJI 스파크", code: "DRN-DJI-01" }
]);
assert.equal(new Set(preview.items.map((item) => item.newCode)).size, 4);
assert.equal(preview.items.every((item) => item.oldCode !== item.newCode), true);

assert.ok(equipmentSearchScore({
  code: "CAM-SNY-A7M3-001",
  legacyCodes: ["CAM-A7M3-01"],
  brand: "Sony",
  model: "A7M3",
  functionTags: ["영상 촬영"]
}, "CAM-A7M3-01") > 0);
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인**

Run: `node scripts/equipment-code-domain-test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `core/equipment-code.mjs`.

- [ ] **Step 3: 코드 규칙을 순수 함수로 구현**

`core/equipment-code.mjs`는 다음 상수와 반환 계약을 구현한다.

```js
export const CATEGORY_CODES = Object.freeze({
  Body: "CAM",
  Lens: "LEN",
  Lighting: "LGT",
  Audio: "AUD",
  Drone: "DRN",
  Other: "ETC"
});

export const BRAND_ALIASES = Object.freeze([
  { code: "SNY", brand: "Sony", aliases: ["SONY", "소니"] },
  { code: "CAN", brand: "Canon", aliases: ["CANON", "캐논"] },
  { code: "NIK", brand: "Nikon", aliases: ["NIKON", "니콘"] },
  { code: "SAM", brand: "Samyang", aliases: ["SAMYANG", "삼양"] },
  { code: "APT", brand: "Aputure", aliases: ["APUTURE"] },
  { code: "ROD", brand: "Rode", aliases: ["RODE", "RØDE", "로데"] },
  { code: "ZOM", brand: "Zoom", aliases: ["ZOOM"] },
  { code: "ATM", brand: "Atomos", aliases: ["ATOMOS", "아토모스"] },
  { code: "PFT", brand: "Profoto", aliases: ["PROFOTO", "프로포토"] },
  { code: "DJI", brand: "DJI", aliases: ["DJI"] }
]);

const PRODUCT_ALIASES = Object.freeze([
  [/매빅\s*2\s*프로|MAVIC\s*2\s*PRO/i, "MAVIC2PRO"],
  [/매빅\s*2\s*줌|MAVIC\s*2\s*ZOOM/i, "MAVIC2ZOOM"],
  [/매빅\s*에어|MAVIC\s*AIR/i, "MAVICAIR"],
  [/매빅\s*3|MAVIC\s*3/i, "MAVIC3"],
  [/스파크|SPARK/i, "SPARK"],
  [/카메라\s*고정용.*360|360.*카메라\s*고정용/i, "360CAMADPT"],
  [/삼각대\s*고정용.*360|360.*삼각대\s*고정용/i, "360TRIPODADPT"],
  [/붐\s*마이크\s*폴|BOOM\s*POLE/i, "BOOMPOLE"],
  [/샷건\s*마이크|SHOTGUN/i, "SHOTGUN"],
  [/쇼크\s*마운트|SHOCK\s*MOUNT/i, "SHOCKMOUNT"],
  [/블림프|BLIMP/i, "BLIMP"],
  [/삼각대|TRIPOD/i, "TRIPOD"],
  [/노출계|EXPOSURE\s*METER/i, "EXPOSUREMETER"],
  [/스팟\s*미터|SPOT\s*METER/i, "SPOTMETER"],
  [/컬러\s*미터|COLOR\s*METER/i, "COLORMETER"],
  [/셔틀러|SHUTTLER/i, "SHUTTLER"],
  [/전동\s*슬라이더|SLIDER/i, "SLIDER"]
]);

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function searchText(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9가-힣]+/g, " ").trim();
}

function compact(value) {
  return searchText(value).replace(/[^A-Z0-9]/g, "");
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

function normalizeTags(value) {
  const values = Array.isArray(value)
    ? value
    : text(value).split(/[|,]/);
  return [...new Set(values.map(text).filter(Boolean))];
}

function categoryFor(input) {
  const explicit = text(input.category);
  if (CATEGORY_CODES[explicit]) return explicit;
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

function brandFor(input) {
  const explicit = searchText(input.brand);
  const source = explicit || searchText(input.name);
  const match = BRAND_ALIASES.find((entry) =>
    entry.aliases.some((alias) => source.includes(searchText(alias)))
  );
  if (match) return { brand: match.brand, brandCode: match.code, warning: "" };
  const asciiBrand = compact(explicit);
  if (asciiBrand) {
    return {
      brand: text(input.brand),
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

function productKeyFor(input, brand) {
  const raw = text(input.model) || text(input.name);
  const alias = PRODUCT_ALIASES.find(([pattern]) => pattern.test(raw));
  if (alias) return alias[1];
  let candidate = searchText(raw);
  for (const entry of BRAND_ALIASES) {
    for (const name of entry.aliases) {
      candidate = candidate.replaceAll(searchText(name), " ");
    }
  }
  candidate = candidate
    .replace(/\b(BODY|LENS|CAMERA|LIGHT|AUDIO)\b/g, " ")
    .replace(/카메라|바디|렌즈|조명|마이크/g, " ");
  return compact(normalizeModel(candidate)).slice(0, 16);
}

export function inferEquipmentIdentity(input = {}) {
  const category = categoryFor(input);
  const brand = brandFor(input);
  const productKey = productKeyFor(input, brand);
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

export function allocateEquipmentCodes({ items = [], input = {}, quantity = 1 } = {}) {
  const identity = inferEquipmentIdentity(input);
  const prefix = `${identity.categoryCode}-${identity.brandCode}-${identity.productKey}`;
  const matcher = new RegExp(`^${prefix}-(\\d{3,})$`);
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

export function buildEquipmentCodeMigrationPreview(items = []) {
  const ordered = [...items].sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || "")) ||
    String(left.id).localeCompare(String(right.id))
  );
  const counters = new Map();
  const mappings = ordered.map((item) => {
    const identity = inferEquipmentIdentity(item);
    const group = `${identity.categoryCode}-${identity.brandCode}-${identity.productKey}`;
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
  const fingerprint = ordered
    .map((item) => `${item.id}|${item.code || ""}|${item.updatedAt || ""}`)
    .join("\n");
  return {
    fingerprint,
    codeVersion: 2,
    items: mappings,
    warningCount: mappings.filter((item) => item.warnings.length > 0).length
  };
}

export function equipmentSearchScore(item = {}, query = "") {
  const needle = searchText(query);
  if (!needle) return 1;
  if (searchText(item.code) === needle) return 400;
  if ((item.legacyCodes || []).some((code) => searchText(code) === needle)) return 350;
  if ([item.name, item.model, item.productKey].some((value) => searchText(value).includes(needle))) return 200;
  if ([
    item.brand,
    item.brandCode,
    item.category,
    item.facility,
    item.source,
    item.notes,
    ...(item.functionTags || [])
  ].some((value) => searchText(value).includes(needle))) return 100;
  return 0;
}
```

위 구현을 기준으로 다음 규칙을 보완한다.

- 문자열 비교는 대문자와 영숫자 정규화를 사용한다.
- `A7MIII`, `A7 MARK 3`, `A7M3`는 `A7M3`로 통일한다.
- `24-70mm F2.8`은 `2470F28`, `매빅2 프로`는 `MAVIC2PRO`로 통일한다.
- 제품키는 최대 16자이며 빈 값이면 `warnings: ["제품 또는 모델 정보를 확인하세요."]`를 반환한다.
- `fingerprint`는 `id|oldCode|updatedAt`을 정렬해 연결한 결정론적 문자열로 만든다.

`core/equipment.mjs`의 기존 `codeBase` 사용을 제거하고 신규 모듈을 가져오되 기존 seed 생성은 `allocateEquipmentCodes`를 순차 호출해 중복 없는 코드를 만든다. 새 설치의 seed 장비에는 정규화된 브랜드·제품키와 `codeVersion: 2`를 함께 저장한다.

- [ ] **Step 4: 도메인 테스트 통과 확인**

Run: `node scripts/equipment-code-domain-test.mjs`

Expected: PASS and process exit code `0`.

- [ ] **Step 5: 테스트 스크립트 등록 및 커밋**

`package.json`에 다음을 추가한다.

```json
"test:equipment-code": "node scripts/equipment-code-domain-test.mjs"
```

Run: `npm run check && node scripts/equipment-code-domain-test.mjs`

Expected: syntax checks PASS and domain test exit code `0`.

```bash
git add core/equipment-code.mjs core/equipment.mjs scripts/equipment-code-domain-test.mjs package.json
git commit -m "2026-07-29 기자재 자동 코드 도메인 추가"
```

---

### Task 2: 코드 재발급 저장 구조와 관리자 API

**Files:**
- Create: `scripts/equipment-operations-api-test.mjs`
- Modify: `core.mjs`
- Modify: `storage-sql.mjs`
- Modify: `scripts/sql-storage-smoke-test.mjs`

**Interfaces:**
- Consumes: `buildEquipmentCodeMigrationPreview(items)` from Task 1
- Produces: `POST /api/admin/equipment/code-migrations/preview`, `POST /api/admin/equipment/code-migrations/:id/apply`, `GET /api/admin/equipment/code-migrations/:id`
- Persists: `db.equipmentCodeMigrations`, `db.equipmentInspections`

- [ ] **Step 1: 미리보기·적용·멱등성 실패 테스트 작성**

`scripts/equipment-operations-api-test.mjs`에서 `initialDb`와 `handleApiRequest`를 사용해 관리자 세션을 만들고 다음을 검증한다.

```js
db.equipment.forEach((item, index) => {
  item.code = `LEGACY-${String(index + 1).padStart(3, "0")}`;
  delete item.codeVersion;
});
const previewResponse = await api("POST", "/api/admin/equipment/code-migrations/preview");
assert.equal(previewResponse.status, 200);
assert.equal(previewResponse.body.data.codeVersion, 2);
assert.equal(previewResponse.body.data.items.length, db.equipment.length);
assert.equal(
  new Set(previewResponse.body.data.items.map((item) => item.newCode)).size,
  db.equipment.length
);
assert.equal(db.equipment.some((item) => item.codeVersion === 2), false);

const migrationId = previewResponse.body.data.id;
const applyResponse = await api(
  "POST",
  `/api/admin/equipment/code-migrations/${migrationId}/apply`,
  {
    confirmedIds: previewResponse.body.data.items
      .filter((item) => item.warnings.length > 0)
      .map((item) => item.equipmentId)
  }
);
assert.equal(applyResponse.status, 200);
assert.equal(db.equipment.every((item) => item.codeVersion === 2), true);
for (const mapping of previewResponse.body.data.items) {
  const item = db.equipment.find((candidate) => candidate.id === mapping.equipmentId);
  assert.equal(item.legacyCodes.includes(mapping.oldCode), true);
}

const secondApply = await api(
  "POST",
  `/api/admin/equipment/code-migrations/${migrationId}/apply`
);
assert.equal(secondApply.status, 200);
assert.equal(secondApply.body.data.appliedAt, applyResponse.body.data.appliedAt);
```

테스트에는 미리보기 이후 장비 `updatedAt` 변경 시 `409`가 반환되는 사례와 학생 토큰으로 호출할 때 `403`이 반환되는 사례도 포함한다.

- [ ] **Step 2: 신규 API가 없어 실패하는지 확인**

Run: `node scripts/equipment-operations-api-test.mjs`

Expected: FAIL because the preview route returns `404`.

- [ ] **Step 3: DB 기본값과 SQLite 컬렉션 추가**

`initialDb`와 `normalizeDb`에 다음 컬렉션을 추가한다.

```js
equipmentCodeMigrations: [],
equipmentInspections: []
```

`adminExportData`에도 두 컬렉션을 포함한다.

`storage-sql.mjs`의 `COLLECTIONS`에 다음 테이블 규격을 추가한다.

```js
{
  key: "equipmentCodeMigrations",
  table: "equipment_code_migrations",
  create: `CREATE TABLE IF NOT EXISTS equipment_code_migrations (
    id TEXT PRIMARY KEY,
    status TEXT,
    created_at TEXT,
    applied_at TEXT,
    data TEXT NOT NULL
  )`,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_equipment_code_migrations_status_created ON equipment_code_migrations (status, created_at)"
  ],
  params: (item, data) => [
    item.id,
    item.status || "",
    item.createdAt || "",
    item.appliedAt || "",
    data
  ],
  insert: `INSERT OR REPLACE INTO equipment_code_migrations
    (id, status, created_at, applied_at, data)
    VALUES (?, ?, ?, ?, ?)`
},
{
  key: "equipmentInspections",
  table: "equipment_inspections",
  create: `CREATE TABLE IF NOT EXISTS equipment_inspections (
    id TEXT PRIMARY KEY,
    equipment_id TEXT,
    reservation_id TEXT,
    outcome TEXT,
    checked_at TEXT,
    data TEXT NOT NULL
  )`,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_equipment_inspections_equipment_checked ON equipment_inspections (equipment_id, checked_at)",
    "CREATE INDEX IF NOT EXISTS idx_equipment_inspections_reservation ON equipment_inspections (reservation_id)"
  ],
  params: (item, data) => [
    item.id,
    item.equipmentId || "",
    item.reservationId || "",
    item.outcome || "",
    item.checkedAt || "",
    data
  ],
  insert: `INSERT OR REPLACE INTO equipment_inspections
    (id, equipment_id, reservation_id, outcome, checked_at, data)
    VALUES (?, ?, ?, ?, ?, ?)`
}
```

- [ ] **Step 4: 재발급 API 구현**

`core.mjs`에 다음 동작을 구현한다.

```text
POST preview
  requireAdmin
  buildEquipmentCodeMigrationPreview(db.equipment)
  id("eqmigration"), status "preview", createdBy, createdAt 저장
  audit action "equipment.code_migration_previewed"

POST :id/apply
  requireAdmin
  migration 조회, 없으면 404
  applied면 기존 결과 반환
  현재 fingerprint가 다르면 409
  warning이 있는 equipmentId가 body.confirmedIds에 모두 없으면 409
  equipment.id로 매핑해 legacyCodes에 oldCode를 중복 없이 추가
  code/new identity/codeVersion/assigned fields 저장
  migration.status = "applied", appliedAt 저장
  audit action "equipment.code_migration_applied"

GET :id
  requireAdmin
  migration 조회 후 반환
```

적용 전에 모든 변경 객체와 적용된 마이그레이션 객체를 별도 배열에 만들고 검증을 끝낸 뒤 `db.equipment`와 `db.equipmentCodeMigrations`를 한 번에 교체한다. 저장 실패 시 다음 구조로 메모리 상태도 복구한다.

```js
const previousEquipment = db.equipment;
const previousMigrations = db.equipmentCodeMigrations;
db.equipment = nextEquipment;
db.equipmentCodeMigrations = nextMigrations;
try {
  await saveDb();
} catch (error) {
  db.equipment = previousEquipment;
  db.equipmentCodeMigrations = previousMigrations;
  throw error;
}
```

- [ ] **Step 5: API와 SQLite 왕복 테스트 통과 확인**

`scripts/sql-storage-smoke-test.mjs`에 두 컬렉션을 저장하고 다시 읽었을 때 ID와 상태가 같은지 검증한다.

`package.json`에 API 테스트가 생성된 시점부터 다음 스크립트를 추가한다.

```json
"test:equipment-operations": "npm run test:equipment-code && node scripts/equipment-operations-api-test.mjs"
```

Run: `node scripts/equipment-operations-api-test.mjs && npm run test:storage`

Expected: all assertions PASS.

- [ ] **Step 6: 커밋**

```bash
git add core.mjs storage-sql.mjs scripts/equipment-operations-api-test.mjs scripts/sql-storage-smoke-test.mjs package.json
git commit -m "2026-07-29 기자재 코드 재발급 API와 저장 구조 추가"
```

---

### Task 3: 신규 장비 자동 코드와 관리자 통합 검색 API

**Files:**
- Modify: `core/equipment.mjs`
- Modify: `core.mjs`
- Modify: `scripts/equipment-operations-api-test.mjs`
- Modify: `scripts/backend-domain-timing-test.mjs`

**Interfaces:**
- Consumes: `inferEquipmentIdentity`, `allocateEquipmentCodes`, `equipmentSearchScore`
- Produces: 자동 코드를 반환하는 `POST /api/admin/equipment`, `POST /api/admin/equipment/import`, `POST /api/admin/equipment/code-preview`, `POST /api/admin/equipment/:id/regenerate-code`, `GET /api/admin/equipment/search?q=`

- [ ] **Step 1: 등록·가져오기·검색 실패 테스트 추가**

```js
const created = await api("POST", "/api/admin/equipment", {
  category: "Body",
  name: "소니 A7MIII Body",
  brand: "Sony",
  model: "A7MIII",
  functionTags: ["영상 촬영"],
  quantity: 2,
  source: "department",
  status: "가능"
});
assert.equal(created.status, 200);
assert.match(created.body.data[0].code, /^CAM-SNY-A7M3-\d{3}$/);
assert.equal(created.body.data[1].code.endsWith(
  String(Number(created.body.data[0].code.slice(-3)) + 1).padStart(3, "0")
), true);

const codePreview = await api("POST", "/api/admin/equipment/code-preview", {
  category: "Drone",
  name: "DJI 매빅2 프로",
  brand: "DJI",
  quantity: 1
});
assert.equal(codePreview.status, 200);
assert.match(codePreview.body.data.codes[0], /^DRN-DJI-MAVIC2PRO-\d{3}$/);

const search = await api("GET", "/api/admin/equipment/search?q=영상 촬영");
assert.equal(search.status, 200);
assert.equal(search.body.data[0].id, created.body.data[0].id);

const previousCode = created.body.data[0].code;
const regenerate = await api(
  "POST",
  `/api/admin/equipment/${created.body.data[0].id}/regenerate-code`,
  { confirmation: "코드 재생성" }
);
assert.equal(regenerate.status, 200);
assert.notEqual(regenerate.body.data.code, previousCode);
assert.equal(regenerate.body.data.legacyCodes.includes(previousCode), true);

const imported = await api("POST", "/api/admin/equipment/import", {
  rows: [{
    category: "Audio",
    name: "RODE 샷건 마이크",
    brand: "Rode",
    function_tags: "인터뷰|동시녹음",
    code: "AUD-OLD-01"
  }]
});
assert.equal(imported.status, 200);
const importedItem = db.equipment.find((item) => item.importBatchId === imported.body.data.id);
assert.match(importedItem.code, /^AUD-ROD-SHOTGUN-\d{3}$/);
assert.deepEqual(importedItem.legacyCodes, ["AUD-OLD-01"]);
```

- [ ] **Step 2: 현재 수동 코드 계약 때문에 실패하는지 확인**

Run: `node scripts/equipment-operations-api-test.mjs`

Expected: FAIL because the created code does not contain the normalized brand and three-digit sequence.

- [ ] **Step 3: 단건·CSV 등록을 하나의 생성 경로로 통합**

`core/equipment.mjs`에 다음 함수 계약을 추가한다.

```js
function createEquipmentRecords({
  existingItems,
  input,
  quantity,
  makeId,
  timestamp
}) {
  const allocation = allocateEquipmentCodes({
    items: existingItems,
    input,
    quantity
  });
  if (allocation.identity.warnings.includes("제품 또는 모델 정보를 확인하세요.")) {
    throw Object.assign(new Error("제품명 또는 모델 정보를 확인하세요."), { status: 400 });
  }
  return allocation.codes.map((code) => ({
    id: makeId("eq"),
    code,
    legacyCodes: input.legacyCode ? [String(input.legacyCode)] : [],
    brand: allocation.identity.brand,
    brandCode: allocation.identity.brandCode,
    model: allocation.identity.model,
    productKey: allocation.identity.productKey,
    functionTags: allocation.identity.functionTags,
    codeVersion: 2,
    codeAssignedAt: timestamp,
    codeAssignedBy: input.codeAssignedBy
  }));
}
```

POST와 CSV 라우트는 수동 `codePrefix`로 새 코드를 확정하지 않는다. 들어온 `code`, `codePrefix`, `code_prefix`는 `legacyCode`로만 전달한다. CSV 기능 태그는 `|` 또는 `,` 구분 문자열과 배열을 모두 허용한다.

- [ ] **Step 4: 검색 API 구현**

`POST /api/admin/equipment/code-preview`는 관리자 권한을 확인하고 입력값과 현재 장비를 `allocateEquipmentCodes`에 전달해 예상 `identity`, `codes`, `warnings`를 데이터 변경 없이 반환한다.

`POST /api/admin/equipment/:id/regenerate-code`는 현재 장비 필드로 다음 사용 가능한 코드를 한 개 생성하고 기존 코드를 `legacyCodes`에 보존한다. 관리자 확인 문구 없이 호출할 수 없도록 body의 `confirmation`이 정확히 `"코드 재생성"`인지 검사하고, `equipment.code_regenerated` 감사 로그에 이전·신규 코드를 기록한다.

`GET /api/admin/equipment/search?q=`는 관리자 권한을 확인하고 `equipmentSearchScore`가 1 이상인 장비를 점수 내림차순, 코드 오름차순으로 최대 50개 반환한다. 빈 검색어는 활성 장비를 코드순으로 최대 50개 반환한다.

- [ ] **Step 5: 기존 수동 코드 테스트를 신규 계약으로 갱신하고 전체 통과 확인**

`scripts/backend-domain-timing-test.mjs`의 `codePrefix` 보존 기대값을 다음 계약으로 교체한다.

```js
assert.match(createdInquiryEquipment.body.data[0].code, /^CAM-[A-Z0-9]+-[A-Z0-9]+-\d{3}$/);
assert.deepEqual(createdInquiryEquipment.body.data[0].legacyCodes, ["CAM-REVIEW-001"]);
```

Run: `node scripts/equipment-operations-api-test.mjs && npm run test:backend-domains && npm run test:security`

Expected: all assertions PASS.

- [ ] **Step 6: 커밋**

```bash
git add core/equipment.mjs core.mjs scripts/equipment-operations-api-test.mjs scripts/backend-domain-timing-test.mjs
git commit -m "2026-07-29 신규 기자재 자동 코드와 통합 검색 추가"
```

---

### Task 4: 반납 점검 API와 장비 상태 연동

**Files:**
- Modify: `core.mjs`
- Modify: `scripts/equipment-operations-api-test.mjs`
- Modify: `scripts/security-smoke-test.mjs`

**Interfaces:**
- Produces: `POST /api/admin/reservations/:id/return-inspection`
- Persists: `db.equipmentInspections`
- Changes: reservation `checked_out → returned`, equipment `가능` 또는 `수리중`

- [ ] **Step 1: 반납 검사 실패 테스트 추가**

대여 중 예약에 장비 3개를 연결하고 다음을 검증한다.

```js
const response = await api(
  "POST",
  `/api/admin/reservations/${reservation.id}/return-inspection`,
  {
    inspections: [
      { equipmentId: "eq-normal", outcome: "normal", note: "" },
      { equipmentId: "eq-check", outcome: "needs_inspection", note: "렌즈 유격 확인" },
      { equipmentId: "eq-repair", outcome: "needs_repair", note: "전원 불량" }
    ]
  }
);
assert.equal(response.status, 200);
assert.equal(reservation.status, "returned");
assert.equal(findEquipment("eq-normal").status, "가능");
assert.equal(findEquipment("eq-check").status, "수리중");
assert.equal(findEquipment("eq-repair").status, "수리중");
assert.equal(db.equipmentInspections.length, 3);
```

추가로 다음 실패 사례를 작성한다.

- `checked_out`이 아닌 예약: `409`
- 예약에 포함되지 않은 장비: `400`
- 장비 누락: `400`
- `needs_repair`에 빈 사유: `400`
- 학생 토큰: `403`

- [ ] **Step 2: API 부재로 실패하는지 확인**

Run: `node scripts/equipment-operations-api-test.mjs`

Expected: FAIL because return inspection route returns `404`.

- [ ] **Step 3: 반납 검사를 원자적으로 구현**

라우트는 입력을 모두 검증한 뒤 다음 구조의 검사 기록을 만든다.

```js
{
  id: id("eqinspection"),
  equipmentId,
  reservationId: reservation.id,
  outcome,
  note,
  previousStatus: equipment.status,
  nextStatus: outcome === "normal" ? "가능" : "수리중",
  checkedBy: admin.id,
  checkedAt: nowIso()
}
```

검증이 끝나기 전에는 예약·장비·검사 배열을 변경하지 않는다. 검증 후 모든 장비 상태, 예약 상태와 이력, `equipmentInspections`, 감사 로그를 변경하고 `saveDb()`를 한 번 호출한다.

`saveDb()` 실패 시 예약, 장비, 검사 기록과 감사 로그를 적용 전 스냅샷으로 복구한 뒤 오류를 다시 던진다. 성공 응답은 저장이 끝난 다음에만 만든다.

예약 이력에는 다음 항목을 추가한다.

```js
{
  at: nowIso(),
  actorId: admin.id,
  action: "return_inspected",
  status: "returned",
  equipmentOutcomes: inspections.map(({ equipmentId, outcome }) => ({ equipmentId, outcome }))
}
```

- [ ] **Step 4: 회귀 테스트 통과 확인**

Run: `node scripts/equipment-operations-api-test.mjs && npm run test:security && npm run test:dashboard-integrity`

Expected: all assertions PASS and the existing direct status transition tests remain valid.

- [ ] **Step 5: 커밋**

```bash
git add core.mjs scripts/equipment-operations-api-test.mjs scripts/security-smoke-test.mjs
git commit -m "2026-07-29 기자재 반납 점검과 상태 연동 추가"
```

---

### Task 5: 관리자 타입·상태·액션 브리지

**Files:**
- Modify: `src/react/platform/types.ts`
- Modify: `public/js/state.js`
- Modify: `public/js/data.js`
- Modify: `public/js/renderer.js`
- Modify: `scripts/react-admin-data-test.mjs`
- Modify: `scripts/react-admin-contract-test.mjs`

**Interfaces:**
- Produces React actions: `previewEquipmentCode(input)`, `previewEquipmentCodeMigration()`, `applyEquipmentCodeMigration(id, confirmedIds)`, `regenerateEquipmentCode(id)`, `returnEquipmentReservation(id, inspections)`
- Provides state: `adminEquipmentCodeMigration`, `adminEquipmentReturnDraft`

- [ ] **Step 1: 액션 계약 실패 테스트 작성**

`scripts/react-admin-contract-test.mjs`에 다음 토큰 계약을 추가한다.

```js
for (const token of [
  "previewEquipmentCode",
  "previewEquipmentCodeMigration",
  "applyEquipmentCodeMigration",
  "regenerateEquipmentCode",
  "returnEquipmentReservation"
]) {
  assert(rendererSource.includes(`async ${token}`), `renderer must expose ${token}`);
  assert(typesSource.includes(`${token}(`), `ReactAdminActions must type ${token}`);
}
```

`scripts/react-admin-data-test.mjs`에는 장비 화면 새로고침 후 `adminEquipmentCodeMigration`을 보존하되 로그아웃 초기화에서 제거되는지 검증한다.

- [ ] **Step 2: 타입 오류와 토큰 부재 확인**

Run: `npm run test:react-admin && node scripts/react-admin-data-test.mjs`

Expected: FAIL for missing actions/state contracts.

- [ ] **Step 3: 타입과 상태 구현**

`src/react/platform/types.ts`에 다음 타입을 추가한다.

```ts
export type AdminEquipmentInspectionOutcome =
  | "normal"
  | "needs_inspection"
  | "needs_repair";

export type AdminEquipmentInspectionInput = {
  equipmentId: string;
  outcome: AdminEquipmentInspectionOutcome;
  note: string;
};

export type AdminEquipmentCodeMigrationItem = {
  equipmentId: string;
  oldCode: string;
  newCode: string;
  warnings: string[];
  confirmed?: boolean;
};

export type AdminEquipmentCodeMigration = {
  id: string;
  status: "preview" | "applied" | "failed";
  codeVersion: 2;
  items: AdminEquipmentCodeMigrationItem[];
  warningCount: number;
  createdAt: string;
  appliedAt?: string;
};

export type AdminEquipmentCodePreview = {
  identity: {
    category: string;
    categoryCode: string;
    brand: string;
    brandCode: string;
    model: string;
    productKey: string;
    functionTags: string[];
    warnings: string[];
  };
  codes: string[];
};
```

`AdminEquipmentRecord`에는 `legacyCodes`, `brandCode`, `productKey`, `functionTags`, `codeVersion`을 추가하고 `AdminEquipmentInput`에서는 `codePrefix`를 제거하고 `functionTags?: string[]`를 추가한다.

`ReactAdminActions`에는 다음 계약을 추가한다.

```ts
previewEquipmentCode(input: AdminEquipmentInput): Promise<AdminEquipmentCodePreview>;
previewEquipmentCodeMigration(): Promise<AdminEquipmentCodeMigration>;
applyEquipmentCodeMigration(migrationId: string, confirmedIds: string[]): Promise<void>;
regenerateEquipmentCode(equipmentId: string): Promise<void>;
returnEquipmentReservation(
  reservationId: string,
  inspections: AdminEquipmentInspectionInput[]
): Promise<void>;
```

- [ ] **Step 4: renderer 액션 구현**

```js
async previewEquipmentCode(input) {
  return api("/api/admin/equipment/code-preview", {
    method: "POST",
    body: input
  });
},

async previewEquipmentCodeMigration() {
  const migration = await api("/api/admin/equipment/code-migrations/preview", {
    method: "POST"
  });
  state.adminEquipmentCodeMigration = migration;
  this.render();
  return migration;
},

async applyEquipmentCodeMigration(migrationId, confirmedIds = []) {
  await runAdminMutation(
    "equipment",
    () => api(`/api/admin/equipment/code-migrations/${encodeURIComponent(migrationId)}/apply`, {
      method: "POST",
      body: { confirmedIds }
    }),
    "기자재 코드를 재발급했습니다.",
    {
      after: (migration) => { state.adminEquipmentCodeMigration = migration; },
      invalidateViews: ["equipment", "reservations", "dashboard"]
    }
  );
},

async regenerateEquipmentCode(equipmentId) {
  const confirmation = prompt("코드를 다시 만들려면 코드 재생성을 입력하세요.", "");
  if (confirmation !== "코드 재생성") return;
  await runAdminMutation(
    "equipment",
    () => api(`/api/admin/equipment/${encodeURIComponent(equipmentId)}/regenerate-code`, {
      method: "POST",
      body: { confirmation }
    }),
    "기자재 코드를 다시 생성했습니다.",
    { invalidateViews: ["equipment", "reservations"] }
  );
},

async returnEquipmentReservation(reservationId, inspections) {
  await runAdminMutation(
    "reservations",
    () => api(`/api/admin/reservations/${encodeURIComponent(reservationId)}/return-inspection`, {
      method: "POST",
      body: { inspections }
    }),
    "반납 점검을 완료했습니다.",
    { invalidateViews: ["reservations", "equipment", "dashboard"] }
  );
}
```

- [ ] **Step 5: 타입·브리지 테스트 통과 확인**

Run: `npm run check:react-admin && npm run test:react-admin && node scripts/react-admin-data-test.mjs`

Expected: TypeScript and all contract assertions PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/react/platform/types.ts public/js/state.js public/js/data.js public/js/renderer.js scripts/react-admin-data-test.mjs scripts/react-admin-contract-test.mjs
git commit -m "2026-07-29 기자재 운영 관리자 액션 브리지 추가"
```

---

### Task 6: 자동 코드 등록·통합 검색·전체 재발급 화면

**Files:**
- Modify: `src/react/admin/screens/AdminEquipment.tsx`
- Modify: `src/react/design-system/react-admin.css`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/react-admin-contract-test.mjs`
- Modify: `tests/ui/react-admin.spec.mjs`

**Interfaces:**
- Consumes: `state.adminEquipmentCodeMigration`, Task 5 관리자 액션
- Produces: 장비 추가·장비 관리·코드 재발급의 세 탭

- [ ] **Step 1: 관리자 장비 화면 실패 테스트 작성**

`scripts/react-admin-render-test.mjs`에서 장비 추가 화면이 다음을 만족하게 테스트를 변경한다.

```js
assert(!equipmentAddMarkup.includes('name="codePrefix"'));
assert(equipmentAddMarkup.includes('name="functionTags"'));
assert(equipmentAddMarkup.includes("자동으로 부여"));
assert(equipmentAddMarkup.includes("예상 코드"));
```

미리보기 상태 렌더링은 다음을 검증한다.

```js
assert(migrationMarkup.includes("코드 재발급"));
assert(migrationMarkup.includes("LEN-8LENS-01"));
assert(migrationMarkup.includes("LEN-SAM-AF35F28-001"));
assert(migrationMarkup.includes("확인 필요"));
assert(migrationMarkup.includes("전체 적용"));
```

통합 검색 테스트는 `legacyCodes`, `functionTags`, `facility`로 각각 검색했을 때 해당 장비가 표시되는지 검증한다.

- [ ] **Step 2: 현재 화면 계약으로 실패 확인**

Run: `node scripts/react-admin-render-test.mjs && npm run test:react-admin`

Expected: FAIL because `codePrefix` still exists and migration UI is absent.

- [ ] **Step 3: 장비 등록 폼 변경**

- `코드 / 접두어` 입력을 제거한다.
- `기능 태그` 입력을 추가하고 쉼표로 나누어 `functionTags` 배열로 전달한다.
- 브랜드·제품명·모델·분류가 바뀌면 250ms 디바운스 후 `actions.previewEquipmentCode(input)`를 호출해 예상 코드를 표시한다.
- 예상 코드는 안내용이며 저장 응답의 서버 코드를 최종값으로 사용한다.
- 브랜드 미확인 또는 제품키 미확정은 노란 경고로 표시한다.

등록 제출 값은 다음 계약을 사용한다.

```ts
const body: AdminEquipmentInput = {
  name: fieldValue(form, "name"),
  category: fieldValue(form, "category"),
  brand: fieldValue(form, "brand"),
  model: fieldValue(form, "model"),
  functionTags: fieldValue(form, "functionTags")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  source: fieldValue(form, "source"),
  status: (fieldValue(form, "status") || "가능") as AdminEquipmentStatus,
  quantity: numberValue(form, "quantity") || 1,
  notes: fieldValue(form, "notes"),
  reservable: !inquiryOnly,
  inquiryOnly
};
```

- [ ] **Step 4: 검색과 재발급 탭 구현**

- 검색 대상에 `legacyCodes`, `functionTags`, `brandCode`, `productKey`를 추가한다.
- 코드 완전 일치가 상단에 오도록 동일한 점수 규칙을 적용한다.
- 장비 관리 행과 모바일 카드에 `코드 재생성` 보조 액션을 추가하고 기존 코드는 이력으로 보존된다는 확인 문구를 표시한다.
- `코드 재발급` 탭에서 미리보기 생성, 기존/신규 코드, 경고 확인 체크박스, 전체 적용을 제공한다.
- 경고가 있는 행은 확인 체크 전까지 적용 버튼을 비활성화한다.
- 적용 완료 후 완료 시각과 변경 수를 표시한다.

- [ ] **Step 5: 반응형 및 Playwright 테스트 추가**

`tests/ui/react-admin.spec.mjs`에 데스크톱과 모바일에서 다음 흐름을 추가한다.

```text
기자재 관리 이동
→ 장비 추가 탭
→ 코드 수동 입력이 없는지 확인
→ 브랜드/모델 입력
→ 예상 코드 확인
→ 코드 재발급 탭
→ 미리보기 생성
→ 표와 경고 확인
→ 문서 가로 오버플로 없음
```

Run: `npm run check:react-admin && node scripts/react-admin-render-test.mjs && npx playwright test tests/ui/react-admin.spec.mjs --project=desktop-1440 --project=mobile-390`

Expected: all selected tests PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/react/admin/screens/AdminEquipment.tsx src/react/design-system/react-admin.css scripts/react-admin-render-test.mjs scripts/react-admin-contract-test.mjs tests/ui/react-admin.spec.mjs
git commit -m "2026-07-29 기자재 자동 코드와 재발급 관리자 화면 추가"
```

---

### Task 7: 예약 관리 반납 점검 화면

**Files:**
- Modify: `src/react/admin/screens/AdminReservations.tsx`
- Modify: `src/react/design-system/react-admin.css`
- Modify: `scripts/react-admin-render-test.mjs`
- Modify: `scripts/react-admin-contract-test.mjs`
- Modify: `tests/ui/react-admin.spec.mjs`

**Interfaces:**
- Consumes: `actions.returnEquipmentReservation(id, inspections)`
- Produces: `checked_out` 예약에서만 열리는 장비별 반납 점검 패널

- [ ] **Step 1: 반납 점검 렌더링 실패 테스트 작성**

대여 중 장비 예약을 렌더링하고 다음을 검증한다.

```js
assert(returnInspectionMarkup.includes("반납 점검"));
assert(returnInspectionMarkup.includes("정상"));
assert(returnInspectionMarkup.includes("점검 필요"));
assert(returnInspectionMarkup.includes("파손·수리 필요"));
assert(returnInspectionMarkup.includes("CAM-SNY-A7M3-001"));
assert(returnInspectionMarkup.includes("연락처"));
assert(!returnInspectionMarkup.includes('data-status="returned"'));
```

즉, `checked_out` 예약의 기존 즉시 `returned` 액션은 제거하고 점검 패널을 통해서만 반납한다.

- [ ] **Step 2: 기존 즉시 반납 액션 때문에 실패하는지 확인**

Run: `node scripts/react-admin-render-test.mjs && npm run test:react-admin`

Expected: FAIL because no inspection choices are rendered.

- [ ] **Step 3: 장비별 반납 점검 패널 구현**

- 예약 카드와 데스크톱 행의 `반납 처리` 버튼을 누르면 해당 예약의 점검 패널을 연다.
- 기본 결과는 각 장비 모두 `normal`이다.
- 결과가 `needs_inspection` 또는 `needs_repair`이면 메모 입력을 표시한다.
- `needs_repair`는 빈 메모로 제출할 수 없다.
- 제출 시 다음 배열을 만든다.

```ts
const inspections: AdminEquipmentInspectionInput[] = equipmentItems.map((item) => ({
  equipmentId: String(item.id),
  outcome: draft[item.id]?.outcome || "normal",
  note: String(draft[item.id]?.note || "").trim()
}));
```

- 성공하면 패널을 닫고 액션 브리지가 예약·장비·대시보드를 다시 불러온다.
- 취소하면 서버 호출 없이 초안만 제거한다.

- [ ] **Step 4: 접근성과 모바일 스타일 구현**

- 패널 제목에 예약자와 예약명을 포함한다.
- 각 장비 결과는 `fieldset`과 `legend`로 그룹화한다.
- 오류 메시지는 해당 메모 입력과 `aria-describedby`로 연결한다.
- 모바일에서는 화면 폭 안에서 한 열로 배치하고 하단 제출 버튼을 고정하지 않는다.
- 키보드 포커스는 패널을 연 버튼에서 첫 결과 선택으로 이동하고 닫은 뒤 원래 버튼으로 돌아간다.

- [ ] **Step 5: 브라우저 흐름 테스트**

`tests/ui/react-admin.spec.mjs`에 다음 흐름을 추가한다.

```text
대여 중 기자재 예약 준비
→ 예약 관리에서 반납 점검 열기
→ 첫 장비 정상, 둘째 장비 수리 필요 선택
→ 사유 없이 제출 시 클라이언트 오류
→ 사유 입력 후 제출
→ 반납 완료 상태 확인
→ 수리 장비가 기자재 관리에서 수리중인지 확인
→ 모바일 가로 오버플로 없음
```

Run: `npm run check:react-admin && node scripts/react-admin-render-test.mjs && npx playwright test tests/ui/react-admin.spec.mjs --project=desktop-1440 --project=mobile-390`

Expected: all selected tests PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/react/admin/screens/AdminReservations.tsx src/react/design-system/react-admin.css scripts/react-admin-render-test.mjs scripts/react-admin-contract-test.mjs tests/ui/react-admin.spec.mjs
git commit -m "2026-07-29 기자재 반납 점검 관리자 화면 추가"
```

---

### Task 8: 전체 재발급 검증과 릴리스 준비

**Files:**
- Modify: `equipment-list-2026-07-14.txt`
- Modify: `docs/service-specification/02-functional-specification.md`
- Modify: `docs/service-specification/03-api-integration-specification.md`
- Modify: `docs/service-specification/04-database-specification.md`
- Modify: `docs/release-qa-signoff.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1–7의 완성 기능
- Produces: 현재 144개 장비의 코드 비교 결과, 최신 서비스 명세, 전체 QA 증거

- [ ] **Step 1: 프로덕션 재고 형상 검증 스크립트 실행**

현재 운영 장비 데이터로 미리보기를 만들고 다음 값을 기록한다.

```text
전체 장비 수: 144
신규 코드 수: 144
중복 신규 코드: 0
미해결 제품키: 0
미확인 경고 승인 누락: 0
기존 중복 코드 분리: LEN-8LENS-01, DRN-DJI-01, DRN-DJI2-01,
                   ETC-360-01, ETC-DJI-01
```

미해결 항목이 있으면 별칭 사전을 보완하고 Task 1 테스트에 회귀 사례를 추가한다. 임의의 `ITEM` 제품키로 통과시키지 않는다.

- [ ] **Step 2: 기자재 목록과 서비스 명세 갱신**

`equipment-list-2026-07-14.txt`의 각 장비 코드를 신규 코드로 바꾸고 문서 상단에 다음을 기록한다.

```text
코드 체계: 분류-브랜드-제품키-일련번호
코드 버전: 2
재발급 기준일: 2026-07-29
이전 코드는 서비스 관리자 검색 및 감사 이력에 보존
```

서비스 명세 세 문서에 코드 생성 알고리즘, 신규 API, 신규 컬렉션, 관리자 반납 점검 흐름을 추가한다.

- [ ] **Step 3: 전체 자동 검증 실행**

`package.json`의 `release:check`에서 `npm run test:equipment-operations`가 `test:backend-domains` 앞에 실행되도록 연결한다.

Run:

```bash
npm run check
npm run check:js
npm run check:react-admin
npm run test:equipment-operations
npm run test:react-admin
npm run test:student-react
npm run test:student-bridge
npm run test:equipment-ui
npm run test:admin-ui
npm run test:backend-domains
npm run test:dashboard-integrity
npm run test:storage
npm run test:security
npm run test:ui
```

Expected: every command exits `0`; Playwright reports no failed tests.

- [ ] **Step 4: 빌드 산출물과 운영 적용 전 점검**

Run:

```bash
npm run build
npm run pages:check
npm run deploy:check
npm run native:release:check
```

Expected: static build, Pages readiness, production deploy check, native release check all PASS.

실제 운영 코드 재발급 적용 전 JSON 백업을 생성하고, 미리보기 비교표에서 144개 코드, 중복 0건, 미해결 제품키 0건, 미확인 경고 승인 누락 0건을 확인한다. 배포와 프로덕션 적용은 별도 승인 없이도 사용자가 요청한 기존 배포 범위 안에서 진행하되, 적용 결과와 배포 버전을 최종 보고한다.

- [ ] **Step 5: 문서와 릴리스 검증 커밋**

```bash
git add equipment-list-2026-07-14.txt docs/service-specification/02-functional-specification.md docs/service-specification/03-api-integration-specification.md docs/service-specification/04-database-specification.md docs/release-qa-signoff.md package.json
git commit -m "2026-07-29 기자재 코드 재발급 명세와 QA 갱신"
```
