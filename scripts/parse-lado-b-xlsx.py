"""Parse LADO B.xlsx → JSON (stdout). Col A=posição, B=artista, C=música; data na col C da linha de cabeçalho."""
import json
import sys
from datetime import datetime

import openpyxl


def parse_workbook(path: str) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
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
                "label": str(b).strip(),
                "date": c.strftime("%Y-%m-%d"),
                "entries": [],
            }
            continue

        if current and a is not None and b and c and isinstance(a, (int, float)):
            current["entries"].append(
                {
                    "position": int(a),
                    "artist": str(b).strip(),
                    "title": str(c).strip(),
                }
            )

    if current:
        weeks.append(current)
    wb.close()
    return weeks


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse-lado-b-xlsx.py <path-to-xlsx>", file=sys.stderr)
        sys.exit(1)
    data = parse_workbook(sys.argv[1])
    print(json.dumps(data, ensure_ascii=False))
