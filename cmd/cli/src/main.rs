// Usage:
//
// cargo run -- \
//   --plug components/adder/adder.component.wasm \
//   --plug components/calculator/calculator.component.wasm \
//   --invoke 'docs:calculator/calculate::eval-expression(add, 2, 3)'

use anyhow::{bail, Result};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use wasmtime::{Config, Engine, Store, StoreContextMut};
use wasmtime::component::{
    Component, Func, Instance, Linker, Val,
    types::{ComponentItem, ComponentInstance},
};
use wasmtime::error::Context;
use wasmtime::component::types::Type;

#[derive(Debug, Clone)]
struct Args {
    plugs: Vec<PathBuf>,
    invoke: String,
}

#[derive(Clone)]
struct Loaded {
    id: usize,
    path: PathBuf,
    component: Component,
    imports: Vec<String>,
    exports: Vec<String>,
}

#[derive(Clone)]
struct ExportedFunc {
    func: Func,
}

fn main() -> Result<()> {
    let args = parse_args()?;

    let mut config = Config::new();
    config.wasm_component_model(true);

    let engine = Engine::new(&config)?;
    let mut store = Store::new(&engine, ());
    let mut linker = Linker::new(&engine);

    let loaded = load_components(&engine, &args.plugs)?;

    let order = topo_sort(&loaded)?;
    let mut instances: HashMap<usize, Instance> = HashMap::new();
    let mut exported_funcs: HashMap<String, ExportedFunc> = HashMap::new();

    for id in order {
        let item = &loaded[id];

        let instance = linker
            .instantiate(&mut store, &item.component)
            .with_context(|| format!("instantiating {}", item.path.display()))?;

        expose_instance_exports(
            &mut linker,
            &mut store,
            &instance,
            &item.component,
            &mut exported_funcs,
        )?;

        instances.insert(item.id, instance);
    }

    let invocation = parse_invocation(&args.invoke)?;
    let exported = resolve_exported_func(&exported_funcs, &invocation)?;

    let params = invocation
        .args
        .into_iter()
        .map(parse_simple_val)
        .collect::<Result<Vec<_>>>()?;

    let mut results = alloc_results(&store, &exported.func)?;

    exported.func.call(&mut store, &params, &mut results)?;

    println!("{results:?}");

    drop(instances);
    Ok(())
}

fn load_components(engine: &Engine, paths: &[PathBuf]) -> Result<Vec<Loaded>> {
    let mut out = Vec::new();

    for (id, path) in paths.iter().enumerate() {
        let component = Component::from_file(engine, path)
            .with_context(|| format!("loading {}", path.display()))?;

        let ty = component.component_type();
        let imports = ty
            .imports(engine)
            .filter_map(|(name, item): (&str, ComponentItem)| match item {
                ComponentItem::ComponentInstance(_) => Some(name.to_string()),
                ComponentItem::ComponentFunc(_) => Some(name.to_string()),
                _ => None,
            })
            .collect::<Vec<_>>();

        let exports = ty
            .exports(engine)
            .filter_map(|(name, item): (&str, ComponentItem)| match item {
                ComponentItem::ComponentInstance(_) => Some(name.to_string()),
                ComponentItem::ComponentFunc(_) => Some(name.to_string()),
                _ => None,
            })
            .collect::<Vec<_>>();

        out.push(Loaded {
            id,
            path: path.clone(),
            component,
            imports,
            exports,
        });
    }

    Ok(out)
}

