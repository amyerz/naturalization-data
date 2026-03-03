# naturalization-data

Open-source data for the U.S. Naturalization Civics Test.

## Structure

```
questions/
  en.json          # English — 128 questions (2025 USCIS version)
  zh-TW.json       # Traditional Chinese
  es.json          # Spanish (stub — contributions welcome!)
  LANGUAGE_TEMPLATE.json  # Template for adding new languages

states.json        # Governors, senators, capitals for all 50 states + DC + territories
current_officials.json  # President, VP, Speaker of the House, Chief Justice
```

## Contributing a new language

1. Copy `questions/LANGUAGE_TEMPLATE.json` to `questions/[language-code].json`
2. Translate all `question` and `answers` fields
3. Keep `id`, `answerCount`, `seniorExemption`, `stateSpecific`, `officialField` unchanged
4. Open a pull request

## Keeping officials current

`current_officials.json` and `states.json` may become outdated after elections or appointments.
If you notice an error, please open a PR with the correction and update `lastUpdated`.

## License

Data is in the public domain (sourced from USCIS M-1778 09/25).
