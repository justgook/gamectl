use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use wasmtime::component::types::Type;
use wasmtime::component::{ResourceAny, Val};

#[allow(dead_code)]
pub fn json_to_val(value: &Value, ty: &Type) -> Result<Val> {
    json_to_val_with_resources(value, ty, None, &mut |_, _| {
        bail!("JSON -> WIT resource conversion requires runtime resource context")
    })
}

pub fn json_to_val_with_resources<F>(
    value: &Value,
    ty: &Type,
    resource_type_name: Option<&str>,
    resolve_resource: &mut F,
) -> Result<Val>
where
    F: FnMut(&str, &str) -> Result<ResourceAny>,
{
    Ok(match ty {
        Type::Bool => Val::Bool(value.as_bool().context("expected bool")?),

        Type::S8 => Val::S8(as_i64(value, "s8")?.try_into()?),
        Type::U8 => Val::U8(as_u64(value, "u8")?.try_into()?),
        Type::S16 => Val::S16(as_i64(value, "s16")?.try_into()?),
        Type::U16 => Val::U16(as_u64(value, "u16")?.try_into()?),
        Type::S32 => Val::S32(as_i64(value, "s32")?.try_into()?),
        Type::U32 => Val::U32(as_u64(value, "u32")?.try_into()?),
        Type::S64 => Val::S64(as_i64(value, "s64")?),
        Type::U64 => Val::U64(as_u64(value, "u64")?),

        Type::Float32 => Val::Float32(value.as_f64().context("expected float32")? as f32),
        Type::Float64 => Val::Float64(value.as_f64().context("expected float64")?),

        Type::Char => {
            let s = value.as_str().context("expected char string")?;
            let mut chars = s.chars();
            let ch = chars.next().context("expected one character")?;
            if chars.next().is_some() {
                bail!("expected one character, got `{s}`");
            }
            Val::Char(ch)
        }

        Type::String => Val::String(value.as_str().context("expected string")?.to_string()),

        Type::Enum(e) => {
            let name = value.as_str().context("expected enum case string")?;
            if !e.names().any(|candidate| candidate == name) {
                bail!("unknown enum case `{name}`");
            }
            Val::Enum(name.to_string())
        }

        Type::Flags(flags) => {
            let values = value.as_array().context("expected flags array")?;
            let allowed = flags.names().collect::<Vec<_>>();
            let mut out = Vec::new();
            for value in values {
                let name = value.as_str().context("expected flag name string")?;
                if !allowed.iter().any(|candidate| *candidate == name) {
                    bail!("unknown flag `{name}`");
                }
                if !out.iter().any(|existing| existing == name) {
                    out.push(name.to_string());
                }
            }
            Val::Flags(out)
        }

        Type::List(list) => {
            let values = value.as_array().context("expected list array")?;
            let ty = list.ty();
            Val::List(
                values
                    .iter()
                    .map(|value| {
                        json_to_val_with_resources(value, &ty, resource_type_name, resolve_resource)
                    })
                    .collect::<Result<Vec<_>>>()?,
            )
        }

        Type::Record(record) => {
            let object = value.as_object().context("expected record object")?;
            let mut fields = Vec::new();
            for field in record.fields() {
                let value = object
                    .get(field.name)
                    .with_context(|| format!("missing record field `{}`", field.name))?;
                fields.push((
                    field.name.to_string(),
                    json_to_val_with_resources(
                        value,
                        &field.ty,
                        resource_type_name,
                        resolve_resource,
                    )?,
                ));
            }
            Val::Record(fields)
        }

        Type::Tuple(tuple) => {
            let values = value.as_array().context("expected tuple array")?;
            let types = tuple.types().collect::<Vec<_>>();
            if values.len() != types.len() {
                bail!(
                    "expected tuple with {} values, got {}",
                    types.len(),
                    values.len()
                );
            }
            Val::Tuple(
                values
                    .iter()
                    .zip(types.iter())
                    .map(|(value, ty)| {
                        json_to_val_with_resources(value, ty, resource_type_name, resolve_resource)
                    })
                    .collect::<Result<Vec<_>>>()?,
            )
        }

        Type::Variant(variant) => {
            let object = value.as_object().context("expected variant object")?;
            let case = object
                .get("case")
                .and_then(|value| value.as_str())
                .context("variant object must contain string `case`")?;
            let mut found = None;
            for candidate in variant.cases() {
                if candidate.name == case {
                    found = Some(candidate.ty);
                    break;
                }
            }
            let ty = found.with_context(|| format!("unknown variant case `{case}`"))?;
            let payload = match ty {
                Some(ty) => {
                    let value = object
                        .get("value")
                        .with_context(|| format!("variant case `{case}` requires `value`"))?;
                    Some(Box::new(json_to_val_with_resources(
                        value,
                        &ty,
                        resource_type_name,
                        resolve_resource,
                    )?))
                }
                None => None,
            };
            Val::Variant(case.to_string(), payload)
        }

        Type::Option(option) => {
            if value.is_null() {
                Val::Option(None)
            } else {
                Val::Option(Some(Box::new(json_to_val_with_resources(
                    value,
                    &option.ty(),
                    resource_type_name,
                    resolve_resource,
                )?)))
            }
        }

        Type::Result(result) => {
            let object = value.as_object().context("expected result object")?;
            let has_ok = object.contains_key("ok");
            let has_err = object.contains_key("err");
            match (has_ok, has_err) {
                (true, false) => {
                    let payload = match result.ok() {
                        Some(ty) => Some(Box::new(json_to_val_with_resources(
                            &object["ok"],
                            &ty,
                            resource_type_name,
                            resolve_resource,
                        )?)),
                        None => None,
                    };
                    Val::Result(Ok(payload))
                }
                (false, true) => {
                    let payload = match result.err() {
                        Some(ty) => Some(Box::new(json_to_val_with_resources(
                            &object["err"],
                            &ty,
                            resource_type_name,
                            resolve_resource,
                        )?)),
                        None => None,
                    };
                    Val::Result(Err(payload))
                }
                (true, true) => bail!("result object must not contain both `ok` and `err`"),
                (false, false) => bail!("result object must contain `ok` or `err`"),
            }
        }

        Type::Own(_) | Type::Borrow(_) => {
            let object = value.as_object().context("expected resource object")?;
            let resource_type = object
                .get("$resource")
                .and_then(|value| value.as_str())
                .context("resource object must contain string `$resource`")?;
            if let Some(expected) = resource_type_name {
                if resource_type != expected {
                    bail!("expected resource type `{expected}`, got `{resource_type}`");
                }
            }
            let id = object
                .get("id")
                .and_then(|value| value.as_str())
                .context("resource object must contain string `id`")?;
            Val::Resource(resolve_resource(resource_type, id)?)
        }

        unsupported => bail!("JSON -> WIT conversion is not implemented for type {unsupported:?}"),
    })
}

