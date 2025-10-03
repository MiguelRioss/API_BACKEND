import { createHttpError } from "../erros/erros.js";

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function toSafeString(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || typeof value === "undefined") return "";
  return String(value).trim();
}
export function ensureNonEmpty(value, message) {
  const str = toSafeString(value);
  if (!str) throw createHttpError(400, message);
  return str;
}
