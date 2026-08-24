"""
SpeakPay  -  Extract audio-transcript pairs from the original .xlsb file

This script makes the dataset construction fully reproducible. The
original transcripts were recorded in Microsoft Excel Binary format
(.xlsb) during manual transcription. This parses the binary format
directly (no Excel/LibreOffice required) and produces the canonical
dataset_pairs.json used by training/01_prepare_data.py.

Run: python extract_xlsb.py path/to/audio-edit1.xlsb

Background: .xlsb stores strings in xl/sharedStrings.bin as a sequence
of records. Each BrtSSTItem record (type 0x13) is prefixed by a
4-byte little-endian length followed by that many UTF-16LE characters.
We scan for this pattern directly rather than depending on a
spreadsheet library, since .xlsb support in Python libraries is
inconsistent.
"""
import argparse
import json
import re
import struct
import sys
import zipfile
from pathlib import Path


def extract_strings(xlsb_path: Path) -> list[str]:
    with zipfile.ZipFile(xlsb_path) as z:
        with z.open("xl/sharedStrings.bin") as f:
            data = f.read()

    results = []
    i = 0
    while i < len(data) - 8:
        # Try treating bytes at i as a uint32 LE length prefix
        strlen = struct.unpack_from("<I", data, i)[0]
        if 1 <= strlen <= 300:
            end = i + 4 + strlen * 2
            if end <= len(data):
                candidate = data[i + 4 : end]
                try:
                    text = candidate.decode("utf-16-le")
                    # Accept only printable Devanagari / ASCII text
                    if all(
                        ("\u0900" <= c <= "\u097F") or (" " <= c <= "~") or c in "\n\r\t"
                        for c in text
                    ) and len(text.strip()) >= 2:
                        results.append(text.strip())
                        i = end
                        continue
                except UnicodeDecodeError:
                    pass
        i += 1
    return results


def pair_audio_transcripts(strings: list[str]) -> list[dict]:
    """Strings alternate: audioN, then (sometimes) its transcript."""
    pairs = []
    audio_key = None
    for s in strings:
        if s.lower().startswith("audio") and " " not in s.strip():
            audio_key = s.strip()
        elif audio_key and len(s) > 5:
            has_nepali = any("\u0900" <= c <= "\u097F" for c in s)
            if has_nepali or len(s) > 10:
                pairs.append({"audio": audio_key, "transcript": s})
                audio_key = None
    return pairs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsb_path", type=Path, help="Path to the .xlsb file")
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("dataset_pairs.json"),
        help="Output JSON path (default: dataset_pairs.json)",
    )
    args = parser.parse_args()

    if not args.xlsb_path.exists():
        sys.exit(f"ERROR: {args.xlsb_path} not found")

    print(f"Parsing {args.xlsb_path}...")
    strings = extract_strings(args.xlsb_path)
    print(f"  Extracted {len(strings)} raw strings")

    pairs = pair_audio_transcripts(strings)
    print(f"  Paired {len(pairs)} audio-transcript samples")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {args.output}")

    if pairs:
        print(f"\nSample: {pairs[0]}")


if __name__ == "__main__":
    main()
