#!/usr/bin/env python3
"""Build the consolidated GJU service specification DOCX from Markdown sources."""

from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor, Twips
from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "docs" / "service-specification"
OUTPUT_PATH = SOURCE_DIR / "GJU-Photography-Reservation-통합서비스명세서.docx"
TABLE_HELPER_DIR = (
    Path.home()
    / ".codex"
    / "plugins"
    / "cache"
    / "openai-primary-runtime"
    / "documents"
    / "26.723.12215"
    / "skills"
    / "documents"
    / "scripts"
)
sys.path.insert(0, str(TABLE_HELPER_DIR))

from table_geometry import apply_table_geometry, column_widths_from_weights  # noqa: E402


CONTENT_WIDTH_DXA = 9360
# LibreOffice on macOS does not consistently honor Word's eastAsia-only
# fallback when the primary font lacks Hangul. Use installed Korean-capable
# families as a named CJK-heavy-document override so Word and PDF agree.
BODY_FONT = "IBM Plex Sans KR"
KOREAN_FONT = "IBM Plex Sans KR"
CODE_FONT = "D2Coding"
FONT_REGULAR_PATH = Path.home() / "Library" / "Fonts" / "IBMPlexSansKR-Regular.ttf"
FONT_BOLD_PATH = Path.home() / "Library" / "Fonts" / "IBMPlexSansKR-Bold.ttf"
BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
INK = RGBColor(32, 55, 72)
SUBTITLE = RGBColor(43, 81, 99)
MUTED = RGBColor(95, 105, 115)
GOLD = RGBColor(178, 138, 52)
LIGHT_BLUE = "E8EEF5"
LIGHT_GRAY = "F3F5F7"
BORDER = "C7D1DC"

MARKDOWN_FILES = [
    SOURCE_DIR / "README.md",
    SOURCE_DIR / "01-service-overview.md",
    SOURCE_DIR / "02-functional-specification.md",
    SOURCE_DIR / "03-api-integration-specification.md",
    SOURCE_DIR / "04-database-specification.md",
    SOURCE_DIR / "05-deployment-operations-security.md",
    SOURCE_DIR / "06-integration-checklist.md",
]


def set_run_font(
    run,
    *,
    name: str = BODY_FONT,
    east_asia: str = KOREAN_FONT,
    size: float | None = None,
    color: RGBColor | None = None,
    bold: bool | None = None,
    italic: bool | None = None,
) -> None:
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:eastAsia"), east_asia)
    rfonts.set(qn("w:cs"), east_asia)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def configure_style(
    style,
    *,
    size: float,
    color: RGBColor,
    bold: bool = False,
    before: float = 0,
    after: float = 6,
    line_spacing: float = 1.25,
    keep_with_next: bool = False,
) -> None:
    style.font.name = BODY_FONT
    style.font.size = Pt(size)
    style.font.color.rgb = color
    style.font.bold = bold
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn("w:ascii"), BODY_FONT)
    rfonts.set(qn("w:hAnsi"), BODY_FONT)
    rfonts.set(qn("w:eastAsia"), KOREAN_FONT)
    rfonts.set(qn("w:cs"), KOREAN_FONT)
    pf = style.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line_spacing
    pf.keep_with_next = keep_with_next
    pf.widow_control = True


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    section.different_first_page_header_footer = True

    configure_style(
        doc.styles["Normal"],
        size=11,
        color=RGBColor(24, 24, 24),
        after=6,
        line_spacing=1.25,
    )
    configure_style(
        doc.styles["Heading 1"],
        size=16,
        color=BLUE,
        bold=True,
        before=18,
        after=10,
        keep_with_next=True,
    )
    configure_style(
        doc.styles["Heading 2"],
        size=13,
        color=BLUE,
        bold=True,
        before=14,
        after=7,
        keep_with_next=True,
    )
    configure_style(
        doc.styles["Heading 3"],
        size=12,
        color=DARK_BLUE,
        bold=True,
        before=10,
        after=5,
        keep_with_next=True,
    )
    configure_style(
        doc.styles["List Paragraph"],
        size=11,
        color=RGBColor(24, 24, 24),
        after=4,
        line_spacing=1.25,
    )

    if "Code Block" not in doc.styles:
        code_style = doc.styles.add_style("Code Block", WD_STYLE_TYPE.PARAGRAPH)
    else:
        code_style = doc.styles["Code Block"]
    configure_style(
        code_style,
        size=8,
        color=RGBColor(35, 43, 51),
        after=6,
        line_spacing=1.0,
    )
    code_style.font.name = CODE_FONT
    code_rpr = code_style.element.get_or_add_rPr()
    code_rfonts = code_rpr.get_or_add_rFonts()
    code_rfonts.set(qn("w:ascii"), CODE_FONT)
    code_rfonts.set(qn("w:hAnsi"), CODE_FONT)
    code_rfonts.set(qn("w:eastAsia"), KOREAN_FONT)
    code_rfonts.set(qn("w:cs"), KOREAN_FONT)
    code_style.paragraph_format.left_indent = Inches(0.12)
    code_style.paragraph_format.right_indent = Inches(0.12)

    if "Table Text" not in doc.styles:
        table_style = doc.styles.add_style("Table Text", WD_STYLE_TYPE.PARAGRAPH)
    else:
        table_style = doc.styles["Table Text"]
    configure_style(
        table_style,
        size=9.25,
        color=RGBColor(24, 24, 24),
        after=0,
        line_spacing=1.08,
    )

    set_running_header(section)
    set_running_footer(section)
    set_update_fields_on_open(doc)


