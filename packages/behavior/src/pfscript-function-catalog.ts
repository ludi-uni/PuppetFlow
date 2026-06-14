import { PFSCRIPT_BUILTIN_FUNCTIONS } from "./builtin-functions.js";
import { BUILTIN_STATEFUL_FUNCTIONS } from "@puppetflow/stateful-core";

/** Stateless PFScript builtins resolved via `callBuiltinFunction`. */
export const PFSCRIPT_BUILTIN_FUNCTION_NAMES = Object.keys(
  PFSCRIPT_BUILTIN_FUNCTIONS,
).sort();

/** Stateful PFScript builtins resolved via `callStatefulFunction`. */
export const PFSCRIPT_STATEFUL_FUNCTION_NAMES = BUILTIN_STATEFUL_FUNCTIONS.map(
  (definition) => definition.name,
).sort();

/** Additional behavior-only callees (not in either registry table). */
export const PFSCRIPT_SPECIAL_FUNCTION_NAMES = ["eventActive"] as const;

export const PFSCRIPT_EXPRESSION_CALLEES = [
  ...PFSCRIPT_BUILTIN_FUNCTION_NAMES,
  ...PFSCRIPT_STATEFUL_FUNCTION_NAMES,
  ...PFSCRIPT_SPECIAL_FUNCTION_NAMES,
].sort();

export function isPfScriptBuiltinFunction(name: string): boolean {
  return name in PFSCRIPT_BUILTIN_FUNCTIONS;
}

export function isPfScriptStatefulFunction(name: string): boolean {
  return PFSCRIPT_STATEFUL_FUNCTION_NAMES.includes(name);
}
