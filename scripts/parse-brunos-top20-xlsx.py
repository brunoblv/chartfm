"""Parseia "Brunos Top 20.xlsx" para JSON consumível pelo importador.

Formato esperado:
- Linha 1: cabeçalhos; a partir de G1 existem datas semanais (sábado/domingo)
- Colunas:
  - B: artista
  - C: música
- Linhas a partir de 2:
  - Em cada coluna de semana (G+), célula numérica = posição naquela semana
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta
from typing import Any

import openpyxl


START_DATE = date(2001, 1, 1)
END_DATE = date(2010, 9, 30)
DATA_START_ROW = 2


def parse_excel_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        # Serial Excel
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=float(value))).date()
    if isinstance(value, str):
        s = value.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                pass
    return None


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/parse-brunos-top20-xlsx.py <xlsx-path>")

    path = sys.argv[1]
    wb = openpyxl.load_workbook(path, data_only=True)
    week_map: dict[str, dict[str, Any]] = {}

    for ws in wb.worksheets:
        max_col = ws.max_column or 1
        max_row = ws.max_row or DATA_START_ROW
        date_cols: list[tuple[int, date]] = []

        for col in range(1, max_col + 1):
            parsed = parse_excel_date(ws.cell(1, col).value)
            if parsed:
                date_cols.append((col, parsed))

        if not date_cols:
            continue

        for col, week_date in date_cols:
            if week_date < START_DATE or week_date > END_DATE:
                continue

            entries: list[dict[str, Any]] = []
            for row in range(DATA_START_ROW, max_row + 1):
                pos_val = ws.cell(row, col).value
                if not isinstance(pos_val, (int, float)):
                    continue
                pos = int(pos_val)
                if pos < 1 or pos > 20:
                    continue

                artist = ws.cell(row, 2).value
                title = ws.cell(row, 3).value
                if not artist or not title:
                    continue
                entries.append(
                    {
                        "position": pos,
                        "artist": str(artist).strip(),
                        "title": str(title).strip(),
                    }
                )

            if not entries:
                continue

            entries.sort(key=lambda e: (e["position"], e["artist"], e["title"]))
            dedup: dict[int, dict[str, Any]] = {}
            for e in entries:
                dedup[e["position"]] = e

            key = week_date.isoformat()
            candidate = {
                "date": key,
                "entries": [dedup[k] for k in sorted(dedup.keys())],
            }
            # Evita duplicata entre abas iguais; mantém o conjunto com mais entradas.
            if key not in week_map or len(candidate["entries"]) > len(week_map[key]["entries"]):
                week_map[key] = candidate

    weeks = sorted(week_map.values(), key=lambda w: w["date"])
    print(json.dumps(weeks, ensure_ascii=False))


if __name__ == "__main__":
    main()
