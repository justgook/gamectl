use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use wasmtime::component::types::Type;
use wasmtime::component::Val;

pub fn json_to_val(value: &Value, ty: &Type) -> Result<Val> {
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

        unsupported => bail!("JSON -> WIT conversion is not implemented for type {unsupported:?}"),
    })
}

pub fn result_json(results: Vec<Val>) -> Result<Value> {
    match results.len() {
        0 => Ok(Value::Null),
        1 => val_to_json(results.into_iter().next().unwrap()),
        _ => results
            .into_iter()
            .map(val_to_json)
            .collect::<Result<Vec<_>>>()
            .map(Value::Array),
    }
}

pub fn val_to_json(value: Val) -> Result<Value> {
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
        Val::List(v) => Value::Array(v.into_iter().map(val_to_json).collect::<Result<Vec<_>>>()?),
        Val::Record(fields) => {
            let mut object = serde_json::Map::new();
            for (name, value) in fields {
                object.insert(name, val_to_json(value)?);
            }
            Value::Object(object)
        }
        Val::Tuple(values) => Value::Array(
            values
                .into_iter()
                .map(val_to_json)
                .collect::<Result<Vec<_>>>()?,
        ),
        Val::Variant(name, payload) => json!({
            "case": name,
            "value": match payload { Some(value) => val_to_json(*value)?, None => Value::Null },
        }),
        Val::Option(value) => match value {
            Some(value) => val_to_json(*value)?,
            None => Value::Null,
        },
        Val::Result(value) => match value {
            Ok(Some(value)) => json!({ "ok": val_to_json(*value)? }),
            Ok(None) => json!({ "ok": null }),
            Err(Some(value)) => json!({ "err": val_to_json(*value)? }),
            Err(None) => json!({ "err": null }),
        },
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