def set_update_fields_on_open(doc: Document) -> None:
    settings = doc.settings._element
    update = settings.find(qn("w:updateFields"))
    if update is None:
        update = OxmlElement("w:updateFields")
        settings.append(update)
    update.set(qn("w:val"), "true")


def set_running_header(section) -> None:
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(6.5))
    left = p.add_run("GJU Photography Reservation")
    set_run_font(left, size=8.5, color=MUTED, bold=True)
    right = p.add_run("\t통합 서비스 명세 · 2026-07")
    set_run_font(right, size=8.5, color=MUTED)
    ppr = p._p.get_or_add_pPr()
    pbdr = ppr.find(qn("w:pBdr"))
    if pbdr is None:
        pbdr = OxmlElement("w:pBdr")
        ppr.append(pbdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "3")
    bottom.set(qn("w:color"), "B9C4CE")
    pbdr.append(bottom)


def add_field(run, instruction: str) -> None:
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])


def set_running_footer(section) -> None:
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    prefix = p.add_run("광주대학교 사진영상미디어학과  ·  ")
    set_run_font(prefix, size=8.5, color=MUTED)
    page_run = p.add_run()
    set_run_font(page_run, size=8.5, color=MUTED)
    add_field(page_run, "PAGE")


def add_cover(doc: Document) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(132)

    kicker = doc.add_paragraph()
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
    kicker.paragraph_format.space_after = Pt(18)
    run = kicker.add_run("SYSTEM REFERENCE GUIDE")
    set_run_font(run, size=10.5, color=GOLD, bold=True)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(8)
    run = title.add_run("GJU Photography Reservation")
    set_run_font(run, size=30, color=INK, bold=True)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(2)
    run = subtitle.add_run("통합 서비스 명세서")
    set_run_font(run, size=15, color=SUBTITLE, bold=True)

    subtitle2 = doc.add_paragraph()
    subtitle2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle2.paragraph_format.space_after = Pt(28)
    run = subtitle2.add_run("기능 · API · 데이터베이스 · 배포 · 보안 · 연동")
    set_run_font(run, size=15, color=SUBTITLE)

    descriptor = doc.add_paragraph()
    descriptor.alignment = WD_ALIGN_PARAGRAPH.CENTER
    descriptor.paragraph_format.space_after = Pt(82)
    run = descriptor.add_run("—  기존 서비스 결합을 위한 구현 기준 문서  —")
    set_run_font(run, size=10.5, color=GOLD)

    published = doc.add_paragraph()
    published.alignment = WD_ALIGN_PARAGRAPH.CENTER
    published.paragraph_format.space_after = Pt(4)
    run = published.add_run("2026년 7월 26일")
    set_run_font(run, size=12, color=INK, bold=True)

    prepared = doc.add_paragraph()
    prepared.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prepared.paragraph_format.space_after = Pt(22)
    run = prepared.add_run("광주대학교 사진영상미디어학과 서비스 연동용")
    set_run_font(run, size=9.5, color=RGBColor(80, 80, 80), italic=True)

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note.paragraph_format.space_after = Pt(0)
    run = note.add_run("문서 기준: main · 1e3aeb3 / Native 1.5.1 (32)")
    set_run_font(run, size=8.5, color=MUTED)

    doc.add_page_break()