#[allow(dead_code)]
pub fn result_json(results: Vec<Val>) -> Result<Value> {
    result_json_with_resources(results, None, &mut |_, _| {
        bail!("WIT resource -> JSON conversion requires runtime resource context")
    })
}

pub fn result_json_with_resources<F>(
    results: Vec<Val>,
    resource_type_name: Option<&str>,
    register_resource: &mut F,
) -> Result<Value>
where
    F: FnMut(ResourceAny, &str) -> Result<Value>,
{
    match results.len() {
        0 => Ok(Value::Null),
        1 => val_to_json_with_resources(
            results.into_iter().next().unwrap(),
            resource_type_name,
            register_resource,
        ),
        _ => results
            .into_iter()
            .map(|value| val_to_json_with_resources(value, resource_type_name, register_resource))
            .collect::<Result<Vec<_>>>()
            .map(Value::Array),
    }
}

#[allow(dead_code)]
pub fn val_to_json(value: Val) -> Result<Value> {
    val_to_json_with_resources(value, None, &mut |_, _| {
        bail!("WIT resource -> JSON conversion requires runtime resource context")
    })
}

pub fn val_to_json_with_resources<F>(
    value: Val,
    resource_type_name: Option<&str>,
    register_resource: &mut F,
) -> Result<Value>
where
    F: FnMut(ResourceAny, &str) -> Result<Value>,
{
    Ok(match value {
        Val::Bool(v) => Value::Bool(v),
        Val::S8(v) => json!(v),
        Val::U8(v) => json!(v),
        Val::S16(v) => json!(v),
        Val::U16(v) => json!(v),
        Val::S32(v) => json!(v),
        Val::U32(v) => json!(v),
        Val::S64(v) => json!(v),
        Val::U64(v) => json!(v),
        Val::Float32(v) => json!(v),
        Val::Float64(v) => json!(v),
        Val::Char(v) => Value::String(v.to_string()),
        Val::String(v) => Value::String(v),
        Val::Enum(v) => Value::String(v),
        Val::Flags(v) => Value::Array(v.into_iter().map(Value::String).collect()),
        Val::List(v) => Value::Array(
            v.into_iter()
                .map(|value| {
                    val_to_json_with_resources(value, resource_type_name, register_resource)
                })
                .collect::<Result<Vec<_>>>()?,
        ),
        Val::Record(fields) => {
            let mut object = serde_json::Map::new();
            for (name, value) in fields {
                object.insert(
                    name,
                    val_to_json_with_resources(value, resource_type_name, register_resource)?,
                );
            }
            Value::Object(object)
        }
        Val::Tuple(values) => Value::Array(
            values
                .into_iter()
                .map(|value| {
                    val_to_json_with_resources(value, resource_type_name, register_resource)
                })
                .collect::<Result<Vec<_>>>()?,
        ),
        Val::Variant(name, payload) => json!({
            "case": name,
            "value": match payload {
                Some(value) => val_to_json_with_resources(*value, resource_type_name, register_resource)?,
                None => Value::Null,
            },
        }),
        Val::Option(value) => match value {
            Some(value) => {
                val_to_json_with_resources(*value, resource_type_name, register_resource)?
            }
            None => Value::Null,
        },
        Val::Result(value) => match value {
            Ok(Some(value)) => json!({
                "ok": val_to_json_with_resources(*value, resource_type_name, register_resource)?
            }),
            Ok(None) => json!({ "ok": null }),
            Err(Some(value)) => json!({
                "err": val_to_json_with_resources(*value, resource_type_name, register_resource)?
            }),
            Err(None) => json!({ "err": null }),
        },
        Val::Resource(resource) => {
            let resource_type_name = resource_type_name
                .context("cannot serialize WIT resource without expected resource type name")?;
            register_resource(resource, resource_type_name)?
        }
        unsupported => bail!("WIT -> JSON conversion is not implemented for value {unsupported:?}"),
    })
}

