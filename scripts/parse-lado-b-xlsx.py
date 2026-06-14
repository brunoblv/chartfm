"""Parse LADO B.xlsx → JSON (stdout).

Abas LADO B-YYYY:
  - Cabeçalho de semana:
      * col B = data (datetime), ou
      * col B = rótulo + col C = data, ou
      * col B = rótulo (ex.: SETEMBRO/SEMANA 1)
  - Primeira semana de 2025 começa na linha 2 (14/04/2025).
  - Entradas: col A = posição, col B = artista, col C = música.
  - Paradas podem ter 1–20 e depois 21–25 na mesma semana.

Usage:
  python parse-lado-b-xlsx.py <path-to-xlsx>
  python parse-lado-b-xlsx.py <path-to-xlsx> --year=2025
  python parse-lado-b-xlsx.py <path-to-xlsx> --sheet="LADO B-2025"
"""
import json
import re
import sys
from datetime import date, datetime, timedelta

import openpyxl

SHEET_PATTERN = re.compile(r"^LADO B[- ](\d{4})$", re.I)

MONTHS_PT = {
    "JANEIRO": 1,
    "FEVEREIRO": 2,
    "MARCO": 3,
    "MARÇO": 3,
    "ABRIL": 4,
    "MAIO": 5,
    "JUNHO": 6,
    "JULHO": 7,
    "AGOSTO": 8,
    "SETEMBRO": 9,
    "OUTUBRO": 10,
    "NOVEMBRO": 11,
    "DEZEMBRO": 12,
}

LABEL_PATTERN = re.compile(
    r"(JANEIRO|FEVEREIRO|MAR[ÇC]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)"
    r".{0,20}(?:SEMANA\s*(\d+)|#\s*(\d+)|#(\d+))",
    re.I,
)


def norm(s: str) -> str:
    return str(s).strip()


def monday_on_or_after(d: date) -> date:
    return d + timedelta(days=(7 - d.weekday()) % 7) if d.weekday() != 0 else d


def first_monday_of_month(year: int, month: int) -> date:
    return monday_on_or_after(date(year, month, 1))


def infer_date_from_label(label: str, year: int) -> date | None:
    m = LABEL_PATTERN.search(label.upper().replace("Ç", "C"))
    if not m:
        return None
    month_name = m.group(1).upper().replace("Ç", "C")
    month = MONTHS_PT.get(month_name)
    if not month:
        return None
    week_num = int(m.group(2) or m.group(3) or m.group(4))
    first_mon = first_monday_of_month(year, month)
    return first_mon + timedelta(weeks=week_num - 1)


def parse_marker(row) -> tuple[str | None, date | None, str | None] | None:
    a = row[0] if len(row) > 0 else None
    b = row[1] if len(row) > 1 else None
    c = row[2] if len(row) > 2 else None

    if a is not None:
        return None

    if isinstance(b, datetime):
        d = b.date()
        return (d.strftime("%d/%m"), d, None)

    if b and isinstance(c, datetime):
        label = norm(b)
        d = c.date()
        return (label, d, label)

    if b and isinstance(b, str):
        label = norm(b)
        upper = label.upper()
        if re.search(r"(SEMANA|OUTUBRO|NOVEMBRO|DEZEMBRO|SETEMBRO|AGOSTO|JANEIRO|FEVEREIRO|MAR|ABRIL|MAIO|JUNHO|#)", upper):
            if isinstance(c, (int, float)):
                return None
            return (label, None, label)

    return None


def finalize_entries(entries: list[tuple[int, str, str]]) -> list[dict]:
    by_pos: dict[int, tuple[int, str, str]] = {}
    for item in entries:
        by_pos[item[0]] = item
    return [
        {"position": p, "artist": a, "title": t}
        for p, (_, a, t) in sorted(by_pos.items())
    ]