def create_numbering(doc: Document) -> tuple[int, int]:
    numbering = doc.part.numbering_part._element
    abstract_ids = [
        int(el.get(qn("w:abstractNumId")))
        for el in numbering.findall(qn("w:abstractNum"))
    ]
    num_ids = [int(el.get(qn("w:numId"))) for el in numbering.findall(qn("w:num"))]
    next_abstract = max(abstract_ids, default=0) + 1
    next_num = max(num_ids, default=0) + 1

    def add_abstract(abstract_id: int, fmt: str, text: str, font: str | None = None) -> None:
        abstract = OxmlElement("w:abstractNum")
        abstract.set(qn("w:abstractNumId"), str(abstract_id))
        multi = OxmlElement("w:multiLevelType")
        multi.set(qn("w:val"), "singleLevel")
        abstract.append(multi)
        level = OxmlElement("w:lvl")
        level.set(qn("w:ilvl"), "0")
        start = OxmlElement("w:start")
        start.set(qn("w:val"), "1")
        level.append(start)
        num_fmt = OxmlElement("w:numFmt")
        num_fmt.set(qn("w:val"), fmt)
        level.append(num_fmt)
        lvl_text = OxmlElement("w:lvlText")
        lvl_text.set(qn("w:val"), text)
        level.append(lvl_text)
        suff = OxmlElement("w:suff")
        suff.set(qn("w:val"), "tab")
        level.append(suff)
        if font:
            rpr = OxmlElement("w:rPr")
            rfonts = OxmlElement("w:rFonts")
            rfonts.set(qn("w:ascii"), font)
            rfonts.set(qn("w:hAnsi"), font)
            rpr.append(rfonts)
            level.append(rpr)
        ppr = OxmlElement("w:pPr")
        tabs = OxmlElement("w:tabs")
        tab = OxmlElement("w:tab")
        tab.set(qn("w:val"), "num")
        tab.set(qn("w:pos"), "540")
        tabs.append(tab)
        ppr.append(tabs)
        ind = OxmlElement("w:ind")
        ind.set(qn("w:left"), "540")
        ind.set(qn("w:hanging"), "270")
        ppr.append(ind)
        level.append(ppr)
        abstract.append(level)
        numbering.append(abstract)

    def add_num(num_id: int, abstract_id: int) -> None:
        num = OxmlElement("w:num")
        num.set(qn("w:numId"), str(num_id))
        abstract_ref = OxmlElement("w:abstractNumId")
        abstract_ref.set(qn("w:val"), str(abstract_id))
        num.append(abstract_ref)
        numbering.append(num)

    add_abstract(next_abstract, "bullet", "•", BODY_FONT)
    add_num(next_num, next_abstract)
    bullet_num_id = next_num
    add_abstract(next_abstract + 1, "decimal", "%1.")
    add_num(next_num + 1, next_abstract + 1)
    decimal_abstract_id = next_abstract + 1
    decimal_num_id = next_num + 1
    return bullet_num_id, decimal_num_id, decimal_abstract_id


