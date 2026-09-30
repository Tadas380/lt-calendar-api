# 🇱🇹 LT Calendar API

A free, open JSON API for **Lithuanian name days (vardadieniai)** and **public holidays (šventinės dienos)**, plus a docs page with a live calendar.

As far as I could find, there was no open, machine-readable source of Lithuanian name days, so I built one.

**Live demo:** [(https://lt-calendar-api.onrender.com/)]

![CI](https://github.com/Tadas380/lt-calendar-api/actions/workflows/ci.yml/badge.svg)

## Features

- **Name days for every date** (~2,000 names), with search that ignores case and diacritics (`zygimantas` finds `Žygimantas`)
- **All 16 public holidays** from the Labour Code (Darbo kodeksas, Art. 123). Easter, Mother's Day and Father's Day are calculated, so any year 2020–2100 works
- **"Is this a day off?"** checks, including **shortened workdays**: the working day before a holiday is one hour shorter under the Labour Code
- **Working-day counter** for a date range (handy for invoices, deadlines and payroll)
- **Month calendar endpoint** for building calendar UIs
- Dates are calculated in **Europe/Vilnius** time, wherever the server runs
- **Zero runtime dependencies**: plain Node.js + TypeScript (runs `.ts` files natively on Node 22.18+)
- Security basics: per-IP rate limiting, strict input validation, security headers, CSP on the docs page

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/today` | Today's name days, holiday, day-off status |
| `GET /api/v1/days/:date` | The same for any `YYYY-MM-DD` |
| `GET /api/v1/namedays/today` | Today's name days |
| `GET /api/v1/namedays/:date` | Name days on `MM-DD` or `YYYY-MM-DD` |
| `GET /api/v1/namedays/name/:name` | All dates for a name and the next upcoming one |
| `GET /api/v1/namedays/search?q=gyt` | Prefix search (autocomplete) |
| `GET /api/v1/namedays?month=06` | All name days, optionally one month |
| `GET /api/v1/holidays/:year` | Public holidays in a year |
| `GET /api/v1/holidays/next` | Next holiday (`?from=YYYY-MM-DD`, `?includeSundayOnly=false`) |
| `GET /api/v1/working-days?from=&to=` | Number of working days in a range |
| `GET /api/v1/calendar/:year/:month` | Every day of a month with names and holidays |
| `GET /health` | Health check |

### Example

```bash
curl https://YOUR-URL/api/v1/days/2026-12-24
```

```json
{
  "date": "2026-12-24",
  "isDayOff": true,
  "reason": "holiday",
  "holiday": {
    "date": "2026-12-24",
    "id": "christmas-eve",
    "nameLt": "Kūčių diena",
    "nameEn": "Christmas Eve",
    "alwaysSunday": false
  },
  "isShortenedWorkday": false,
  "weekday": { "lt": "ketvirtadienis", "en": "Thursday" },
  "namedays": ["Adelė", "Adomas", "Girstautas", "Ieva", "Irma", "Irmina", "Minvydė"]
}
```

Errors always look like `{ "error": { "code": "bad_request", "message": "..." } }`.

## Run locally

Requires **Node.js 22.18 or newer**.

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + tests
```


## Project structure

```
data/namedays.txt        ← name-day source data (easy to edit)
scripts/build-data.ts    ← validates the text file and builds src/data/namedays.json
src/lib/holidays.ts      ← holiday rules, Easter algorithm, day-off logic
src/lib/namedays.ts      ← name lookup and diacritic-insensitive search
src/lib/rate-limit.ts    ← in-memory per-IP rate limiter
src/app.ts               ← HTTP routing, validation, headers
public/index.html        ← docs page and live calendar demo
test/                    ← node:test unit and API tests
```

## Fixing name-day data

Name-day lists differ slightly between Lithuanian sources. The data was compiled from
[joro.lt](https://joro.lt/vardadieniai) and [day.lt](https://day.lt/vardadieniai/Sausis).
If you spot a missing or wrong name:

1. Edit `data/namedays.txt`
2. Run `npm run build:data` (it validates the file)
3. Open a pull request

CI fails if `src/data/namedays.json` isn't rebuilt after editing the text file.

## License

Code: MIT. Holiday rules come from Lithuanian law; name-day data is compiled from public sources.
