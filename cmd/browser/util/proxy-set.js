export function proxySet(set, { onAdd, onRemove, onClean }) {
  return new Proxy(set, {
    get(target, prop) {
      if (prop === 'add') {
        return (value) => {
          if (!target.has(value)) onAdd?.(value)
          return target.add(value)
        }
      }

      if (prop === 'delete') {
        return (value) => {
          if (target.has(value)) onRemove?.(value)
          return target.delete(value);
        }
      }

      if (prop === 'clean') {
        return (value) => {
          onClean?.(value)
          return target.clean()
        }
      }

      return target[prop].bind?.(target) ?? target[prop]
    }
  });
}