def create_list_instance(doc: Document, abstract_id: int) -> int:
    numbering = doc.part.numbering_part._element
    num_ids = [int(el.get(qn("w:numId"))) for el in numbering.findall(qn("w:num"))]
    num_id = max(num_ids, default=0) + 1
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract_ref = OxmlElement("w:abstractNumId")
    abstract_ref.set(qn("w:val"), str(abstract_id))
    num.append(abstract_ref)
    numbering.append(num)
    return num_id


def apply_num(paragraph, num_id: int) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    num_pr = ppr.find(qn("w:numPr"))
    if num_pr is None:
        num_pr = OxmlElement("w:numPr")
        ppr.append(num_pr)
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    num = OxmlElement("w:numId")
    num.set(qn("w:val"), str(num_id))
    num_pr.extend([ilvl, num])


INLINE_PATTERN = re.compile(
    r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))"
)


def add_inline(paragraph, text: str, *, size: float | None = None) -> None:
    text = text.replace("<br/>", " / ").replace("<br>", " / ")
    cursor = 0
    for match in INLINE_PATTERN.finditer(text):
        if match.start() > cursor:
            run = paragraph.add_run(text[cursor : match.start()])
            set_run_font(run, size=size)
        token = match.group(0)
        if token.startswith("**"):
            run = paragraph.add_run(token[2:-2])
            set_run_font(run, size=size, bold=True)
        elif token.startswith("`"):
            run = paragraph.add_run(token[1:-1])
            set_run_font(
                run,
                name=CODE_FONT,
                east_asia=KOREAN_FONT,
                size=(size or 10.5) - 0.5,
                color=DARK_BLUE,
            )
        else:
            link = re.match(r"\[([^\]]+)\]\(([^)]+)\)", token)
            label = link.group(1) if link else token
            run = paragraph.add_run(label)
            set_run_font(run, size=size, color=BLUE)
            run.underline = True
        cursor = match.end()
    if cursor < len(text):
        run = paragraph.add_run(text[cursor:])
        set_run_font(run, size=size)


def shade_paragraph(paragraph, fill: str) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    shd = ppr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        ppr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def set_cell_shading(cell, fill: str) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    shd = tcpr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tcpr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def set_table_borders(table) -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        border = borders.find(tag)
        if border is None:
            border = OxmlElement(f"w:{edge}")
            borders.append(border)
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), BORDER)


