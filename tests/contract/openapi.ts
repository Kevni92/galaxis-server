import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { TSchema } from "@sinclair/typebox";
import { parse } from "yaml";

export type OpenApiObject = Readonly<Record<string, unknown>>;

export interface OpenApiDocument extends OpenApiObject {
  readonly components: OpenApiObject;
  readonly paths: OpenApiObject;
}

const contractPath = fileURLToPath(
  new URL("../../docs/contracts/rest-api/galaxis-rest-v1.yaml", import.meta.url),
);

function isObject(value: unknown): value is OpenApiObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectProperty(object: OpenApiObject, key: string): OpenApiObject | undefined {
  const value = object[key];
  return isObject(value) ? value : undefined;
}

function resolvePointer(document: OpenApiDocument, reference: string): OpenApiObject {
  if (!reference.startsWith("#/")) {
    throw new Error(`Unsupported OpenAPI reference: ${reference}`);
  }

  let value: unknown = document;
  for (const segment of reference.slice(2).split("/")) {
    if (!isObject(value)) throw new Error(`Unresolvable OpenAPI reference: ${reference}`);
    value = value[segment.replaceAll("~1", "/").replaceAll("~0", "~")];
  }

  if (!isObject(value)) throw new Error(`Unresolvable OpenAPI reference: ${reference}`);
  return value;
}

export async function loadOpenApiDocument(): Promise<OpenApiDocument> {
  const parsed: unknown = parse(await readFile(contractPath, "utf8"));
  if (!isObject(parsed) || !isObject(parsed.paths) || !isObject(parsed.components)) {
    throw new Error("OpenAPI contract must contain object-valued paths and components");
  }
  return parsed as OpenApiDocument;
}

export function resolveSchema(document: OpenApiDocument, value: unknown): OpenApiObject {
  if (!isObject(value)) throw new Error("OpenAPI schema must be an object");
  const reference = value.$ref;
  return typeof reference === "string" ? resolvePointer(document, reference) : value;
}

function resolveResponse(document: OpenApiDocument, value: unknown): OpenApiObject {
  if (!isObject(value)) throw new Error("OpenAPI response must be an object");
  const reference = value.$ref;
  return typeof reference === "string" ? resolvePointer(document, reference) : value;
}

function operation(document: OpenApiDocument, method: string, path: string): OpenApiObject {
  const pathItem = objectProperty(document.paths, path);
  const result = pathItem === undefined ? undefined : objectProperty(pathItem, method);
  if (result === undefined)
    throw new Error(`Missing OpenAPI operation: ${method.toUpperCase()} ${path}`);
  return result;
}

export function requestSchema(
  document: OpenApiDocument,
  method: string,
  path: string,
): OpenApiObject {
  const requestBody = objectProperty(operation(document, method, path), "requestBody");
  const content = requestBody === undefined ? undefined : objectProperty(requestBody, "content");
  const json = content === undefined ? undefined : objectProperty(content, "application/json");
  const schema = json === undefined ? undefined : json.schema;
  if (schema === undefined)
    throw new Error(`Missing JSON request schema: ${method.toUpperCase()} ${path}`);
  return resolveSchema(document, schema);
}

export function responseSchema(
  document: OpenApiDocument,
  method: string,
  path: string,
  status: number,
): OpenApiObject | undefined {
  const responses = objectProperty(operation(document, method, path), "responses");
  const response = responses === undefined ? undefined : responses[String(status)];
  if (response === undefined) return undefined;

  const resolved = resolveResponse(document, response);
  const content = objectProperty(resolved, "content");
  const json = content === undefined ? undefined : objectProperty(content, "application/json");
  return json === undefined ? undefined : resolveSchema(document, json.schema);
}

export function responseStatuses(
  document: OpenApiDocument,
  method: string,
  path: string,
): readonly string[] {
  const responses = objectProperty(operation(document, method, path), "responses");
  return responses === undefined ? [] : Object.keys(responses);
}

export function unresolvedReferences(
  document: OpenApiDocument,
  value: unknown = document,
  path = "$",
): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      unresolvedReferences(document, entry, `${path}[${index}]`),
    );
  }
  if (!isObject(value)) return [];

  const errors: string[] = [];
  if (typeof value.$ref === "string") {
    try {
      resolvePointer(document, value.$ref);
    } catch (error) {
      errors.push(`${path}: ${String(error)}`);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    errors.push(...unresolvedReferences(document, child, `${path}.${key}`));
  }
  return errors;
}