fn topo_sort(items: &[Loaded]) -> Result<Vec<usize>> {
    let mut providers: HashMap<String, usize> = HashMap::new();

    for item in items {
        for export in &item.exports {
            if let Some(prev) = providers.insert(export.clone(), item.id) {
                bail!(
                    "multiple providers for `{}`: `{}` and `{}`",
                    export,
                    items[prev].path.display(),
                    item.path.display()
                );
            }
        }
    }

    let mut deps: HashMap<usize, HashSet<usize>> = HashMap::new();

    for item in items {
        let mut set = HashSet::new();

        for import in &item.imports {
            if let Some(provider) = providers.get(import) {
                if *provider != item.id {
                    set.insert(*provider);
                }
            } else {
                bail!(
                    "missing provider for import `{}` required by `{}`",
                    import,
                    item.path.display()
                );
            }
        }

        deps.insert(item.id, set);
    }

    let mut done = HashSet::new();
    let mut order = Vec::new();

    loop {
        let mut progressed = false;

        for item in items {
            if done.contains(&item.id) {
                continue;
            }

            let ready = deps[&item.id].iter().all(|d| done.contains(d));

            if ready {
                done.insert(item.id);
                order.push(item.id);
                progressed = true;
            }
        }

        if order.len() == items.len() {
            return Ok(order);
        }

        if !progressed {
            bail!("cycle in component imports/exports");
        }
    }
}

fn expose_instance_exports(
    linker: &mut Linker<()>,
    store: &mut Store<()>,
    instance: &Instance,
    component: &Component,
    registry: &mut HashMap<String, ExportedFunc>,
) -> Result<()> {
    let ty = component.component_type();

    for (name, item) in ty.exports(component.engine()) {
        match item {
            ComponentItem::ComponentInstance(iface_ty) => {
                expose_interface(
                    linker,
                    store,
                    instance,
                    component,
                    name,
                    iface_ty,
                    registry,
                )?;
            }

            ComponentItem::ComponentFunc(_) => {
                let idx = component
                    .get_export_index(None, name)
                    .with_context(|| format!("missing export index for `{name}`"))?;

                let func = instance
                    .get_func(&mut *store, &idx)
                    .with_context(|| format!("missing exported func `{name}`"))?;

                registry.insert(
                    name.to_string(),
                    ExportedFunc {
                        func,
                    },
                );
            }

            _ => {}
        }
    }

    Ok(())
}

fn expose_interface(
    linker: &mut Linker<()>,
    store: &mut Store<()>,
    instance: &Instance,
    component: &Component,
    interface_name: &str,
    iface_ty: ComponentInstance,
    registry: &mut HashMap<String, ExportedFunc>,
) -> Result<()> {
    let iface_index = component
        .get_export_index(None, interface_name)
        .with_context(|| format!("missing interface export index `{interface_name}`"))?;

    let mut linker_iface = linker.instance(interface_name)?;

    for (func_name, item) in iface_ty.exports(component.engine()) {
        let ComponentItem::ComponentFunc(_) = item else {
            continue;
        };

        let func_index = component
            .get_export_index(Some(&iface_index), func_name)
            .with_context(|| format!("missing func index `{interface_name}.{func_name}`"))?;

        let exported_func = instance
            .get_func(&mut *store, &func_index)
            .with_context(|| format!("missing exported func `{interface_name}.{func_name}`"))?;

        let forward = exported_func.clone();

        linker_iface.func_new(
            func_name,
            move |mut cx: StoreContextMut<'_, ()>, _callee, params, results| {
                forward.call(&mut cx, params, results)
            },
        )?;

        let full = format!("{interface_name}::{func_name}");

        registry.insert(
            full,
            ExportedFunc {
                func: exported_func,
            },
        );
    }

    Ok(())
}

#[derive(Debug)]
struct Invocation {
    interface: String,
    function: String,
    args: Vec<String>,
}

fn parse_invocation(s: &str) -> Result<Invocation> {
    let open = s.find('(').context("invoke must contain `(`")?;
    let close = s.rfind(')').context("invoke must contain `)`")?;

    let target = s[..open].trim();
    let args_raw = s[open + 1..close].trim();

    let (interface, function) = target
        .split_once("::")
        .context("invoke target must be `interface::function(...)`")?;

    if interface.is_empty() || function.is_empty() {
        bail!("invoke target must be `interface::function(...)`");
    }

    let args = if args_raw.is_empty() {
        Vec::new()
    } else {
        args_raw
            .split(',')
            .map(|x| x.trim().to_string())
            .collect()
    };

    Ok(Invocation {
        interface: interface.to_string(),
        function: function.to_string(),
        args,
    })
}

