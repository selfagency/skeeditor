#!/usr/bin/env node
/**
 * Validates journey-parity.json for completeness and expired waivers.
 *
 * Exit codes:
 *   0 — all journeys have chrome coverage and any waivers are still valid
 *   1 — validation errors found
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('test/e2e/journey-parity.json');
const today = new Date().toISOString().slice(0, 10);

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`Failed to read ${manifestPath}: ${err.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

for (const journey of manifest.journeys) {
  const { id, title, chrome, firefox, waiver } = journey;

  // Every journey must have Chrome coverage.
  if (!chrome) {
    errors.push(`${id} (${title}): missing chrome coverage`);
  }

  // Firefox coverage must be present OR a valid non-expired waiver must exist.
  if (!firefox) {
    if (!waiver) {
      errors.push(`${id} (${title}): missing firefox coverage and no waiver`);
    } else if (waiver.expiresOn && waiver.expiresOn < today) {
      errors.push(`${id} (${title}): firefox waiver expired on ${waiver.expiresOn} — add coverage or renew waiver`);
    } else if (waiver.expiresOn) {
      const daysLeft = Math.round((new Date(waiver.expiresOn) - new Date(today)) / 86_400_000);
      if (daysLeft <= 14) {
        warnings.push(`${id} (${title}): firefox waiver expires in ${daysLeft} day(s) (${waiver.expiresOn})`);
      }
    }
  }
}

if (warnings.length > 0) {
  for (const w of warnings) {
    console.warn(`[warn] ${w}`);
  }
}

if (errors.length > 0) {
  for (const e of errors) {
    console.error(`[error] ${e}`);
  }
  process.exit(1);
}

console.log(`Parity check passed — ${manifest.journeys.length} journeys validated.`);
process.exit(0);