function typeName(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function schemaType(value: OpenApiObject): string | undefined {
  return typeName(value.type);
}

function typeBoxObject(schema: TSchema): OpenApiObject {
  if (!isObject(schema)) throw new Error("TypeBox schema must be an object");
  return schema;
}

export function typeBoxSchemaErrors(
  document: OpenApiDocument,
  contractSchema: unknown,
  routeSchema: TSchema,
  path = "$",
): readonly string[] {
  const expected = resolveSchema(document, contractSchema);
  const actual = typeBoxObject(routeSchema);
  const errors: string[] = [];

  const expectedType = schemaType(expected);
  if (expectedType !== undefined && actual.type !== expectedType) {
    errors.push(`${path}: expected TypeBox type ${expectedType}, got ${String(actual.type)}`);
  }
  if (
    typeof expected.format === "string" &&
    expected.format !== "int64" &&
    actual.format !== expected.format
  ) {
    errors.push(`${path}: expected format ${expected.format}, got ${String(actual.format)}`);
  }
  if (typeof expected.minLength === "number") {
    if (typeof actual.minLength !== "number" || actual.minLength < expected.minLength) {
      errors.push(`${path}: TypeBox minLength does not cover ${expected.minLength}`);
    }
  }
  if (typeof expected.minimum === "number") {
    if (typeof actual.minimum !== "number" || actual.minimum < expected.minimum) {
      errors.push(`${path}: TypeBox minimum does not cover ${expected.minimum}`);
    }
  }

  if (expectedType !== "object") return errors;

  const expectedProperties = isObject(expected.properties) ? expected.properties : {};
  const actualProperties = isObject(actual.properties) ? actual.properties : {};
  const expectedRequired = Array.isArray(expected.required) ? expected.required : [];
  const actualRequired = new Set(Array.isArray(actual.required) ? actual.required : []);

  for (const required of expectedRequired) {
    if (typeof required !== "string") continue;
    if (!(required in actualProperties)) {
      errors.push(`${path}.${required}: required contract property is missing from TypeBox`);
    } else if (!actualRequired.has(required)) {
      errors.push(`${path}.${required}: contract-required property is optional in TypeBox`);
    }
  }

  for (const [property, expectedProperty] of Object.entries(expectedProperties)) {
    const actualProperty = actualProperties[property];
    if (actualProperty === undefined || !isObject(actualProperty)) continue;
    errors.push(
      ...typeBoxSchemaErrors(
        document,
        expectedProperty,
        actualProperty as TSchema,
        `${path}.${property}`,
      ),
    );
  }

  return errors;
}

export function valueSchemaErrors(
  document: OpenApiDocument,
  schemaValue: unknown,
  value: unknown,
  path = "$",
): readonly string[] {
  const schema = resolveSchema(document, schemaValue);
  const errors: string[] = [];

  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf)
      errors.push(...valueSchemaErrors(document, member, value, path));
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(
      (member) => valueSchemaErrors(document, member, value, path).length === 0,
    );
    if (matches.length !== 1) errors.push(`${path}: expected exactly one matching oneOf schema`);
    return errors;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    errors.push(`${path}: value is not one of ${JSON.stringify(schema.enum)}`);
  }

  const type = schemaType(schema);
  if (type === "object") {
    if (!isObject(value)) {
      errors.push(`${path}: expected object`);
      return errors;
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const property of required) {
      if (typeof property === "string" && !(property in value)) {
        errors.push(`${path}.${property}: required property is missing`);
      }
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [property, propertySchema] of Object.entries(properties)) {
      if (property in value) {
        errors.push(
          ...valueSchemaErrors(document, propertySchema, value[property], `${path}.${property}`),
        );
      }
    }
    return errors;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return errors;
    }
    if (schema.items !== undefined) {
      value.forEach((entry, index) => {
        errors.push(...valueSchemaErrors(document, schema.items, entry, `${path}[${index}]`));
      });
    }
    return errors;
  }

  if (type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path}: expected string`);
      return errors;
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path}: string is shorter than minLength ${schema.minLength}`);
    }
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+$/u.test(value)) {
      errors.push(`${path}: invalid email format`);
    }
    if (
      schema.format === "date-time" &&
      (Number.isNaN(Date.parse(value)) || !value.includes("T"))
    ) {
      errors.push(`${path}: invalid date-time format`);
    }
    return errors;
  }

  if (type === "integer" && (!Number.isInteger(value) || typeof value !== "number")) {
    errors.push(`${path}: expected integer`);
  } else if (type === "number" && (typeof value !== "number" || Number.isNaN(value))) {
    errors.push(`${path}: expected number`);
  } else if (type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path}: expected boolean`);
  }
  if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
    errors.push(`${path}: number is below minimum ${schema.minimum}`);
  }

  return errors;
}
