from typing import Any


def _resolve_ref(ref: str, components: dict) -> dict:
    """Resolve a $ref like '#/components/schemas/Foo' to its schema dict."""
    parts = ref.lstrip("#/").split("/")
    node = components
    for part in parts[1:]:  # skip 'components'
        node = node.get(part, {})
    return node


def _parse_schema_properties(schema: dict, components: dict) -> dict | None:
    """Return a simplified {properties, required} dict from a schema object."""
    if not schema:
        return None

    if "$ref" in schema:
        schema = _resolve_ref(schema["$ref"], {"schemas": components.get("schemas", {})})

    if schema.get("type") == "object" or "properties" in schema:
        props = {}
        for name, prop in schema.get("properties", {}).items():
            if "$ref" in prop:
                resolved = _resolve_ref(prop["$ref"], {"schemas": components.get("schemas", {})})
                props[name] = {"type": resolved.get("type", "object"), "properties": resolved.get("properties")}
            else:
                props[name] = {k: v for k, v in prop.items() if k != "title"}
        return {
            "type": "object",
            "properties": props,
            "required": schema.get("required", []),
        }
    return {"type": schema.get("type", "string")}


def parse_openapi(openapi_json: dict) -> dict:
    """Parse an OpenAPI JSON dict into a structured endpoint list."""
    info = openapi_json.get("info", {})
    servers = openapi_json.get("servers", [{}])
    base_url = servers[0].get("url", "") if servers else ""
    components = openapi_json.get("components", {})
    paths = openapi_json.get("paths", {})

    endpoints = []

    for path, path_item in paths.items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                continue

            parameters = operation.get("parameters", []) + path_item.get("parameters", [])
            path_params = []
            query_params = []

            for param in parameters:
                if "$ref" in param:
                    param = _resolve_ref(param["$ref"], {"parameters": components.get("parameters", {})})
                location = param.get("in")
                schema = param.get("schema", {})
                entry = {
                    "name": param.get("name"),
                    "type": schema.get("type", "string"),
                    "required": param.get("required", False),
                    "description": param.get("description", ""),
                }
                if location == "path":
                    path_params.append(entry)
                elif location == "query":
                    query_params.append(entry)

            request_body = None
            if "requestBody" in operation:
                rb = operation["requestBody"]
                content = rb.get("content", {})
                json_content = content.get("application/json", {})
                schema = json_content.get("schema", {})
                request_body = _parse_schema_properties(schema, components)

            responses = {}
            for status, resp in operation.get("responses", {}).items():
                desc = resp.get("description", "")
                responses[str(status)] = desc

            endpoints.append({
                "path": path,
                "method": method.upper(),
                "summary": operation.get("summary", ""),
                "description": operation.get("description", ""),
                "tag": (operation.get("tags") or ["default"])[0],
                "operation_id": operation.get("operationId", ""),
                "path_params": path_params,
                "query_params": query_params,
                "request_body": request_body,
                "responses": responses,
            })

    return {
        "title": info.get("title", ""),
        "version": info.get("version", ""),
        "base_url": base_url,
        "endpoints": endpoints,
    }