def mark_header_row(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    trpr.append(header)


def prevent_row_split(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    cant_split.set(qn("w:val"), "true")
    trpr.append(cant_split)


def table_weights(headers: list[str]) -> list[float]:
    n = len(headers)
    normalized = [re.sub(r"[`*]", "", header).lower() for header in headers]
    if n == 1:
        return [1]
    if n == 2:
        if any(term in normalized[0] for term in ("항목", "문서", "필드", "상태", "이름")):
            return [1.875, 4.625]
        return [1.181, 5.319]
    if n == 3:
        return [1.5, 2.1, 2.9]
    if n == 4:
        return [1.1, 1.55, 1.7, 2.15]
    if n == 5:
        if "경로" in normalized or "route" in normalized or "path" in normalized:
            return [0.65, 1.9, 0.8, 1.35, 1.8]
        return [1.05, 1.2, 0.9, 1.2, 2.15]
    return [1] * n


def split_markdown_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", stripped)]


def is_table_separator(line: str) -> bool:
    cells = split_markdown_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells)


def add_table(doc: Document, rows: list[list[str]]) -> None:
    column_count = len(rows[0])
    normalized_rows = [
        row[:column_count] + [""] * max(0, column_count - len(row)) for row in rows
    ]
    table = doc.add_table(rows=0, cols=column_count)
    table.style = "Table Grid"
    set_table_borders(table)
    font_size = 8.35 if column_count >= 5 else 8.7 if column_count == 4 else 9.25

    for row_idx, row_values in enumerate(normalized_rows):
        row = table.add_row()
        prevent_row_split(row)
        if row_idx == 0:
            mark_header_row(row)
        for col_idx, value in enumerate(row_values):
            cell = row.cells[col_idx]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if row_idx == 0:
                set_cell_shading(cell, LIGHT_BLUE)
            cell.text = ""
            p = cell.paragraphs[0]
            p.style = doc.styles["Table Text"]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            add_inline(p, value.replace("\\|", "|"), size=font_size)
            if row_idx == 0:
                for run in p.runs:
                    run.bold = True
                    run.font.color.rgb = DARK_BLUE

    widths = column_widths_from_weights(table_weights(rows[0]), CONTENT_WIDTH_DXA)
    apply_table_geometry(
        table,
        widths,
        table_width_dxa=CONTENT_WIDTH_DXA,
        indent_dxa=120,
        cell_margins_dxa={"top": 80, "bottom": 80, "start": 120, "end": 120},
    )
    after = doc.add_paragraph()
    after.paragraph_format.space_before = Pt(0)
    after.paragraph_format.space_after = Pt(2)


def add_code_block(doc: Document, language: str, lines: list[str]) -> None:
    p = doc.add_paragraph(style="Code Block")
    p.paragraph_format.keep_together = False
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(7)
    shade_paragraph(p, LIGHT_GRAY)
    label = p.add_run(f"[{language or 'text'}]\n")
    set_run_font(label, name=CODE_FONT, east_asia=KOREAN_FONT, size=7.25, color=MUTED, bold=True)
    run = p.add_run("\n".join(lines))
    set_run_font(run, name=CODE_FONT, east_asia=KOREAN_FONT, size=7.8, color=RGBColor(35, 43, 51))


def add_heading(doc: Document, level: int, text: str, *, page_break: bool = False) -> None:
    style = f"Heading {min(level, 3)}"
    p = doc.add_paragraph(style=style)
    if page_break:
        p.paragraph_format.page_break_before = True
    add_inline(p, text)


def add_callout(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.12)
    p.paragraph_format.right_indent = Inches(0.12)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(7)
    shade_paragraph(p, LIGHT_BLUE)
    add_inline(p, text)


def parse_markdown(
    doc: Document,
    path: Path,
    *,
    bullet_num_id: int,
    decimal_abstract_id: int,
) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    index = 0
    in_numbered_list = False
    decimal_num_id: int | None = None
    first_h1 = True

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            in_numbered_list = False
            index += 1
            continue

        if stripped.startswith("```"):
            language = stripped[3:].strip()
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            add_code_block(doc, language, code_lines)
            index += 1
            in_numbered_list = False
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            table_rows = [split_markdown_row(line)]
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_rows.append(split_markdown_row(lines[index]))
                index += 1
            add_table(doc, table_rows)
            in_numbered_list = False
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            level = len(heading.group(1))
            title = heading.group(2)
            if path.name == "README.md" and level == 1:
                title = "문서 사용 안내"
            add_heading(
                doc,
                level,
                title,
                page_break=(level == 1 and path.name != "README.md" and first_h1),
            )
            first_h1 = False
            in_numbered_list = False
            index += 1
            continue

        if stripped == "---":
            index += 1
            in_numbered_list = False
            continue

        quote = re.match(r"^>\s?(.*)$", stripped)
        if quote:
            add_callout(doc, quote.group(1))
            index += 1
            in_numbered_list = False
            continue

        bullet = re.match(r"^[-*]\s+(.+)$", stripped)
        if bullet:
            p = doc.add_paragraph(style="List Paragraph")
            apply_num(p, bullet_num_id)
            add_inline(p, bullet.group(1))
            index += 1
            in_numbered_list = False
            continue

        numbered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if numbered:
            if not in_numbered_list or decimal_num_id is None:
                decimal_num_id = create_list_instance(doc, decimal_abstract_id)
            p = doc.add_paragraph(style="List Paragraph")
            apply_num(p, decimal_num_id)
            add_inline(p, numbered.group(1))
            index += 1
            in_numbered_list = True
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            nxt = lines[index].strip()
            if (
                not nxt
                or nxt.startswith("#")
                or nxt.startswith("```")
                or nxt.startswith("|")
                or nxt.startswith("- ")
                or nxt.startswith("* ")
                or nxt.startswith("> ")
                or re.match(r"^\d+\.\s+", nxt)
                or nxt == "---"
            ):
                break
            paragraph_lines.append(nxt)
            index += 1
        p = doc.add_paragraph()
        add_inline(p, " ".join(paragraph_lines))
        in_numbered_list = False


def add_front_summary(doc: Document) -> None:
    add_heading(doc, 1, "통합본 구성")
    p = doc.add_paragraph()
    add_inline(
        p,
        "이 문서는 현재 main 구현을 기준으로 작성한 운영 명세와 기존 서비스 결합 시 적용할 권장안을 함께 제공한다. "
        "표의 ‘현재 구현’은 코드상 사실이며, ‘연동 권장’과 체크리스트는 통합 단계에서 결정·수행할 항목이다.",
    )

    rows = [
        ["구분", "내용"],
        ["현행 기준", "main 1e3aeb3, Native 1.5.1 (32), 2026-07-26"],
        ["핵심 도메인", "계정, 기자재·공간 예약, 보고서, 특강, 공지, 교과 수요조사, 운영 통계"],
        ["운영 저장소", "Cloudflare Durable Object SQLite, 단일 인스턴스 global"],
        ["기존 서비스 결합", "1차 API 어댑터 → 2차 인증·UI → 필요 시 3차 데이터 통합"],
        ["교과 범위", "학년·학기별 5~6개 후보 설문과 학생 1~5순위 투표; 공식 편성안 작성 제외"],
    ]
    add_table(doc, rows)

    add_heading(doc, 2, "읽는 순서")
    ordered = [
        "서비스 범위와 시스템 경계를 01장에서 합의한다.",
        "학생·관리자 업무 규칙과 정량 산식을 02장에서 확인한다.",
        "인증과 API 계약을 03장, 저장 구조와 이관 항목을 04장에서 확정한다.",
        "운영·보안·배포 책임을 05장에서 배분한다.",
        "06장의 체크리스트와 인수 기준으로 통합을 검수한다.",
    ]
    _, decimal_num_id, decimal_abstract_id = create_numbering(doc)
    del decimal_num_id
    sequence_num_id = create_list_instance(doc, decimal_abstract_id)
    for item in ordered:
        p = doc.add_paragraph(style="List Paragraph")
        apply_num(p, sequence_num_id)
        add_inline(p, item)


def obfuscate_embedded_font(font_path: Path, font_key) -> bytes:
    data = bytearray(font_path.read_bytes())
    key_bytes = font_key.bytes
    for index in range(min(32, len(data))):
        data[index] ^= key_bytes[15 - (index % 16)]
    return bytes(data)


def embed_document_fonts(path: Path) -> None:
    """Embed the Korean body font so headless and cross-platform renders agree."""

    if not FONT_REGULAR_PATH.exists() or not FONT_BOLD_PATH.exists():
        missing = [
            str(font_path)
            for font_path in (FONT_REGULAR_PATH, FONT_BOLD_PATH)
            if not font_path.exists()
        ]
        raise FileNotFoundError(f"Required document fonts are missing: {', '.join(missing)}")

    with ZipFile(path, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}

    word_ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    relationship_ns = (
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    )
    package_relationship_ns = (
        "http://schemas.openxmlformats.org/package/2006/relationships"
    )
    content_type_ns = (
        "http://schemas.openxmlformats.org/package/2006/content-types"
    )

    font_table = etree.fromstring(entries["word/fontTable.xml"])
    font = font_table.find(
        f'{{{word_ns}}}font[@{{{word_ns}}}name="{BODY_FONT}"]'
    )
    if font is None:
        font = etree.SubElement(
            font_table,
            f"{{{word_ns}}}font",
            {f"{{{word_ns}}}name": BODY_FONT},
        )
        etree.SubElement(
            font,
            f"{{{word_ns}}}family",
            {f"{{{word_ns}}}val": "swiss"},
        )
        etree.SubElement(
            font,
            f"{{{word_ns}}}pitch",
            {f"{{{word_ns}}}val": "variable"},
        )

    for tag in ("embedRegular", "embedBold"):
        old = font.find(f"{{{word_ns}}}{tag}")
        if old is not None:
            font.remove(old)

    rels_name = "word/_rels/fontTable.xml.rels"
    if rels_name in entries:
        relationships = etree.fromstring(entries[rels_name])
    else:
        relationships = etree.Element(
            f"{{{package_relationship_ns}}}Relationships",
            nsmap={None: package_relationship_ns},
        )
    used_rel_ids = {relationship.get("Id") for relationship in relationships}
    next_rel_id = 1
    while f"rId{next_rel_id}" in used_rel_ids:
        next_rel_id += 1

    font_specs = [
        ("embedRegular", FONT_REGULAR_PATH, "IBMPlexSansKR-Regular.odttf"),
        ("embedBold", FONT_BOLD_PATH, "IBMPlexSansKR-Bold.odttf"),
    ]
    for tag, font_path, target_name in font_specs:
        font_key = uuid4()
        rel_id = f"rId{next_rel_id}"
        next_rel_id += 1
        entries[f"word/fonts/{target_name}"] = obfuscate_embedded_font(
            font_path, font_key
        )
        etree.SubElement(
            relationships,
            f"{{{package_relationship_ns}}}Relationship",
            {
                "Id": rel_id,
                "Type": (
                    "http://schemas.openxmlformats.org/officeDocument/"
                    "2006/relationships/font"
                ),
                "Target": f"fonts/{target_name}",
            },
        )
        etree.SubElement(
            font,
            f"{{{word_ns}}}{tag}",
            {
                f"{{{relationship_ns}}}id": rel_id,
                f"{{{word_ns}}}fontKey": "{" + str(font_key).upper() + "}",
            },
        )

    content_types = etree.fromstring(entries["[Content_Types].xml"])
    existing_type = content_types.xpath(
        'ct:Default[@Extension="odttf"]',
        namespaces={"ct": content_type_ns},
    )
    if not existing_type:
        etree.SubElement(
            content_types,
            f"{{{content_type_ns}}}Default",
            {
                "Extension": "odttf",
                "ContentType": (
                    "application/vnd.openxmlformats-officedocument.obfuscatedFont"
                ),
            },
        )

    entries["word/fontTable.xml"] = etree.tostring(
        font_table,
        xml_declaration=True,
        encoding="UTF-8",
        standalone=True,
    )
    entries[rels_name] = etree.tostring(
        relationships,
        xml_declaration=True,
        encoding="UTF-8",
        standalone=True,
    )
    entries["[Content_Types].xml"] = etree.tostring(
        content_types,
        xml_declaration=True,
        encoding="UTF-8",
        standalone=True,
    )

    temporary_path = path.with_name(f".{path.stem}.building.docx")
    with ZipFile(temporary_path, "w", ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    temporary_path.replace(path)


def build() -> Path:
    doc = Document()
    configure_document(doc)
    doc.core_properties.title = "GJU Photography Reservation 통합 서비스 명세서"
    doc.core_properties.subject = "기능, API, 데이터베이스, 배포, 보안, 기존 서비스 연동 명세"
    doc.core_properties.author = "광주대학교 사진영상미디어학과"
    doc.core_properties.keywords = "GJU, reservation, equipment, course demand, integration"
    doc.core_properties.comments = "Generated from docs/service-specification Markdown sources."
    doc.core_properties.created = datetime(2026, 7, 26, 0, 0, 0)
    doc.core_properties.modified = datetime(2026, 7, 26, 0, 0, 0)

    add_cover(doc)
    add_front_summary(doc)
    doc.add_page_break()

    bullet_num_id, _, decimal_abstract_id = create_numbering(doc)
    for path in MARKDOWN_FILES:
        parse_markdown(
            doc,
            path,
            bullet_num_id=bullet_num_id,
            decimal_abstract_id=decimal_abstract_id,
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT_PATH)
    embed_document_fonts(OUTPUT_PATH)
    return OUTPUT_PATH


if __name__ == "__main__":
    output = build()
    print(output)