def split_section_into_weeks(raw: list[tuple[int, str, str]]) -> list[list[dict]]:
    if not raw:
        return []

    chunks: list[list[tuple[int, str, str]]] = []
    chunk: list[tuple[int, str, str]] = []
    for pos, artist, title in raw:
        if pos == 1 and chunk:
            chunks.append(chunk)
            chunk = [(pos, artist, title)]
        elif not chunk:
            chunk = [(pos, artist, title)]
        else:
            chunk.append((pos, artist, title))
    if chunk:
        chunks.append(chunk)

    finalized = [finalize_entries(c) for c in chunks if c]
    result: list[list[dict]] = []
    i = 0

    while i < len(finalized):
        cur = finalized[i]
        cur_max = cur[-1]["position"]

        if cur_max <= 20:
            tail_idx = None
            j = i + 1
            while j < len(finalized):
                nxt = finalized[j]
                nxt_min = nxt[0]["position"]
                nxt_max = nxt[-1]["position"]
                if nxt_min >= 21:
                    tail_idx = j
                    break
                if nxt_min == 1 and nxt_max <= 20:
                    j += 1
                    continue
                break

            if tail_idx is not None:
                merged: dict[int, dict] = {e["position"]: e for e in cur}
                for e in finalized[tail_idx]:
                    merged[e["position"]] = e
                result.append([merged[k] for k in sorted(merged)])
                i = tail_idx + 1
                continue

            if i + 1 < len(finalized) and finalized[i + 1][0]["position"] == 1:
                i += 1
                continue

        result.append(cur)
        i += 1

    return result


def extract_raw_entries(ws, start_row: int, end_row: int) -> list[tuple[int, str, str]]:
    rows: list[tuple[int, str, str]] = []
    for i in range(start_row, end_row):
        a = ws.cell(i, 1).value
        b = ws.cell(i, 2).value
        c = ws.cell(i, 3).value
        if a is not None and b and c and isinstance(a, (int, float)):
            rows.append((int(a), norm(b), norm(c)))
    return rows


def apply_numbered_month_dates(weeks: list[dict], year: int) -> None:
    """Semanas NOVEMBRO/DEZEMBRO #N com data explícita na planilha."""
    for w in weeks:
        m = re.search(
            r"(NOVEMBRO|DEZEMBRO)\s*/?\s*#(\d+)",
            w["label"].upper().replace("Ç", "C"),
        )
        if not m:
            continue
        month = MONTHS_PT[m.group(1)]
        week_num = int(m.group(2))
        first_mon = first_monday_of_month(year, month)
        w["date"] = (first_mon + timedelta(weeks=week_num - 1)).strftime("%Y-%m-%d")

    for w in weeks:
        if re.search(r"OUTUBRO\s*/\s*#\s*4", w["label"].upper()):
            nov1 = next(
                (x for x in weeks if re.search(r"NOVEMBRO\s*/\s*#\s*1", x["label"].upper())),
                None,
            )
            if nov1:
                d = date.fromisoformat(nov1["date"]) - timedelta(days=7)
                w["date"] = d.strftime("%Y-%m-%d")

    out4 = next((x for x in weeks if re.search(r"OUTUBRO\s*/\s*#\s*4", x["label"].upper())), None)
    if out4:
        sem4 = next((x for x in weeks if re.search(r"OUTUBRO\s*/\s*SEMANA\s*4", x["label"].upper())), None)
        if sem4:
            d = date.fromisoformat(out4["date"]) - timedelta(days=7)
            sem4["date"] = d.strftime("%Y-%m-%d")
            cursor = d
            for n in (3, 2, 1):
                sem = next(
                    (x for x in weeks if re.search(rf"OUTUBRO\s*/\s*SEMANA\s*{n}\b", x["label"].upper())),
                    None,
                )
                if sem:
                    cursor -= timedelta(days=7)
                    sem["date"] = cursor.strftime("%Y-%m-%d")


def parse_sheet_legacy(ws, sheet_name: str) -> list[dict]:
    """Formato 2026: rótulo na col B, data na col C."""
    weeks: list[dict] = []
    current: dict | None = None

    for row in ws.iter_rows(min_row=1, values_only=True):
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None

        if b and isinstance(c, datetime):
            if current:
                weeks.append(current)
            current = {
                "sheet": sheet_name,
                "label": norm(b),
                "date": c.strftime("%Y-%m-%d"),
                "entries": [],
            }
            continue

        if current and a is not None and b and c and isinstance(a, (int, float)):
            current["entries"].append(
                {"position": int(a), "artist": norm(b), "title": norm(c)}
            )

    if current:
        weeks.append(current)
    return weeks


