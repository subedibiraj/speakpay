# NepFinSpeech-403  -  Data Pipeline

This directory contains the dataset and the scripts that produced it,
for full reproducibility.

## Files

| File | Description |
|---|---|
| `nepfinspeech_dataset.json` | **Final dataset**  -  403 audio URLs + transcripts. This is what `training/scripts/01_prepare_data.py` consumes. |
| `dataset_pairs.json` | Intermediate: transcript pairs only (no URLs), extracted from the original `.xlsb`. |
| `url_map.json` | Fallback snapshot of audio_id → Cloudinary URL, in case the live collection API is unavailable. |
| `extract_xlsb.py` | Parses the original `.xlsb` transcription file (binary Excel format) and produces `dataset_pairs.json`. |
| `build_dataset.py` | Merges `dataset_pairs.json` with live/fallback URLs to produce `nepfinspeech_dataset.json`. |

## Reproducing from scratch

If you have the original `audio-edit1.xlsb` transcription file:

```bash
python extract_xlsb.py audio-edit1.xlsb -o dataset_pairs.json
python build_dataset.py
```

If you don't have the `.xlsb` (e.g. you're a third party who only
cloned this repo), `nepfinspeech_dataset.json` is already included  - 
no extraction needed. Just point `training/scripts/01_prepare_data.py`
at it directly.

## Data provenance

Audio was collected from undergraduate students and staff at Advanced
College of Engineering and Management (Tribhuvan University) through a
purpose-built web platform
([bolanepal.netlify.app](https://bolanepal.netlify.app)). Contributors
read prompted financial phrases aloud; audio was uploaded to Cloudinary,
and transcripts were manually verified and recorded in a spreadsheet
(the `.xlsb` file).

## License

This dataset is released under **CC-BY 4.0**. See the dataset card
at `docs/DATASET_CARD.md` for the full citation and usage terms.

## Statistics

- 403 transcribed utterances
- 4 intent categories: send (47.9%), balance (15.1%), load (13.9%), other (23.1%)
- 237 unique Nepali numerals
- ~75/10/15 train/val/test split (set in `training/scripts/config.py`)
