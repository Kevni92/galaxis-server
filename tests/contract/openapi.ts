import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { TSchema } from "@sinclair/typebox";
import { parse } from "yaml";

export type OpenApiObject = Readonly<Record<string, unknown>>;

export interface OpenApiDocument extends OpenApiObject {
  readonly components: OpenApiObject;
  readonly paths: OpenApiObject;
}

const contractRoot = new URL("../../docs/contracts/rest-api/", import.meta.url);
const defaultContractPath = fileURLToPath(new URL("galaxis-rest-v1.yaml", contractRoot));

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

function resolvedObject(document: OpenApiDocument, value: unknown): OpenApiObject | undefined {
  if (!isObject(value)) return undefined;
  const reference = value.$ref;
  return typeof reference === "string" ? resolvePointer(document, reference) : value;
}

export async function loadOpenApiDocument(path = defaultContractPath): Promise<OpenApiDocument> {
  const parsed: unknown = parse(await readFile(path, "utf8"));
  if (!isObject(parsed) || !isObject(parsed.paths) || !isObject(parsed.components)) {
    throw new Error(`${path}: OpenAPI contract must contain object-valued paths and components`);
  }
  return parsed as OpenApiDocument;
}

export function resolveSchema(document: OpenApiDocument, value: unknown): OpenApiObject {
  const schema = resolvedObject(document, value);
  if (schema === undefined) throw new Error("OpenAPI schema must be an object");
  return schema;
}