fn resolve_exported_func<'a>(
    exported_funcs: &'a HashMap<String, ExportedFunc>,
    invocation: &Invocation,
) -> Result<&'a ExportedFunc> {
    let exact_key = format!("{}::{}", invocation.interface, invocation.function);

    if let Some(exported) = exported_funcs.get(&exact_key) {
        return Ok(exported);
    }

    if invocation.interface.contains('@') {
        bail!("no exported function found for `{exact_key}`");
    }

    let mut matches = exported_funcs
        .iter()
        .filter(|(key, _)| invocation_key_matches_unversioned(key, invocation))
        .collect::<Vec<_>>();

    match matches.len() {
        0 => bail!("no exported function found for `{exact_key}`"),
        1 => Ok(matches.swap_remove(0).1),
        _ => {
            matches.sort_by(|(a, _), (b, _)| a.cmp(b));
            let options = matches
                .into_iter()
                .map(|(key, _)| format!("  {key}"))
                .collect::<Vec<_>>()
                .join("\n");

            bail!("ambiguous invocation `{exact_key}` matches:\n{options}");
        }
    }
}

fn invocation_key_matches_unversioned(key: &str, invocation: &Invocation) -> bool {
    let Some((interface, function)) = key.split_once("::") else {
        return false;
    };

    function == invocation.function && strip_interface_version(interface) == invocation.interface
}

fn strip_interface_version(interface: &str) -> &str {
    interface.rsplit_once('@').map_or(interface, |(base, _)| base)
}

fn parse_simple_val(s: String) -> Result<Val> {
    if let Ok(v) = s.parse::<u32>() {
        return Ok(Val::U32(v));
    }

    if let Ok(v) = s.parse::<i32>() {
        return Ok(Val::S32(v));
    }

    // For your example: enum case `add`.
    Ok(Val::Enum(s))
}

fn parse_args() -> Result<Args> {
    let mut plugs = Vec::new();
    let mut invoke = None;

    let mut it = std::env::args().skip(1);

    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--plug" => {
                let path = it.next().context("--plug requires a path")?;
                plugs.push(PathBuf::from(path));
            }

            "--invoke" => {
                invoke = Some(it.next().context("--invoke requires an expression")?);
            }

            other => bail!("unknown arg `{other}`"),
        }
    }

    if plugs.is_empty() {
        bail!("provide at least one --plug");
    }

    Ok(Args {
        plugs,
        invoke: invoke.context("missing --invoke")?,
    })
}

fn alloc_results(store: &Store<()>, func: &Func) -> Result<Vec<Val>> {
    let ty = func.ty(store);

    ty.results()
        .map(|ty| default_val_for_type(&ty))
        .collect()
}

fn default_val_for_type(ty: &Type) -> Result<Val> {
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
            let first = e
                .names()
                .next()
                .ok_or_else(|| anyhow::anyhow!("enum result has no cases"))?;

            Val::Enum(first.to_string())
        }

        Type::Flags(_) => Val::Flags(Vec::new()),

        Type::List(_) => Val::List(Vec::new()),

        Type::Record(r) => {
            let fields = r
                .fields()
                .map(|field| {
                    Ok((
                        field.name.to_string(),
                        default_val_for_type(&field.ty)?,
                    ))
                })
                .collect::<Result<Vec<_>>>()?;

            Val::Record(fields)
        }

        Type::Tuple(t) => {
            let fields = t
                .types()
                .map(|ty| default_val_for_type(&ty))
                .collect::<Result<Vec<_>>>()?;

            Val::Tuple(fields)
        }

        Type::Variant(v) => {
            let case = v
                .cases()
                .next()
                .ok_or_else(|| anyhow::anyhow!("variant result has no cases"))?;

            let payload = match case.ty {
                Some(ty) => Some(Box::new(default_val_for_type(&ty)?)),
                None => None,
            };

            Val::Variant(case.name.to_string(), payload)
        }

        Type::Option(_) => Val::Option(None),

        Type::Result(_) => Val::Result(Ok(None)),

        unsupported => {
            bail!("cannot allocate default result for unsupported type: {unsupported:?}");
        }
    })
}