pub fn val_default_for_type(ty: &Type) -> Result<Val> {
    Ok(match ty {
        Type::Bool => Val::Bool(false),

        Type::S8 => Val::S8(0),
        Type::U8 => Val::U8(0),
        Type::S16 => Val::S16(0),
        Type::U16 => Val::U16(0),
        Type::S32 => Val::S32(0),
        Type::U32 => Val::U32(0),
        Type::S64 => Val::S64(0),
        Type::U64 => Val::U64(0),

        Type::Float32 => Val::Float32(0.0),
        Type::Float64 => Val::Float64(0.0),

        Type::Char => Val::Char('\0'),
        Type::String => Val::String(String::new()),

        Type::Enum(e) => {
            let first = e.names().next().context("enum result has no cases")?;
            Val::Enum(first.to_string())
        }

        Type::Flags(_) => Val::Flags(Vec::new()),
        Type::List(_) => Val::List(Vec::new()),

        Type::Record(r) => Val::Record(
            r.fields()
                .map(|field| Ok((field.name.to_string(), val_default_for_type(&field.ty)?)))
                .collect::<Result<Vec<_>>>()?,
        ),

        Type::Tuple(t) => Val::Tuple(
            t.types()
                .map(|ty| val_default_for_type(&ty))
                .collect::<Result<Vec<_>>>()?,
        ),

        Type::Variant(v) => {
            let case = v.cases().next().context("variant result has no cases")?;
            let payload = match case.ty {
                Some(ty) => Some(Box::new(val_default_for_type(&ty)?)),
                None => None,
            };
            Val::Variant(case.name.to_string(), payload)
        }

        Type::Option(_) => Val::Option(None),
        Type::Result(_) => Val::Result(Ok(None)),

        unsupported => bail!("cannot allocate default result for type {unsupported:?}"),
    })
}

fn as_i64(value: &Value, expected: &str) -> Result<i64> {
    value
        .as_i64()
        .with_context(|| format!("expected {expected}"))
}

fn as_u64(value: &Value, expected: &str) -> Result<u64> {
    value
        .as_u64()
        .with_context(|| format!("expected {expected}"))
}
