/* esm.sh - esbuild bundle(ajv@8.17.1) es2022 production */
var Ia = Object.create
var ar = Object.defineProperty
var Ra = Object.getOwnPropertyDescriptor
var Ta = Object.getOwnPropertyNames
var Ca = Object.getPrototypeOf,
  Ma = Object.prototype.hasOwnProperty
var _ = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports),
  Aa = (t, e) => {
    for (var r in e) ar(t, r, { get: e[r], enumerable: !0 })
  },
  or = (t, e, r, s) => {
    if ((e && typeof e == "object") || typeof e == "function")
      for (let n of Ta(e))
        !Ma.call(t, n) &&
          n !== r &&
          ar(t, n, {
            get: () => e[n],
            enumerable: !(s = Ra(e, n)) || s.enumerable,
          })
    return t
  },
  be = (t, e, r) => (or(t, e, "default"), r && or(r, e, "default")),
  Js = (t, e, r) => (
    (r = t != null ? Ia(Ca(t)) : {}),
    or(
      e || !t || !t.__esModule
        ? ar(r, "default", { value: t, enumerable: !0 })
        : r,
      t,
    )
  )
var Xe = _((O) => {
  "use strict"
  Object.defineProperty(O, "__esModule", { value: !0 })
  O.regexpCode =
    O.getEsmExportName =
    O.getProperty =
    O.safeStringify =
    O.stringify =
    O.strConcat =
    O.addCodeArg =
    O.str =
    O._ =
    O.nil =
    O._Code =
    O.Name =
    O.IDENTIFIER =
    O._CodeOrName =
      void 0
  var We = class {}
  O._CodeOrName = We
  O.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i
  var Ee = class extends We {
    constructor(e) {
      if ((super(), !O.IDENTIFIER.test(e)))
        throw new Error("CodeGen: name must be a valid identifier")
      this.str = e
    }
    toString() {
      return this.str
    }
    emptyStr() {
      return !1
    }
    get names() {
      return { [this.str]: 1 }
    }
  }
  O.Name = Ee
  var Q = class extends We {
    constructor(e) {
      super(), (this._items = typeof e == "string" ? [e] : e)
    }
    toString() {
      return this.str
    }
    emptyStr() {
      if (this._items.length > 1) return !1
      let e = this._items[0]
      return e === "" || e === '""'
    }
    get str() {
      var e
      return (e = this._str) !== null && e !== void 0
        ? e
        : (this._str = this._items.reduce((r, s) => `${r}${s}`, ""))
    }
    get names() {
      var e
      return (e = this._names) !== null && e !== void 0
        ? e
        : (this._names = this._items.reduce(
            (r, s) => (s instanceof Ee && (r[s.str] = (r[s.str] || 0) + 1), r),
            {},
          ))
    }
  }
  O._Code = Q
  O.nil = new Q("")
  function Ws(t, ...e) {
    let r = [t[0]],
      s = 0
    for (; s < e.length; ) cr(r, e[s]), r.push(t[++s])
    return new Q(r)
  }
  O._ = Ws
  var ir = new Q("+")
  function Qs(t, ...e) {
    let r = [Qe(t[0])],
      s = 0
    for (; s < e.length; ) r.push(ir), cr(r, e[s]), r.push(ir, Qe(t[++s]))
    return Da(r), new Q(r)
  }
  O.str = Qs
  function cr(t, e) {
    e instanceof Q
      ? t.push(...e._items)
      : e instanceof Ee
        ? t.push(e)
        : t.push(Ua(e))
  }
  O.addCodeArg = cr
  function Da(t) {
    let e = 1
    for (; e < t.length - 1; ) {
      if (t[e] === ir) {
        let r = Va(t[e - 1], t[e + 1])
        if (r !== void 0) {
          t.splice(e - 1, 3, r)
          continue
        }
        t[e++] = "+"
      }
      e++
    }
  }
  function Va(t, e) {
    if (e === '""') return t
    if (t === '""') return e
    if (typeof t == "string")
      return e instanceof Ee || t[t.length - 1] !== '"'
        ? void 0
        : typeof e != "string"
          ? `${t.slice(0, -1)}${e}"`
          : e[0] === '"'
            ? t.slice(0, -1) + e.slice(1)
            : void 0
    if (typeof e == "string" && e[0] === '"' && !(t instanceof Ee))
      return `"${t}${e.slice(1)}`
  }
  function za(t, e) {
    return e.emptyStr() ? t : t.emptyStr() ? e : Qs`${t}${e}`
  }
  O.strConcat = za
  function Ua(t) {
    return typeof t == "number" || typeof t == "boolean" || t === null
      ? t
      : Qe(Array.isArray(t) ? t.join(",") : t)
  }
  function Ka(t) {
    return new Q(Qe(t))
  }
  O.stringify = Ka
  function Qe(t) {
    return JSON.stringify(t)
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
  }
  O.safeStringify = Qe
  function Fa(t) {
    return typeof t == "string" && O.IDENTIFIER.test(t)
      ? new Q(`.${t}`)
      : Ws`[${t}]`
  }
  O.getProperty = Fa
  function La(t) {
    if (typeof t == "string" && O.IDENTIFIER.test(t)) return new Q(`${t}`)
    throw new Error(
      `CodeGen: invalid export name: ${t}, use explicit $id name mapping`,
    )
  }
  O.getEsmExportName = La
  function xa(t) {
    return new Q(t.toString())
  }
  O.regexpCode = xa
})
var dr = _((G) => {
  "use strict"
  Object.defineProperty(G, "__esModule", { value: !0 })
  G.ValueScope =
    G.ValueScopeName =
    G.Scope =
    G.varKinds =
    G.UsedValueState =
      void 0
  var H = Xe(),
    ur = class extends Error {
      constructor(e) {
        super(`CodeGen: "code" for ${e} not defined`), (this.value = e.value)
      }
    },
    bt
  ;(function (t) {
    ;(t[(t.Started = 0)] = "Started"), (t[(t.Completed = 1)] = "Completed")
  })(bt || (G.UsedValueState = bt = {}))
  G.varKinds = {
    const: new H.Name("const"),
    let: new H.Name("let"),
    var: new H.Name("var"),
  }
  var Et = class {
    constructor({ prefixes: e, parent: r } = {}) {
      ;(this._names = {}), (this._prefixes = e), (this._parent = r)
    }
    toName(e) {
      return e instanceof H.Name ? e : this.name(e)
    }
    name(e) {
      return new H.Name(this._newName(e))
    }
    _newName(e) {
      let r = this._names[e] || this._nameGroup(e)
      return `${e}${r.index++}`
    }
    _nameGroup(e) {
      var r, s
      if (
        (!(
          (s =
            (r = this._parent) === null || r === void 0
              ? void 0
              : r._prefixes) === null || s === void 0
        ) &&
          s.has(e)) ||
        (this._prefixes && !this._prefixes.has(e))
      )
        throw new Error(`CodeGen: prefix "${e}" is not allowed in this scope`)
      return (this._names[e] = { prefix: e, index: 0 })
    }
  }
  G.Scope = Et
  var Pt = class extends H.Name {
    constructor(e, r) {
      super(r), (this.prefix = e)
    }
    setValue(e, { property: r, itemIndex: s }) {
      ;(this.value = e), (this.scopePath = (0, H._)`.${new H.Name(r)}[${s}]`)
    }
  }
  G.ValueScopeName = Pt
  var Ha = (0, H._)`\n`,
    lr = class extends Et {
      constructor(e) {
        super(e),
          (this._values = {}),
          (this._scope = e.scope),
          (this.opts = { ...e, _n: e.lines ? Ha : H.nil })
      }
      get() {
        return this._scope
      }
      name(e) {
        return new Pt(e, this._newName(e))
      }
      value(e, r) {
        var s
        if (r.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value")
        let n = this.toName(e),
          { prefix: o } = n,
          a = (s = r.key) !== null && s !== void 0 ? s : r.ref,
          i = this._values[o]
        if (i) {
          let u = i.get(a)
          if (u) return u
        } else i = this._values[o] = new Map()
        i.set(a, n)
        let c = this._scope[o] || (this._scope[o] = []),
          l = c.length
        return (c[l] = r.ref), n.setValue(r, { property: o, itemIndex: l }), n
      }
      getValue(e, r) {
        let s = this._values[e]
        if (s) return s.get(r)
      }
      scopeRefs(e, r = this._values) {
        return this._reduceValues(r, (s) => {
          if (s.scopePath === void 0)
            throw new Error(`CodeGen: name "${s}" has no value`)
          return (0, H._)`${e}${s.scopePath}`
        })
      }
      scopeCode(e = this._values, r, s) {
        return this._reduceValues(
          e,
          (n) => {
            if (n.value === void 0)
              throw new Error(`CodeGen: name "${n}" has no value`)
            return n.value.code
          },
          r,
          s,
        )
      }
      _reduceValues(e, r, s = {}, n) {
        let o = H.nil
        for (let a in e) {
          let i = e[a]
          if (!i) continue
          let c = (s[a] = s[a] || new Map())
          i.forEach((l) => {
            if (c.has(l)) return
            c.set(l, bt.Started)
            let u = r(l)
            if (u) {
              let d = this.opts.es5 ? G.varKinds.var : G.varKinds.const
              o = (0, H._)`${o}${d} ${l} = ${u};${this.opts._n}`
            } else if ((u = n?.(l))) o = (0, H._)`${o}${u}${this.opts._n}`
            else throw new ur(l)
            c.set(l, bt.Completed)
          })
        }
        return o
      }
    }
  G.ValueScope = lr
})
var P = _((E) => {
  "use strict"
  Object.defineProperty(E, "__esModule", { value: !0 })
  E.or =
    E.and =
    E.not =
    E.CodeGen =
    E.operators =
    E.varKinds =
    E.ValueScopeName =
    E.ValueScope =
    E.Scope =
    E.Name =
    E.regexpCode =
    E.stringify =
    E.getProperty =
    E.nil =
    E.strConcat =
    E.str =
    E._ =
      void 0
  var q = Xe(),
    Z = dr(),
    pe = Xe()
  Object.defineProperty(E, "_", {
    enumerable: !0,
    get: function () {
      return pe._
    },
  })
  Object.defineProperty(E, "str", {
    enumerable: !0,
    get: function () {
      return pe.str
    },
  })
  Object.defineProperty(E, "strConcat", {
    enumerable: !0,
    get: function () {
      return pe.strConcat
    },
  })
  Object.defineProperty(E, "nil", {
    enumerable: !0,
    get: function () {
      return pe.nil
    },
  })
  Object.defineProperty(E, "getProperty", {
    enumerable: !0,
    get: function () {
      return pe.getProperty
    },
  })
  Object.defineProperty(E, "stringify", {
    enumerable: !0,
    get: function () {
      return pe.stringify
    },
  })
  Object.defineProperty(E, "regexpCode", {
    enumerable: !0,
    get: function () {
      return pe.regexpCode
    },
  })
  Object.defineProperty(E, "Name", {
    enumerable: !0,
    get: function () {
      return pe.Name
    },
  })
  var kt = dr()
  Object.defineProperty(E, "Scope", {
    enumerable: !0,
    get: function () {
      return kt.Scope
    },
  })
  Object.defineProperty(E, "ValueScope", {
    enumerable: !0,
    get: function () {
      return kt.ValueScope
    },
  })
  Object.defineProperty(E, "ValueScopeName", {
    enumerable: !0,
    get: function () {
      return kt.ValueScopeName
    },
  })
  Object.defineProperty(E, "varKinds", {
    enumerable: !0,
    get: function () {
      return kt.varKinds
    },
  })
  E.operators = {
    GT: new q._Code(">"),
    GTE: new q._Code(">="),
    LT: new q._Code("<"),
    LTE: new q._Code("<="),
    EQ: new q._Code("==="),
    NEQ: new q._Code("!=="),
    NOT: new q._Code("!"),
    OR: new q._Code("||"),
    AND: new q._Code("&&"),
    ADD: new q._Code("+"),
  }
  var ue = class {
      optimizeNodes() {
        return this
      }
      optimizeNames(e, r) {
        return this
      }
    },
    fr = class extends ue {
      constructor(e, r, s) {
        super(), (this.varKind = e), (this.name = r), (this.rhs = s)
      }
      render({ es5: e, _n: r }) {
        let s = e ? Z.varKinds.var : this.varKind,
          n = this.rhs === void 0 ? "" : ` = ${this.rhs}`
        return `${s} ${this.name}${n};` + r
      }
      optimizeNames(e, r) {
        if (e[this.name.str])
          return this.rhs && (this.rhs = Ce(this.rhs, e, r)), this
      }
      get names() {
        return this.rhs instanceof q._CodeOrName ? this.rhs.names : {}
      }
    },
    St = class extends ue {
      constructor(e, r, s) {
        super(), (this.lhs = e), (this.rhs = r), (this.sideEffects = s)
      }
      render({ _n: e }) {
        return `${this.lhs} = ${this.rhs};` + e
      }
      optimizeNames(e, r) {
        if (
          !(this.lhs instanceof q.Name && !e[this.lhs.str] && !this.sideEffects)
        )
          return (this.rhs = Ce(this.rhs, e, r)), this
      }
      get names() {
        let e = this.lhs instanceof q.Name ? {} : { ...this.lhs.names }
        return qt(e, this.rhs)
      }
    },
    hr = class extends St {
      constructor(e, r, s, n) {
        super(e, s, n), (this.op = r)
      }
      render({ _n: e }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + e
      }
    },
    pr = class extends ue {
      constructor(e) {
        super(), (this.label = e), (this.names = {})
      }
      render({ _n: e }) {
        return `${this.label}:` + e
      }
    },
    mr = class extends ue {
      constructor(e) {
        super(), (this.label = e), (this.names = {})
      }
      render({ _n: e }) {
        return `break${this.label ? ` ${this.label}` : ""};` + e
      }
    },
    yr = class extends ue {
      constructor(e) {
        super(), (this.error = e)
      }
      render({ _n: e }) {
        return `throw ${this.error};` + e
      }
      get names() {
        return this.error.names
      }
    },
    _r = class extends ue {
      constructor(e) {
        super(), (this.code = e)
      }
      render({ _n: e }) {
        return `${this.code};` + e
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0
      }
      optimizeNames(e, r) {
        return (this.code = Ce(this.code, e, r)), this
      }
      get names() {
        return this.code instanceof q._CodeOrName ? this.code.names : {}
      }
    },
    Be = class extends ue {
      constructor(e = []) {
        super(), (this.nodes = e)
      }
      render(e) {
        return this.nodes.reduce((r, s) => r + s.render(e), "")
      }
      optimizeNodes() {
        let { nodes: e } = this,
          r = e.length
        for (; r--; ) {
          let s = e[r].optimizeNodes()
          Array.isArray(s)
            ? e.splice(r, 1, ...s)
            : s
              ? (e[r] = s)
              : e.splice(r, 1)
        }
        return e.length > 0 ? this : void 0
      }
      optimizeNames(e, r) {
        let { nodes: s } = this,
          n = s.length
        for (; n--; ) {
          let o = s[n]
          o.optimizeNames(e, r) || (Ga(e, o.names), s.splice(n, 1))
        }
        return s.length > 0 ? this : void 0
      }
      get names() {
        return this.nodes.reduce((e, r) => Ne(e, r.names), {})
      }
    },
    le = class extends Be {
      render(e) {
        return "{" + e._n + super.render(e) + "}" + e._n
      }
    },
    gr = class extends Be {},
    Te = class extends le {}
  Te.kind = "else"
  var Pe = class t extends le {
    constructor(e, r) {
      super(r), (this.condition = e)
    }
    render(e) {
      let r = `if(${this.condition})` + super.render(e)
      return this.else && (r += "else " + this.else.render(e)), r
    }
    optimizeNodes() {
      super.optimizeNodes()
      let e = this.condition
      if (e === !0) return this.nodes
      let r = this.else
      if (r) {
        let s = r.optimizeNodes()
        r = this.else = Array.isArray(s) ? new Te(s) : s
      }
      if (r)
        return e === !1
          ? r instanceof t
            ? r
            : r.nodes
          : this.nodes.length
            ? this
            : new t(Xs(e), r instanceof t ? [r] : r.nodes)
      if (!(e === !1 || !this.nodes.length)) return this
    }
    optimizeNames(e, r) {
      var s
      if (
        ((this.else =
          (s = this.else) === null || s === void 0
            ? void 0
            : s.optimizeNames(e, r)),
        !!(super.optimizeNames(e, r) || this.else))
      )
        return (this.condition = Ce(this.condition, e, r)), this
    }
    get names() {
      let e = super.names
      return qt(e, this.condition), this.else && Ne(e, this.else.names), e
    }
  }
  Pe.kind = "if"
  var Se = class extends le {}
  Se.kind = "for"
  var $r = class extends Se {
      constructor(e) {
        super(), (this.iteration = e)
      }
      render(e) {
        return `for(${this.iteration})` + super.render(e)
      }
      optimizeNames(e, r) {
        if (super.optimizeNames(e, r))
          return (this.iteration = Ce(this.iteration, e, r)), this
      }
      get names() {
        return Ne(super.names, this.iteration.names)
      }
    },
    vr = class extends Se {
      constructor(e, r, s, n) {
        super(),
          (this.varKind = e),
          (this.name = r),
          (this.from = s),
          (this.to = n)
      }
      render(e) {
        let r = e.es5 ? Z.varKinds.var : this.varKind,
          { name: s, from: n, to: o } = this
        return `for(${r} ${s}=${n}; ${s}<${o}; ${s}++)` + super.render(e)
      }
      get names() {
        let e = qt(super.names, this.from)
        return qt(e, this.to)
      }
    },
    Nt = class extends Se {
      constructor(e, r, s, n) {
        super(),
          (this.loop = e),
          (this.varKind = r),
          (this.name = s),
          (this.iterable = n)
      }
      render(e) {
        return (
          `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` +
          super.render(e)
        )
      }
      optimizeNames(e, r) {
        if (super.optimizeNames(e, r))
          return (this.iterable = Ce(this.iterable, e, r)), this
      }
      get names() {
        return Ne(super.names, this.iterable.names)
      }
    },
    Ye = class extends le {
      constructor(e, r, s) {
        super(), (this.name = e), (this.args = r), (this.async = s)
      }
      render(e) {
        return (
          `${this.async ? "async " : ""}function ${this.name}(${this.args})` +
          super.render(e)
        )
      }
    }
  Ye.kind = "func"
  var Ze = class extends Be {
    render(e) {
      return "return " + super.render(e)
    }
  }
  Ze.kind = "return"
  var wr = class extends le {
      render(e) {
        let r = "try" + super.render(e)
        return (
          this.catch && (r += this.catch.render(e)),
          this.finally && (r += this.finally.render(e)),
          r
        )
      }
      optimizeNodes() {
        var e, r
        return (
          super.optimizeNodes(),
          (e = this.catch) === null || e === void 0 || e.optimizeNodes(),
          (r = this.finally) === null || r === void 0 || r.optimizeNodes(),
          this
        )
      }
      optimizeNames(e, r) {
        var s, n
        return (
          super.optimizeNames(e, r),
          (s = this.catch) === null || s === void 0 || s.optimizeNames(e, r),
          (n = this.finally) === null || n === void 0 || n.optimizeNames(e, r),
          this
        )
      }
      get names() {
        let e = super.names
        return (
          this.catch && Ne(e, this.catch.names),
          this.finally && Ne(e, this.finally.names),
          e
        )
      }
    },
    et = class extends le {
      constructor(e) {
        super(), (this.error = e)
      }
      render(e) {
        return `catch(${this.error})` + super.render(e)
      }
    }
  et.kind = "catch"
  var tt = class extends le {
    render(e) {
      return "finally" + super.render(e)
    }
  }
  tt.kind = "finally"
  var br = class {
    constructor(e, r = {}) {
      ;(this._values = {}),
        (this._blockStarts = []),
        (this._constants = {}),
        (this.opts = {
          ...r,
          _n: r.lines
            ? `
`
            : "",
        }),
        (this._extScope = e),
        (this._scope = new Z.Scope({ parent: e })),
        (this._nodes = [new gr()])
    }
    toString() {
      return this._root.render(this.opts)
    }
    name(e) {
      return this._scope.name(e)
    }
    scopeName(e) {
      return this._extScope.name(e)
    }
    scopeValue(e, r) {
      let s = this._extScope.value(e, r)
      return (
        (this._values[s.prefix] || (this._values[s.prefix] = new Set())).add(s),
        s
      )
    }
    getScopeValue(e, r) {
      return this._extScope.getValue(e, r)
    }
    scopeRefs(e) {
      return this._extScope.scopeRefs(e, this._values)
    }
    scopeCode() {
      return this._extScope.scopeCode(this._values)
    }
    _def(e, r, s, n) {
      let o = this._scope.toName(r)
      return (
        s !== void 0 && n && (this._constants[o.str] = s),
        this._leafNode(new fr(e, o, s)),
        o
      )
    }
    const(e, r, s) {
      return this._def(Z.varKinds.const, e, r, s)
    }
    let(e, r, s) {
      return this._def(Z.varKinds.let, e, r, s)
    }
    var(e, r, s) {
      return this._def(Z.varKinds.var, e, r, s)
    }
    assign(e, r, s) {
      return this._leafNode(new St(e, r, s))
    }
    add(e, r) {
      return this._leafNode(new hr(e, E.operators.ADD, r))
    }
    code(e) {
      return (
        typeof e == "function" ? e() : e !== q.nil && this._leafNode(new _r(e)),
        this
      )
    }
    object(...e) {
      let r = ["{"]
      for (let [s, n] of e)
        r.length > 1 && r.push(","),
          r.push(s),
          (s !== n || this.opts.es5) && (r.push(":"), (0, q.addCodeArg)(r, n))
      return r.push("}"), new q._Code(r)
    }
    if(e, r, s) {
      if ((this._blockNode(new Pe(e)), r && s))
        this.code(r).else().code(s).endIf()
      else if (r) this.code(r).endIf()
      else if (s) throw new Error('CodeGen: "else" body without "then" body')
      return this
    }
    elseIf(e) {
      return this._elseNode(new Pe(e))
    }
    else() {
      return this._elseNode(new Te())
    }
    endIf() {
      return this._endBlockNode(Pe, Te)
    }
    _for(e, r) {
      return this._blockNode(e), r && this.code(r).endFor(), this
    }
    for(e, r) {
      return this._for(new $r(e), r)
    }
    forRange(e, r, s, n, o = this.opts.es5 ? Z.varKinds.var : Z.varKinds.let) {
      let a = this._scope.toName(e)
      return this._for(new vr(o, a, r, s), () => n(a))
    }
    forOf(e, r, s, n = Z.varKinds.const) {
      let o = this._scope.toName(e)
      if (this.opts.es5) {
        let a = r instanceof q.Name ? r : this.var("_arr", r)
        return this.forRange("_i", 0, (0, q._)`${a}.length`, (i) => {
          this.var(o, (0, q._)`${a}[${i}]`), s(o)
        })
      }
      return this._for(new Nt("of", n, o, r), () => s(o))
    }
    forIn(e, r, s, n = this.opts.es5 ? Z.varKinds.var : Z.varKinds.const) {
      if (this.opts.ownProperties)
        return this.forOf(e, (0, q._)`Object.keys(${r})`, s)
      let o = this._scope.toName(e)
      return this._for(new Nt("in", n, o, r), () => s(o))
    }
    endFor() {
      return this._endBlockNode(Se)
    }
    label(e) {
      return this._leafNode(new pr(e))
    }
    break(e) {
      return this._leafNode(new mr(e))
    }
    return(e) {
      let r = new Ze()
      if ((this._blockNode(r), this.code(e), r.nodes.length !== 1))
        throw new Error('CodeGen: "return" should have one node')
      return this._endBlockNode(Ze)
    }
    try(e, r, s) {
      if (!r && !s)
        throw new Error('CodeGen: "try" without "catch" and "finally"')
      let n = new wr()
      if ((this._blockNode(n), this.code(e), r)) {
        let o = this.name("e")
        ;(this._currNode = n.catch = new et(o)), r(o)
      }
      return (
        s && ((this._currNode = n.finally = new tt()), this.code(s)),
        this._endBlockNode(et, tt)
      )
    }
    throw(e) {
      return this._leafNode(new yr(e))
    }
    block(e, r) {
      return (
        this._blockStarts.push(this._nodes.length),
        e && this.code(e).endBlock(r),
        this
      )
    }
    endBlock(e) {
      let r = this._blockStarts.pop()
      if (r === void 0) throw new Error("CodeGen: not in self-balancing block")
      let s = this._nodes.length - r
      if (s < 0 || (e !== void 0 && s !== e))
        throw new Error(`CodeGen: wrong number of nodes: ${s} vs ${e} expected`)
      return (this._nodes.length = r), this
    }
    func(e, r = q.nil, s, n) {
      return this._blockNode(new Ye(e, r, s)), n && this.code(n).endFunc(), this
    }
    endFunc() {
      return this._endBlockNode(Ye)
    }
    optimize(e = 1) {
      for (; e-- > 0; )
        this._root.optimizeNodes(),
          this._root.optimizeNames(this._root.names, this._constants)
    }
    _leafNode(e) {
      return this._currNode.nodes.push(e), this
    }
    _blockNode(e) {
      this._currNode.nodes.push(e), this._nodes.push(e)
    }
    _endBlockNode(e, r) {
      let s = this._currNode
      if (s instanceof e || (r && s instanceof r))
        return this._nodes.pop(), this
      throw new Error(
        `CodeGen: not in block "${r ? `${e.kind}/${r.kind}` : e.kind}"`,
      )
    }
    _elseNode(e) {
      let r = this._currNode
      if (!(r instanceof Pe)) throw new Error('CodeGen: "else" without "if"')
      return (this._currNode = r.else = e), this
    }
    get _root() {
      return this._nodes[0]
    }
    get _currNode() {
      let e = this._nodes
      return e[e.length - 1]
    }
    set _currNode(e) {
      let r = this._nodes
      r[r.length - 1] = e
    }
  }
  E.CodeGen = br
  function Ne(t, e) {
    for (let r in e) t[r] = (t[r] || 0) + (e[r] || 0)
    return t
  }
  function qt(t, e) {
    return e instanceof q._CodeOrName ? Ne(t, e.names) : t
  }
  function Ce(t, e, r) {
    if (t instanceof q.Name) return s(t)
    if (!n(t)) return t
    return new q._Code(
      t._items.reduce(
        (o, a) => (
          a instanceof q.Name && (a = s(a)),
          a instanceof q._Code ? o.push(...a._items) : o.push(a),
          o
        ),
        [],
      ),
    )
    function s(o) {
      let a = r[o.str]
      return a === void 0 || e[o.str] !== 1 ? o : (delete e[o.str], a)
    }
    function n(o) {
      return (
        o instanceof q._Code &&
        o._items.some(
          (a) => a instanceof q.Name && e[a.str] === 1 && r[a.str] !== void 0,
        )
      )
    }
  }
  function Ga(t, e) {
    for (let r in e) t[r] = (t[r] || 0) - (e[r] || 0)
  }
  function Xs(t) {
    return typeof t == "boolean" || typeof t == "number" || t === null
      ? !t
      : (0, q._)`!${Er(t)}`
  }
  E.not = Xs
  var Ja = Bs(E.operators.AND)
  function Wa(...t) {
    return t.reduce(Ja)
  }
  E.and = Wa
  var Qa = Bs(E.operators.OR)
  function Xa(...t) {
    return t.reduce(Qa)
  }
  E.or = Xa
  function Bs(t) {
    return (e, r) =>
      e === q.nil ? r : r === q.nil ? e : (0, q._)`${Er(e)} ${t} ${Er(r)}`
  }
  function Er(t) {
    return t instanceof q.Name ? t : (0, q._)`(${t})`
  }
})
var I = _((S) => {
  "use strict"
  Object.defineProperty(S, "__esModule", { value: !0 })
  S.checkStrictMode =
    S.getErrorPath =
    S.Type =
    S.useFunc =
    S.setEvaluated =
    S.evaluatedPropsToName =
    S.mergeEvaluated =
    S.eachItem =
    S.unescapeJsonPointer =
    S.escapeJsonPointer =
    S.escapeFragment =
    S.unescapeFragment =
    S.schemaRefOrVal =
    S.schemaHasRulesButRef =
    S.schemaHasRules =
    S.checkUnknownRules =
    S.alwaysValidSchema =
    S.toHash =
      void 0
  var T = P(),
    Ba = Xe()
  function Ya(t) {
    let e = {}
    for (let r of t) e[r] = !0
    return e
  }
  S.toHash = Ya
  function Za(t, e) {
    return typeof e == "boolean"
      ? e
      : Object.keys(e).length === 0
        ? !0
        : (en(t, e), !tn(e, t.self.RULES.all))
  }
  S.alwaysValidSchema = Za
  function en(t, e = t.schema) {
    let { opts: r, self: s } = t
    if (!r.strictSchema || typeof e == "boolean") return
    let n = s.RULES.keywords
    for (let o in e) n[o] || nn(t, `unknown keyword: "${o}"`)
  }
  S.checkUnknownRules = en
  function tn(t, e) {
    if (typeof t == "boolean") return !t
    for (let r in t) if (e[r]) return !0
    return !1
  }
  S.schemaHasRules = tn
  function ei(t, e) {
    if (typeof t == "boolean") return !t
    for (let r in t) if (r !== "$ref" && e.all[r]) return !0
    return !1
  }
  S.schemaHasRulesButRef = ei
  function ti({ topSchemaRef: t, schemaPath: e }, r, s, n) {
    if (!n) {
      if (typeof r == "number" || typeof r == "boolean") return r
      if (typeof r == "string") return (0, T._)`${r}`
    }
    return (0, T._)`${t}${e}${(0, T.getProperty)(s)}`
  }
  S.schemaRefOrVal = ti
  function ri(t) {
    return rn(decodeURIComponent(t))
  }
  S.unescapeFragment = ri
  function si(t) {
    return encodeURIComponent(Sr(t))
  }
  S.escapeFragment = si
  function Sr(t) {
    return typeof t == "number"
      ? `${t}`
      : t.replace(/~/g, "~0").replace(/\//g, "~1")
  }
  S.escapeJsonPointer = Sr
  function rn(t) {
    return t.replace(/~1/g, "/").replace(/~0/g, "~")
  }
  S.unescapeJsonPointer = rn
  function ni(t, e) {
    if (Array.isArray(t)) for (let r of t) e(r)
    else e(t)
  }
  S.eachItem = ni
  function Ys({
    mergeNames: t,
    mergeToName: e,
    mergeValues: r,
    resultToName: s,
  }) {
    return (n, o, a, i) => {
      let c =
        a === void 0
          ? o
          : a instanceof T.Name
            ? (o instanceof T.Name ? t(n, o, a) : e(n, o, a), a)
            : o instanceof T.Name
              ? (e(n, a, o), o)
              : r(o, a)
      return i === T.Name && !(c instanceof T.Name) ? s(n, c) : c
    }
  }
  S.mergeEvaluated = {
    props: Ys({
      mergeNames: (t, e, r) =>
        t.if((0, T._)`${r} !== true && ${e} !== undefined`, () => {
          t.if(
            (0, T._)`${e} === true`,
            () => t.assign(r, !0),
            () =>
              t
                .assign(r, (0, T._)`${r} || {}`)
                .code((0, T._)`Object.assign(${r}, ${e})`),
          )
        }),
      mergeToName: (t, e, r) =>
        t.if((0, T._)`${r} !== true`, () => {
          e === !0
            ? t.assign(r, !0)
            : (t.assign(r, (0, T._)`${r} || {}`), Nr(t, r, e))
        }),
      mergeValues: (t, e) => (t === !0 ? !0 : { ...t, ...e }),
      resultToName: sn,
    }),
    items: Ys({
      mergeNames: (t, e, r) =>
        t.if((0, T._)`${r} !== true && ${e} !== undefined`, () =>
          t.assign(
            r,
            (0, T._)`${e} === true ? true : ${r} > ${e} ? ${r} : ${e}`,
          ),
        ),
      mergeToName: (t, e, r) =>
        t.if((0, T._)`${r} !== true`, () =>
          t.assign(r, e === !0 ? !0 : (0, T._)`${r} > ${e} ? ${r} : ${e}`),
        ),
      mergeValues: (t, e) => (t === !0 ? !0 : Math.max(t, e)),
      resultToName: (t, e) => t.var("items", e),
    }),
  }
  function sn(t, e) {
    if (e === !0) return t.var("props", !0)
    let r = t.var("props", (0, T._)`{}`)
    return e !== void 0 && Nr(t, r, e), r
  }
  S.evaluatedPropsToName = sn
  function Nr(t, e, r) {
    Object.keys(r).forEach((s) =>
      t.assign((0, T._)`${e}${(0, T.getProperty)(s)}`, !0),
    )
  }
  S.setEvaluated = Nr
  var Zs = {}
  function oi(t, e) {
    return t.scopeValue("func", {
      ref: e,
      code: Zs[e.code] || (Zs[e.code] = new Ba._Code(e.code)),
    })
  }
  S.useFunc = oi
  var Pr
  ;(function (t) {
    ;(t[(t.Num = 0)] = "Num"), (t[(t.Str = 1)] = "Str")
  })(Pr || (S.Type = Pr = {}))
  function ai(t, e, r) {
    if (t instanceof T.Name) {
      let s = e === Pr.Num
      return r
        ? s
          ? (0, T._)`"[" + ${t} + "]"`
          : (0, T._)`"['" + ${t} + "']"`
        : s
          ? (0, T._)`"/" + ${t}`
          : (0, T._)`"/" + ${t}.replace(/~/g, "~0").replace(/\\//g, "~1")`
    }
    return r ? (0, T.getProperty)(t).toString() : "/" + Sr(t)
  }
  S.getErrorPath = ai
  function nn(t, e, r = t.opts.strictSchema) {
    if (r) {
      if (((e = `strict mode: ${e}`), r === !0)) throw new Error(e)
      t.self.logger.warn(e)
    }
  }
  S.checkStrictMode = nn
})
var de = _((qr) => {
  "use strict"
  Object.defineProperty(qr, "__esModule", { value: !0 })
  var U = P(),
    ii = {
      data: new U.Name("data"),
      valCxt: new U.Name("valCxt"),
      instancePath: new U.Name("instancePath"),
      parentData: new U.Name("parentData"),
      parentDataProperty: new U.Name("parentDataProperty"),
      rootData: new U.Name("rootData"),
      dynamicAnchors: new U.Name("dynamicAnchors"),
      vErrors: new U.Name("vErrors"),
      errors: new U.Name("errors"),
      this: new U.Name("this"),
      self: new U.Name("self"),
      scope: new U.Name("scope"),
      json: new U.Name("json"),
      jsonPos: new U.Name("jsonPos"),
      jsonLen: new U.Name("jsonLen"),
      jsonPart: new U.Name("jsonPart"),
    }
  qr.default = ii
})
var rt = _((K) => {
  "use strict"
  Object.defineProperty(K, "__esModule", { value: !0 })
  K.extendErrors =
    K.resetErrorsCount =
    K.reportExtraError =
    K.reportError =
    K.keyword$DataError =
    K.keywordError =
      void 0
  var j = P(),
    jt = I(),
    L = de()
  K.keywordError = {
    message: ({ keyword: t }) =>
      (0, j.str)`must pass "${t}" keyword validation`,
  }
  K.keyword$DataError = {
    message: ({ keyword: t, schemaType: e }) =>
      e
        ? (0, j.str)`"${t}" keyword must be ${e} ($data)`
        : (0, j.str)`"${t}" keyword is invalid ($data)`,
  }
  function ci(t, e = K.keywordError, r, s) {
    let { it: n } = t,
      { gen: o, compositeRule: a, allErrors: i } = n,
      c = cn(t, e, r)
    ;(s ?? (a || i)) ? on(o, c) : an(n, (0, j._)`[${c}]`)
  }
  K.reportError = ci
  function ui(t, e = K.keywordError, r) {
    let { it: s } = t,
      { gen: n, compositeRule: o, allErrors: a } = s,
      i = cn(t, e, r)
    on(n, i), o || a || an(s, L.default.vErrors)
  }
  K.reportExtraError = ui
  function li(t, e) {
    t.assign(L.default.errors, e),
      t.if((0, j._)`${L.default.vErrors} !== null`, () =>
        t.if(
          e,
          () => t.assign((0, j._)`${L.default.vErrors}.length`, e),
          () => t.assign(L.default.vErrors, null),
        ),
      )
  }
  K.resetErrorsCount = li
  function di({
    gen: t,
    keyword: e,
    schemaValue: r,
    data: s,
    errsCount: n,
    it: o,
  }) {
    if (n === void 0) throw new Error("ajv implementation error")
    let a = t.name("err")
    t.forRange("i", n, L.default.errors, (i) => {
      t.const(a, (0, j._)`${L.default.vErrors}[${i}]`),
        t.if((0, j._)`${a}.instancePath === undefined`, () =>
          t.assign(
            (0, j._)`${a}.instancePath`,
            (0, j.strConcat)(L.default.instancePath, o.errorPath),
          ),
        ),
        t.assign(
          (0, j._)`${a}.schemaPath`,
          (0, j.str)`${o.errSchemaPath}/${e}`,
        ),
        o.opts.verbose &&
          (t.assign((0, j._)`${a}.schema`, r), t.assign((0, j._)`${a}.data`, s))
    })
  }
  K.extendErrors = di
  function on(t, e) {
    let r = t.const("err", e)
    t.if(
      (0, j._)`${L.default.vErrors} === null`,
      () => t.assign(L.default.vErrors, (0, j._)`[${r}]`),
      (0, j._)`${L.default.vErrors}.push(${r})`,
    ),
      t.code((0, j._)`${L.default.errors}++`)
  }
  function an(t, e) {
    let { gen: r, validateName: s, schemaEnv: n } = t
    n.$async
      ? r.throw((0, j._)`new ${t.ValidationError}(${e})`)
      : (r.assign((0, j._)`${s}.errors`, e), r.return(!1))
  }
  var qe = {
    keyword: new j.Name("keyword"),
    schemaPath: new j.Name("schemaPath"),
    params: new j.Name("params"),
    propertyName: new j.Name("propertyName"),
    message: new j.Name("message"),
    schema: new j.Name("schema"),
    parentSchema: new j.Name("parentSchema"),
  }
  function cn(t, e, r) {
    let { createErrors: s } = t.it
    return s === !1 ? (0, j._)`{}` : fi(t, e, r)
  }
  function fi(t, e, r = {}) {
    let { gen: s, it: n } = t,
      o = [hi(n, r), pi(t, r)]
    return mi(t, e, o), s.object(...o)
  }
  function hi({ errorPath: t }, { instancePath: e }) {
    let r = e ? (0, j.str)`${t}${(0, jt.getErrorPath)(e, jt.Type.Str)}` : t
    return [L.default.instancePath, (0, j.strConcat)(L.default.instancePath, r)]
  }
  function pi(
    { keyword: t, it: { errSchemaPath: e } },
    { schemaPath: r, parentSchema: s },
  ) {
    let n = s ? e : (0, j.str)`${e}/${t}`
    return (
      r && (n = (0, j.str)`${n}${(0, jt.getErrorPath)(r, jt.Type.Str)}`),
      [qe.schemaPath, n]
    )
  }
  function mi(t, { params: e, message: r }, s) {
    let { keyword: n, data: o, schemaValue: a, it: i } = t,
      { opts: c, propertyName: l, topSchemaRef: u, schemaPath: d } = i
    s.push(
      [qe.keyword, n],
      [qe.params, typeof e == "function" ? e(t) : e || (0, j._)`{}`],
    ),
      c.messages && s.push([qe.message, typeof r == "function" ? r(t) : r]),
      c.verbose &&
        s.push(
          [qe.schema, a],
          [qe.parentSchema, (0, j._)`${u}${d}`],
          [L.default.data, o],
        ),
      l && s.push([qe.propertyName, l])
  }
})
var ln = _((Me) => {
  "use strict"
  Object.defineProperty(Me, "__esModule", { value: !0 })
  Me.boolOrEmptySchema = Me.topBoolOrEmptySchema = void 0
  var yi = rt(),
    _i = P(),
    gi = de(),
    $i = { message: "boolean schema is false" }
  function vi(t) {
    let { gen: e, schema: r, validateName: s } = t
    r === !1
      ? un(t, !1)
      : typeof r == "object" && r.$async === !0
        ? e.return(gi.default.data)
        : (e.assign((0, _i._)`${s}.errors`, null), e.return(!0))
  }
  Me.topBoolOrEmptySchema = vi
  function wi(t, e) {
    let { gen: r, schema: s } = t
    s === !1 ? (r.var(e, !1), un(t)) : r.var(e, !0)
  }
  Me.boolOrEmptySchema = wi
  function un(t, e) {
    let { gen: r, data: s } = t,
      n = {
        gen: r,
        keyword: "false schema",
        data: s,
        schema: !1,
        schemaCode: !1,
        schemaValue: !1,
        params: {},
        it: t,
      }
    ;(0, yi.reportError)(n, $i, void 0, e)
  }
})
var kr = _((Ae) => {
  "use strict"
  Object.defineProperty(Ae, "__esModule", { value: !0 })
  Ae.getRules = Ae.isJSONType = void 0
  var bi = [
      "string",
      "number",
      "integer",
      "boolean",
      "null",
      "object",
      "array",
    ],
    Ei = new Set(bi)
  function Pi(t) {
    return typeof t == "string" && Ei.has(t)
  }
  Ae.isJSONType = Pi
  function Si() {
    let t = {
      number: { type: "number", rules: [] },
      string: { type: "string", rules: [] },
      array: { type: "array", rules: [] },
      object: { type: "object", rules: [] },
    }
    return {
      types: { ...t, integer: !0, boolean: !0, null: !0 },
      rules: [{ rules: [] }, t.number, t.string, t.array, t.object],
      post: { rules: [] },
      all: {},
      keywords: {},
    }
  }
  Ae.getRules = Si
})
var jr = _((me) => {
  "use strict"
  Object.defineProperty(me, "__esModule", { value: !0 })
  me.shouldUseRule = me.shouldUseGroup = me.schemaHasRulesForType = void 0
  function Ni({ schema: t, self: e }, r) {
    let s = e.RULES.types[r]
    return s && s !== !0 && dn(t, s)
  }
  me.schemaHasRulesForType = Ni
  function dn(t, e) {
    return e.rules.some((r) => fn(t, r))
  }
  me.shouldUseGroup = dn
  function fn(t, e) {
    var r
    return (
      t[e.keyword] !== void 0 ||
      ((r = e.definition.implements) === null || r === void 0
        ? void 0
        : r.some((s) => t[s] !== void 0))
    )
  }
  me.shouldUseRule = fn
})
var st = _((F) => {
  "use strict"
  Object.defineProperty(F, "__esModule", { value: !0 })
  F.reportTypeError =
    F.checkDataTypes =
    F.checkDataType =
    F.coerceAndCheckDataType =
    F.getJSONTypes =
    F.getSchemaTypes =
    F.DataType =
      void 0
  var qi = kr(),
    ki = jr(),
    ji = rt(),
    b = P(),
    hn = I(),
    De
  ;(function (t) {
    ;(t[(t.Correct = 0)] = "Correct"), (t[(t.Wrong = 1)] = "Wrong")
  })(De || (F.DataType = De = {}))
  function Oi(t) {
    let e = pn(t.type)
    if (e.includes("null")) {
      if (t.nullable === !1)
        throw new Error("type: null contradicts nullable: false")
    } else {
      if (!e.length && t.nullable !== void 0)
        throw new Error('"nullable" cannot be used without "type"')
      t.nullable === !0 && e.push("null")
    }
    return e
  }
  F.getSchemaTypes = Oi
  function pn(t) {
    let e = Array.isArray(t) ? t : t ? [t] : []
    if (e.every(qi.isJSONType)) return e
    throw new Error("type must be JSONType or JSONType[]: " + e.join(","))
  }
  F.getJSONTypes = pn
  function Ii(t, e) {
    let { gen: r, data: s, opts: n } = t,
      o = Ri(e, n.coerceTypes),
      a =
        e.length > 0 &&
        !(
          o.length === 0 &&
          e.length === 1 &&
          (0, ki.schemaHasRulesForType)(t, e[0])
        )
    if (a) {
      let i = Ir(e, s, n.strictNumbers, De.Wrong)
      r.if(i, () => {
        o.length ? Ti(t, e, o) : Rr(t)
      })
    }
    return a
  }
  F.coerceAndCheckDataType = Ii
  var mn = new Set(["string", "number", "integer", "boolean", "null"])
  function Ri(t, e) {
    return e
      ? t.filter((r) => mn.has(r) || (e === "array" && r === "array"))
      : []
  }
  function Ti(t, e, r) {
    let { gen: s, data: n, opts: o } = t,
      a = s.let("dataType", (0, b._)`typeof ${n}`),
      i = s.let("coerced", (0, b._)`undefined`)
    o.coerceTypes === "array" &&
      s.if(
        (0, b._)`${a} == 'object' && Array.isArray(${n}) && ${n}.length == 1`,
        () =>
          s
            .assign(n, (0, b._)`${n}[0]`)
            .assign(a, (0, b._)`typeof ${n}`)
            .if(Ir(e, n, o.strictNumbers), () => s.assign(i, n)),
      ),
      s.if((0, b._)`${i} !== undefined`)
    for (let l of r)
      (mn.has(l) || (l === "array" && o.coerceTypes === "array")) && c(l)
    s.else(),
      Rr(t),
      s.endIf(),
      s.if((0, b._)`${i} !== undefined`, () => {
        s.assign(n, i), Ci(t, i)
      })
    function c(l) {
      switch (l) {
        case "string":
          s.elseIf((0, b._)`${a} == "number" || ${a} == "boolean"`)
            .assign(i, (0, b._)`"" + ${n}`)
            .elseIf((0, b._)`${n} === null`)
            .assign(i, (0, b._)`""`)
          return
        case "number":
          s.elseIf((0, b._)`${a} == "boolean" || ${n} === null
              || (${a} == "string" && ${n} && ${n} == +${n})`).assign(
            i,
            (0, b._)`+${n}`,
          )
          return
        case "integer":
          s.elseIf((0, b._)`${a} === "boolean" || ${n} === null
              || (${a} === "string" && ${n} && ${n} == +${n} && !(${n} % 1))`).assign(
            i,
            (0, b._)`+${n}`,
          )
          return
        case "boolean":
          s.elseIf((0, b._)`${n} === "false" || ${n} === 0 || ${n} === null`)
            .assign(i, !1)
            .elseIf((0, b._)`${n} === "true" || ${n} === 1`)
            .assign(i, !0)
          return
        case "null":
          s.elseIf((0, b._)`${n} === "" || ${n} === 0 || ${n} === false`),
            s.assign(i, null)
          return
        case "array":
          s.elseIf((0, b._)`${a} === "string" || ${a} === "number"
              || ${a} === "boolean" || ${n} === null`).assign(
            i,
            (0, b._)`[${n}]`,
          )
      }
    }
  }
  function Ci({ gen: t, parentData: e, parentDataProperty: r }, s) {
    t.if((0, b._)`${e} !== undefined`, () => t.assign((0, b._)`${e}[${r}]`, s))
  }
  function Or(t, e, r, s = De.Correct) {
    let n = s === De.Correct ? b.operators.EQ : b.operators.NEQ,
      o
    switch (t) {
      case "null":
        return (0, b._)`${e} ${n} null`
      case "array":
        o = (0, b._)`Array.isArray(${e})`
        break
      case "object":
        o = (0, b._)`${e} && typeof ${e} == "object" && !Array.isArray(${e})`
        break
      case "integer":
        o = a((0, b._)`!(${e} % 1) && !isNaN(${e})`)
        break
      case "number":
        o = a()
        break
      default:
        return (0, b._)`typeof ${e} ${n} ${t}`
    }
    return s === De.Correct ? o : (0, b.not)(o)
    function a(i = b.nil) {
      return (0, b.and)(
        (0, b._)`typeof ${e} == "number"`,
        i,
        r ? (0, b._)`isFinite(${e})` : b.nil,
      )
    }
  }
  F.checkDataType = Or
  function Ir(t, e, r, s) {
    if (t.length === 1) return Or(t[0], e, r, s)
    let n,
      o = (0, hn.toHash)(t)
    if (o.array && o.object) {
      let a = (0, b._)`typeof ${e} != "object"`
      ;(n = o.null ? a : (0, b._)`!${e} || ${a}`),
        delete o.null,
        delete o.array,
        delete o.object
    } else n = b.nil
    o.number && delete o.integer
    for (let a in o) n = (0, b.and)(n, Or(a, e, r, s))
    return n
  }
  F.checkDataTypes = Ir
  var Mi = {
    message: ({ schema: t }) => `must be ${t}`,
    params: ({ schema: t, schemaValue: e }) =>
      typeof t == "string" ? (0, b._)`{type: ${t}}` : (0, b._)`{type: ${e}}`,
  }
  function Rr(t) {
    let e = Ai(t)
    ;(0, ji.reportError)(e, Mi)
  }
  F.reportTypeError = Rr
  function Ai(t) {
    let { gen: e, data: r, schema: s } = t,
      n = (0, hn.schemaRefOrVal)(t, s, "type")
    return {
      gen: e,
      keyword: "type",
      data: r,
      schema: s.type,
      schemaCode: n,
      schemaValue: n,
      parentSchema: s,
      params: {},
      it: t,
    }
  }
})
var _n = _((Ot) => {
  "use strict"
  Object.defineProperty(Ot, "__esModule", { value: !0 })
  Ot.assignDefaults = void 0
  var Ve = P(),
    Di = I()
  function Vi(t, e) {
    let { properties: r, items: s } = t.schema
    if (e === "object" && r) for (let n in r) yn(t, n, r[n].default)
    else
      e === "array" &&
        Array.isArray(s) &&
        s.forEach((n, o) => yn(t, o, n.default))
  }
  Ot.assignDefaults = Vi
  function yn(t, e, r) {
    let { gen: s, compositeRule: n, data: o, opts: a } = t
    if (r === void 0) return
    let i = (0, Ve._)`${o}${(0, Ve.getProperty)(e)}`
    if (n) {
      ;(0, Di.checkStrictMode)(t, `default is ignored for: ${i}`)
      return
    }
    let c = (0, Ve._)`${i} === undefined`
    a.useDefaults === "empty" &&
      (c = (0, Ve._)`${c} || ${i} === null || ${i} === ""`),
      s.if(c, (0, Ve._)`${i} = ${(0, Ve.stringify)(r)}`)
  }
})
var X = _((R) => {
  "use strict"
  Object.defineProperty(R, "__esModule", { value: !0 })
  R.validateUnion =
    R.validateArray =
    R.usePattern =
    R.callValidateCode =
    R.schemaProperties =
    R.allSchemaProperties =
    R.noPropertyInData =
    R.propertyInData =
    R.isOwnProperty =
    R.hasPropFunc =
    R.reportMissingProp =
    R.checkMissingProp =
    R.checkReportMissingProp =
      void 0
  var M = P(),
    Tr = I(),
    ye = de(),
    zi = I()
  function Ui(t, e) {
    let { gen: r, data: s, it: n } = t
    r.if(Mr(r, s, e, n.opts.ownProperties), () => {
      t.setParams({ missingProperty: (0, M._)`${e}` }, !0), t.error()
    })
  }
  R.checkReportMissingProp = Ui
  function Ki({ gen: t, data: e, it: { opts: r } }, s, n) {
    return (0, M.or)(
      ...s.map((o) =>
        (0, M.and)(Mr(t, e, o, r.ownProperties), (0, M._)`${n} = ${o}`),
      ),
    )
  }
  R.checkMissingProp = Ki
  function Fi(t, e) {
    t.setParams({ missingProperty: e }, !0), t.error()
  }
  R.reportMissingProp = Fi
  function gn(t) {
    return t.scopeValue("func", {
      ref: Object.prototype.hasOwnProperty,
      code: (0, M._)`Object.prototype.hasOwnProperty`,
    })
  }
  R.hasPropFunc = gn
  function Cr(t, e, r) {
    return (0, M._)`${gn(t)}.call(${e}, ${r})`
  }
  R.isOwnProperty = Cr
  function Li(t, e, r, s) {
    let n = (0, M._)`${e}${(0, M.getProperty)(r)} !== undefined`
    return s ? (0, M._)`${n} && ${Cr(t, e, r)}` : n
  }
  R.propertyInData = Li
  function Mr(t, e, r, s) {
    let n = (0, M._)`${e}${(0, M.getProperty)(r)} === undefined`
    return s ? (0, M.or)(n, (0, M.not)(Cr(t, e, r))) : n
  }
  R.noPropertyInData = Mr
  function $n(t) {
    return t ? Object.keys(t).filter((e) => e !== "__proto__") : []
  }
  R.allSchemaProperties = $n
  function xi(t, e) {
    return $n(e).filter((r) => !(0, Tr.alwaysValidSchema)(t, e[r]))
  }
  R.schemaProperties = xi
  function Hi(
    {
      schemaCode: t,
      data: e,
      it: { gen: r, topSchemaRef: s, schemaPath: n, errorPath: o },
      it: a,
    },
    i,
    c,
    l,
  ) {
    let u = l ? (0, M._)`${t}, ${e}, ${s}${n}` : e,
      d = [
        [ye.default.instancePath, (0, M.strConcat)(ye.default.instancePath, o)],
        [ye.default.parentData, a.parentData],
        [ye.default.parentDataProperty, a.parentDataProperty],
        [ye.default.rootData, ye.default.rootData],
      ]
    a.opts.dynamicRef &&
      d.push([ye.default.dynamicAnchors, ye.default.dynamicAnchors])
    let y = (0, M._)`${u}, ${r.object(...d)}`
    return c !== M.nil ? (0, M._)`${i}.call(${c}, ${y})` : (0, M._)`${i}(${y})`
  }
  R.callValidateCode = Hi
  var Gi = (0, M._)`new RegExp`
  function Ji({ gen: t, it: { opts: e } }, r) {
    let s = e.unicodeRegExp ? "u" : "",
      { regExp: n } = e.code,
      o = n(r, s)
    return t.scopeValue("pattern", {
      key: o.toString(),
      ref: o,
      code: (0,
      M._)`${n.code === "new RegExp" ? Gi : ((0, zi.useFunc))(t, n)}(${r}, ${s})`,
    })
  }
  R.usePattern = Ji
  function Wi(t) {
    let { gen: e, data: r, keyword: s, it: n } = t,
      o = e.name("valid")
    if (n.allErrors) {
      let i = e.let("valid", !0)
      return a(() => e.assign(i, !1)), i
    }
    return e.var(o, !0), a(() => e.break()), o
    function a(i) {
      let c = e.const("len", (0, M._)`${r}.length`)
      e.forRange("i", 0, c, (l) => {
        t.subschema({ keyword: s, dataProp: l, dataPropType: Tr.Type.Num }, o),
          e.if((0, M.not)(o), i)
      })
    }
  }
  R.validateArray = Wi
  function Qi(t) {
    let { gen: e, schema: r, keyword: s, it: n } = t
    if (!Array.isArray(r)) throw new Error("ajv implementation error")
    if (r.some((c) => (0, Tr.alwaysValidSchema)(n, c)) && !n.opts.unevaluated)
      return
    let a = e.let("valid", !1),
      i = e.name("_valid")
    e.block(() =>
      r.forEach((c, l) => {
        let u = t.subschema({ keyword: s, schemaProp: l, compositeRule: !0 }, i)
        e.assign(a, (0, M._)`${a} || ${i}`),
          t.mergeValidEvaluated(u, i) || e.if((0, M.not)(a))
      }),
    ),
      t.result(
        a,
        () => t.reset(),
        () => t.error(!0),
      )
  }
  R.validateUnion = Qi
})
var bn = _((ne) => {
  "use strict"
  Object.defineProperty(ne, "__esModule", { value: !0 })
  ne.validateKeywordUsage =
    ne.validSchemaType =
    ne.funcKeywordCode =
    ne.macroKeywordCode =
      void 0
  var x = P(),
    ke = de(),
    Xi = X(),
    Bi = rt()
  function Yi(t, e) {
    let { gen: r, keyword: s, schema: n, parentSchema: o, it: a } = t,
      i = e.macro.call(a.self, n, o, a),
      c = wn(r, s, i)
    a.opts.validateSchema !== !1 && a.self.validateSchema(i, !0)
    let l = r.name("valid")
    t.subschema(
      {
        schema: i,
        schemaPath: x.nil,
        errSchemaPath: `${a.errSchemaPath}/${s}`,
        topSchemaRef: c,
        compositeRule: !0,
      },
      l,
    ),
      t.pass(l, () => t.error(!0))
  }
  ne.macroKeywordCode = Yi
  function Zi(t, e) {
    var r
    let { gen: s, keyword: n, schema: o, parentSchema: a, $data: i, it: c } = t
    tc(c, e)
    let l = !i && e.compile ? e.compile.call(c.self, o, a, c) : e.validate,
      u = wn(s, n, l),
      d = s.let("valid")
    t.block$data(d, y), t.ok((r = e.valid) !== null && r !== void 0 ? r : d)
    function y() {
      if (e.errors === !1) f(), e.modifying && vn(t), p(() => t.error())
      else {
        let g = e.async ? m() : h()
        e.modifying && vn(t), p(() => ec(t, g))
      }
    }
    function m() {
      let g = s.let("ruleErrs", null)
      return (
        s.try(
          () => f((0, x._)`await `),
          (k) =>
            s.assign(d, !1).if(
              (0, x._)`${k} instanceof ${c.ValidationError}`,
              () => s.assign(g, (0, x._)`${k}.errors`),
              () => s.throw(k),
            ),
        ),
        g
      )
    }
    function h() {
      let g = (0, x._)`${u}.errors`
      return s.assign(g, null), f(x.nil), g
    }
    function f(g = e.async ? (0, x._)`await ` : x.nil) {
      let k = c.opts.passContext ? ke.default.this : ke.default.self,
        N = !(("compile" in e && !i) || e.schema === !1)
      s.assign(
        d,
        (0, x._)`${g}${(0, Xi.callValidateCode)(t, u, k, N)}`,
        e.modifying,
      )
    }
    function p(g) {
      var k
      s.if((0, x.not)((k = e.valid) !== null && k !== void 0 ? k : d), g)
    }
  }
  ne.funcKeywordCode = Zi
  function vn(t) {
    let { gen: e, data: r, it: s } = t
    e.if(s.parentData, () =>
      e.assign(r, (0, x._)`${s.parentData}[${s.parentDataProperty}]`),
    )
  }
  function ec(t, e) {
    let { gen: r } = t
    r.if(
      (0, x._)`Array.isArray(${e})`,
      () => {
        r
          .assign(
            ke.default.vErrors,
            (0,
            x._)`${ke.default.vErrors} === null ? ${e} : ${ke.default.vErrors}.concat(${e})`,
          )
          .assign(ke.default.errors, (0, x._)`${ke.default.vErrors}.length`),
          (0, Bi.extendErrors)(t)
      },
      () => t.error(),
    )
  }
  function tc({ schemaEnv: t }, e) {
    if (e.async && !t.$async) throw new Error("async keyword in sync schema")
  }
  function wn(t, e, r) {
    if (r === void 0) throw new Error(`keyword "${e}" failed to compile`)
    return t.scopeValue(
      "keyword",
      typeof r == "function"
        ? { ref: r }
        : { ref: r, code: (0, x.stringify)(r) },
    )
  }
  function rc(t, e, r = !1) {
    return (
      !e.length ||
      e.some((s) =>
        s === "array"
          ? Array.isArray(t)
          : s === "object"
            ? t && typeof t == "object" && !Array.isArray(t)
            : typeof t == s || (r && typeof t > "u"),
      )
    )
  }
  ne.validSchemaType = rc
  function sc({ schema: t, opts: e, self: r, errSchemaPath: s }, n, o) {
    if (Array.isArray(n.keyword) ? !n.keyword.includes(o) : n.keyword !== o)
      throw new Error("ajv implementation error")
    let a = n.dependencies
    if (a?.some((i) => !Object.prototype.hasOwnProperty.call(t, i)))
      throw new Error(
        `parent schema must have dependencies of ${o}: ${a.join(",")}`,
      )
    if (n.validateSchema && !n.validateSchema(t[o])) {
      let c =
        `keyword "${o}" value is invalid at path "${s}": ` +
        r.errorsText(n.validateSchema.errors)
      if (e.validateSchema === "log") r.logger.error(c)
      else throw new Error(c)
    }
  }
  ne.validateKeywordUsage = sc
})
var Pn = _((_e) => {
  "use strict"
  Object.defineProperty(_e, "__esModule", { value: !0 })
  _e.extendSubschemaMode = _e.extendSubschemaData = _e.getSubschema = void 0
  var oe = P(),
    En = I()
  function nc(
    t,
    {
      keyword: e,
      schemaProp: r,
      schema: s,
      schemaPath: n,
      errSchemaPath: o,
      topSchemaRef: a,
    },
  ) {
    if (e !== void 0 && s !== void 0)
      throw new Error('both "keyword" and "schema" passed, only one allowed')
    if (e !== void 0) {
      let i = t.schema[e]
      return r === void 0
        ? {
            schema: i,
            schemaPath: (0, oe._)`${t.schemaPath}${(0, oe.getProperty)(e)}`,
            errSchemaPath: `${t.errSchemaPath}/${e}`,
          }
        : {
            schema: i[r],
            schemaPath: (0,
            oe._)`${t.schemaPath}${(0, oe.getProperty)(e)}${(0, oe.getProperty)(r)}`,
            errSchemaPath: `${t.errSchemaPath}/${e}/${(0, En.escapeFragment)(r)}`,
          }
    }
    if (s !== void 0) {
      if (n === void 0 || o === void 0 || a === void 0)
        throw new Error(
          '"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"',
        )
      return { schema: s, schemaPath: n, topSchemaRef: a, errSchemaPath: o }
    }
    throw new Error('either "keyword" or "schema" must be passed')
  }
  _e.getSubschema = nc
  function oc(
    t,
    e,
    { dataProp: r, dataPropType: s, data: n, dataTypes: o, propertyName: a },
  ) {
    if (n !== void 0 && r !== void 0)
      throw new Error('both "data" and "dataProp" passed, only one allowed')
    let { gen: i } = e
    if (r !== void 0) {
      let { errorPath: l, dataPathArr: u, opts: d } = e,
        y = i.let("data", (0, oe._)`${e.data}${(0, oe.getProperty)(r)}`, !0)
      c(y),
        (t.errorPath = (0,
        oe.str)`${l}${(0, En.getErrorPath)(r, s, d.jsPropertySyntax)}`),
        (t.parentDataProperty = (0, oe._)`${r}`),
        (t.dataPathArr = [...u, t.parentDataProperty])
    }
    if (n !== void 0) {
      let l = n instanceof oe.Name ? n : i.let("data", n, !0)
      c(l), a !== void 0 && (t.propertyName = a)
    }
    o && (t.dataTypes = o)
    function c(l) {
      ;(t.data = l),
        (t.dataLevel = e.dataLevel + 1),
        (t.dataTypes = []),
        (e.definedProperties = new Set()),
        (t.parentData = e.data),
        (t.dataNames = [...e.dataNames, l])
    }
  }
  _e.extendSubschemaData = oc
  function ac(
    t,
    {
      jtdDiscriminator: e,
      jtdMetadata: r,
      compositeRule: s,
      createErrors: n,
      allErrors: o,
    },
  ) {
    s !== void 0 && (t.compositeRule = s),
      n !== void 0 && (t.createErrors = n),
      o !== void 0 && (t.allErrors = o),
      (t.jtdDiscriminator = e),
      (t.jtdMetadata = r)
  }
  _e.extendSubschemaMode = ac
})
var Ar = _((Mf, Sn) => {
  "use strict"
  Sn.exports = function t(e, r) {
    if (e === r) return !0
    if (e && r && typeof e == "object" && typeof r == "object") {
      if (e.constructor !== r.constructor) return !1
      var s, n, o
      if (Array.isArray(e)) {
        if (((s = e.length), s != r.length)) return !1
        for (n = s; n-- !== 0; ) if (!t(e[n], r[n])) return !1
        return !0
      }
      if (e.constructor === RegExp)
        return e.source === r.source && e.flags === r.flags
      if (e.valueOf !== Object.prototype.valueOf)
        return e.valueOf() === r.valueOf()
      if (e.toString !== Object.prototype.toString)
        return e.toString() === r.toString()
      if (((o = Object.keys(e)), (s = o.length), s !== Object.keys(r).length))
        return !1
      for (n = s; n-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(r, o[n])) return !1
      for (n = s; n-- !== 0; ) {
        var a = o[n]
        if (!t(e[a], r[a])) return !1
      }
      return !0
    }
    return e !== e && r !== r
  }
})
var qn = _((Af, Nn) => {
  "use strict"
  var ge = (Nn.exports = function (t, e, r) {
    typeof e == "function" && ((r = e), (e = {})), (r = e.cb || r)
    var s = typeof r == "function" ? r : r.pre || function () {},
      n = r.post || function () {}
    It(e, s, n, t, "", t)
  })
  ge.keywords = {
    additionalItems: !0,
    items: !0,
    contains: !0,
    additionalProperties: !0,
    propertyNames: !0,
    not: !0,
    if: !0,
    then: !0,
    else: !0,
  }
  ge.arrayKeywords = { items: !0, allOf: !0, anyOf: !0, oneOf: !0 }
  ge.propsKeywords = {
    $defs: !0,
    definitions: !0,
    properties: !0,
    patternProperties: !0,
    dependencies: !0,
  }
  ge.skipKeywords = {
    default: !0,
    enum: !0,
    const: !0,
    required: !0,
    maximum: !0,
    minimum: !0,
    exclusiveMaximum: !0,
    exclusiveMinimum: !0,
    multipleOf: !0,
    maxLength: !0,
    minLength: !0,
    pattern: !0,
    format: !0,
    maxItems: !0,
    minItems: !0,
    uniqueItems: !0,
    maxProperties: !0,
    minProperties: !0,
  }
  function It(t, e, r, s, n, o, a, i, c, l) {
    if (s && typeof s == "object" && !Array.isArray(s)) {
      e(s, n, o, a, i, c, l)
      for (var u in s) {
        var d = s[u]
        if (Array.isArray(d)) {
          if (u in ge.arrayKeywords)
            for (var y = 0; y < d.length; y++)
              It(t, e, r, d[y], n + "/" + u + "/" + y, o, n, u, s, y)
        } else if (u in ge.propsKeywords) {
          if (d && typeof d == "object")
            for (var m in d)
              It(t, e, r, d[m], n + "/" + u + "/" + ic(m), o, n, u, s, m)
        } else
          (u in ge.keywords || (t.allKeys && !(u in ge.skipKeywords))) &&
            It(t, e, r, d, n + "/" + u, o, n, u, s)
      }
      r(s, n, o, a, i, c, l)
    }
  }
  function ic(t) {
    return t.replace(/~/g, "~0").replace(/\//g, "~1")
  }
})
var nt = _((J) => {
  "use strict"
  Object.defineProperty(J, "__esModule", { value: !0 })
  J.getSchemaRefs =
    J.resolveUrl =
    J.normalizeId =
    J._getFullPath =
    J.getFullPath =
    J.inlineRef =
      void 0
  var cc = I(),
    uc = Ar(),
    lc = qn(),
    dc = new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const",
    ])
  function fc(t, e = !0) {
    return typeof t == "boolean" ? !0 : e === !0 ? !Dr(t) : e ? kn(t) <= e : !1
  }
  J.inlineRef = fc
  var hc = new Set([
    "$ref",
    "$recursiveRef",
    "$recursiveAnchor",
    "$dynamicRef",
    "$dynamicAnchor",
  ])
  function Dr(t) {
    for (let e in t) {
      if (hc.has(e)) return !0
      let r = t[e]
      if ((Array.isArray(r) && r.some(Dr)) || (typeof r == "object" && Dr(r)))
        return !0
    }
    return !1
  }
  function kn(t) {
    let e = 0
    for (let r in t) {
      if (r === "$ref") return 1 / 0
      if (
        (e++,
        !dc.has(r) &&
          (typeof t[r] == "object" &&
            (0, cc.eachItem)(t[r], (s) => (e += kn(s))),
          e === 1 / 0))
      )
        return 1 / 0
    }
    return e
  }
  function jn(t, e = "", r) {
    r !== !1 && (e = ze(e))
    let s = t.parse(e)
    return On(t, s)
  }
  J.getFullPath = jn
  function On(t, e) {
    return t.serialize(e).split("#")[0] + "#"
  }
  J._getFullPath = On
  var pc = /#\/?$/
  function ze(t) {
    return t ? t.replace(pc, "") : ""
  }
  J.normalizeId = ze
  function mc(t, e, r) {
    return (r = ze(r)), t.resolve(e, r)
  }
  J.resolveUrl = mc
  var yc = /^[a-z_][-a-z0-9._]*$/i
  function _c(t, e) {
    if (typeof t == "boolean") return {}
    let { schemaId: r, uriResolver: s } = this.opts,
      n = ze(t[r] || e),
      o = { "": n },
      a = jn(s, n, !1),
      i = {},
      c = new Set()
    return (
      lc(t, { allKeys: !0 }, (d, y, m, h) => {
        if (h === void 0) return
        let f = a + y,
          p = o[h]
        typeof d[r] == "string" && (p = g.call(this, d[r])),
          k.call(this, d.$anchor),
          k.call(this, d.$dynamicAnchor),
          (o[y] = p)
        function g(N) {
          let C = this.opts.uriResolver.resolve
          if (((N = ze(p ? C(p, N) : N)), c.has(N))) throw u(N)
          c.add(N)
          let w = this.refs[N]
          return (
            typeof w == "string" && (w = this.refs[w]),
            typeof w == "object"
              ? l(d, w.schema, N)
              : N !== ze(f) &&
                (N[0] === "#"
                  ? (l(d, i[N], N), (i[N] = d))
                  : (this.refs[N] = f)),
            N
          )
        }
        function k(N) {
          if (typeof N == "string") {
            if (!yc.test(N)) throw new Error(`invalid anchor "${N}"`)
            g.call(this, `#${N}`)
          }
        }
      }),
      i
    )
    function l(d, y, m) {
      if (y !== void 0 && !uc(d, y)) throw u(m)
    }
    function u(d) {
      return new Error(`reference "${d}" resolves to more than one schema`)
    }
  }
  J.getSchemaRefs = _c
})
var it = _(($e) => {
  "use strict"
  Object.defineProperty($e, "__esModule", { value: !0 })
  $e.getData = $e.KeywordCxt = $e.validateFunctionCode = void 0
  var Mn = ln(),
    In = st(),
    zr = jr(),
    Rt = st(),
    gc = _n(),
    at = bn(),
    Vr = Pn(),
    $ = P(),
    v = de(),
    $c = nt(),
    fe = I(),
    ot = rt()
  function vc(t) {
    if (Vn(t) && (zn(t), Dn(t))) {
      Ec(t)
      return
    }
    An(t, () => (0, Mn.topBoolOrEmptySchema)(t))
  }
  $e.validateFunctionCode = vc
  function An(
    { gen: t, validateName: e, schema: r, schemaEnv: s, opts: n },
    o,
  ) {
    n.code.es5
      ? t.func(
          e,
          (0, $._)`${v.default.data}, ${v.default.valCxt}`,
          s.$async,
          () => {
            t.code((0, $._)`"use strict"; ${Rn(r, n)}`), bc(t, n), t.code(o)
          },
        )
      : t.func(e, (0, $._)`${v.default.data}, ${wc(n)}`, s.$async, () =>
          t.code(Rn(r, n)).code(o),
        )
  }
  function wc(t) {
    return (0,
    $._)`{${v.default.instancePath}="", ${v.default.parentData}, ${v.default.parentDataProperty}, ${v.default.rootData}=${v.default.data}${t.dynamicRef ? ((0, $._))`, ${v.default.dynamicAnchors}={}` : $.nil}}={}`
  }
  function bc(t, e) {
    t.if(
      v.default.valCxt,
      () => {
        t.var(
          v.default.instancePath,
          (0, $._)`${v.default.valCxt}.${v.default.instancePath}`,
        ),
          t.var(
            v.default.parentData,
            (0, $._)`${v.default.valCxt}.${v.default.parentData}`,
          ),
          t.var(
            v.default.parentDataProperty,
            (0, $._)`${v.default.valCxt}.${v.default.parentDataProperty}`,
          ),
          t.var(
            v.default.rootData,
            (0, $._)`${v.default.valCxt}.${v.default.rootData}`,
          ),
          e.dynamicRef &&
            t.var(
              v.default.dynamicAnchors,
              (0, $._)`${v.default.valCxt}.${v.default.dynamicAnchors}`,
            )
      },
      () => {
        t.var(v.default.instancePath, (0, $._)`""`),
          t.var(v.default.parentData, (0, $._)`undefined`),
          t.var(v.default.parentDataProperty, (0, $._)`undefined`),
          t.var(v.default.rootData, v.default.data),
          e.dynamicRef && t.var(v.default.dynamicAnchors, (0, $._)`{}`)
      },
    )
  }
  function Ec(t) {
    let { schema: e, opts: r, gen: s } = t
    An(t, () => {
      r.$comment && e.$comment && Kn(t),
        kc(t),
        s.let(v.default.vErrors, null),
        s.let(v.default.errors, 0),
        r.unevaluated && Pc(t),
        Un(t),
        Ic(t)
    })
  }
  function Pc(t) {
    let { gen: e, validateName: r } = t
    ;(t.evaluated = e.const("evaluated", (0, $._)`${r}.evaluated`)),
      e.if((0, $._)`${t.evaluated}.dynamicProps`, () =>
        e.assign((0, $._)`${t.evaluated}.props`, (0, $._)`undefined`),
      ),
      e.if((0, $._)`${t.evaluated}.dynamicItems`, () =>
        e.assign((0, $._)`${t.evaluated}.items`, (0, $._)`undefined`),
      )
  }
  function Rn(t, e) {
    let r = typeof t == "object" && t[e.schemaId]
    return r && (e.code.source || e.code.process)
      ? (0, $._)`/*# sourceURL=${r} */`
      : $.nil
  }
  function Sc(t, e) {
    if (Vn(t) && (zn(t), Dn(t))) {
      Nc(t, e)
      return
    }
    ;(0, Mn.boolOrEmptySchema)(t, e)
  }
  function Dn({ schema: t, self: e }) {
    if (typeof t == "boolean") return !t
    for (let r in t) if (e.RULES.all[r]) return !0
    return !1
  }
  function Vn(t) {
    return typeof t.schema != "boolean"
  }
  function Nc(t, e) {
    let { schema: r, gen: s, opts: n } = t
    n.$comment && r.$comment && Kn(t), jc(t), Oc(t)
    let o = s.const("_errs", v.default.errors)
    Un(t, o), s.var(e, (0, $._)`${o} === ${v.default.errors}`)
  }
  function zn(t) {
    ;(0, fe.checkUnknownRules)(t), qc(t)
  }
  function Un(t, e) {
    if (t.opts.jtd) return Tn(t, [], !1, e)
    let r = (0, In.getSchemaTypes)(t.schema),
      s = (0, In.coerceAndCheckDataType)(t, r)
    Tn(t, r, !s, e)
  }
  function qc(t) {
    let { schema: e, errSchemaPath: r, opts: s, self: n } = t
    e.$ref &&
      s.ignoreKeywordsWithRef &&
      (0, fe.schemaHasRulesButRef)(e, n.RULES) &&
      n.logger.warn(`$ref: keywords ignored in schema at path "${r}"`)
  }
  function kc(t) {
    let { schema: e, opts: r } = t
    e.default !== void 0 &&
      r.useDefaults &&
      r.strictSchema &&
      (0, fe.checkStrictMode)(t, "default is ignored in the schema root")
  }
  function jc(t) {
    let e = t.schema[t.opts.schemaId]
    e && (t.baseId = (0, $c.resolveUrl)(t.opts.uriResolver, t.baseId, e))
  }
  function Oc(t) {
    if (t.schema.$async && !t.schemaEnv.$async)
      throw new Error("async schema in sync schema")
  }
  function Kn({ gen: t, schemaEnv: e, schema: r, errSchemaPath: s, opts: n }) {
    let o = r.$comment
    if (n.$comment === !0) t.code((0, $._)`${v.default.self}.logger.log(${o})`)
    else if (typeof n.$comment == "function") {
      let a = (0, $.str)`${s}/$comment`,
        i = t.scopeValue("root", { ref: e.root })
      t.code((0, $._)`${v.default.self}.opts.$comment(${o}, ${a}, ${i}.schema)`)
    }
  }
  function Ic(t) {
    let {
      gen: e,
      schemaEnv: r,
      validateName: s,
      ValidationError: n,
      opts: o,
    } = t
    r.$async
      ? e.if(
          (0, $._)`${v.default.errors} === 0`,
          () => e.return(v.default.data),
          () => e.throw((0, $._)`new ${n}(${v.default.vErrors})`),
        )
      : (e.assign((0, $._)`${s}.errors`, v.default.vErrors),
        o.unevaluated && Rc(t),
        e.return((0, $._)`${v.default.errors} === 0`))
  }
  function Rc({ gen: t, evaluated: e, props: r, items: s }) {
    r instanceof $.Name && t.assign((0, $._)`${e}.props`, r),
      s instanceof $.Name && t.assign((0, $._)`${e}.items`, s)
  }
  function Tn(t, e, r, s) {
    let { gen: n, schema: o, data: a, allErrors: i, opts: c, self: l } = t,
      { RULES: u } = l
    if (
      o.$ref &&
      (c.ignoreKeywordsWithRef || !(0, fe.schemaHasRulesButRef)(o, u))
    ) {
      n.block(() => Ln(t, "$ref", u.all.$ref.definition))
      return
    }
    c.jtd || Tc(t, e),
      n.block(() => {
        for (let y of u.rules) d(y)
        d(u.post)
      })
    function d(y) {
      ;(0, zr.shouldUseGroup)(o, y) &&
        (y.type
          ? (n.if((0, Rt.checkDataType)(y.type, a, c.strictNumbers)),
            Cn(t, y),
            e.length === 1 &&
              e[0] === y.type &&
              r &&
              (n.else(), (0, Rt.reportTypeError)(t)),
            n.endIf())
          : Cn(t, y),
        i || n.if((0, $._)`${v.default.errors} === ${s || 0}`))
    }
  }
  function Cn(t, e) {
    let {
      gen: r,
      schema: s,
      opts: { useDefaults: n },
    } = t
    n && (0, gc.assignDefaults)(t, e.type),
      r.block(() => {
        for (let o of e.rules)
          (0, zr.shouldUseRule)(s, o) && Ln(t, o.keyword, o.definition, e.type)
      })
  }
  function Tc(t, e) {
    t.schemaEnv.meta ||
      !t.opts.strictTypes ||
      (Cc(t, e), t.opts.allowUnionTypes || Mc(t, e), Ac(t, t.dataTypes))
  }
  function Cc(t, e) {
    if (e.length) {
      if (!t.dataTypes.length) {
        t.dataTypes = e
        return
      }
      e.forEach((r) => {
        Fn(t.dataTypes, r) ||
          Ur(t, `type "${r}" not allowed by context "${t.dataTypes.join(",")}"`)
      }),
        Vc(t, e)
    }
  }
  function Mc(t, e) {
    e.length > 1 &&
      !(e.length === 2 && e.includes("null")) &&
      Ur(t, "use allowUnionTypes to allow union type keyword")
  }
  function Ac(t, e) {
    let r = t.self.RULES.all
    for (let s in r) {
      let n = r[s]
      if (typeof n == "object" && (0, zr.shouldUseRule)(t.schema, n)) {
        let { type: o } = n.definition
        o.length &&
          !o.some((a) => Dc(e, a)) &&
          Ur(t, `missing type "${o.join(",")}" for keyword "${s}"`)
      }
    }
  }
  function Dc(t, e) {
    return t.includes(e) || (e === "number" && t.includes("integer"))
  }
  function Fn(t, e) {
    return t.includes(e) || (e === "integer" && t.includes("number"))
  }
  function Vc(t, e) {
    let r = []
    for (let s of t.dataTypes)
      Fn(e, s)
        ? r.push(s)
        : e.includes("integer") && s === "number" && r.push("integer")
    t.dataTypes = r
  }
  function Ur(t, e) {
    let r = t.schemaEnv.baseId + t.errSchemaPath
    ;(e += ` at "${r}" (strictTypes)`),
      (0, fe.checkStrictMode)(t, e, t.opts.strictTypes)
  }
  var Tt = class {
    constructor(e, r, s) {
      if (
        ((0, at.validateKeywordUsage)(e, r, s),
        (this.gen = e.gen),
        (this.allErrors = e.allErrors),
        (this.keyword = s),
        (this.data = e.data),
        (this.schema = e.schema[s]),
        (this.$data =
          r.$data && e.opts.$data && this.schema && this.schema.$data),
        (this.schemaValue = (0, fe.schemaRefOrVal)(
          e,
          this.schema,
          s,
          this.$data,
        )),
        (this.schemaType = r.schemaType),
        (this.parentSchema = e.schema),
        (this.params = {}),
        (this.it = e),
        (this.def = r),
        this.$data)
      )
        this.schemaCode = e.gen.const("vSchema", xn(this.$data, e))
      else if (
        ((this.schemaCode = this.schemaValue),
        !(0, at.validSchemaType)(this.schema, r.schemaType, r.allowUndefined))
      )
        throw new Error(`${s} value must be ${JSON.stringify(r.schemaType)}`)
      ;("code" in r ? r.trackErrors : r.errors !== !1) &&
        (this.errsCount = e.gen.const("_errs", v.default.errors))
    }
    result(e, r, s) {
      this.failResult((0, $.not)(e), r, s)
    }
    failResult(e, r, s) {
      this.gen.if(e),
        s ? s() : this.error(),
        r
          ? (this.gen.else(), r(), this.allErrors && this.gen.endIf())
          : this.allErrors
            ? this.gen.endIf()
            : this.gen.else()
    }
    pass(e, r) {
      this.failResult((0, $.not)(e), void 0, r)
    }
    fail(e) {
      if (e === void 0) {
        this.error(), this.allErrors || this.gen.if(!1)
        return
      }
      this.gen.if(e),
        this.error(),
        this.allErrors ? this.gen.endIf() : this.gen.else()
    }
    fail$data(e) {
      if (!this.$data) return this.fail(e)
      let { schemaCode: r } = this
      this.fail(
        (0, $._)`${r} !== undefined && (${(0, $.or)(this.invalid$data(), e)})`,
      )
    }
    error(e, r, s) {
      if (r) {
        this.setParams(r), this._error(e, s), this.setParams({})
        return
      }
      this._error(e, s)
    }
    _error(e, r) {
      ;(e ? ot.reportExtraError : ot.reportError)(this, this.def.error, r)
    }
    $dataError() {
      ;(0, ot.reportError)(this, this.def.$dataError || ot.keyword$DataError)
    }
    reset() {
      if (this.errsCount === void 0)
        throw new Error('add "trackErrors" to keyword definition')
      ;(0, ot.resetErrorsCount)(this.gen, this.errsCount)
    }
    ok(e) {
      this.allErrors || this.gen.if(e)
    }
    setParams(e, r) {
      r ? Object.assign(this.params, e) : (this.params = e)
    }
    block$data(e, r, s = $.nil) {
      this.gen.block(() => {
        this.check$data(e, s), r()
      })
    }
    check$data(e = $.nil, r = $.nil) {
      if (!this.$data) return
      let { gen: s, schemaCode: n, schemaType: o, def: a } = this
      s.if((0, $.or)((0, $._)`${n} === undefined`, r)),
        e !== $.nil && s.assign(e, !0),
        (o.length || a.validateSchema) &&
          (s.elseIf(this.invalid$data()),
          this.$dataError(),
          e !== $.nil && s.assign(e, !1)),
        s.else()
    }
    invalid$data() {
      let { gen: e, schemaCode: r, schemaType: s, def: n, it: o } = this
      return (0, $.or)(a(), i())
      function a() {
        if (s.length) {
          if (!(r instanceof $.Name))
            throw new Error("ajv implementation error")
          let c = Array.isArray(s) ? s : [s]
          return (0,
          $._)`${(0, Rt.checkDataTypes)(c, r, o.opts.strictNumbers, Rt.DataType.Wrong)}`
        }
        return $.nil
      }
      function i() {
        if (n.validateSchema) {
          let c = e.scopeValue("validate$data", { ref: n.validateSchema })
          return (0, $._)`!${c}(${r})`
        }
        return $.nil
      }
    }
    subschema(e, r) {
      let s = (0, Vr.getSubschema)(this.it, e)
      ;(0, Vr.extendSubschemaData)(s, this.it, e),
        (0, Vr.extendSubschemaMode)(s, e)
      let n = { ...this.it, ...s, items: void 0, props: void 0 }
      return Sc(n, r), n
    }
    mergeEvaluated(e, r) {
      let { it: s, gen: n } = this
      s.opts.unevaluated &&
        (s.props !== !0 &&
          e.props !== void 0 &&
          (s.props = fe.mergeEvaluated.props(n, e.props, s.props, r)),
        s.items !== !0 &&
          e.items !== void 0 &&
          (s.items = fe.mergeEvaluated.items(n, e.items, s.items, r)))
    }
    mergeValidEvaluated(e, r) {
      let { it: s, gen: n } = this
      if (s.opts.unevaluated && (s.props !== !0 || s.items !== !0))
        return n.if(r, () => this.mergeEvaluated(e, $.Name)), !0
    }
  }
  $e.KeywordCxt = Tt
  function Ln(t, e, r, s) {
    let n = new Tt(t, r, e)
    "code" in r
      ? r.code(n, s)
      : n.$data && r.validate
        ? (0, at.funcKeywordCode)(n, r)
        : "macro" in r
          ? (0, at.macroKeywordCode)(n, r)
          : (r.compile || r.validate) && (0, at.funcKeywordCode)(n, r)
  }
  var zc = /^\/(?:[^~]|~0|~1)*$/,
    Uc = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/
  function xn(t, { dataLevel: e, dataNames: r, dataPathArr: s }) {
    let n, o
    if (t === "") return v.default.rootData
    if (t[0] === "/") {
      if (!zc.test(t)) throw new Error(`Invalid JSON-pointer: ${t}`)
      ;(n = t), (o = v.default.rootData)
    } else {
      let l = Uc.exec(t)
      if (!l) throw new Error(`Invalid JSON-pointer: ${t}`)
      let u = +l[1]
      if (((n = l[2]), n === "#")) {
        if (u >= e) throw new Error(c("property/index", u))
        return s[e - u]
      }
      if (u > e) throw new Error(c("data", u))
      if (((o = r[e - u]), !n)) return o
    }
    let a = o,
      i = n.split("/")
    for (let l of i)
      l &&
        ((o = (0,
        $._)`${o}${(0, $.getProperty)((0, fe.unescapeJsonPointer)(l))}`),
        (a = (0, $._)`${a} && ${o}`))
    return a
    function c(l, u) {
      return `Cannot access ${l} ${u} levels up, current level is ${e}`
    }
  }
  $e.getData = xn
})
var Ct = _((Fr) => {
  "use strict"
  Object.defineProperty(Fr, "__esModule", { value: !0 })
  var Kr = class extends Error {
    constructor(e) {
      super("validation failed"),
        (this.errors = e),
        (this.ajv = this.validation = !0)
    }
  }
  Fr.default = Kr
})
var ct = _((Hr) => {
  "use strict"
  Object.defineProperty(Hr, "__esModule", { value: !0 })
  var Lr = nt(),
    xr = class extends Error {
      constructor(e, r, s, n) {
        super(n || `can't resolve reference ${s} from id ${r}`),
          (this.missingRef = (0, Lr.resolveUrl)(e, r, s)),
          (this.missingSchema = (0, Lr.normalizeId)(
            (0, Lr.getFullPath)(e, this.missingRef),
          ))
      }
    }
  Hr.default = xr
})
var At = _((B) => {
  "use strict"
  Object.defineProperty(B, "__esModule", { value: !0 })
  B.resolveSchema =
    B.getCompilingSchema =
    B.resolveRef =
    B.compileSchema =
    B.SchemaEnv =
      void 0
  var ee = P(),
    Kc = Ct(),
    je = de(),
    te = nt(),
    Hn = I(),
    Fc = it(),
    Ue = class {
      constructor(e) {
        var r
        ;(this.refs = {}), (this.dynamicAnchors = {})
        let s
        typeof e.schema == "object" && (s = e.schema),
          (this.schema = e.schema),
          (this.schemaId = e.schemaId),
          (this.root = e.root || this),
          (this.baseId =
            (r = e.baseId) !== null && r !== void 0
              ? r
              : (0, te.normalizeId)(s?.[e.schemaId || "$id"])),
          (this.schemaPath = e.schemaPath),
          (this.localRefs = e.localRefs),
          (this.meta = e.meta),
          (this.$async = s?.$async),
          (this.refs = {})
      }
    }
  B.SchemaEnv = Ue
  function Jr(t) {
    let e = Gn.call(this, t)
    if (e) return e
    let r = (0, te.getFullPath)(this.opts.uriResolver, t.root.baseId),
      { es5: s, lines: n } = this.opts.code,
      { ownProperties: o } = this.opts,
      a = new ee.CodeGen(this.scope, { es5: s, lines: n, ownProperties: o }),
      i
    t.$async &&
      (i = a.scopeValue("Error", {
        ref: Kc.default,
        code: (0, ee._)`require("ajv/dist/runtime/validation_error").default`,
      }))
    let c = a.scopeName("validate")
    t.validateName = c
    let l = {
        gen: a,
        allErrors: this.opts.allErrors,
        data: je.default.data,
        parentData: je.default.parentData,
        parentDataProperty: je.default.parentDataProperty,
        dataNames: [je.default.data],
        dataPathArr: [ee.nil],
        dataLevel: 0,
        dataTypes: [],
        definedProperties: new Set(),
        topSchemaRef: a.scopeValue(
          "schema",
          this.opts.code.source === !0
            ? { ref: t.schema, code: (0, ee.stringify)(t.schema) }
            : { ref: t.schema },
        ),
        validateName: c,
        ValidationError: i,
        schema: t.schema,
        schemaEnv: t,
        rootId: r,
        baseId: t.baseId || r,
        schemaPath: ee.nil,
        errSchemaPath: t.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, ee._)`""`,
        opts: this.opts,
        self: this,
      },
      u
    try {
      this._compilations.add(t),
        (0, Fc.validateFunctionCode)(l),
        a.optimize(this.opts.code.optimize)
      let d = a.toString()
      ;(u = `${a.scopeRefs(je.default.scope)}return ${d}`),
        this.opts.code.process && (u = this.opts.code.process(u, t))
      let m = new Function(`${je.default.self}`, `${je.default.scope}`, u)(
        this,
        this.scope.get(),
      )
      if (
        (this.scope.value(c, { ref: m }),
        (m.errors = null),
        (m.schema = t.schema),
        (m.schemaEnv = t),
        t.$async && (m.$async = !0),
        this.opts.code.source === !0 &&
          (m.source = {
            validateName: c,
            validateCode: d,
            scopeValues: a._values,
          }),
        this.opts.unevaluated)
      ) {
        let { props: h, items: f } = l
        ;(m.evaluated = {
          props: h instanceof ee.Name ? void 0 : h,
          items: f instanceof ee.Name ? void 0 : f,
          dynamicProps: h instanceof ee.Name,
          dynamicItems: f instanceof ee.Name,
        }),
          m.source && (m.source.evaluated = (0, ee.stringify)(m.evaluated))
      }
      return (t.validate = m), t
    } catch (d) {
      throw (
        (delete t.validate,
        delete t.validateName,
        u && this.logger.error("Error compiling schema, function code:", u),
        d)
      )
    } finally {
      this._compilations.delete(t)
    }
  }
  B.compileSchema = Jr
  function Lc(t, e, r) {
    var s
    r = (0, te.resolveUrl)(this.opts.uriResolver, e, r)
    let n = t.refs[r]
    if (n) return n
    let o = Gc.call(this, t, r)
    if (o === void 0) {
      let a = (s = t.localRefs) === null || s === void 0 ? void 0 : s[r],
        { schemaId: i } = this.opts
      a && (o = new Ue({ schema: a, schemaId: i, root: t, baseId: e }))
    }
    if (o !== void 0) return (t.refs[r] = xc.call(this, o))
  }
  B.resolveRef = Lc
  function xc(t) {
    return (0, te.inlineRef)(t.schema, this.opts.inlineRefs)
      ? t.schema
      : t.validate
        ? t
        : Jr.call(this, t)
  }
  function Gn(t) {
    for (let e of this._compilations) if (Hc(e, t)) return e
  }
  B.getCompilingSchema = Gn
  function Hc(t, e) {
    return t.schema === e.schema && t.root === e.root && t.baseId === e.baseId
  }
  function Gc(t, e) {
    let r
    for (; typeof (r = this.refs[e]) == "string"; ) e = r
    return r || this.schemas[e] || Mt.call(this, t, e)
  }
  function Mt(t, e) {
    let r = this.opts.uriResolver.parse(e),
      s = (0, te._getFullPath)(this.opts.uriResolver, r),
      n = (0, te.getFullPath)(this.opts.uriResolver, t.baseId, void 0)
    if (Object.keys(t.schema).length > 0 && s === n) return Gr.call(this, r, t)
    let o = (0, te.normalizeId)(s),
      a = this.refs[o] || this.schemas[o]
    if (typeof a == "string") {
      let i = Mt.call(this, t, a)
      return typeof i?.schema != "object" ? void 0 : Gr.call(this, r, i)
    }
    if (typeof a?.schema == "object") {
      if ((a.validate || Jr.call(this, a), o === (0, te.normalizeId)(e))) {
        let { schema: i } = a,
          { schemaId: c } = this.opts,
          l = i[c]
        return (
          l && (n = (0, te.resolveUrl)(this.opts.uriResolver, n, l)),
          new Ue({ schema: i, schemaId: c, root: t, baseId: n })
        )
      }
      return Gr.call(this, r, a)
    }
  }
  B.resolveSchema = Mt
  var Jc = new Set([
    "properties",
    "patternProperties",
    "enum",
    "dependencies",
    "definitions",
  ])
  function Gr(t, { baseId: e, schema: r, root: s }) {
    var n
    if (((n = t.fragment) === null || n === void 0 ? void 0 : n[0]) !== "/")
      return
    for (let i of t.fragment.slice(1).split("/")) {
      if (typeof r == "boolean") return
      let c = r[(0, Hn.unescapeFragment)(i)]
      if (c === void 0) return
      r = c
      let l = typeof r == "object" && r[this.opts.schemaId]
      !Jc.has(i) && l && (e = (0, te.resolveUrl)(this.opts.uriResolver, e, l))
    }
    let o
    if (
      typeof r != "boolean" &&
      r.$ref &&
      !(0, Hn.schemaHasRulesButRef)(r, this.RULES)
    ) {
      let i = (0, te.resolveUrl)(this.opts.uriResolver, e, r.$ref)
      o = Mt.call(this, s, i)
    }
    let { schemaId: a } = this.opts
    if (
      ((o = o || new Ue({ schema: r, schemaId: a, root: s, baseId: e })),
      o.schema !== o.root.schema)
    )
      return o
  }
})
var Jn = _((Ff, Wc) => {
  Wc.exports = {
    $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
    description:
      "Meta-schema for $data reference (JSON AnySchema extension proposal)",
    type: "object",
    required: ["$data"],
    properties: {
      $data: {
        type: "string",
        anyOf: [
          { format: "relative-json-pointer" },
          { format: "json-pointer" },
        ],
      },
    },
    additionalProperties: !1,
  }
})
var Qn = _((Lf, Wn) => {
  "use strict"
  var Qc = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    a: 10,
    A: 10,
    b: 11,
    B: 11,
    c: 12,
    C: 12,
    d: 13,
    D: 13,
    e: 14,
    E: 14,
    f: 15,
    F: 15,
  }
  Wn.exports = { HEX: Qc }
})
var so = _((xf, ro) => {
  "use strict"
  var { HEX: Xc } = Qn()
  function Zn(t) {
    if (to(t, ".") < 3) return { host: t, isIPV4: !1 }
    let e =
        t.match(
          /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/u,
        ) || [],
      [r] = e
    return r ? { host: Yc(r, "."), isIPV4: !0 } : { host: t, isIPV4: !1 }
  }
  function Wr(t, e = !1) {
    let r = "",
      s = !0
    for (let n of t) {
      if (Xc[n] === void 0) return
      n !== "0" && s === !0 && (s = !1), s || (r += n)
    }
    return e && r.length === 0 && (r = "0"), r
  }
  function Bc(t) {
    let e = 0,
      r = { error: !1, address: "", zone: "" },
      s = [],
      n = [],
      o = !1,
      a = !1,
      i = !1
    function c() {
      if (n.length) {
        if (o === !1) {
          let l = Wr(n)
          if (l !== void 0) s.push(l)
          else return (r.error = !0), !1
        }
        n.length = 0
      }
      return !0
    }
    for (let l = 0; l < t.length; l++) {
      let u = t[l]
      if (!(u === "[" || u === "]"))
        if (u === ":") {
          if ((a === !0 && (i = !0), !c())) break
          if ((e++, s.push(":"), e > 7)) {
            r.error = !0
            break
          }
          l - 1 >= 0 && t[l - 1] === ":" && (a = !0)
          continue
        } else if (u === "%") {
          if (!c()) break
          o = !0
        } else {
          n.push(u)
          continue
        }
    }
    return (
      n.length &&
        (o ? (r.zone = n.join("")) : i ? s.push(n.join("")) : s.push(Wr(n))),
      (r.address = s.join("")),
      r
    )
  }
  function eo(t, e = {}) {
    if (to(t, ":") < 2) return { host: t, isIPV6: !1 }
    let r = Bc(t)
    if (r.error) return { host: t, isIPV6: !1 }
    {
      let s = r.address,
        n = r.address
      return (
        r.zone && ((s += "%" + r.zone), (n += "%25" + r.zone)),
        { host: s, escapedHost: n, isIPV6: !0 }
      )
    }
  }
  function Yc(t, e) {
    let r = "",
      s = !0,
      n = t.length
    for (let o = 0; o < n; o++) {
      let a = t[o]
      a === "0" && s
        ? ((o + 1 <= n && t[o + 1] === e) || o + 1 === n) &&
          ((r += a), (s = !1))
        : (a === e ? (s = !0) : (s = !1), (r += a))
    }
    return r
  }
  function to(t, e) {
    let r = 0
    for (let s = 0; s < t.length; s++) t[s] === e && r++
    return r
  }
  var Xn = /^\.\.?\//u,
    Bn = /^\/\.(?:\/|$)/u,
    Yn = /^\/\.\.(?:\/|$)/u,
    Zc = /^\/?(?:.|\n)*?(?=\/|$)/u
  function eu(t) {
    let e = []
    for (; t.length; )
      if (t.match(Xn)) t = t.replace(Xn, "")
      else if (t.match(Bn)) t = t.replace(Bn, "/")
      else if (t.match(Yn)) (t = t.replace(Yn, "/")), e.pop()
      else if (t === "." || t === "..") t = ""
      else {
        let r = t.match(Zc)
        if (r) {
          let s = r[0]
          ;(t = t.slice(s.length)), e.push(s)
        } else throw new Error("Unexpected dot segment condition")
      }
    return e.join("")
  }
  function tu(t, e) {
    let r = e !== !0 ? escape : unescape
    return (
      t.scheme !== void 0 && (t.scheme = r(t.scheme)),
      t.userinfo !== void 0 && (t.userinfo = r(t.userinfo)),
      t.host !== void 0 && (t.host = r(t.host)),
      t.path !== void 0 && (t.path = r(t.path)),
      t.query !== void 0 && (t.query = r(t.query)),
      t.fragment !== void 0 && (t.fragment = r(t.fragment)),
      t
    )
  }
  function ru(t, e) {
    let r = []
    if (
      (t.userinfo !== void 0 && (r.push(t.userinfo), r.push("@")),
      t.host !== void 0)
    ) {
      let s = unescape(t.host),
        n = Zn(s)
      if (n.isIPV4) s = n.host
      else {
        let o = eo(n.host, { isIPV4: !1 })
        o.isIPV6 === !0 ? (s = `[${o.escapedHost}]`) : (s = t.host)
      }
      r.push(s)
    }
    return (
      (typeof t.port == "number" || typeof t.port == "string") &&
        (r.push(":"), r.push(String(t.port))),
      r.length ? r.join("") : void 0
    )
  }
  ro.exports = {
    recomposeAuthority: ru,
    normalizeComponentEncoding: tu,
    removeDotSegments: eu,
    normalizeIPv4: Zn,
    normalizeIPv6: eo,
    stringArrayToHexStripped: Wr,
  }
})
var uo = _((Hf, co) => {
  "use strict"
  var su =
      /^[\da-f]{8}\b-[\da-f]{4}\b-[\da-f]{4}\b-[\da-f]{4}\b-[\da-f]{12}$/iu,
    nu = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu
  function no(t) {
    return typeof t.secure == "boolean"
      ? t.secure
      : String(t.scheme).toLowerCase() === "wss"
  }
  function oo(t) {
    return t.host || (t.error = t.error || "HTTP URIs must have a host."), t
  }
  function ao(t) {
    let e = String(t.scheme).toLowerCase() === "https"
    return (
      (t.port === (e ? 443 : 80) || t.port === "") && (t.port = void 0),
      t.path || (t.path = "/"),
      t
    )
  }
  function ou(t) {
    return (
      (t.secure = no(t)),
      (t.resourceName = (t.path || "/") + (t.query ? "?" + t.query : "")),
      (t.path = void 0),
      (t.query = void 0),
      t
    )
  }
  function au(t) {
    if (
      ((t.port === (no(t) ? 443 : 80) || t.port === "") && (t.port = void 0),
      typeof t.secure == "boolean" &&
        ((t.scheme = t.secure ? "wss" : "ws"), (t.secure = void 0)),
      t.resourceName)
    ) {
      let [e, r] = t.resourceName.split("?")
      ;(t.path = e && e !== "/" ? e : void 0),
        (t.query = r),
        (t.resourceName = void 0)
    }
    return (t.fragment = void 0), t
  }
  function iu(t, e) {
    if (!t.path) return (t.error = "URN can not be parsed"), t
    let r = t.path.match(nu)
    if (r) {
      let s = e.scheme || t.scheme || "urn"
      ;(t.nid = r[1].toLowerCase()), (t.nss = r[2])
      let n = `${s}:${e.nid || t.nid}`,
        o = Qr[n]
      ;(t.path = void 0), o && (t = o.parse(t, e))
    } else t.error = t.error || "URN can not be parsed."
    return t
  }
  function cu(t, e) {
    let r = e.scheme || t.scheme || "urn",
      s = t.nid.toLowerCase(),
      n = `${r}:${e.nid || s}`,
      o = Qr[n]
    o && (t = o.serialize(t, e))
    let a = t,
      i = t.nss
    return (a.path = `${s || e.nid}:${i}`), (e.skipEscape = !0), a
  }
  function uu(t, e) {
    let r = t
    return (
      (r.uuid = r.nss),
      (r.nss = void 0),
      !e.tolerant &&
        (!r.uuid || !su.test(r.uuid)) &&
        (r.error = r.error || "UUID is not valid."),
      r
    )
  }
  function lu(t) {
    let e = t
    return (e.nss = (t.uuid || "").toLowerCase()), e
  }
  var io = { scheme: "http", domainHost: !0, parse: oo, serialize: ao },
    du = {
      scheme: "https",
      domainHost: io.domainHost,
      parse: oo,
      serialize: ao,
    },
    Dt = { scheme: "ws", domainHost: !0, parse: ou, serialize: au },
    fu = {
      scheme: "wss",
      domainHost: Dt.domainHost,
      parse: Dt.parse,
      serialize: Dt.serialize,
    },
    hu = { scheme: "urn", parse: iu, serialize: cu, skipNormalize: !0 },
    pu = { scheme: "urn:uuid", parse: uu, serialize: lu, skipNormalize: !0 },
    Qr = { http: io, https: du, ws: Dt, wss: fu, urn: hu, "urn:uuid": pu }
  co.exports = Qr
})
var fo = _((Gf, zt) => {
  "use strict"
  var {
      normalizeIPv6: mu,
      normalizeIPv4: yu,
      removeDotSegments: ut,
      recomposeAuthority: _u,
      normalizeComponentEncoding: Vt,
    } = so(),
    Xr = uo()
  function gu(t, e) {
    return (
      typeof t == "string"
        ? (t = ae(he(t, e), e))
        : typeof t == "object" && (t = he(ae(t, e), e)),
      t
    )
  }
  function $u(t, e, r) {
    let s = Object.assign({ scheme: "null" }, r),
      n = lo(he(t, s), he(e, s), s, !0)
    return ae(n, { ...s, skipEscape: !0 })
  }
  function lo(t, e, r, s) {
    let n = {}
    return (
      s || ((t = he(ae(t, r), r)), (e = he(ae(e, r), r))),
      (r = r || {}),
      !r.tolerant && e.scheme
        ? ((n.scheme = e.scheme),
          (n.userinfo = e.userinfo),
          (n.host = e.host),
          (n.port = e.port),
          (n.path = ut(e.path || "")),
          (n.query = e.query))
        : (e.userinfo !== void 0 || e.host !== void 0 || e.port !== void 0
            ? ((n.userinfo = e.userinfo),
              (n.host = e.host),
              (n.port = e.port),
              (n.path = ut(e.path || "")),
              (n.query = e.query))
            : (e.path
                ? (e.path.charAt(0) === "/"
                    ? (n.path = ut(e.path))
                    : ((t.userinfo !== void 0 ||
                        t.host !== void 0 ||
                        t.port !== void 0) &&
                      !t.path
                        ? (n.path = "/" + e.path)
                        : t.path
                          ? (n.path =
                              t.path.slice(0, t.path.lastIndexOf("/") + 1) +
                              e.path)
                          : (n.path = e.path),
                      (n.path = ut(n.path))),
                  (n.query = e.query))
                : ((n.path = t.path),
                  e.query !== void 0
                    ? (n.query = e.query)
                    : (n.query = t.query)),
              (n.userinfo = t.userinfo),
              (n.host = t.host),
              (n.port = t.port)),
          (n.scheme = t.scheme)),
      (n.fragment = e.fragment),
      n
    )
  }
  function vu(t, e, r) {
    return (
      typeof t == "string"
        ? ((t = unescape(t)),
          (t = ae(Vt(he(t, r), !0), { ...r, skipEscape: !0 })))
        : typeof t == "object" && (t = ae(Vt(t, !0), { ...r, skipEscape: !0 })),
      typeof e == "string"
        ? ((e = unescape(e)),
          (e = ae(Vt(he(e, r), !0), { ...r, skipEscape: !0 })))
        : typeof e == "object" && (e = ae(Vt(e, !0), { ...r, skipEscape: !0 })),
      t.toLowerCase() === e.toLowerCase()
    )
  }
  function ae(t, e) {
    let r = {
        host: t.host,
        scheme: t.scheme,
        userinfo: t.userinfo,
        port: t.port,
        path: t.path,
        query: t.query,
        nid: t.nid,
        nss: t.nss,
        uuid: t.uuid,
        fragment: t.fragment,
        reference: t.reference,
        resourceName: t.resourceName,
        secure: t.secure,
        error: "",
      },
      s = Object.assign({}, e),
      n = [],
      o = Xr[(s.scheme || r.scheme || "").toLowerCase()]
    o && o.serialize && o.serialize(r, s),
      r.path !== void 0 &&
        (s.skipEscape
          ? (r.path = unescape(r.path))
          : ((r.path = escape(r.path)),
            r.scheme !== void 0 && (r.path = r.path.split("%3A").join(":")))),
      s.reference !== "suffix" && r.scheme && (n.push(r.scheme), n.push(":"))
    let a = _u(r, s)
    if (
      (a !== void 0 &&
        (s.reference !== "suffix" && n.push("//"),
        n.push(a),
        r.path && r.path.charAt(0) !== "/" && n.push("/")),
      r.path !== void 0)
    ) {
      let i = r.path
      !s.absolutePath && (!o || !o.absolutePath) && (i = ut(i)),
        a === void 0 && (i = i.replace(/^\/\//u, "/%2F")),
        n.push(i)
    }
    return (
      r.query !== void 0 && (n.push("?"), n.push(r.query)),
      r.fragment !== void 0 && (n.push("#"), n.push(r.fragment)),
      n.join("")
    )
  }
  var wu = Array.from({ length: 127 }, (t, e) =>
    /[^!"$&'()*+,\-.;=_`a-z{}~]/u.test(String.fromCharCode(e)),
  )
  function bu(t) {
    let e = 0
    for (let r = 0, s = t.length; r < s; ++r)
      if (((e = t.charCodeAt(r)), e > 126 || wu[e])) return !0
    return !1
  }
  var Eu =
    /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u
  function he(t, e) {
    let r = Object.assign({}, e),
      s = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0,
      },
      n = t.indexOf("%") !== -1,
      o = !1
    r.reference === "suffix" &&
      (t = (r.scheme ? r.scheme + ":" : "") + "//" + t)
    let a = t.match(Eu)
    if (a) {
      if (
        ((s.scheme = a[1]),
        (s.userinfo = a[3]),
        (s.host = a[4]),
        (s.port = parseInt(a[5], 10)),
        (s.path = a[6] || ""),
        (s.query = a[7]),
        (s.fragment = a[8]),
        isNaN(s.port) && (s.port = a[5]),
        s.host)
      ) {
        let c = yu(s.host)
        if (c.isIPV4 === !1) {
          let l = mu(c.host, { isIPV4: !1 })
          ;(s.host = l.host.toLowerCase()), (o = l.isIPV6)
        } else (s.host = c.host), (o = !0)
      }
      s.scheme === void 0 &&
      s.userinfo === void 0 &&
      s.host === void 0 &&
      s.port === void 0 &&
      !s.path &&
      s.query === void 0
        ? (s.reference = "same-document")
        : s.scheme === void 0
          ? (s.reference = "relative")
          : s.fragment === void 0
            ? (s.reference = "absolute")
            : (s.reference = "uri"),
        r.reference &&
          r.reference !== "suffix" &&
          r.reference !== s.reference &&
          (s.error = s.error || "URI is not a " + r.reference + " reference.")
      let i = Xr[(r.scheme || s.scheme || "").toLowerCase()]
      if (
        !r.unicodeSupport &&
        (!i || !i.unicodeSupport) &&
        s.host &&
        (r.domainHost || (i && i.domainHost)) &&
        o === !1 &&
        bu(s.host)
      )
        try {
          s.host = URL.domainToASCII(s.host.toLowerCase())
        } catch (c) {
          s.error =
            s.error || "Host's domain name can not be converted to ASCII: " + c
        }
      ;(!i || (i && !i.skipNormalize)) &&
        (n && s.scheme !== void 0 && (s.scheme = unescape(s.scheme)),
        n && s.userinfo !== void 0 && (s.userinfo = unescape(s.userinfo)),
        n && s.host !== void 0 && (s.host = unescape(s.host)),
        s.path !== void 0 &&
          s.path.length &&
          (s.path = escape(unescape(s.path))),
        s.fragment !== void 0 &&
          s.fragment.length &&
          (s.fragment = encodeURI(decodeURIComponent(s.fragment)))),
        i && i.parse && i.parse(s, r)
    } else s.error = s.error || "URI can not be parsed."
    return s
  }
  var Br = {
    SCHEMES: Xr,
    normalize: gu,
    resolve: $u,
    resolveComponents: lo,
    equal: vu,
    serialize: ae,
    parse: he,
  }
  zt.exports = Br
  zt.exports.default = Br
  zt.exports.fastUri = Br
})
var po = _((Yr) => {
  "use strict"
  Object.defineProperty(Yr, "__esModule", { value: !0 })
  var ho = fo()
  ho.code = 'require("ajv/dist/runtime/uri").default'
  Yr.default = ho
})
var bo = _((V) => {
  "use strict"
  Object.defineProperty(V, "__esModule", { value: !0 })
  V.CodeGen = V.Name = V.nil = V.stringify = V.str = V._ = V.KeywordCxt = void 0
  var Pu = it()
  Object.defineProperty(V, "KeywordCxt", {
    enumerable: !0,
    get: function () {
      return Pu.KeywordCxt
    },
  })
  var Ke = P()
  Object.defineProperty(V, "_", {
    enumerable: !0,
    get: function () {
      return Ke._
    },
  })
  Object.defineProperty(V, "str", {
    enumerable: !0,
    get: function () {
      return Ke.str
    },
  })
  Object.defineProperty(V, "stringify", {
    enumerable: !0,
    get: function () {
      return Ke.stringify
    },
  })
  Object.defineProperty(V, "nil", {
    enumerable: !0,
    get: function () {
      return Ke.nil
    },
  })
  Object.defineProperty(V, "Name", {
    enumerable: !0,
    get: function () {
      return Ke.Name
    },
  })
  Object.defineProperty(V, "CodeGen", {
    enumerable: !0,
    get: function () {
      return Ke.CodeGen
    },
  })
  var Su = Ct(),
    $o = ct(),
    Nu = kr(),
    lt = At(),
    qu = P(),
    dt = nt(),
    Ut = st(),
    es = I(),
    mo = Jn(),
    ku = po(),
    vo = (t, e) => new RegExp(t, e)
  vo.code = "new RegExp"
  var ju = ["removeAdditional", "useDefaults", "coerceTypes"],
    Ou = new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error",
    ]),
    Iu = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs:
        "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode:
        "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats:
        "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now.",
    },
    Ru = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode:
        '"minLength"/"maxLength" account for unicode characters by default.',
    },
    yo = 200
  function Tu(t) {
    var e,
      r,
      s,
      n,
      o,
      a,
      i,
      c,
      l,
      u,
      d,
      y,
      m,
      h,
      f,
      p,
      g,
      k,
      N,
      C,
      w,
      se,
      ce,
      rr,
      sr
    let Je = t.strict,
      nr = (e = t.code) === null || e === void 0 ? void 0 : e.optimize,
      Hs = nr === !0 || nr === void 0 ? 1 : nr || 0,
      Gs =
        (s = (r = t.code) === null || r === void 0 ? void 0 : r.regExp) !==
          null && s !== void 0
          ? s
          : vo,
      Oa = (n = t.uriResolver) !== null && n !== void 0 ? n : ku.default
    return {
      strictSchema:
        (a = (o = t.strictSchema) !== null && o !== void 0 ? o : Je) !== null &&
        a !== void 0
          ? a
          : !0,
      strictNumbers:
        (c = (i = t.strictNumbers) !== null && i !== void 0 ? i : Je) !==
          null && c !== void 0
          ? c
          : !0,
      strictTypes:
        (u = (l = t.strictTypes) !== null && l !== void 0 ? l : Je) !== null &&
        u !== void 0
          ? u
          : "log",
      strictTuples:
        (y = (d = t.strictTuples) !== null && d !== void 0 ? d : Je) !== null &&
        y !== void 0
          ? y
          : "log",
      strictRequired:
        (h = (m = t.strictRequired) !== null && m !== void 0 ? m : Je) !==
          null && h !== void 0
          ? h
          : !1,
      code: t.code
        ? { ...t.code, optimize: Hs, regExp: Gs }
        : { optimize: Hs, regExp: Gs },
      loopRequired: (f = t.loopRequired) !== null && f !== void 0 ? f : yo,
      loopEnum: (p = t.loopEnum) !== null && p !== void 0 ? p : yo,
      meta: (g = t.meta) !== null && g !== void 0 ? g : !0,
      messages: (k = t.messages) !== null && k !== void 0 ? k : !0,
      inlineRefs: (N = t.inlineRefs) !== null && N !== void 0 ? N : !0,
      schemaId: (C = t.schemaId) !== null && C !== void 0 ? C : "$id",
      addUsedSchema: (w = t.addUsedSchema) !== null && w !== void 0 ? w : !0,
      validateSchema:
        (se = t.validateSchema) !== null && se !== void 0 ? se : !0,
      validateFormats:
        (ce = t.validateFormats) !== null && ce !== void 0 ? ce : !0,
      unicodeRegExp: (rr = t.unicodeRegExp) !== null && rr !== void 0 ? rr : !0,
      int32range: (sr = t.int32range) !== null && sr !== void 0 ? sr : !0,
      uriResolver: Oa,
    }
  }
  var ft = class {
    constructor(e = {}) {
      ;(this.schemas = {}),
        (this.refs = {}),
        (this.formats = {}),
        (this._compilations = new Set()),
        (this._loading = {}),
        (this._cache = new Map()),
        (e = this.opts = { ...e, ...Tu(e) })
      let { es5: r, lines: s } = this.opts.code
      ;(this.scope = new qu.ValueScope({
        scope: {},
        prefixes: Ou,
        es5: r,
        lines: s,
      })),
        (this.logger = zu(e.logger))
      let n = e.validateFormats
      ;(e.validateFormats = !1),
        (this.RULES = (0, Nu.getRules)()),
        _o.call(this, Iu, e, "NOT SUPPORTED"),
        _o.call(this, Ru, e, "DEPRECATED", "warn"),
        (this._metaOpts = Du.call(this)),
        e.formats && Mu.call(this),
        this._addVocabularies(),
        this._addDefaultMetaSchema(),
        e.keywords && Au.call(this, e.keywords),
        typeof e.meta == "object" && this.addMetaSchema(e.meta),
        Cu.call(this),
        (e.validateFormats = n)
    }
    _addVocabularies() {
      this.addKeyword("$async")
    }
    _addDefaultMetaSchema() {
      let { $data: e, meta: r, schemaId: s } = this.opts,
        n = mo
      s === "id" && ((n = { ...mo }), (n.id = n.$id), delete n.$id),
        r && e && this.addMetaSchema(n, n[s], !1)
    }
    defaultMeta() {
      let { meta: e, schemaId: r } = this.opts
      return (this.opts.defaultMeta = typeof e == "object" ? e[r] || e : void 0)
    }
    validate(e, r) {
      let s
      if (typeof e == "string") {
        if (((s = this.getSchema(e)), !s))
          throw new Error(`no schema with key or ref "${e}"`)
      } else s = this.compile(e)
      let n = s(r)
      return "$async" in s || (this.errors = s.errors), n
    }
    compile(e, r) {
      let s = this._addSchema(e, r)
      return s.validate || this._compileSchemaEnv(s)
    }
    compileAsync(e, r) {
      if (typeof this.opts.loadSchema != "function")
        throw new Error("options.loadSchema should be a function")
      let { loadSchema: s } = this.opts
      return n.call(this, e, r)
      async function n(u, d) {
        await o.call(this, u.$schema)
        let y = this._addSchema(u, d)
        return y.validate || a.call(this, y)
      }
      async function o(u) {
        u && !this.getSchema(u) && (await n.call(this, { $ref: u }, !0))
      }
      async function a(u) {
        try {
          return this._compileSchemaEnv(u)
        } catch (d) {
          if (!(d instanceof $o.default)) throw d
          return (
            i.call(this, d),
            await c.call(this, d.missingSchema),
            a.call(this, u)
          )
        }
      }
      function i({ missingSchema: u, missingRef: d }) {
        if (this.refs[u])
          throw new Error(
            `AnySchema ${u} is loaded but ${d} cannot be resolved`,
          )
      }
      async function c(u) {
        let d = await l.call(this, u)
        this.refs[u] || (await o.call(this, d.$schema)),
          this.refs[u] || this.addSchema(d, u, r)
      }
      async function l(u) {
        let d = this._loading[u]
        if (d) return d
        try {
          return await (this._loading[u] = s(u))
        } finally {
          delete this._loading[u]
        }
      }
    }
    addSchema(e, r, s, n = this.opts.validateSchema) {
      if (Array.isArray(e)) {
        for (let a of e) this.addSchema(a, void 0, s, n)
        return this
      }
      let o
      if (typeof e == "object") {
        let { schemaId: a } = this.opts
        if (((o = e[a]), o !== void 0 && typeof o != "string"))
          throw new Error(`schema ${a} must be string`)
      }
      return (
        (r = (0, dt.normalizeId)(r || o)),
        this._checkUnique(r),
        (this.schemas[r] = this._addSchema(e, s, r, n, !0)),
        this
      )
    }
    addMetaSchema(e, r, s = this.opts.validateSchema) {
      return this.addSchema(e, r, !0, s), this
    }
    validateSchema(e, r) {
      if (typeof e == "boolean") return !0
      let s
      if (((s = e.$schema), s !== void 0 && typeof s != "string"))
        throw new Error("$schema must be a string")
      if (((s = s || this.opts.defaultMeta || this.defaultMeta()), !s))
        return (
          this.logger.warn("meta-schema not available"),
          (this.errors = null),
          !0
        )
      let n = this.validate(s, e)
      if (!n && r) {
        let o = "schema is invalid: " + this.errorsText()
        if (this.opts.validateSchema === "log") this.logger.error(o)
        else throw new Error(o)
      }
      return n
    }
    getSchema(e) {
      let r
      for (; typeof (r = go.call(this, e)) == "string"; ) e = r
      if (r === void 0) {
        let { schemaId: s } = this.opts,
          n = new lt.SchemaEnv({ schema: {}, schemaId: s })
        if (((r = lt.resolveSchema.call(this, n, e)), !r)) return
        this.refs[e] = r
      }
      return r.validate || this._compileSchemaEnv(r)
    }
    removeSchema(e) {
      if (e instanceof RegExp)
        return (
          this._removeAllSchemas(this.schemas, e),
          this._removeAllSchemas(this.refs, e),
          this
        )
      switch (typeof e) {
        case "undefined":
          return (
            this._removeAllSchemas(this.schemas),
            this._removeAllSchemas(this.refs),
            this._cache.clear(),
            this
          )
        case "string": {
          let r = go.call(this, e)
          return (
            typeof r == "object" && this._cache.delete(r.schema),
            delete this.schemas[e],
            delete this.refs[e],
            this
          )
        }
        case "object": {
          let r = e
          this._cache.delete(r)
          let s = e[this.opts.schemaId]
          return (
            s &&
              ((s = (0, dt.normalizeId)(s)),
              delete this.schemas[s],
              delete this.refs[s]),
            this
          )
        }
        default:
          throw new Error("ajv.removeSchema: invalid parameter")
      }
    }
    addVocabulary(e) {
      for (let r of e) this.addKeyword(r)
      return this
    }
    addKeyword(e, r) {
      let s
      if (typeof e == "string")
        (s = e),
          typeof r == "object" &&
            (this.logger.warn(
              "these parameters are deprecated, see docs for addKeyword",
            ),
            (r.keyword = s))
      else if (typeof e == "object" && r === void 0) {
        if (((r = e), (s = r.keyword), Array.isArray(s) && !s.length))
          throw new Error(
            "addKeywords: keyword must be string or non-empty array",
          )
      } else throw new Error("invalid addKeywords parameters")
      if ((Ku.call(this, s, r), !r))
        return (0, es.eachItem)(s, (o) => Zr.call(this, o)), this
      Lu.call(this, r)
      let n = {
        ...r,
        type: (0, Ut.getJSONTypes)(r.type),
        schemaType: (0, Ut.getJSONTypes)(r.schemaType),
      }
      return (
        (0, es.eachItem)(
          s,
          n.type.length === 0
            ? (o) => Zr.call(this, o, n)
            : (o) => n.type.forEach((a) => Zr.call(this, o, n, a)),
        ),
        this
      )
    }
    getKeyword(e) {
      let r = this.RULES.all[e]
      return typeof r == "object" ? r.definition : !!r
    }
    removeKeyword(e) {
      let { RULES: r } = this
      delete r.keywords[e], delete r.all[e]
      for (let s of r.rules) {
        let n = s.rules.findIndex((o) => o.keyword === e)
        n >= 0 && s.rules.splice(n, 1)
      }
      return this
    }
    addFormat(e, r) {
      return (
        typeof r == "string" && (r = new RegExp(r)), (this.formats[e] = r), this
      )
    }
    errorsText(
      e = this.errors,
      { separator: r = ", ", dataVar: s = "data" } = {},
    ) {
      return !e || e.length === 0
        ? "No errors"
        : e
            .map((n) => `${s}${n.instancePath} ${n.message}`)
            .reduce((n, o) => n + r + o)
    }
    $dataMetaSchema(e, r) {
      let s = this.RULES.all
      e = JSON.parse(JSON.stringify(e))
      for (let n of r) {
        let o = n.split("/").slice(1),
          a = e
        for (let i of o) a = a[i]
        for (let i in s) {
          let c = s[i]
          if (typeof c != "object") continue
          let { $data: l } = c.definition,
            u = a[i]
          l && u && (a[i] = wo(u))
        }
      }
      return e
    }
    _removeAllSchemas(e, r) {
      for (let s in e) {
        let n = e[s]
        ;(!r || r.test(s)) &&
          (typeof n == "string"
            ? delete e[s]
            : n && !n.meta && (this._cache.delete(n.schema), delete e[s]))
      }
    }
    _addSchema(
      e,
      r,
      s,
      n = this.opts.validateSchema,
      o = this.opts.addUsedSchema,
    ) {
      let a,
        { schemaId: i } = this.opts
      if (typeof e == "object") a = e[i]
      else {
        if (this.opts.jtd) throw new Error("schema must be object")
        if (typeof e != "boolean")
          throw new Error("schema must be object or boolean")
      }
      let c = this._cache.get(e)
      if (c !== void 0) return c
      s = (0, dt.normalizeId)(a || s)
      let l = dt.getSchemaRefs.call(this, e, s)
      return (
        (c = new lt.SchemaEnv({
          schema: e,
          schemaId: i,
          meta: r,
          baseId: s,
          localRefs: l,
        })),
        this._cache.set(c.schema, c),
        o &&
          !s.startsWith("#") &&
          (s && this._checkUnique(s), (this.refs[s] = c)),
        n && this.validateSchema(e, !0),
        c
      )
    }
    _checkUnique(e) {
      if (this.schemas[e] || this.refs[e])
        throw new Error(`schema with key or id "${e}" already exists`)
    }
    _compileSchemaEnv(e) {
      if (
        (e.meta ? this._compileMetaSchema(e) : lt.compileSchema.call(this, e),
        !e.validate)
      )
        throw new Error("ajv implementation error")
      return e.validate
    }
    _compileMetaSchema(e) {
      let r = this.opts
      this.opts = this._metaOpts
      try {
        lt.compileSchema.call(this, e)
      } finally {
        this.opts = r
      }
    }
  }
  ft.ValidationError = Su.default
  ft.MissingRefError = $o.default
  V.default = ft
  function _o(t, e, r, s = "error") {
    for (let n in t) {
      let o = n
      o in e && this.logger[s](`${r}: option ${n}. ${t[o]}`)
    }
  }
  function go(t) {
    return (t = (0, dt.normalizeId)(t)), this.schemas[t] || this.refs[t]
  }
  function Cu() {
    let t = this.opts.schemas
    if (t)
      if (Array.isArray(t)) this.addSchema(t)
      else for (let e in t) this.addSchema(t[e], e)
  }
  function Mu() {
    for (let t in this.opts.formats) {
      let e = this.opts.formats[t]
      e && this.addFormat(t, e)
    }
  }
  function Au(t) {
    if (Array.isArray(t)) {
      this.addVocabulary(t)
      return
    }
    this.logger.warn("keywords option as map is deprecated, pass array")
    for (let e in t) {
      let r = t[e]
      r.keyword || (r.keyword = e), this.addKeyword(r)
    }
  }
  function Du() {
    let t = { ...this.opts }
    for (let e of ju) delete t[e]
    return t
  }
  var Vu = { log() {}, warn() {}, error() {} }
  function zu(t) {
    if (t === !1) return Vu
    if (t === void 0) return console
    if (t.log && t.warn && t.error) return t
    throw new Error("logger must implement log, warn and error methods")
  }
  var Uu = /^[a-z_$][a-z0-9_$:-]*$/i
  function Ku(t, e) {
    let { RULES: r } = this
    if (
      ((0, es.eachItem)(t, (s) => {
        if (r.keywords[s]) throw new Error(`Keyword ${s} is already defined`)
        if (!Uu.test(s)) throw new Error(`Keyword ${s} has invalid name`)
      }),
      !!e && e.$data && !("code" in e || "validate" in e))
    )
      throw new Error('$data keyword must have "code" or "validate" function')
  }
  function Zr(t, e, r) {
    var s
    let n = e?.post
    if (r && n) throw new Error('keyword with "post" flag cannot have "type"')
    let { RULES: o } = this,
      a = n ? o.post : o.rules.find(({ type: c }) => c === r)
    if (
      (a || ((a = { type: r, rules: [] }), o.rules.push(a)),
      (o.keywords[t] = !0),
      !e)
    )
      return
    let i = {
      keyword: t,
      definition: {
        ...e,
        type: (0, Ut.getJSONTypes)(e.type),
        schemaType: (0, Ut.getJSONTypes)(e.schemaType),
      },
    }
    e.before ? Fu.call(this, a, i, e.before) : a.rules.push(i),
      (o.all[t] = i),
      (s = e.implements) === null ||
        s === void 0 ||
        s.forEach((c) => this.addKeyword(c))
  }
  function Fu(t, e, r) {
    let s = t.rules.findIndex((n) => n.keyword === r)
    s >= 0
      ? t.rules.splice(s, 0, e)
      : (t.rules.push(e), this.logger.warn(`rule ${r} is not defined`))
  }
  function Lu(t) {
    let { metaSchema: e } = t
    e !== void 0 &&
      (t.$data && this.opts.$data && (e = wo(e)),
      (t.validateSchema = this.compile(e, !0)))
  }
  var xu = {
    $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
  }
  function wo(t) {
    return { anyOf: [t, xu] }
  }
})
var Eo = _((ts) => {
  "use strict"
  Object.defineProperty(ts, "__esModule", { value: !0 })
  var Hu = {
    keyword: "id",
    code() {
      throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID')
    },
  }
  ts.default = Hu
})
var qo = _((Oe) => {
  "use strict"
  Object.defineProperty(Oe, "__esModule", { value: !0 })
  Oe.callRef = Oe.getValidate = void 0
  var Gu = ct(),
    Po = X(),
    W = P(),
    Fe = de(),
    So = At(),
    Kt = I(),
    Ju = {
      keyword: "$ref",
      schemaType: "string",
      code(t) {
        let { gen: e, schema: r, it: s } = t,
          { baseId: n, schemaEnv: o, validateName: a, opts: i, self: c } = s,
          { root: l } = o
        if ((r === "#" || r === "#/") && n === l.baseId) return d()
        let u = So.resolveRef.call(c, l, n, r)
        if (u === void 0) throw new Gu.default(s.opts.uriResolver, n, r)
        if (u instanceof So.SchemaEnv) return y(u)
        return m(u)
        function d() {
          if (o === l) return Ft(t, a, o, o.$async)
          let h = e.scopeValue("root", { ref: l })
          return Ft(t, (0, W._)`${h}.validate`, l, l.$async)
        }
        function y(h) {
          let f = No(t, h)
          Ft(t, f, h, h.$async)
        }
        function m(h) {
          let f = e.scopeValue(
              "schema",
              i.code.source === !0
                ? { ref: h, code: (0, W.stringify)(h) }
                : { ref: h },
            ),
            p = e.name("valid"),
            g = t.subschema(
              {
                schema: h,
                dataTypes: [],
                schemaPath: W.nil,
                topSchemaRef: f,
                errSchemaPath: r,
              },
              p,
            )
          t.mergeEvaluated(g), t.ok(p)
        }
      },
    }
  function No(t, e) {
    let { gen: r } = t
    return e.validate
      ? r.scopeValue("validate", { ref: e.validate })
      : (0, W._)`${r.scopeValue("wrapper", { ref: e })}.validate`
  }
  Oe.getValidate = No
  function Ft(t, e, r, s) {
    let { gen: n, it: o } = t,
      { allErrors: a, schemaEnv: i, opts: c } = o,
      l = c.passContext ? Fe.default.this : W.nil
    s ? u() : d()
    function u() {
      if (!i.$async) throw new Error("async schema referenced by sync schema")
      let h = n.let("valid")
      n.try(
        () => {
          n.code((0, W._)`await ${(0, Po.callValidateCode)(t, e, l)}`),
            m(e),
            a || n.assign(h, !0)
        },
        (f) => {
          n.if((0, W._)`!(${f} instanceof ${o.ValidationError})`, () =>
            n.throw(f),
          ),
            y(f),
            a || n.assign(h, !1)
        },
      ),
        t.ok(h)
    }
    function d() {
      t.result(
        (0, Po.callValidateCode)(t, e, l),
        () => m(e),
        () => y(e),
      )
    }
    function y(h) {
      let f = (0, W._)`${h}.errors`
      n.assign(
        Fe.default.vErrors,
        (0,
        W._)`${Fe.default.vErrors} === null ? ${f} : ${Fe.default.vErrors}.concat(${f})`,
      ),
        n.assign(Fe.default.errors, (0, W._)`${Fe.default.vErrors}.length`)
    }
    function m(h) {
      var f
      if (!o.opts.unevaluated) return
      let p = (f = r?.validate) === null || f === void 0 ? void 0 : f.evaluated
      if (o.props !== !0)
        if (p && !p.dynamicProps)
          p.props !== void 0 &&
            (o.props = Kt.mergeEvaluated.props(n, p.props, o.props))
        else {
          let g = n.var("props", (0, W._)`${h}.evaluated.props`)
          o.props = Kt.mergeEvaluated.props(n, g, o.props, W.Name)
        }
      if (o.items !== !0)
        if (p && !p.dynamicItems)
          p.items !== void 0 &&
            (o.items = Kt.mergeEvaluated.items(n, p.items, o.items))
        else {
          let g = n.var("items", (0, W._)`${h}.evaluated.items`)
          o.items = Kt.mergeEvaluated.items(n, g, o.items, W.Name)
        }
    }
  }
  Oe.callRef = Ft
  Oe.default = Ju
})
var ko = _((rs) => {
  "use strict"
  Object.defineProperty(rs, "__esModule", { value: !0 })
  var Wu = Eo(),
    Qu = qo(),
    Xu = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      Wu.default,
      Qu.default,
    ]
  rs.default = Xu
})
var jo = _((ss) => {
  "use strict"
  Object.defineProperty(ss, "__esModule", { value: !0 })
  var Lt = P(),
    ve = Lt.operators,
    xt = {
      maximum: { okStr: "<=", ok: ve.LTE, fail: ve.GT },
      minimum: { okStr: ">=", ok: ve.GTE, fail: ve.LT },
      exclusiveMaximum: { okStr: "<", ok: ve.LT, fail: ve.GTE },
      exclusiveMinimum: { okStr: ">", ok: ve.GT, fail: ve.LTE },
    },
    Bu = {
      message: ({ keyword: t, schemaCode: e }) =>
        (0, Lt.str)`must be ${xt[t].okStr} ${e}`,
      params: ({ keyword: t, schemaCode: e }) =>
        (0, Lt._)`{comparison: ${xt[t].okStr}, limit: ${e}}`,
    },
    Yu = {
      keyword: Object.keys(xt),
      type: "number",
      schemaType: "number",
      $data: !0,
      error: Bu,
      code(t) {
        let { keyword: e, data: r, schemaCode: s } = t
        t.fail$data((0, Lt._)`${r} ${xt[e].fail} ${s} || isNaN(${r})`)
      },
    }
  ss.default = Yu
})
var Oo = _((ns) => {
  "use strict"
  Object.defineProperty(ns, "__esModule", { value: !0 })
  var ht = P(),
    Zu = {
      message: ({ schemaCode: t }) => (0, ht.str)`must be multiple of ${t}`,
      params: ({ schemaCode: t }) => (0, ht._)`{multipleOf: ${t}}`,
    },
    el = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: !0,
      error: Zu,
      code(t) {
        let { gen: e, data: r, schemaCode: s, it: n } = t,
          o = n.opts.multipleOfPrecision,
          a = e.let("res"),
          i = o
            ? (0, ht._)`Math.abs(Math.round(${a}) - ${a}) > 1e-${o}`
            : (0, ht._)`${a} !== parseInt(${a})`
        t.fail$data((0, ht._)`(${s} === 0 || (${a} = ${r}/${s}, ${i}))`)
      },
    }
  ns.default = el
})
var Ro = _((os) => {
  "use strict"
  Object.defineProperty(os, "__esModule", { value: !0 })
  function Io(t) {
    let e = t.length,
      r = 0,
      s = 0,
      n
    for (; s < e; )
      r++,
        (n = t.charCodeAt(s++)),
        n >= 55296 &&
          n <= 56319 &&
          s < e &&
          ((n = t.charCodeAt(s)), (n & 64512) === 56320 && s++)
    return r
  }
  os.default = Io
  Io.code = 'require("ajv/dist/runtime/ucs2length").default'
})
var To = _((as) => {
  "use strict"
  Object.defineProperty(as, "__esModule", { value: !0 })
  var Ie = P(),
    tl = I(),
    rl = Ro(),
    sl = {
      message({ keyword: t, schemaCode: e }) {
        let r = t === "maxLength" ? "more" : "fewer"
        return (0, Ie.str)`must NOT have ${r} than ${e} characters`
      },
      params: ({ schemaCode: t }) => (0, Ie._)`{limit: ${t}}`,
    },
    nl = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: !0,
      error: sl,
      code(t) {
        let { keyword: e, data: r, schemaCode: s, it: n } = t,
          o = e === "maxLength" ? Ie.operators.GT : Ie.operators.LT,
          a =
            n.opts.unicode === !1
              ? (0, Ie._)`${r}.length`
              : (0, Ie._)`${(0, tl.useFunc)(t.gen, rl.default)}(${r})`
        t.fail$data((0, Ie._)`${a} ${o} ${s}`)
      },
    }
  as.default = nl
})
var Co = _((is) => {
  "use strict"
  Object.defineProperty(is, "__esModule", { value: !0 })
  var ol = X(),
    Ht = P(),
    al = {
      message: ({ schemaCode: t }) => (0, Ht.str)`must match pattern "${t}"`,
      params: ({ schemaCode: t }) => (0, Ht._)`{pattern: ${t}}`,
    },
    il = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: !0,
      error: al,
      code(t) {
        let { data: e, $data: r, schema: s, schemaCode: n, it: o } = t,
          a = o.opts.unicodeRegExp ? "u" : "",
          i = r ? (0, Ht._)`(new RegExp(${n}, ${a}))` : (0, ol.usePattern)(t, s)
        t.fail$data((0, Ht._)`!${i}.test(${e})`)
      },
    }
  is.default = il
})
var Mo = _((cs) => {
  "use strict"
  Object.defineProperty(cs, "__esModule", { value: !0 })
  var pt = P(),
    cl = {
      message({ keyword: t, schemaCode: e }) {
        let r = t === "maxProperties" ? "more" : "fewer"
        return (0, pt.str)`must NOT have ${r} than ${e} properties`
      },
      params: ({ schemaCode: t }) => (0, pt._)`{limit: ${t}}`,
    },
    ul = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: !0,
      error: cl,
      code(t) {
        let { keyword: e, data: r, schemaCode: s } = t,
          n = e === "maxProperties" ? pt.operators.GT : pt.operators.LT
        t.fail$data((0, pt._)`Object.keys(${r}).length ${n} ${s}`)
      },
    }
  cs.default = ul
})
var Ao = _((us) => {
  "use strict"
  Object.defineProperty(us, "__esModule", { value: !0 })
  var mt = X(),
    yt = P(),
    ll = I(),
    dl = {
      message: ({ params: { missingProperty: t } }) =>
        (0, yt.str)`must have required property '${t}'`,
      params: ({ params: { missingProperty: t } }) =>
        (0, yt._)`{missingProperty: ${t}}`,
    },
    fl = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: !0,
      error: dl,
      code(t) {
        let { gen: e, schema: r, schemaCode: s, data: n, $data: o, it: a } = t,
          { opts: i } = a
        if (!o && r.length === 0) return
        let c = r.length >= i.loopRequired
        if ((a.allErrors ? l() : u(), i.strictRequired)) {
          let m = t.parentSchema.properties,
            { definedProperties: h } = t.it
          for (let f of r)
            if (m?.[f] === void 0 && !h.has(f)) {
              let p = a.schemaEnv.baseId + a.errSchemaPath,
                g = `required property "${f}" is not defined at "${p}" (strictRequired)`
              ;(0, ll.checkStrictMode)(a, g, a.opts.strictRequired)
            }
        }
        function l() {
          if (c || o) t.block$data(yt.nil, d)
          else for (let m of r) (0, mt.checkReportMissingProp)(t, m)
        }
        function u() {
          let m = e.let("missing")
          if (c || o) {
            let h = e.let("valid", !0)
            t.block$data(h, () => y(m, h)), t.ok(h)
          } else
            e.if((0, mt.checkMissingProp)(t, r, m)),
              (0, mt.reportMissingProp)(t, m),
              e.else()
        }
        function d() {
          e.forOf("prop", s, (m) => {
            t.setParams({ missingProperty: m }),
              e.if((0, mt.noPropertyInData)(e, n, m, i.ownProperties), () =>
                t.error(),
              )
          })
        }
        function y(m, h) {
          t.setParams({ missingProperty: m }),
            e.forOf(
              m,
              s,
              () => {
                e.assign(h, (0, mt.propertyInData)(e, n, m, i.ownProperties)),
                  e.if((0, yt.not)(h), () => {
                    t.error(), e.break()
                  })
              },
              yt.nil,
            )
        }
      },
    }
  us.default = fl
})
var Do = _((ls) => {
  "use strict"
  Object.defineProperty(ls, "__esModule", { value: !0 })
  var _t = P(),
    hl = {
      message({ keyword: t, schemaCode: e }) {
        let r = t === "maxItems" ? "more" : "fewer"
        return (0, _t.str)`must NOT have ${r} than ${e} items`
      },
      params: ({ schemaCode: t }) => (0, _t._)`{limit: ${t}}`,
    },
    pl = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: !0,
      error: hl,
      code(t) {
        let { keyword: e, data: r, schemaCode: s } = t,
          n = e === "maxItems" ? _t.operators.GT : _t.operators.LT
        t.fail$data((0, _t._)`${r}.length ${n} ${s}`)
      },
    }
  ls.default = pl
})
var Gt = _((ds) => {
  "use strict"
  Object.defineProperty(ds, "__esModule", { value: !0 })
  var Vo = Ar()
  Vo.code = 'require("ajv/dist/runtime/equal").default'
  ds.default = Vo
})
var zo = _((hs) => {
  "use strict"
  Object.defineProperty(hs, "__esModule", { value: !0 })
  var fs = st(),
    z = P(),
    ml = I(),
    yl = Gt(),
    _l = {
      message: ({ params: { i: t, j: e } }) =>
        (0,
        z.str)`must NOT have duplicate items (items ## ${e} and ${t} are identical)`,
      params: ({ params: { i: t, j: e } }) => (0, z._)`{i: ${t}, j: ${e}}`,
    },
    gl = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: !0,
      error: _l,
      code(t) {
        let {
          gen: e,
          data: r,
          $data: s,
          schema: n,
          parentSchema: o,
          schemaCode: a,
          it: i,
        } = t
        if (!s && !n) return
        let c = e.let("valid"),
          l = o.items ? (0, fs.getSchemaTypes)(o.items) : []
        t.block$data(c, u, (0, z._)`${a} === false`), t.ok(c)
        function u() {
          let h = e.let("i", (0, z._)`${r}.length`),
            f = e.let("j")
          t.setParams({ i: h, j: f }),
            e.assign(c, !0),
            e.if((0, z._)`${h} > 1`, () => (d() ? y : m)(h, f))
        }
        function d() {
          return l.length > 0 && !l.some((h) => h === "object" || h === "array")
        }
        function y(h, f) {
          let p = e.name("item"),
            g = (0, fs.checkDataTypes)(
              l,
              p,
              i.opts.strictNumbers,
              fs.DataType.Wrong,
            ),
            k = e.const("indices", (0, z._)`{}`)
          e.for((0, z._)`;${h}--;`, () => {
            e.let(p, (0, z._)`${r}[${h}]`),
              e.if(g, (0, z._)`continue`),
              l.length > 1 &&
                e.if((0, z._)`typeof ${p} == "string"`, (0, z._)`${p} += "_"`),
              e
                .if((0, z._)`typeof ${k}[${p}] == "number"`, () => {
                  e.assign(f, (0, z._)`${k}[${p}]`),
                    t.error(),
                    e.assign(c, !1).break()
                })
                .code((0, z._)`${k}[${p}] = ${h}`)
          })
        }
        function m(h, f) {
          let p = (0, ml.useFunc)(e, yl.default),
            g = e.name("outer")
          e.label(g).for((0, z._)`;${h}--;`, () =>
            e.for((0, z._)`${f} = ${h}; ${f}--;`, () =>
              e.if((0, z._)`${p}(${r}[${h}], ${r}[${f}])`, () => {
                t.error(), e.assign(c, !1).break(g)
              }),
            ),
          )
        }
      },
    }
  hs.default = gl
})
var Uo = _((ms) => {
  "use strict"
  Object.defineProperty(ms, "__esModule", { value: !0 })
  var ps = P(),
    $l = I(),
    vl = Gt(),
    wl = {
      message: "must be equal to constant",
      params: ({ schemaCode: t }) => (0, ps._)`{allowedValue: ${t}}`,
    },
    bl = {
      keyword: "const",
      $data: !0,
      error: wl,
      code(t) {
        let { gen: e, data: r, $data: s, schemaCode: n, schema: o } = t
        s || (o && typeof o == "object")
          ? t.fail$data(
              (0, ps._)`!${(0, $l.useFunc)(e, vl.default)}(${r}, ${n})`,
            )
          : t.fail((0, ps._)`${o} !== ${r}`)
      },
    }
  ms.default = bl
})
var Ko = _((ys) => {
  "use strict"
  Object.defineProperty(ys, "__esModule", { value: !0 })
  var gt = P(),
    El = I(),
    Pl = Gt(),
    Sl = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode: t }) => (0, gt._)`{allowedValues: ${t}}`,
    },
    Nl = {
      keyword: "enum",
      schemaType: "array",
      $data: !0,
      error: Sl,
      code(t) {
        let { gen: e, data: r, $data: s, schema: n, schemaCode: o, it: a } = t
        if (!s && n.length === 0)
          throw new Error("enum must have non-empty array")
        let i = n.length >= a.opts.loopEnum,
          c,
          l = () => c ?? (c = (0, El.useFunc)(e, Pl.default)),
          u
        if (i || s) (u = e.let("valid")), t.block$data(u, d)
        else {
          if (!Array.isArray(n)) throw new Error("ajv implementation error")
          let m = e.const("vSchema", o)
          u = (0, gt.or)(...n.map((h, f) => y(m, f)))
        }
        t.pass(u)
        function d() {
          e.assign(u, !1),
            e.forOf("v", o, (m) =>
              e.if((0, gt._)`${l()}(${r}, ${m})`, () =>
                e.assign(u, !0).break(),
              ),
            )
        }
        function y(m, h) {
          let f = n[h]
          return typeof f == "object" && f !== null
            ? (0, gt._)`${l()}(${r}, ${m}[${h}])`
            : (0, gt._)`${r} === ${f}`
        }
      },
    }
  ys.default = Nl
})
var Fo = _((_s) => {
  "use strict"
  Object.defineProperty(_s, "__esModule", { value: !0 })
  var ql = jo(),
    kl = Oo(),
    jl = To(),
    Ol = Co(),
    Il = Mo(),
    Rl = Ao(),
    Tl = Do(),
    Cl = zo(),
    Ml = Uo(),
    Al = Ko(),
    Dl = [
      ql.default,
      kl.default,
      jl.default,
      Ol.default,
      Il.default,
      Rl.default,
      Tl.default,
      Cl.default,
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      Ml.default,
      Al.default,
    ]
  _s.default = Dl
})
var $s = _(($t) => {
  "use strict"
  Object.defineProperty($t, "__esModule", { value: !0 })
  $t.validateAdditionalItems = void 0
  var Re = P(),
    gs = I(),
    Vl = {
      message: ({ params: { len: t } }) =>
        (0, Re.str)`must NOT have more than ${t} items`,
      params: ({ params: { len: t } }) => (0, Re._)`{limit: ${t}}`,
    },
    zl = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error: Vl,
      code(t) {
        let { parentSchema: e, it: r } = t,
          { items: s } = e
        if (!Array.isArray(s)) {
          ;(0, gs.checkStrictMode)(
            r,
            '"additionalItems" is ignored when "items" is not an array of schemas',
          )
          return
        }
        Lo(t, s)
      },
    }
  function Lo(t, e) {
    let { gen: r, schema: s, data: n, keyword: o, it: a } = t
    a.items = !0
    let i = r.const("len", (0, Re._)`${n}.length`)
    if (s === !1)
      t.setParams({ len: e.length }), t.pass((0, Re._)`${i} <= ${e.length}`)
    else if (typeof s == "object" && !(0, gs.alwaysValidSchema)(a, s)) {
      let l = r.var("valid", (0, Re._)`${i} <= ${e.length}`)
      r.if((0, Re.not)(l), () => c(l)), t.ok(l)
    }
    function c(l) {
      r.forRange("i", e.length, i, (u) => {
        t.subschema({ keyword: o, dataProp: u, dataPropType: gs.Type.Num }, l),
          a.allErrors || r.if((0, Re.not)(l), () => r.break())
      })
    }
  }
  $t.validateAdditionalItems = Lo
  $t.default = zl
})
var vs = _((vt) => {
  "use strict"
  Object.defineProperty(vt, "__esModule", { value: !0 })
  vt.validateTuple = void 0
  var xo = P(),
    Jt = I(),
    Ul = X(),
    Kl = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(t) {
        let { schema: e, it: r } = t
        if (Array.isArray(e)) return Ho(t, "additionalItems", e)
        ;(r.items = !0),
          !(0, Jt.alwaysValidSchema)(r, e) && t.ok((0, Ul.validateArray)(t))
      },
    }
  function Ho(t, e, r = t.schema) {
    let { gen: s, parentSchema: n, data: o, keyword: a, it: i } = t
    u(n),
      i.opts.unevaluated &&
        r.length &&
        i.items !== !0 &&
        (i.items = Jt.mergeEvaluated.items(s, r.length, i.items))
    let c = s.name("valid"),
      l = s.const("len", (0, xo._)`${o}.length`)
    r.forEach((d, y) => {
      ;(0, Jt.alwaysValidSchema)(i, d) ||
        (s.if((0, xo._)`${l} > ${y}`, () =>
          t.subschema({ keyword: a, schemaProp: y, dataProp: y }, c),
        ),
        t.ok(c))
    })
    function u(d) {
      let { opts: y, errSchemaPath: m } = i,
        h = r.length,
        f = h === d.minItems && (h === d.maxItems || d[e] === !1)
      if (y.strictTuples && !f) {
        let p = `"${a}" is ${h}-tuple, but minItems or maxItems/${e} are not specified or different at path "${m}"`
        ;(0, Jt.checkStrictMode)(i, p, y.strictTuples)
      }
    }
  }
  vt.validateTuple = Ho
  vt.default = Kl
})
var Go = _((ws) => {
  "use strict"
  Object.defineProperty(ws, "__esModule", { value: !0 })
  var Fl = vs(),
    Ll = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (t) => (0, Fl.validateTuple)(t, "items"),
    }
  ws.default = Ll
})
var Wo = _((bs) => {
  "use strict"
  Object.defineProperty(bs, "__esModule", { value: !0 })
  var Jo = P(),
    xl = I(),
    Hl = X(),
    Gl = $s(),
    Jl = {
      message: ({ params: { len: t } }) =>
        (0, Jo.str)`must NOT have more than ${t} items`,
      params: ({ params: { len: t } }) => (0, Jo._)`{limit: ${t}}`,
    },
    Wl = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error: Jl,
      code(t) {
        let { schema: e, parentSchema: r, it: s } = t,
          { prefixItems: n } = r
        ;(s.items = !0),
          !(0, xl.alwaysValidSchema)(s, e) &&
            (n
              ? (0, Gl.validateAdditionalItems)(t, n)
              : t.ok((0, Hl.validateArray)(t)))
      },
    }
  bs.default = Wl
})
var Qo = _((Es) => {
  "use strict"
  Object.defineProperty(Es, "__esModule", { value: !0 })
  var Y = P(),
    Wt = I(),
    Ql = {
      message: ({ params: { min: t, max: e } }) =>
        e === void 0
          ? (0, Y.str)`must contain at least ${t} valid item(s)`
          : (0,
            Y.str)`must contain at least ${t} and no more than ${e} valid item(s)`,
      params: ({ params: { min: t, max: e } }) =>
        e === void 0
          ? (0, Y._)`{minContains: ${t}}`
          : (0, Y._)`{minContains: ${t}, maxContains: ${e}}`,
    },
    Xl = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: !0,
      error: Ql,
      code(t) {
        let { gen: e, schema: r, parentSchema: s, data: n, it: o } = t,
          a,
          i,
          { minContains: c, maxContains: l } = s
        o.opts.next ? ((a = c === void 0 ? 1 : c), (i = l)) : (a = 1)
        let u = e.const("len", (0, Y._)`${n}.length`)
        if ((t.setParams({ min: a, max: i }), i === void 0 && a === 0)) {
          ;(0, Wt.checkStrictMode)(
            o,
            '"minContains" == 0 without "maxContains": "contains" keyword ignored',
          )
          return
        }
        if (i !== void 0 && a > i) {
          ;(0, Wt.checkStrictMode)(
            o,
            '"minContains" > "maxContains" is always invalid',
          ),
            t.fail()
          return
        }
        if ((0, Wt.alwaysValidSchema)(o, r)) {
          let f = (0, Y._)`${u} >= ${a}`
          i !== void 0 && (f = (0, Y._)`${f} && ${u} <= ${i}`), t.pass(f)
          return
        }
        o.items = !0
        let d = e.name("valid")
        i === void 0 && a === 1
          ? m(d, () => e.if(d, () => e.break()))
          : a === 0
            ? (e.let(d, !0), i !== void 0 && e.if((0, Y._)`${n}.length > 0`, y))
            : (e.let(d, !1), y()),
          t.result(d, () => t.reset())
        function y() {
          let f = e.name("_valid"),
            p = e.let("count", 0)
          m(f, () => e.if(f, () => h(p)))
        }
        function m(f, p) {
          e.forRange("i", 0, u, (g) => {
            t.subschema(
              {
                keyword: "contains",
                dataProp: g,
                dataPropType: Wt.Type.Num,
                compositeRule: !0,
              },
              f,
            ),
              p()
          })
        }
        function h(f) {
          e.code((0, Y._)`${f}++`),
            i === void 0
              ? e.if((0, Y._)`${f} >= ${a}`, () => e.assign(d, !0).break())
              : (e.if((0, Y._)`${f} > ${i}`, () => e.assign(d, !1).break()),
                a === 1
                  ? e.assign(d, !0)
                  : e.if((0, Y._)`${f} >= ${a}`, () => e.assign(d, !0)))
        }
      },
    }
  Es.default = Xl
})
var Yo = _((ie) => {
  "use strict"
  Object.defineProperty(ie, "__esModule", { value: !0 })
  ie.validateSchemaDeps = ie.validatePropertyDeps = ie.error = void 0
  var Ps = P(),
    Bl = I(),
    wt = X()
  ie.error = {
    message: ({ params: { property: t, depsCount: e, deps: r } }) => {
      let s = e === 1 ? "property" : "properties"
      return (0, Ps.str)`must have ${s} ${r} when property ${t} is present`
    },
    params: ({
      params: { property: t, depsCount: e, deps: r, missingProperty: s },
    }) => (0, Ps._)`{property: ${t},
    missingProperty: ${s},
    depsCount: ${e},
    deps: ${r}}`,
  }
  var Yl = {
    keyword: "dependencies",
    type: "object",
    schemaType: "object",
    error: ie.error,
    code(t) {
      let [e, r] = Zl(t)
      Xo(t, e), Bo(t, r)
    },
  }
  function Zl({ schema: t }) {
    let e = {},
      r = {}
    for (let s in t) {
      if (s === "__proto__") continue
      let n = Array.isArray(t[s]) ? e : r
      n[s] = t[s]
    }
    return [e, r]
  }
  function Xo(t, e = t.schema) {
    let { gen: r, data: s, it: n } = t
    if (Object.keys(e).length === 0) return
    let o = r.let("missing")
    for (let a in e) {
      let i = e[a]
      if (i.length === 0) continue
      let c = (0, wt.propertyInData)(r, s, a, n.opts.ownProperties)
      t.setParams({ property: a, depsCount: i.length, deps: i.join(", ") }),
        n.allErrors
          ? r.if(c, () => {
              for (let l of i) (0, wt.checkReportMissingProp)(t, l)
            })
          : (r.if((0, Ps._)`${c} && (${(0, wt.checkMissingProp)(t, i, o)})`),
            (0, wt.reportMissingProp)(t, o),
            r.else())
    }
  }
  ie.validatePropertyDeps = Xo
  function Bo(t, e = t.schema) {
    let { gen: r, data: s, keyword: n, it: o } = t,
      a = r.name("valid")
    for (let i in e)
      (0, Bl.alwaysValidSchema)(o, e[i]) ||
        (r.if(
          (0, wt.propertyInData)(r, s, i, o.opts.ownProperties),
          () => {
            let c = t.subschema({ keyword: n, schemaProp: i }, a)
            t.mergeValidEvaluated(c, a)
          },
          () => r.var(a, !0),
        ),
        t.ok(a))
  }
  ie.validateSchemaDeps = Bo
  ie.default = Yl
})
var ea = _((Ss) => {
  "use strict"
  Object.defineProperty(Ss, "__esModule", { value: !0 })
  var Zo = P(),
    ed = I(),
    td = {
      message: "property name must be valid",
      params: ({ params: t }) => (0, Zo._)`{propertyName: ${t.propertyName}}`,
    },
    rd = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error: td,
      code(t) {
        let { gen: e, schema: r, data: s, it: n } = t
        if ((0, ed.alwaysValidSchema)(n, r)) return
        let o = e.name("valid")
        e.forIn("key", s, (a) => {
          t.setParams({ propertyName: a }),
            t.subschema(
              {
                keyword: "propertyNames",
                data: a,
                dataTypes: ["string"],
                propertyName: a,
                compositeRule: !0,
              },
              o,
            ),
            e.if((0, Zo.not)(o), () => {
              t.error(!0), n.allErrors || e.break()
            })
        }),
          t.ok(o)
      },
    }
  Ss.default = rd
})
var qs = _((Ns) => {
  "use strict"
  Object.defineProperty(Ns, "__esModule", { value: !0 })
  var Qt = X(),
    re = P(),
    sd = de(),
    Xt = I(),
    nd = {
      message: "must NOT have additional properties",
      params: ({ params: t }) =>
        (0, re._)`{additionalProperty: ${t.additionalProperty}}`,
    },
    od = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: !0,
      trackErrors: !0,
      error: nd,
      code(t) {
        let {
          gen: e,
          schema: r,
          parentSchema: s,
          data: n,
          errsCount: o,
          it: a,
        } = t
        if (!o) throw new Error("ajv implementation error")
        let { allErrors: i, opts: c } = a
        if (
          ((a.props = !0),
          c.removeAdditional !== "all" && (0, Xt.alwaysValidSchema)(a, r))
        )
          return
        let l = (0, Qt.allSchemaProperties)(s.properties),
          u = (0, Qt.allSchemaProperties)(s.patternProperties)
        d(), t.ok((0, re._)`${o} === ${sd.default.errors}`)
        function d() {
          e.forIn("key", n, (p) => {
            !l.length && !u.length ? h(p) : e.if(y(p), () => h(p))
          })
        }
        function y(p) {
          let g
          if (l.length > 8) {
            let k = (0, Xt.schemaRefOrVal)(a, s.properties, "properties")
            g = (0, Qt.isOwnProperty)(e, k, p)
          } else
            l.length
              ? (g = (0, re.or)(...l.map((k) => (0, re._)`${p} === ${k}`)))
              : (g = re.nil)
          return (
            u.length &&
              (g = (0, re.or)(
                g,
                ...u.map(
                  (k) => (0, re._)`${(0, Qt.usePattern)(t, k)}.test(${p})`,
                ),
              )),
            (0, re.not)(g)
          )
        }
        function m(p) {
          e.code((0, re._)`delete ${n}[${p}]`)
        }
        function h(p) {
          if (
            c.removeAdditional === "all" ||
            (c.removeAdditional && r === !1)
          ) {
            m(p)
            return
          }
          if (r === !1) {
            t.setParams({ additionalProperty: p }), t.error(), i || e.break()
            return
          }
          if (typeof r == "object" && !(0, Xt.alwaysValidSchema)(a, r)) {
            let g = e.name("valid")
            c.removeAdditional === "failing"
              ? (f(p, g, !1),
                e.if((0, re.not)(g), () => {
                  t.reset(), m(p)
                }))
              : (f(p, g), i || e.if((0, re.not)(g), () => e.break()))
          }
        }
        function f(p, g, k) {
          let N = {
            keyword: "additionalProperties",
            dataProp: p,
            dataPropType: Xt.Type.Str,
          }
          k === !1 &&
            Object.assign(N, {
              compositeRule: !0,
              createErrors: !1,
              allErrors: !1,
            }),
            t.subschema(N, g)
        }
      },
    }
  Ns.default = od
})
var sa = _((js) => {
  "use strict"
  Object.defineProperty(js, "__esModule", { value: !0 })
  var ad = it(),
    ta = X(),
    ks = I(),
    ra = qs(),
    id = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(t) {
        let { gen: e, schema: r, parentSchema: s, data: n, it: o } = t
        o.opts.removeAdditional === "all" &&
          s.additionalProperties === void 0 &&
          ra.default.code(
            new ad.KeywordCxt(o, ra.default, "additionalProperties"),
          )
        let a = (0, ta.allSchemaProperties)(r)
        for (let d of a) o.definedProperties.add(d)
        o.opts.unevaluated &&
          a.length &&
          o.props !== !0 &&
          (o.props = ks.mergeEvaluated.props(e, (0, ks.toHash)(a), o.props))
        let i = a.filter((d) => !(0, ks.alwaysValidSchema)(o, r[d]))
        if (i.length === 0) return
        let c = e.name("valid")
        for (let d of i)
          l(d)
            ? u(d)
            : (e.if((0, ta.propertyInData)(e, n, d, o.opts.ownProperties)),
              u(d),
              o.allErrors || e.else().var(c, !0),
              e.endIf()),
            t.it.definedProperties.add(d),
            t.ok(c)
        function l(d) {
          return (
            o.opts.useDefaults && !o.compositeRule && r[d].default !== void 0
          )
        }
        function u(d) {
          t.subschema({ keyword: "properties", schemaProp: d, dataProp: d }, c)
        }
      },
    }
  js.default = id
})
var ia = _((Os) => {
  "use strict"
  Object.defineProperty(Os, "__esModule", { value: !0 })
  var na = X(),
    Bt = P(),
    oa = I(),
    aa = I(),
    cd = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(t) {
        let { gen: e, schema: r, data: s, parentSchema: n, it: o } = t,
          { opts: a } = o,
          i = (0, na.allSchemaProperties)(r),
          c = i.filter((f) => (0, oa.alwaysValidSchema)(o, r[f]))
        if (
          i.length === 0 ||
          (c.length === i.length && (!o.opts.unevaluated || o.props === !0))
        )
          return
        let l = a.strictSchema && !a.allowMatchingProperties && n.properties,
          u = e.name("valid")
        o.props !== !0 &&
          !(o.props instanceof Bt.Name) &&
          (o.props = (0, aa.evaluatedPropsToName)(e, o.props))
        let { props: d } = o
        y()
        function y() {
          for (let f of i)
            l && m(f), o.allErrors ? h(f) : (e.var(u, !0), h(f), e.if(u))
        }
        function m(f) {
          for (let p in l)
            new RegExp(f).test(p) &&
              (0, oa.checkStrictMode)(
                o,
                `property ${p} matches pattern ${f} (use allowMatchingProperties)`,
              )
        }
        function h(f) {
          e.forIn("key", s, (p) => {
            e.if((0, Bt._)`${(0, na.usePattern)(t, f)}.test(${p})`, () => {
              let g = c.includes(f)
              g ||
                t.subschema(
                  {
                    keyword: "patternProperties",
                    schemaProp: f,
                    dataProp: p,
                    dataPropType: aa.Type.Str,
                  },
                  u,
                ),
                o.opts.unevaluated && d !== !0
                  ? e.assign((0, Bt._)`${d}[${p}]`, !0)
                  : !g && !o.allErrors && e.if((0, Bt.not)(u), () => e.break())
            })
          })
        }
      },
    }
  Os.default = cd
})
var ca = _((Is) => {
  "use strict"
  Object.defineProperty(Is, "__esModule", { value: !0 })
  var ud = I(),
    ld = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      code(t) {
        let { gen: e, schema: r, it: s } = t
        if ((0, ud.alwaysValidSchema)(s, r)) {
          t.fail()
          return
        }
        let n = e.name("valid")
        t.subschema(
          {
            keyword: "not",
            compositeRule: !0,
            createErrors: !1,
            allErrors: !1,
          },
          n,
        ),
          t.failResult(
            n,
            () => t.reset(),
            () => t.error(),
          )
      },
      error: { message: "must NOT be valid" },
    }
  Is.default = ld
})
var ua = _((Rs) => {
  "use strict"
  Object.defineProperty(Rs, "__esModule", { value: !0 })
  var dd = X(),
    fd = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: !0,
      code: dd.validateUnion,
      error: { message: "must match a schema in anyOf" },
    }
  Rs.default = fd
})
var la = _((Ts) => {
  "use strict"
  Object.defineProperty(Ts, "__esModule", { value: !0 })
  var Yt = P(),
    hd = I(),
    pd = {
      message: "must match exactly one schema in oneOf",
      params: ({ params: t }) => (0, Yt._)`{passingSchemas: ${t.passing}}`,
    },
    md = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: !0,
      error: pd,
      code(t) {
        let { gen: e, schema: r, parentSchema: s, it: n } = t
        if (!Array.isArray(r)) throw new Error("ajv implementation error")
        if (n.opts.discriminator && s.discriminator) return
        let o = r,
          a = e.let("valid", !1),
          i = e.let("passing", null),
          c = e.name("_valid")
        t.setParams({ passing: i }),
          e.block(l),
          t.result(
            a,
            () => t.reset(),
            () => t.error(!0),
          )
        function l() {
          o.forEach((u, d) => {
            let y
            ;(0, hd.alwaysValidSchema)(n, u)
              ? e.var(c, !0)
              : (y = t.subschema(
                  { keyword: "oneOf", schemaProp: d, compositeRule: !0 },
                  c,
                )),
              d > 0 &&
                e
                  .if((0, Yt._)`${c} && ${a}`)
                  .assign(a, !1)
                  .assign(i, (0, Yt._)`[${i}, ${d}]`)
                  .else(),
              e.if(c, () => {
                e.assign(a, !0),
                  e.assign(i, d),
                  y && t.mergeEvaluated(y, Yt.Name)
              })
          })
        }
      },
    }
  Ts.default = md
})
var da = _((Cs) => {
  "use strict"
  Object.defineProperty(Cs, "__esModule", { value: !0 })
  var yd = I(),
    _d = {
      keyword: "allOf",
      schemaType: "array",
      code(t) {
        let { gen: e, schema: r, it: s } = t
        if (!Array.isArray(r)) throw new Error("ajv implementation error")
        let n = e.name("valid")
        r.forEach((o, a) => {
          if ((0, yd.alwaysValidSchema)(s, o)) return
          let i = t.subschema({ keyword: "allOf", schemaProp: a }, n)
          t.ok(n), t.mergeEvaluated(i)
        })
      },
    }
  Cs.default = _d
})
var pa = _((Ms) => {
  "use strict"
  Object.defineProperty(Ms, "__esModule", { value: !0 })
  var Zt = P(),
    ha = I(),
    gd = {
      message: ({ params: t }) =>
        (0, Zt.str)`must match "${t.ifClause}" schema`,
      params: ({ params: t }) => (0, Zt._)`{failingKeyword: ${t.ifClause}}`,
    },
    $d = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      error: gd,
      code(t) {
        let { gen: e, parentSchema: r, it: s } = t
        r.then === void 0 &&
          r.else === void 0 &&
          (0, ha.checkStrictMode)(
            s,
            '"if" without "then" and "else" is ignored',
          )
        let n = fa(s, "then"),
          o = fa(s, "else")
        if (!n && !o) return
        let a = e.let("valid", !0),
          i = e.name("_valid")
        if ((c(), t.reset(), n && o)) {
          let u = e.let("ifClause")
          t.setParams({ ifClause: u }), e.if(i, l("then", u), l("else", u))
        } else n ? e.if(i, l("then")) : e.if((0, Zt.not)(i), l("else"))
        t.pass(a, () => t.error(!0))
        function c() {
          let u = t.subschema(
            {
              keyword: "if",
              compositeRule: !0,
              createErrors: !1,
              allErrors: !1,
            },
            i,
          )
          t.mergeEvaluated(u)
        }
        function l(u, d) {
          return () => {
            let y = t.subschema({ keyword: u }, i)
            e.assign(a, i),
              t.mergeValidEvaluated(y, a),
              d ? e.assign(d, (0, Zt._)`${u}`) : t.setParams({ ifClause: u })
          }
        }
      },
    }
  function fa(t, e) {
    let r = t.schema[e]
    return r !== void 0 && !(0, ha.alwaysValidSchema)(t, r)
  }
  Ms.default = $d
})
var ma = _((As) => {
  "use strict"
  Object.defineProperty(As, "__esModule", { value: !0 })
  var vd = I(),
    wd = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword: t, parentSchema: e, it: r }) {
        e.if === void 0 &&
          (0, vd.checkStrictMode)(r, `"${t}" without "if" is ignored`)
      },
    }
  As.default = wd
})
var ya = _((Ds) => {
  "use strict"
  Object.defineProperty(Ds, "__esModule", { value: !0 })
  var bd = $s(),
    Ed = Go(),
    Pd = vs(),
    Sd = Wo(),
    Nd = Qo(),
    qd = Yo(),
    kd = ea(),
    jd = qs(),
    Od = sa(),
    Id = ia(),
    Rd = ca(),
    Td = ua(),
    Cd = la(),
    Md = da(),
    Ad = pa(),
    Dd = ma()
  function Vd(t = !1) {
    let e = [
      Rd.default,
      Td.default,
      Cd.default,
      Md.default,
      Ad.default,
      Dd.default,
      kd.default,
      jd.default,
      qd.default,
      Od.default,
      Id.default,
    ]
    return (
      t ? e.push(Ed.default, Sd.default) : e.push(bd.default, Pd.default),
      e.push(Nd.default),
      e
    )
  }
  Ds.default = Vd
})
var _a = _((Vs) => {
  "use strict"
  Object.defineProperty(Vs, "__esModule", { value: !0 })
  var D = P(),
    zd = {
      message: ({ schemaCode: t }) => (0, D.str)`must match format "${t}"`,
      params: ({ schemaCode: t }) => (0, D._)`{format: ${t}}`,
    },
    Ud = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: !0,
      error: zd,
      code(t, e) {
        let { gen: r, data: s, $data: n, schema: o, schemaCode: a, it: i } = t,
          { opts: c, errSchemaPath: l, schemaEnv: u, self: d } = i
        if (!c.validateFormats) return
        n ? y() : m()
        function y() {
          let h = r.scopeValue("formats", {
              ref: d.formats,
              code: c.code.formats,
            }),
            f = r.const("fDef", (0, D._)`${h}[${a}]`),
            p = r.let("fType"),
            g = r.let("format")
          r.if(
            (0, D._)`typeof ${f} == "object" && !(${f} instanceof RegExp)`,
            () =>
              r
                .assign(p, (0, D._)`${f}.type || "string"`)
                .assign(g, (0, D._)`${f}.validate`),
            () => r.assign(p, (0, D._)`"string"`).assign(g, f),
          ),
            t.fail$data((0, D.or)(k(), N()))
          function k() {
            return c.strictSchema === !1 ? D.nil : (0, D._)`${a} && !${g}`
          }
          function N() {
            let C = u.$async
                ? (0, D._)`(${f}.async ? await ${g}(${s}) : ${g}(${s}))`
                : (0, D._)`${g}(${s})`,
              w = (0, D._)`(typeof ${g} == "function" ? ${C} : ${g}.test(${s}))`
            return (0, D._)`${g} && ${g} !== true && ${p} === ${e} && !${w}`
          }
        }
        function m() {
          let h = d.formats[o]
          if (!h) {
            k()
            return
          }
          if (h === !0) return
          let [f, p, g] = N(h)
          f === e && t.pass(C())
          function k() {
            if (c.strictSchema === !1) {
              d.logger.warn(w())
              return
            }
            throw new Error(w())
            function w() {
              return `unknown format "${o}" ignored in schema at path "${l}"`
            }
          }
          function N(w) {
            let se =
                w instanceof RegExp
                  ? (0, D.regexpCode)(w)
                  : c.code.formats
                    ? (0, D._)`${c.code.formats}${(0, D.getProperty)(o)}`
                    : void 0,
              ce = r.scopeValue("formats", { key: o, ref: w, code: se })
            return typeof w == "object" && !(w instanceof RegExp)
              ? [w.type || "string", w.validate, (0, D._)`${ce}.validate`]
              : ["string", w, ce]
          }
          function C() {
            if (typeof h == "object" && !(h instanceof RegExp) && h.async) {
              if (!u.$async) throw new Error("async format in sync schema")
              return (0, D._)`await ${g}(${s})`
            }
            return typeof p == "function"
              ? (0, D._)`${g}(${s})`
              : (0, D._)`${g}.test(${s})`
          }
        }
      },
    }
  Vs.default = Ud
})
var ga = _((zs) => {
  "use strict"
  Object.defineProperty(zs, "__esModule", { value: !0 })
  var Kd = _a(),
    Fd = [Kd.default]
  zs.default = Fd
})
var $a = _((Le) => {
  "use strict"
  Object.defineProperty(Le, "__esModule", { value: !0 })
  Le.contentVocabulary = Le.metadataVocabulary = void 0
  Le.metadataVocabulary = [
    "title",
    "description",
    "default",
    "deprecated",
    "readOnly",
    "writeOnly",
    "examples",
  ]
  Le.contentVocabulary = [
    "contentMediaType",
    "contentEncoding",
    "contentSchema",
  ]
})
var wa = _((Us) => {
  "use strict"
  Object.defineProperty(Us, "__esModule", { value: !0 })
  var Ld = ko(),
    xd = Fo(),
    Hd = ya(),
    Gd = ga(),
    va = $a(),
    Jd = [
      Ld.default,
      xd.default,
      (0, Hd.default)(),
      Gd.default,
      va.metadataVocabulary,
      va.contentVocabulary,
    ]
  Us.default = Jd
})
var Ea = _((er) => {
  "use strict"
  Object.defineProperty(er, "__esModule", { value: !0 })
  er.DiscrError = void 0
  var ba
  ;(function (t) {
    ;(t.Tag = "tag"), (t.Mapping = "mapping")
  })(ba || (er.DiscrError = ba = {}))
})
var Sa = _((Fs) => {
  "use strict"
  Object.defineProperty(Fs, "__esModule", { value: !0 })
  var xe = P(),
    Ks = Ea(),
    Pa = At(),
    Wd = ct(),
    Qd = I(),
    Xd = {
      message: ({ params: { discrError: t, tagName: e } }) =>
        t === Ks.DiscrError.Tag
          ? `tag "${e}" must be string`
          : `value of tag "${e}" must be in oneOf`,
      params: ({ params: { discrError: t, tag: e, tagName: r } }) =>
        (0, xe._)`{error: ${t}, tag: ${r}, tagValue: ${e}}`,
    },
    Bd = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error: Xd,
      code(t) {
        let { gen: e, data: r, schema: s, parentSchema: n, it: o } = t,
          { oneOf: a } = n
        if (!o.opts.discriminator)
          throw new Error("discriminator: requires discriminator option")
        let i = s.propertyName
        if (typeof i != "string")
          throw new Error("discriminator: requires propertyName")
        if (s.mapping)
          throw new Error("discriminator: mapping is not supported")
        if (!a) throw new Error("discriminator: requires oneOf keyword")
        let c = e.let("valid", !1),
          l = e.const("tag", (0, xe._)`${r}${(0, xe.getProperty)(i)}`)
        e.if(
          (0, xe._)`typeof ${l} == "string"`,
          () => u(),
          () =>
            t.error(!1, { discrError: Ks.DiscrError.Tag, tag: l, tagName: i }),
        ),
          t.ok(c)
        function u() {
          let m = y()
          e.if(!1)
          for (let h in m)
            e.elseIf((0, xe._)`${l} === ${h}`), e.assign(c, d(m[h]))
          e.else(),
            t.error(!1, {
              discrError: Ks.DiscrError.Mapping,
              tag: l,
              tagName: i,
            }),
            e.endIf()
        }
        function d(m) {
          let h = e.name("valid"),
            f = t.subschema({ keyword: "oneOf", schemaProp: m }, h)
          return t.mergeEvaluated(f, xe.Name), h
        }
        function y() {
          var m
          let h = {},
            f = g(n),
            p = !0
          for (let C = 0; C < a.length; C++) {
            let w = a[C]
            if (w?.$ref && !(0, Qd.schemaHasRulesButRef)(w, o.self.RULES)) {
              let ce = w.$ref
              if (
                ((w = Pa.resolveRef.call(
                  o.self,
                  o.schemaEnv.root,
                  o.baseId,
                  ce,
                )),
                w instanceof Pa.SchemaEnv && (w = w.schema),
                w === void 0)
              )
                throw new Wd.default(o.opts.uriResolver, o.baseId, ce)
            }
            let se =
              (m = w?.properties) === null || m === void 0 ? void 0 : m[i]
            if (typeof se != "object")
              throw new Error(
                `discriminator: oneOf subschemas (or referenced schemas) must have "properties/${i}"`,
              )
            ;(p = p && (f || g(w))), k(se, C)
          }
          if (!p) throw new Error(`discriminator: "${i}" must be required`)
          return h
          function g({ required: C }) {
            return Array.isArray(C) && C.includes(i)
          }
          function k(C, w) {
            if (C.const) N(C.const, w)
            else if (C.enum) for (let se of C.enum) N(se, w)
            else
              throw new Error(
                `discriminator: "properties/${i}" must have "const" or "enum"`,
              )
          }
          function N(C, w) {
            if (typeof C != "string" || C in h)
              throw new Error(
                `discriminator: "${i}" values must be unique strings`,
              )
            h[C] = w
          }
        }
      },
    }
  Fs.default = Bd
})
var Na = _((Ch, Yd) => {
  Yd.exports = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://json-schema.org/draft-07/schema#",
    title: "Core schema meta-schema",
    definitions: {
      schemaArray: { type: "array", minItems: 1, items: { $ref: "#" } },
      nonNegativeInteger: { type: "integer", minimum: 0 },
      nonNegativeIntegerDefault0: {
        allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }],
      },
      simpleTypes: {
        enum: [
          "array",
          "boolean",
          "integer",
          "null",
          "number",
          "object",
          "string",
        ],
      },
      stringArray: {
        type: "array",
        items: { type: "string" },
        uniqueItems: !0,
        default: [],
      },
    },
    type: ["object", "boolean"],
    properties: {
      $id: { type: "string", format: "uri-reference" },
      $schema: { type: "string", format: "uri" },
      $ref: { type: "string", format: "uri-reference" },
      $comment: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      default: !0,
      readOnly: { type: "boolean", default: !1 },
      examples: { type: "array", items: !0 },
      multipleOf: { type: "number", exclusiveMinimum: 0 },
      maximum: { type: "number" },
      exclusiveMaximum: { type: "number" },
      minimum: { type: "number" },
      exclusiveMinimum: { type: "number" },
      maxLength: { $ref: "#/definitions/nonNegativeInteger" },
      minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      pattern: { type: "string", format: "regex" },
      additionalItems: { $ref: "#" },
      items: {
        anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
        default: !0,
      },
      maxItems: { $ref: "#/definitions/nonNegativeInteger" },
      minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      uniqueItems: { type: "boolean", default: !1 },
      contains: { $ref: "#" },
      maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
      minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      required: { $ref: "#/definitions/stringArray" },
      additionalProperties: { $ref: "#" },
      definitions: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {},
      },
      properties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {},
      },
      patternProperties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        propertyNames: { format: "regex" },
        default: {},
      },
      dependencies: {
        type: "object",
        additionalProperties: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }],
        },
      },
      propertyNames: { $ref: "#" },
      const: !0,
      enum: { type: "array", items: !0, minItems: 1, uniqueItems: !0 },
      type: {
        anyOf: [
          { $ref: "#/definitions/simpleTypes" },
          {
            type: "array",
            items: { $ref: "#/definitions/simpleTypes" },
            minItems: 1,
            uniqueItems: !0,
          },
        ],
      },
      format: { type: "string" },
      contentMediaType: { type: "string" },
      contentEncoding: { type: "string" },
      if: { $ref: "#" },
      then: { $ref: "#" },
      else: { $ref: "#" },
      allOf: { $ref: "#/definitions/schemaArray" },
      anyOf: { $ref: "#/definitions/schemaArray" },
      oneOf: { $ref: "#/definitions/schemaArray" },
      not: { $ref: "#" },
    },
    default: !0,
  }
})
var xs = _((A, Ls) => {
  "use strict"
  Object.defineProperty(A, "__esModule", { value: !0 })
  A.MissingRefError =
    A.ValidationError =
    A.CodeGen =
    A.Name =
    A.nil =
    A.stringify =
    A.str =
    A._ =
    A.KeywordCxt =
    A.Ajv =
      void 0
  var Zd = bo(),
    ef = wa(),
    tf = Sa(),
    qa = Na(),
    rf = ["/properties"],
    tr = "http://json-schema.org/draft-07/schema",
    He = class extends Zd.default {
      _addVocabularies() {
        super._addVocabularies(),
          ef.default.forEach((e) => this.addVocabulary(e)),
          this.opts.discriminator && this.addKeyword(tf.default)
      }
      _addDefaultMetaSchema() {
        if ((super._addDefaultMetaSchema(), !this.opts.meta)) return
        let e = this.opts.$data ? this.$dataMetaSchema(qa, rf) : qa
        this.addMetaSchema(e, tr, !1),
          (this.refs["http://json-schema.org/schema"] = tr)
      }
      defaultMeta() {
        return (this.opts.defaultMeta =
          super.defaultMeta() || (this.getSchema(tr) ? tr : void 0))
      }
    }
  A.Ajv = He
  Ls.exports = A = He
  Ls.exports.Ajv = He
  Object.defineProperty(A, "__esModule", { value: !0 })
  A.default = He
  var sf = it()
  Object.defineProperty(A, "KeywordCxt", {
    enumerable: !0,
    get: function () {
      return sf.KeywordCxt
    },
  })
  var Ge = P()
  Object.defineProperty(A, "_", {
    enumerable: !0,
    get: function () {
      return Ge._
    },
  })
  Object.defineProperty(A, "str", {
    enumerable: !0,
    get: function () {
      return Ge.str
    },
  })
  Object.defineProperty(A, "stringify", {
    enumerable: !0,
    get: function () {
      return Ge.stringify
    },
  })
  Object.defineProperty(A, "nil", {
    enumerable: !0,
    get: function () {
      return Ge.nil
    },
  })
  Object.defineProperty(A, "Name", {
    enumerable: !0,
    get: function () {
      return Ge.Name
    },
  })
  Object.defineProperty(A, "CodeGen", {
    enumerable: !0,
    get: function () {
      return Ge.CodeGen
    },
  })
  var nf = Ct()
  Object.defineProperty(A, "ValidationError", {
    enumerable: !0,
    get: function () {
      return nf.default
    },
  })
  var of = ct()
  Object.defineProperty(A, "MissingRefError", {
    enumerable: !0,
    get: function () {
      return of.default
    },
  })
})
var we = {}
Aa(we, {
  Ajv: () => _f,
  CodeGen: () => lf,
  KeywordCxt: () => yf,
  MissingRefError: () => cf,
  Name: () => df,
  ValidationError: () => uf,
  _: () => mf,
  __esModule: () => af,
  default: () => $f,
  nil: () => ff,
  str: () => pf,
  stringify: () => hf,
})
var ja = Js(xs())
be(we, Js(xs()))
var {
    __esModule: af,
    MissingRefError: cf,
    ValidationError: uf,
    CodeGen: lf,
    Name: df,
    nil: ff,
    stringify: hf,
    str: pf,
    _: mf,
    KeywordCxt: yf,
    Ajv: _f,
  } = ja,
  { default: ka, ...gf } = ja,
  $f = ka !== void 0 ? ka : gf
export {
  _f as Ajv,
  lf as CodeGen,
  yf as KeywordCxt,
  cf as MissingRefError,
  df as Name,
  uf as ValidationError,
  mf as _,
  af as __esModule,
  $f as default,
  ff as nil,
  pf as str,
  hf as stringify,
}
//# sourceMappingURL=ajv.bundle.mjs.map
