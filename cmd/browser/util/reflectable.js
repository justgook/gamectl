export function Reflectable(Base = HTMLElement) {
  return class extends Base {
    // Subclasses should override this.
    // Example:
    // static get reflectProps() {
    //   return {
    //     foo: { attr: 'foo', boolean: false, onChange: (oldV, newV) => { … } },
    //     disabled: { attr: 'disabled', boolean: true }
    //   };
    // }
    static get reflectProps() {
      return {}
    }

    // Auto-derived: list of attributes to observe
    static get observedAttributes() {
      return Object.values(this.reflectProps).map(o => o.attr)
    }

    constructor() {
      super()
      _defineReflectProps.call(this)
    }

    attributeChangedCallback(attrName, oldValue, newValue) {
      const map = this.constructor.reflectProps
      for (const propName of Object.keys(map)) {
        const { attr, boolean = false } = map[propName]
        if (attr === attrName) {
          const val = boolean ? (newValue !== null) : newValue
          // Setting via property — will reflect back (but attribute already changed)
          this[propName] = val
          break
        }
      }
      if (super.attributeChangedCallback) {
        super.attributeChangedCallback(attrName, oldValue, newValue)
      }
    }

    connectedCallback() {
      // Upgrade any properties set before element was defined
      const map = this.constructor.reflectProps
      for (const propName of Object.keys(map)) {
        if (this.hasOwnProperty(propName)) {
          const value = this[propName]
          delete this[propName]
          this[propName] = value
        }
      }
      if (super.connectedCallback) {
        super.connectedCallback()
      }
    }
  }
}

function _defineReflectProps() {
  const map = this.constructor.reflectProps;
  for (const propName of Object.keys(map)) {
    const { attr, boolean = false, onChange } = map[propName];
    const internalKey = Symbol(propName);

    Object.defineProperty(this, propName, {
      get() {
        return this[internalKey];
      },
      set(newVal) {
        const oldVal = this[internalKey];
        this[internalKey] = newVal;

        // reflect to attribute
        if (boolean) {
          if (newVal) this.setAttribute(attr, "");
          else this.removeAttribute(attr);
        } else {
          if (newVal === null || newVal === undefined || newVal === false) {
            this.removeAttribute(attr);
          } else {
            this.setAttribute(attr, String(newVal));
          }
        }

        // trigger onChange callback if provided
        if (typeof onChange === "function" && oldVal !== newVal) {
          try {
            onChange.call(this, oldVal, newVal);
          } catch (err) {
            console.error(`Error in onChange callback for property "${propName}"`, err);
          }
        }
      },
      configurable: true,
      enumerable: false
    });
  }
}