def parse_sheet_2025(ws, sheet_name: str, year: int) -> list[dict]:
    markers: list[tuple[int, str | None, date | None, str | None]] = []

    for i, row in enumerate(ws.iter_rows(min_row=1, values_only=True), 1):
        marker = parse_marker(row)
        if marker:
            label, d, raw_label = marker
            markers.append((i, raw_label or label, d, label))

    if not markers:
        return []

    # Primeira semana começa na linha 2 (14/04/2025)
    first_date = date(year, 4, 14)
    sections: list[tuple[int, int, str | None, date | None, str | None]] = []
    sections.append((2, markers[0][0], "ABRIL #1", first_date, "14/04"))

    for idx, (line, raw_label, d, label) in enumerate(markers):
        start = line + 1
        end = markers[idx + 1][0] if idx + 1 < len(markers) else ws.max_row + 1
        sections.append((start, end, raw_label, d, label))

    weeks: list[dict] = []
    pending: list[tuple[str, list[dict], date | None]] = []

    for start, end, raw_label, explicit_date, display_label in sections:
        raw = extract_raw_entries(ws, start, end)
        sub_weeks = split_section_into_weeks(raw)
        if not sub_weeks:
            continue

        for sub_idx, entries in enumerate(sub_weeks):
            if len(entries) < 10:
                continue
            week_label = raw_label or display_label or f"Semana {len(weeks) + 1}"
            exp = explicit_date if sub_idx == 0 else None
            pending.append((week_label if sub_idx == 0 else f"{week_label} (+{sub_idx})", entries, exp))

    cursor = first_date
    for i, (label, entries, exp) in enumerate(pending):
        if exp:
            cursor = exp
        else:
            inferred = infer_date_from_label(label, year)
            if inferred and inferred > cursor + timedelta(days=3):
                cursor = inferred
        weeks.append(
            {
                "sheet": sheet_name,
                "label": label,
                "date": cursor.strftime("%Y-%m-%d"),
                "entries": entries,
            }
        )
        cursor = cursor + timedelta(days=7)

    apply_numbered_month_dates(weeks, year)
    return weeks


def parse_sheet(ws, sheet_name: str) -> list[dict]:
    m = SHEET_PATTERN.match(sheet_name.strip())
    year = int(m.group(1)) if m else 2026

    # Detecta formato: se existir data só na col B, usa parser 2025
    has_date_only_b = False
    has_label_date_c = False
    for row in ws.iter_rows(min_row=1, values_only=True):
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        c = row[2] if len(row) > 2 else None
        if a is None and isinstance(b, datetime):
            has_date_only_b = True
        if a is None and b and isinstance(c, datetime):
            has_label_date_c = True

    if has_date_only_b or (year <= 2025 and not has_label_date_c):
        return parse_sheet_2025(ws, sheet_name, year)
    return parse_sheet_legacy(ws, sheet_name)


def matching_sheets(wb, year_filter: int | None = None) -> list[str]:
    names: list[str] = []
    for name in wb.sheetnames:
        m = SHEET_PATTERN.match(name.strip())
        if not m:
            continue
        sheet_year = int(m.group(1))
        if year_filter is not None and sheet_year != year_filter:
            continue
        names.append(name)
    return sorted(names, key=lambda n: int(SHEET_PATTERN.match(n).group(1)))


def parse_workbook(path: str, sheet: str | None = None, year: int | None = None) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet:
            if sheet not in wb.sheetnames:
                raise ValueError(f"Aba não encontrada: {sheet}")
            sheets = [sheet]
        else:
            sheets = matching_sheets(wb, year)

        if not sheets:
            raise ValueError("Nenhuma aba LADO B-YYYY encontrada na planilha")

        all_weeks: list[dict] = []
        for name in sheets:
            all_weeks.extend(parse_sheet(wb[name], name))

        all_weeks.sort(key=lambda w: w["date"])
        return all_weeks
    finally:
        wb.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse-lado-b-xlsx.py <path-to-xlsx> [--sheet=NAME] [--year=YYYY]", file=sys.stderr)
        sys.exit(1)

    xlsx_path = sys.argv[1]
    sheet_arg = next((a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("--sheet=")), None)
    year_arg = next((a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("--year=")), None)
    year = int(year_arg) if year_arg else None

    data = parse_workbook(xlsx_path, sheet=sheet_arg, year=year)
    print(json.dumps(data, ensure_ascii=False))
