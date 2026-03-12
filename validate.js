#!/usr/bin/env node

/**
 * Validates the structural integrity and cross-references of all data files.
 * Run: node validate.js
 */

const fs = require("fs");
const path = require("path");

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    error(`Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

// --- Expected values ---

const EXPECTED_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const TERRITORIES = ["DC", "PR", "GU", "VI", "AS", "MP"];

const VALID_CATEGORIES = [
  "Principles of American Government",
  "System of Government",
  "Rights and Responsibilities",
  "Colonial Period and Independence",
  "1800s",
  "Recent American History",
  "Symbols and Holidays",
];

const VALID_OFFICIAL_FIELDS = [
  "senators", "representative", "governor", "capital",
  "president", "vicePresident", "speakerOfHouse", "chiefJustice",
];

const FEDERAL_OFFICIAL_FIELDS = ["president", "vicePresident", "speakerOfHouse", "chiefJustice"];
const STATE_OFFICIAL_FIELDS = ["senators", "representative", "governor", "capital"];

// --- Validate states.json ---

function validateStates(states) {
  console.log("\n📍 states.json");

  if (!states) return;

  // Check for disclaimer
  if (!states._disclaimer) {
    warn("Missing _disclaimer field");
  }

  // Check all 50 states present
  const stateKeys = Object.keys(states).filter((k) => !k.startsWith("_"));
  const missingStates = EXPECTED_STATES.filter((s) => !stateKeys.includes(s));
  const missingTerritories = TERRITORIES.filter((t) => !stateKeys.includes(t));

  if (missingStates.length > 0) {
    error(`Missing states: ${missingStates.join(", ")}`);
  } else {
    ok(`All 50 states present`);
  }

  if (missingTerritories.length > 0) {
    warn(`Missing territories: ${missingTerritories.join(", ")}`);
  } else {
    ok(`All ${TERRITORIES.length} territories present`);
  }

  // Check unexpected keys
  const allExpected = [...EXPECTED_STATES, ...TERRITORIES, "_disclaimer"];
  const unexpected = Object.keys(states).filter((k) => !allExpected.includes(k));
  if (unexpected.length > 0) {
    warn(`Unexpected keys: ${unexpected.join(", ")}`);
  }

  // Validate each state
  const allSenators = [];
  for (const code of EXPECTED_STATES) {
    const state = states[code];
    if (!state) continue;

    if (!state.name || typeof state.name !== "string") {
      error(`${code}: missing or invalid 'name'`);
    }
    if (!state.governor || typeof state.governor !== "string") {
      error(`${code}: missing or invalid 'governor'`);
    }
    if (!state.capital || typeof state.capital !== "string") {
      error(`${code}: missing or invalid 'capital'`);
    }
    if (!Array.isArray(state.senators)) {
      error(`${code}: 'senators' is not an array`);
    } else if (state.senators.length !== 2) {
      error(`${code}: expected 2 senators, got ${state.senators.length}`);
    } else {
      for (const sen of state.senators) {
        if (!sen || typeof sen !== "string") {
          error(`${code}: invalid senator name: ${JSON.stringify(sen)}`);
        }
        if (allSenators.includes(sen)) {
          error(`Duplicate senator: "${sen}" appears in multiple states`);
        }
        allSenators.push(sen);
      }
    }
  }

  if (allSenators.length === 100) {
    ok(`100 senators total (2 per state)`);
  } else {
    error(`Expected 100 senators, found ${allSenators.length}`);
  }

  // Validate DC
  if (states.DC) {
    if (states.DC.governor !== null) warn("DC: governor should be null");
    if (!Array.isArray(states.DC.senators) || states.DC.senators.length !== 0) {
      warn("DC: senators should be empty array");
    }
  }

  // Validate territories
  for (const code of TERRITORIES.filter((t) => t !== "DC")) {
    const terr = states[code];
    if (!terr) continue;
    if (!terr.governor || typeof terr.governor !== "string") {
      warn(`${code}: missing or invalid 'governor'`);
    }
    if (!Array.isArray(terr.senators) || terr.senators.length !== 0) {
      warn(`${code}: territories should have empty senators array`);
    }
    if (!terr.capital || typeof terr.capital !== "string") {
      warn(`${code}: missing or invalid 'capital'`);
    }
  }

  ok("State structure checks complete");
}

// --- Validate current_officials.json ---

function validateOfficials(officials) {
  console.log("\n🏛️  current_officials.json");

  if (!officials) return;

  for (const field of FEDERAL_OFFICIAL_FIELDS) {
    if (!officials[field] || typeof officials[field] !== "string") {
      error(`Missing or invalid '${field}'`);
    } else {
      ok(`${field}: "${officials[field]}"`);
    }
  }

  if (!officials.lastUpdated) {
    warn("Missing 'lastUpdated'");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(officials.lastUpdated)) {
    warn(`'lastUpdated' is not YYYY-MM-DD format: "${officials.lastUpdated}"`);
  } else {
    ok(`lastUpdated: ${officials.lastUpdated}`);
  }
}

// --- Validate questions ---

function validateQuestions(questions, filename) {
  console.log(`\n📝 ${filename}`);

  if (!questions) return null;

  if (!questions.languageCode || typeof questions.languageCode !== "string") {
    error("Missing or invalid 'languageCode'");
  }
  if (!questions.languageName || typeof questions.languageName !== "string") {
    error("Missing or invalid 'languageName'");
  }

  // Handle stub files
  if (questions.status === "stub") {
    ok(`Stub file (${questions.languageName}) — skipping question checks`);
    return null;
  }

  const qs = questions.questions;
  if (!Array.isArray(qs)) {
    error("'questions' is not an array");
    return null;
  }

  if (qs.length !== 128) {
    error(`Expected 128 questions, got ${qs.length}`);
  } else {
    ok("128 questions present");
  }

  // Check sequential IDs
  const ids = qs.map((q) => q.id);
  const expectedIds = Array.from({ length: qs.length }, (_, i) => i + 1);
  const missingIds = expectedIds.filter((id) => !ids.includes(id));
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);

  if (missingIds.length > 0) {
    error(`Missing question IDs: ${missingIds.join(", ")}`);
  }
  if (duplicateIds.length > 0) {
    error(`Duplicate question IDs: ${duplicateIds.join(", ")}`);
  }
  if (missingIds.length === 0 && duplicateIds.length === 0) {
    ok("IDs are sequential 1–128");
  }

  let stateSpecificCount = 0;
  let seniorExemptionCount = 0;

  for (const q of qs) {
    const prefix = `Q${q.id}`;

    // Required fields
    if (typeof q.question !== "string" || q.question.length === 0) {
      error(`${prefix}: missing or empty 'question'`);
    }
    if (!Array.isArray(q.answers)) {
      error(`${prefix}: 'answers' is not an array`);
    } else if (q.answers.length === 0 && !q.officialField) {
      error(`${prefix}: question has no answers and no officialField`);
    }
    if (typeof q.answerCount !== "number" || q.answerCount < 1) {
      error(`${prefix}: invalid 'answerCount': ${q.answerCount}`);
    }
    if (typeof q.seniorExemption !== "boolean") {
      error(`${prefix}: 'seniorExemption' is not boolean`);
    }
    if (typeof q.stateSpecific !== "boolean") {
      error(`${prefix}: 'stateSpecific' is not boolean`);
    }

    // officialField
    if (q.officialField !== null) {
      if (!VALID_OFFICIAL_FIELDS.includes(q.officialField)) {
        error(`${prefix}: unknown officialField "${q.officialField}"`);
      }
    }

    // Category
    if (!q.category || typeof q.category !== "string") {
      error(`${prefix}: missing 'category'`);
    } else if (filename === "en.json" && !VALID_CATEGORIES.includes(q.category)) {
      error(`${prefix}: unknown category "${q.category}"`);
    }

    // stateSpecific should have officialField
    if (q.stateSpecific && !q.officialField) {
      warn(`${prefix}: stateSpecific=true but no officialField`);
    }
    if (q.stateSpecific && q.officialField && !STATE_OFFICIAL_FIELDS.includes(q.officialField)) {
      warn(`${prefix}: stateSpecific=true but officialField "${q.officialField}" is federal`);
    }

    // Federal officialField should not be stateSpecific
    if (!q.stateSpecific && q.officialField && FEDERAL_OFFICIAL_FIELDS.includes(q.officialField)) {
      // This is expected — good
    }
    if (!q.stateSpecific && q.officialField && STATE_OFFICIAL_FIELDS.includes(q.officialField)) {
      warn(`${prefix}: not stateSpecific but officialField "${q.officialField}" is state-level`);
    }

    if (q.stateSpecific) stateSpecificCount++;
    if (q.seniorExemption) seniorExemptionCount++;
  }

  ok(`${stateSpecificCount} state-specific questions`);
  ok(`${seniorExemptionCount} senior-exemption questions`);

  return qs;
}

// --- Validate translations match English ---

function validateTranslation(transQs, enQs, filename) {
  console.log(`\n🔗 Cross-check: ${filename} ↔ en.json`);

  if (!transQs || !enQs) {
    warn("Skipping cross-check (missing data)");
    return;
  }

  if (transQs.length !== enQs.length) {
    error(`Question count mismatch: ${transQs.length} vs ${enQs.length} (en)`);
  }

  let mismatches = 0;
  for (const enQ of enQs) {
    const transQ = transQs.find((q) => q.id === enQ.id);
    if (!transQ) {
      error(`Missing question ID ${enQ.id}`);
      continue;
    }

    // These fields should be identical across translations
    for (const field of ["answerCount", "seniorExemption", "stateSpecific", "officialField"]) {
      if (JSON.stringify(transQ[field]) !== JSON.stringify(enQ[field])) {
        error(`Q${enQ.id}: '${field}' mismatch — en=${JSON.stringify(enQ[field])}, translation=${JSON.stringify(transQ[field])}`);
        mismatches++;
      }
    }
  }

  if (mismatches === 0) {
    ok("All metadata fields match English version");
  }
}

// --- Main ---

console.log("🔍 Naturalization Data Validator\n" + "=".repeat(40));

const baseDir = __dirname;
const states = loadJSON(path.join(baseDir, "states.json"));
const officials = loadJSON(path.join(baseDir, "current_officials.json"));
const enQuestions = loadJSON(path.join(baseDir, "questions", "en.json"));

validateStates(states);
validateOfficials(officials);
const enQs = validateQuestions(enQuestions, "en.json");

// Validate all translation files
const questionsDir = path.join(baseDir, "questions");
const translationFiles = fs
  .readdirSync(questionsDir)
  .filter((f) => f.endsWith(".json") && f !== "en.json" && f !== "LANGUAGE_TEMPLATE.json");

for (const file of translationFiles) {
  const trans = loadJSON(path.join(questionsDir, file));
  const transQs = validateQuestions(trans, file);
  if (transQs && enQs) {
    validateTranslation(transQs, enQs, file);
  }
}

// --- Summary ---

console.log("\n" + "=".repeat(40));
if (errors === 0 && warnings === 0) {
  console.log("✅ All checks passed!");
} else {
  if (errors > 0) console.log(`❌ ${errors} error(s)`);
  if (warnings > 0) console.log(`⚠️  ${warnings} warning(s)`);
}

process.exit(errors > 0 ? 1 : 0);