function resolveResponse(document: OpenApiDocument, value: unknown): OpenApiObject {
  const response = resolvedObject(document, value);
  if (response === undefined) throw new Error("OpenAPI response must be an object");
  return response;
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

function schemaType(value: OpenApiObject): string | readonly string[] | undefined {
  return typeof value.type === "string" || Array.isArray(value.type) ? value.type : undefined;
}

function acceptedType(schema: OpenApiObject, value: unknown): boolean {
  const type = schemaType(schema);
  if (Array.isArray(type)) return type.some((entry) => acceptedType({ type: entry }, value));
  if (type === undefined) return true;
  if (type === "object") return isObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  return true;
}

function schemaEnumContains(actual: OpenApiObject, expected: readonly unknown[]): boolean {
  if (Array.isArray(actual.enum)) {
    const actualEnum = actual.enum as readonly unknown[];
    return expected.every((entry) => actualEnum.includes(entry));
  }
  if ("const" in actual) return expected.length === 1 && Object.is(actual.const, expected[0]);
  if (Array.isArray(actual.anyOf) || Array.isArray(actual.oneOf)) {
    const alternatives = (actual.anyOf ?? actual.oneOf) as readonly unknown[];
    return expected.every((entry) =>
      alternatives.some(
        (alternative) => isObject(alternative) && schemaEnumContains(alternative, [entry]),
      ),
    );
  }
  return false;
}

function schemaAcceptsType(actual: OpenApiObject, expected: string): boolean {
  if (actual.type === expected) return true;
  const alternatives = actual.anyOf ?? actual.oneOf;
  return (
    Array.isArray(alternatives) &&
    alternatives.some(
      (alternative) => isObject(alternative) && schemaAcceptsType(alternative, expected),
    )
  );
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
  if (typeof expectedType === "string" && !schemaAcceptsType(actual, expectedType)) {
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
  if (
    typeof expected.additionalProperties === "boolean" &&
    actual.additionalProperties !== expected.additionalProperties
  ) {
    errors.push(
      `${path}: expected additionalProperties ${String(expected.additionalProperties)}, got ${String(actual.additionalProperties)}`,
    );
  }
  if (Array.isArray(expected.enum) && !schemaEnumContains(actual, expected.enum)) {
    errors.push(
      `${path}: TypeBox schema does not cover contract enum ${JSON.stringify(expected.enum)}`,
    );
  }

  if (expectedType === "object") {
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
  }

  if (expectedType === "array" && expected.items !== undefined && isObject(actual.items)) {
    errors.push(
      ...typeBoxSchemaErrors(document, expected.items, actual.items as TSchema, `${path}[]`),
    );
  }
  return errors;
}

function valueMatchesConstOrEnum(
  schema: OpenApiObject,
  value: unknown,
  errors: string[],
  path: string,
) {
  if ("const" in schema && !Object.is(schema.const, value)) {
    errors.push(`${path}: expected constant ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    errors.push(`${path}: value is not one of ${JSON.stringify(schema.enum)}`);
  }
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
  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.filter(
      (member) => valueSchemaErrors(document, member, value, path).length === 0,
    );
    if (matches.length === 0) errors.push(`${path}: expected at least one matching anyOf schema`);
    return errors;
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(
      (member) => valueSchemaErrors(document, member, value, path).length === 0,
    );
    if (matches.length !== 1) errors.push(`${path}: expected exactly one matching oneOf schema`);
    return errors;
  }

  valueMatchesConstOrEnum(schema, value, errors, path);
  if (!acceptedType(schema, value)) {
    errors.push(`${path}: expected ${JSON.stringify(schemaType(schema))}`);
    return errors;
  }

  const type = schemaType(schema);
  if (type === "object" && isObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const property of required) {
      if (typeof property === "string" && !(property in value)) {
        errors.push(`${path}.${property}: required property is missing`);
      }
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    const additional = schema.additionalProperties;
    for (const [property, propertyValue] of Object.entries(value)) {
      const propertySchema = properties[property];
      if (propertySchema !== undefined) {
        errors.push(
          ...valueSchemaErrors(document, propertySchema, propertyValue, `${path}.${property}`),
        );
      } else if (additional === false) {
        errors.push(`${path}.${property}: additional property is not allowed`);
      } else if (isObject(additional)) {
        errors.push(
          ...valueSchemaErrors(document, additional, propertyValue, `${path}.${property}`),
        );
      }
    }
    return errors;
  }
  if (type === "array" && Array.isArray(value)) {
    if (schema.items !== undefined) {
      value.forEach((entry, index) => {
        errors.push(...valueSchemaErrors(document, schema.items, entry, `${path}[${index}]`));
      });
    }
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path}: array is shorter than minItems ${schema.minItems}`);
    }
    return errors;
  }
  if (type === "string" && typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path}: string is shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
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
  }
  if ((type === "integer" || type === "number") && typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path}: number is below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path}: number is above maximum ${schema.maximum}`);
    }
  }
  return errors;
}

function pathTemplateParameters(path: string): readonly string[] {
  return [...path.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1] ?? "");
}

function operationEntries(document: OpenApiDocument): readonly {
  readonly path: string;
  readonly method: string;
  readonly operation: OpenApiObject;
  readonly pathItem: OpenApiObject;
}[] {
  const entries: Array<{
    path: string;
    method: string;
    operation: OpenApiObject;
    pathItem: OpenApiObject;
  }> = [];
  const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
  for (const [path] of Object.entries(document.paths)) {
    const pathItem = objectProperty(document.paths, path);
    if (pathItem === undefined) continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (methods.has(method) && isObject(rawOperation)) {
        entries.push({ path, method, operation: rawOperation, pathItem });
      }
    }
  }
  return entries;
}

export function openApiStructureErrors(
  document: OpenApiDocument,
  filePath: string,
): readonly string[] {
  const errors: string[] = [];
  if (document.openapi !== "3.1.0") errors.push(`${filePath}: openapi must be 3.1.0`);
  if (
    !isObject(document.info) ||
    typeof document.info.title !== "string" ||
    typeof document.info.version !== "string"
  ) {
    errors.push(`${filePath}: info.title and info.version are required strings`);
  }

  errors.push(...unresolvedReferences(document).map((error) => `${filePath}: ${error}`));
  const operationIds = new Map<string, string>();
  for (const [path] of Object.entries(document.paths)) {
    if (!path.startsWith("/")) errors.push(`${filePath}: path ${path} must start with '/'`);
    const pathItem = resolvedObject(document, document.paths[path]);
    if (pathItem === undefined) {
      errors.push(`${filePath}: path ${path} must be an object`);
      continue;
    }
    const templateNames = pathTemplateParameters(path);
    const parameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const entry of operationEntries({
      ...document,
      paths: { [path]: pathItem },
    } as OpenApiDocument)) {
      const operationParameters = Array.isArray(entry.operation.parameters)
        ? entry.operation.parameters
        : [];
      const allParameters = [...parameters, ...operationParameters]
        .map((parameter) => resolvedObject(document, parameter))
        .filter((parameter): parameter is OpenApiObject => parameter !== undefined);
      for (const parameterName of templateNames) {
        const parameter = allParameters.find(
          (candidate) => candidate.in === "path" && candidate.name === parameterName,
        );
        if (parameter === undefined || parameter.required !== true) {
          errors.push(
            `${filePath} ${entry.method.toUpperCase()} ${path}: incomplete path parameter {${parameterName}}`,
          );
        }
      }
      const operationId = entry.operation.operationId;
      if (typeof operationId !== "string" || operationId.length === 0) {
        errors.push(`${filePath} ${entry.method.toUpperCase()} ${path}: operationId is required`);
      } else {
        const previous = operationIds.get(operationId);
        if (previous !== undefined) {
          errors.push(
            `${filePath} ${entry.method.toUpperCase()} ${path}: duplicate operationId ${operationId}; already used by ${previous}`,
          );
        }
        operationIds.set(operationId, `${entry.method.toUpperCase()} ${path}`);
      }
      const responses = objectProperty(entry.operation, "responses");
      if (responses === undefined || Object.keys(responses).length === 0) {
        errors.push(`${filePath} ${entry.method.toUpperCase()} ${path}: responses are required`);
      } else {
        for (const status of Object.keys(responses)) {
          if (!/^(default|[1-5][0-9]{2})$/u.test(status)) {
            errors.push(
              `${filePath} ${entry.method.toUpperCase()} ${path} status ${status}: invalid response status`,
            );
          }
        }
      }
    }
  }
  return errors;
}

function exampleValue(document: OpenApiDocument, value: unknown): unknown {
  const example = resolvedObject(document, value);
  if (example === undefined) return undefined;
  return example.value;
}

function schemaExampleErrors(
  document: OpenApiDocument,
  schema: unknown,
  examples: unknown,
  context: string,
): readonly string[] {
  const errors: string[] = [];
  const exampleMap = isObject(examples) ? examples : {};
  for (const [name, rawExample] of Object.entries(exampleMap)) {
    const value = exampleValue(document, rawExample);
    if (value === undefined) {
      errors.push(`${context} example ${name}: value is missing`);
      continue;
    }
    errors.push(
      ...valueSchemaErrors(document, schema, value).map(
        (error) => `${context} example ${name}: ${error}`,
      ),
    );
  }
  return errors;
}

export function openApiExampleErrors(
  document: OpenApiDocument,
  filePath: string,
): readonly string[] {
  const errors: string[] = [];
  for (const { path, method, operation } of operationEntries(document)) {
    const requestBody = resolvedObject(document, operation.requestBody);
    const requestContent =
      requestBody === undefined ? undefined : objectProperty(requestBody, "content");
    const requestJson =
      requestContent === undefined ? undefined : objectProperty(requestContent, "application/json");
    if (requestJson !== undefined && requestJson.examples !== undefined) {
      errors.push(
        ...schemaExampleErrors(
          document,
          requestJson.schema,
          requestJson.examples,
          `${filePath} ${method.toUpperCase()} ${path} request`,
        ),
      );
    }

    const responses = objectProperty(operation, "responses") ?? {};
    for (const [status, rawResponse] of Object.entries(responses)) {
      const response = resolveResponse(document, rawResponse);
      const responseContent = objectProperty(response, "content");
      const json =
        responseContent === undefined
          ? undefined
          : objectProperty(responseContent, "application/json");
      if (json?.examples !== undefined) {
        errors.push(
          ...schemaExampleErrors(
            document,
            json.schema,
            json.examples,
            `${filePath} ${method.toUpperCase()} ${path} status ${status}`,
          ),
        );
      }
    }
  }
  return errors;
}
