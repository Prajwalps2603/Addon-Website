import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SCHEMA_FILE = fileURLToPath(new URL('./schema.sql', import.meta.url));
const STATEMENT_CACHE_SIZE = 400;

/** A Date (or anything Date accepts) as the timestamp format the schema uses: 2026-11-17T09:30:00Z. */
export function toIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('toIso() was given an invalid date');
  return `${date.toISOString().slice(0, 19)}Z`;
}

// node:sqlite on Node 24.13 rejects booleans, undefined and Dates, and binds every JS number
// as REAL (so 5 would land in a TEXT column as '5.0'). This turns each value into something
// SQLite stores the way the caller meant.
function bindable(value) {
  if (value === undefined || value === null) return null;
  switch (typeof value) {
    case 'string':
    case 'bigint':
      return value;
    case 'boolean':
      return value ? 1 : 0;
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`Cannot bind ${value} to a SQL statement`);
      return Number.isSafeInteger(value) ? BigInt(value) : value;
    case 'object':
      if (value instanceof Date) return toIso(value);
      if (ArrayBuffer.isView(value)) return value;
      return JSON.stringify(value);
    default:
      throw new TypeError(`Cannot bind a ${typeof value} to a SQL statement`);
  }
}

function isNamedParams(params) {
  return typeof params === 'object' && !(params instanceof Date) && !ArrayBuffer.isView(params);
}

function toArgs(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params.map(bindable);
  if (isNamedParams(params)) {
    const named = {};
    for (const [key, value] of Object.entries(params)) named[key] = bindable(value);
    return [named];
  }
  return [bindable(params)];
}

// Rows come back with a null prototype, which trips up deepStrictEqual and hasOwnProperty.
const plain = (row) => (row === undefined ? undefined : { ...row });

/**
 * Columns added to tables after the first release. schema.sql only says CREATE TABLE IF NOT EXISTS,
 * so a database made before a column existed never gets it from there: migrate() adds what is
 * missing with ALTER TABLE, keeping every row. Each definition must be valid for ADD COLUMN
 * (a NOT NULL column needs a constant default). Add new columns to schema.sql and to this list.
 */
export const ADDED_COLUMNS = Object.freeze([
  ['orders', 'fulfilment', "TEXT NOT NULL DEFAULT 'delivery' CHECK (fulfilment IN ('delivery','pickup','studio'))"],
  ['orders', 'studio_date', "TEXT NOT NULL DEFAULT ''"],
  ['orders', 'studio_slot', "TEXT NOT NULL DEFAULT ''"],
  ['orders', 'fitting_total', 'INTEGER NOT NULL DEFAULT 0'],
  ['order_items', 'fit_at_studio', 'INTEGER NOT NULL DEFAULT 0'],
  ['order_items', 'fitting_charge', 'INTEGER NOT NULL DEFAULT 0'],
  ['order_items', 'fitting_service', "TEXT NOT NULL DEFAULT ''"],
]);

// Indexes on added columns. They live here, not in schema.sql, because schema.sql runs before
// migrate() and would fail on an old table that does not have the column yet.
const ADDED_INDEXES = Object.freeze(['CREATE INDEX IF NOT EXISTS idx_orders_studio ON orders(fulfilment, studio_date, studio_slot)']);

/** Adds any column in ADDED_COLUMNS that a table lacks, then the indexes on them. Idempotent. Returns what was added. */
export function migrate(raw) {
  const added = [];
  const columnsOf = new Map();
  for (const [table, column, definition] of ADDED_COLUMNS) {
    if (!columnsOf.has(table)) {
      columnsOf.set(table, new Set(raw.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name)));
    }
    const columns = columnsOf.get(table);
    if (columns.has(column)) continue;
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    columns.add(column);
    added.push(`${table}.${column}`);
  }
  for (const sql of ADDED_INDEXES) raw.exec(sql);
  return added;
}

/**
 * Opens (and if needed creates) the store database and returns the wrapper used as ctx.db.
 * The schema file is idempotent and is applied on every open, then migrate() brings an older
 * database up to date. Pass ':memory:' for tests.
 */
export function openDb(file = ':memory:') {
  const inMemory = file === ':memory:';
  if (!inMemory) fs.mkdirSync(path.dirname(file), { recursive: true });

  const raw = new DatabaseSync(file, {
    timeout: 5000,
    enableForeignKeyConstraints: true,
    defensive: true,
  });
  if (!inMemory) raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const added = migrate(raw);
  if (added.length > 0 && !inMemory) console.log(`[db] Added columns: ${added.join(', ')}`);

  const statements = new Map();
  function prepare(sql) {
    let statement = statements.get(sql);
    if (statement) {
      statements.delete(sql);
    } else {
      statement = raw.prepare(sql);
      if (statements.size >= STATEMENT_CACHE_SIZE) statements.delete(statements.keys().next().value);
    }
    statements.set(sql, statement);
    return statement;
  }

  let savepoints = 0;

  const db = {
    /** First row as a plain object, or undefined. */
    get(sql, params) {
      return plain(prepare(sql).get(...toArgs(params)));
    },
    /** Every row as a plain object. */
    all(sql, params) {
      return prepare(sql).all(...toArgs(params)).map(plain);
    },
    /** For INSERT, UPDATE and DELETE. */
    run(sql, params) {
      const info = prepare(sql).run(...toArgs(params));
      return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
    },
    /** One or more statements without parameters (DDL, PRAGMA). */
    exec(sql) {
      raw.exec(sql);
    },
    /**
     * Runs fn inside a transaction and returns its result. Rolls back if fn throws.
     * Safe to nest: an inner call becomes a savepoint, so a failed inner block undoes only itself.
     * fn must be synchronous. An await inside would let other requests write into the open transaction.
     */
    tx(fn) {
      const nested = raw.isTransaction;
      const savepoint = nested ? `tx_${(savepoints += 1)}` : null;
      raw.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      try {
        const result = fn(db);
        if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
          throw new TypeError('ctx.db.tx(fn): fn must be synchronous. Do async work before or after the transaction.');
        }
        raw.exec(nested ? `RELEASE ${savepoint}` : 'COMMIT');
        return result;
      } catch (err) {
        if (raw.isTransaction) raw.exec(nested ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK');
        throw err;
      }
    },
    get inTransaction() {
      return raw.isTransaction;
    },
    close() {
      statements.clear();
      if (raw.isOpen) raw.close();
    },
    /** The underlying DatabaseSync, for the rare case the wrapper is not enough. */
    raw,
  };

  return db;
}
