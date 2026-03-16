(async () => {
  function DT(n, i) {
    for (var l = 0; l < i.length; l++) {
      const o = i[l];
      if (typeof o != "string" && !Array.isArray(o)) {
        for (const r in o) if (r !== "default" && !(r in n)) {
          const d = Object.getOwnPropertyDescriptor(o, r);
          d && Object.defineProperty(n, r, d.get ? d : {
            enumerable: true,
            get: () => o[r]
          });
        }
      }
    }
    return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, {
      value: "Module"
    }));
  }
  (function() {
    const i = document.createElement("link").relList;
    if (i && i.supports && i.supports("modulepreload")) return;
    for (const r of document.querySelectorAll('link[rel="modulepreload"]')) o(r);
    new MutationObserver((r) => {
      for (const d of r) if (d.type === "childList") for (const f of d.addedNodes) f.tagName === "LINK" && f.rel === "modulepreload" && o(f);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function l(r) {
      const d = {};
      return r.integrity && (d.integrity = r.integrity), r.referrerPolicy && (d.referrerPolicy = r.referrerPolicy), r.crossOrigin === "use-credentials" ? d.credentials = "include" : r.crossOrigin === "anonymous" ? d.credentials = "omit" : d.credentials = "same-origin", d;
    }
    function o(r) {
      if (r.ep) return;
      r.ep = true;
      const d = l(r);
      fetch(r.href, d);
    }
  })();
  function Q0(n) {
    return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
  }
  var Xu = {
    exports: {}
  }, $s = {};
  var Jg;
  function OT() {
    if (Jg) return $s;
    Jg = 1;
    var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
    function l(o, r, d) {
      var f = null;
      if (d !== void 0 && (f = "" + d), r.key !== void 0 && (f = "" + r.key), "key" in r) {
        d = {};
        for (var h in r) h !== "key" && (d[h] = r[h]);
      } else d = r;
      return r = d.ref, {
        $$typeof: n,
        type: o,
        key: f,
        ref: r !== void 0 ? r : null,
        props: d
      };
    }
    return $s.Fragment = i, $s.jsx = l, $s.jsxs = l, $s;
  }
  var $g;
  function jT() {
    return $g || ($g = 1, Xu.exports = OT()), Xu.exports;
  }
  var S = jT(), Ku = {
    exports: {}
  }, yt = {};
  var Wg;
  function NT() {
    if (Wg) return yt;
    Wg = 1;
    var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), l = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), f = Symbol.for("react.context"), h = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.memo"), g = Symbol.for("react.lazy"), v = Symbol.for("react.activity"), b = Symbol.iterator;
    function T(E) {
      return E === null || typeof E != "object" ? null : (E = b && E[b] || E["@@iterator"], typeof E == "function" ? E : null);
    }
    var A = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    }, C = Object.assign, R = {};
    function O(E, j, K) {
      this.props = E, this.context = j, this.refs = R, this.updater = K || A;
    }
    O.prototype.isReactComponent = {}, O.prototype.setState = function(E, j) {
      if (typeof E != "object" && typeof E != "function" && E != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, E, j, "setState");
    }, O.prototype.forceUpdate = function(E) {
      this.updater.enqueueForceUpdate(this, E, "forceUpdate");
    };
    function L() {
    }
    L.prototype = O.prototype;
    function z(E, j, K) {
      this.props = E, this.context = j, this.refs = R, this.updater = K || A;
    }
    var V = z.prototype = new L();
    V.constructor = z, C(V, O.prototype), V.isPureReactComponent = true;
    var q = Array.isArray;
    function $() {
    }
    var X = {
      H: null,
      A: null,
      T: null,
      S: null
    }, G = Object.prototype.hasOwnProperty;
    function tt(E, j, K) {
      var W = K.ref;
      return {
        $$typeof: n,
        type: E,
        key: j,
        ref: W !== void 0 ? W : null,
        props: K
      };
    }
    function I(E, j) {
      return tt(E.type, j, E.props);
    }
    function nt(E) {
      return typeof E == "object" && E !== null && E.$$typeof === n;
    }
    function st(E) {
      var j = {
        "=": "=0",
        ":": "=2"
      };
      return "$" + E.replace(/[=:]/g, function(K) {
        return j[K];
      });
    }
    var gt = /\/+/g;
    function ht(E, j) {
      return typeof E == "object" && E !== null && E.key != null ? st("" + E.key) : j.toString(36);
    }
    function mt(E) {
      switch (E.status) {
        case "fulfilled":
          return E.value;
        case "rejected":
          throw E.reason;
        default:
          switch (typeof E.status == "string" ? E.then($, $) : (E.status = "pending", E.then(function(j) {
            E.status === "pending" && (E.status = "fulfilled", E.value = j);
          }, function(j) {
            E.status === "pending" && (E.status = "rejected", E.reason = j);
          })), E.status) {
            case "fulfilled":
              return E.value;
            case "rejected":
              throw E.reason;
          }
      }
      throw E;
    }
    function k(E, j, K, W, et) {
      var at = typeof E;
      (at === "undefined" || at === "boolean") && (E = null);
      var dt = false;
      if (E === null) dt = true;
      else switch (at) {
        case "bigint":
        case "string":
        case "number":
          dt = true;
          break;
        case "object":
          switch (E.$$typeof) {
            case n:
            case i:
              dt = true;
              break;
            case g:
              return dt = E._init, k(dt(E._payload), j, K, W, et);
          }
      }
      if (dt) return et = et(E), dt = W === "" ? "." + ht(E, 0) : W, q(et) ? (K = "", dt != null && (K = dt.replace(gt, "$&/") + "/"), k(et, j, K, "", function(cn) {
        return cn;
      })) : et != null && (nt(et) && (et = I(et, K + (et.key == null || E && E.key === et.key ? "" : ("" + et.key).replace(gt, "$&/") + "/") + dt)), j.push(et)), 1;
      dt = 0;
      var Ht = W === "" ? "." : W + ":";
      if (q(E)) for (var vt = 0; vt < E.length; vt++) W = E[vt], at = Ht + ht(W, vt), dt += k(W, j, K, at, et);
      else if (vt = T(E), typeof vt == "function") for (E = vt.call(E), vt = 0; !(W = E.next()).done; ) W = W.value, at = Ht + ht(W, vt++), dt += k(W, j, K, at, et);
      else if (at === "object") {
        if (typeof E.then == "function") return k(mt(E), j, K, W, et);
        throw j = String(E), Error("Objects are not valid as a React child (found: " + (j === "[object Object]" ? "object with keys {" + Object.keys(E).join(", ") + "}" : j) + "). If you meant to render a collection of children, use an array instead.");
      }
      return dt;
    }
    function F(E, j, K) {
      if (E == null) return E;
      var W = [], et = 0;
      return k(E, W, "", "", function(at) {
        return j.call(K, at, et++);
      }), W;
    }
    function Z(E) {
      if (E._status === -1) {
        var j = E._result;
        j = j(), j.then(function(K) {
          (E._status === 0 || E._status === -1) && (E._status = 1, E._result = K);
        }, function(K) {
          (E._status === 0 || E._status === -1) && (E._status = 2, E._result = K);
        }), E._status === -1 && (E._status = 0, E._result = j);
      }
      if (E._status === 1) return E._result.default;
      throw E._result;
    }
    var it = typeof reportError == "function" ? reportError : function(E) {
      if (typeof window == "object" && typeof window.ErrorEvent == "function") {
        var j = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof E == "object" && E !== null && typeof E.message == "string" ? String(E.message) : String(E),
          error: E
        });
        if (!window.dispatchEvent(j)) return;
      } else if (typeof process == "object" && typeof process.emit == "function") {
        process.emit("uncaughtException", E);
        return;
      }
      console.error(E);
    }, N = {
      map: F,
      forEach: function(E, j, K) {
        F(E, function() {
          j.apply(this, arguments);
        }, K);
      },
      count: function(E) {
        var j = 0;
        return F(E, function() {
          j++;
        }), j;
      },
      toArray: function(E) {
        return F(E, function(j) {
          return j;
        }) || [];
      },
      only: function(E) {
        if (!nt(E)) throw Error("React.Children.only expected to receive a single React element child.");
        return E;
      }
    };
    return yt.Activity = v, yt.Children = N, yt.Component = O, yt.Fragment = l, yt.Profiler = r, yt.PureComponent = z, yt.StrictMode = o, yt.Suspense = m, yt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = X, yt.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(E) {
        return X.H.useMemoCache(E);
      }
    }, yt.cache = function(E) {
      return function() {
        return E.apply(null, arguments);
      };
    }, yt.cacheSignal = function() {
      return null;
    }, yt.cloneElement = function(E, j, K) {
      if (E == null) throw Error("The argument must be a React element, but you passed " + E + ".");
      var W = C({}, E.props), et = E.key;
      if (j != null) for (at in j.key !== void 0 && (et = "" + j.key), j) !G.call(j, at) || at === "key" || at === "__self" || at === "__source" || at === "ref" && j.ref === void 0 || (W[at] = j[at]);
      var at = arguments.length - 2;
      if (at === 1) W.children = K;
      else if (1 < at) {
        for (var dt = Array(at), Ht = 0; Ht < at; Ht++) dt[Ht] = arguments[Ht + 2];
        W.children = dt;
      }
      return tt(E.type, et, W);
    }, yt.createContext = function(E) {
      return E = {
        $$typeof: f,
        _currentValue: E,
        _currentValue2: E,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      }, E.Provider = E, E.Consumer = {
        $$typeof: d,
        _context: E
      }, E;
    }, yt.createElement = function(E, j, K) {
      var W, et = {}, at = null;
      if (j != null) for (W in j.key !== void 0 && (at = "" + j.key), j) G.call(j, W) && W !== "key" && W !== "__self" && W !== "__source" && (et[W] = j[W]);
      var dt = arguments.length - 2;
      if (dt === 1) et.children = K;
      else if (1 < dt) {
        for (var Ht = Array(dt), vt = 0; vt < dt; vt++) Ht[vt] = arguments[vt + 2];
        et.children = Ht;
      }
      if (E && E.defaultProps) for (W in dt = E.defaultProps, dt) et[W] === void 0 && (et[W] = dt[W]);
      return tt(E, at, et);
    }, yt.createRef = function() {
      return {
        current: null
      };
    }, yt.forwardRef = function(E) {
      return {
        $$typeof: h,
        render: E
      };
    }, yt.isValidElement = nt, yt.lazy = function(E) {
      return {
        $$typeof: g,
        _payload: {
          _status: -1,
          _result: E
        },
        _init: Z
      };
    }, yt.memo = function(E, j) {
      return {
        $$typeof: p,
        type: E,
        compare: j === void 0 ? null : j
      };
    }, yt.startTransition = function(E) {
      var j = X.T, K = {};
      X.T = K;
      try {
        var W = E(), et = X.S;
        et !== null && et(K, W), typeof W == "object" && W !== null && typeof W.then == "function" && W.then($, it);
      } catch (at) {
        it(at);
      } finally {
        j !== null && K.types !== null && (j.types = K.types), X.T = j;
      }
    }, yt.unstable_useCacheRefresh = function() {
      return X.H.useCacheRefresh();
    }, yt.use = function(E) {
      return X.H.use(E);
    }, yt.useActionState = function(E, j, K) {
      return X.H.useActionState(E, j, K);
    }, yt.useCallback = function(E, j) {
      return X.H.useCallback(E, j);
    }, yt.useContext = function(E) {
      return X.H.useContext(E);
    }, yt.useDebugValue = function() {
    }, yt.useDeferredValue = function(E, j) {
      return X.H.useDeferredValue(E, j);
    }, yt.useEffect = function(E, j) {
      return X.H.useEffect(E, j);
    }, yt.useEffectEvent = function(E) {
      return X.H.useEffectEvent(E);
    }, yt.useId = function() {
      return X.H.useId();
    }, yt.useImperativeHandle = function(E, j, K) {
      return X.H.useImperativeHandle(E, j, K);
    }, yt.useInsertionEffect = function(E, j) {
      return X.H.useInsertionEffect(E, j);
    }, yt.useLayoutEffect = function(E, j) {
      return X.H.useLayoutEffect(E, j);
    }, yt.useMemo = function(E, j) {
      return X.H.useMemo(E, j);
    }, yt.useOptimistic = function(E, j) {
      return X.H.useOptimistic(E, j);
    }, yt.useReducer = function(E, j, K) {
      return X.H.useReducer(E, j, K);
    }, yt.useRef = function(E) {
      return X.H.useRef(E);
    }, yt.useState = function(E) {
      return X.H.useState(E);
    }, yt.useSyncExternalStore = function(E, j, K) {
      return X.H.useSyncExternalStore(E, j, K);
    }, yt.useTransition = function() {
      return X.H.useTransition();
    }, yt.version = "19.2.4", yt;
  }
  var Ig;
  function nd() {
    return Ig || (Ig = 1, Ku.exports = NT()), Ku.exports;
  }
  var w = nd();
  const gn = Q0(w), id = DT({
    __proto__: null,
    default: gn
  }, [
    w
  ]);
  var Zu = {
    exports: {}
  }, Ws = {}, Qu = {
    exports: {}
  }, Fu = {};
  var ty;
  function zT() {
    return ty || (ty = 1, (function(n) {
      function i(k, F) {
        var Z = k.length;
        k.push(F);
        t: for (; 0 < Z; ) {
          var it = Z - 1 >>> 1, N = k[it];
          if (0 < r(N, F)) k[it] = F, k[Z] = N, Z = it;
          else break t;
        }
      }
      function l(k) {
        return k.length === 0 ? null : k[0];
      }
      function o(k) {
        if (k.length === 0) return null;
        var F = k[0], Z = k.pop();
        if (Z !== F) {
          k[0] = Z;
          t: for (var it = 0, N = k.length, E = N >>> 1; it < E; ) {
            var j = 2 * (it + 1) - 1, K = k[j], W = j + 1, et = k[W];
            if (0 > r(K, Z)) W < N && 0 > r(et, K) ? (k[it] = et, k[W] = Z, it = W) : (k[it] = K, k[j] = Z, it = j);
            else if (W < N && 0 > r(et, Z)) k[it] = et, k[W] = Z, it = W;
            else break t;
          }
        }
        return F;
      }
      function r(k, F) {
        var Z = k.sortIndex - F.sortIndex;
        return Z !== 0 ? Z : k.id - F.id;
      }
      if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
        var d = performance;
        n.unstable_now = function() {
          return d.now();
        };
      } else {
        var f = Date, h = f.now();
        n.unstable_now = function() {
          return f.now() - h;
        };
      }
      var m = [], p = [], g = 1, v = null, b = 3, T = false, A = false, C = false, R = false, O = typeof setTimeout == "function" ? setTimeout : null, L = typeof clearTimeout == "function" ? clearTimeout : null, z = typeof setImmediate < "u" ? setImmediate : null;
      function V(k) {
        for (var F = l(p); F !== null; ) {
          if (F.callback === null) o(p);
          else if (F.startTime <= k) o(p), F.sortIndex = F.expirationTime, i(m, F);
          else break;
          F = l(p);
        }
      }
      function q(k) {
        if (C = false, V(k), !A) if (l(m) !== null) A = true, $ || ($ = true, st());
        else {
          var F = l(p);
          F !== null && mt(q, F.startTime - k);
        }
      }
      var $ = false, X = -1, G = 5, tt = -1;
      function I() {
        return R ? true : !(n.unstable_now() - tt < G);
      }
      function nt() {
        if (R = false, $) {
          var k = n.unstable_now();
          tt = k;
          var F = true;
          try {
            t: {
              A = false, C && (C = false, L(X), X = -1), T = true;
              var Z = b;
              try {
                e: {
                  for (V(k), v = l(m); v !== null && !(v.expirationTime > k && I()); ) {
                    var it = v.callback;
                    if (typeof it == "function") {
                      v.callback = null, b = v.priorityLevel;
                      var N = it(v.expirationTime <= k);
                      if (k = n.unstable_now(), typeof N == "function") {
                        v.callback = N, V(k), F = true;
                        break e;
                      }
                      v === l(m) && o(m), V(k);
                    } else o(m);
                    v = l(m);
                  }
                  if (v !== null) F = true;
                  else {
                    var E = l(p);
                    E !== null && mt(q, E.startTime - k), F = false;
                  }
                }
                break t;
              } finally {
                v = null, b = Z, T = false;
              }
              F = void 0;
            }
          } finally {
            F ? st() : $ = false;
          }
        }
      }
      var st;
      if (typeof z == "function") st = function() {
        z(nt);
      };
      else if (typeof MessageChannel < "u") {
        var gt = new MessageChannel(), ht = gt.port2;
        gt.port1.onmessage = nt, st = function() {
          ht.postMessage(null);
        };
      } else st = function() {
        O(nt, 0);
      };
      function mt(k, F) {
        X = O(function() {
          k(n.unstable_now());
        }, F);
      }
      n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(k) {
        k.callback = null;
      }, n.unstable_forceFrameRate = function(k) {
        0 > k || 125 < k ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : G = 0 < k ? Math.floor(1e3 / k) : 5;
      }, n.unstable_getCurrentPriorityLevel = function() {
        return b;
      }, n.unstable_next = function(k) {
        switch (b) {
          case 1:
          case 2:
          case 3:
            var F = 3;
            break;
          default:
            F = b;
        }
        var Z = b;
        b = F;
        try {
          return k();
        } finally {
          b = Z;
        }
      }, n.unstable_requestPaint = function() {
        R = true;
      }, n.unstable_runWithPriority = function(k, F) {
        switch (k) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            k = 3;
        }
        var Z = b;
        b = k;
        try {
          return F();
        } finally {
          b = Z;
        }
      }, n.unstable_scheduleCallback = function(k, F, Z) {
        var it = n.unstable_now();
        switch (typeof Z == "object" && Z !== null ? (Z = Z.delay, Z = typeof Z == "number" && 0 < Z ? it + Z : it) : Z = it, k) {
          case 1:
            var N = -1;
            break;
          case 2:
            N = 250;
            break;
          case 5:
            N = 1073741823;
            break;
          case 4:
            N = 1e4;
            break;
          default:
            N = 5e3;
        }
        return N = Z + N, k = {
          id: g++,
          callback: F,
          priorityLevel: k,
          startTime: Z,
          expirationTime: N,
          sortIndex: -1
        }, Z > it ? (k.sortIndex = Z, i(p, k), l(m) === null && k === l(p) && (C ? (L(X), X = -1) : C = true, mt(q, Z - it))) : (k.sortIndex = N, i(m, k), A || T || (A = true, $ || ($ = true, st()))), k;
      }, n.unstable_shouldYield = I, n.unstable_wrapCallback = function(k) {
        var F = b;
        return function() {
          var Z = b;
          b = F;
          try {
            return k.apply(this, arguments);
          } finally {
            b = Z;
          }
        };
      };
    })(Fu)), Fu;
  }
  var ey;
  function _T() {
    return ey || (ey = 1, Qu.exports = zT()), Qu.exports;
  }
  var Ju = {
    exports: {}
  }, fe = {};
  var ny;
  function VT() {
    if (ny) return fe;
    ny = 1;
    var n = nd();
    function i(m) {
      var p = "https://react.dev/errors/" + m;
      if (1 < arguments.length) {
        p += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var g = 2; g < arguments.length; g++) p += "&args[]=" + encodeURIComponent(arguments[g]);
      }
      return "Minified React error #" + m + "; visit " + p + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function l() {
    }
    var o = {
      d: {
        f: l,
        r: function() {
          throw Error(i(522));
        },
        D: l,
        C: l,
        L: l,
        m: l,
        X: l,
        S: l,
        M: l
      },
      p: 0,
      findDOMNode: null
    }, r = Symbol.for("react.portal");
    function d(m, p, g) {
      var v = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      return {
        $$typeof: r,
        key: v == null ? null : "" + v,
        children: m,
        containerInfo: p,
        implementation: g
      };
    }
    var f = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function h(m, p) {
      if (m === "font") return "";
      if (typeof p == "string") return p === "use-credentials" ? p : "";
    }
    return fe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = o, fe.createPortal = function(m, p) {
      var g = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11) throw Error(i(299));
      return d(m, p, null, g);
    }, fe.flushSync = function(m) {
      var p = f.T, g = o.p;
      try {
        if (f.T = null, o.p = 2, m) return m();
      } finally {
        f.T = p, o.p = g, o.d.f();
      }
    }, fe.preconnect = function(m, p) {
      typeof m == "string" && (p ? (p = p.crossOrigin, p = typeof p == "string" ? p === "use-credentials" ? p : "" : void 0) : p = null, o.d.C(m, p));
    }, fe.prefetchDNS = function(m) {
      typeof m == "string" && o.d.D(m);
    }, fe.preinit = function(m, p) {
      if (typeof m == "string" && p && typeof p.as == "string") {
        var g = p.as, v = h(g, p.crossOrigin), b = typeof p.integrity == "string" ? p.integrity : void 0, T = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        g === "style" ? o.d.S(m, typeof p.precedence == "string" ? p.precedence : void 0, {
          crossOrigin: v,
          integrity: b,
          fetchPriority: T
        }) : g === "script" && o.d.X(m, {
          crossOrigin: v,
          integrity: b,
          fetchPriority: T,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0
        });
      }
    }, fe.preinitModule = function(m, p) {
      if (typeof m == "string") if (typeof p == "object" && p !== null) {
        if (p.as == null || p.as === "script") {
          var g = h(p.as, p.crossOrigin);
          o.d.M(m, {
            crossOrigin: g,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
            nonce: typeof p.nonce == "string" ? p.nonce : void 0
          });
        }
      } else p == null && o.d.M(m);
    }, fe.preload = function(m, p) {
      if (typeof m == "string" && typeof p == "object" && p !== null && typeof p.as == "string") {
        var g = p.as, v = h(g, p.crossOrigin);
        o.d.L(m, g, {
          crossOrigin: v,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0,
          type: typeof p.type == "string" ? p.type : void 0,
          fetchPriority: typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
          referrerPolicy: typeof p.referrerPolicy == "string" ? p.referrerPolicy : void 0,
          imageSrcSet: typeof p.imageSrcSet == "string" ? p.imageSrcSet : void 0,
          imageSizes: typeof p.imageSizes == "string" ? p.imageSizes : void 0,
          media: typeof p.media == "string" ? p.media : void 0
        });
      }
    }, fe.preloadModule = function(m, p) {
      if (typeof m == "string") if (p) {
        var g = h(p.as, p.crossOrigin);
        o.d.m(m, {
          as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
          crossOrigin: g,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0
        });
      } else o.d.m(m);
    }, fe.requestFormReset = function(m) {
      o.d.r(m);
    }, fe.unstable_batchedUpdates = function(m, p) {
      return m(p);
    }, fe.useFormState = function(m, p, g) {
      return f.H.useFormState(m, p, g);
    }, fe.useFormStatus = function() {
      return f.H.useHostTransitionStatus();
    }, fe.version = "19.2.4", fe;
  }
  var iy;
  function F0() {
    if (iy) return Ju.exports;
    iy = 1;
    function n() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (i) {
        console.error(i);
      }
    }
    return n(), Ju.exports = VT(), Ju.exports;
  }
  var ay;
  function kT() {
    if (ay) return Ws;
    ay = 1;
    var n = _T(), i = nd(), l = F0();
    function o(t) {
      var e = "https://react.dev/errors/" + t;
      if (1 < arguments.length) {
        e += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var a = 2; a < arguments.length; a++) e += "&args[]=" + encodeURIComponent(arguments[a]);
      }
      return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function r(t) {
      return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
    }
    function d(t) {
      var e = t, a = t;
      if (t.alternate) for (; e.return; ) e = e.return;
      else {
        t = e;
        do
          e = t, (e.flags & 4098) !== 0 && (a = e.return), t = e.return;
        while (t);
      }
      return e.tag === 3 ? a : null;
    }
    function f(t) {
      if (t.tag === 13) {
        var e = t.memoizedState;
        if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
      }
      return null;
    }
    function h(t) {
      if (t.tag === 31) {
        var e = t.memoizedState;
        if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
      }
      return null;
    }
    function m(t) {
      if (d(t) !== t) throw Error(o(188));
    }
    function p(t) {
      var e = t.alternate;
      if (!e) {
        if (e = d(t), e === null) throw Error(o(188));
        return e !== t ? null : t;
      }
      for (var a = t, s = e; ; ) {
        var c = a.return;
        if (c === null) break;
        var u = c.alternate;
        if (u === null) {
          if (s = c.return, s !== null) {
            a = s;
            continue;
          }
          break;
        }
        if (c.child === u.child) {
          for (u = c.child; u; ) {
            if (u === a) return m(c), t;
            if (u === s) return m(c), e;
            u = u.sibling;
          }
          throw Error(o(188));
        }
        if (a.return !== s.return) a = c, s = u;
        else {
          for (var y = false, x = c.child; x; ) {
            if (x === a) {
              y = true, a = c, s = u;
              break;
            }
            if (x === s) {
              y = true, s = c, a = u;
              break;
            }
            x = x.sibling;
          }
          if (!y) {
            for (x = u.child; x; ) {
              if (x === a) {
                y = true, a = u, s = c;
                break;
              }
              if (x === s) {
                y = true, s = u, a = c;
                break;
              }
              x = x.sibling;
            }
            if (!y) throw Error(o(189));
          }
        }
        if (a.alternate !== s) throw Error(o(190));
      }
      if (a.tag !== 3) throw Error(o(188));
      return a.stateNode.current === a ? t : e;
    }
    function g(t) {
      var e = t.tag;
      if (e === 5 || e === 26 || e === 27 || e === 6) return t;
      for (t = t.child; t !== null; ) {
        if (e = g(t), e !== null) return e;
        t = t.sibling;
      }
      return null;
    }
    var v = Object.assign, b = Symbol.for("react.element"), T = Symbol.for("react.transitional.element"), A = Symbol.for("react.portal"), C = Symbol.for("react.fragment"), R = Symbol.for("react.strict_mode"), O = Symbol.for("react.profiler"), L = Symbol.for("react.consumer"), z = Symbol.for("react.context"), V = Symbol.for("react.forward_ref"), q = Symbol.for("react.suspense"), $ = Symbol.for("react.suspense_list"), X = Symbol.for("react.memo"), G = Symbol.for("react.lazy"), tt = Symbol.for("react.activity"), I = Symbol.for("react.memo_cache_sentinel"), nt = Symbol.iterator;
    function st(t) {
      return t === null || typeof t != "object" ? null : (t = nt && t[nt] || t["@@iterator"], typeof t == "function" ? t : null);
    }
    var gt = Symbol.for("react.client.reference");
    function ht(t) {
      if (t == null) return null;
      if (typeof t == "function") return t.$$typeof === gt ? null : t.displayName || t.name || null;
      if (typeof t == "string") return t;
      switch (t) {
        case C:
          return "Fragment";
        case O:
          return "Profiler";
        case R:
          return "StrictMode";
        case q:
          return "Suspense";
        case $:
          return "SuspenseList";
        case tt:
          return "Activity";
      }
      if (typeof t == "object") switch (t.$$typeof) {
        case A:
          return "Portal";
        case z:
          return t.displayName || "Context";
        case L:
          return (t._context.displayName || "Context") + ".Consumer";
        case V:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case X:
          return e = t.displayName || null, e !== null ? e : ht(t.type) || "Memo";
        case G:
          e = t._payload, t = t._init;
          try {
            return ht(t(e));
          } catch {
          }
      }
      return null;
    }
    var mt = Array.isArray, k = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, F = l.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Z = {
      pending: false,
      data: null,
      method: null,
      action: null
    }, it = [], N = -1;
    function E(t) {
      return {
        current: t
      };
    }
    function j(t) {
      0 > N || (t.current = it[N], it[N] = null, N--);
    }
    function K(t, e) {
      N++, it[N] = t.current, t.current = e;
    }
    var W = E(null), et = E(null), at = E(null), dt = E(null);
    function Ht(t, e) {
      switch (K(at, e), K(et, t), K(W, null), e.nodeType) {
        case 9:
        case 11:
          t = (t = e.documentElement) && (t = t.namespaceURI) ? bg(t) : 0;
          break;
        default:
          if (t = e.tagName, e = e.namespaceURI) e = bg(e), t = xg(e, t);
          else switch (t) {
            case "svg":
              t = 1;
              break;
            case "math":
              t = 2;
              break;
            default:
              t = 0;
          }
      }
      j(W), K(W, t);
    }
    function vt() {
      j(W), j(et), j(at);
    }
    function cn(t) {
      t.memoizedState !== null && K(dt, t);
      var e = W.current, a = xg(e, t.type);
      e !== a && (K(et, t), K(W, a));
    }
    function $e(t) {
      et.current === t && (j(W), j(et)), dt.current === t && (j(dt), Zs._currentValue = Z);
    }
    var un, We;
    function Le(t) {
      if (un === void 0) try {
        throw Error();
      } catch (a) {
        var e = a.stack.trim().match(/\n( *(at )?)/);
        un = e && e[1] || "", We = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
      return `
` + un + t + We;
    }
    var Rr = false;
    function Dr(t, e) {
      if (!t || Rr) return "";
      Rr = true;
      var a = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        var s = {
          DetermineComponentFrameRoot: function() {
            try {
              if (e) {
                var J = function() {
                  throw Error();
                };
                if (Object.defineProperty(J.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                }), typeof Reflect == "object" && Reflect.construct) {
                  try {
                    Reflect.construct(J, []);
                  } catch (Y) {
                    var H = Y;
                  }
                  Reflect.construct(t, [], J);
                } else {
                  try {
                    J.call();
                  } catch (Y) {
                    H = Y;
                  }
                  t.call(J.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (Y) {
                  H = Y;
                }
                (J = t()) && typeof J.catch == "function" && J.catch(function() {
                });
              }
            } catch (Y) {
              if (Y && H && typeof Y.stack == "string") return [
                Y.stack,
                H.stack
              ];
            }
            return [
              null,
              null
            ];
          }
        };
        s.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
        var c = Object.getOwnPropertyDescriptor(s.DetermineComponentFrameRoot, "name");
        c && c.configurable && Object.defineProperty(s.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot"
        });
        var u = s.DetermineComponentFrameRoot(), y = u[0], x = u[1];
        if (y && x) {
          var M = y.split(`
`), U = x.split(`
`);
          for (c = s = 0; s < M.length && !M[s].includes("DetermineComponentFrameRoot"); ) s++;
          for (; c < U.length && !U[c].includes("DetermineComponentFrameRoot"); ) c++;
          if (s === M.length || c === U.length) for (s = M.length - 1, c = U.length - 1; 1 <= s && 0 <= c && M[s] !== U[c]; ) c--;
          for (; 1 <= s && 0 <= c; s--, c--) if (M[s] !== U[c]) {
            if (s !== 1 || c !== 1) do
              if (s--, c--, 0 > c || M[s] !== U[c]) {
                var P = `
` + M[s].replace(" at new ", " at ");
                return t.displayName && P.includes("<anonymous>") && (P = P.replace("<anonymous>", t.displayName)), P;
              }
            while (1 <= s && 0 <= c);
            break;
          }
        }
      } finally {
        Rr = false, Error.prepareStackTrace = a;
      }
      return (a = t ? t.displayName || t.name : "") ? Le(a) : "";
    }
    function l1(t, e) {
      switch (t.tag) {
        case 26:
        case 27:
        case 5:
          return Le(t.type);
        case 16:
          return Le("Lazy");
        case 13:
          return t.child !== e && e !== null ? Le("Suspense Fallback") : Le("Suspense");
        case 19:
          return Le("SuspenseList");
        case 0:
        case 15:
          return Dr(t.type, false);
        case 11:
          return Dr(t.type.render, false);
        case 1:
          return Dr(t.type, true);
        case 31:
          return Le("Activity");
        default:
          return "";
      }
    }
    function Jd(t) {
      try {
        var e = "", a = null;
        do
          e += l1(t, a), a = t, t = t.return;
        while (t);
        return e;
      } catch (s) {
        return `
Error generating stack: ` + s.message + `
` + s.stack;
      }
    }
    var Or = Object.prototype.hasOwnProperty, jr = n.unstable_scheduleCallback, Nr = n.unstable_cancelCallback, o1 = n.unstable_shouldYield, r1 = n.unstable_requestPaint, Ae = n.unstable_now, c1 = n.unstable_getCurrentPriorityLevel, $d = n.unstable_ImmediatePriority, Wd = n.unstable_UserBlockingPriority, yl = n.unstable_NormalPriority, u1 = n.unstable_LowPriority, Id = n.unstable_IdlePriority, f1 = n.log, d1 = n.unstable_setDisableYieldValue, ss = null, Ee = null;
    function qn(t) {
      if (typeof f1 == "function" && d1(t), Ee && typeof Ee.setStrictMode == "function") try {
        Ee.setStrictMode(ss, t);
      } catch {
      }
    }
    var Ce = Math.clz32 ? Math.clz32 : p1, h1 = Math.log, m1 = Math.LN2;
    function p1(t) {
      return t >>>= 0, t === 0 ? 32 : 31 - (h1(t) / m1 | 0) | 0;
    }
    var vl = 256, bl = 262144, xl = 4194304;
    function Ei(t) {
      var e = t & 42;
      if (e !== 0) return e;
      switch (t & -t) {
        case 1:
          return 1;
        case 2:
          return 2;
        case 4:
          return 4;
        case 8:
          return 8;
        case 16:
          return 16;
        case 32:
          return 32;
        case 64:
          return 64;
        case 128:
          return 128;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
          return t & 261888;
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return t & 3932160;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return t & 62914560;
        case 67108864:
          return 67108864;
        case 134217728:
          return 134217728;
        case 268435456:
          return 268435456;
        case 536870912:
          return 536870912;
        case 1073741824:
          return 0;
        default:
          return t;
      }
    }
    function Sl(t, e, a) {
      var s = t.pendingLanes;
      if (s === 0) return 0;
      var c = 0, u = t.suspendedLanes, y = t.pingedLanes;
      t = t.warmLanes;
      var x = s & 134217727;
      return x !== 0 ? (s = x & ~u, s !== 0 ? c = Ei(s) : (y &= x, y !== 0 ? c = Ei(y) : a || (a = x & ~t, a !== 0 && (c = Ei(a))))) : (x = s & ~u, x !== 0 ? c = Ei(x) : y !== 0 ? c = Ei(y) : a || (a = s & ~t, a !== 0 && (c = Ei(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
    }
    function ls(t, e) {
      return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
    }
    function g1(t, e) {
      switch (t) {
        case 1:
        case 2:
        case 4:
        case 8:
        case 64:
          return e + 250;
        case 16:
        case 32:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return e + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return -1;
        case 67108864:
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
          return -1;
        default:
          return -1;
      }
    }
    function th() {
      var t = xl;
      return xl <<= 1, (xl & 62914560) === 0 && (xl = 4194304), t;
    }
    function zr(t) {
      for (var e = [], a = 0; 31 > a; a++) e.push(t);
      return e;
    }
    function os(t, e) {
      t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
    }
    function y1(t, e, a, s, c, u) {
      var y = t.pendingLanes;
      t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
      var x = t.entanglements, M = t.expirationTimes, U = t.hiddenUpdates;
      for (a = y & ~a; 0 < a; ) {
        var P = 31 - Ce(a), J = 1 << P;
        x[P] = 0, M[P] = -1;
        var H = U[P];
        if (H !== null) for (U[P] = null, P = 0; P < H.length; P++) {
          var Y = H[P];
          Y !== null && (Y.lane &= -536870913);
        }
        a &= ~J;
      }
      s !== 0 && eh(t, s, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(y & ~e));
    }
    function eh(t, e, a) {
      t.pendingLanes |= e, t.suspendedLanes &= ~e;
      var s = 31 - Ce(e);
      t.entangledLanes |= e, t.entanglements[s] = t.entanglements[s] | 1073741824 | a & 261930;
    }
    function nh(t, e) {
      var a = t.entangledLanes |= e;
      for (t = t.entanglements; a; ) {
        var s = 31 - Ce(a), c = 1 << s;
        c & e | t[s] & e && (t[s] |= e), a &= ~c;
      }
    }
    function ih(t, e) {
      var a = e & -e;
      return a = (a & 42) !== 0 ? 1 : _r(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
    }
    function _r(t) {
      switch (t) {
        case 2:
          t = 1;
          break;
        case 8:
          t = 4;
          break;
        case 32:
          t = 16;
          break;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          t = 128;
          break;
        case 268435456:
          t = 134217728;
          break;
        default:
          t = 0;
      }
      return t;
    }
    function Vr(t) {
      return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
    }
    function ah() {
      var t = F.p;
      return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : Pg(t.type));
    }
    function sh(t, e) {
      var a = F.p;
      try {
        return F.p = t, e();
      } finally {
        F.p = a;
      }
    }
    var Xn = Math.random().toString(36).slice(2), ae = "__reactFiber$" + Xn, ye = "__reactProps$" + Xn, ta = "__reactContainer$" + Xn, kr = "__reactEvents$" + Xn, v1 = "__reactListeners$" + Xn, b1 = "__reactHandles$" + Xn, lh = "__reactResources$" + Xn, rs = "__reactMarker$" + Xn;
    function Lr(t) {
      delete t[ae], delete t[ye], delete t[kr], delete t[v1], delete t[b1];
    }
    function ea(t) {
      var e = t[ae];
      if (e) return e;
      for (var a = t.parentNode; a; ) {
        if (e = a[ta] || a[ae]) {
          if (a = e.alternate, e.child !== null || a !== null && a.child !== null) for (t = Mg(t); t !== null; ) {
            if (a = t[ae]) return a;
            t = Mg(t);
          }
          return e;
        }
        t = a, a = t.parentNode;
      }
      return null;
    }
    function na(t) {
      if (t = t[ae] || t[ta]) {
        var e = t.tag;
        if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3) return t;
      }
      return null;
    }
    function cs(t) {
      var e = t.tag;
      if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
      throw Error(o(33));
    }
    function ia(t) {
      var e = t[lh];
      return e || (e = t[lh] = {
        hoistableStyles: /* @__PURE__ */ new Map(),
        hoistableScripts: /* @__PURE__ */ new Map()
      }), e;
    }
    function ne(t) {
      t[rs] = true;
    }
    var oh = /* @__PURE__ */ new Set(), rh = {};
    function Ci(t, e) {
      aa(t, e), aa(t + "Capture", e);
    }
    function aa(t, e) {
      for (rh[t] = e, t = 0; t < e.length; t++) oh.add(e[t]);
    }
    var x1 = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), ch = {}, uh = {};
    function S1(t) {
      return Or.call(uh, t) ? true : Or.call(ch, t) ? false : x1.test(t) ? uh[t] = true : (ch[t] = true, false);
    }
    function Tl(t, e, a) {
      if (S1(e)) if (a === null) t.removeAttribute(e);
      else {
        switch (typeof a) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var s = e.toLowerCase().slice(0, 5);
            if (s !== "data-" && s !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, "" + a);
      }
    }
    function wl(t, e, a) {
      if (a === null) t.removeAttribute(e);
      else {
        switch (typeof a) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            t.removeAttribute(e);
            return;
        }
        t.setAttribute(e, "" + a);
      }
    }
    function Tn(t, e, a, s) {
      if (s === null) t.removeAttribute(a);
      else {
        switch (typeof s) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            t.removeAttribute(a);
            return;
        }
        t.setAttributeNS(e, a, "" + s);
      }
    }
    function Be(t) {
      switch (typeof t) {
        case "bigint":
        case "boolean":
        case "number":
        case "string":
        case "undefined":
          return t;
        case "object":
          return t;
        default:
          return "";
      }
    }
    function fh(t) {
      var e = t.type;
      return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
    }
    function T1(t, e, a) {
      var s = Object.getOwnPropertyDescriptor(t.constructor.prototype, e);
      if (!t.hasOwnProperty(e) && typeof s < "u" && typeof s.get == "function" && typeof s.set == "function") {
        var c = s.get, u = s.set;
        return Object.defineProperty(t, e, {
          configurable: true,
          get: function() {
            return c.call(this);
          },
          set: function(y) {
            a = "" + y, u.call(this, y);
          }
        }), Object.defineProperty(t, e, {
          enumerable: s.enumerable
        }), {
          getValue: function() {
            return a;
          },
          setValue: function(y) {
            a = "" + y;
          },
          stopTracking: function() {
            t._valueTracker = null, delete t[e];
          }
        };
      }
    }
    function Br(t) {
      if (!t._valueTracker) {
        var e = fh(t) ? "checked" : "value";
        t._valueTracker = T1(t, e, "" + t[e]);
      }
    }
    function dh(t) {
      if (!t) return false;
      var e = t._valueTracker;
      if (!e) return true;
      var a = e.getValue(), s = "";
      return t && (s = fh(t) ? t.checked ? "true" : "false" : t.value), t = s, t !== a ? (e.setValue(t), true) : false;
    }
    function Al(t) {
      if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
      try {
        return t.activeElement || t.body;
      } catch {
        return t.body;
      }
    }
    var w1 = /[\n"\\]/g;
    function Ue(t) {
      return t.replace(w1, function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      });
    }
    function Ur(t, e, a, s, c, u, y, x) {
      t.name = "", y != null && typeof y != "function" && typeof y != "symbol" && typeof y != "boolean" ? t.type = y : t.removeAttribute("type"), e != null ? y === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + Be(e)) : t.value !== "" + Be(e) && (t.value = "" + Be(e)) : y !== "submit" && y !== "reset" || t.removeAttribute("value"), e != null ? Hr(t, y, Be(e)) : a != null ? Hr(t, y, Be(a)) : s != null && t.removeAttribute("value"), c == null && u != null && (t.defaultChecked = !!u), c != null && (t.checked = c && typeof c != "function" && typeof c != "symbol"), x != null && typeof x != "function" && typeof x != "symbol" && typeof x != "boolean" ? t.name = "" + Be(x) : t.removeAttribute("name");
    }
    function hh(t, e, a, s, c, u, y, x) {
      if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (t.type = u), e != null || a != null) {
        if (!(u !== "submit" && u !== "reset" || e != null)) {
          Br(t);
          return;
        }
        a = a != null ? "" + Be(a) : "", e = e != null ? "" + Be(e) : a, x || e === t.value || (t.value = e), t.defaultValue = e;
      }
      s = s ?? c, s = typeof s != "function" && typeof s != "symbol" && !!s, t.checked = x ? t.checked : !!s, t.defaultChecked = !!s, y != null && typeof y != "function" && typeof y != "symbol" && typeof y != "boolean" && (t.name = y), Br(t);
    }
    function Hr(t, e, a) {
      e === "number" && Al(t.ownerDocument) === t || t.defaultValue === "" + a || (t.defaultValue = "" + a);
    }
    function sa(t, e, a, s) {
      if (t = t.options, e) {
        e = {};
        for (var c = 0; c < a.length; c++) e["$" + a[c]] = true;
        for (a = 0; a < t.length; a++) c = e.hasOwnProperty("$" + t[a].value), t[a].selected !== c && (t[a].selected = c), c && s && (t[a].defaultSelected = true);
      } else {
        for (a = "" + Be(a), e = null, c = 0; c < t.length; c++) {
          if (t[c].value === a) {
            t[c].selected = true, s && (t[c].defaultSelected = true);
            return;
          }
          e !== null || t[c].disabled || (e = t[c]);
        }
        e !== null && (e.selected = true);
      }
    }
    function mh(t, e, a) {
      if (e != null && (e = "" + Be(e), e !== t.value && (t.value = e), a == null)) {
        t.defaultValue !== e && (t.defaultValue = e);
        return;
      }
      t.defaultValue = a != null ? "" + Be(a) : "";
    }
    function ph(t, e, a, s) {
      if (e == null) {
        if (s != null) {
          if (a != null) throw Error(o(92));
          if (mt(s)) {
            if (1 < s.length) throw Error(o(93));
            s = s[0];
          }
          a = s;
        }
        a == null && (a = ""), e = a;
      }
      a = Be(e), t.defaultValue = a, s = t.textContent, s === a && s !== "" && s !== null && (t.value = s), Br(t);
    }
    function la(t, e) {
      if (e) {
        var a = t.firstChild;
        if (a && a === t.lastChild && a.nodeType === 3) {
          a.nodeValue = e;
          return;
        }
      }
      t.textContent = e;
    }
    var A1 = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
    function gh(t, e, a) {
      var s = e.indexOf("--") === 0;
      a == null || typeof a == "boolean" || a === "" ? s ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : s ? t.setProperty(e, a) : typeof a != "number" || a === 0 || A1.has(e) ? e === "float" ? t.cssFloat = a : t[e] = ("" + a).trim() : t[e] = a + "px";
    }
    function yh(t, e, a) {
      if (e != null && typeof e != "object") throw Error(o(62));
      if (t = t.style, a != null) {
        for (var s in a) !a.hasOwnProperty(s) || e != null && e.hasOwnProperty(s) || (s.indexOf("--") === 0 ? t.setProperty(s, "") : s === "float" ? t.cssFloat = "" : t[s] = "");
        for (var c in e) s = e[c], e.hasOwnProperty(c) && a[c] !== s && gh(t, c, s);
      } else for (var u in e) e.hasOwnProperty(u) && gh(t, u, e[u]);
    }
    function Gr(t) {
      if (t.indexOf("-") === -1) return false;
      switch (t) {
        case "annotation-xml":
        case "color-profile":
        case "font-face":
        case "font-face-src":
        case "font-face-uri":
        case "font-face-format":
        case "font-face-name":
        case "missing-glyph":
          return false;
        default:
          return true;
      }
    }
    var E1 = /* @__PURE__ */ new Map([
      [
        "acceptCharset",
        "accept-charset"
      ],
      [
        "htmlFor",
        "for"
      ],
      [
        "httpEquiv",
        "http-equiv"
      ],
      [
        "crossOrigin",
        "crossorigin"
      ],
      [
        "accentHeight",
        "accent-height"
      ],
      [
        "alignmentBaseline",
        "alignment-baseline"
      ],
      [
        "arabicForm",
        "arabic-form"
      ],
      [
        "baselineShift",
        "baseline-shift"
      ],
      [
        "capHeight",
        "cap-height"
      ],
      [
        "clipPath",
        "clip-path"
      ],
      [
        "clipRule",
        "clip-rule"
      ],
      [
        "colorInterpolation",
        "color-interpolation"
      ],
      [
        "colorInterpolationFilters",
        "color-interpolation-filters"
      ],
      [
        "colorProfile",
        "color-profile"
      ],
      [
        "colorRendering",
        "color-rendering"
      ],
      [
        "dominantBaseline",
        "dominant-baseline"
      ],
      [
        "enableBackground",
        "enable-background"
      ],
      [
        "fillOpacity",
        "fill-opacity"
      ],
      [
        "fillRule",
        "fill-rule"
      ],
      [
        "floodColor",
        "flood-color"
      ],
      [
        "floodOpacity",
        "flood-opacity"
      ],
      [
        "fontFamily",
        "font-family"
      ],
      [
        "fontSize",
        "font-size"
      ],
      [
        "fontSizeAdjust",
        "font-size-adjust"
      ],
      [
        "fontStretch",
        "font-stretch"
      ],
      [
        "fontStyle",
        "font-style"
      ],
      [
        "fontVariant",
        "font-variant"
      ],
      [
        "fontWeight",
        "font-weight"
      ],
      [
        "glyphName",
        "glyph-name"
      ],
      [
        "glyphOrientationHorizontal",
        "glyph-orientation-horizontal"
      ],
      [
        "glyphOrientationVertical",
        "glyph-orientation-vertical"
      ],
      [
        "horizAdvX",
        "horiz-adv-x"
      ],
      [
        "horizOriginX",
        "horiz-origin-x"
      ],
      [
        "imageRendering",
        "image-rendering"
      ],
      [
        "letterSpacing",
        "letter-spacing"
      ],
      [
        "lightingColor",
        "lighting-color"
      ],
      [
        "markerEnd",
        "marker-end"
      ],
      [
        "markerMid",
        "marker-mid"
      ],
      [
        "markerStart",
        "marker-start"
      ],
      [
        "overlinePosition",
        "overline-position"
      ],
      [
        "overlineThickness",
        "overline-thickness"
      ],
      [
        "paintOrder",
        "paint-order"
      ],
      [
        "panose-1",
        "panose-1"
      ],
      [
        "pointerEvents",
        "pointer-events"
      ],
      [
        "renderingIntent",
        "rendering-intent"
      ],
      [
        "shapeRendering",
        "shape-rendering"
      ],
      [
        "stopColor",
        "stop-color"
      ],
      [
        "stopOpacity",
        "stop-opacity"
      ],
      [
        "strikethroughPosition",
        "strikethrough-position"
      ],
      [
        "strikethroughThickness",
        "strikethrough-thickness"
      ],
      [
        "strokeDasharray",
        "stroke-dasharray"
      ],
      [
        "strokeDashoffset",
        "stroke-dashoffset"
      ],
      [
        "strokeLinecap",
        "stroke-linecap"
      ],
      [
        "strokeLinejoin",
        "stroke-linejoin"
      ],
      [
        "strokeMiterlimit",
        "stroke-miterlimit"
      ],
      [
        "strokeOpacity",
        "stroke-opacity"
      ],
      [
        "strokeWidth",
        "stroke-width"
      ],
      [
        "textAnchor",
        "text-anchor"
      ],
      [
        "textDecoration",
        "text-decoration"
      ],
      [
        "textRendering",
        "text-rendering"
      ],
      [
        "transformOrigin",
        "transform-origin"
      ],
      [
        "underlinePosition",
        "underline-position"
      ],
      [
        "underlineThickness",
        "underline-thickness"
      ],
      [
        "unicodeBidi",
        "unicode-bidi"
      ],
      [
        "unicodeRange",
        "unicode-range"
      ],
      [
        "unitsPerEm",
        "units-per-em"
      ],
      [
        "vAlphabetic",
        "v-alphabetic"
      ],
      [
        "vHanging",
        "v-hanging"
      ],
      [
        "vIdeographic",
        "v-ideographic"
      ],
      [
        "vMathematical",
        "v-mathematical"
      ],
      [
        "vectorEffect",
        "vector-effect"
      ],
      [
        "vertAdvY",
        "vert-adv-y"
      ],
      [
        "vertOriginX",
        "vert-origin-x"
      ],
      [
        "vertOriginY",
        "vert-origin-y"
      ],
      [
        "wordSpacing",
        "word-spacing"
      ],
      [
        "writingMode",
        "writing-mode"
      ],
      [
        "xmlnsXlink",
        "xmlns:xlink"
      ],
      [
        "xHeight",
        "x-height"
      ]
    ]), C1 = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    function El(t) {
      return C1.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
    }
    function wn() {
    }
    var Yr = null;
    function Pr(t) {
      return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
    }
    var oa = null, ra = null;
    function vh(t) {
      var e = na(t);
      if (e && (t = e.stateNode)) {
        var a = t[ye] || null;
        t: switch (t = e.stateNode, e.type) {
          case "input":
            if (Ur(t, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name), e = a.name, a.type === "radio" && e != null) {
              for (a = t; a.parentNode; ) a = a.parentNode;
              for (a = a.querySelectorAll('input[name="' + Ue("" + e) + '"][type="radio"]'), e = 0; e < a.length; e++) {
                var s = a[e];
                if (s !== t && s.form === t.form) {
                  var c = s[ye] || null;
                  if (!c) throw Error(o(90));
                  Ur(s, c.value, c.defaultValue, c.defaultValue, c.checked, c.defaultChecked, c.type, c.name);
                }
              }
              for (e = 0; e < a.length; e++) s = a[e], s.form === t.form && dh(s);
            }
            break t;
          case "textarea":
            mh(t, a.value, a.defaultValue);
            break t;
          case "select":
            e = a.value, e != null && sa(t, !!a.multiple, e, false);
        }
      }
    }
    var qr = false;
    function bh(t, e, a) {
      if (qr) return t(e, a);
      qr = true;
      try {
        var s = t(e);
        return s;
      } finally {
        if (qr = false, (oa !== null || ra !== null) && (ho(), oa && (e = oa, t = ra, ra = oa = null, vh(e), t))) for (e = 0; e < t.length; e++) vh(t[e]);
      }
    }
    function us(t, e) {
      var a = t.stateNode;
      if (a === null) return null;
      var s = a[ye] || null;
      if (s === null) return null;
      a = s[e];
      t: switch (e) {
        case "onClick":
        case "onClickCapture":
        case "onDoubleClick":
        case "onDoubleClickCapture":
        case "onMouseDown":
        case "onMouseDownCapture":
        case "onMouseMove":
        case "onMouseMoveCapture":
        case "onMouseUp":
        case "onMouseUpCapture":
        case "onMouseEnter":
          (s = !s.disabled) || (t = t.type, s = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !s;
          break t;
        default:
          t = false;
      }
      if (t) return null;
      if (a && typeof a != "function") throw Error(o(231, e, typeof a));
      return a;
    }
    var An = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Xr = false;
    if (An) try {
      var fs = {};
      Object.defineProperty(fs, "passive", {
        get: function() {
          Xr = true;
        }
      }), window.addEventListener("test", fs, fs), window.removeEventListener("test", fs, fs);
    } catch {
      Xr = false;
    }
    var Kn = null, Kr = null, Cl = null;
    function xh() {
      if (Cl) return Cl;
      var t, e = Kr, a = e.length, s, c = "value" in Kn ? Kn.value : Kn.textContent, u = c.length;
      for (t = 0; t < a && e[t] === c[t]; t++) ;
      var y = a - t;
      for (s = 1; s <= y && e[a - s] === c[u - s]; s++) ;
      return Cl = c.slice(t, 1 < s ? 1 - s : void 0);
    }
    function Ml(t) {
      var e = t.keyCode;
      return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
    }
    function Rl() {
      return true;
    }
    function Sh() {
      return false;
    }
    function ve(t) {
      function e(a, s, c, u, y) {
        this._reactName = a, this._targetInst = c, this.type = s, this.nativeEvent = u, this.target = y, this.currentTarget = null;
        for (var x in t) t.hasOwnProperty(x) && (a = t[x], this[x] = a ? a(u) : u[x]);
        return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === false) ? Rl : Sh, this.isPropagationStopped = Sh, this;
      }
      return v(e.prototype, {
        preventDefault: function() {
          this.defaultPrevented = true;
          var a = this.nativeEvent;
          a && (a.preventDefault ? a.preventDefault() : typeof a.returnValue != "unknown" && (a.returnValue = false), this.isDefaultPrevented = Rl);
        },
        stopPropagation: function() {
          var a = this.nativeEvent;
          a && (a.stopPropagation ? a.stopPropagation() : typeof a.cancelBubble != "unknown" && (a.cancelBubble = true), this.isPropagationStopped = Rl);
        },
        persist: function() {
        },
        isPersistent: Rl
      }), e;
    }
    var Mi = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function(t) {
        return t.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0
    }, Dl = ve(Mi), ds = v({}, Mi, {
      view: 0,
      detail: 0
    }), M1 = ve(ds), Zr, Qr, hs, Ol = v({}, ds, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: Jr,
      button: 0,
      buttons: 0,
      relatedTarget: function(t) {
        return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
      },
      movementX: function(t) {
        return "movementX" in t ? t.movementX : (t !== hs && (hs && t.type === "mousemove" ? (Zr = t.screenX - hs.screenX, Qr = t.screenY - hs.screenY) : Qr = Zr = 0, hs = t), Zr);
      },
      movementY: function(t) {
        return "movementY" in t ? t.movementY : Qr;
      }
    }), Th = ve(Ol), R1 = v({}, Ol, {
      dataTransfer: 0
    }), D1 = ve(R1), O1 = v({}, ds, {
      relatedTarget: 0
    }), Fr = ve(O1), j1 = v({}, Mi, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), N1 = ve(j1), z1 = v({}, Mi, {
      clipboardData: function(t) {
        return "clipboardData" in t ? t.clipboardData : window.clipboardData;
      }
    }), _1 = ve(z1), V1 = v({}, Mi, {
      data: 0
    }), wh = ve(V1), k1 = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified"
    }, L1 = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta"
    }, B1 = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey"
    };
    function U1(t) {
      var e = this.nativeEvent;
      return e.getModifierState ? e.getModifierState(t) : (t = B1[t]) ? !!e[t] : false;
    }
    function Jr() {
      return U1;
    }
    var H1 = v({}, ds, {
      key: function(t) {
        if (t.key) {
          var e = k1[t.key] || t.key;
          if (e !== "Unidentified") return e;
        }
        return t.type === "keypress" ? (t = Ml(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? L1[t.keyCode] || "Unidentified" : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Jr,
      charCode: function(t) {
        return t.type === "keypress" ? Ml(t) : 0;
      },
      keyCode: function(t) {
        return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      },
      which: function(t) {
        return t.type === "keypress" ? Ml(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      }
    }), G1 = ve(H1), Y1 = v({}, Ol, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0
    }), Ah = ve(Y1), P1 = v({}, ds, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Jr
    }), q1 = ve(P1), X1 = v({}, Mi, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), K1 = ve(X1), Z1 = v({}, Ol, {
      deltaX: function(t) {
        return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
      },
      deltaY: function(t) {
        return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    }), Q1 = ve(Z1), F1 = v({}, Mi, {
      newState: 0,
      oldState: 0
    }), J1 = ve(F1), $1 = [
      9,
      13,
      27,
      32
    ], $r = An && "CompositionEvent" in window, ms = null;
    An && "documentMode" in document && (ms = document.documentMode);
    var W1 = An && "TextEvent" in window && !ms, Eh = An && (!$r || ms && 8 < ms && 11 >= ms), Ch = " ", Mh = false;
    function Rh(t, e) {
      switch (t) {
        case "keyup":
          return $1.indexOf(e.keyCode) !== -1;
        case "keydown":
          return e.keyCode !== 229;
        case "keypress":
        case "mousedown":
        case "focusout":
          return true;
        default:
          return false;
      }
    }
    function Dh(t) {
      return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
    }
    var ca = false;
    function I1(t, e) {
      switch (t) {
        case "compositionend":
          return Dh(e);
        case "keypress":
          return e.which !== 32 ? null : (Mh = true, Ch);
        case "textInput":
          return t = e.data, t === Ch && Mh ? null : t;
        default:
          return null;
      }
    }
    function tS(t, e) {
      if (ca) return t === "compositionend" || !$r && Rh(t, e) ? (t = xh(), Cl = Kr = Kn = null, ca = false, t) : null;
      switch (t) {
        case "paste":
          return null;
        case "keypress":
          if (!(e.ctrlKey || e.altKey || e.metaKey) || e.ctrlKey && e.altKey) {
            if (e.char && 1 < e.char.length) return e.char;
            if (e.which) return String.fromCharCode(e.which);
          }
          return null;
        case "compositionend":
          return Eh && e.locale !== "ko" ? null : e.data;
        default:
          return null;
      }
    }
    var eS = {
      color: true,
      date: true,
      datetime: true,
      "datetime-local": true,
      email: true,
      month: true,
      number: true,
      password: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true
    };
    function Oh(t) {
      var e = t && t.nodeName && t.nodeName.toLowerCase();
      return e === "input" ? !!eS[t.type] : e === "textarea";
    }
    function jh(t, e, a, s) {
      oa ? ra ? ra.push(s) : ra = [
        s
      ] : oa = s, e = xo(e, "onChange"), 0 < e.length && (a = new Dl("onChange", "change", null, a, s), t.push({
        event: a,
        listeners: e
      }));
    }
    var ps = null, gs = null;
    function nS(t) {
      hg(t, 0);
    }
    function jl(t) {
      var e = cs(t);
      if (dh(e)) return t;
    }
    function Nh(t, e) {
      if (t === "change") return e;
    }
    var zh = false;
    if (An) {
      var Wr;
      if (An) {
        var Ir = "oninput" in document;
        if (!Ir) {
          var _h = document.createElement("div");
          _h.setAttribute("oninput", "return;"), Ir = typeof _h.oninput == "function";
        }
        Wr = Ir;
      } else Wr = false;
      zh = Wr && (!document.documentMode || 9 < document.documentMode);
    }
    function Vh() {
      ps && (ps.detachEvent("onpropertychange", kh), gs = ps = null);
    }
    function kh(t) {
      if (t.propertyName === "value" && jl(gs)) {
        var e = [];
        jh(e, gs, t, Pr(t)), bh(nS, e);
      }
    }
    function iS(t, e, a) {
      t === "focusin" ? (Vh(), ps = e, gs = a, ps.attachEvent("onpropertychange", kh)) : t === "focusout" && Vh();
    }
    function aS(t) {
      if (t === "selectionchange" || t === "keyup" || t === "keydown") return jl(gs);
    }
    function sS(t, e) {
      if (t === "click") return jl(e);
    }
    function lS(t, e) {
      if (t === "input" || t === "change") return jl(e);
    }
    function oS(t, e) {
      return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
    }
    var Me = typeof Object.is == "function" ? Object.is : oS;
    function ys(t, e) {
      if (Me(t, e)) return true;
      if (typeof t != "object" || t === null || typeof e != "object" || e === null) return false;
      var a = Object.keys(t), s = Object.keys(e);
      if (a.length !== s.length) return false;
      for (s = 0; s < a.length; s++) {
        var c = a[s];
        if (!Or.call(e, c) || !Me(t[c], e[c])) return false;
      }
      return true;
    }
    function Lh(t) {
      for (; t && t.firstChild; ) t = t.firstChild;
      return t;
    }
    function Bh(t, e) {
      var a = Lh(t);
      t = 0;
      for (var s; a; ) {
        if (a.nodeType === 3) {
          if (s = t + a.textContent.length, t <= e && s >= e) return {
            node: a,
            offset: e - t
          };
          t = s;
        }
        t: {
          for (; a; ) {
            if (a.nextSibling) {
              a = a.nextSibling;
              break t;
            }
            a = a.parentNode;
          }
          a = void 0;
        }
        a = Lh(a);
      }
    }
    function Uh(t, e) {
      return t && e ? t === e ? true : t && t.nodeType === 3 ? false : e && e.nodeType === 3 ? Uh(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : false : false;
    }
    function Hh(t) {
      t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
      for (var e = Al(t.document); e instanceof t.HTMLIFrameElement; ) {
        try {
          var a = typeof e.contentWindow.location.href == "string";
        } catch {
          a = false;
        }
        if (a) t = e.contentWindow;
        else break;
        e = Al(t.document);
      }
      return e;
    }
    function tc(t) {
      var e = t && t.nodeName && t.nodeName.toLowerCase();
      return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
    }
    var rS = An && "documentMode" in document && 11 >= document.documentMode, ua = null, ec = null, vs = null, nc = false;
    function Gh(t, e, a) {
      var s = a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
      nc || ua == null || ua !== Al(s) || (s = ua, "selectionStart" in s && tc(s) ? s = {
        start: s.selectionStart,
        end: s.selectionEnd
      } : (s = (s.ownerDocument && s.ownerDocument.defaultView || window).getSelection(), s = {
        anchorNode: s.anchorNode,
        anchorOffset: s.anchorOffset,
        focusNode: s.focusNode,
        focusOffset: s.focusOffset
      }), vs && ys(vs, s) || (vs = s, s = xo(ec, "onSelect"), 0 < s.length && (e = new Dl("onSelect", "select", null, e, a), t.push({
        event: e,
        listeners: s
      }), e.target = ua)));
    }
    function Ri(t, e) {
      var a = {};
      return a[t.toLowerCase()] = e.toLowerCase(), a["Webkit" + t] = "webkit" + e, a["Moz" + t] = "moz" + e, a;
    }
    var fa = {
      animationend: Ri("Animation", "AnimationEnd"),
      animationiteration: Ri("Animation", "AnimationIteration"),
      animationstart: Ri("Animation", "AnimationStart"),
      transitionrun: Ri("Transition", "TransitionRun"),
      transitionstart: Ri("Transition", "TransitionStart"),
      transitioncancel: Ri("Transition", "TransitionCancel"),
      transitionend: Ri("Transition", "TransitionEnd")
    }, ic = {}, Yh = {};
    An && (Yh = document.createElement("div").style, "AnimationEvent" in window || (delete fa.animationend.animation, delete fa.animationiteration.animation, delete fa.animationstart.animation), "TransitionEvent" in window || delete fa.transitionend.transition);
    function Di(t) {
      if (ic[t]) return ic[t];
      if (!fa[t]) return t;
      var e = fa[t], a;
      for (a in e) if (e.hasOwnProperty(a) && a in Yh) return ic[t] = e[a];
      return t;
    }
    var Ph = Di("animationend"), qh = Di("animationiteration"), Xh = Di("animationstart"), cS = Di("transitionrun"), uS = Di("transitionstart"), fS = Di("transitioncancel"), Kh = Di("transitionend"), Zh = /* @__PURE__ */ new Map(), ac = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
    ac.push("scrollEnd");
    function Ie(t, e) {
      Zh.set(t, e), Ci(e, [
        t
      ]);
    }
    var Nl = typeof reportError == "function" ? reportError : function(t) {
      if (typeof window == "object" && typeof window.ErrorEvent == "function") {
        var e = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof t == "object" && t !== null && typeof t.message == "string" ? String(t.message) : String(t),
          error: t
        });
        if (!window.dispatchEvent(e)) return;
      } else if (typeof process == "object" && typeof process.emit == "function") {
        process.emit("uncaughtException", t);
        return;
      }
      console.error(t);
    }, He = [], da = 0, sc = 0;
    function zl() {
      for (var t = da, e = sc = da = 0; e < t; ) {
        var a = He[e];
        He[e++] = null;
        var s = He[e];
        He[e++] = null;
        var c = He[e];
        He[e++] = null;
        var u = He[e];
        if (He[e++] = null, s !== null && c !== null) {
          var y = s.pending;
          y === null ? c.next = c : (c.next = y.next, y.next = c), s.pending = c;
        }
        u !== 0 && Qh(a, c, u);
      }
    }
    function _l(t, e, a, s) {
      He[da++] = t, He[da++] = e, He[da++] = a, He[da++] = s, sc |= s, t.lanes |= s, t = t.alternate, t !== null && (t.lanes |= s);
    }
    function lc(t, e, a, s) {
      return _l(t, e, a, s), Vl(t);
    }
    function Oi(t, e) {
      return _l(t, null, null, e), Vl(t);
    }
    function Qh(t, e, a) {
      t.lanes |= a;
      var s = t.alternate;
      s !== null && (s.lanes |= a);
      for (var c = false, u = t.return; u !== null; ) u.childLanes |= a, s = u.alternate, s !== null && (s.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = true)), t = u, u = u.return;
      return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - Ce(a), t = u.hiddenUpdates, s = t[c], s === null ? t[c] = [
        e
      ] : s.push(e), e.lane = a | 536870912), u) : null;
    }
    function Vl(t) {
      if (50 < Hs) throw Hs = 0, pu = null, Error(o(185));
      for (var e = t.return; e !== null; ) t = e, e = t.return;
      return t.tag === 3 ? t.stateNode : null;
    }
    var ha = {};
    function dS(t, e, a, s) {
      this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = s, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
    }
    function Re(t, e, a, s) {
      return new dS(t, e, a, s);
    }
    function oc(t) {
      return t = t.prototype, !(!t || !t.isReactComponent);
    }
    function En(t, e) {
      var a = t.alternate;
      return a === null ? (a = Re(t.tag, e, t.key, t.mode), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
        lanes: e.lanes,
        firstContext: e.firstContext
      }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
    }
    function Fh(t, e) {
      t.flags &= 65011714;
      var a = t.alternate;
      return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
        lanes: e.lanes,
        firstContext: e.firstContext
      }), t;
    }
    function kl(t, e, a, s, c, u) {
      var y = 0;
      if (s = t, typeof t == "function") oc(t) && (y = 1);
      else if (typeof t == "string") y = yT(t, a, W.current) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
      else t: switch (t) {
        case tt:
          return t = Re(31, a, e, c), t.elementType = tt, t.lanes = u, t;
        case C:
          return ji(a.children, c, u, e);
        case R:
          y = 8, c |= 24;
          break;
        case O:
          return t = Re(12, a, e, c | 2), t.elementType = O, t.lanes = u, t;
        case q:
          return t = Re(13, a, e, c), t.elementType = q, t.lanes = u, t;
        case $:
          return t = Re(19, a, e, c), t.elementType = $, t.lanes = u, t;
        default:
          if (typeof t == "object" && t !== null) switch (t.$$typeof) {
            case z:
              y = 10;
              break t;
            case L:
              y = 9;
              break t;
            case V:
              y = 11;
              break t;
            case X:
              y = 14;
              break t;
            case G:
              y = 16, s = null;
              break t;
          }
          y = 29, a = Error(o(130, t === null ? "null" : typeof t, "")), s = null;
      }
      return e = Re(y, a, e, c), e.elementType = t, e.type = s, e.lanes = u, e;
    }
    function ji(t, e, a, s) {
      return t = Re(7, t, s, e), t.lanes = a, t;
    }
    function rc(t, e, a) {
      return t = Re(6, t, null, e), t.lanes = a, t;
    }
    function Jh(t) {
      var e = Re(18, null, null, 0);
      return e.stateNode = t, e;
    }
    function cc(t, e, a) {
      return e = Re(4, t.children !== null ? t.children : [], t.key, e), e.lanes = a, e.stateNode = {
        containerInfo: t.containerInfo,
        pendingChildren: null,
        implementation: t.implementation
      }, e;
    }
    var $h = /* @__PURE__ */ new WeakMap();
    function Ge(t, e) {
      if (typeof t == "object" && t !== null) {
        var a = $h.get(t);
        return a !== void 0 ? a : (e = {
          value: t,
          source: e,
          stack: Jd(e)
        }, $h.set(t, e), e);
      }
      return {
        value: t,
        source: e,
        stack: Jd(e)
      };
    }
    var ma = [], pa = 0, Ll = null, bs = 0, Ye = [], Pe = 0, Zn = null, fn = 1, dn = "";
    function Cn(t, e) {
      ma[pa++] = bs, ma[pa++] = Ll, Ll = t, bs = e;
    }
    function Wh(t, e, a) {
      Ye[Pe++] = fn, Ye[Pe++] = dn, Ye[Pe++] = Zn, Zn = t;
      var s = fn;
      t = dn;
      var c = 32 - Ce(s) - 1;
      s &= ~(1 << c), a += 1;
      var u = 32 - Ce(e) + c;
      if (30 < u) {
        var y = c - c % 5;
        u = (s & (1 << y) - 1).toString(32), s >>= y, c -= y, fn = 1 << 32 - Ce(e) + c | a << c | s, dn = u + t;
      } else fn = 1 << u | a << c | s, dn = t;
    }
    function uc(t) {
      t.return !== null && (Cn(t, 1), Wh(t, 1, 0));
    }
    function fc(t) {
      for (; t === Ll; ) Ll = ma[--pa], ma[pa] = null, bs = ma[--pa], ma[pa] = null;
      for (; t === Zn; ) Zn = Ye[--Pe], Ye[Pe] = null, dn = Ye[--Pe], Ye[Pe] = null, fn = Ye[--Pe], Ye[Pe] = null;
    }
    function Ih(t, e) {
      Ye[Pe++] = fn, Ye[Pe++] = dn, Ye[Pe++] = Zn, fn = e.id, dn = e.overflow, Zn = t;
    }
    var se = null, Bt = null, Ct = false, Qn = null, qe = false, dc = Error(o(519));
    function Fn(t) {
      var e = Error(o(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", ""));
      throw xs(Ge(e, t)), dc;
    }
    function tm(t) {
      var e = t.stateNode, a = t.type, s = t.memoizedProps;
      switch (e[ae] = t, e[ye] = s, a) {
        case "dialog":
          wt("cancel", e), wt("close", e);
          break;
        case "iframe":
        case "object":
        case "embed":
          wt("load", e);
          break;
        case "video":
        case "audio":
          for (a = 0; a < Ys.length; a++) wt(Ys[a], e);
          break;
        case "source":
          wt("error", e);
          break;
        case "img":
        case "image":
        case "link":
          wt("error", e), wt("load", e);
          break;
        case "details":
          wt("toggle", e);
          break;
        case "input":
          wt("invalid", e), hh(e, s.value, s.defaultValue, s.checked, s.defaultChecked, s.type, s.name, true);
          break;
        case "select":
          wt("invalid", e);
          break;
        case "textarea":
          wt("invalid", e), ph(e, s.value, s.defaultValue, s.children);
      }
      a = s.children, typeof a != "string" && typeof a != "number" && typeof a != "bigint" || e.textContent === "" + a || s.suppressHydrationWarning === true || yg(e.textContent, a) ? (s.popover != null && (wt("beforetoggle", e), wt("toggle", e)), s.onScroll != null && wt("scroll", e), s.onScrollEnd != null && wt("scrollend", e), s.onClick != null && (e.onclick = wn), e = true) : e = false, e || Fn(t, true);
    }
    function em(t) {
      for (se = t.return; se; ) switch (se.tag) {
        case 5:
        case 31:
        case 13:
          qe = false;
          return;
        case 27:
        case 3:
          qe = true;
          return;
        default:
          se = se.return;
      }
    }
    function ga(t) {
      if (t !== se) return false;
      if (!Ct) return em(t), Ct = true, false;
      var e = t.tag, a;
      if ((a = e !== 3 && e !== 27) && ((a = e === 5) && (a = t.type, a = !(a !== "form" && a !== "button") || Ou(t.type, t.memoizedProps)), a = !a), a && Bt && Fn(t), em(t), e === 13) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Bt = Cg(t);
      } else if (e === 31) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Bt = Cg(t);
      } else e === 27 ? (e = Bt, ci(t.type) ? (t = Vu, Vu = null, Bt = t) : Bt = e) : Bt = se ? Ke(t.stateNode.nextSibling) : null;
      return true;
    }
    function Ni() {
      Bt = se = null, Ct = false;
    }
    function hc() {
      var t = Qn;
      return t !== null && (Te === null ? Te = t : Te.push.apply(Te, t), Qn = null), t;
    }
    function xs(t) {
      Qn === null ? Qn = [
        t
      ] : Qn.push(t);
    }
    var mc = E(null), zi = null, Mn = null;
    function Jn(t, e, a) {
      K(mc, e._currentValue), e._currentValue = a;
    }
    function Rn(t) {
      t._currentValue = mc.current, j(mc);
    }
    function pc(t, e, a) {
      for (; t !== null; ) {
        var s = t.alternate;
        if ((t.childLanes & e) !== e ? (t.childLanes |= e, s !== null && (s.childLanes |= e)) : s !== null && (s.childLanes & e) !== e && (s.childLanes |= e), t === a) break;
        t = t.return;
      }
    }
    function gc(t, e, a, s) {
      var c = t.child;
      for (c !== null && (c.return = t); c !== null; ) {
        var u = c.dependencies;
        if (u !== null) {
          var y = c.child;
          u = u.firstContext;
          t: for (; u !== null; ) {
            var x = u;
            u = c;
            for (var M = 0; M < e.length; M++) if (x.context === e[M]) {
              u.lanes |= a, x = u.alternate, x !== null && (x.lanes |= a), pc(u.return, a, t), s || (y = null);
              break t;
            }
            u = x.next;
          }
        } else if (c.tag === 18) {
          if (y = c.return, y === null) throw Error(o(341));
          y.lanes |= a, u = y.alternate, u !== null && (u.lanes |= a), pc(y, a, t), y = null;
        } else y = c.child;
        if (y !== null) y.return = c;
        else for (y = c; y !== null; ) {
          if (y === t) {
            y = null;
            break;
          }
          if (c = y.sibling, c !== null) {
            c.return = y.return, y = c;
            break;
          }
          y = y.return;
        }
        c = y;
      }
    }
    function ya(t, e, a, s) {
      t = null;
      for (var c = e, u = false; c !== null; ) {
        if (!u) {
          if ((c.flags & 524288) !== 0) u = true;
          else if ((c.flags & 262144) !== 0) break;
        }
        if (c.tag === 10) {
          var y = c.alternate;
          if (y === null) throw Error(o(387));
          if (y = y.memoizedProps, y !== null) {
            var x = c.type;
            Me(c.pendingProps.value, y.value) || (t !== null ? t.push(x) : t = [
              x
            ]);
          }
        } else if (c === dt.current) {
          if (y = c.alternate, y === null) throw Error(o(387));
          y.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(Zs) : t = [
            Zs
          ]);
        }
        c = c.return;
      }
      t !== null && gc(e, t, a, s), e.flags |= 262144;
    }
    function Bl(t) {
      for (t = t.firstContext; t !== null; ) {
        if (!Me(t.context._currentValue, t.memoizedValue)) return true;
        t = t.next;
      }
      return false;
    }
    function _i(t) {
      zi = t, Mn = null, t = t.dependencies, t !== null && (t.firstContext = null);
    }
    function le(t) {
      return nm(zi, t);
    }
    function Ul(t, e) {
      return zi === null && _i(t), nm(t, e);
    }
    function nm(t, e) {
      var a = e._currentValue;
      if (e = {
        context: e,
        memoizedValue: a,
        next: null
      }, Mn === null) {
        if (t === null) throw Error(o(308));
        Mn = e, t.dependencies = {
          lanes: 0,
          firstContext: e
        }, t.flags |= 524288;
      } else Mn = Mn.next = e;
      return a;
    }
    var hS = typeof AbortController < "u" ? AbortController : function() {
      var t = [], e = this.signal = {
        aborted: false,
        addEventListener: function(a, s) {
          t.push(s);
        }
      };
      this.abort = function() {
        e.aborted = true, t.forEach(function(a) {
          return a();
        });
      };
    }, mS = n.unstable_scheduleCallback, pS = n.unstable_NormalPriority, Qt = {
      $$typeof: z,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0
    };
    function yc() {
      return {
        controller: new hS(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function Ss(t) {
      t.refCount--, t.refCount === 0 && mS(pS, function() {
        t.controller.abort();
      });
    }
    var Ts = null, vc = 0, va = 0, ba = null;
    function gS(t, e) {
      if (Ts === null) {
        var a = Ts = [];
        vc = 0, va = Su(), ba = {
          status: "pending",
          value: void 0,
          then: function(s) {
            a.push(s);
          }
        };
      }
      return vc++, e.then(im, im), e;
    }
    function im() {
      if (--vc === 0 && Ts !== null) {
        ba !== null && (ba.status = "fulfilled");
        var t = Ts;
        Ts = null, va = 0, ba = null;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
    }
    function yS(t, e) {
      var a = [], s = {
        status: "pending",
        value: null,
        reason: null,
        then: function(c) {
          a.push(c);
        }
      };
      return t.then(function() {
        s.status = "fulfilled", s.value = e;
        for (var c = 0; c < a.length; c++) (0, a[c])(e);
      }, function(c) {
        for (s.status = "rejected", s.reason = c, c = 0; c < a.length; c++) (0, a[c])(void 0);
      }), s;
    }
    var am = k.S;
    k.S = function(t, e) {
      Gp = Ae(), typeof e == "object" && e !== null && typeof e.then == "function" && gS(t, e), am !== null && am(t, e);
    };
    var Vi = E(null);
    function bc() {
      var t = Vi.current;
      return t !== null ? t : kt.pooledCache;
    }
    function Hl(t, e) {
      e === null ? K(Vi, Vi.current) : K(Vi, e.pool);
    }
    function sm() {
      var t = bc();
      return t === null ? null : {
        parent: Qt._currentValue,
        pool: t
      };
    }
    var xa = Error(o(460)), xc = Error(o(474)), Gl = Error(o(542)), Yl = {
      then: function() {
      }
    };
    function lm(t) {
      return t = t.status, t === "fulfilled" || t === "rejected";
    }
    function om(t, e, a) {
      switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(wn, wn), e = a), e.status) {
        case "fulfilled":
          return e.value;
        case "rejected":
          throw t = e.reason, cm(t), t;
        default:
          if (typeof e.status == "string") e.then(wn, wn);
          else {
            if (t = kt, t !== null && 100 < t.shellSuspendCounter) throw Error(o(482));
            t = e, t.status = "pending", t.then(function(s) {
              if (e.status === "pending") {
                var c = e;
                c.status = "fulfilled", c.value = s;
              }
            }, function(s) {
              if (e.status === "pending") {
                var c = e;
                c.status = "rejected", c.reason = s;
              }
            });
          }
          switch (e.status) {
            case "fulfilled":
              return e.value;
            case "rejected":
              throw t = e.reason, cm(t), t;
          }
          throw Li = e, xa;
      }
    }
    function ki(t) {
      try {
        var e = t._init;
        return e(t._payload);
      } catch (a) {
        throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Li = a, xa) : a;
      }
    }
    var Li = null;
    function rm() {
      if (Li === null) throw Error(o(459));
      var t = Li;
      return Li = null, t;
    }
    function cm(t) {
      if (t === xa || t === Gl) throw Error(o(483));
    }
    var Sa = null, ws = 0;
    function Pl(t) {
      var e = ws;
      return ws += 1, Sa === null && (Sa = []), om(Sa, t, e);
    }
    function As(t, e) {
      e = e.props.ref, t.ref = e !== void 0 ? e : null;
    }
    function ql(t, e) {
      throw e.$$typeof === b ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t)));
    }
    function um(t) {
      function e(_, D) {
        if (t) {
          var B = _.deletions;
          B === null ? (_.deletions = [
            D
          ], _.flags |= 16) : B.push(D);
        }
      }
      function a(_, D) {
        if (!t) return null;
        for (; D !== null; ) e(_, D), D = D.sibling;
        return null;
      }
      function s(_) {
        for (var D = /* @__PURE__ */ new Map(); _ !== null; ) _.key !== null ? D.set(_.key, _) : D.set(_.index, _), _ = _.sibling;
        return D;
      }
      function c(_, D) {
        return _ = En(_, D), _.index = 0, _.sibling = null, _;
      }
      function u(_, D, B) {
        return _.index = B, t ? (B = _.alternate, B !== null ? (B = B.index, B < D ? (_.flags |= 67108866, D) : B) : (_.flags |= 67108866, D)) : (_.flags |= 1048576, D);
      }
      function y(_) {
        return t && _.alternate === null && (_.flags |= 67108866), _;
      }
      function x(_, D, B, Q) {
        return D === null || D.tag !== 6 ? (D = rc(B, _.mode, Q), D.return = _, D) : (D = c(D, B), D.return = _, D);
      }
      function M(_, D, B, Q) {
        var ft = B.type;
        return ft === C ? P(_, D, B.props.children, Q, B.key) : D !== null && (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === G && ki(ft) === D.type) ? (D = c(D, B.props), As(D, B), D.return = _, D) : (D = kl(B.type, B.key, B.props, null, _.mode, Q), As(D, B), D.return = _, D);
      }
      function U(_, D, B, Q) {
        return D === null || D.tag !== 4 || D.stateNode.containerInfo !== B.containerInfo || D.stateNode.implementation !== B.implementation ? (D = cc(B, _.mode, Q), D.return = _, D) : (D = c(D, B.children || []), D.return = _, D);
      }
      function P(_, D, B, Q, ft) {
        return D === null || D.tag !== 7 ? (D = ji(B, _.mode, Q, ft), D.return = _, D) : (D = c(D, B), D.return = _, D);
      }
      function J(_, D, B) {
        if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint") return D = rc("" + D, _.mode, B), D.return = _, D;
        if (typeof D == "object" && D !== null) {
          switch (D.$$typeof) {
            case T:
              return B = kl(D.type, D.key, D.props, null, _.mode, B), As(B, D), B.return = _, B;
            case A:
              return D = cc(D, _.mode, B), D.return = _, D;
            case G:
              return D = ki(D), J(_, D, B);
          }
          if (mt(D) || st(D)) return D = ji(D, _.mode, B, null), D.return = _, D;
          if (typeof D.then == "function") return J(_, Pl(D), B);
          if (D.$$typeof === z) return J(_, Ul(_, D), B);
          ql(_, D);
        }
        return null;
      }
      function H(_, D, B, Q) {
        var ft = D !== null ? D.key : null;
        if (typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint") return ft !== null ? null : x(_, D, "" + B, Q);
        if (typeof B == "object" && B !== null) {
          switch (B.$$typeof) {
            case T:
              return B.key === ft ? M(_, D, B, Q) : null;
            case A:
              return B.key === ft ? U(_, D, B, Q) : null;
            case G:
              return B = ki(B), H(_, D, B, Q);
          }
          if (mt(B) || st(B)) return ft !== null ? null : P(_, D, B, Q, null);
          if (typeof B.then == "function") return H(_, D, Pl(B), Q);
          if (B.$$typeof === z) return H(_, D, Ul(_, B), Q);
          ql(_, B);
        }
        return null;
      }
      function Y(_, D, B, Q, ft) {
        if (typeof Q == "string" && Q !== "" || typeof Q == "number" || typeof Q == "bigint") return _ = _.get(B) || null, x(D, _, "" + Q, ft);
        if (typeof Q == "object" && Q !== null) {
          switch (Q.$$typeof) {
            case T:
              return _ = _.get(Q.key === null ? B : Q.key) || null, M(D, _, Q, ft);
            case A:
              return _ = _.get(Q.key === null ? B : Q.key) || null, U(D, _, Q, ft);
            case G:
              return Q = ki(Q), Y(_, D, B, Q, ft);
          }
          if (mt(Q) || st(Q)) return _ = _.get(B) || null, P(D, _, Q, ft, null);
          if (typeof Q.then == "function") return Y(_, D, B, Pl(Q), ft);
          if (Q.$$typeof === z) return Y(_, D, B, Ul(D, Q), ft);
          ql(D, Q);
        }
        return null;
      }
      function lt(_, D, B, Q) {
        for (var ft = null, Mt = null, ut = D, xt = D = 0, Et = null; ut !== null && xt < B.length; xt++) {
          ut.index > xt ? (Et = ut, ut = null) : Et = ut.sibling;
          var Rt = H(_, ut, B[xt], Q);
          if (Rt === null) {
            ut === null && (ut = Et);
            break;
          }
          t && ut && Rt.alternate === null && e(_, ut), D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt, ut = Et;
        }
        if (xt === B.length) return a(_, ut), Ct && Cn(_, xt), ft;
        if (ut === null) {
          for (; xt < B.length; xt++) ut = J(_, B[xt], Q), ut !== null && (D = u(ut, D, xt), Mt === null ? ft = ut : Mt.sibling = ut, Mt = ut);
          return Ct && Cn(_, xt), ft;
        }
        for (ut = s(ut); xt < B.length; xt++) Et = Y(ut, _, xt, B[xt], Q), Et !== null && (t && Et.alternate !== null && ut.delete(Et.key === null ? xt : Et.key), D = u(Et, D, xt), Mt === null ? ft = Et : Mt.sibling = Et, Mt = Et);
        return t && ut.forEach(function(mi) {
          return e(_, mi);
        }), Ct && Cn(_, xt), ft;
      }
      function pt(_, D, B, Q) {
        if (B == null) throw Error(o(151));
        for (var ft = null, Mt = null, ut = D, xt = D = 0, Et = null, Rt = B.next(); ut !== null && !Rt.done; xt++, Rt = B.next()) {
          ut.index > xt ? (Et = ut, ut = null) : Et = ut.sibling;
          var mi = H(_, ut, Rt.value, Q);
          if (mi === null) {
            ut === null && (ut = Et);
            break;
          }
          t && ut && mi.alternate === null && e(_, ut), D = u(mi, D, xt), Mt === null ? ft = mi : Mt.sibling = mi, Mt = mi, ut = Et;
        }
        if (Rt.done) return a(_, ut), Ct && Cn(_, xt), ft;
        if (ut === null) {
          for (; !Rt.done; xt++, Rt = B.next()) Rt = J(_, Rt.value, Q), Rt !== null && (D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt);
          return Ct && Cn(_, xt), ft;
        }
        for (ut = s(ut); !Rt.done; xt++, Rt = B.next()) Rt = Y(ut, _, xt, Rt.value, Q), Rt !== null && (t && Rt.alternate !== null && ut.delete(Rt.key === null ? xt : Rt.key), D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt);
        return t && ut.forEach(function(RT) {
          return e(_, RT);
        }), Ct && Cn(_, xt), ft;
      }
      function Vt(_, D, B, Q) {
        if (typeof B == "object" && B !== null && B.type === C && B.key === null && (B = B.props.children), typeof B == "object" && B !== null) {
          switch (B.$$typeof) {
            case T:
              t: {
                for (var ft = B.key; D !== null; ) {
                  if (D.key === ft) {
                    if (ft = B.type, ft === C) {
                      if (D.tag === 7) {
                        a(_, D.sibling), Q = c(D, B.props.children), Q.return = _, _ = Q;
                        break t;
                      }
                    } else if (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === G && ki(ft) === D.type) {
                      a(_, D.sibling), Q = c(D, B.props), As(Q, B), Q.return = _, _ = Q;
                      break t;
                    }
                    a(_, D);
                    break;
                  } else e(_, D);
                  D = D.sibling;
                }
                B.type === C ? (Q = ji(B.props.children, _.mode, Q, B.key), Q.return = _, _ = Q) : (Q = kl(B.type, B.key, B.props, null, _.mode, Q), As(Q, B), Q.return = _, _ = Q);
              }
              return y(_);
            case A:
              t: {
                for (ft = B.key; D !== null; ) {
                  if (D.key === ft) if (D.tag === 4 && D.stateNode.containerInfo === B.containerInfo && D.stateNode.implementation === B.implementation) {
                    a(_, D.sibling), Q = c(D, B.children || []), Q.return = _, _ = Q;
                    break t;
                  } else {
                    a(_, D);
                    break;
                  }
                  else e(_, D);
                  D = D.sibling;
                }
                Q = cc(B, _.mode, Q), Q.return = _, _ = Q;
              }
              return y(_);
            case G:
              return B = ki(B), Vt(_, D, B, Q);
          }
          if (mt(B)) return lt(_, D, B, Q);
          if (st(B)) {
            if (ft = st(B), typeof ft != "function") throw Error(o(150));
            return B = ft.call(B), pt(_, D, B, Q);
          }
          if (typeof B.then == "function") return Vt(_, D, Pl(B), Q);
          if (B.$$typeof === z) return Vt(_, D, Ul(_, B), Q);
          ql(_, B);
        }
        return typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint" ? (B = "" + B, D !== null && D.tag === 6 ? (a(_, D.sibling), Q = c(D, B), Q.return = _, _ = Q) : (a(_, D), Q = rc(B, _.mode, Q), Q.return = _, _ = Q), y(_)) : a(_, D);
      }
      return function(_, D, B, Q) {
        try {
          ws = 0;
          var ft = Vt(_, D, B, Q);
          return Sa = null, ft;
        } catch (ut) {
          if (ut === xa || ut === Gl) throw ut;
          var Mt = Re(29, ut, null, _.mode);
          return Mt.lanes = Q, Mt.return = _, Mt;
        } finally {
        }
      };
    }
    var Bi = um(true), fm = um(false), $n = false;
    function Sc(t) {
      t.updateQueue = {
        baseState: t.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: {
          pending: null,
          lanes: 0,
          hiddenCallbacks: null
        },
        callbacks: null
      };
    }
    function Tc(t, e) {
      t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
        baseState: t.baseState,
        firstBaseUpdate: t.firstBaseUpdate,
        lastBaseUpdate: t.lastBaseUpdate,
        shared: t.shared,
        callbacks: null
      });
    }
    function Wn(t) {
      return {
        lane: t,
        tag: 0,
        payload: null,
        callback: null,
        next: null
      };
    }
    function In(t, e, a) {
      var s = t.updateQueue;
      if (s === null) return null;
      if (s = s.shared, (Dt & 2) !== 0) {
        var c = s.pending;
        return c === null ? e.next = e : (e.next = c.next, c.next = e), s.pending = e, e = Vl(t), Qh(t, null, a), e;
      }
      return _l(t, s, e, a), Vl(t);
    }
    function Es(t, e, a) {
      if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
        var s = e.lanes;
        s &= t.pendingLanes, a |= s, e.lanes = a, nh(t, a);
      }
    }
    function wc(t, e) {
      var a = t.updateQueue, s = t.alternate;
      if (s !== null && (s = s.updateQueue, a === s)) {
        var c = null, u = null;
        if (a = a.firstBaseUpdate, a !== null) {
          do {
            var y = {
              lane: a.lane,
              tag: a.tag,
              payload: a.payload,
              callback: null,
              next: null
            };
            u === null ? c = u = y : u = u.next = y, a = a.next;
          } while (a !== null);
          u === null ? c = u = e : u = u.next = e;
        } else c = u = e;
        a = {
          baseState: s.baseState,
          firstBaseUpdate: c,
          lastBaseUpdate: u,
          shared: s.shared,
          callbacks: s.callbacks
        }, t.updateQueue = a;
        return;
      }
      t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
    }
    var Ac = false;
    function Cs() {
      if (Ac) {
        var t = ba;
        if (t !== null) throw t;
      }
    }
    function Ms(t, e, a, s) {
      Ac = false;
      var c = t.updateQueue;
      $n = false;
      var u = c.firstBaseUpdate, y = c.lastBaseUpdate, x = c.shared.pending;
      if (x !== null) {
        c.shared.pending = null;
        var M = x, U = M.next;
        M.next = null, y === null ? u = U : y.next = U, y = M;
        var P = t.alternate;
        P !== null && (P = P.updateQueue, x = P.lastBaseUpdate, x !== y && (x === null ? P.firstBaseUpdate = U : x.next = U, P.lastBaseUpdate = M));
      }
      if (u !== null) {
        var J = c.baseState;
        y = 0, P = U = M = null, x = u;
        do {
          var H = x.lane & -536870913, Y = H !== x.lane;
          if (Y ? (At & H) === H : (s & H) === H) {
            H !== 0 && H === va && (Ac = true), P !== null && (P = P.next = {
              lane: 0,
              tag: x.tag,
              payload: x.payload,
              callback: null,
              next: null
            });
            t: {
              var lt = t, pt = x;
              H = e;
              var Vt = a;
              switch (pt.tag) {
                case 1:
                  if (lt = pt.payload, typeof lt == "function") {
                    J = lt.call(Vt, J, H);
                    break t;
                  }
                  J = lt;
                  break t;
                case 3:
                  lt.flags = lt.flags & -65537 | 128;
                case 0:
                  if (lt = pt.payload, H = typeof lt == "function" ? lt.call(Vt, J, H) : lt, H == null) break t;
                  J = v({}, J, H);
                  break t;
                case 2:
                  $n = true;
              }
            }
            H = x.callback, H !== null && (t.flags |= 64, Y && (t.flags |= 8192), Y = c.callbacks, Y === null ? c.callbacks = [
              H
            ] : Y.push(H));
          } else Y = {
            lane: H,
            tag: x.tag,
            payload: x.payload,
            callback: x.callback,
            next: null
          }, P === null ? (U = P = Y, M = J) : P = P.next = Y, y |= H;
          if (x = x.next, x === null) {
            if (x = c.shared.pending, x === null) break;
            Y = x, x = Y.next, Y.next = null, c.lastBaseUpdate = Y, c.shared.pending = null;
          }
        } while (true);
        P === null && (M = J), c.baseState = M, c.firstBaseUpdate = U, c.lastBaseUpdate = P, u === null && (c.shared.lanes = 0), ai |= y, t.lanes = y, t.memoizedState = J;
      }
    }
    function dm(t, e) {
      if (typeof t != "function") throw Error(o(191, t));
      t.call(e);
    }
    function hm(t, e) {
      var a = t.callbacks;
      if (a !== null) for (t.callbacks = null, t = 0; t < a.length; t++) dm(a[t], e);
    }
    var Ta = E(null), Xl = E(0);
    function mm(t, e) {
      t = Ln, K(Xl, t), K(Ta, e), Ln = t | e.baseLanes;
    }
    function Ec() {
      K(Xl, Ln), K(Ta, Ta.current);
    }
    function Cc() {
      Ln = Xl.current, j(Ta), j(Xl);
    }
    var De = E(null), Xe = null;
    function ti(t) {
      var e = t.alternate;
      K(Kt, Kt.current & 1), K(De, t), Xe === null && (e === null || Ta.current !== null || e.memoizedState !== null) && (Xe = t);
    }
    function Mc(t) {
      K(Kt, Kt.current), K(De, t), Xe === null && (Xe = t);
    }
    function pm(t) {
      t.tag === 22 ? (K(Kt, Kt.current), K(De, t), Xe === null && (Xe = t)) : ei();
    }
    function ei() {
      K(Kt, Kt.current), K(De, De.current);
    }
    function Oe(t) {
      j(De), Xe === t && (Xe = null), j(Kt);
    }
    var Kt = E(0);
    function Kl(t) {
      for (var e = t; e !== null; ) {
        if (e.tag === 13) {
          var a = e.memoizedState;
          if (a !== null && (a = a.dehydrated, a === null || zu(a) || _u(a))) return e;
        } else if (e.tag === 19 && (e.memoizedProps.revealOrder === "forwards" || e.memoizedProps.revealOrder === "backwards" || e.memoizedProps.revealOrder === "unstable_legacy-backwards" || e.memoizedProps.revealOrder === "together")) {
          if ((e.flags & 128) !== 0) return e;
        } else if (e.child !== null) {
          e.child.return = e, e = e.child;
          continue;
        }
        if (e === t) break;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) return null;
          e = e.return;
        }
        e.sibling.return = e.return, e = e.sibling;
      }
      return null;
    }
    var Dn = 0, bt = null, zt = null, Ft = null, Zl = false, wa = false, Ui = false, Ql = 0, Rs = 0, Aa = null, vS = 0;
    function Pt() {
      throw Error(o(321));
    }
    function Rc(t, e) {
      if (e === null) return false;
      for (var a = 0; a < e.length && a < t.length; a++) if (!Me(t[a], e[a])) return false;
      return true;
    }
    function Dc(t, e, a, s, c, u) {
      return Dn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, k.H = t === null || t.memoizedState === null ? Wm : qc, Ui = false, u = a(s, c), Ui = false, wa && (u = ym(e, a, s, c)), gm(t), u;
    }
    function gm(t) {
      k.H = js;
      var e = zt !== null && zt.next !== null;
      if (Dn = 0, Ft = zt = bt = null, Zl = false, Rs = 0, Aa = null, e) throw Error(o(300));
      t === null || Jt || (t = t.dependencies, t !== null && Bl(t) && (Jt = true));
    }
    function ym(t, e, a, s) {
      bt = t;
      var c = 0;
      do {
        if (wa && (Aa = null), Rs = 0, wa = false, 25 <= c) throw Error(o(301));
        if (c += 1, Ft = zt = null, t.updateQueue != null) {
          var u = t.updateQueue;
          u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
        }
        k.H = Im, u = e(a, s);
      } while (wa);
      return u;
    }
    function bS() {
      var t = k.H, e = t.useState()[0];
      return e = typeof e.then == "function" ? Ds(e) : e, t = t.useState()[0], (zt !== null ? zt.memoizedState : null) !== t && (bt.flags |= 1024), e;
    }
    function Oc() {
      var t = Ql !== 0;
      return Ql = 0, t;
    }
    function jc(t, e, a) {
      e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
    }
    function Nc(t) {
      if (Zl) {
        for (t = t.memoizedState; t !== null; ) {
          var e = t.queue;
          e !== null && (e.pending = null), t = t.next;
        }
        Zl = false;
      }
      Dn = 0, Ft = zt = bt = null, wa = false, Rs = Ql = 0, Aa = null;
    }
    function de() {
      var t = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
      };
      return Ft === null ? bt.memoizedState = Ft = t : Ft = Ft.next = t, Ft;
    }
    function Zt() {
      if (zt === null) {
        var t = bt.alternate;
        t = t !== null ? t.memoizedState : null;
      } else t = zt.next;
      var e = Ft === null ? bt.memoizedState : Ft.next;
      if (e !== null) Ft = e, zt = t;
      else {
        if (t === null) throw bt.alternate === null ? Error(o(467)) : Error(o(310));
        zt = t, t = {
          memoizedState: zt.memoizedState,
          baseState: zt.baseState,
          baseQueue: zt.baseQueue,
          queue: zt.queue,
          next: null
        }, Ft === null ? bt.memoizedState = Ft = t : Ft = Ft.next = t;
      }
      return Ft;
    }
    function Fl() {
      return {
        lastEffect: null,
        events: null,
        stores: null,
        memoCache: null
      };
    }
    function Ds(t) {
      var e = Rs;
      return Rs += 1, Aa === null && (Aa = []), t = om(Aa, t, e), e = bt, (Ft === null ? e.memoizedState : Ft.next) === null && (e = e.alternate, k.H = e === null || e.memoizedState === null ? Wm : qc), t;
    }
    function Jl(t) {
      if (t !== null && typeof t == "object") {
        if (typeof t.then == "function") return Ds(t);
        if (t.$$typeof === z) return le(t);
      }
      throw Error(o(438, String(t)));
    }
    function zc(t) {
      var e = null, a = bt.updateQueue;
      if (a !== null && (e = a.memoCache), e == null) {
        var s = bt.alternate;
        s !== null && (s = s.updateQueue, s !== null && (s = s.memoCache, s != null && (e = {
          data: s.data.map(function(c) {
            return c.slice();
          }),
          index: 0
        })));
      }
      if (e == null && (e = {
        data: [],
        index: 0
      }), a === null && (a = Fl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0) for (a = e.data[e.index] = Array(t), s = 0; s < t; s++) a[s] = I;
      return e.index++, a;
    }
    function On(t, e) {
      return typeof e == "function" ? e(t) : e;
    }
    function $l(t) {
      var e = Zt();
      return _c(e, zt, t);
    }
    function _c(t, e, a) {
      var s = t.queue;
      if (s === null) throw Error(o(311));
      s.lastRenderedReducer = a;
      var c = t.baseQueue, u = s.pending;
      if (u !== null) {
        if (c !== null) {
          var y = c.next;
          c.next = u.next, u.next = y;
        }
        e.baseQueue = c = u, s.pending = null;
      }
      if (u = t.baseState, c === null) t.memoizedState = u;
      else {
        e = c.next;
        var x = y = null, M = null, U = e, P = false;
        do {
          var J = U.lane & -536870913;
          if (J !== U.lane ? (At & J) === J : (Dn & J) === J) {
            var H = U.revertLane;
            if (H === 0) M !== null && (M = M.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: U.action,
              hasEagerState: U.hasEagerState,
              eagerState: U.eagerState,
              next: null
            }), J === va && (P = true);
            else if ((Dn & H) === H) {
              U = U.next, H === va && (P = true);
              continue;
            } else J = {
              lane: 0,
              revertLane: U.revertLane,
              gesture: null,
              action: U.action,
              hasEagerState: U.hasEagerState,
              eagerState: U.eagerState,
              next: null
            }, M === null ? (x = M = J, y = u) : M = M.next = J, bt.lanes |= H, ai |= H;
            J = U.action, Ui && a(u, J), u = U.hasEagerState ? U.eagerState : a(u, J);
          } else H = {
            lane: J,
            revertLane: U.revertLane,
            gesture: U.gesture,
            action: U.action,
            hasEagerState: U.hasEagerState,
            eagerState: U.eagerState,
            next: null
          }, M === null ? (x = M = H, y = u) : M = M.next = H, bt.lanes |= J, ai |= J;
          U = U.next;
        } while (U !== null && U !== e);
        if (M === null ? y = u : M.next = x, !Me(u, t.memoizedState) && (Jt = true, P && (a = ba, a !== null))) throw a;
        t.memoizedState = u, t.baseState = y, t.baseQueue = M, s.lastRenderedState = u;
      }
      return c === null && (s.lanes = 0), [
        t.memoizedState,
        s.dispatch
      ];
    }
    function Vc(t) {
      var e = Zt(), a = e.queue;
      if (a === null) throw Error(o(311));
      a.lastRenderedReducer = t;
      var s = a.dispatch, c = a.pending, u = e.memoizedState;
      if (c !== null) {
        a.pending = null;
        var y = c = c.next;
        do
          u = t(u, y.action), y = y.next;
        while (y !== c);
        Me(u, e.memoizedState) || (Jt = true), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
      }
      return [
        u,
        s
      ];
    }
    function vm(t, e, a) {
      var s = bt, c = Zt(), u = Ct;
      if (u) {
        if (a === void 0) throw Error(o(407));
        a = a();
      } else a = e();
      var y = !Me((zt || c).memoizedState, a);
      if (y && (c.memoizedState = a, Jt = true), c = c.queue, Bc(Sm.bind(null, s, c, t), [
        t
      ]), c.getSnapshot !== e || y || Ft !== null && Ft.memoizedState.tag & 1) {
        if (s.flags |= 2048, Ea(9, {
          destroy: void 0
        }, xm.bind(null, s, c, a, e), null), kt === null) throw Error(o(349));
        u || (Dn & 127) !== 0 || bm(s, e, a);
      }
      return a;
    }
    function bm(t, e, a) {
      t.flags |= 16384, t = {
        getSnapshot: e,
        value: a
      }, e = bt.updateQueue, e === null ? (e = Fl(), bt.updateQueue = e, e.stores = [
        t
      ]) : (a = e.stores, a === null ? e.stores = [
        t
      ] : a.push(t));
    }
    function xm(t, e, a, s) {
      e.value = a, e.getSnapshot = s, Tm(e) && wm(t);
    }
    function Sm(t, e, a) {
      return a(function() {
        Tm(e) && wm(t);
      });
    }
    function Tm(t) {
      var e = t.getSnapshot;
      t = t.value;
      try {
        var a = e();
        return !Me(t, a);
      } catch {
        return true;
      }
    }
    function wm(t) {
      var e = Oi(t, 2);
      e !== null && we(e, t, 2);
    }
    function kc(t) {
      var e = de();
      if (typeof t == "function") {
        var a = t;
        if (t = a(), Ui) {
          qn(true);
          try {
            a();
          } finally {
            qn(false);
          }
        }
      }
      return e.memoizedState = e.baseState = t, e.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: On,
        lastRenderedState: t
      }, e;
    }
    function Am(t, e, a, s) {
      return t.baseState = a, _c(t, zt, typeof s == "function" ? s : On);
    }
    function xS(t, e, a, s, c) {
      if (to(t)) throw Error(o(485));
      if (t = e.action, t !== null) {
        var u = {
          payload: c,
          action: t,
          next: null,
          isTransition: true,
          status: "pending",
          value: null,
          reason: null,
          listeners: [],
          then: function(y) {
            u.listeners.push(y);
          }
        };
        k.T !== null ? a(true) : u.isTransition = false, s(u), a = e.pending, a === null ? (u.next = e.pending = u, Em(e, u)) : (u.next = a.next, e.pending = a.next = u);
      }
    }
    function Em(t, e) {
      var a = e.action, s = e.payload, c = t.state;
      if (e.isTransition) {
        var u = k.T, y = {};
        k.T = y;
        try {
          var x = a(c, s), M = k.S;
          M !== null && M(y, x), Cm(t, e, x);
        } catch (U) {
          Lc(t, e, U);
        } finally {
          u !== null && y.types !== null && (u.types = y.types), k.T = u;
        }
      } else try {
        u = a(c, s), Cm(t, e, u);
      } catch (U) {
        Lc(t, e, U);
      }
    }
    function Cm(t, e, a) {
      a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(function(s) {
        Mm(t, e, s);
      }, function(s) {
        return Lc(t, e, s);
      }) : Mm(t, e, a);
    }
    function Mm(t, e, a) {
      e.status = "fulfilled", e.value = a, Rm(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Em(t, a)));
    }
    function Lc(t, e, a) {
      var s = t.pending;
      if (t.pending = null, s !== null) {
        s = s.next;
        do
          e.status = "rejected", e.reason = a, Rm(e), e = e.next;
        while (e !== s);
      }
      t.action = null;
    }
    function Rm(t) {
      t = t.listeners;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
    function Dm(t, e) {
      return e;
    }
    function Om(t, e) {
      if (Ct) {
        var a = kt.formState;
        if (a !== null) {
          t: {
            var s = bt;
            if (Ct) {
              if (Bt) {
                e: {
                  for (var c = Bt, u = qe; c.nodeType !== 8; ) {
                    if (!u) {
                      c = null;
                      break e;
                    }
                    if (c = Ke(c.nextSibling), c === null) {
                      c = null;
                      break e;
                    }
                  }
                  u = c.data, c = u === "F!" || u === "F" ? c : null;
                }
                if (c) {
                  Bt = Ke(c.nextSibling), s = c.data === "F!";
                  break t;
                }
              }
              Fn(s);
            }
            s = false;
          }
          s && (e = a[0]);
        }
      }
      return a = de(), a.memoizedState = a.baseState = e, s = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Dm,
        lastRenderedState: e
      }, a.queue = s, a = Fm.bind(null, bt, s), s.dispatch = a, s = kc(false), u = Pc.bind(null, bt, false, s.queue), s = de(), c = {
        state: e,
        dispatch: null,
        action: t,
        pending: null
      }, s.queue = c, a = xS.bind(null, bt, c, u, a), c.dispatch = a, s.memoizedState = t, [
        e,
        a,
        false
      ];
    }
    function jm(t) {
      var e = Zt();
      return Nm(e, zt, t);
    }
    function Nm(t, e, a) {
      if (e = _c(t, e, Dm)[0], t = $l(On)[0], typeof e == "object" && e !== null && typeof e.then == "function") try {
        var s = Ds(e);
      } catch (y) {
        throw y === xa ? Gl : y;
      }
      else s = e;
      e = Zt();
      var c = e.queue, u = c.dispatch;
      return a !== e.memoizedState && (bt.flags |= 2048, Ea(9, {
        destroy: void 0
      }, SS.bind(null, c, a), null)), [
        s,
        u,
        t
      ];
    }
    function SS(t, e) {
      t.action = e;
    }
    function zm(t) {
      var e = Zt(), a = zt;
      if (a !== null) return Nm(e, a, t);
      Zt(), e = e.memoizedState, a = Zt();
      var s = a.queue.dispatch;
      return a.memoizedState = t, [
        e,
        s,
        false
      ];
    }
    function Ea(t, e, a, s) {
      return t = {
        tag: t,
        create: a,
        deps: s,
        inst: e,
        next: null
      }, e = bt.updateQueue, e === null && (e = Fl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (s = a.next, a.next = t, t.next = s, e.lastEffect = t), t;
    }
    function _m() {
      return Zt().memoizedState;
    }
    function Wl(t, e, a, s) {
      var c = de();
      bt.flags |= t, c.memoizedState = Ea(1 | e, {
        destroy: void 0
      }, a, s === void 0 ? null : s);
    }
    function Il(t, e, a, s) {
      var c = Zt();
      s = s === void 0 ? null : s;
      var u = c.memoizedState.inst;
      zt !== null && s !== null && Rc(s, zt.memoizedState.deps) ? c.memoizedState = Ea(e, u, a, s) : (bt.flags |= t, c.memoizedState = Ea(1 | e, u, a, s));
    }
    function Vm(t, e) {
      Wl(8390656, 8, t, e);
    }
    function Bc(t, e) {
      Il(2048, 8, t, e);
    }
    function TS(t) {
      bt.flags |= 4;
      var e = bt.updateQueue;
      if (e === null) e = Fl(), bt.updateQueue = e, e.events = [
        t
      ];
      else {
        var a = e.events;
        a === null ? e.events = [
          t
        ] : a.push(t);
      }
    }
    function km(t) {
      var e = Zt().memoizedState;
      return TS({
        ref: e,
        nextImpl: t
      }), function() {
        if ((Dt & 2) !== 0) throw Error(o(440));
        return e.impl.apply(void 0, arguments);
      };
    }
    function Lm(t, e) {
      return Il(4, 2, t, e);
    }
    function Bm(t, e) {
      return Il(4, 4, t, e);
    }
    function Um(t, e) {
      if (typeof e == "function") {
        t = t();
        var a = e(t);
        return function() {
          typeof a == "function" ? a() : e(null);
        };
      }
      if (e != null) return t = t(), e.current = t, function() {
        e.current = null;
      };
    }
    function Hm(t, e, a) {
      a = a != null ? a.concat([
        t
      ]) : null, Il(4, 4, Um.bind(null, e, t), a);
    }
    function Uc() {
    }
    function Gm(t, e) {
      var a = Zt();
      e = e === void 0 ? null : e;
      var s = a.memoizedState;
      return e !== null && Rc(e, s[1]) ? s[0] : (a.memoizedState = [
        t,
        e
      ], t);
    }
    function Ym(t, e) {
      var a = Zt();
      e = e === void 0 ? null : e;
      var s = a.memoizedState;
      if (e !== null && Rc(e, s[1])) return s[0];
      if (s = t(), Ui) {
        qn(true);
        try {
          t();
        } finally {
          qn(false);
        }
      }
      return a.memoizedState = [
        s,
        e
      ], s;
    }
    function Hc(t, e, a) {
      return a === void 0 || (Dn & 1073741824) !== 0 && (At & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Pp(), bt.lanes |= t, ai |= t, a);
    }
    function Pm(t, e, a, s) {
      return Me(a, e) ? a : Ta.current !== null ? (t = Hc(t, a, s), Me(t, e) || (Jt = true), t) : (Dn & 42) === 0 || (Dn & 1073741824) !== 0 && (At & 261930) === 0 ? (Jt = true, t.memoizedState = a) : (t = Pp(), bt.lanes |= t, ai |= t, e);
    }
    function qm(t, e, a, s, c) {
      var u = F.p;
      F.p = u !== 0 && 8 > u ? u : 8;
      var y = k.T, x = {};
      k.T = x, Pc(t, false, e, a);
      try {
        var M = c(), U = k.S;
        if (U !== null && U(x, M), M !== null && typeof M == "object" && typeof M.then == "function") {
          var P = yS(M, s);
          Os(t, e, P, ze(t));
        } else Os(t, e, s, ze(t));
      } catch (J) {
        Os(t, e, {
          then: function() {
          },
          status: "rejected",
          reason: J
        }, ze());
      } finally {
        F.p = u, y !== null && x.types !== null && (y.types = x.types), k.T = y;
      }
    }
    function wS() {
    }
    function Gc(t, e, a, s) {
      if (t.tag !== 5) throw Error(o(476));
      var c = Xm(t).queue;
      qm(t, c, e, Z, a === null ? wS : function() {
        return Km(t), a(s);
      });
    }
    function Xm(t) {
      var e = t.memoizedState;
      if (e !== null) return e;
      e = {
        memoizedState: Z,
        baseState: Z,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: On,
          lastRenderedState: Z
        },
        next: null
      };
      var a = {};
      return e.next = {
        memoizedState: a,
        baseState: a,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: On,
          lastRenderedState: a
        },
        next: null
      }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
    }
    function Km(t) {
      var e = Xm(t);
      e.next === null && (e = t.alternate.memoizedState), Os(t, e.next.queue, {}, ze());
    }
    function Yc() {
      return le(Zs);
    }
    function Zm() {
      return Zt().memoizedState;
    }
    function Qm() {
      return Zt().memoizedState;
    }
    function AS(t) {
      for (var e = t.return; e !== null; ) {
        switch (e.tag) {
          case 24:
          case 3:
            var a = ze();
            t = Wn(a);
            var s = In(e, t, a);
            s !== null && (we(s, e, a), Es(s, e, a)), e = {
              cache: yc()
            }, t.payload = e;
            return;
        }
        e = e.return;
      }
    }
    function ES(t, e, a) {
      var s = ze();
      a = {
        lane: s,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, to(t) ? Jm(e, a) : (a = lc(t, e, a, s), a !== null && (we(a, t, s), $m(a, e, s)));
    }
    function Fm(t, e, a) {
      var s = ze();
      Os(t, e, a, s);
    }
    function Os(t, e, a, s) {
      var c = {
        lane: s,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (to(t)) Jm(e, c);
      else {
        var u = t.alternate;
        if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null)) try {
          var y = e.lastRenderedState, x = u(y, a);
          if (c.hasEagerState = true, c.eagerState = x, Me(x, y)) return _l(t, e, c, 0), kt === null && zl(), false;
        } catch {
        } finally {
        }
        if (a = lc(t, e, c, s), a !== null) return we(a, t, s), $m(a, e, s), true;
      }
      return false;
    }
    function Pc(t, e, a, s) {
      if (s = {
        lane: 2,
        revertLane: Su(),
        gesture: null,
        action: s,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, to(t)) {
        if (e) throw Error(o(479));
      } else e = lc(t, a, s, 2), e !== null && we(e, t, 2);
    }
    function to(t) {
      var e = t.alternate;
      return t === bt || e !== null && e === bt;
    }
    function Jm(t, e) {
      wa = Zl = true;
      var a = t.pending;
      a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
    }
    function $m(t, e, a) {
      if ((a & 4194048) !== 0) {
        var s = e.lanes;
        s &= t.pendingLanes, a |= s, e.lanes = a, nh(t, a);
      }
    }
    var js = {
      readContext: le,
      use: Jl,
      useCallback: Pt,
      useContext: Pt,
      useEffect: Pt,
      useImperativeHandle: Pt,
      useLayoutEffect: Pt,
      useInsertionEffect: Pt,
      useMemo: Pt,
      useReducer: Pt,
      useRef: Pt,
      useState: Pt,
      useDebugValue: Pt,
      useDeferredValue: Pt,
      useTransition: Pt,
      useSyncExternalStore: Pt,
      useId: Pt,
      useHostTransitionStatus: Pt,
      useFormState: Pt,
      useActionState: Pt,
      useOptimistic: Pt,
      useMemoCache: Pt,
      useCacheRefresh: Pt
    };
    js.useEffectEvent = Pt;
    var Wm = {
      readContext: le,
      use: Jl,
      useCallback: function(t, e) {
        return de().memoizedState = [
          t,
          e === void 0 ? null : e
        ], t;
      },
      useContext: le,
      useEffect: Vm,
      useImperativeHandle: function(t, e, a) {
        a = a != null ? a.concat([
          t
        ]) : null, Wl(4194308, 4, Um.bind(null, e, t), a);
      },
      useLayoutEffect: function(t, e) {
        return Wl(4194308, 4, t, e);
      },
      useInsertionEffect: function(t, e) {
        Wl(4, 2, t, e);
      },
      useMemo: function(t, e) {
        var a = de();
        e = e === void 0 ? null : e;
        var s = t();
        if (Ui) {
          qn(true);
          try {
            t();
          } finally {
            qn(false);
          }
        }
        return a.memoizedState = [
          s,
          e
        ], s;
      },
      useReducer: function(t, e, a) {
        var s = de();
        if (a !== void 0) {
          var c = a(e);
          if (Ui) {
            qn(true);
            try {
              a(e);
            } finally {
              qn(false);
            }
          }
        } else c = e;
        return s.memoizedState = s.baseState = c, t = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: t,
          lastRenderedState: c
        }, s.queue = t, t = t.dispatch = ES.bind(null, bt, t), [
          s.memoizedState,
          t
        ];
      },
      useRef: function(t) {
        var e = de();
        return t = {
          current: t
        }, e.memoizedState = t;
      },
      useState: function(t) {
        t = kc(t);
        var e = t.queue, a = Fm.bind(null, bt, e);
        return e.dispatch = a, [
          t.memoizedState,
          a
        ];
      },
      useDebugValue: Uc,
      useDeferredValue: function(t, e) {
        var a = de();
        return Hc(a, t, e);
      },
      useTransition: function() {
        var t = kc(false);
        return t = qm.bind(null, bt, t.queue, true, false), de().memoizedState = t, [
          false,
          t
        ];
      },
      useSyncExternalStore: function(t, e, a) {
        var s = bt, c = de();
        if (Ct) {
          if (a === void 0) throw Error(o(407));
          a = a();
        } else {
          if (a = e(), kt === null) throw Error(o(349));
          (At & 127) !== 0 || bm(s, e, a);
        }
        c.memoizedState = a;
        var u = {
          value: a,
          getSnapshot: e
        };
        return c.queue = u, Vm(Sm.bind(null, s, u, t), [
          t
        ]), s.flags |= 2048, Ea(9, {
          destroy: void 0
        }, xm.bind(null, s, u, a, e), null), a;
      },
      useId: function() {
        var t = de(), e = kt.identifierPrefix;
        if (Ct) {
          var a = dn, s = fn;
          a = (s & ~(1 << 32 - Ce(s) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = Ql++, 0 < a && (e += "H" + a.toString(32)), e += "_";
        } else a = vS++, e = "_" + e + "r_" + a.toString(32) + "_";
        return t.memoizedState = e;
      },
      useHostTransitionStatus: Yc,
      useFormState: Om,
      useActionState: Om,
      useOptimistic: function(t) {
        var e = de();
        e.memoizedState = e.baseState = t;
        var a = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null
        };
        return e.queue = a, e = Pc.bind(null, bt, true, a), a.dispatch = e, [
          t,
          e
        ];
      },
      useMemoCache: zc,
      useCacheRefresh: function() {
        return de().memoizedState = AS.bind(null, bt);
      },
      useEffectEvent: function(t) {
        var e = de(), a = {
          impl: t
        };
        return e.memoizedState = a, function() {
          if ((Dt & 2) !== 0) throw Error(o(440));
          return a.impl.apply(void 0, arguments);
        };
      }
    }, qc = {
      readContext: le,
      use: Jl,
      useCallback: Gm,
      useContext: le,
      useEffect: Bc,
      useImperativeHandle: Hm,
      useInsertionEffect: Lm,
      useLayoutEffect: Bm,
      useMemo: Ym,
      useReducer: $l,
      useRef: _m,
      useState: function() {
        return $l(On);
      },
      useDebugValue: Uc,
      useDeferredValue: function(t, e) {
        var a = Zt();
        return Pm(a, zt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = $l(On)[0], e = Zt().memoizedState;
        return [
          typeof t == "boolean" ? t : Ds(t),
          e
        ];
      },
      useSyncExternalStore: vm,
      useId: Zm,
      useHostTransitionStatus: Yc,
      useFormState: jm,
      useActionState: jm,
      useOptimistic: function(t, e) {
        var a = Zt();
        return Am(a, zt, t, e);
      },
      useMemoCache: zc,
      useCacheRefresh: Qm
    };
    qc.useEffectEvent = km;
    var Im = {
      readContext: le,
      use: Jl,
      useCallback: Gm,
      useContext: le,
      useEffect: Bc,
      useImperativeHandle: Hm,
      useInsertionEffect: Lm,
      useLayoutEffect: Bm,
      useMemo: Ym,
      useReducer: Vc,
      useRef: _m,
      useState: function() {
        return Vc(On);
      },
      useDebugValue: Uc,
      useDeferredValue: function(t, e) {
        var a = Zt();
        return zt === null ? Hc(a, t, e) : Pm(a, zt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = Vc(On)[0], e = Zt().memoizedState;
        return [
          typeof t == "boolean" ? t : Ds(t),
          e
        ];
      },
      useSyncExternalStore: vm,
      useId: Zm,
      useHostTransitionStatus: Yc,
      useFormState: zm,
      useActionState: zm,
      useOptimistic: function(t, e) {
        var a = Zt();
        return zt !== null ? Am(a, zt, t, e) : (a.baseState = t, [
          t,
          a.queue.dispatch
        ]);
      },
      useMemoCache: zc,
      useCacheRefresh: Qm
    };
    Im.useEffectEvent = km;
    function Xc(t, e, a, s) {
      e = t.memoizedState, a = a(s, e), a = a == null ? e : v({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
    }
    var Kc = {
      enqueueSetState: function(t, e, a) {
        t = t._reactInternals;
        var s = ze(), c = Wn(s);
        c.payload = e, a != null && (c.callback = a), e = In(t, c, s), e !== null && (we(e, t, s), Es(e, t, s));
      },
      enqueueReplaceState: function(t, e, a) {
        t = t._reactInternals;
        var s = ze(), c = Wn(s);
        c.tag = 1, c.payload = e, a != null && (c.callback = a), e = In(t, c, s), e !== null && (we(e, t, s), Es(e, t, s));
      },
      enqueueForceUpdate: function(t, e) {
        t = t._reactInternals;
        var a = ze(), s = Wn(a);
        s.tag = 2, e != null && (s.callback = e), e = In(t, s, a), e !== null && (we(e, t, a), Es(e, t, a));
      }
    };
    function tp(t, e, a, s, c, u, y) {
      return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(s, u, y) : e.prototype && e.prototype.isPureReactComponent ? !ys(a, s) || !ys(c, u) : true;
    }
    function ep(t, e, a, s) {
      t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, s), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, s), e.state !== t && Kc.enqueueReplaceState(e, e.state, null);
    }
    function Hi(t, e) {
      var a = e;
      if ("ref" in e) {
        a = {};
        for (var s in e) s !== "ref" && (a[s] = e[s]);
      }
      if (t = t.defaultProps) {
        a === e && (a = v({}, a));
        for (var c in t) a[c] === void 0 && (a[c] = t[c]);
      }
      return a;
    }
    function np(t) {
      Nl(t);
    }
    function ip(t) {
      console.error(t);
    }
    function ap(t) {
      Nl(t);
    }
    function eo(t, e) {
      try {
        var a = t.onUncaughtError;
        a(e.value, {
          componentStack: e.stack
        });
      } catch (s) {
        setTimeout(function() {
          throw s;
        });
      }
    }
    function sp(t, e, a) {
      try {
        var s = t.onCaughtError;
        s(a.value, {
          componentStack: a.stack,
          errorBoundary: e.tag === 1 ? e.stateNode : null
        });
      } catch (c) {
        setTimeout(function() {
          throw c;
        });
      }
    }
    function Zc(t, e, a) {
      return a = Wn(a), a.tag = 3, a.payload = {
        element: null
      }, a.callback = function() {
        eo(t, e);
      }, a;
    }
    function lp(t) {
      return t = Wn(t), t.tag = 3, t;
    }
    function op(t, e, a, s) {
      var c = a.type.getDerivedStateFromError;
      if (typeof c == "function") {
        var u = s.value;
        t.payload = function() {
          return c(u);
        }, t.callback = function() {
          sp(e, a, s);
        };
      }
      var y = a.stateNode;
      y !== null && typeof y.componentDidCatch == "function" && (t.callback = function() {
        sp(e, a, s), typeof c != "function" && (si === null ? si = /* @__PURE__ */ new Set([
          this
        ]) : si.add(this));
        var x = s.stack;
        this.componentDidCatch(s.value, {
          componentStack: x !== null ? x : ""
        });
      });
    }
    function CS(t, e, a, s, c) {
      if (a.flags |= 32768, s !== null && typeof s == "object" && typeof s.then == "function") {
        if (e = a.alternate, e !== null && ya(e, a, c, true), a = De.current, a !== null) {
          switch (a.tag) {
            case 31:
            case 13:
              return Xe === null ? mo() : a.alternate === null && qt === 0 && (qt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, s === Yl ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([
                s
              ]) : e.add(s), vu(t, s, c)), false;
            case 22:
              return a.flags |= 65536, s === Yl ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([
                  s
                ])
              }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([
                s
              ]) : a.add(s)), vu(t, s, c)), false;
          }
          throw Error(o(435, a.tag));
        }
        return vu(t, s, c), mo(), false;
      }
      if (Ct) return e = De.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, s !== dc && (t = Error(o(422), {
        cause: s
      }), xs(Ge(t, a)))) : (s !== dc && (e = Error(o(423), {
        cause: s
      }), xs(Ge(e, a))), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, s = Ge(s, a), c = Zc(t.stateNode, s, c), wc(t, c), qt !== 4 && (qt = 2)), false;
      var u = Error(o(520), {
        cause: s
      });
      if (u = Ge(u, a), Us === null ? Us = [
        u
      ] : Us.push(u), qt !== 4 && (qt = 2), e === null) return true;
      s = Ge(s, a), a = e;
      do {
        switch (a.tag) {
          case 3:
            return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Zc(a.stateNode, s, t), wc(a, t), false;
          case 1:
            if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (si === null || !si.has(u)))) return a.flags |= 65536, c &= -c, a.lanes |= c, c = lp(c), op(c, t, a, s), wc(a, c), false;
        }
        a = a.return;
      } while (a !== null);
      return false;
    }
    var Qc = Error(o(461)), Jt = false;
    function oe(t, e, a, s) {
      e.child = t === null ? fm(e, null, a, s) : Bi(e, t.child, a, s);
    }
    function rp(t, e, a, s, c) {
      a = a.render;
      var u = e.ref;
      if ("ref" in s) {
        var y = {};
        for (var x in s) x !== "ref" && (y[x] = s[x]);
      } else y = s;
      return _i(e), s = Dc(t, e, a, y, u, c), x = Oc(), t !== null && !Jt ? (jc(t, e, c), jn(t, e, c)) : (Ct && x && uc(e), e.flags |= 1, oe(t, e, s, c), e.child);
    }
    function cp(t, e, a, s, c) {
      if (t === null) {
        var u = a.type;
        return typeof u == "function" && !oc(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, up(t, e, u, s, c)) : (t = kl(a.type, null, s, e, e.mode, c), t.ref = e.ref, t.return = e, e.child = t);
      }
      if (u = t.child, !nu(t, c)) {
        var y = u.memoizedProps;
        if (a = a.compare, a = a !== null ? a : ys, a(y, s) && t.ref === e.ref) return jn(t, e, c);
      }
      return e.flags |= 1, t = En(u, s), t.ref = e.ref, t.return = e, e.child = t;
    }
    function up(t, e, a, s, c) {
      if (t !== null) {
        var u = t.memoizedProps;
        if (ys(u, s) && t.ref === e.ref) if (Jt = false, e.pendingProps = s = u, nu(t, c)) (t.flags & 131072) !== 0 && (Jt = true);
        else return e.lanes = t.lanes, jn(t, e, c);
      }
      return Fc(t, e, a, s, c);
    }
    function fp(t, e, a, s) {
      var c = s.children, u = t !== null ? t.memoizedState : null;
      if (t === null && e.stateNode === null && (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), s.mode === "hidden") {
        if ((e.flags & 128) !== 0) {
          if (u = u !== null ? u.baseLanes | a : a, t !== null) {
            for (s = e.child = t.child, c = 0; s !== null; ) c = c | s.lanes | s.childLanes, s = s.sibling;
            s = c & ~u;
          } else s = 0, e.child = null;
          return dp(t, e, u, a, s);
        }
        if ((a & 536870912) !== 0) e.memoizedState = {
          baseLanes: 0,
          cachePool: null
        }, t !== null && Hl(e, u !== null ? u.cachePool : null), u !== null ? mm(e, u) : Ec(), pm(e);
        else return s = e.lanes = 536870912, dp(t, e, u !== null ? u.baseLanes | a : a, a, s);
      } else u !== null ? (Hl(e, u.cachePool), mm(e, u), ei(), e.memoizedState = null) : (t !== null && Hl(e, null), Ec(), ei());
      return oe(t, e, c, a), e.child;
    }
    function Ns(t, e) {
      return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), e.sibling;
    }
    function dp(t, e, a, s, c) {
      var u = bc();
      return u = u === null ? null : {
        parent: Qt._currentValue,
        pool: u
      }, e.memoizedState = {
        baseLanes: a,
        cachePool: u
      }, t !== null && Hl(e, null), Ec(), pm(e), t !== null && ya(t, e, s, true), e.childLanes = c, null;
    }
    function no(t, e) {
      return e = ao({
        mode: e.mode,
        children: e.children
      }, t.mode), e.ref = t.ref, t.child = e, e.return = t, e;
    }
    function hp(t, e, a) {
      return Bi(e, t.child, null, a), t = no(e, e.pendingProps), t.flags |= 2, Oe(e), e.memoizedState = null, t;
    }
    function MS(t, e, a) {
      var s = e.pendingProps, c = (e.flags & 128) !== 0;
      if (e.flags &= -129, t === null) {
        if (Ct) {
          if (s.mode === "hidden") return t = no(e, s), e.lanes = 536870912, Ns(null, t);
          if (Mc(e), (t = Bt) ? (t = Eg(t, qe), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
            dehydrated: t,
            treeContext: Zn !== null ? {
              id: fn,
              overflow: dn
            } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, a = Jh(t), a.return = e, e.child = a, se = e, Bt = null)) : t = null, t === null) throw Fn(e);
          return e.lanes = 536870912, null;
        }
        return no(e, s);
      }
      var u = t.memoizedState;
      if (u !== null) {
        var y = u.dehydrated;
        if (Mc(e), c) if (e.flags & 256) e.flags &= -257, e = hp(t, e, a);
        else if (e.memoizedState !== null) e.child = t.child, e.flags |= 128, e = null;
        else throw Error(o(558));
        else if (Jt || ya(t, e, a, false), c = (a & t.childLanes) !== 0, Jt || c) {
          if (s = kt, s !== null && (y = ih(s, a), y !== 0 && y !== u.retryLane)) throw u.retryLane = y, Oi(t, y), we(s, t, y), Qc;
          mo(), e = hp(t, e, a);
        } else t = u.treeContext, Bt = Ke(y.nextSibling), se = e, Ct = true, Qn = null, qe = false, t !== null && Ih(e, t), e = no(e, s), e.flags |= 4096;
        return e;
      }
      return t = En(t.child, {
        mode: s.mode,
        children: s.children
      }), t.ref = e.ref, e.child = t, t.return = e, t;
    }
    function io(t, e) {
      var a = e.ref;
      if (a === null) t !== null && t.ref !== null && (e.flags |= 4194816);
      else {
        if (typeof a != "function" && typeof a != "object") throw Error(o(284));
        (t === null || t.ref !== a) && (e.flags |= 4194816);
      }
    }
    function Fc(t, e, a, s, c) {
      return _i(e), a = Dc(t, e, a, s, void 0, c), s = Oc(), t !== null && !Jt ? (jc(t, e, c), jn(t, e, c)) : (Ct && s && uc(e), e.flags |= 1, oe(t, e, a, c), e.child);
    }
    function mp(t, e, a, s, c, u) {
      return _i(e), e.updateQueue = null, a = ym(e, s, a, c), gm(t), s = Oc(), t !== null && !Jt ? (jc(t, e, u), jn(t, e, u)) : (Ct && s && uc(e), e.flags |= 1, oe(t, e, a, u), e.child);
    }
    function pp(t, e, a, s, c) {
      if (_i(e), e.stateNode === null) {
        var u = ha, y = a.contextType;
        typeof y == "object" && y !== null && (u = le(y)), u = new a(s, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Kc, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = s, u.state = e.memoizedState, u.refs = {}, Sc(e), y = a.contextType, u.context = typeof y == "object" && y !== null ? le(y) : ha, u.state = e.memoizedState, y = a.getDerivedStateFromProps, typeof y == "function" && (Xc(e, a, y, s), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (y = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), y !== u.state && Kc.enqueueReplaceState(u, u.state, null), Ms(e, s, u, c), Cs(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), s = true;
      } else if (t === null) {
        u = e.stateNode;
        var x = e.memoizedProps, M = Hi(a, x);
        u.props = M;
        var U = u.context, P = a.contextType;
        y = ha, typeof P == "object" && P !== null && (y = le(P));
        var J = a.getDerivedStateFromProps;
        P = typeof J == "function" || typeof u.getSnapshotBeforeUpdate == "function", x = e.pendingProps !== x, P || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (x || U !== y) && ep(e, u, s, y), $n = false;
        var H = e.memoizedState;
        u.state = H, Ms(e, s, u, c), Cs(), U = e.memoizedState, x || H !== U || $n ? (typeof J == "function" && (Xc(e, a, J, s), U = e.memoizedState), (M = $n || tp(e, a, M, s, H, U, y)) ? (P || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = s, e.memoizedState = U), u.props = s, u.state = U, u.context = y, s = M) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), s = false);
      } else {
        u = e.stateNode, Tc(t, e), y = e.memoizedProps, P = Hi(a, y), u.props = P, J = e.pendingProps, H = u.context, U = a.contextType, M = ha, typeof U == "object" && U !== null && (M = le(U)), x = a.getDerivedStateFromProps, (U = typeof x == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (y !== J || H !== M) && ep(e, u, s, M), $n = false, H = e.memoizedState, u.state = H, Ms(e, s, u, c), Cs();
        var Y = e.memoizedState;
        y !== J || H !== Y || $n || t !== null && t.dependencies !== null && Bl(t.dependencies) ? (typeof x == "function" && (Xc(e, a, x, s), Y = e.memoizedState), (P = $n || tp(e, a, P, s, H, Y, M) || t !== null && t.dependencies !== null && Bl(t.dependencies)) ? (U || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(s, Y, M), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(s, Y, M)), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || y === t.memoizedProps && H === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || y === t.memoizedProps && H === t.memoizedState || (e.flags |= 1024), e.memoizedProps = s, e.memoizedState = Y), u.props = s, u.state = Y, u.context = M, s = P) : (typeof u.componentDidUpdate != "function" || y === t.memoizedProps && H === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || y === t.memoizedProps && H === t.memoizedState || (e.flags |= 1024), s = false);
      }
      return u = s, io(t, e), s = (e.flags & 128) !== 0, u || s ? (u = e.stateNode, a = s && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && s ? (e.child = Bi(e, t.child, null, c), e.child = Bi(e, null, a, c)) : oe(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = jn(t, e, c), t;
    }
    function gp(t, e, a, s) {
      return Ni(), e.flags |= 256, oe(t, e, a, s), e.child;
    }
    var Jc = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    };
    function $c(t) {
      return {
        baseLanes: t,
        cachePool: sm()
      };
    }
    function Wc(t, e, a) {
      return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ne), t;
    }
    function yp(t, e, a) {
      var s = e.pendingProps, c = false, u = (e.flags & 128) !== 0, y;
      if ((y = u) || (y = t !== null && t.memoizedState === null ? false : (Kt.current & 2) !== 0), y && (c = true, e.flags &= -129), y = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
        if (Ct) {
          if (c ? ti(e) : ei(), (t = Bt) ? (t = Eg(t, qe), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
            dehydrated: t,
            treeContext: Zn !== null ? {
              id: fn,
              overflow: dn
            } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, a = Jh(t), a.return = e, e.child = a, se = e, Bt = null)) : t = null, t === null) throw Fn(e);
          return _u(t) ? e.lanes = 32 : e.lanes = 536870912, null;
        }
        var x = s.children;
        return s = s.fallback, c ? (ei(), c = e.mode, x = ao({
          mode: "hidden",
          children: x
        }, c), s = ji(s, c, a, null), x.return = e, s.return = e, x.sibling = s, e.child = x, s = e.child, s.memoizedState = $c(a), s.childLanes = Wc(t, y, a), e.memoizedState = Jc, Ns(null, s)) : (ti(e), Ic(e, x));
      }
      var M = t.memoizedState;
      if (M !== null && (x = M.dehydrated, x !== null)) {
        if (u) e.flags & 256 ? (ti(e), e.flags &= -257, e = tu(t, e, a)) : e.memoizedState !== null ? (ei(), e.child = t.child, e.flags |= 128, e = null) : (ei(), x = s.fallback, c = e.mode, s = ao({
          mode: "visible",
          children: s.children
        }, c), x = ji(x, c, a, null), x.flags |= 2, s.return = e, x.return = e, s.sibling = x, e.child = s, Bi(e, t.child, null, a), s = e.child, s.memoizedState = $c(a), s.childLanes = Wc(t, y, a), e.memoizedState = Jc, e = Ns(null, s));
        else if (ti(e), _u(x)) {
          if (y = x.nextSibling && x.nextSibling.dataset, y) var U = y.dgst;
          y = U, s = Error(o(419)), s.stack = "", s.digest = y, xs({
            value: s,
            source: null,
            stack: null
          }), e = tu(t, e, a);
        } else if (Jt || ya(t, e, a, false), y = (a & t.childLanes) !== 0, Jt || y) {
          if (y = kt, y !== null && (s = ih(y, a), s !== 0 && s !== M.retryLane)) throw M.retryLane = s, Oi(t, s), we(y, t, s), Qc;
          zu(x) || mo(), e = tu(t, e, a);
        } else zu(x) ? (e.flags |= 192, e.child = t.child, e = null) : (t = M.treeContext, Bt = Ke(x.nextSibling), se = e, Ct = true, Qn = null, qe = false, t !== null && Ih(e, t), e = Ic(e, s.children), e.flags |= 4096);
        return e;
      }
      return c ? (ei(), x = s.fallback, c = e.mode, M = t.child, U = M.sibling, s = En(M, {
        mode: "hidden",
        children: s.children
      }), s.subtreeFlags = M.subtreeFlags & 65011712, U !== null ? x = En(U, x) : (x = ji(x, c, a, null), x.flags |= 2), x.return = e, s.return = e, s.sibling = x, e.child = s, Ns(null, s), s = e.child, x = t.child.memoizedState, x === null ? x = $c(a) : (c = x.cachePool, c !== null ? (M = Qt._currentValue, c = c.parent !== M ? {
        parent: M,
        pool: M
      } : c) : c = sm(), x = {
        baseLanes: x.baseLanes | a,
        cachePool: c
      }), s.memoizedState = x, s.childLanes = Wc(t, y, a), e.memoizedState = Jc, Ns(t.child, s)) : (ti(e), a = t.child, t = a.sibling, a = En(a, {
        mode: "visible",
        children: s.children
      }), a.return = e, a.sibling = null, t !== null && (y = e.deletions, y === null ? (e.deletions = [
        t
      ], e.flags |= 16) : y.push(t)), e.child = a, e.memoizedState = null, a);
    }
    function Ic(t, e) {
      return e = ao({
        mode: "visible",
        children: e
      }, t.mode), e.return = t, t.child = e;
    }
    function ao(t, e) {
      return t = Re(22, t, null, e), t.lanes = 0, t;
    }
    function tu(t, e, a) {
      return Bi(e, t.child, null, a), t = Ic(e, e.pendingProps.children), t.flags |= 2, e.memoizedState = null, t;
    }
    function vp(t, e, a) {
      t.lanes |= e;
      var s = t.alternate;
      s !== null && (s.lanes |= e), pc(t.return, e, a);
    }
    function eu(t, e, a, s, c, u) {
      var y = t.memoizedState;
      y === null ? t.memoizedState = {
        isBackwards: e,
        rendering: null,
        renderingStartTime: 0,
        last: s,
        tail: a,
        tailMode: c,
        treeForkCount: u
      } : (y.isBackwards = e, y.rendering = null, y.renderingStartTime = 0, y.last = s, y.tail = a, y.tailMode = c, y.treeForkCount = u);
    }
    function bp(t, e, a) {
      var s = e.pendingProps, c = s.revealOrder, u = s.tail;
      s = s.children;
      var y = Kt.current, x = (y & 2) !== 0;
      if (x ? (y = y & 1 | 2, e.flags |= 128) : y &= 1, K(Kt, y), oe(t, e, s, a), s = Ct ? bs : 0, !x && t !== null && (t.flags & 128) !== 0) t: for (t = e.child; t !== null; ) {
        if (t.tag === 13) t.memoizedState !== null && vp(t, a, e);
        else if (t.tag === 19) vp(t, a, e);
        else if (t.child !== null) {
          t.child.return = t, t = t.child;
          continue;
        }
        if (t === e) break t;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) break t;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
      switch (c) {
        case "forwards":
          for (a = e.child, c = null; a !== null; ) t = a.alternate, t !== null && Kl(t) === null && (c = a), a = a.sibling;
          a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), eu(e, false, c, a, u, s);
          break;
        case "backwards":
        case "unstable_legacy-backwards":
          for (a = null, c = e.child, e.child = null; c !== null; ) {
            if (t = c.alternate, t !== null && Kl(t) === null) {
              e.child = c;
              break;
            }
            t = c.sibling, c.sibling = a, a = c, c = t;
          }
          eu(e, true, a, null, u, s);
          break;
        case "together":
          eu(e, false, null, null, void 0, s);
          break;
        default:
          e.memoizedState = null;
      }
      return e.child;
    }
    function jn(t, e, a) {
      if (t !== null && (e.dependencies = t.dependencies), ai |= e.lanes, (a & e.childLanes) === 0) if (t !== null) {
        if (ya(t, e, a, false), (a & e.childLanes) === 0) return null;
      } else return null;
      if (t !== null && e.child !== t.child) throw Error(o(153));
      if (e.child !== null) {
        for (t = e.child, a = En(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; ) t = t.sibling, a = a.sibling = En(t, t.pendingProps), a.return = e;
        a.sibling = null;
      }
      return e.child;
    }
    function nu(t, e) {
      return (t.lanes & e) !== 0 ? true : (t = t.dependencies, !!(t !== null && Bl(t)));
    }
    function RS(t, e, a) {
      switch (e.tag) {
        case 3:
          Ht(e, e.stateNode.containerInfo), Jn(e, Qt, t.memoizedState.cache), Ni();
          break;
        case 27:
        case 5:
          cn(e);
          break;
        case 4:
          Ht(e, e.stateNode.containerInfo);
          break;
        case 10:
          Jn(e, e.type, e.memoizedProps.value);
          break;
        case 31:
          if (e.memoizedState !== null) return e.flags |= 128, Mc(e), null;
          break;
        case 13:
          var s = e.memoizedState;
          if (s !== null) return s.dehydrated !== null ? (ti(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? yp(t, e, a) : (ti(e), t = jn(t, e, a), t !== null ? t.sibling : null);
          ti(e);
          break;
        case 19:
          var c = (t.flags & 128) !== 0;
          if (s = (a & e.childLanes) !== 0, s || (ya(t, e, a, false), s = (a & e.childLanes) !== 0), c) {
            if (s) return bp(t, e, a);
            e.flags |= 128;
          }
          if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), K(Kt, Kt.current), s) break;
          return null;
        case 22:
          return e.lanes = 0, fp(t, e, a, e.pendingProps);
        case 24:
          Jn(e, Qt, t.memoizedState.cache);
      }
      return jn(t, e, a);
    }
    function xp(t, e, a) {
      if (t !== null) if (t.memoizedProps !== e.pendingProps) Jt = true;
      else {
        if (!nu(t, a) && (e.flags & 128) === 0) return Jt = false, RS(t, e, a);
        Jt = (t.flags & 131072) !== 0;
      }
      else Jt = false, Ct && (e.flags & 1048576) !== 0 && Wh(e, bs, e.index);
      switch (e.lanes = 0, e.tag) {
        case 16:
          t: {
            var s = e.pendingProps;
            if (t = ki(e.elementType), e.type = t, typeof t == "function") oc(t) ? (s = Hi(t, s), e.tag = 1, e = pp(null, e, t, s, a)) : (e.tag = 0, e = Fc(null, e, t, s, a));
            else {
              if (t != null) {
                var c = t.$$typeof;
                if (c === V) {
                  e.tag = 11, e = rp(null, e, t, s, a);
                  break t;
                } else if (c === X) {
                  e.tag = 14, e = cp(null, e, t, s, a);
                  break t;
                }
              }
              throw e = ht(t) || t, Error(o(306, e, ""));
            }
          }
          return e;
        case 0:
          return Fc(t, e, e.type, e.pendingProps, a);
        case 1:
          return s = e.type, c = Hi(s, e.pendingProps), pp(t, e, s, c, a);
        case 3:
          t: {
            if (Ht(e, e.stateNode.containerInfo), t === null) throw Error(o(387));
            s = e.pendingProps;
            var u = e.memoizedState;
            c = u.element, Tc(t, e), Ms(e, s, null, a);
            var y = e.memoizedState;
            if (s = y.cache, Jn(e, Qt, s), s !== u.cache && gc(e, [
              Qt
            ], a, true), Cs(), s = y.element, u.isDehydrated) if (u = {
              element: s,
              isDehydrated: false,
              cache: y.cache
            }, e.updateQueue.baseState = u, e.memoizedState = u, e.flags & 256) {
              e = gp(t, e, s, a);
              break t;
            } else if (s !== c) {
              c = Ge(Error(o(424)), e), xs(c), e = gp(t, e, s, a);
              break t;
            } else {
              switch (t = e.stateNode.containerInfo, t.nodeType) {
                case 9:
                  t = t.body;
                  break;
                default:
                  t = t.nodeName === "HTML" ? t.ownerDocument.body : t;
              }
              for (Bt = Ke(t.firstChild), se = e, Ct = true, Qn = null, qe = true, a = fm(e, null, s, a), e.child = a; a; ) a.flags = a.flags & -3 | 4096, a = a.sibling;
            }
            else {
              if (Ni(), s === c) {
                e = jn(t, e, a);
                break t;
              }
              oe(t, e, s, a);
            }
            e = e.child;
          }
          return e;
        case 26:
          return io(t, e), t === null ? (a = jg(e.type, null, e.pendingProps, null)) ? e.memoizedState = a : Ct || (a = e.type, t = e.pendingProps, s = So(at.current).createElement(a), s[ae] = e, s[ye] = t, re(s, a, t), ne(s), e.stateNode = s) : e.memoizedState = jg(e.type, t.memoizedProps, e.pendingProps, t.memoizedState), null;
        case 27:
          return cn(e), t === null && Ct && (s = e.stateNode = Rg(e.type, e.pendingProps, at.current), se = e, qe = true, c = Bt, ci(e.type) ? (Vu = c, Bt = Ke(s.firstChild)) : Bt = c), oe(t, e, e.pendingProps.children, a), io(t, e), t === null && (e.flags |= 4194304), e.child;
        case 5:
          return t === null && Ct && ((c = s = Bt) && (s = aT(s, e.type, e.pendingProps, qe), s !== null ? (e.stateNode = s, se = e, Bt = Ke(s.firstChild), qe = false, c = true) : c = false), c || Fn(e)), cn(e), c = e.type, u = e.pendingProps, y = t !== null ? t.memoizedProps : null, s = u.children, Ou(c, u) ? s = null : y !== null && Ou(c, y) && (e.flags |= 32), e.memoizedState !== null && (c = Dc(t, e, bS, null, null, a), Zs._currentValue = c), io(t, e), oe(t, e, s, a), e.child;
        case 6:
          return t === null && Ct && ((t = a = Bt) && (a = sT(a, e.pendingProps, qe), a !== null ? (e.stateNode = a, se = e, Bt = null, t = true) : t = false), t || Fn(e)), null;
        case 13:
          return yp(t, e, a);
        case 4:
          return Ht(e, e.stateNode.containerInfo), s = e.pendingProps, t === null ? e.child = Bi(e, null, s, a) : oe(t, e, s, a), e.child;
        case 11:
          return rp(t, e, e.type, e.pendingProps, a);
        case 7:
          return oe(t, e, e.pendingProps, a), e.child;
        case 8:
          return oe(t, e, e.pendingProps.children, a), e.child;
        case 12:
          return oe(t, e, e.pendingProps.children, a), e.child;
        case 10:
          return s = e.pendingProps, Jn(e, e.type, s.value), oe(t, e, s.children, a), e.child;
        case 9:
          return c = e.type._context, s = e.pendingProps.children, _i(e), c = le(c), s = s(c), e.flags |= 1, oe(t, e, s, a), e.child;
        case 14:
          return cp(t, e, e.type, e.pendingProps, a);
        case 15:
          return up(t, e, e.type, e.pendingProps, a);
        case 19:
          return bp(t, e, a);
        case 31:
          return MS(t, e, a);
        case 22:
          return fp(t, e, a, e.pendingProps);
        case 24:
          return _i(e), s = le(Qt), t === null ? (c = bc(), c === null && (c = kt, u = yc(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
            parent: s,
            cache: c
          }, Sc(e), Jn(e, Qt, c)) : ((t.lanes & a) !== 0 && (Tc(t, e), Ms(e, null, null, a), Cs()), c = t.memoizedState, u = e.memoizedState, c.parent !== s ? (c = {
            parent: s,
            cache: s
          }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), Jn(e, Qt, s)) : (s = u.cache, Jn(e, Qt, s), s !== c.cache && gc(e, [
            Qt
          ], a, true))), oe(t, e, e.pendingProps.children, a), e.child;
        case 29:
          throw e.pendingProps;
      }
      throw Error(o(156, e.tag));
    }
    function Nn(t) {
      t.flags |= 4;
    }
    function iu(t, e, a, s, c) {
      if ((e = (t.mode & 32) !== 0) && (e = false), e) {
        if (t.flags |= 16777216, (c & 335544128) === c) if (t.stateNode.complete) t.flags |= 8192;
        else if (Zp()) t.flags |= 8192;
        else throw Li = Yl, xc;
      } else t.flags &= -16777217;
    }
    function Sp(t, e) {
      if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0) t.flags &= -16777217;
      else if (t.flags |= 16777216, !kg(e)) if (Zp()) t.flags |= 8192;
      else throw Li = Yl, xc;
    }
    function so(t, e) {
      e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? th() : 536870912, t.lanes |= e, Da |= e);
    }
    function zs(t, e) {
      if (!Ct) switch (t.tailMode) {
        case "hidden":
          e = t.tail;
          for (var a = null; e !== null; ) e.alternate !== null && (a = e), e = e.sibling;
          a === null ? t.tail = null : a.sibling = null;
          break;
        case "collapsed":
          a = t.tail;
          for (var s = null; a !== null; ) a.alternate !== null && (s = a), a = a.sibling;
          s === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : s.sibling = null;
      }
    }
    function Ut(t) {
      var e = t.alternate !== null && t.alternate.child === t.child, a = 0, s = 0;
      if (e) for (var c = t.child; c !== null; ) a |= c.lanes | c.childLanes, s |= c.subtreeFlags & 65011712, s |= c.flags & 65011712, c.return = t, c = c.sibling;
      else for (c = t.child; c !== null; ) a |= c.lanes | c.childLanes, s |= c.subtreeFlags, s |= c.flags, c.return = t, c = c.sibling;
      return t.subtreeFlags |= s, t.childLanes = a, e;
    }
    function DS(t, e, a) {
      var s = e.pendingProps;
      switch (fc(e), e.tag) {
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return Ut(e), null;
        case 1:
          return Ut(e), null;
        case 3:
          return a = e.stateNode, s = null, t !== null && (s = t.memoizedState.cache), e.memoizedState.cache !== s && (e.flags |= 2048), Rn(Qt), vt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (ga(e) ? Nn(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, hc())), Ut(e), null;
        case 26:
          var c = e.type, u = e.memoizedState;
          return t === null ? (Nn(e), u !== null ? (Ut(e), Sp(e, u)) : (Ut(e), iu(e, c, null, s, a))) : u ? u !== t.memoizedState ? (Nn(e), Ut(e), Sp(e, u)) : (Ut(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== s && Nn(e), Ut(e), iu(e, c, t, s, a)), null;
        case 27:
          if ($e(e), a = at.current, c = e.type, t !== null && e.stateNode != null) t.memoizedProps !== s && Nn(e);
          else {
            if (!s) {
              if (e.stateNode === null) throw Error(o(166));
              return Ut(e), null;
            }
            t = W.current, ga(e) ? tm(e) : (t = Rg(c, s, a), e.stateNode = t, Nn(e));
          }
          return Ut(e), null;
        case 5:
          if ($e(e), c = e.type, t !== null && e.stateNode != null) t.memoizedProps !== s && Nn(e);
          else {
            if (!s) {
              if (e.stateNode === null) throw Error(o(166));
              return Ut(e), null;
            }
            if (u = W.current, ga(e)) tm(e);
            else {
              var y = So(at.current);
              switch (u) {
                case 1:
                  u = y.createElementNS("http://www.w3.org/2000/svg", c);
                  break;
                case 2:
                  u = y.createElementNS("http://www.w3.org/1998/Math/MathML", c);
                  break;
                default:
                  switch (c) {
                    case "svg":
                      u = y.createElementNS("http://www.w3.org/2000/svg", c);
                      break;
                    case "math":
                      u = y.createElementNS("http://www.w3.org/1998/Math/MathML", c);
                      break;
                    case "script":
                      u = y.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(u.firstChild);
                      break;
                    case "select":
                      u = typeof s.is == "string" ? y.createElement("select", {
                        is: s.is
                      }) : y.createElement("select"), s.multiple ? u.multiple = true : s.size && (u.size = s.size);
                      break;
                    default:
                      u = typeof s.is == "string" ? y.createElement(c, {
                        is: s.is
                      }) : y.createElement(c);
                  }
              }
              u[ae] = e, u[ye] = s;
              t: for (y = e.child; y !== null; ) {
                if (y.tag === 5 || y.tag === 6) u.appendChild(y.stateNode);
                else if (y.tag !== 4 && y.tag !== 27 && y.child !== null) {
                  y.child.return = y, y = y.child;
                  continue;
                }
                if (y === e) break t;
                for (; y.sibling === null; ) {
                  if (y.return === null || y.return === e) break t;
                  y = y.return;
                }
                y.sibling.return = y.return, y = y.sibling;
              }
              e.stateNode = u;
              t: switch (re(u, c, s), c) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  s = !!s.autoFocus;
                  break t;
                case "img":
                  s = true;
                  break t;
                default:
                  s = false;
              }
              s && Nn(e);
            }
          }
          return Ut(e), iu(e, e.type, t === null ? null : t.memoizedProps, e.pendingProps, a), null;
        case 6:
          if (t && e.stateNode != null) t.memoizedProps !== s && Nn(e);
          else {
            if (typeof s != "string" && e.stateNode === null) throw Error(o(166));
            if (t = at.current, ga(e)) {
              if (t = e.stateNode, a = e.memoizedProps, s = null, c = se, c !== null) switch (c.tag) {
                case 27:
                case 5:
                  s = c.memoizedProps;
              }
              t[ae] = e, t = !!(t.nodeValue === a || s !== null && s.suppressHydrationWarning === true || yg(t.nodeValue, a)), t || Fn(e, true);
            } else t = So(t).createTextNode(s), t[ae] = e, e.stateNode = t;
          }
          return Ut(e), null;
        case 31:
          if (a = e.memoizedState, t === null || t.memoizedState !== null) {
            if (s = ga(e), a !== null) {
              if (t === null) {
                if (!s) throw Error(o(318));
                if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                t[ae] = e;
              } else Ni(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Ut(e), t = false;
            } else a = hc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = true;
            if (!t) return e.flags & 256 ? (Oe(e), e) : (Oe(e), null);
            if ((e.flags & 128) !== 0) throw Error(o(558));
          }
          return Ut(e), null;
        case 13:
          if (s = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
            if (c = ga(e), s !== null && s.dehydrated !== null) {
              if (t === null) {
                if (!c) throw Error(o(318));
                if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(o(317));
                c[ae] = e;
              } else Ni(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Ut(e), c = false;
            } else c = hc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = true;
            if (!c) return e.flags & 256 ? (Oe(e), e) : (Oe(e), null);
          }
          return Oe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = s !== null, t = t !== null && t.memoizedState !== null, a && (s = e.child, c = null, s.alternate !== null && s.alternate.memoizedState !== null && s.alternate.memoizedState.cachePool !== null && (c = s.alternate.memoizedState.cachePool.pool), u = null, s.memoizedState !== null && s.memoizedState.cachePool !== null && (u = s.memoizedState.cachePool.pool), u !== c && (s.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), so(e, e.updateQueue), Ut(e), null);
        case 4:
          return vt(), t === null && Eu(e.stateNode.containerInfo), Ut(e), null;
        case 10:
          return Rn(e.type), Ut(e), null;
        case 19:
          if (j(Kt), s = e.memoizedState, s === null) return Ut(e), null;
          if (c = (e.flags & 128) !== 0, u = s.rendering, u === null) if (c) zs(s, false);
          else {
            if (qt !== 0 || t !== null && (t.flags & 128) !== 0) for (t = e.child; t !== null; ) {
              if (u = Kl(t), u !== null) {
                for (e.flags |= 128, zs(s, false), t = u.updateQueue, e.updateQueue = t, so(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; ) Fh(a, t), a = a.sibling;
                return K(Kt, Kt.current & 1 | 2), Ct && Cn(e, s.treeForkCount), e.child;
              }
              t = t.sibling;
            }
            s.tail !== null && Ae() > uo && (e.flags |= 128, c = true, zs(s, false), e.lanes = 4194304);
          }
          else {
            if (!c) if (t = Kl(u), t !== null) {
              if (e.flags |= 128, c = true, t = t.updateQueue, e.updateQueue = t, so(e, t), zs(s, true), s.tail === null && s.tailMode === "hidden" && !u.alternate && !Ct) return Ut(e), null;
            } else 2 * Ae() - s.renderingStartTime > uo && a !== 536870912 && (e.flags |= 128, c = true, zs(s, false), e.lanes = 4194304);
            s.isBackwards ? (u.sibling = e.child, e.child = u) : (t = s.last, t !== null ? t.sibling = u : e.child = u, s.last = u);
          }
          return s.tail !== null ? (t = s.tail, s.rendering = t, s.tail = t.sibling, s.renderingStartTime = Ae(), t.sibling = null, a = Kt.current, K(Kt, c ? a & 1 | 2 : a & 1), Ct && Cn(e, s.treeForkCount), t) : (Ut(e), null);
        case 22:
        case 23:
          return Oe(e), Cc(), s = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== s && (e.flags |= 8192) : s && (e.flags |= 8192), s ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ut(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ut(e), a = e.updateQueue, a !== null && so(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), s = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (s = e.memoizedState.cachePool.pool), s !== a && (e.flags |= 2048), t !== null && j(Vi), null;
        case 24:
          return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Rn(Qt), Ut(e), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(o(156, e.tag));
    }
    function OS(t, e) {
      switch (fc(e), e.tag) {
        case 1:
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 3:
          return Rn(Qt), vt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
        case 26:
        case 27:
        case 5:
          return $e(e), null;
        case 31:
          if (e.memoizedState !== null) {
            if (Oe(e), e.alternate === null) throw Error(o(340));
            Ni();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 13:
          if (Oe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
            if (e.alternate === null) throw Error(o(340));
            Ni();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 19:
          return j(Kt), null;
        case 4:
          return vt(), null;
        case 10:
          return Rn(e.type), null;
        case 22:
        case 23:
          return Oe(e), Cc(), t !== null && j(Vi), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 24:
          return Rn(Qt), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function Tp(t, e) {
      switch (fc(e), e.tag) {
        case 3:
          Rn(Qt), vt();
          break;
        case 26:
        case 27:
        case 5:
          $e(e);
          break;
        case 4:
          vt();
          break;
        case 31:
          e.memoizedState !== null && Oe(e);
          break;
        case 13:
          Oe(e);
          break;
        case 19:
          j(Kt);
          break;
        case 10:
          Rn(e.type);
          break;
        case 22:
        case 23:
          Oe(e), Cc(), t !== null && j(Vi);
          break;
        case 24:
          Rn(Qt);
      }
    }
    function _s(t, e) {
      try {
        var a = e.updateQueue, s = a !== null ? a.lastEffect : null;
        if (s !== null) {
          var c = s.next;
          a = c;
          do {
            if ((a.tag & t) === t) {
              s = void 0;
              var u = a.create, y = a.inst;
              s = u(), y.destroy = s;
            }
            a = a.next;
          } while (a !== c);
        }
      } catch (x) {
        Nt(e, e.return, x);
      }
    }
    function ni(t, e, a) {
      try {
        var s = e.updateQueue, c = s !== null ? s.lastEffect : null;
        if (c !== null) {
          var u = c.next;
          s = u;
          do {
            if ((s.tag & t) === t) {
              var y = s.inst, x = y.destroy;
              if (x !== void 0) {
                y.destroy = void 0, c = e;
                var M = a, U = x;
                try {
                  U();
                } catch (P) {
                  Nt(c, M, P);
                }
              }
            }
            s = s.next;
          } while (s !== u);
        }
      } catch (P) {
        Nt(e, e.return, P);
      }
    }
    function wp(t) {
      var e = t.updateQueue;
      if (e !== null) {
        var a = t.stateNode;
        try {
          hm(e, a);
        } catch (s) {
          Nt(t, t.return, s);
        }
      }
    }
    function Ap(t, e, a) {
      a.props = Hi(t.type, t.memoizedProps), a.state = t.memoizedState;
      try {
        a.componentWillUnmount();
      } catch (s) {
        Nt(t, e, s);
      }
    }
    function Vs(t, e) {
      try {
        var a = t.ref;
        if (a !== null) {
          switch (t.tag) {
            case 26:
            case 27:
            case 5:
              var s = t.stateNode;
              break;
            case 30:
              s = t.stateNode;
              break;
            default:
              s = t.stateNode;
          }
          typeof a == "function" ? t.refCleanup = a(s) : a.current = s;
        }
      } catch (c) {
        Nt(t, e, c);
      }
    }
    function hn(t, e) {
      var a = t.ref, s = t.refCleanup;
      if (a !== null) if (typeof s == "function") try {
        s();
      } catch (c) {
        Nt(t, e, c);
      } finally {
        t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
      }
      else if (typeof a == "function") try {
        a(null);
      } catch (c) {
        Nt(t, e, c);
      }
      else a.current = null;
    }
    function Ep(t) {
      var e = t.type, a = t.memoizedProps, s = t.stateNode;
      try {
        t: switch (e) {
          case "button":
          case "input":
          case "select":
          case "textarea":
            a.autoFocus && s.focus();
            break t;
          case "img":
            a.src ? s.src = a.src : a.srcSet && (s.srcset = a.srcSet);
        }
      } catch (c) {
        Nt(t, t.return, c);
      }
    }
    function au(t, e, a) {
      try {
        var s = t.stateNode;
        WS(s, t.type, a, e), s[ye] = e;
      } catch (c) {
        Nt(t, t.return, c);
      }
    }
    function Cp(t) {
      return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && ci(t.type) || t.tag === 4;
    }
    function su(t) {
      t: for (; ; ) {
        for (; t.sibling === null; ) {
          if (t.return === null || Cp(t.return)) return null;
          t = t.return;
        }
        for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
          if (t.tag === 27 && ci(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
          t.child.return = t, t = t.child;
        }
        if (!(t.flags & 2)) return t.stateNode;
      }
    }
    function lu(t, e, a) {
      var s = t.tag;
      if (s === 5 || s === 6) t = t.stateNode, e ? (a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a).insertBefore(t, e) : (e = a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a, e.appendChild(t), a = a._reactRootContainer, a != null || e.onclick !== null || (e.onclick = wn));
      else if (s !== 4 && (s === 27 && ci(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null)) for (lu(t, e, a), t = t.sibling; t !== null; ) lu(t, e, a), t = t.sibling;
    }
    function lo(t, e, a) {
      var s = t.tag;
      if (s === 5 || s === 6) t = t.stateNode, e ? a.insertBefore(t, e) : a.appendChild(t);
      else if (s !== 4 && (s === 27 && ci(t.type) && (a = t.stateNode), t = t.child, t !== null)) for (lo(t, e, a), t = t.sibling; t !== null; ) lo(t, e, a), t = t.sibling;
    }
    function Mp(t) {
      var e = t.stateNode, a = t.memoizedProps;
      try {
        for (var s = t.type, c = e.attributes; c.length; ) e.removeAttributeNode(c[0]);
        re(e, s, a), e[ae] = t, e[ye] = a;
      } catch (u) {
        Nt(t, t.return, u);
      }
    }
    var zn = false, $t = false, ou = false, Rp = typeof WeakSet == "function" ? WeakSet : Set, ie = null;
    function jS(t, e) {
      if (t = t.containerInfo, Ru = Ro, t = Hh(t), tc(t)) {
        if ("selectionStart" in t) var a = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
        else t: {
          a = (a = t.ownerDocument) && a.defaultView || window;
          var s = a.getSelection && a.getSelection();
          if (s && s.rangeCount !== 0) {
            a = s.anchorNode;
            var c = s.anchorOffset, u = s.focusNode;
            s = s.focusOffset;
            try {
              a.nodeType, u.nodeType;
            } catch {
              a = null;
              break t;
            }
            var y = 0, x = -1, M = -1, U = 0, P = 0, J = t, H = null;
            e: for (; ; ) {
              for (var Y; J !== a || c !== 0 && J.nodeType !== 3 || (x = y + c), J !== u || s !== 0 && J.nodeType !== 3 || (M = y + s), J.nodeType === 3 && (y += J.nodeValue.length), (Y = J.firstChild) !== null; ) H = J, J = Y;
              for (; ; ) {
                if (J === t) break e;
                if (H === a && ++U === c && (x = y), H === u && ++P === s && (M = y), (Y = J.nextSibling) !== null) break;
                J = H, H = J.parentNode;
              }
              J = Y;
            }
            a = x === -1 || M === -1 ? null : {
              start: x,
              end: M
            };
          } else a = null;
        }
        a = a || {
          start: 0,
          end: 0
        };
      } else a = null;
      for (Du = {
        focusedElem: t,
        selectionRange: a
      }, Ro = false, ie = e; ie !== null; ) if (e = ie, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null) t.return = e, ie = t;
      else for (; ie !== null; ) {
        switch (e = ie, u = e.alternate, t = e.flags, e.tag) {
          case 0:
            if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null)) for (a = 0; a < t.length; a++) c = t[a], c.ref.impl = c.nextImpl;
            break;
          case 11:
          case 15:
            break;
          case 1:
            if ((t & 1024) !== 0 && u !== null) {
              t = void 0, a = e, c = u.memoizedProps, u = u.memoizedState, s = a.stateNode;
              try {
                var lt = Hi(a.type, c);
                t = s.getSnapshotBeforeUpdate(lt, u), s.__reactInternalSnapshotBeforeUpdate = t;
              } catch (pt) {
                Nt(a, a.return, pt);
              }
            }
            break;
          case 3:
            if ((t & 1024) !== 0) {
              if (t = e.stateNode.containerInfo, a = t.nodeType, a === 9) Nu(t);
              else if (a === 1) switch (t.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  Nu(t);
                  break;
                default:
                  t.textContent = "";
              }
            }
            break;
          case 5:
          case 26:
          case 27:
          case 6:
          case 4:
          case 17:
            break;
          default:
            if ((t & 1024) !== 0) throw Error(o(163));
        }
        if (t = e.sibling, t !== null) {
          t.return = e.return, ie = t;
          break;
        }
        ie = e.return;
      }
    }
    function Dp(t, e, a) {
      var s = a.flags;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          Vn(t, a), s & 4 && _s(5, a);
          break;
        case 1:
          if (Vn(t, a), s & 4) if (t = a.stateNode, e === null) try {
            t.componentDidMount();
          } catch (y) {
            Nt(a, a.return, y);
          }
          else {
            var c = Hi(a.type, e.memoizedProps);
            e = e.memoizedState;
            try {
              t.componentDidUpdate(c, e, t.__reactInternalSnapshotBeforeUpdate);
            } catch (y) {
              Nt(a, a.return, y);
            }
          }
          s & 64 && wp(a), s & 512 && Vs(a, a.return);
          break;
        case 3:
          if (Vn(t, a), s & 64 && (t = a.updateQueue, t !== null)) {
            if (e = null, a.child !== null) switch (a.child.tag) {
              case 27:
              case 5:
                e = a.child.stateNode;
                break;
              case 1:
                e = a.child.stateNode;
            }
            try {
              hm(t, e);
            } catch (y) {
              Nt(a, a.return, y);
            }
          }
          break;
        case 27:
          e === null && s & 4 && Mp(a);
        case 26:
        case 5:
          Vn(t, a), e === null && s & 4 && Ep(a), s & 512 && Vs(a, a.return);
          break;
        case 12:
          Vn(t, a);
          break;
        case 31:
          Vn(t, a), s & 4 && Np(t, a);
          break;
        case 13:
          Vn(t, a), s & 4 && zp(t, a), s & 64 && (t = a.memoizedState, t !== null && (t = t.dehydrated, t !== null && (a = HS.bind(null, a), lT(t, a))));
          break;
        case 22:
          if (s = a.memoizedState !== null || zn, !s) {
            e = e !== null && e.memoizedState !== null || $t, c = zn;
            var u = $t;
            zn = s, ($t = e) && !u ? kn(t, a, (a.subtreeFlags & 8772) !== 0) : Vn(t, a), zn = c, $t = u;
          }
          break;
        case 30:
          break;
        default:
          Vn(t, a);
      }
    }
    function Op(t) {
      var e = t.alternate;
      e !== null && (t.alternate = null, Op(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Lr(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
    }
    var Gt = null, be = false;
    function _n(t, e, a) {
      for (a = a.child; a !== null; ) jp(t, e, a), a = a.sibling;
    }
    function jp(t, e, a) {
      if (Ee && typeof Ee.onCommitFiberUnmount == "function") try {
        Ee.onCommitFiberUnmount(ss, a);
      } catch {
      }
      switch (a.tag) {
        case 26:
          $t || hn(a, e), _n(t, e, a), a.memoizedState ? a.memoizedState.count-- : a.stateNode && (a = a.stateNode, a.parentNode.removeChild(a));
          break;
        case 27:
          $t || hn(a, e);
          var s = Gt, c = be;
          ci(a.type) && (Gt = a.stateNode, be = false), _n(t, e, a), qs(a.stateNode), Gt = s, be = c;
          break;
        case 5:
          $t || hn(a, e);
        case 6:
          if (s = Gt, c = be, Gt = null, _n(t, e, a), Gt = s, be = c, Gt !== null) if (be) try {
            (Gt.nodeType === 9 ? Gt.body : Gt.nodeName === "HTML" ? Gt.ownerDocument.body : Gt).removeChild(a.stateNode);
          } catch (u) {
            Nt(a, e, u);
          }
          else try {
            Gt.removeChild(a.stateNode);
          } catch (u) {
            Nt(a, e, u);
          }
          break;
        case 18:
          Gt !== null && (be ? (t = Gt, wg(t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t, a.stateNode), La(t)) : wg(Gt, a.stateNode));
          break;
        case 4:
          s = Gt, c = be, Gt = a.stateNode.containerInfo, be = true, _n(t, e, a), Gt = s, be = c;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          ni(2, a, e), $t || ni(4, a, e), _n(t, e, a);
          break;
        case 1:
          $t || (hn(a, e), s = a.stateNode, typeof s.componentWillUnmount == "function" && Ap(a, e, s)), _n(t, e, a);
          break;
        case 21:
          _n(t, e, a);
          break;
        case 22:
          $t = (s = $t) || a.memoizedState !== null, _n(t, e, a), $t = s;
          break;
        default:
          _n(t, e, a);
      }
    }
    function Np(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
        t = t.dehydrated;
        try {
          La(t);
        } catch (a) {
          Nt(e, e.return, a);
        }
      }
    }
    function zp(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null)))) try {
        La(t);
      } catch (a) {
        Nt(e, e.return, a);
      }
    }
    function NS(t) {
      switch (t.tag) {
        case 31:
        case 13:
        case 19:
          var e = t.stateNode;
          return e === null && (e = t.stateNode = new Rp()), e;
        case 22:
          return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Rp()), e;
        default:
          throw Error(o(435, t.tag));
      }
    }
    function oo(t, e) {
      var a = NS(t);
      e.forEach(function(s) {
        if (!a.has(s)) {
          a.add(s);
          var c = GS.bind(null, t, s);
          s.then(c, c);
        }
      });
    }
    function xe(t, e) {
      var a = e.deletions;
      if (a !== null) for (var s = 0; s < a.length; s++) {
        var c = a[s], u = t, y = e, x = y;
        t: for (; x !== null; ) {
          switch (x.tag) {
            case 27:
              if (ci(x.type)) {
                Gt = x.stateNode, be = false;
                break t;
              }
              break;
            case 5:
              Gt = x.stateNode, be = false;
              break t;
            case 3:
            case 4:
              Gt = x.stateNode.containerInfo, be = true;
              break t;
          }
          x = x.return;
        }
        if (Gt === null) throw Error(o(160));
        jp(u, y, c), Gt = null, be = false, u = c.alternate, u !== null && (u.return = null), c.return = null;
      }
      if (e.subtreeFlags & 13886) for (e = e.child; e !== null; ) _p(e, t), e = e.sibling;
    }
    var tn = null;
    function _p(t, e) {
      var a = t.alternate, s = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          xe(e, t), Se(t), s & 4 && (ni(3, t, t.return), _s(3, t), ni(5, t, t.return));
          break;
        case 1:
          xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), s & 64 && zn && (t = t.updateQueue, t !== null && (s = t.callbacks, s !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? s : a.concat(s))));
          break;
        case 26:
          var c = tn;
          if (xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), s & 4) {
            var u = a !== null ? a.memoizedState : null;
            if (s = t.memoizedState, a === null) if (s === null) if (t.stateNode === null) {
              t: {
                s = t.type, a = t.memoizedProps, c = c.ownerDocument || c;
                e: switch (s) {
                  case "title":
                    u = c.getElementsByTagName("title")[0], (!u || u[rs] || u[ae] || u.namespaceURI === "http://www.w3.org/2000/svg" || u.hasAttribute("itemprop")) && (u = c.createElement(s), c.head.insertBefore(u, c.querySelector("head > title"))), re(u, s, a), u[ae] = t, ne(u), s = u;
                    break t;
                  case "link":
                    var y = _g("link", "href", c).get(s + (a.href || ""));
                    if (y) {
                      for (var x = 0; x < y.length; x++) if (u = y[x], u.getAttribute("href") === (a.href == null || a.href === "" ? null : a.href) && u.getAttribute("rel") === (a.rel == null ? null : a.rel) && u.getAttribute("title") === (a.title == null ? null : a.title) && u.getAttribute("crossorigin") === (a.crossOrigin == null ? null : a.crossOrigin)) {
                        y.splice(x, 1);
                        break e;
                      }
                    }
                    u = c.createElement(s), re(u, s, a), c.head.appendChild(u);
                    break;
                  case "meta":
                    if (y = _g("meta", "content", c).get(s + (a.content || ""))) {
                      for (x = 0; x < y.length; x++) if (u = y[x], u.getAttribute("content") === (a.content == null ? null : "" + a.content) && u.getAttribute("name") === (a.name == null ? null : a.name) && u.getAttribute("property") === (a.property == null ? null : a.property) && u.getAttribute("http-equiv") === (a.httpEquiv == null ? null : a.httpEquiv) && u.getAttribute("charset") === (a.charSet == null ? null : a.charSet)) {
                        y.splice(x, 1);
                        break e;
                      }
                    }
                    u = c.createElement(s), re(u, s, a), c.head.appendChild(u);
                    break;
                  default:
                    throw Error(o(468, s));
                }
                u[ae] = t, ne(u), s = u;
              }
              t.stateNode = s;
            } else Vg(c, t.type, t.stateNode);
            else t.stateNode = zg(c, s, t.memoizedProps);
            else u !== s ? (u === null ? a.stateNode !== null && (a = a.stateNode, a.parentNode.removeChild(a)) : u.count--, s === null ? Vg(c, t.type, t.stateNode) : zg(c, s, t.memoizedProps)) : s === null && t.stateNode !== null && au(t, t.memoizedProps, a.memoizedProps);
          }
          break;
        case 27:
          xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), a !== null && s & 4 && au(t, t.memoizedProps, a.memoizedProps);
          break;
        case 5:
          if (xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), t.flags & 32) {
            c = t.stateNode;
            try {
              la(c, "");
            } catch (lt) {
              Nt(t, t.return, lt);
            }
          }
          s & 4 && t.stateNode != null && (c = t.memoizedProps, au(t, c, a !== null ? a.memoizedProps : c)), s & 1024 && (ou = true);
          break;
        case 6:
          if (xe(e, t), Se(t), s & 4) {
            if (t.stateNode === null) throw Error(o(162));
            s = t.memoizedProps, a = t.stateNode;
            try {
              a.nodeValue = s;
            } catch (lt) {
              Nt(t, t.return, lt);
            }
          }
          break;
        case 3:
          if (Ao = null, c = tn, tn = To(e.containerInfo), xe(e, t), tn = c, Se(t), s & 4 && a !== null && a.memoizedState.isDehydrated) try {
            La(e.containerInfo);
          } catch (lt) {
            Nt(t, t.return, lt);
          }
          ou && (ou = false, Vp(t));
          break;
        case 4:
          s = tn, tn = To(t.stateNode.containerInfo), xe(e, t), Se(t), tn = s;
          break;
        case 12:
          xe(e, t), Se(t);
          break;
        case 31:
          xe(e, t), Se(t), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, oo(t, s)));
          break;
        case 13:
          xe(e, t), Se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (co = Ae()), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, oo(t, s)));
          break;
        case 22:
          c = t.memoizedState !== null;
          var M = a !== null && a.memoizedState !== null, U = zn, P = $t;
          if (zn = U || c, $t = P || M, xe(e, t), $t = P, zn = U, Se(t), s & 8192) t: for (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || M || zn || $t || Gi(t)), a = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (a === null) {
                M = a = e;
                try {
                  if (u = M.stateNode, c) y = u.style, typeof y.setProperty == "function" ? y.setProperty("display", "none", "important") : y.display = "none";
                  else {
                    x = M.stateNode;
                    var J = M.memoizedProps.style, H = J != null && J.hasOwnProperty("display") ? J.display : null;
                    x.style.display = H == null || typeof H == "boolean" ? "" : ("" + H).trim();
                  }
                } catch (lt) {
                  Nt(M, M.return, lt);
                }
              }
            } else if (e.tag === 6) {
              if (a === null) {
                M = e;
                try {
                  M.stateNode.nodeValue = c ? "" : M.memoizedProps;
                } catch (lt) {
                  Nt(M, M.return, lt);
                }
              }
            } else if (e.tag === 18) {
              if (a === null) {
                M = e;
                try {
                  var Y = M.stateNode;
                  c ? Ag(Y, true) : Ag(M.stateNode, false);
                } catch (lt) {
                  Nt(M, M.return, lt);
                }
              }
            } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break t;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) break t;
              a === e && (a = null), e = e.return;
            }
            a === e && (a = null), e.sibling.return = e.return, e = e.sibling;
          }
          s & 4 && (s = t.updateQueue, s !== null && (a = s.retryQueue, a !== null && (s.retryQueue = null, oo(t, a))));
          break;
        case 19:
          xe(e, t), Se(t), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, oo(t, s)));
          break;
        case 30:
          break;
        case 21:
          break;
        default:
          xe(e, t), Se(t);
      }
    }
    function Se(t) {
      var e = t.flags;
      if (e & 2) {
        try {
          for (var a, s = t.return; s !== null; ) {
            if (Cp(s)) {
              a = s;
              break;
            }
            s = s.return;
          }
          if (a == null) throw Error(o(160));
          switch (a.tag) {
            case 27:
              var c = a.stateNode, u = su(t);
              lo(t, u, c);
              break;
            case 5:
              var y = a.stateNode;
              a.flags & 32 && (la(y, ""), a.flags &= -33);
              var x = su(t);
              lo(t, x, y);
              break;
            case 3:
            case 4:
              var M = a.stateNode.containerInfo, U = su(t);
              lu(t, U, M);
              break;
            default:
              throw Error(o(161));
          }
        } catch (P) {
          Nt(t, t.return, P);
        }
        t.flags &= -3;
      }
      e & 4096 && (t.flags &= -4097);
    }
    function Vp(t) {
      if (t.subtreeFlags & 1024) for (t = t.child; t !== null; ) {
        var e = t;
        Vp(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
    }
    function Vn(t, e) {
      if (e.subtreeFlags & 8772) for (e = e.child; e !== null; ) Dp(t, e.alternate, e), e = e.sibling;
    }
    function Gi(t) {
      for (t = t.child; t !== null; ) {
        var e = t;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ni(4, e, e.return), Gi(e);
            break;
          case 1:
            hn(e, e.return);
            var a = e.stateNode;
            typeof a.componentWillUnmount == "function" && Ap(e, e.return, a), Gi(e);
            break;
          case 27:
            qs(e.stateNode);
          case 26:
          case 5:
            hn(e, e.return), Gi(e);
            break;
          case 22:
            e.memoizedState === null && Gi(e);
            break;
          case 30:
            Gi(e);
            break;
          default:
            Gi(e);
        }
        t = t.sibling;
      }
    }
    function kn(t, e, a) {
      for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
        var s = e.alternate, c = t, u = e, y = u.flags;
        switch (u.tag) {
          case 0:
          case 11:
          case 15:
            kn(c, u, a), _s(4, u);
            break;
          case 1:
            if (kn(c, u, a), s = u, c = s.stateNode, typeof c.componentDidMount == "function") try {
              c.componentDidMount();
            } catch (U) {
              Nt(s, s.return, U);
            }
            if (s = u, c = s.updateQueue, c !== null) {
              var x = s.stateNode;
              try {
                var M = c.shared.hiddenCallbacks;
                if (M !== null) for (c.shared.hiddenCallbacks = null, c = 0; c < M.length; c++) dm(M[c], x);
              } catch (U) {
                Nt(s, s.return, U);
              }
            }
            a && y & 64 && wp(u), Vs(u, u.return);
            break;
          case 27:
            Mp(u);
          case 26:
          case 5:
            kn(c, u, a), a && s === null && y & 4 && Ep(u), Vs(u, u.return);
            break;
          case 12:
            kn(c, u, a);
            break;
          case 31:
            kn(c, u, a), a && y & 4 && Np(c, u);
            break;
          case 13:
            kn(c, u, a), a && y & 4 && zp(c, u);
            break;
          case 22:
            u.memoizedState === null && kn(c, u, a), Vs(u, u.return);
            break;
          case 30:
            break;
          default:
            kn(c, u, a);
        }
        e = e.sibling;
      }
    }
    function ru(t, e) {
      var a = null;
      t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ss(a));
    }
    function cu(t, e) {
      t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ss(t));
    }
    function en(t, e, a, s) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) kp(t, e, a, s), e = e.sibling;
    }
    function kp(t, e, a, s) {
      var c = e.flags;
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          en(t, e, a, s), c & 2048 && _s(9, e);
          break;
        case 1:
          en(t, e, a, s);
          break;
        case 3:
          en(t, e, a, s), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ss(t)));
          break;
        case 12:
          if (c & 2048) {
            en(t, e, a, s), t = e.stateNode;
            try {
              var u = e.memoizedProps, y = u.id, x = u.onPostCommit;
              typeof x == "function" && x(y, e.alternate === null ? "mount" : "update", t.passiveEffectDuration, -0);
            } catch (M) {
              Nt(e, e.return, M);
            }
          } else en(t, e, a, s);
          break;
        case 31:
          en(t, e, a, s);
          break;
        case 13:
          en(t, e, a, s);
          break;
        case 23:
          break;
        case 22:
          u = e.stateNode, y = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? en(t, e, a, s) : ks(t, e) : u._visibility & 2 ? en(t, e, a, s) : (u._visibility |= 2, Ca(t, e, a, s, (e.subtreeFlags & 10256) !== 0 || false)), c & 2048 && ru(y, e);
          break;
        case 24:
          en(t, e, a, s), c & 2048 && cu(e.alternate, e);
          break;
        default:
          en(t, e, a, s);
      }
    }
    function Ca(t, e, a, s, c) {
      for (c = c && ((e.subtreeFlags & 10256) !== 0 || false), e = e.child; e !== null; ) {
        var u = t, y = e, x = a, M = s, U = y.flags;
        switch (y.tag) {
          case 0:
          case 11:
          case 15:
            Ca(u, y, x, M, c), _s(8, y);
            break;
          case 23:
            break;
          case 22:
            var P = y.stateNode;
            y.memoizedState !== null ? P._visibility & 2 ? Ca(u, y, x, M, c) : ks(u, y) : (P._visibility |= 2, Ca(u, y, x, M, c)), c && U & 2048 && ru(y.alternate, y);
            break;
          case 24:
            Ca(u, y, x, M, c), c && U & 2048 && cu(y.alternate, y);
            break;
          default:
            Ca(u, y, x, M, c);
        }
        e = e.sibling;
      }
    }
    function ks(t, e) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) {
        var a = t, s = e, c = s.flags;
        switch (s.tag) {
          case 22:
            ks(a, s), c & 2048 && ru(s.alternate, s);
            break;
          case 24:
            ks(a, s), c & 2048 && cu(s.alternate, s);
            break;
          default:
            ks(a, s);
        }
        e = e.sibling;
      }
    }
    var Ls = 8192;
    function Ma(t, e, a) {
      if (t.subtreeFlags & Ls) for (t = t.child; t !== null; ) Lp(t, e, a), t = t.sibling;
    }
    function Lp(t, e, a) {
      switch (t.tag) {
        case 26:
          Ma(t, e, a), t.flags & Ls && t.memoizedState !== null && vT(a, tn, t.memoizedState, t.memoizedProps);
          break;
        case 5:
          Ma(t, e, a);
          break;
        case 3:
        case 4:
          var s = tn;
          tn = To(t.stateNode.containerInfo), Ma(t, e, a), tn = s;
          break;
        case 22:
          t.memoizedState === null && (s = t.alternate, s !== null && s.memoizedState !== null ? (s = Ls, Ls = 16777216, Ma(t, e, a), Ls = s) : Ma(t, e, a));
          break;
        default:
          Ma(t, e, a);
      }
    }
    function Bp(t) {
      var e = t.alternate;
      if (e !== null && (t = e.child, t !== null)) {
        e.child = null;
        do
          e = t.sibling, t.sibling = null, t = e;
        while (t !== null);
      }
    }
    function Bs(t) {
      var e = t.deletions;
      if ((t.flags & 16) !== 0) {
        if (e !== null) for (var a = 0; a < e.length; a++) {
          var s = e[a];
          ie = s, Hp(s, t);
        }
        Bp(t);
      }
      if (t.subtreeFlags & 10256) for (t = t.child; t !== null; ) Up(t), t = t.sibling;
    }
    function Up(t) {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          Bs(t), t.flags & 2048 && ni(9, t, t.return);
          break;
        case 3:
          Bs(t);
          break;
        case 12:
          Bs(t);
          break;
        case 22:
          var e = t.stateNode;
          t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, ro(t)) : Bs(t);
          break;
        default:
          Bs(t);
      }
    }
    function ro(t) {
      var e = t.deletions;
      if ((t.flags & 16) !== 0) {
        if (e !== null) for (var a = 0; a < e.length; a++) {
          var s = e[a];
          ie = s, Hp(s, t);
        }
        Bp(t);
      }
      for (t = t.child; t !== null; ) {
        switch (e = t, e.tag) {
          case 0:
          case 11:
          case 15:
            ni(8, e, e.return), ro(e);
            break;
          case 22:
            a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, ro(e));
            break;
          default:
            ro(e);
        }
        t = t.sibling;
      }
    }
    function Hp(t, e) {
      for (; ie !== null; ) {
        var a = ie;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            ni(8, a, e);
            break;
          case 23:
          case 22:
            if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
              var s = a.memoizedState.cachePool.pool;
              s != null && s.refCount++;
            }
            break;
          case 24:
            Ss(a.memoizedState.cache);
        }
        if (s = a.child, s !== null) s.return = a, ie = s;
        else t: for (a = t; ie !== null; ) {
          s = ie;
          var c = s.sibling, u = s.return;
          if (Op(s), s === a) {
            ie = null;
            break t;
          }
          if (c !== null) {
            c.return = u, ie = c;
            break t;
          }
          ie = u;
        }
      }
    }
    var zS = {
      getCacheForType: function(t) {
        var e = le(Qt), a = e.data.get(t);
        return a === void 0 && (a = t(), e.data.set(t, a)), a;
      },
      cacheSignal: function() {
        return le(Qt).controller.signal;
      }
    }, _S = typeof WeakMap == "function" ? WeakMap : Map, Dt = 0, kt = null, Tt = null, At = 0, jt = 0, je = null, ii = false, Ra = false, uu = false, Ln = 0, qt = 0, ai = 0, Yi = 0, fu = 0, Ne = 0, Da = 0, Us = null, Te = null, du = false, co = 0, Gp = 0, uo = 1 / 0, fo = null, si = null, It = 0, li = null, Oa = null, Bn = 0, hu = 0, mu = null, Yp = null, Hs = 0, pu = null;
    function ze() {
      return (Dt & 2) !== 0 && At !== 0 ? At & -At : k.T !== null ? Su() : ah();
    }
    function Pp() {
      if (Ne === 0) if ((At & 536870912) === 0 || Ct) {
        var t = bl;
        bl <<= 1, (bl & 3932160) === 0 && (bl = 262144), Ne = t;
      } else Ne = 536870912;
      return t = De.current, t !== null && (t.flags |= 32), Ne;
    }
    function we(t, e, a) {
      (t === kt && (jt === 2 || jt === 9) || t.cancelPendingCommit !== null) && (ja(t, 0), oi(t, At, Ne, false)), os(t, a), ((Dt & 2) === 0 || t !== kt) && (t === kt && ((Dt & 2) === 0 && (Yi |= a), qt === 4 && oi(t, At, Ne, false)), mn(t));
    }
    function qp(t, e, a) {
      if ((Dt & 6) !== 0) throw Error(o(327));
      var s = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || ls(t, e), c = s ? LS(t, e) : yu(t, e, true), u = s;
      do {
        if (c === 0) {
          Ra && !s && oi(t, e, 0, false);
          break;
        } else {
          if (a = t.current.alternate, u && !VS(a)) {
            c = yu(t, e, false), u = false;
            continue;
          }
          if (c === 2) {
            if (u = e, t.errorRecoveryDisabledLanes & u) var y = 0;
            else y = t.pendingLanes & -536870913, y = y !== 0 ? y : y & 536870912 ? 536870912 : 0;
            if (y !== 0) {
              e = y;
              t: {
                var x = t;
                c = Us;
                var M = x.current.memoizedState.isDehydrated;
                if (M && (ja(x, y).flags |= 256), y = yu(x, y, false), y !== 2) {
                  if (uu && !M) {
                    x.errorRecoveryDisabledLanes |= u, Yi |= u, c = 4;
                    break t;
                  }
                  u = Te, Te = c, u !== null && (Te === null ? Te = u : Te.push.apply(Te, u));
                }
                c = y;
              }
              if (u = false, c !== 2) continue;
            }
          }
          if (c === 1) {
            ja(t, 0), oi(t, e, 0, true);
            break;
          }
          t: {
            switch (s = t, u = c, u) {
              case 0:
              case 1:
                throw Error(o(345));
              case 4:
                if ((e & 4194048) !== e) break;
              case 6:
                oi(s, e, Ne, !ii);
                break t;
              case 2:
                Te = null;
                break;
              case 3:
              case 5:
                break;
              default:
                throw Error(o(329));
            }
            if ((e & 62914560) === e && (c = co + 300 - Ae(), 10 < c)) {
              if (oi(s, e, Ne, !ii), Sl(s, 0, true) !== 0) break t;
              Bn = e, s.timeoutHandle = Sg(Xp.bind(null, s, a, Te, fo, du, e, Ne, Yi, Da, ii, u, "Throttled", -0, 0), c);
              break t;
            }
            Xp(s, a, Te, fo, du, e, Ne, Yi, Da, ii, u, null, -0, 0);
          }
        }
        break;
      } while (true);
      mn(t);
    }
    function Xp(t, e, a, s, c, u, y, x, M, U, P, J, H, Y) {
      if (t.timeoutHandle = -1, J = e.subtreeFlags, J & 8192 || (J & 16785408) === 16785408) {
        J = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: true,
          waitingForViewTransition: false,
          unsuspend: wn
        }, Lp(e, u, J);
        var lt = (u & 62914560) === u ? co - Ae() : (u & 4194048) === u ? Gp - Ae() : 0;
        if (lt = bT(J, lt), lt !== null) {
          Bn = u, t.cancelPendingCommit = lt(Ip.bind(null, t, e, u, a, s, c, y, x, M, P, J, null, H, Y)), oi(t, u, y, !U);
          return;
        }
      }
      Ip(t, e, u, a, s, c, y, x, M);
    }
    function VS(t) {
      for (var e = t; ; ) {
        var a = e.tag;
        if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null))) for (var s = 0; s < a.length; s++) {
          var c = a[s], u = c.getSnapshot;
          c = c.value;
          try {
            if (!Me(u(), c)) return false;
          } catch {
            return false;
          }
        }
        if (a = e.child, e.subtreeFlags & 16384 && a !== null) a.return = e, e = a;
        else {
          if (e === t) break;
          for (; e.sibling === null; ) {
            if (e.return === null || e.return === t) return true;
            e = e.return;
          }
          e.sibling.return = e.return, e = e.sibling;
        }
      }
      return true;
    }
    function oi(t, e, a, s) {
      e &= ~fu, e &= ~Yi, t.suspendedLanes |= e, t.pingedLanes &= ~e, s && (t.warmLanes |= e), s = t.expirationTimes;
      for (var c = e; 0 < c; ) {
        var u = 31 - Ce(c), y = 1 << u;
        s[u] = -1, c &= ~y;
      }
      a !== 0 && eh(t, a, e);
    }
    function ho() {
      return (Dt & 6) === 0 ? (Gs(0), false) : true;
    }
    function gu() {
      if (Tt !== null) {
        if (jt === 0) var t = Tt.return;
        else t = Tt, Mn = zi = null, Nc(t), Sa = null, ws = 0, t = Tt;
        for (; t !== null; ) Tp(t.alternate, t), t = t.return;
        Tt = null;
      }
    }
    function ja(t, e) {
      var a = t.timeoutHandle;
      a !== -1 && (t.timeoutHandle = -1, eT(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), Bn = 0, gu(), kt = t, Tt = a = En(t.current, null), At = e, jt = 0, je = null, ii = false, Ra = ls(t, e), uu = false, Da = Ne = fu = Yi = ai = qt = 0, Te = Us = null, du = false, (e & 8) !== 0 && (e |= e & 32);
      var s = t.entangledLanes;
      if (s !== 0) for (t = t.entanglements, s &= e; 0 < s; ) {
        var c = 31 - Ce(s), u = 1 << c;
        e |= t[c], s &= ~u;
      }
      return Ln = e, zl(), a;
    }
    function Kp(t, e) {
      bt = null, k.H = js, e === xa || e === Gl ? (e = rm(), jt = 3) : e === xc ? (e = rm(), jt = 4) : jt = e === Qc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, je = e, Tt === null && (qt = 1, eo(t, Ge(e, t.current)));
    }
    function Zp() {
      var t = De.current;
      return t === null ? true : (At & 4194048) === At ? Xe === null : (At & 62914560) === At || (At & 536870912) !== 0 ? t === Xe : false;
    }
    function Qp() {
      var t = k.H;
      return k.H = js, t === null ? js : t;
    }
    function Fp() {
      var t = k.A;
      return k.A = zS, t;
    }
    function mo() {
      qt = 4, ii || (At & 4194048) !== At && De.current !== null || (Ra = true), (ai & 134217727) === 0 && (Yi & 134217727) === 0 || kt === null || oi(kt, At, Ne, false);
    }
    function yu(t, e, a) {
      var s = Dt;
      Dt |= 2;
      var c = Qp(), u = Fp();
      (kt !== t || At !== e) && (fo = null, ja(t, e)), e = false;
      var y = qt;
      t: do
        try {
          if (jt !== 0 && Tt !== null) {
            var x = Tt, M = je;
            switch (jt) {
              case 8:
                gu(), y = 6;
                break t;
              case 3:
              case 2:
              case 9:
              case 6:
                De.current === null && (e = true);
                var U = jt;
                if (jt = 0, je = null, Na(t, x, M, U), a && Ra) {
                  y = 0;
                  break t;
                }
                break;
              default:
                U = jt, jt = 0, je = null, Na(t, x, M, U);
            }
          }
          kS(), y = qt;
          break;
        } catch (P) {
          Kp(t, P);
        }
      while (true);
      return e && t.shellSuspendCounter++, Mn = zi = null, Dt = s, k.H = c, k.A = u, Tt === null && (kt = null, At = 0, zl()), y;
    }
    function kS() {
      for (; Tt !== null; ) Jp(Tt);
    }
    function LS(t, e) {
      var a = Dt;
      Dt |= 2;
      var s = Qp(), c = Fp();
      kt !== t || At !== e ? (fo = null, uo = Ae() + 500, ja(t, e)) : Ra = ls(t, e);
      t: do
        try {
          if (jt !== 0 && Tt !== null) {
            e = Tt;
            var u = je;
            e: switch (jt) {
              case 1:
                jt = 0, je = null, Na(t, e, u, 1);
                break;
              case 2:
              case 9:
                if (lm(u)) {
                  jt = 0, je = null, $p(e);
                  break;
                }
                e = function() {
                  jt !== 2 && jt !== 9 || kt !== t || (jt = 7), mn(t);
                }, u.then(e, e);
                break t;
              case 3:
                jt = 7;
                break t;
              case 4:
                jt = 5;
                break t;
              case 7:
                lm(u) ? (jt = 0, je = null, $p(e)) : (jt = 0, je = null, Na(t, e, u, 7));
                break;
              case 5:
                var y = null;
                switch (Tt.tag) {
                  case 26:
                    y = Tt.memoizedState;
                  case 5:
                  case 27:
                    var x = Tt;
                    if (y ? kg(y) : x.stateNode.complete) {
                      jt = 0, je = null;
                      var M = x.sibling;
                      if (M !== null) Tt = M;
                      else {
                        var U = x.return;
                        U !== null ? (Tt = U, po(U)) : Tt = null;
                      }
                      break e;
                    }
                }
                jt = 0, je = null, Na(t, e, u, 5);
                break;
              case 6:
                jt = 0, je = null, Na(t, e, u, 6);
                break;
              case 8:
                gu(), qt = 6;
                break t;
              default:
                throw Error(o(462));
            }
          }
          BS();
          break;
        } catch (P) {
          Kp(t, P);
        }
      while (true);
      return Mn = zi = null, k.H = s, k.A = c, Dt = a, Tt !== null ? 0 : (kt = null, At = 0, zl(), qt);
    }
    function BS() {
      for (; Tt !== null && !o1(); ) Jp(Tt);
    }
    function Jp(t) {
      var e = xp(t.alternate, t, Ln);
      t.memoizedProps = t.pendingProps, e === null ? po(t) : Tt = e;
    }
    function $p(t) {
      var e = t, a = e.alternate;
      switch (e.tag) {
        case 15:
        case 0:
          e = mp(a, e, e.pendingProps, e.type, void 0, At);
          break;
        case 11:
          e = mp(a, e, e.pendingProps, e.type.render, e.ref, At);
          break;
        case 5:
          Nc(e);
        default:
          Tp(a, e), e = Tt = Fh(e, Ln), e = xp(a, e, Ln);
      }
      t.memoizedProps = t.pendingProps, e === null ? po(t) : Tt = e;
    }
    function Na(t, e, a, s) {
      Mn = zi = null, Nc(e), Sa = null, ws = 0;
      var c = e.return;
      try {
        if (CS(t, c, e, a, At)) {
          qt = 1, eo(t, Ge(a, t.current)), Tt = null;
          return;
        }
      } catch (u) {
        if (c !== null) throw Tt = c, u;
        qt = 1, eo(t, Ge(a, t.current)), Tt = null;
        return;
      }
      e.flags & 32768 ? (Ct || s === 1 ? t = true : Ra || (At & 536870912) !== 0 ? t = false : (ii = t = true, (s === 2 || s === 9 || s === 3 || s === 6) && (s = De.current, s !== null && s.tag === 13 && (s.flags |= 16384))), Wp(e, t)) : po(e);
    }
    function po(t) {
      var e = t;
      do {
        if ((e.flags & 32768) !== 0) {
          Wp(e, ii);
          return;
        }
        t = e.return;
        var a = DS(e.alternate, e, Ln);
        if (a !== null) {
          Tt = a;
          return;
        }
        if (e = e.sibling, e !== null) {
          Tt = e;
          return;
        }
        Tt = e = t;
      } while (e !== null);
      qt === 0 && (qt = 5);
    }
    function Wp(t, e) {
      do {
        var a = OS(t.alternate, t);
        if (a !== null) {
          a.flags &= 32767, Tt = a;
          return;
        }
        if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
          Tt = t;
          return;
        }
        Tt = t = a;
      } while (t !== null);
      qt = 6, Tt = null;
    }
    function Ip(t, e, a, s, c, u, y, x, M) {
      t.cancelPendingCommit = null;
      do
        go();
      while (It !== 0);
      if ((Dt & 6) !== 0) throw Error(o(327));
      if (e !== null) {
        if (e === t.current) throw Error(o(177));
        if (u = e.lanes | e.childLanes, u |= sc, y1(t, a, u, y, x, M), t === kt && (Tt = kt = null, At = 0), Oa = e, li = t, Bn = a, hu = u, mu = c, Yp = s, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, YS(yl, function() {
          return ag(), null;
        })) : (t.callbackNode = null, t.callbackPriority = 0), s = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || s) {
          s = k.T, k.T = null, c = F.p, F.p = 2, y = Dt, Dt |= 4;
          try {
            jS(t, e, a);
          } finally {
            Dt = y, F.p = c, k.T = s;
          }
        }
        It = 1, tg(), eg(), ng();
      }
    }
    function tg() {
      if (It === 1) {
        It = 0;
        var t = li, e = Oa, a = (e.flags & 13878) !== 0;
        if ((e.subtreeFlags & 13878) !== 0 || a) {
          a = k.T, k.T = null;
          var s = F.p;
          F.p = 2;
          var c = Dt;
          Dt |= 4;
          try {
            _p(e, t);
            var u = Du, y = Hh(t.containerInfo), x = u.focusedElem, M = u.selectionRange;
            if (y !== x && x && x.ownerDocument && Uh(x.ownerDocument.documentElement, x)) {
              if (M !== null && tc(x)) {
                var U = M.start, P = M.end;
                if (P === void 0 && (P = U), "selectionStart" in x) x.selectionStart = U, x.selectionEnd = Math.min(P, x.value.length);
                else {
                  var J = x.ownerDocument || document, H = J && J.defaultView || window;
                  if (H.getSelection) {
                    var Y = H.getSelection(), lt = x.textContent.length, pt = Math.min(M.start, lt), Vt = M.end === void 0 ? pt : Math.min(M.end, lt);
                    !Y.extend && pt > Vt && (y = Vt, Vt = pt, pt = y);
                    var _ = Bh(x, pt), D = Bh(x, Vt);
                    if (_ && D && (Y.rangeCount !== 1 || Y.anchorNode !== _.node || Y.anchorOffset !== _.offset || Y.focusNode !== D.node || Y.focusOffset !== D.offset)) {
                      var B = J.createRange();
                      B.setStart(_.node, _.offset), Y.removeAllRanges(), pt > Vt ? (Y.addRange(B), Y.extend(D.node, D.offset)) : (B.setEnd(D.node, D.offset), Y.addRange(B));
                    }
                  }
                }
              }
              for (J = [], Y = x; Y = Y.parentNode; ) Y.nodeType === 1 && J.push({
                element: Y,
                left: Y.scrollLeft,
                top: Y.scrollTop
              });
              for (typeof x.focus == "function" && x.focus(), x = 0; x < J.length; x++) {
                var Q = J[x];
                Q.element.scrollLeft = Q.left, Q.element.scrollTop = Q.top;
              }
            }
            Ro = !!Ru, Du = Ru = null;
          } finally {
            Dt = c, F.p = s, k.T = a;
          }
        }
        t.current = e, It = 2;
      }
    }
    function eg() {
      if (It === 2) {
        It = 0;
        var t = li, e = Oa, a = (e.flags & 8772) !== 0;
        if ((e.subtreeFlags & 8772) !== 0 || a) {
          a = k.T, k.T = null;
          var s = F.p;
          F.p = 2;
          var c = Dt;
          Dt |= 4;
          try {
            Dp(t, e.alternate, e);
          } finally {
            Dt = c, F.p = s, k.T = a;
          }
        }
        It = 3;
      }
    }
    function ng() {
      if (It === 4 || It === 3) {
        It = 0, r1();
        var t = li, e = Oa, a = Bn, s = Yp;
        (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? It = 5 : (It = 0, Oa = li = null, ig(t, t.pendingLanes));
        var c = t.pendingLanes;
        if (c === 0 && (si = null), Vr(a), e = e.stateNode, Ee && typeof Ee.onCommitFiberRoot == "function") try {
          Ee.onCommitFiberRoot(ss, e, void 0, (e.current.flags & 128) === 128);
        } catch {
        }
        if (s !== null) {
          e = k.T, c = F.p, F.p = 2, k.T = null;
          try {
            for (var u = t.onRecoverableError, y = 0; y < s.length; y++) {
              var x = s[y];
              u(x.value, {
                componentStack: x.stack
              });
            }
          } finally {
            k.T = e, F.p = c;
          }
        }
        (Bn & 3) !== 0 && go(), mn(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === pu ? Hs++ : (Hs = 0, pu = t) : Hs = 0, Gs(0);
      }
    }
    function ig(t, e) {
      (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ss(e)));
    }
    function go() {
      return tg(), eg(), ng(), ag();
    }
    function ag() {
      if (It !== 5) return false;
      var t = li, e = hu;
      hu = 0;
      var a = Vr(Bn), s = k.T, c = F.p;
      try {
        F.p = 32 > a ? 32 : a, k.T = null, a = mu, mu = null;
        var u = li, y = Bn;
        if (It = 0, Oa = li = null, Bn = 0, (Dt & 6) !== 0) throw Error(o(331));
        var x = Dt;
        if (Dt |= 4, Up(u.current), kp(u, u.current, y, a), Dt = x, Gs(0, false), Ee && typeof Ee.onPostCommitFiberRoot == "function") try {
          Ee.onPostCommitFiberRoot(ss, u);
        } catch {
        }
        return true;
      } finally {
        F.p = c, k.T = s, ig(t, e);
      }
    }
    function sg(t, e, a) {
      e = Ge(a, e), e = Zc(t.stateNode, e, 2), t = In(t, e, 2), t !== null && (os(t, 2), mn(t));
    }
    function Nt(t, e, a) {
      if (t.tag === 3) sg(t, t, a);
      else for (; e !== null; ) {
        if (e.tag === 3) {
          sg(e, t, a);
          break;
        } else if (e.tag === 1) {
          var s = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof s.componentDidCatch == "function" && (si === null || !si.has(s))) {
            t = Ge(a, t), a = lp(2), s = In(e, a, 2), s !== null && (op(a, s, e, t), os(s, 2), mn(s));
            break;
          }
        }
        e = e.return;
      }
    }
    function vu(t, e, a) {
      var s = t.pingCache;
      if (s === null) {
        s = t.pingCache = new _S();
        var c = /* @__PURE__ */ new Set();
        s.set(e, c);
      } else c = s.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), s.set(e, c));
      c.has(a) || (uu = true, c.add(a), t = US.bind(null, t, e, a), e.then(t, t));
    }
    function US(t, e, a) {
      var s = t.pingCache;
      s !== null && s.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, kt === t && (At & a) === a && (qt === 4 || qt === 3 && (At & 62914560) === At && 300 > Ae() - co ? (Dt & 2) === 0 && ja(t, 0) : fu |= a, Da === At && (Da = 0)), mn(t);
    }
    function lg(t, e) {
      e === 0 && (e = th()), t = Oi(t, e), t !== null && (os(t, e), mn(t));
    }
    function HS(t) {
      var e = t.memoizedState, a = 0;
      e !== null && (a = e.retryLane), lg(t, a);
    }
    function GS(t, e) {
      var a = 0;
      switch (t.tag) {
        case 31:
        case 13:
          var s = t.stateNode, c = t.memoizedState;
          c !== null && (a = c.retryLane);
          break;
        case 19:
          s = t.stateNode;
          break;
        case 22:
          s = t.stateNode._retryCache;
          break;
        default:
          throw Error(o(314));
      }
      s !== null && s.delete(e), lg(t, a);
    }
    function YS(t, e) {
      return jr(t, e);
    }
    var yo = null, za = null, bu = false, vo = false, xu = false, ri = 0;
    function mn(t) {
      t !== za && t.next === null && (za === null ? yo = za = t : za = za.next = t), vo = true, bu || (bu = true, qS());
    }
    function Gs(t, e) {
      if (!xu && vo) {
        xu = true;
        do
          for (var a = false, s = yo; s !== null; ) {
            if (t !== 0) {
              var c = s.pendingLanes;
              if (c === 0) var u = 0;
              else {
                var y = s.suspendedLanes, x = s.pingedLanes;
                u = (1 << 31 - Ce(42 | t) + 1) - 1, u &= c & ~(y & ~x), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
              }
              u !== 0 && (a = true, ug(s, u));
            } else u = At, u = Sl(s, s === kt ? u : 0, s.cancelPendingCommit !== null || s.timeoutHandle !== -1), (u & 3) === 0 || ls(s, u) || (a = true, ug(s, u));
            s = s.next;
          }
        while (a);
        xu = false;
      }
    }
    function PS() {
      og();
    }
    function og() {
      vo = bu = false;
      var t = 0;
      ri !== 0 && tT() && (t = ri);
      for (var e = Ae(), a = null, s = yo; s !== null; ) {
        var c = s.next, u = rg(s, e);
        u === 0 ? (s.next = null, a === null ? yo = c : a.next = c, c === null && (za = a)) : (a = s, (t !== 0 || (u & 3) !== 0) && (vo = true)), s = c;
      }
      It !== 0 && It !== 5 || Gs(t), ri !== 0 && (ri = 0);
    }
    function rg(t, e) {
      for (var a = t.suspendedLanes, s = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
        var y = 31 - Ce(u), x = 1 << y, M = c[y];
        M === -1 ? ((x & a) === 0 || (x & s) !== 0) && (c[y] = g1(x, e)) : M <= e && (t.expiredLanes |= x), u &= ~x;
      }
      if (e = kt, a = At, a = Sl(t, t === e ? a : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), s = t.callbackNode, a === 0 || t === e && (jt === 2 || jt === 9) || t.cancelPendingCommit !== null) return s !== null && s !== null && Nr(s), t.callbackNode = null, t.callbackPriority = 0;
      if ((a & 3) === 0 || ls(t, a)) {
        if (e = a & -a, e === t.callbackPriority) return e;
        switch (s !== null && Nr(s), Vr(a)) {
          case 2:
          case 8:
            a = Wd;
            break;
          case 32:
            a = yl;
            break;
          case 268435456:
            a = Id;
            break;
          default:
            a = yl;
        }
        return s = cg.bind(null, t), a = jr(a, s), t.callbackPriority = e, t.callbackNode = a, e;
      }
      return s !== null && s !== null && Nr(s), t.callbackPriority = 2, t.callbackNode = null, 2;
    }
    function cg(t, e) {
      if (It !== 0 && It !== 5) return t.callbackNode = null, t.callbackPriority = 0, null;
      var a = t.callbackNode;
      if (go() && t.callbackNode !== a) return null;
      var s = At;
      return s = Sl(t, t === kt ? s : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), s === 0 ? null : (qp(t, s, e), rg(t, Ae()), t.callbackNode != null && t.callbackNode === a ? cg.bind(null, t) : null);
    }
    function ug(t, e) {
      if (go()) return null;
      qp(t, e, true);
    }
    function qS() {
      nT(function() {
        (Dt & 6) !== 0 ? jr($d, PS) : og();
      });
    }
    function Su() {
      if (ri === 0) {
        var t = va;
        t === 0 && (t = vl, vl <<= 1, (vl & 261888) === 0 && (vl = 256)), ri = t;
      }
      return ri;
    }
    function fg(t) {
      return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : El("" + t);
    }
    function dg(t, e) {
      var a = e.ownerDocument.createElement("input");
      return a.name = e.name, a.value = e.value, t.id && a.setAttribute("form", t.id), e.parentNode.insertBefore(a, e), t = new FormData(t), a.parentNode.removeChild(a), t;
    }
    function XS(t, e, a, s, c) {
      if (e === "submit" && a && a.stateNode === c) {
        var u = fg((c[ye] || null).action), y = s.submitter;
        y && (e = (e = y[ye] || null) ? fg(e.formAction) : y.getAttribute("formAction"), e !== null && (u = e, y = null));
        var x = new Dl("action", "action", null, s, c);
        t.push({
          event: x,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (s.defaultPrevented) {
                  if (ri !== 0) {
                    var M = y ? dg(c, y) : new FormData(c);
                    Gc(a, {
                      pending: true,
                      data: M,
                      method: c.method,
                      action: u
                    }, null, M);
                  }
                } else typeof u == "function" && (x.preventDefault(), M = y ? dg(c, y) : new FormData(c), Gc(a, {
                  pending: true,
                  data: M,
                  method: c.method,
                  action: u
                }, u, M));
              },
              currentTarget: c
            }
          ]
        });
      }
    }
    for (var Tu = 0; Tu < ac.length; Tu++) {
      var wu = ac[Tu], KS = wu.toLowerCase(), ZS = wu[0].toUpperCase() + wu.slice(1);
      Ie(KS, "on" + ZS);
    }
    Ie(Ph, "onAnimationEnd"), Ie(qh, "onAnimationIteration"), Ie(Xh, "onAnimationStart"), Ie("dblclick", "onDoubleClick"), Ie("focusin", "onFocus"), Ie("focusout", "onBlur"), Ie(cS, "onTransitionRun"), Ie(uS, "onTransitionStart"), Ie(fS, "onTransitionCancel"), Ie(Kh, "onTransitionEnd"), aa("onMouseEnter", [
      "mouseout",
      "mouseover"
    ]), aa("onMouseLeave", [
      "mouseout",
      "mouseover"
    ]), aa("onPointerEnter", [
      "pointerout",
      "pointerover"
    ]), aa("onPointerLeave", [
      "pointerout",
      "pointerover"
    ]), Ci("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), Ci("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), Ci("onBeforeInput", [
      "compositionend",
      "keypress",
      "textInput",
      "paste"
    ]), Ci("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), Ci("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), Ci("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
    var Ys = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), QS = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Ys));
    function hg(t, e) {
      e = (e & 4) !== 0;
      for (var a = 0; a < t.length; a++) {
        var s = t[a], c = s.event;
        s = s.listeners;
        t: {
          var u = void 0;
          if (e) for (var y = s.length - 1; 0 <= y; y--) {
            var x = s[y], M = x.instance, U = x.currentTarget;
            if (x = x.listener, M !== u && c.isPropagationStopped()) break t;
            u = x, c.currentTarget = U;
            try {
              u(c);
            } catch (P) {
              Nl(P);
            }
            c.currentTarget = null, u = M;
          }
          else for (y = 0; y < s.length; y++) {
            if (x = s[y], M = x.instance, U = x.currentTarget, x = x.listener, M !== u && c.isPropagationStopped()) break t;
            u = x, c.currentTarget = U;
            try {
              u(c);
            } catch (P) {
              Nl(P);
            }
            c.currentTarget = null, u = M;
          }
        }
      }
    }
    function wt(t, e) {
      var a = e[kr];
      a === void 0 && (a = e[kr] = /* @__PURE__ */ new Set());
      var s = t + "__bubble";
      a.has(s) || (mg(e, t, 2, false), a.add(s));
    }
    function Au(t, e, a) {
      var s = 0;
      e && (s |= 4), mg(a, t, s, e);
    }
    var bo = "_reactListening" + Math.random().toString(36).slice(2);
    function Eu(t) {
      if (!t[bo]) {
        t[bo] = true, oh.forEach(function(a) {
          a !== "selectionchange" && (QS.has(a) || Au(a, false, t), Au(a, true, t));
        });
        var e = t.nodeType === 9 ? t : t.ownerDocument;
        e === null || e[bo] || (e[bo] = true, Au("selectionchange", false, e));
      }
    }
    function mg(t, e, a, s) {
      switch (Pg(e)) {
        case 2:
          var c = TT;
          break;
        case 8:
          c = wT;
          break;
        default:
          c = Hu;
      }
      a = c.bind(null, e, a, t), c = void 0, !Xr || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (c = true), s ? c !== void 0 ? t.addEventListener(e, a, {
        capture: true,
        passive: c
      }) : t.addEventListener(e, a, true) : c !== void 0 ? t.addEventListener(e, a, {
        passive: c
      }) : t.addEventListener(e, a, false);
    }
    function Cu(t, e, a, s, c) {
      var u = s;
      if ((e & 1) === 0 && (e & 2) === 0 && s !== null) t: for (; ; ) {
        if (s === null) return;
        var y = s.tag;
        if (y === 3 || y === 4) {
          var x = s.stateNode.containerInfo;
          if (x === c) break;
          if (y === 4) for (y = s.return; y !== null; ) {
            var M = y.tag;
            if ((M === 3 || M === 4) && y.stateNode.containerInfo === c) return;
            y = y.return;
          }
          for (; x !== null; ) {
            if (y = ea(x), y === null) return;
            if (M = y.tag, M === 5 || M === 6 || M === 26 || M === 27) {
              s = u = y;
              continue t;
            }
            x = x.parentNode;
          }
        }
        s = s.return;
      }
      bh(function() {
        var U = u, P = Pr(a), J = [];
        t: {
          var H = Zh.get(t);
          if (H !== void 0) {
            var Y = Dl, lt = t;
            switch (t) {
              case "keypress":
                if (Ml(a) === 0) break t;
              case "keydown":
              case "keyup":
                Y = G1;
                break;
              case "focusin":
                lt = "focus", Y = Fr;
                break;
              case "focusout":
                lt = "blur", Y = Fr;
                break;
              case "beforeblur":
              case "afterblur":
                Y = Fr;
                break;
              case "click":
                if (a.button === 2) break t;
              case "auxclick":
              case "dblclick":
              case "mousedown":
              case "mousemove":
              case "mouseup":
              case "mouseout":
              case "mouseover":
              case "contextmenu":
                Y = Th;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                Y = D1;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                Y = q1;
                break;
              case Ph:
              case qh:
              case Xh:
                Y = N1;
                break;
              case Kh:
                Y = K1;
                break;
              case "scroll":
              case "scrollend":
                Y = M1;
                break;
              case "wheel":
                Y = Q1;
                break;
              case "copy":
              case "cut":
              case "paste":
                Y = _1;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                Y = Ah;
                break;
              case "toggle":
              case "beforetoggle":
                Y = J1;
            }
            var pt = (e & 4) !== 0, Vt = !pt && (t === "scroll" || t === "scrollend"), _ = pt ? H !== null ? H + "Capture" : null : H;
            pt = [];
            for (var D = U, B; D !== null; ) {
              var Q = D;
              if (B = Q.stateNode, Q = Q.tag, Q !== 5 && Q !== 26 && Q !== 27 || B === null || _ === null || (Q = us(D, _), Q != null && pt.push(Ps(D, Q, B))), Vt) break;
              D = D.return;
            }
            0 < pt.length && (H = new Y(H, lt, null, a, P), J.push({
              event: H,
              listeners: pt
            }));
          }
        }
        if ((e & 7) === 0) {
          t: {
            if (H = t === "mouseover" || t === "pointerover", Y = t === "mouseout" || t === "pointerout", H && a !== Yr && (lt = a.relatedTarget || a.fromElement) && (ea(lt) || lt[ta])) break t;
            if ((Y || H) && (H = P.window === P ? P : (H = P.ownerDocument) ? H.defaultView || H.parentWindow : window, Y ? (lt = a.relatedTarget || a.toElement, Y = U, lt = lt ? ea(lt) : null, lt !== null && (Vt = d(lt), pt = lt.tag, lt !== Vt || pt !== 5 && pt !== 27 && pt !== 6) && (lt = null)) : (Y = null, lt = U), Y !== lt)) {
              if (pt = Th, Q = "onMouseLeave", _ = "onMouseEnter", D = "mouse", (t === "pointerout" || t === "pointerover") && (pt = Ah, Q = "onPointerLeave", _ = "onPointerEnter", D = "pointer"), Vt = Y == null ? H : cs(Y), B = lt == null ? H : cs(lt), H = new pt(Q, D + "leave", Y, a, P), H.target = Vt, H.relatedTarget = B, Q = null, ea(P) === U && (pt = new pt(_, D + "enter", lt, a, P), pt.target = B, pt.relatedTarget = Vt, Q = pt), Vt = Q, Y && lt) e: {
                for (pt = FS, _ = Y, D = lt, B = 0, Q = _; Q; Q = pt(Q)) B++;
                Q = 0;
                for (var ft = D; ft; ft = pt(ft)) Q++;
                for (; 0 < B - Q; ) _ = pt(_), B--;
                for (; 0 < Q - B; ) D = pt(D), Q--;
                for (; B--; ) {
                  if (_ === D || D !== null && _ === D.alternate) {
                    pt = _;
                    break e;
                  }
                  _ = pt(_), D = pt(D);
                }
                pt = null;
              }
              else pt = null;
              Y !== null && pg(J, H, Y, pt, false), lt !== null && Vt !== null && pg(J, Vt, lt, pt, true);
            }
          }
          t: {
            if (H = U ? cs(U) : window, Y = H.nodeName && H.nodeName.toLowerCase(), Y === "select" || Y === "input" && H.type === "file") var Mt = Nh;
            else if (Oh(H)) if (zh) Mt = lS;
            else {
              Mt = aS;
              var ut = iS;
            }
            else Y = H.nodeName, !Y || Y.toLowerCase() !== "input" || H.type !== "checkbox" && H.type !== "radio" ? U && Gr(U.elementType) && (Mt = Nh) : Mt = sS;
            if (Mt && (Mt = Mt(t, U))) {
              jh(J, Mt, a, P);
              break t;
            }
            ut && ut(t, H, U), t === "focusout" && U && H.type === "number" && U.memoizedProps.value != null && Hr(H, "number", H.value);
          }
          switch (ut = U ? cs(U) : window, t) {
            case "focusin":
              (Oh(ut) || ut.contentEditable === "true") && (ua = ut, ec = U, vs = null);
              break;
            case "focusout":
              vs = ec = ua = null;
              break;
            case "mousedown":
              nc = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              nc = false, Gh(J, a, P);
              break;
            case "selectionchange":
              if (rS) break;
            case "keydown":
            case "keyup":
              Gh(J, a, P);
          }
          var xt;
          if ($r) t: {
            switch (t) {
              case "compositionstart":
                var Et = "onCompositionStart";
                break t;
              case "compositionend":
                Et = "onCompositionEnd";
                break t;
              case "compositionupdate":
                Et = "onCompositionUpdate";
                break t;
            }
            Et = void 0;
          }
          else ca ? Rh(t, a) && (Et = "onCompositionEnd") : t === "keydown" && a.keyCode === 229 && (Et = "onCompositionStart");
          Et && (Eh && a.locale !== "ko" && (ca || Et !== "onCompositionStart" ? Et === "onCompositionEnd" && ca && (xt = xh()) : (Kn = P, Kr = "value" in Kn ? Kn.value : Kn.textContent, ca = true)), ut = xo(U, Et), 0 < ut.length && (Et = new wh(Et, t, null, a, P), J.push({
            event: Et,
            listeners: ut
          }), xt ? Et.data = xt : (xt = Dh(a), xt !== null && (Et.data = xt)))), (xt = W1 ? I1(t, a) : tS(t, a)) && (Et = xo(U, "onBeforeInput"), 0 < Et.length && (ut = new wh("onBeforeInput", "beforeinput", null, a, P), J.push({
            event: ut,
            listeners: Et
          }), ut.data = xt)), XS(J, t, U, a, P);
        }
        hg(J, e);
      });
    }
    function Ps(t, e, a) {
      return {
        instance: t,
        listener: e,
        currentTarget: a
      };
    }
    function xo(t, e) {
      for (var a = e + "Capture", s = []; t !== null; ) {
        var c = t, u = c.stateNode;
        if (c = c.tag, c !== 5 && c !== 26 && c !== 27 || u === null || (c = us(t, a), c != null && s.unshift(Ps(t, c, u)), c = us(t, e), c != null && s.push(Ps(t, c, u))), t.tag === 3) return s;
        t = t.return;
      }
      return [];
    }
    function FS(t) {
      if (t === null) return null;
      do
        t = t.return;
      while (t && t.tag !== 5 && t.tag !== 27);
      return t || null;
    }
    function pg(t, e, a, s, c) {
      for (var u = e._reactName, y = []; a !== null && a !== s; ) {
        var x = a, M = x.alternate, U = x.stateNode;
        if (x = x.tag, M !== null && M === s) break;
        x !== 5 && x !== 26 && x !== 27 || U === null || (M = U, c ? (U = us(a, u), U != null && y.unshift(Ps(a, U, M))) : c || (U = us(a, u), U != null && y.push(Ps(a, U, M)))), a = a.return;
      }
      y.length !== 0 && t.push({
        event: e,
        listeners: y
      });
    }
    var JS = /\r\n?/g, $S = /\u0000|\uFFFD/g;
    function gg(t) {
      return (typeof t == "string" ? t : "" + t).replace(JS, `
`).replace($S, "");
    }
    function yg(t, e) {
      return e = gg(e), gg(t) === e;
    }
    function _t(t, e, a, s, c, u) {
      switch (a) {
        case "children":
          typeof s == "string" ? e === "body" || e === "textarea" && s === "" || la(t, s) : (typeof s == "number" || typeof s == "bigint") && e !== "body" && la(t, "" + s);
          break;
        case "className":
          wl(t, "class", s);
          break;
        case "tabIndex":
          wl(t, "tabindex", s);
          break;
        case "dir":
        case "role":
        case "viewBox":
        case "width":
        case "height":
          wl(t, a, s);
          break;
        case "style":
          yh(t, s, u);
          break;
        case "data":
          if (e !== "object") {
            wl(t, "data", s);
            break;
          }
        case "src":
        case "href":
          if (s === "" && (e !== "a" || a !== "href")) {
            t.removeAttribute(a);
            break;
          }
          if (s == null || typeof s == "function" || typeof s == "symbol" || typeof s == "boolean") {
            t.removeAttribute(a);
            break;
          }
          s = El("" + s), t.setAttribute(a, s);
          break;
        case "action":
        case "formAction":
          if (typeof s == "function") {
            t.setAttribute(a, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
            break;
          } else typeof u == "function" && (a === "formAction" ? (e !== "input" && _t(t, e, "name", c.name, c, null), _t(t, e, "formEncType", c.formEncType, c, null), _t(t, e, "formMethod", c.formMethod, c, null), _t(t, e, "formTarget", c.formTarget, c, null)) : (_t(t, e, "encType", c.encType, c, null), _t(t, e, "method", c.method, c, null), _t(t, e, "target", c.target, c, null)));
          if (s == null || typeof s == "symbol" || typeof s == "boolean") {
            t.removeAttribute(a);
            break;
          }
          s = El("" + s), t.setAttribute(a, s);
          break;
        case "onClick":
          s != null && (t.onclick = wn);
          break;
        case "onScroll":
          s != null && wt("scroll", t);
          break;
        case "onScrollEnd":
          s != null && wt("scrollend", t);
          break;
        case "dangerouslySetInnerHTML":
          if (s != null) {
            if (typeof s != "object" || !("__html" in s)) throw Error(o(61));
            if (a = s.__html, a != null) {
              if (c.children != null) throw Error(o(60));
              t.innerHTML = a;
            }
          }
          break;
        case "multiple":
          t.multiple = s && typeof s != "function" && typeof s != "symbol";
          break;
        case "muted":
          t.muted = s && typeof s != "function" && typeof s != "symbol";
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "defaultValue":
        case "defaultChecked":
        case "innerHTML":
        case "ref":
          break;
        case "autoFocus":
          break;
        case "xlinkHref":
          if (s == null || typeof s == "function" || typeof s == "boolean" || typeof s == "symbol") {
            t.removeAttribute("xlink:href");
            break;
          }
          a = El("" + s), t.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", a);
          break;
        case "contentEditable":
        case "spellCheck":
        case "draggable":
        case "value":
        case "autoReverse":
        case "externalResourcesRequired":
        case "focusable":
        case "preserveAlpha":
          s != null && typeof s != "function" && typeof s != "symbol" ? t.setAttribute(a, "" + s) : t.removeAttribute(a);
          break;
        case "inert":
        case "allowFullScreen":
        case "async":
        case "autoPlay":
        case "controls":
        case "default":
        case "defer":
        case "disabled":
        case "disablePictureInPicture":
        case "disableRemotePlayback":
        case "formNoValidate":
        case "hidden":
        case "loop":
        case "noModule":
        case "noValidate":
        case "open":
        case "playsInline":
        case "readOnly":
        case "required":
        case "reversed":
        case "scoped":
        case "seamless":
        case "itemScope":
          s && typeof s != "function" && typeof s != "symbol" ? t.setAttribute(a, "") : t.removeAttribute(a);
          break;
        case "capture":
        case "download":
          s === true ? t.setAttribute(a, "") : s !== false && s != null && typeof s != "function" && typeof s != "symbol" ? t.setAttribute(a, s) : t.removeAttribute(a);
          break;
        case "cols":
        case "rows":
        case "size":
        case "span":
          s != null && typeof s != "function" && typeof s != "symbol" && !isNaN(s) && 1 <= s ? t.setAttribute(a, s) : t.removeAttribute(a);
          break;
        case "rowSpan":
        case "start":
          s == null || typeof s == "function" || typeof s == "symbol" || isNaN(s) ? t.removeAttribute(a) : t.setAttribute(a, s);
          break;
        case "popover":
          wt("beforetoggle", t), wt("toggle", t), Tl(t, "popover", s);
          break;
        case "xlinkActuate":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:actuate", s);
          break;
        case "xlinkArcrole":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:arcrole", s);
          break;
        case "xlinkRole":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:role", s);
          break;
        case "xlinkShow":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:show", s);
          break;
        case "xlinkTitle":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:title", s);
          break;
        case "xlinkType":
          Tn(t, "http://www.w3.org/1999/xlink", "xlink:type", s);
          break;
        case "xmlBase":
          Tn(t, "http://www.w3.org/XML/1998/namespace", "xml:base", s);
          break;
        case "xmlLang":
          Tn(t, "http://www.w3.org/XML/1998/namespace", "xml:lang", s);
          break;
        case "xmlSpace":
          Tn(t, "http://www.w3.org/XML/1998/namespace", "xml:space", s);
          break;
        case "is":
          Tl(t, "is", s);
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          (!(2 < a.length) || a[0] !== "o" && a[0] !== "O" || a[1] !== "n" && a[1] !== "N") && (a = E1.get(a) || a, Tl(t, a, s));
      }
    }
    function Mu(t, e, a, s, c, u) {
      switch (a) {
        case "style":
          yh(t, s, u);
          break;
        case "dangerouslySetInnerHTML":
          if (s != null) {
            if (typeof s != "object" || !("__html" in s)) throw Error(o(61));
            if (a = s.__html, a != null) {
              if (c.children != null) throw Error(o(60));
              t.innerHTML = a;
            }
          }
          break;
        case "children":
          typeof s == "string" ? la(t, s) : (typeof s == "number" || typeof s == "bigint") && la(t, "" + s);
          break;
        case "onScroll":
          s != null && wt("scroll", t);
          break;
        case "onScrollEnd":
          s != null && wt("scrollend", t);
          break;
        case "onClick":
          s != null && (t.onclick = wn);
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "innerHTML":
        case "ref":
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          if (!rh.hasOwnProperty(a)) t: {
            if (a[0] === "o" && a[1] === "n" && (c = a.endsWith("Capture"), e = a.slice(2, c ? a.length - 7 : void 0), u = t[ye] || null, u = u != null ? u[a] : null, typeof u == "function" && t.removeEventListener(e, u, c), typeof s == "function")) {
              typeof u != "function" && u !== null && (a in t ? t[a] = null : t.hasAttribute(a) && t.removeAttribute(a)), t.addEventListener(e, s, c);
              break t;
            }
            a in t ? t[a] = s : s === true ? t.setAttribute(a, "") : Tl(t, a, s);
          }
      }
    }
    function re(t, e, a) {
      switch (e) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "img":
          wt("error", t), wt("load", t);
          var s = false, c = false, u;
          for (u in a) if (a.hasOwnProperty(u)) {
            var y = a[u];
            if (y != null) switch (u) {
              case "src":
                s = true;
                break;
              case "srcSet":
                c = true;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(o(137, e));
              default:
                _t(t, e, u, y, a, null);
            }
          }
          c && _t(t, e, "srcSet", a.srcSet, a, null), s && _t(t, e, "src", a.src, a, null);
          return;
        case "input":
          wt("invalid", t);
          var x = u = y = c = null, M = null, U = null;
          for (s in a) if (a.hasOwnProperty(s)) {
            var P = a[s];
            if (P != null) switch (s) {
              case "name":
                c = P;
                break;
              case "type":
                y = P;
                break;
              case "checked":
                M = P;
                break;
              case "defaultChecked":
                U = P;
                break;
              case "value":
                u = P;
                break;
              case "defaultValue":
                x = P;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (P != null) throw Error(o(137, e));
                break;
              default:
                _t(t, e, s, P, a, null);
            }
          }
          hh(t, u, x, M, U, y, c, false);
          return;
        case "select":
          wt("invalid", t), s = y = u = null;
          for (c in a) if (a.hasOwnProperty(c) && (x = a[c], x != null)) switch (c) {
            case "value":
              u = x;
              break;
            case "defaultValue":
              y = x;
              break;
            case "multiple":
              s = x;
            default:
              _t(t, e, c, x, a, null);
          }
          e = u, a = y, t.multiple = !!s, e != null ? sa(t, !!s, e, false) : a != null && sa(t, !!s, a, true);
          return;
        case "textarea":
          wt("invalid", t), u = c = s = null;
          for (y in a) if (a.hasOwnProperty(y) && (x = a[y], x != null)) switch (y) {
            case "value":
              s = x;
              break;
            case "defaultValue":
              c = x;
              break;
            case "children":
              u = x;
              break;
            case "dangerouslySetInnerHTML":
              if (x != null) throw Error(o(91));
              break;
            default:
              _t(t, e, y, x, a, null);
          }
          ph(t, s, c, u);
          return;
        case "option":
          for (M in a) if (a.hasOwnProperty(M) && (s = a[M], s != null)) switch (M) {
            case "selected":
              t.selected = s && typeof s != "function" && typeof s != "symbol";
              break;
            default:
              _t(t, e, M, s, a, null);
          }
          return;
        case "dialog":
          wt("beforetoggle", t), wt("toggle", t), wt("cancel", t), wt("close", t);
          break;
        case "iframe":
        case "object":
          wt("load", t);
          break;
        case "video":
        case "audio":
          for (s = 0; s < Ys.length; s++) wt(Ys[s], t);
          break;
        case "image":
          wt("error", t), wt("load", t);
          break;
        case "details":
          wt("toggle", t);
          break;
        case "embed":
        case "source":
        case "link":
          wt("error", t), wt("load", t);
        case "area":
        case "base":
        case "br":
        case "col":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "track":
        case "wbr":
        case "menuitem":
          for (U in a) if (a.hasOwnProperty(U) && (s = a[U], s != null)) switch (U) {
            case "children":
            case "dangerouslySetInnerHTML":
              throw Error(o(137, e));
            default:
              _t(t, e, U, s, a, null);
          }
          return;
        default:
          if (Gr(e)) {
            for (P in a) a.hasOwnProperty(P) && (s = a[P], s !== void 0 && Mu(t, e, P, s, a, void 0));
            return;
          }
      }
      for (x in a) a.hasOwnProperty(x) && (s = a[x], s != null && _t(t, e, x, s, a, null));
    }
    function WS(t, e, a, s) {
      switch (e) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "input":
          var c = null, u = null, y = null, x = null, M = null, U = null, P = null;
          for (Y in a) {
            var J = a[Y];
            if (a.hasOwnProperty(Y) && J != null) switch (Y) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                M = J;
              default:
                s.hasOwnProperty(Y) || _t(t, e, Y, null, s, J);
            }
          }
          for (var H in s) {
            var Y = s[H];
            if (J = a[H], s.hasOwnProperty(H) && (Y != null || J != null)) switch (H) {
              case "type":
                u = Y;
                break;
              case "name":
                c = Y;
                break;
              case "checked":
                U = Y;
                break;
              case "defaultChecked":
                P = Y;
                break;
              case "value":
                y = Y;
                break;
              case "defaultValue":
                x = Y;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (Y != null) throw Error(o(137, e));
                break;
              default:
                Y !== J && _t(t, e, H, Y, s, J);
            }
          }
          Ur(t, y, x, M, U, P, u, c);
          return;
        case "select":
          Y = y = x = H = null;
          for (u in a) if (M = a[u], a.hasOwnProperty(u) && M != null) switch (u) {
            case "value":
              break;
            case "multiple":
              Y = M;
            default:
              s.hasOwnProperty(u) || _t(t, e, u, null, s, M);
          }
          for (c in s) if (u = s[c], M = a[c], s.hasOwnProperty(c) && (u != null || M != null)) switch (c) {
            case "value":
              H = u;
              break;
            case "defaultValue":
              x = u;
              break;
            case "multiple":
              y = u;
            default:
              u !== M && _t(t, e, c, u, s, M);
          }
          e = x, a = y, s = Y, H != null ? sa(t, !!a, H, false) : !!s != !!a && (e != null ? sa(t, !!a, e, true) : sa(t, !!a, a ? [] : "", false));
          return;
        case "textarea":
          Y = H = null;
          for (x in a) if (c = a[x], a.hasOwnProperty(x) && c != null && !s.hasOwnProperty(x)) switch (x) {
            case "value":
              break;
            case "children":
              break;
            default:
              _t(t, e, x, null, s, c);
          }
          for (y in s) if (c = s[y], u = a[y], s.hasOwnProperty(y) && (c != null || u != null)) switch (y) {
            case "value":
              H = c;
              break;
            case "defaultValue":
              Y = c;
              break;
            case "children":
              break;
            case "dangerouslySetInnerHTML":
              if (c != null) throw Error(o(91));
              break;
            default:
              c !== u && _t(t, e, y, c, s, u);
          }
          mh(t, H, Y);
          return;
        case "option":
          for (var lt in a) if (H = a[lt], a.hasOwnProperty(lt) && H != null && !s.hasOwnProperty(lt)) switch (lt) {
            case "selected":
              t.selected = false;
              break;
            default:
              _t(t, e, lt, null, s, H);
          }
          for (M in s) if (H = s[M], Y = a[M], s.hasOwnProperty(M) && H !== Y && (H != null || Y != null)) switch (M) {
            case "selected":
              t.selected = H && typeof H != "function" && typeof H != "symbol";
              break;
            default:
              _t(t, e, M, H, s, Y);
          }
          return;
        case "img":
        case "link":
        case "area":
        case "base":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "source":
        case "track":
        case "wbr":
        case "menuitem":
          for (var pt in a) H = a[pt], a.hasOwnProperty(pt) && H != null && !s.hasOwnProperty(pt) && _t(t, e, pt, null, s, H);
          for (U in s) if (H = s[U], Y = a[U], s.hasOwnProperty(U) && H !== Y && (H != null || Y != null)) switch (U) {
            case "children":
            case "dangerouslySetInnerHTML":
              if (H != null) throw Error(o(137, e));
              break;
            default:
              _t(t, e, U, H, s, Y);
          }
          return;
        default:
          if (Gr(e)) {
            for (var Vt in a) H = a[Vt], a.hasOwnProperty(Vt) && H !== void 0 && !s.hasOwnProperty(Vt) && Mu(t, e, Vt, void 0, s, H);
            for (P in s) H = s[P], Y = a[P], !s.hasOwnProperty(P) || H === Y || H === void 0 && Y === void 0 || Mu(t, e, P, H, s, Y);
            return;
          }
      }
      for (var _ in a) H = a[_], a.hasOwnProperty(_) && H != null && !s.hasOwnProperty(_) && _t(t, e, _, null, s, H);
      for (J in s) H = s[J], Y = a[J], !s.hasOwnProperty(J) || H === Y || H == null && Y == null || _t(t, e, J, H, s, Y);
    }
    function vg(t) {
      switch (t) {
        case "css":
        case "script":
        case "font":
        case "img":
        case "image":
        case "input":
        case "link":
          return true;
        default:
          return false;
      }
    }
    function IS() {
      if (typeof performance.getEntriesByType == "function") {
        for (var t = 0, e = 0, a = performance.getEntriesByType("resource"), s = 0; s < a.length; s++) {
          var c = a[s], u = c.transferSize, y = c.initiatorType, x = c.duration;
          if (u && x && vg(y)) {
            for (y = 0, x = c.responseEnd, s += 1; s < a.length; s++) {
              var M = a[s], U = M.startTime;
              if (U > x) break;
              var P = M.transferSize, J = M.initiatorType;
              P && vg(J) && (M = M.responseEnd, y += P * (M < x ? 1 : (x - U) / (M - U)));
            }
            if (--s, e += 8 * (u + y) / (c.duration / 1e3), t++, 10 < t) break;
          }
        }
        if (0 < t) return e / t / 1e6;
      }
      return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
    }
    var Ru = null, Du = null;
    function So(t) {
      return t.nodeType === 9 ? t : t.ownerDocument;
    }
    function bg(t) {
      switch (t) {
        case "http://www.w3.org/2000/svg":
          return 1;
        case "http://www.w3.org/1998/Math/MathML":
          return 2;
        default:
          return 0;
      }
    }
    function xg(t, e) {
      if (t === 0) switch (e) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
      return t === 1 && e === "foreignObject" ? 0 : t;
    }
    function Ou(t, e) {
      return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
    }
    var ju = null;
    function tT() {
      var t = window.event;
      return t && t.type === "popstate" ? t === ju ? false : (ju = t, true) : (ju = null, false);
    }
    var Sg = typeof setTimeout == "function" ? setTimeout : void 0, eT = typeof clearTimeout == "function" ? clearTimeout : void 0, Tg = typeof Promise == "function" ? Promise : void 0, nT = typeof queueMicrotask == "function" ? queueMicrotask : typeof Tg < "u" ? function(t) {
      return Tg.resolve(null).then(t).catch(iT);
    } : Sg;
    function iT(t) {
      setTimeout(function() {
        throw t;
      });
    }
    function ci(t) {
      return t === "head";
    }
    function wg(t, e) {
      var a = e, s = 0;
      do {
        var c = a.nextSibling;
        if (t.removeChild(a), c && c.nodeType === 8) if (a = c.data, a === "/$" || a === "/&") {
          if (s === 0) {
            t.removeChild(c), La(e);
            return;
          }
          s--;
        } else if (a === "$" || a === "$?" || a === "$~" || a === "$!" || a === "&") s++;
        else if (a === "html") qs(t.ownerDocument.documentElement);
        else if (a === "head") {
          a = t.ownerDocument.head, qs(a);
          for (var u = a.firstChild; u; ) {
            var y = u.nextSibling, x = u.nodeName;
            u[rs] || x === "SCRIPT" || x === "STYLE" || x === "LINK" && u.rel.toLowerCase() === "stylesheet" || a.removeChild(u), u = y;
          }
        } else a === "body" && qs(t.ownerDocument.body);
        a = c;
      } while (a);
      La(e);
    }
    function Ag(t, e) {
      var a = t;
      t = 0;
      do {
        var s = a.nextSibling;
        if (a.nodeType === 1 ? e ? (a._stashedDisplay = a.style.display, a.style.display = "none") : (a.style.display = a._stashedDisplay || "", a.getAttribute("style") === "" && a.removeAttribute("style")) : a.nodeType === 3 && (e ? (a._stashedText = a.nodeValue, a.nodeValue = "") : a.nodeValue = a._stashedText || ""), s && s.nodeType === 8) if (a = s.data, a === "/$") {
          if (t === 0) break;
          t--;
        } else a !== "$" && a !== "$?" && a !== "$~" && a !== "$!" || t++;
        a = s;
      } while (a);
    }
    function Nu(t) {
      var e = t.firstChild;
      for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
        var a = e;
        switch (e = e.nextSibling, a.nodeName) {
          case "HTML":
          case "HEAD":
          case "BODY":
            Nu(a), Lr(a);
            continue;
          case "SCRIPT":
          case "STYLE":
            continue;
          case "LINK":
            if (a.rel.toLowerCase() === "stylesheet") continue;
        }
        t.removeChild(a);
      }
    }
    function aT(t, e, a, s) {
      for (; t.nodeType === 1; ) {
        var c = a;
        if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
          if (!s && (t.nodeName !== "INPUT" || t.type !== "hidden")) break;
        } else if (s) {
          if (!t[rs]) switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (u = t.getAttribute("rel"), u === "stylesheet" && t.hasAttribute("data-precedence")) break;
              if (u !== c.rel || t.getAttribute("href") !== (c.href == null || c.href === "" ? null : c.href) || t.getAttribute("crossorigin") !== (c.crossOrigin == null ? null : c.crossOrigin) || t.getAttribute("title") !== (c.title == null ? null : c.title)) break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (u = t.getAttribute("src"), (u !== (c.src == null ? null : c.src) || t.getAttribute("type") !== (c.type == null ? null : c.type) || t.getAttribute("crossorigin") !== (c.crossOrigin == null ? null : c.crossOrigin)) && u && t.hasAttribute("async") && !t.hasAttribute("itemprop")) break;
              return t;
            default:
              return t;
          }
        } else if (e === "input" && t.type === "hidden") {
          var u = c.name == null ? null : "" + c.name;
          if (c.type === "hidden" && t.getAttribute("name") === u) return t;
        } else return t;
        if (t = Ke(t.nextSibling), t === null) break;
      }
      return null;
    }
    function sT(t, e, a) {
      if (e === "") return null;
      for (; t.nodeType !== 3; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !a || (t = Ke(t.nextSibling), t === null)) return null;
      return t;
    }
    function Eg(t, e) {
      for (; t.nodeType !== 8; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = Ke(t.nextSibling), t === null)) return null;
      return t;
    }
    function zu(t) {
      return t.data === "$?" || t.data === "$~";
    }
    function _u(t) {
      return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
    }
    function lT(t, e) {
      var a = t.ownerDocument;
      if (t.data === "$~") t._reactRetry = e;
      else if (t.data !== "$?" || a.readyState !== "loading") e();
      else {
        var s = function() {
          e(), a.removeEventListener("DOMContentLoaded", s);
        };
        a.addEventListener("DOMContentLoaded", s), t._reactRetry = s;
      }
    }
    function Ke(t) {
      for (; t != null; t = t.nextSibling) {
        var e = t.nodeType;
        if (e === 1 || e === 3) break;
        if (e === 8) {
          if (e = t.data, e === "$" || e === "$!" || e === "$?" || e === "$~" || e === "&" || e === "F!" || e === "F") break;
          if (e === "/$" || e === "/&") return null;
        }
      }
      return t;
    }
    var Vu = null;
    function Cg(t) {
      t = t.nextSibling;
      for (var e = 0; t; ) {
        if (t.nodeType === 8) {
          var a = t.data;
          if (a === "/$" || a === "/&") {
            if (e === 0) return Ke(t.nextSibling);
            e--;
          } else a !== "$" && a !== "$!" && a !== "$?" && a !== "$~" && a !== "&" || e++;
        }
        t = t.nextSibling;
      }
      return null;
    }
    function Mg(t) {
      t = t.previousSibling;
      for (var e = 0; t; ) {
        if (t.nodeType === 8) {
          var a = t.data;
          if (a === "$" || a === "$!" || a === "$?" || a === "$~" || a === "&") {
            if (e === 0) return t;
            e--;
          } else a !== "/$" && a !== "/&" || e++;
        }
        t = t.previousSibling;
      }
      return null;
    }
    function Rg(t, e, a) {
      switch (e = So(a), t) {
        case "html":
          if (t = e.documentElement, !t) throw Error(o(452));
          return t;
        case "head":
          if (t = e.head, !t) throw Error(o(453));
          return t;
        case "body":
          if (t = e.body, !t) throw Error(o(454));
          return t;
        default:
          throw Error(o(451));
      }
    }
    function qs(t) {
      for (var e = t.attributes; e.length; ) t.removeAttributeNode(e[0]);
      Lr(t);
    }
    var Ze = /* @__PURE__ */ new Map(), Dg = /* @__PURE__ */ new Set();
    function To(t) {
      return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
    }
    var Un = F.d;
    F.d = {
      f: oT,
      r: rT,
      D: cT,
      C: uT,
      L: fT,
      m: dT,
      X: mT,
      S: hT,
      M: pT
    };
    function oT() {
      var t = Un.f(), e = ho();
      return t || e;
    }
    function rT(t) {
      var e = na(t);
      e !== null && e.tag === 5 && e.type === "form" ? Km(e) : Un.r(t);
    }
    var _a = typeof document > "u" ? null : document;
    function Og(t, e, a) {
      var s = _a;
      if (s && typeof e == "string" && e) {
        var c = Ue(e);
        c = 'link[rel="' + t + '"][href="' + c + '"]', typeof a == "string" && (c += '[crossorigin="' + a + '"]'), Dg.has(c) || (Dg.add(c), t = {
          rel: t,
          crossOrigin: a,
          href: e
        }, s.querySelector(c) === null && (e = s.createElement("link"), re(e, "link", t), ne(e), s.head.appendChild(e)));
      }
    }
    function cT(t) {
      Un.D(t), Og("dns-prefetch", t, null);
    }
    function uT(t, e) {
      Un.C(t, e), Og("preconnect", t, e);
    }
    function fT(t, e, a) {
      Un.L(t, e, a);
      var s = _a;
      if (s && t && e) {
        var c = 'link[rel="preload"][as="' + Ue(e) + '"]';
        e === "image" && a && a.imageSrcSet ? (c += '[imagesrcset="' + Ue(a.imageSrcSet) + '"]', typeof a.imageSizes == "string" && (c += '[imagesizes="' + Ue(a.imageSizes) + '"]')) : c += '[href="' + Ue(t) + '"]';
        var u = c;
        switch (e) {
          case "style":
            u = Va(t);
            break;
          case "script":
            u = ka(t);
        }
        Ze.has(u) || (t = v({
          rel: "preload",
          href: e === "image" && a && a.imageSrcSet ? void 0 : t,
          as: e
        }, a), Ze.set(u, t), s.querySelector(c) !== null || e === "style" && s.querySelector(Xs(u)) || e === "script" && s.querySelector(Ks(u)) || (e = s.createElement("link"), re(e, "link", t), ne(e), s.head.appendChild(e)));
      }
    }
    function dT(t, e) {
      Un.m(t, e);
      var a = _a;
      if (a && t) {
        var s = e && typeof e.as == "string" ? e.as : "script", c = 'link[rel="modulepreload"][as="' + Ue(s) + '"][href="' + Ue(t) + '"]', u = c;
        switch (s) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            u = ka(t);
        }
        if (!Ze.has(u) && (t = v({
          rel: "modulepreload",
          href: t
        }, e), Ze.set(u, t), a.querySelector(c) === null)) {
          switch (s) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              if (a.querySelector(Ks(u))) return;
          }
          s = a.createElement("link"), re(s, "link", t), ne(s), a.head.appendChild(s);
        }
      }
    }
    function hT(t, e, a) {
      Un.S(t, e, a);
      var s = _a;
      if (s && t) {
        var c = ia(s).hoistableStyles, u = Va(t);
        e = e || "default";
        var y = c.get(u);
        if (!y) {
          var x = {
            loading: 0,
            preload: null
          };
          if (y = s.querySelector(Xs(u))) x.loading = 5;
          else {
            t = v({
              rel: "stylesheet",
              href: t,
              "data-precedence": e
            }, a), (a = Ze.get(u)) && ku(t, a);
            var M = y = s.createElement("link");
            ne(M), re(M, "link", t), M._p = new Promise(function(U, P) {
              M.onload = U, M.onerror = P;
            }), M.addEventListener("load", function() {
              x.loading |= 1;
            }), M.addEventListener("error", function() {
              x.loading |= 2;
            }), x.loading |= 4, wo(y, e, s);
          }
          y = {
            type: "stylesheet",
            instance: y,
            count: 1,
            state: x
          }, c.set(u, y);
        }
      }
    }
    function mT(t, e) {
      Un.X(t, e);
      var a = _a;
      if (a && t) {
        var s = ia(a).hoistableScripts, c = ka(t), u = s.get(c);
        u || (u = a.querySelector(Ks(c)), u || (t = v({
          src: t,
          async: true
        }, e), (e = Ze.get(c)) && Lu(t, e), u = a.createElement("script"), ne(u), re(u, "link", t), a.head.appendChild(u)), u = {
          type: "script",
          instance: u,
          count: 1,
          state: null
        }, s.set(c, u));
      }
    }
    function pT(t, e) {
      Un.M(t, e);
      var a = _a;
      if (a && t) {
        var s = ia(a).hoistableScripts, c = ka(t), u = s.get(c);
        u || (u = a.querySelector(Ks(c)), u || (t = v({
          src: t,
          async: true,
          type: "module"
        }, e), (e = Ze.get(c)) && Lu(t, e), u = a.createElement("script"), ne(u), re(u, "link", t), a.head.appendChild(u)), u = {
          type: "script",
          instance: u,
          count: 1,
          state: null
        }, s.set(c, u));
      }
    }
    function jg(t, e, a, s) {
      var c = (c = at.current) ? To(c) : null;
      if (!c) throw Error(o(446));
      switch (t) {
        case "meta":
        case "title":
          return null;
        case "style":
          return typeof a.precedence == "string" && typeof a.href == "string" ? (e = Va(a.href), a = ia(c).hoistableStyles, s = a.get(e), s || (s = {
            type: "style",
            instance: null,
            count: 0,
            state: null
          }, a.set(e, s)), s) : {
            type: "void",
            instance: null,
            count: 0,
            state: null
          };
        case "link":
          if (a.rel === "stylesheet" && typeof a.href == "string" && typeof a.precedence == "string") {
            t = Va(a.href);
            var u = ia(c).hoistableStyles, y = u.get(t);
            if (y || (c = c.ownerDocument || c, y = {
              type: "stylesheet",
              instance: null,
              count: 0,
              state: {
                loading: 0,
                preload: null
              }
            }, u.set(t, y), (u = c.querySelector(Xs(t))) && !u._p && (y.instance = u, y.state.loading = 5), Ze.has(t) || (a = {
              rel: "preload",
              as: "style",
              href: a.href,
              crossOrigin: a.crossOrigin,
              integrity: a.integrity,
              media: a.media,
              hrefLang: a.hrefLang,
              referrerPolicy: a.referrerPolicy
            }, Ze.set(t, a), u || gT(c, t, a, y.state))), e && s === null) throw Error(o(528, ""));
            return y;
          }
          if (e && s !== null) throw Error(o(529, ""));
          return null;
        case "script":
          return e = a.async, a = a.src, typeof a == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = ka(a), a = ia(c).hoistableScripts, s = a.get(e), s || (s = {
            type: "script",
            instance: null,
            count: 0,
            state: null
          }, a.set(e, s)), s) : {
            type: "void",
            instance: null,
            count: 0,
            state: null
          };
        default:
          throw Error(o(444, t));
      }
    }
    function Va(t) {
      return 'href="' + Ue(t) + '"';
    }
    function Xs(t) {
      return 'link[rel="stylesheet"][' + t + "]";
    }
    function Ng(t) {
      return v({}, t, {
        "data-precedence": t.precedence,
        precedence: null
      });
    }
    function gT(t, e, a, s) {
      t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? s.loading = 1 : (e = t.createElement("link"), s.preload = e, e.addEventListener("load", function() {
        return s.loading |= 1;
      }), e.addEventListener("error", function() {
        return s.loading |= 2;
      }), re(e, "link", a), ne(e), t.head.appendChild(e));
    }
    function ka(t) {
      return '[src="' + Ue(t) + '"]';
    }
    function Ks(t) {
      return "script[async]" + t;
    }
    function zg(t, e, a) {
      if (e.count++, e.instance === null) switch (e.type) {
        case "style":
          var s = t.querySelector('style[data-href~="' + Ue(a.href) + '"]');
          if (s) return e.instance = s, ne(s), s;
          var c = v({}, a, {
            "data-href": a.href,
            "data-precedence": a.precedence,
            href: null,
            precedence: null
          });
          return s = (t.ownerDocument || t).createElement("style"), ne(s), re(s, "style", c), wo(s, a.precedence, t), e.instance = s;
        case "stylesheet":
          c = Va(a.href);
          var u = t.querySelector(Xs(c));
          if (u) return e.state.loading |= 4, e.instance = u, ne(u), u;
          s = Ng(a), (c = Ze.get(c)) && ku(s, c), u = (t.ownerDocument || t).createElement("link"), ne(u);
          var y = u;
          return y._p = new Promise(function(x, M) {
            y.onload = x, y.onerror = M;
          }), re(u, "link", s), e.state.loading |= 4, wo(u, a.precedence, t), e.instance = u;
        case "script":
          return u = ka(a.src), (c = t.querySelector(Ks(u))) ? (e.instance = c, ne(c), c) : (s = a, (c = Ze.get(u)) && (s = v({}, a), Lu(s, c)), t = t.ownerDocument || t, c = t.createElement("script"), ne(c), re(c, "link", s), t.head.appendChild(c), e.instance = c);
        case "void":
          return null;
        default:
          throw Error(o(443, e.type));
      }
      else e.type === "stylesheet" && (e.state.loading & 4) === 0 && (s = e.instance, e.state.loading |= 4, wo(s, a.precedence, t));
      return e.instance;
    }
    function wo(t, e, a) {
      for (var s = a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'), c = s.length ? s[s.length - 1] : null, u = c, y = 0; y < s.length; y++) {
        var x = s[y];
        if (x.dataset.precedence === e) u = x;
        else if (u !== c) break;
      }
      u ? u.parentNode.insertBefore(t, u.nextSibling) : (e = a.nodeType === 9 ? a.head : a, e.insertBefore(t, e.firstChild));
    }
    function ku(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
    }
    function Lu(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
    }
    var Ao = null;
    function _g(t, e, a) {
      if (Ao === null) {
        var s = /* @__PURE__ */ new Map(), c = Ao = /* @__PURE__ */ new Map();
        c.set(a, s);
      } else c = Ao, s = c.get(a), s || (s = /* @__PURE__ */ new Map(), c.set(a, s));
      if (s.has(t)) return s;
      for (s.set(t, null), a = a.getElementsByTagName(t), c = 0; c < a.length; c++) {
        var u = a[c];
        if (!(u[rs] || u[ae] || t === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
          var y = u.getAttribute(e) || "";
          y = t + y;
          var x = s.get(y);
          x ? x.push(u) : s.set(y, [
            u
          ]);
        }
      }
      return s;
    }
    function Vg(t, e, a) {
      t = t.ownerDocument || t, t.head.insertBefore(a, e === "title" ? t.querySelector("head > title") : null);
    }
    function yT(t, e, a) {
      if (a === 1 || e.itemProp != null) return false;
      switch (t) {
        case "meta":
        case "title":
          return true;
        case "style":
          if (typeof e.precedence != "string" || typeof e.href != "string" || e.href === "") break;
          return true;
        case "link":
          if (typeof e.rel != "string" || typeof e.href != "string" || e.href === "" || e.onLoad || e.onError) break;
          switch (e.rel) {
            case "stylesheet":
              return t = e.disabled, typeof e.precedence == "string" && t == null;
            default:
              return true;
          }
        case "script":
          if (e.async && typeof e.async != "function" && typeof e.async != "symbol" && !e.onLoad && !e.onError && e.src && typeof e.src == "string") return true;
      }
      return false;
    }
    function kg(t) {
      return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
    }
    function vT(t, e, a, s) {
      if (a.type === "stylesheet" && (typeof s.media != "string" || matchMedia(s.media).matches !== false) && (a.state.loading & 4) === 0) {
        if (a.instance === null) {
          var c = Va(s.href), u = e.querySelector(Xs(c));
          if (u) {
            e = u._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = Eo.bind(t), e.then(t, t)), a.state.loading |= 4, a.instance = u, ne(u);
            return;
          }
          u = e.ownerDocument || e, s = Ng(s), (c = Ze.get(c)) && ku(s, c), u = u.createElement("link"), ne(u);
          var y = u;
          y._p = new Promise(function(x, M) {
            y.onload = x, y.onerror = M;
          }), re(u, "link", s), a.instance = u;
        }
        t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(a, e), (e = a.state.preload) && (a.state.loading & 3) === 0 && (t.count++, a = Eo.bind(t), e.addEventListener("load", a), e.addEventListener("error", a));
      }
    }
    var Bu = 0;
    function bT(t, e) {
      return t.stylesheets && t.count === 0 && Mo(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(a) {
        var s = setTimeout(function() {
          if (t.stylesheets && Mo(t, t.stylesheets), t.unsuspend) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        }, 6e4 + e);
        0 < t.imgBytes && Bu === 0 && (Bu = 62500 * IS());
        var c = setTimeout(function() {
          if (t.waitingForImages = false, t.count === 0 && (t.stylesheets && Mo(t, t.stylesheets), t.unsuspend)) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        }, (t.imgBytes > Bu ? 50 : 800) + e);
        return t.unsuspend = a, function() {
          t.unsuspend = null, clearTimeout(s), clearTimeout(c);
        };
      } : null;
    }
    function Eo() {
      if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
        if (this.stylesheets) Mo(this, this.stylesheets);
        else if (this.unsuspend) {
          var t = this.unsuspend;
          this.unsuspend = null, t();
        }
      }
    }
    var Co = null;
    function Mo(t, e) {
      t.stylesheets = null, t.unsuspend !== null && (t.count++, Co = /* @__PURE__ */ new Map(), e.forEach(xT, t), Co = null, Eo.call(t));
    }
    function xT(t, e) {
      if (!(e.state.loading & 4)) {
        var a = Co.get(t);
        if (a) var s = a.get(null);
        else {
          a = /* @__PURE__ */ new Map(), Co.set(t, a);
          for (var c = t.querySelectorAll("link[data-precedence],style[data-precedence]"), u = 0; u < c.length; u++) {
            var y = c[u];
            (y.nodeName === "LINK" || y.getAttribute("media") !== "not all") && (a.set(y.dataset.precedence, y), s = y);
          }
          s && a.set(null, s);
        }
        c = e.instance, y = c.getAttribute("data-precedence"), u = a.get(y) || s, u === s && a.set(null, c), a.set(y, c), this.count++, s = Eo.bind(this), c.addEventListener("load", s), c.addEventListener("error", s), u ? u.parentNode.insertBefore(c, u.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(c, t.firstChild)), e.state.loading |= 4;
      }
    }
    var Zs = {
      $$typeof: z,
      Provider: null,
      Consumer: null,
      _currentValue: Z,
      _currentValue2: Z,
      _threadCount: 0
    };
    function ST(t, e, a, s, c, u, y, x, M) {
      this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = zr(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = zr(0), this.hiddenUpdates = zr(null), this.identifierPrefix = s, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = y, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = M, this.incompleteTransitions = /* @__PURE__ */ new Map();
    }
    function Lg(t, e, a, s, c, u, y, x, M, U, P, J) {
      return t = new ST(t, e, a, y, M, U, P, J, x), e = 1, u === true && (e |= 24), u = Re(3, null, null, e), t.current = u, u.stateNode = t, e = yc(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
        element: s,
        isDehydrated: a,
        cache: e
      }, Sc(u), t;
    }
    function Bg(t) {
      return t ? (t = ha, t) : ha;
    }
    function Ug(t, e, a, s, c, u) {
      c = Bg(c), s.context === null ? s.context = c : s.pendingContext = c, s = Wn(e), s.payload = {
        element: a
      }, u = u === void 0 ? null : u, u !== null && (s.callback = u), a = In(t, s, e), a !== null && (we(a, t, e), Es(a, t, e));
    }
    function Hg(t, e) {
      if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
        var a = t.retryLane;
        t.retryLane = a !== 0 && a < e ? a : e;
      }
    }
    function Uu(t, e) {
      Hg(t, e), (t = t.alternate) && Hg(t, e);
    }
    function Gg(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = Oi(t, 67108864);
        e !== null && we(e, t, 67108864), Uu(t, 67108864);
      }
    }
    function Yg(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = ze();
        e = _r(e);
        var a = Oi(t, e);
        a !== null && we(a, t, e), Uu(t, e);
      }
    }
    var Ro = true;
    function TT(t, e, a, s) {
      var c = k.T;
      k.T = null;
      var u = F.p;
      try {
        F.p = 2, Hu(t, e, a, s);
      } finally {
        F.p = u, k.T = c;
      }
    }
    function wT(t, e, a, s) {
      var c = k.T;
      k.T = null;
      var u = F.p;
      try {
        F.p = 8, Hu(t, e, a, s);
      } finally {
        F.p = u, k.T = c;
      }
    }
    function Hu(t, e, a, s) {
      if (Ro) {
        var c = Gu(s);
        if (c === null) Cu(t, e, s, Do, a), qg(t, s);
        else if (ET(c, t, e, a, s)) s.stopPropagation();
        else if (qg(t, s), e & 4 && -1 < AT.indexOf(t)) {
          for (; c !== null; ) {
            var u = na(c);
            if (u !== null) switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var y = Ei(u.pendingLanes);
                  if (y !== 0) {
                    var x = u;
                    for (x.pendingLanes |= 2, x.entangledLanes |= 2; y; ) {
                      var M = 1 << 31 - Ce(y);
                      x.entanglements[1] |= M, y &= ~M;
                    }
                    mn(u), (Dt & 6) === 0 && (uo = Ae() + 500, Gs(0));
                  }
                }
                break;
              case 31:
              case 13:
                x = Oi(u, 2), x !== null && we(x, u, 2), ho(), Uu(u, 2);
            }
            if (u = Gu(s), u === null && Cu(t, e, s, Do, a), u === c) break;
            c = u;
          }
          c !== null && s.stopPropagation();
        } else Cu(t, e, s, null, a);
      }
    }
    function Gu(t) {
      return t = Pr(t), Yu(t);
    }
    var Do = null;
    function Yu(t) {
      if (Do = null, t = ea(t), t !== null) {
        var e = d(t);
        if (e === null) t = null;
        else {
          var a = e.tag;
          if (a === 13) {
            if (t = f(e), t !== null) return t;
            t = null;
          } else if (a === 31) {
            if (t = h(e), t !== null) return t;
            t = null;
          } else if (a === 3) {
            if (e.stateNode.current.memoizedState.isDehydrated) return e.tag === 3 ? e.stateNode.containerInfo : null;
            t = null;
          } else e !== t && (t = null);
        }
      }
      return Do = t, null;
    }
    function Pg(t) {
      switch (t) {
        case "beforetoggle":
        case "cancel":
        case "click":
        case "close":
        case "contextmenu":
        case "copy":
        case "cut":
        case "auxclick":
        case "dblclick":
        case "dragend":
        case "dragstart":
        case "drop":
        case "focusin":
        case "focusout":
        case "input":
        case "invalid":
        case "keydown":
        case "keypress":
        case "keyup":
        case "mousedown":
        case "mouseup":
        case "paste":
        case "pause":
        case "play":
        case "pointercancel":
        case "pointerdown":
        case "pointerup":
        case "ratechange":
        case "reset":
        case "resize":
        case "seeked":
        case "submit":
        case "toggle":
        case "touchcancel":
        case "touchend":
        case "touchstart":
        case "volumechange":
        case "change":
        case "selectionchange":
        case "textInput":
        case "compositionstart":
        case "compositionend":
        case "compositionupdate":
        case "beforeblur":
        case "afterblur":
        case "beforeinput":
        case "blur":
        case "fullscreenchange":
        case "focus":
        case "hashchange":
        case "popstate":
        case "select":
        case "selectstart":
          return 2;
        case "drag":
        case "dragenter":
        case "dragexit":
        case "dragleave":
        case "dragover":
        case "mousemove":
        case "mouseout":
        case "mouseover":
        case "pointermove":
        case "pointerout":
        case "pointerover":
        case "scroll":
        case "touchmove":
        case "wheel":
        case "mouseenter":
        case "mouseleave":
        case "pointerenter":
        case "pointerleave":
          return 8;
        case "message":
          switch (c1()) {
            case $d:
              return 2;
            case Wd:
              return 8;
            case yl:
            case u1:
              return 32;
            case Id:
              return 268435456;
            default:
              return 32;
          }
        default:
          return 32;
      }
    }
    var Pu = false, ui = null, fi = null, di = null, Qs = /* @__PURE__ */ new Map(), Fs = /* @__PURE__ */ new Map(), hi = [], AT = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
    function qg(t, e) {
      switch (t) {
        case "focusin":
        case "focusout":
          ui = null;
          break;
        case "dragenter":
        case "dragleave":
          fi = null;
          break;
        case "mouseover":
        case "mouseout":
          di = null;
          break;
        case "pointerover":
        case "pointerout":
          Qs.delete(e.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          Fs.delete(e.pointerId);
      }
    }
    function Js(t, e, a, s, c, u) {
      return t === null || t.nativeEvent !== u ? (t = {
        blockedOn: e,
        domEventName: a,
        eventSystemFlags: s,
        nativeEvent: u,
        targetContainers: [
          c
        ]
      }, e !== null && (e = na(e), e !== null && Gg(e)), t) : (t.eventSystemFlags |= s, e = t.targetContainers, c !== null && e.indexOf(c) === -1 && e.push(c), t);
    }
    function ET(t, e, a, s, c) {
      switch (e) {
        case "focusin":
          return ui = Js(ui, t, e, a, s, c), true;
        case "dragenter":
          return fi = Js(fi, t, e, a, s, c), true;
        case "mouseover":
          return di = Js(di, t, e, a, s, c), true;
        case "pointerover":
          var u = c.pointerId;
          return Qs.set(u, Js(Qs.get(u) || null, t, e, a, s, c)), true;
        case "gotpointercapture":
          return u = c.pointerId, Fs.set(u, Js(Fs.get(u) || null, t, e, a, s, c)), true;
      }
      return false;
    }
    function Xg(t) {
      var e = ea(t.target);
      if (e !== null) {
        var a = d(e);
        if (a !== null) {
          if (e = a.tag, e === 13) {
            if (e = f(a), e !== null) {
              t.blockedOn = e, sh(t.priority, function() {
                Yg(a);
              });
              return;
            }
          } else if (e === 31) {
            if (e = h(a), e !== null) {
              t.blockedOn = e, sh(t.priority, function() {
                Yg(a);
              });
              return;
            }
          } else if (e === 3 && a.stateNode.current.memoizedState.isDehydrated) {
            t.blockedOn = a.tag === 3 ? a.stateNode.containerInfo : null;
            return;
          }
        }
      }
      t.blockedOn = null;
    }
    function Oo(t) {
      if (t.blockedOn !== null) return false;
      for (var e = t.targetContainers; 0 < e.length; ) {
        var a = Gu(t.nativeEvent);
        if (a === null) {
          a = t.nativeEvent;
          var s = new a.constructor(a.type, a);
          Yr = s, a.target.dispatchEvent(s), Yr = null;
        } else return e = na(a), e !== null && Gg(e), t.blockedOn = a, false;
        e.shift();
      }
      return true;
    }
    function Kg(t, e, a) {
      Oo(t) && a.delete(e);
    }
    function CT() {
      Pu = false, ui !== null && Oo(ui) && (ui = null), fi !== null && Oo(fi) && (fi = null), di !== null && Oo(di) && (di = null), Qs.forEach(Kg), Fs.forEach(Kg);
    }
    function jo(t, e) {
      t.blockedOn === e && (t.blockedOn = null, Pu || (Pu = true, n.unstable_scheduleCallback(n.unstable_NormalPriority, CT)));
    }
    var No = null;
    function Zg(t) {
      No !== t && (No = t, n.unstable_scheduleCallback(n.unstable_NormalPriority, function() {
        No === t && (No = null);
        for (var e = 0; e < t.length; e += 3) {
          var a = t[e], s = t[e + 1], c = t[e + 2];
          if (typeof s != "function") {
            if (Yu(s || a) === null) continue;
            break;
          }
          var u = na(a);
          u !== null && (t.splice(e, 3), e -= 3, Gc(u, {
            pending: true,
            data: c,
            method: a.method,
            action: s
          }, s, c));
        }
      }));
    }
    function La(t) {
      function e(M) {
        return jo(M, t);
      }
      ui !== null && jo(ui, t), fi !== null && jo(fi, t), di !== null && jo(di, t), Qs.forEach(e), Fs.forEach(e);
      for (var a = 0; a < hi.length; a++) {
        var s = hi[a];
        s.blockedOn === t && (s.blockedOn = null);
      }
      for (; 0 < hi.length && (a = hi[0], a.blockedOn === null); ) Xg(a), a.blockedOn === null && hi.shift();
      if (a = (t.ownerDocument || t).$$reactFormReplay, a != null) for (s = 0; s < a.length; s += 3) {
        var c = a[s], u = a[s + 1], y = c[ye] || null;
        if (typeof u == "function") y || Zg(a);
        else if (y) {
          var x = null;
          if (u && u.hasAttribute("formAction")) {
            if (c = u, y = u[ye] || null) x = y.formAction;
            else if (Yu(c) !== null) continue;
          } else x = y.action;
          typeof x == "function" ? a[s + 1] = x : (a.splice(s, 3), s -= 3), Zg(a);
        }
      }
    }
    function Qg() {
      function t(u) {
        u.canIntercept && u.info === "react-transition" && u.intercept({
          handler: function() {
            return new Promise(function(y) {
              return c = y;
            });
          },
          focusReset: "manual",
          scroll: "manual"
        });
      }
      function e() {
        c !== null && (c(), c = null), s || setTimeout(a, 20);
      }
      function a() {
        if (!s && !navigation.transition) {
          var u = navigation.currentEntry;
          u && u.url != null && navigation.navigate(u.url, {
            state: u.getState(),
            info: "react-transition",
            history: "replace"
          });
        }
      }
      if (typeof navigation == "object") {
        var s = false, c = null;
        return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(a, 100), function() {
          s = true, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), c !== null && (c(), c = null);
        };
      }
    }
    function qu(t) {
      this._internalRoot = t;
    }
    zo.prototype.render = qu.prototype.render = function(t) {
      var e = this._internalRoot;
      if (e === null) throw Error(o(409));
      var a = e.current, s = ze();
      Ug(a, s, t, e, null, null);
    }, zo.prototype.unmount = qu.prototype.unmount = function() {
      var t = this._internalRoot;
      if (t !== null) {
        this._internalRoot = null;
        var e = t.containerInfo;
        Ug(t.current, 2, null, t, null, null), ho(), e[ta] = null;
      }
    };
    function zo(t) {
      this._internalRoot = t;
    }
    zo.prototype.unstable_scheduleHydration = function(t) {
      if (t) {
        var e = ah();
        t = {
          blockedOn: null,
          target: t,
          priority: e
        };
        for (var a = 0; a < hi.length && e !== 0 && e < hi[a].priority; a++) ;
        hi.splice(a, 0, t), a === 0 && Xg(t);
      }
    };
    var Fg = i.version;
    if (Fg !== "19.2.4") throw Error(o(527, Fg, "19.2.4"));
    F.findDOMNode = function(t) {
      var e = t._reactInternals;
      if (e === void 0) throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
      return t = p(e), t = t !== null ? g(t) : null, t = t === null ? null : t.stateNode, t;
    };
    var MT = {
      bundleType: 0,
      version: "19.2.4",
      rendererPackageName: "react-dom",
      currentDispatcherRef: k,
      reconcilerVersion: "19.2.4"
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
      var _o = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!_o.isDisabled && _o.supportsFiber) try {
        ss = _o.inject(MT), Ee = _o;
      } catch {
      }
    }
    return Ws.createRoot = function(t, e) {
      if (!r(t)) throw Error(o(299));
      var a = false, s = "", c = np, u = ip, y = ap;
      return e != null && (e.unstable_strictMode === true && (a = true), e.identifierPrefix !== void 0 && (s = e.identifierPrefix), e.onUncaughtError !== void 0 && (c = e.onUncaughtError), e.onCaughtError !== void 0 && (u = e.onCaughtError), e.onRecoverableError !== void 0 && (y = e.onRecoverableError)), e = Lg(t, 1, false, null, null, a, s, null, c, u, y, Qg), t[ta] = e.current, Eu(t), new qu(e);
    }, Ws.hydrateRoot = function(t, e, a) {
      if (!r(t)) throw Error(o(299));
      var s = false, c = "", u = np, y = ip, x = ap, M = null;
      return a != null && (a.unstable_strictMode === true && (s = true), a.identifierPrefix !== void 0 && (c = a.identifierPrefix), a.onUncaughtError !== void 0 && (u = a.onUncaughtError), a.onCaughtError !== void 0 && (y = a.onCaughtError), a.onRecoverableError !== void 0 && (x = a.onRecoverableError), a.formState !== void 0 && (M = a.formState)), e = Lg(t, 1, true, e, a ?? null, s, c, M, u, y, x, Qg), e.context = Bg(null), a = e.current, s = ze(), s = _r(s), c = Wn(s), c.callback = null, In(a, c, s), a = s, e.current.lanes = a, os(e, a), mn(e), t[ta] = e.current, Eu(t), new zo(e);
    }, Ws.version = "19.2.4", Ws;
  }
  var sy;
  function LT() {
    if (sy) return Zu.exports;
    sy = 1;
    function n() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (i) {
        console.error(i);
      }
    }
    return n(), Zu.exports = kT(), Zu.exports;
  }
  var BT = LT();
  const UT = Q0(BT);
  function he(n, i, { checkForDefaultPrevented: l = true } = {}) {
    return function(r) {
      if (n == null ? void 0 : n(r), l === false || !r.defaultPrevented) return i == null ? void 0 : i(r);
    };
  }
  function ly(n, i) {
    if (typeof n == "function") return n(i);
    n != null && (n.current = i);
  }
  function ad(...n) {
    return (i) => {
      let l = false;
      const o = n.map((r) => {
        const d = ly(r, i);
        return !l && typeof d == "function" && (l = true), d;
      });
      if (l) return () => {
        for (let r = 0; r < o.length; r++) {
          const d = o[r];
          typeof d == "function" ? d() : ly(n[r], null);
        }
      };
    };
  }
  function ge(...n) {
    return w.useCallback(ad(...n), n);
  }
  function hr(n, i = []) {
    let l = [];
    function o(d, f) {
      const h = w.createContext(f), m = l.length;
      l = [
        ...l,
        f
      ];
      const p = (v) => {
        var _a;
        const { scope: b, children: T, ...A } = v, C = ((_a = b == null ? void 0 : b[n]) == null ? void 0 : _a[m]) || h, R = w.useMemo(() => A, Object.values(A));
        return S.jsx(C.Provider, {
          value: R,
          children: T
        });
      };
      p.displayName = d + "Provider";
      function g(v, b) {
        var _a;
        const T = ((_a = b == null ? void 0 : b[n]) == null ? void 0 : _a[m]) || h, A = w.useContext(T);
        if (A) return A;
        if (f !== void 0) return f;
        throw new Error(`\`${v}\` must be used within \`${d}\``);
      }
      return [
        p,
        g
      ];
    }
    const r = () => {
      const d = l.map((f) => w.createContext(f));
      return function(h) {
        const m = (h == null ? void 0 : h[n]) || d;
        return w.useMemo(() => ({
          [`__scope${n}`]: {
            ...h,
            [n]: m
          }
        }), [
          h,
          m
        ]);
      };
    };
    return r.scopeName = n, [
      o,
      HT(r, ...i)
    ];
  }
  function HT(...n) {
    const i = n[0];
    if (n.length === 1) return i;
    const l = () => {
      const o = n.map((r) => ({
        useScope: r(),
        scopeName: r.scopeName
      }));
      return function(d) {
        const f = o.reduce((h, { useScope: m, scopeName: p }) => {
          const v = m(d)[`__scope${p}`];
          return {
            ...h,
            ...v
          };
        }, {});
        return w.useMemo(() => ({
          [`__scope${i.scopeName}`]: f
        }), [
          f
        ]);
      };
    };
    return l.scopeName = i.scopeName, l;
  }
  var J0 = F0();
  function xf(n) {
    const i = GT(n), l = w.forwardRef((o, r) => {
      const { children: d, ...f } = o, h = w.Children.toArray(d), m = h.find(PT);
      if (m) {
        const p = m.props.children, g = h.map((v) => v === m ? w.Children.count(p) > 1 ? w.Children.only(null) : w.isValidElement(p) ? p.props.children : null : v);
        return S.jsx(i, {
          ...f,
          ref: r,
          children: w.isValidElement(p) ? w.cloneElement(p, void 0, g) : null
        });
      }
      return S.jsx(i, {
        ...f,
        ref: r,
        children: d
      });
    });
    return l.displayName = `${n}.Slot`, l;
  }
  function GT(n) {
    const i = w.forwardRef((l, o) => {
      const { children: r, ...d } = l;
      if (w.isValidElement(r)) {
        const f = XT(r), h = qT(d, r.props);
        return r.type !== w.Fragment && (h.ref = o ? ad(o, f) : f), w.cloneElement(r, h);
      }
      return w.Children.count(r) > 1 ? w.Children.only(null) : null;
    });
    return i.displayName = `${n}.SlotClone`, i;
  }
  var $0 = Symbol("radix.slottable");
  function YT(n) {
    const i = ({ children: l }) => S.jsx(S.Fragment, {
      children: l
    });
    return i.displayName = `${n}.Slottable`, i.__radixId = $0, i;
  }
  function PT(n) {
    return w.isValidElement(n) && typeof n.type == "function" && "__radixId" in n.type && n.type.__radixId === $0;
  }
  function qT(n, i) {
    const l = {
      ...i
    };
    for (const o in i) {
      const r = n[o], d = i[o];
      /^on[A-Z]/.test(o) ? r && d ? l[o] = (...h) => {
        const m = d(...h);
        return r(...h), m;
      } : r && (l[o] = r) : o === "style" ? l[o] = {
        ...r,
        ...d
      } : o === "className" && (l[o] = [
        r,
        d
      ].filter(Boolean).join(" "));
    }
    return {
      ...n,
      ...l
    };
  }
  function XT(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  var KT = [
    "a",
    "button",
    "div",
    "form",
    "h2",
    "h3",
    "img",
    "input",
    "label",
    "li",
    "nav",
    "ol",
    "p",
    "select",
    "span",
    "svg",
    "ul"
  ], Je = KT.reduce((n, i) => {
    const l = xf(`Primitive.${i}`), o = w.forwardRef((r, d) => {
      const { asChild: f, ...h } = r, m = f ? l : i;
      return typeof window < "u" && (window[Symbol.for("radix-ui")] = true), S.jsx(m, {
        ...h,
        ref: d
      });
    });
    return o.displayName = `Primitive.${i}`, {
      ...n,
      [i]: o
    };
  }, {});
  function ZT(n, i) {
    n && J0.flushSync(() => n.dispatchEvent(i));
  }
  function mr(n) {
    const i = w.useRef(n);
    return w.useEffect(() => {
      i.current = n;
    }), w.useMemo(() => (...l) => {
      var _a;
      return (_a = i.current) == null ? void 0 : _a.call(i, ...l);
    }, []);
  }
  function QT(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = mr(n);
    w.useEffect(() => {
      const o = (r) => {
        r.key === "Escape" && l(r);
      };
      return i.addEventListener("keydown", o, {
        capture: true
      }), () => i.removeEventListener("keydown", o, {
        capture: true
      });
    }, [
      l,
      i
    ]);
  }
  var FT = "DismissableLayer", Sf = "dismissableLayer.update", JT = "dismissableLayer.pointerDownOutside", $T = "dismissableLayer.focusOutside", oy, W0 = w.createContext({
    layers: /* @__PURE__ */ new Set(),
    layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
    branches: /* @__PURE__ */ new Set()
  }), I0 = w.forwardRef((n, i) => {
    const { disableOutsidePointerEvents: l = false, onEscapeKeyDown: o, onPointerDownOutside: r, onFocusOutside: d, onInteractOutside: f, onDismiss: h, ...m } = n, p = w.useContext(W0), [g, v] = w.useState(null), b = (g == null ? void 0 : g.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, T] = w.useState({}), A = ge(i, (X) => v(X)), C = Array.from(p.layers), [R] = [
      ...p.layersWithOutsidePointerEventsDisabled
    ].slice(-1), O = C.indexOf(R), L = g ? C.indexOf(g) : -1, z = p.layersWithOutsidePointerEventsDisabled.size > 0, V = L >= O, q = t2((X) => {
      const G = X.target, tt = [
        ...p.branches
      ].some((I) => I.contains(G));
      !V || tt || (r == null ? void 0 : r(X), f == null ? void 0 : f(X), X.defaultPrevented || (h == null ? void 0 : h()));
    }, b), $ = e2((X) => {
      const G = X.target;
      [
        ...p.branches
      ].some((I) => I.contains(G)) || (d == null ? void 0 : d(X), f == null ? void 0 : f(X), X.defaultPrevented || (h == null ? void 0 : h()));
    }, b);
    return QT((X) => {
      L === p.layers.size - 1 && (o == null ? void 0 : o(X), !X.defaultPrevented && h && (X.preventDefault(), h()));
    }, b), w.useEffect(() => {
      if (g) return l && (p.layersWithOutsidePointerEventsDisabled.size === 0 && (oy = b.body.style.pointerEvents, b.body.style.pointerEvents = "none"), p.layersWithOutsidePointerEventsDisabled.add(g)), p.layers.add(g), ry(), () => {
        l && p.layersWithOutsidePointerEventsDisabled.size === 1 && (b.body.style.pointerEvents = oy);
      };
    }, [
      g,
      b,
      l,
      p
    ]), w.useEffect(() => () => {
      g && (p.layers.delete(g), p.layersWithOutsidePointerEventsDisabled.delete(g), ry());
    }, [
      g,
      p
    ]), w.useEffect(() => {
      const X = () => T({});
      return document.addEventListener(Sf, X), () => document.removeEventListener(Sf, X);
    }, []), S.jsx(Je.div, {
      ...m,
      ref: A,
      style: {
        pointerEvents: z ? V ? "auto" : "none" : void 0,
        ...n.style
      },
      onFocusCapture: he(n.onFocusCapture, $.onFocusCapture),
      onBlurCapture: he(n.onBlurCapture, $.onBlurCapture),
      onPointerDownCapture: he(n.onPointerDownCapture, q.onPointerDownCapture)
    });
  });
  I0.displayName = FT;
  var WT = "DismissableLayerBranch", IT = w.forwardRef((n, i) => {
    const l = w.useContext(W0), o = w.useRef(null), r = ge(i, o);
    return w.useEffect(() => {
      const d = o.current;
      if (d) return l.branches.add(d), () => {
        l.branches.delete(d);
      };
    }, [
      l.branches
    ]), S.jsx(Je.div, {
      ...n,
      ref: r
    });
  });
  IT.displayName = WT;
  function t2(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = mr(n), o = w.useRef(false), r = w.useRef(() => {
    });
    return w.useEffect(() => {
      const d = (h) => {
        if (h.target && !o.current) {
          let m = function() {
            tv(JT, l, p, {
              discrete: true
            });
          };
          const p = {
            originalEvent: h
          };
          h.pointerType === "touch" ? (i.removeEventListener("click", r.current), r.current = m, i.addEventListener("click", r.current, {
            once: true
          })) : m();
        } else i.removeEventListener("click", r.current);
        o.current = false;
      }, f = window.setTimeout(() => {
        i.addEventListener("pointerdown", d);
      }, 0);
      return () => {
        window.clearTimeout(f), i.removeEventListener("pointerdown", d), i.removeEventListener("click", r.current);
      };
    }, [
      i,
      l
    ]), {
      onPointerDownCapture: () => o.current = true
    };
  }
  function e2(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = mr(n), o = w.useRef(false);
    return w.useEffect(() => {
      const r = (d) => {
        d.target && !o.current && tv($T, l, {
          originalEvent: d
        }, {
          discrete: false
        });
      };
      return i.addEventListener("focusin", r), () => i.removeEventListener("focusin", r);
    }, [
      i,
      l
    ]), {
      onFocusCapture: () => o.current = true,
      onBlurCapture: () => o.current = false
    };
  }
  function ry() {
    const n = new CustomEvent(Sf);
    document.dispatchEvent(n);
  }
  function tv(n, i, l, { discrete: o }) {
    const r = l.originalEvent.target, d = new CustomEvent(n, {
      bubbles: false,
      cancelable: true,
      detail: l
    });
    i && r.addEventListener(n, i, {
      once: true
    }), o ? ZT(r, d) : r.dispatchEvent(d);
  }
  var $i = (globalThis == null ? void 0 : globalThis.document) ? w.useLayoutEffect : () => {
  }, n2 = id[" useId ".trim().toString()] || (() => {
  }), i2 = 0;
  function a2(n) {
    const [i, l] = w.useState(n2());
    return $i(() => {
      l((o) => o ?? String(i2++));
    }, [
      n
    ]), i ? `radix-${i}` : "";
  }
  const s2 = [
    "top",
    "right",
    "bottom",
    "left"
  ], bi = Math.min, _e = Math.max, Io = Math.round, Vo = Math.floor, vn = (n) => ({
    x: n,
    y: n
  }), l2 = {
    left: "right",
    right: "left",
    bottom: "top",
    top: "bottom"
  };
  function Tf(n, i, l) {
    return _e(n, bi(i, l));
  }
  function Gn(n, i) {
    return typeof n == "function" ? n(i) : n;
  }
  function Yn(n) {
    return n.split("-")[0];
  }
  function Wa(n) {
    return n.split("-")[1];
  }
  function sd(n) {
    return n === "x" ? "y" : "x";
  }
  function ld(n) {
    return n === "y" ? "height" : "width";
  }
  function yn(n) {
    const i = n[0];
    return i === "t" || i === "b" ? "y" : "x";
  }
  function od(n) {
    return sd(yn(n));
  }
  function o2(n, i, l) {
    l === void 0 && (l = false);
    const o = Wa(n), r = od(n), d = ld(r);
    let f = r === "x" ? o === (l ? "end" : "start") ? "right" : "left" : o === "start" ? "bottom" : "top";
    return i.reference[d] > i.floating[d] && (f = tr(f)), [
      f,
      tr(f)
    ];
  }
  function r2(n) {
    const i = tr(n);
    return [
      wf(n),
      i,
      wf(i)
    ];
  }
  function wf(n) {
    return n.includes("start") ? n.replace("start", "end") : n.replace("end", "start");
  }
  const cy = [
    "left",
    "right"
  ], uy = [
    "right",
    "left"
  ], c2 = [
    "top",
    "bottom"
  ], u2 = [
    "bottom",
    "top"
  ];
  function f2(n, i, l) {
    switch (n) {
      case "top":
      case "bottom":
        return l ? i ? uy : cy : i ? cy : uy;
      case "left":
      case "right":
        return i ? c2 : u2;
      default:
        return [];
    }
  }
  function d2(n, i, l, o) {
    const r = Wa(n);
    let d = f2(Yn(n), l === "start", o);
    return r && (d = d.map((f) => f + "-" + r), i && (d = d.concat(d.map(wf)))), d;
  }
  function tr(n) {
    const i = Yn(n);
    return l2[i] + n.slice(i.length);
  }
  function h2(n) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      ...n
    };
  }
  function ev(n) {
    return typeof n != "number" ? h2(n) : {
      top: n,
      right: n,
      bottom: n,
      left: n
    };
  }
  function er(n) {
    const { x: i, y: l, width: o, height: r } = n;
    return {
      width: o,
      height: r,
      top: l,
      left: i,
      right: i + o,
      bottom: l + r,
      x: i,
      y: l
    };
  }
  function fy(n, i, l) {
    let { reference: o, floating: r } = n;
    const d = yn(i), f = od(i), h = ld(f), m = Yn(i), p = d === "y", g = o.x + o.width / 2 - r.width / 2, v = o.y + o.height / 2 - r.height / 2, b = o[h] / 2 - r[h] / 2;
    let T;
    switch (m) {
      case "top":
        T = {
          x: g,
          y: o.y - r.height
        };
        break;
      case "bottom":
        T = {
          x: g,
          y: o.y + o.height
        };
        break;
      case "right":
        T = {
          x: o.x + o.width,
          y: v
        };
        break;
      case "left":
        T = {
          x: o.x - r.width,
          y: v
        };
        break;
      default:
        T = {
          x: o.x,
          y: o.y
        };
    }
    switch (Wa(i)) {
      case "start":
        T[f] -= b * (l && p ? -1 : 1);
        break;
      case "end":
        T[f] += b * (l && p ? -1 : 1);
        break;
    }
    return T;
  }
  async function m2(n, i) {
    var l;
    i === void 0 && (i = {});
    const { x: o, y: r, platform: d, rects: f, elements: h, strategy: m } = n, { boundary: p = "clippingAncestors", rootBoundary: g = "viewport", elementContext: v = "floating", altBoundary: b = false, padding: T = 0 } = Gn(i, n), A = ev(T), R = h[b ? v === "floating" ? "reference" : "floating" : v], O = er(await d.getClippingRect({
      element: (l = await (d.isElement == null ? void 0 : d.isElement(R))) == null || l ? R : R.contextElement || await (d.getDocumentElement == null ? void 0 : d.getDocumentElement(h.floating)),
      boundary: p,
      rootBoundary: g,
      strategy: m
    })), L = v === "floating" ? {
      x: o,
      y: r,
      width: f.floating.width,
      height: f.floating.height
    } : f.reference, z = await (d.getOffsetParent == null ? void 0 : d.getOffsetParent(h.floating)), V = await (d.isElement == null ? void 0 : d.isElement(z)) ? await (d.getScale == null ? void 0 : d.getScale(z)) || {
      x: 1,
      y: 1
    } : {
      x: 1,
      y: 1
    }, q = er(d.convertOffsetParentRelativeRectToViewportRelativeRect ? await d.convertOffsetParentRelativeRectToViewportRelativeRect({
      elements: h,
      rect: L,
      offsetParent: z,
      strategy: m
    }) : L);
    return {
      top: (O.top - q.top + A.top) / V.y,
      bottom: (q.bottom - O.bottom + A.bottom) / V.y,
      left: (O.left - q.left + A.left) / V.x,
      right: (q.right - O.right + A.right) / V.x
    };
  }
  const p2 = 50, g2 = async (n, i, l) => {
    const { placement: o = "bottom", strategy: r = "absolute", middleware: d = [], platform: f } = l, h = f.detectOverflow ? f : {
      ...f,
      detectOverflow: m2
    }, m = await (f.isRTL == null ? void 0 : f.isRTL(i));
    let p = await f.getElementRects({
      reference: n,
      floating: i,
      strategy: r
    }), { x: g, y: v } = fy(p, o, m), b = o, T = 0;
    const A = {};
    for (let C = 0; C < d.length; C++) {
      const R = d[C];
      if (!R) continue;
      const { name: O, fn: L } = R, { x: z, y: V, data: q, reset: $ } = await L({
        x: g,
        y: v,
        initialPlacement: o,
        placement: b,
        strategy: r,
        middlewareData: A,
        rects: p,
        platform: h,
        elements: {
          reference: n,
          floating: i
        }
      });
      g = z ?? g, v = V ?? v, A[O] = {
        ...A[O],
        ...q
      }, $ && T < p2 && (T++, typeof $ == "object" && ($.placement && (b = $.placement), $.rects && (p = $.rects === true ? await f.getElementRects({
        reference: n,
        floating: i,
        strategy: r
      }) : $.rects), { x: g, y: v } = fy(p, b, m)), C = -1);
    }
    return {
      x: g,
      y: v,
      placement: b,
      strategy: r,
      middlewareData: A
    };
  }, y2 = (n) => ({
    name: "arrow",
    options: n,
    async fn(i) {
      const { x: l, y: o, placement: r, rects: d, platform: f, elements: h, middlewareData: m } = i, { element: p, padding: g = 0 } = Gn(n, i) || {};
      if (p == null) return {};
      const v = ev(g), b = {
        x: l,
        y: o
      }, T = od(r), A = ld(T), C = await f.getDimensions(p), R = T === "y", O = R ? "top" : "left", L = R ? "bottom" : "right", z = R ? "clientHeight" : "clientWidth", V = d.reference[A] + d.reference[T] - b[T] - d.floating[A], q = b[T] - d.reference[T], $ = await (f.getOffsetParent == null ? void 0 : f.getOffsetParent(p));
      let X = $ ? $[z] : 0;
      (!X || !await (f.isElement == null ? void 0 : f.isElement($))) && (X = h.floating[z] || d.floating[A]);
      const G = V / 2 - q / 2, tt = X / 2 - C[A] / 2 - 1, I = bi(v[O], tt), nt = bi(v[L], tt), st = I, gt = X - C[A] - nt, ht = X / 2 - C[A] / 2 + G, mt = Tf(st, ht, gt), k = !m.arrow && Wa(r) != null && ht !== mt && d.reference[A] / 2 - (ht < st ? I : nt) - C[A] / 2 < 0, F = k ? ht < st ? ht - st : ht - gt : 0;
      return {
        [T]: b[T] + F,
        data: {
          [T]: mt,
          centerOffset: ht - mt - F,
          ...k && {
            alignmentOffset: F
          }
        },
        reset: k
      };
    }
  }), v2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "flip",
      options: n,
      async fn(i) {
        var l, o;
        const { placement: r, middlewareData: d, rects: f, initialPlacement: h, platform: m, elements: p } = i, { mainAxis: g = true, crossAxis: v = true, fallbackPlacements: b, fallbackStrategy: T = "bestFit", fallbackAxisSideDirection: A = "none", flipAlignment: C = true, ...R } = Gn(n, i);
        if ((l = d.arrow) != null && l.alignmentOffset) return {};
        const O = Yn(r), L = yn(h), z = Yn(h) === h, V = await (m.isRTL == null ? void 0 : m.isRTL(p.floating)), q = b || (z || !C ? [
          tr(h)
        ] : r2(h)), $ = A !== "none";
        !b && $ && q.push(...d2(h, C, A, V));
        const X = [
          h,
          ...q
        ], G = await m.detectOverflow(i, R), tt = [];
        let I = ((o = d.flip) == null ? void 0 : o.overflows) || [];
        if (g && tt.push(G[O]), v) {
          const ht = o2(r, f, V);
          tt.push(G[ht[0]], G[ht[1]]);
        }
        if (I = [
          ...I,
          {
            placement: r,
            overflows: tt
          }
        ], !tt.every((ht) => ht <= 0)) {
          var nt, st;
          const ht = (((nt = d.flip) == null ? void 0 : nt.index) || 0) + 1, mt = X[ht];
          if (mt && (!(v === "alignment" ? L !== yn(mt) : false) || I.every((Z) => yn(Z.placement) === L ? Z.overflows[0] > 0 : true))) return {
            data: {
              index: ht,
              overflows: I
            },
            reset: {
              placement: mt
            }
          };
          let k = (st = I.filter((F) => F.overflows[0] <= 0).sort((F, Z) => F.overflows[1] - Z.overflows[1])[0]) == null ? void 0 : st.placement;
          if (!k) switch (T) {
            case "bestFit": {
              var gt;
              const F = (gt = I.filter((Z) => {
                if ($) {
                  const it = yn(Z.placement);
                  return it === L || it === "y";
                }
                return true;
              }).map((Z) => [
                Z.placement,
                Z.overflows.filter((it) => it > 0).reduce((it, N) => it + N, 0)
              ]).sort((Z, it) => Z[1] - it[1])[0]) == null ? void 0 : gt[0];
              F && (k = F);
              break;
            }
            case "initialPlacement":
              k = h;
              break;
          }
          if (r !== k) return {
            reset: {
              placement: k
            }
          };
        }
        return {};
      }
    };
  };
  function dy(n, i) {
    return {
      top: n.top - i.height,
      right: n.right - i.width,
      bottom: n.bottom - i.height,
      left: n.left - i.width
    };
  }
  function hy(n) {
    return s2.some((i) => n[i] >= 0);
  }
  const b2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "hide",
      options: n,
      async fn(i) {
        const { rects: l, platform: o } = i, { strategy: r = "referenceHidden", ...d } = Gn(n, i);
        switch (r) {
          case "referenceHidden": {
            const f = await o.detectOverflow(i, {
              ...d,
              elementContext: "reference"
            }), h = dy(f, l.reference);
            return {
              data: {
                referenceHiddenOffsets: h,
                referenceHidden: hy(h)
              }
            };
          }
          case "escaped": {
            const f = await o.detectOverflow(i, {
              ...d,
              altBoundary: true
            }), h = dy(f, l.floating);
            return {
              data: {
                escapedOffsets: h,
                escaped: hy(h)
              }
            };
          }
          default:
            return {};
        }
      }
    };
  }, nv = /* @__PURE__ */ new Set([
    "left",
    "top"
  ]);
  async function x2(n, i) {
    const { placement: l, platform: o, elements: r } = n, d = await (o.isRTL == null ? void 0 : o.isRTL(r.floating)), f = Yn(l), h = Wa(l), m = yn(l) === "y", p = nv.has(f) ? -1 : 1, g = d && m ? -1 : 1, v = Gn(i, n);
    let { mainAxis: b, crossAxis: T, alignmentAxis: A } = typeof v == "number" ? {
      mainAxis: v,
      crossAxis: 0,
      alignmentAxis: null
    } : {
      mainAxis: v.mainAxis || 0,
      crossAxis: v.crossAxis || 0,
      alignmentAxis: v.alignmentAxis
    };
    return h && typeof A == "number" && (T = h === "end" ? A * -1 : A), m ? {
      x: T * g,
      y: b * p
    } : {
      x: b * p,
      y: T * g
    };
  }
  const S2 = function(n) {
    return n === void 0 && (n = 0), {
      name: "offset",
      options: n,
      async fn(i) {
        var l, o;
        const { x: r, y: d, placement: f, middlewareData: h } = i, m = await x2(i, n);
        return f === ((l = h.offset) == null ? void 0 : l.placement) && (o = h.arrow) != null && o.alignmentOffset ? {} : {
          x: r + m.x,
          y: d + m.y,
          data: {
            ...m,
            placement: f
          }
        };
      }
    };
  }, T2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "shift",
      options: n,
      async fn(i) {
        const { x: l, y: o, placement: r, platform: d } = i, { mainAxis: f = true, crossAxis: h = false, limiter: m = {
          fn: (O) => {
            let { x: L, y: z } = O;
            return {
              x: L,
              y: z
            };
          }
        }, ...p } = Gn(n, i), g = {
          x: l,
          y: o
        }, v = await d.detectOverflow(i, p), b = yn(Yn(r)), T = sd(b);
        let A = g[T], C = g[b];
        if (f) {
          const O = T === "y" ? "top" : "left", L = T === "y" ? "bottom" : "right", z = A + v[O], V = A - v[L];
          A = Tf(z, A, V);
        }
        if (h) {
          const O = b === "y" ? "top" : "left", L = b === "y" ? "bottom" : "right", z = C + v[O], V = C - v[L];
          C = Tf(z, C, V);
        }
        const R = m.fn({
          ...i,
          [T]: A,
          [b]: C
        });
        return {
          ...R,
          data: {
            x: R.x - l,
            y: R.y - o,
            enabled: {
              [T]: f,
              [b]: h
            }
          }
        };
      }
    };
  }, w2 = function(n) {
    return n === void 0 && (n = {}), {
      options: n,
      fn(i) {
        const { x: l, y: o, placement: r, rects: d, middlewareData: f } = i, { offset: h = 0, mainAxis: m = true, crossAxis: p = true } = Gn(n, i), g = {
          x: l,
          y: o
        }, v = yn(r), b = sd(v);
        let T = g[b], A = g[v];
        const C = Gn(h, i), R = typeof C == "number" ? {
          mainAxis: C,
          crossAxis: 0
        } : {
          mainAxis: 0,
          crossAxis: 0,
          ...C
        };
        if (m) {
          const z = b === "y" ? "height" : "width", V = d.reference[b] - d.floating[z] + R.mainAxis, q = d.reference[b] + d.reference[z] - R.mainAxis;
          T < V ? T = V : T > q && (T = q);
        }
        if (p) {
          var O, L;
          const z = b === "y" ? "width" : "height", V = nv.has(Yn(r)), q = d.reference[v] - d.floating[z] + (V && ((O = f.offset) == null ? void 0 : O[v]) || 0) + (V ? 0 : R.crossAxis), $ = d.reference[v] + d.reference[z] + (V ? 0 : ((L = f.offset) == null ? void 0 : L[v]) || 0) - (V ? R.crossAxis : 0);
          A < q ? A = q : A > $ && (A = $);
        }
        return {
          [b]: T,
          [v]: A
        };
      }
    };
  }, A2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "size",
      options: n,
      async fn(i) {
        var l, o;
        const { placement: r, rects: d, platform: f, elements: h } = i, { apply: m = () => {
        }, ...p } = Gn(n, i), g = await f.detectOverflow(i, p), v = Yn(r), b = Wa(r), T = yn(r) === "y", { width: A, height: C } = d.floating;
        let R, O;
        v === "top" || v === "bottom" ? (R = v, O = b === (await (f.isRTL == null ? void 0 : f.isRTL(h.floating)) ? "start" : "end") ? "left" : "right") : (O = v, R = b === "end" ? "top" : "bottom");
        const L = C - g.top - g.bottom, z = A - g.left - g.right, V = bi(C - g[R], L), q = bi(A - g[O], z), $ = !i.middlewareData.shift;
        let X = V, G = q;
        if ((l = i.middlewareData.shift) != null && l.enabled.x && (G = z), (o = i.middlewareData.shift) != null && o.enabled.y && (X = L), $ && !b) {
          const I = _e(g.left, 0), nt = _e(g.right, 0), st = _e(g.top, 0), gt = _e(g.bottom, 0);
          T ? G = A - 2 * (I !== 0 || nt !== 0 ? I + nt : _e(g.left, g.right)) : X = C - 2 * (st !== 0 || gt !== 0 ? st + gt : _e(g.top, g.bottom));
        }
        await m({
          ...i,
          availableWidth: G,
          availableHeight: X
        });
        const tt = await f.getDimensions(h.floating);
        return A !== tt.width || C !== tt.height ? {
          reset: {
            rects: true
          }
        } : {};
      }
    };
  };
  function pr() {
    return typeof window < "u";
  }
  function Ia(n) {
    return iv(n) ? (n.nodeName || "").toLowerCase() : "#document";
  }
  function Ve(n) {
    var i;
    return (n == null || (i = n.ownerDocument) == null ? void 0 : i.defaultView) || window;
  }
  function Sn(n) {
    var i;
    return (i = (iv(n) ? n.ownerDocument : n.document) || window.document) == null ? void 0 : i.documentElement;
  }
  function iv(n) {
    return pr() ? n instanceof Node || n instanceof Ve(n).Node : false;
  }
  function ln(n) {
    return pr() ? n instanceof Element || n instanceof Ve(n).Element : false;
  }
  function Pn(n) {
    return pr() ? n instanceof HTMLElement || n instanceof Ve(n).HTMLElement : false;
  }
  function my(n) {
    return !pr() || typeof ShadowRoot > "u" ? false : n instanceof ShadowRoot || n instanceof Ve(n).ShadowRoot;
  }
  function dl(n) {
    const { overflow: i, overflowX: l, overflowY: o, display: r } = on(n);
    return /auto|scroll|overlay|hidden|clip/.test(i + o + l) && r !== "inline" && r !== "contents";
  }
  function E2(n) {
    return /^(table|td|th)$/.test(Ia(n));
  }
  function gr(n) {
    try {
      if (n.matches(":popover-open")) return true;
    } catch {
    }
    try {
      return n.matches(":modal");
    } catch {
      return false;
    }
  }
  const C2 = /transform|translate|scale|rotate|perspective|filter/, M2 = /paint|layout|strict|content/, Pi = (n) => !!n && n !== "none";
  let $u;
  function rd(n) {
    const i = ln(n) ? on(n) : n;
    return Pi(i.transform) || Pi(i.translate) || Pi(i.scale) || Pi(i.rotate) || Pi(i.perspective) || !cd() && (Pi(i.backdropFilter) || Pi(i.filter)) || C2.test(i.willChange || "") || M2.test(i.contain || "");
  }
  function R2(n) {
    let i = xi(n);
    for (; Pn(i) && !Qa(i); ) {
      if (rd(i)) return i;
      if (gr(i)) return null;
      i = xi(i);
    }
    return null;
  }
  function cd() {
    return $u == null && ($u = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), $u;
  }
  function Qa(n) {
    return /^(html|body|#document)$/.test(Ia(n));
  }
  function on(n) {
    return Ve(n).getComputedStyle(n);
  }
  function yr(n) {
    return ln(n) ? {
      scrollLeft: n.scrollLeft,
      scrollTop: n.scrollTop
    } : {
      scrollLeft: n.scrollX,
      scrollTop: n.scrollY
    };
  }
  function xi(n) {
    if (Ia(n) === "html") return n;
    const i = n.assignedSlot || n.parentNode || my(n) && n.host || Sn(n);
    return my(i) ? i.host : i;
  }
  function av(n) {
    const i = xi(n);
    return Qa(i) ? n.ownerDocument ? n.ownerDocument.body : n.body : Pn(i) && dl(i) ? i : av(i);
  }
  function ll(n, i, l) {
    var o;
    i === void 0 && (i = []), l === void 0 && (l = true);
    const r = av(n), d = r === ((o = n.ownerDocument) == null ? void 0 : o.body), f = Ve(r);
    if (d) {
      const h = Af(f);
      return i.concat(f, f.visualViewport || [], dl(r) ? r : [], h && l ? ll(h) : []);
    } else return i.concat(r, ll(r, [], l));
  }
  function Af(n) {
    return n.parent && Object.getPrototypeOf(n.parent) ? n.frameElement : null;
  }
  function sv(n) {
    const i = on(n);
    let l = parseFloat(i.width) || 0, o = parseFloat(i.height) || 0;
    const r = Pn(n), d = r ? n.offsetWidth : l, f = r ? n.offsetHeight : o, h = Io(l) !== d || Io(o) !== f;
    return h && (l = d, o = f), {
      width: l,
      height: o,
      $: h
    };
  }
  function ud(n) {
    return ln(n) ? n : n.contextElement;
  }
  function Ka(n) {
    const i = ud(n);
    if (!Pn(i)) return vn(1);
    const l = i.getBoundingClientRect(), { width: o, height: r, $: d } = sv(i);
    let f = (d ? Io(l.width) : l.width) / o, h = (d ? Io(l.height) : l.height) / r;
    return (!f || !Number.isFinite(f)) && (f = 1), (!h || !Number.isFinite(h)) && (h = 1), {
      x: f,
      y: h
    };
  }
  const D2 = vn(0);
  function lv(n) {
    const i = Ve(n);
    return !cd() || !i.visualViewport ? D2 : {
      x: i.visualViewport.offsetLeft,
      y: i.visualViewport.offsetTop
    };
  }
  function O2(n, i, l) {
    return i === void 0 && (i = false), !l || i && l !== Ve(n) ? false : i;
  }
  function Wi(n, i, l, o) {
    i === void 0 && (i = false), l === void 0 && (l = false);
    const r = n.getBoundingClientRect(), d = ud(n);
    let f = vn(1);
    i && (o ? ln(o) && (f = Ka(o)) : f = Ka(n));
    const h = O2(d, l, o) ? lv(d) : vn(0);
    let m = (r.left + h.x) / f.x, p = (r.top + h.y) / f.y, g = r.width / f.x, v = r.height / f.y;
    if (d) {
      const b = Ve(d), T = o && ln(o) ? Ve(o) : o;
      let A = b, C = Af(A);
      for (; C && o && T !== A; ) {
        const R = Ka(C), O = C.getBoundingClientRect(), L = on(C), z = O.left + (C.clientLeft + parseFloat(L.paddingLeft)) * R.x, V = O.top + (C.clientTop + parseFloat(L.paddingTop)) * R.y;
        m *= R.x, p *= R.y, g *= R.x, v *= R.y, m += z, p += V, A = Ve(C), C = Af(A);
      }
    }
    return er({
      width: g,
      height: v,
      x: m,
      y: p
    });
  }
  function vr(n, i) {
    const l = yr(n).scrollLeft;
    return i ? i.left + l : Wi(Sn(n)).left + l;
  }
  function ov(n, i) {
    const l = n.getBoundingClientRect(), o = l.left + i.scrollLeft - vr(n, l), r = l.top + i.scrollTop;
    return {
      x: o,
      y: r
    };
  }
  function j2(n) {
    let { elements: i, rect: l, offsetParent: o, strategy: r } = n;
    const d = r === "fixed", f = Sn(o), h = i ? gr(i.floating) : false;
    if (o === f || h && d) return l;
    let m = {
      scrollLeft: 0,
      scrollTop: 0
    }, p = vn(1);
    const g = vn(0), v = Pn(o);
    if ((v || !v && !d) && ((Ia(o) !== "body" || dl(f)) && (m = yr(o)), v)) {
      const T = Wi(o);
      p = Ka(o), g.x = T.x + o.clientLeft, g.y = T.y + o.clientTop;
    }
    const b = f && !v && !d ? ov(f, m) : vn(0);
    return {
      width: l.width * p.x,
      height: l.height * p.y,
      x: l.x * p.x - m.scrollLeft * p.x + g.x + b.x,
      y: l.y * p.y - m.scrollTop * p.y + g.y + b.y
    };
  }
  function N2(n) {
    return Array.from(n.getClientRects());
  }
  function z2(n) {
    const i = Sn(n), l = yr(n), o = n.ownerDocument.body, r = _e(i.scrollWidth, i.clientWidth, o.scrollWidth, o.clientWidth), d = _e(i.scrollHeight, i.clientHeight, o.scrollHeight, o.clientHeight);
    let f = -l.scrollLeft + vr(n);
    const h = -l.scrollTop;
    return on(o).direction === "rtl" && (f += _e(i.clientWidth, o.clientWidth) - r), {
      width: r,
      height: d,
      x: f,
      y: h
    };
  }
  const py = 25;
  function _2(n, i) {
    const l = Ve(n), o = Sn(n), r = l.visualViewport;
    let d = o.clientWidth, f = o.clientHeight, h = 0, m = 0;
    if (r) {
      d = r.width, f = r.height;
      const g = cd();
      (!g || g && i === "fixed") && (h = r.offsetLeft, m = r.offsetTop);
    }
    const p = vr(o);
    if (p <= 0) {
      const g = o.ownerDocument, v = g.body, b = getComputedStyle(v), T = g.compatMode === "CSS1Compat" && parseFloat(b.marginLeft) + parseFloat(b.marginRight) || 0, A = Math.abs(o.clientWidth - v.clientWidth - T);
      A <= py && (d -= A);
    } else p <= py && (d += p);
    return {
      width: d,
      height: f,
      x: h,
      y: m
    };
  }
  function V2(n, i) {
    const l = Wi(n, true, i === "fixed"), o = l.top + n.clientTop, r = l.left + n.clientLeft, d = Pn(n) ? Ka(n) : vn(1), f = n.clientWidth * d.x, h = n.clientHeight * d.y, m = r * d.x, p = o * d.y;
    return {
      width: f,
      height: h,
      x: m,
      y: p
    };
  }
  function gy(n, i, l) {
    let o;
    if (i === "viewport") o = _2(n, l);
    else if (i === "document") o = z2(Sn(n));
    else if (ln(i)) o = V2(i, l);
    else {
      const r = lv(n);
      o = {
        x: i.x - r.x,
        y: i.y - r.y,
        width: i.width,
        height: i.height
      };
    }
    return er(o);
  }
  function rv(n, i) {
    const l = xi(n);
    return l === i || !ln(l) || Qa(l) ? false : on(l).position === "fixed" || rv(l, i);
  }
  function k2(n, i) {
    const l = i.get(n);
    if (l) return l;
    let o = ll(n, [], false).filter((h) => ln(h) && Ia(h) !== "body"), r = null;
    const d = on(n).position === "fixed";
    let f = d ? xi(n) : n;
    for (; ln(f) && !Qa(f); ) {
      const h = on(f), m = rd(f);
      !m && h.position === "fixed" && (r = null), (d ? !m && !r : !m && h.position === "static" && !!r && (r.position === "absolute" || r.position === "fixed") || dl(f) && !m && rv(n, f)) ? o = o.filter((g) => g !== f) : r = h, f = xi(f);
    }
    return i.set(n, o), o;
  }
  function L2(n) {
    let { element: i, boundary: l, rootBoundary: o, strategy: r } = n;
    const f = [
      ...l === "clippingAncestors" ? gr(i) ? [] : k2(i, this._c) : [].concat(l),
      o
    ], h = gy(i, f[0], r);
    let m = h.top, p = h.right, g = h.bottom, v = h.left;
    for (let b = 1; b < f.length; b++) {
      const T = gy(i, f[b], r);
      m = _e(T.top, m), p = bi(T.right, p), g = bi(T.bottom, g), v = _e(T.left, v);
    }
    return {
      width: p - v,
      height: g - m,
      x: v,
      y: m
    };
  }
  function B2(n) {
    const { width: i, height: l } = sv(n);
    return {
      width: i,
      height: l
    };
  }
  function U2(n, i, l) {
    const o = Pn(i), r = Sn(i), d = l === "fixed", f = Wi(n, true, d, i);
    let h = {
      scrollLeft: 0,
      scrollTop: 0
    };
    const m = vn(0);
    function p() {
      m.x = vr(r);
    }
    if (o || !o && !d) if ((Ia(i) !== "body" || dl(r)) && (h = yr(i)), o) {
      const T = Wi(i, true, d, i);
      m.x = T.x + i.clientLeft, m.y = T.y + i.clientTop;
    } else r && p();
    d && !o && r && p();
    const g = r && !o && !d ? ov(r, h) : vn(0), v = f.left + h.scrollLeft - m.x - g.x, b = f.top + h.scrollTop - m.y - g.y;
    return {
      x: v,
      y: b,
      width: f.width,
      height: f.height
    };
  }
  function Wu(n) {
    return on(n).position === "static";
  }
  function yy(n, i) {
    if (!Pn(n) || on(n).position === "fixed") return null;
    if (i) return i(n);
    let l = n.offsetParent;
    return Sn(n) === l && (l = l.ownerDocument.body), l;
  }
  function cv(n, i) {
    const l = Ve(n);
    if (gr(n)) return l;
    if (!Pn(n)) {
      let r = xi(n);
      for (; r && !Qa(r); ) {
        if (ln(r) && !Wu(r)) return r;
        r = xi(r);
      }
      return l;
    }
    let o = yy(n, i);
    for (; o && E2(o) && Wu(o); ) o = yy(o, i);
    return o && Qa(o) && Wu(o) && !rd(o) ? l : o || R2(n) || l;
  }
  const H2 = async function(n) {
    const i = this.getOffsetParent || cv, l = this.getDimensions, o = await l(n.floating);
    return {
      reference: U2(n.reference, await i(n.floating), n.strategy),
      floating: {
        x: 0,
        y: 0,
        width: o.width,
        height: o.height
      }
    };
  };
  function G2(n) {
    return on(n).direction === "rtl";
  }
  const Y2 = {
    convertOffsetParentRelativeRectToViewportRelativeRect: j2,
    getDocumentElement: Sn,
    getClippingRect: L2,
    getOffsetParent: cv,
    getElementRects: H2,
    getClientRects: N2,
    getDimensions: B2,
    getScale: Ka,
    isElement: ln,
    isRTL: G2
  };
  function uv(n, i) {
    return n.x === i.x && n.y === i.y && n.width === i.width && n.height === i.height;
  }
  function P2(n, i) {
    let l = null, o;
    const r = Sn(n);
    function d() {
      var h;
      clearTimeout(o), (h = l) == null || h.disconnect(), l = null;
    }
    function f(h, m) {
      h === void 0 && (h = false), m === void 0 && (m = 1), d();
      const p = n.getBoundingClientRect(), { left: g, top: v, width: b, height: T } = p;
      if (h || i(), !b || !T) return;
      const A = Vo(v), C = Vo(r.clientWidth - (g + b)), R = Vo(r.clientHeight - (v + T)), O = Vo(g), z = {
        rootMargin: -A + "px " + -C + "px " + -R + "px " + -O + "px",
        threshold: _e(0, bi(1, m)) || 1
      };
      let V = true;
      function q($) {
        const X = $[0].intersectionRatio;
        if (X !== m) {
          if (!V) return f();
          X ? f(false, X) : o = setTimeout(() => {
            f(false, 1e-7);
          }, 1e3);
        }
        X === 1 && !uv(p, n.getBoundingClientRect()) && f(), V = false;
      }
      try {
        l = new IntersectionObserver(q, {
          ...z,
          root: r.ownerDocument
        });
      } catch {
        l = new IntersectionObserver(q, z);
      }
      l.observe(n);
    }
    return f(true), d;
  }
  function q2(n, i, l, o) {
    o === void 0 && (o = {});
    const { ancestorScroll: r = true, ancestorResize: d = true, elementResize: f = typeof ResizeObserver == "function", layoutShift: h = typeof IntersectionObserver == "function", animationFrame: m = false } = o, p = ud(n), g = r || d ? [
      ...p ? ll(p) : [],
      ...i ? ll(i) : []
    ] : [];
    g.forEach((O) => {
      r && O.addEventListener("scroll", l, {
        passive: true
      }), d && O.addEventListener("resize", l);
    });
    const v = p && h ? P2(p, l) : null;
    let b = -1, T = null;
    f && (T = new ResizeObserver((O) => {
      let [L] = O;
      L && L.target === p && T && i && (T.unobserve(i), cancelAnimationFrame(b), b = requestAnimationFrame(() => {
        var z;
        (z = T) == null || z.observe(i);
      })), l();
    }), p && !m && T.observe(p), i && T.observe(i));
    let A, C = m ? Wi(n) : null;
    m && R();
    function R() {
      const O = Wi(n);
      C && !uv(C, O) && l(), C = O, A = requestAnimationFrame(R);
    }
    return l(), () => {
      var O;
      g.forEach((L) => {
        r && L.removeEventListener("scroll", l), d && L.removeEventListener("resize", l);
      }), v == null ? void 0 : v(), (O = T) == null || O.disconnect(), T = null, m && cancelAnimationFrame(A);
    };
  }
  const X2 = S2, K2 = T2, Z2 = v2, Q2 = A2, F2 = b2, vy = y2, J2 = w2, $2 = (n, i, l) => {
    const o = /* @__PURE__ */ new Map(), r = {
      platform: Y2,
      ...l
    }, d = {
      ...r.platform,
      _c: o
    };
    return g2(n, i, {
      ...r,
      platform: d
    });
  };
  var W2 = typeof document < "u", I2 = function() {
  }, qo = W2 ? w.useLayoutEffect : I2;
  function nr(n, i) {
    if (n === i) return true;
    if (typeof n != typeof i) return false;
    if (typeof n == "function" && n.toString() === i.toString()) return true;
    let l, o, r;
    if (n && i && typeof n == "object") {
      if (Array.isArray(n)) {
        if (l = n.length, l !== i.length) return false;
        for (o = l; o-- !== 0; ) if (!nr(n[o], i[o])) return false;
        return true;
      }
      if (r = Object.keys(n), l = r.length, l !== Object.keys(i).length) return false;
      for (o = l; o-- !== 0; ) if (!{}.hasOwnProperty.call(i, r[o])) return false;
      for (o = l; o-- !== 0; ) {
        const d = r[o];
        if (!(d === "_owner" && n.$$typeof) && !nr(n[d], i[d])) return false;
      }
      return true;
    }
    return n !== n && i !== i;
  }
  function fv(n) {
    return typeof window > "u" ? 1 : (n.ownerDocument.defaultView || window).devicePixelRatio || 1;
  }
  function by(n, i) {
    const l = fv(n);
    return Math.round(i * l) / l;
  }
  function Iu(n) {
    const i = w.useRef(n);
    return qo(() => {
      i.current = n;
    }), i;
  }
  function tw(n) {
    n === void 0 && (n = {});
    const { placement: i = "bottom", strategy: l = "absolute", middleware: o = [], platform: r, elements: { reference: d, floating: f } = {}, transform: h = true, whileElementsMounted: m, open: p } = n, [g, v] = w.useState({
      x: 0,
      y: 0,
      strategy: l,
      placement: i,
      middlewareData: {},
      isPositioned: false
    }), [b, T] = w.useState(o);
    nr(b, o) || T(o);
    const [A, C] = w.useState(null), [R, O] = w.useState(null), L = w.useCallback((Z) => {
      Z !== $.current && ($.current = Z, C(Z));
    }, []), z = w.useCallback((Z) => {
      Z !== X.current && (X.current = Z, O(Z));
    }, []), V = d || A, q = f || R, $ = w.useRef(null), X = w.useRef(null), G = w.useRef(g), tt = m != null, I = Iu(m), nt = Iu(r), st = Iu(p), gt = w.useCallback(() => {
      if (!$.current || !X.current) return;
      const Z = {
        placement: i,
        strategy: l,
        middleware: b
      };
      nt.current && (Z.platform = nt.current), $2($.current, X.current, Z).then((it) => {
        const N = {
          ...it,
          isPositioned: st.current !== false
        };
        ht.current && !nr(G.current, N) && (G.current = N, J0.flushSync(() => {
          v(N);
        }));
      });
    }, [
      b,
      i,
      l,
      nt,
      st
    ]);
    qo(() => {
      p === false && G.current.isPositioned && (G.current.isPositioned = false, v((Z) => ({
        ...Z,
        isPositioned: false
      })));
    }, [
      p
    ]);
    const ht = w.useRef(false);
    qo(() => (ht.current = true, () => {
      ht.current = false;
    }), []), qo(() => {
      if (V && ($.current = V), q && (X.current = q), V && q) {
        if (I.current) return I.current(V, q, gt);
        gt();
      }
    }, [
      V,
      q,
      gt,
      I,
      tt
    ]);
    const mt = w.useMemo(() => ({
      reference: $,
      floating: X,
      setReference: L,
      setFloating: z
    }), [
      L,
      z
    ]), k = w.useMemo(() => ({
      reference: V,
      floating: q
    }), [
      V,
      q
    ]), F = w.useMemo(() => {
      const Z = {
        position: l,
        left: 0,
        top: 0
      };
      if (!k.floating) return Z;
      const it = by(k.floating, g.x), N = by(k.floating, g.y);
      return h ? {
        ...Z,
        transform: "translate(" + it + "px, " + N + "px)",
        ...fv(k.floating) >= 1.5 && {
          willChange: "transform"
        }
      } : {
        position: l,
        left: it,
        top: N
      };
    }, [
      l,
      h,
      k.floating,
      g.x,
      g.y
    ]);
    return w.useMemo(() => ({
      ...g,
      update: gt,
      refs: mt,
      elements: k,
      floatingStyles: F
    }), [
      g,
      gt,
      mt,
      k,
      F
    ]);
  }
  const ew = (n) => {
    function i(l) {
      return {}.hasOwnProperty.call(l, "current");
    }
    return {
      name: "arrow",
      options: n,
      fn(l) {
        const { element: o, padding: r } = typeof n == "function" ? n(l) : n;
        return o && i(o) ? o.current != null ? vy({
          element: o.current,
          padding: r
        }).fn(l) : {} : o ? vy({
          element: o,
          padding: r
        }).fn(l) : {};
      }
    };
  }, nw = (n, i) => {
    const l = X2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, iw = (n, i) => {
    const l = K2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, aw = (n, i) => ({
    fn: J2(n).fn,
    options: [
      n,
      i
    ]
  }), sw = (n, i) => {
    const l = Z2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, lw = (n, i) => {
    const l = Q2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, ow = (n, i) => {
    const l = F2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, rw = (n, i) => {
    const l = ew(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  };
  var cw = "Arrow", dv = w.forwardRef((n, i) => {
    const { children: l, width: o = 10, height: r = 5, ...d } = n;
    return S.jsx(Je.svg, {
      ...d,
      ref: i,
      width: o,
      height: r,
      viewBox: "0 0 30 10",
      preserveAspectRatio: "none",
      children: n.asChild ? l : S.jsx("polygon", {
        points: "0,0 30,0 15,10"
      })
    });
  });
  dv.displayName = cw;
  var uw = dv;
  function hv(n) {
    const [i, l] = w.useState(void 0);
    return $i(() => {
      if (n) {
        l({
          width: n.offsetWidth,
          height: n.offsetHeight
        });
        const o = new ResizeObserver((r) => {
          if (!Array.isArray(r) || !r.length) return;
          const d = r[0];
          let f, h;
          if ("borderBoxSize" in d) {
            const m = d.borderBoxSize, p = Array.isArray(m) ? m[0] : m;
            f = p.inlineSize, h = p.blockSize;
          } else f = n.offsetWidth, h = n.offsetHeight;
          l({
            width: f,
            height: h
          });
        });
        return o.observe(n, {
          box: "border-box"
        }), () => o.unobserve(n);
      } else l(void 0);
    }, [
      n
    ]), i;
  }
  var fd = "Popper", [mv, pv] = hr(fd), [fw, gv] = mv(fd), yv = (n) => {
    const { __scopePopper: i, children: l } = n, [o, r] = w.useState(null);
    return S.jsx(fw, {
      scope: i,
      anchor: o,
      onAnchorChange: r,
      children: l
    });
  };
  yv.displayName = fd;
  var vv = "PopperAnchor", bv = w.forwardRef((n, i) => {
    const { __scopePopper: l, virtualRef: o, ...r } = n, d = gv(vv, l), f = w.useRef(null), h = ge(i, f), m = w.useRef(null);
    return w.useEffect(() => {
      const p = m.current;
      m.current = (o == null ? void 0 : o.current) || f.current, p !== m.current && d.onAnchorChange(m.current);
    }), o ? null : S.jsx(Je.div, {
      ...r,
      ref: h
    });
  });
  bv.displayName = vv;
  var dd = "PopperContent", [dw, hw] = mv(dd), xv = w.forwardRef((n, i) => {
    var _a, _b2, _c, _d2, _e2, _f2;
    const { __scopePopper: l, side: o = "bottom", sideOffset: r = 0, align: d = "center", alignOffset: f = 0, arrowPadding: h = 0, avoidCollisions: m = true, collisionBoundary: p = [], collisionPadding: g = 0, sticky: v = "partial", hideWhenDetached: b = false, updatePositionStrategy: T = "optimized", onPlaced: A, ...C } = n, R = gv(dd, l), [O, L] = w.useState(null), z = ge(i, (dt) => L(dt)), [V, q] = w.useState(null), $ = hv(V), X = ($ == null ? void 0 : $.width) ?? 0, G = ($ == null ? void 0 : $.height) ?? 0, tt = o + (d !== "center" ? "-" + d : ""), I = typeof g == "number" ? g : {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      ...g
    }, nt = Array.isArray(p) ? p : [
      p
    ], st = nt.length > 0, gt = {
      padding: I,
      boundary: nt.filter(pw),
      altBoundary: st
    }, { refs: ht, floatingStyles: mt, placement: k, isPositioned: F, middlewareData: Z } = tw({
      strategy: "fixed",
      placement: tt,
      whileElementsMounted: (...dt) => q2(...dt, {
        animationFrame: T === "always"
      }),
      elements: {
        reference: R.anchor
      },
      middleware: [
        nw({
          mainAxis: r + G,
          alignmentAxis: f
        }),
        m && iw({
          mainAxis: true,
          crossAxis: false,
          limiter: v === "partial" ? aw() : void 0,
          ...gt
        }),
        m && sw({
          ...gt
        }),
        lw({
          ...gt,
          apply: ({ elements: dt, rects: Ht, availableWidth: vt, availableHeight: cn }) => {
            const { width: $e, height: un } = Ht.reference, We = dt.floating.style;
            We.setProperty("--radix-popper-available-width", `${vt}px`), We.setProperty("--radix-popper-available-height", `${cn}px`), We.setProperty("--radix-popper-anchor-width", `${$e}px`), We.setProperty("--radix-popper-anchor-height", `${un}px`);
          }
        }),
        V && rw({
          element: V,
          padding: h
        }),
        gw({
          arrowWidth: X,
          arrowHeight: G
        }),
        b && ow({
          strategy: "referenceHidden",
          ...gt
        })
      ]
    }), [it, N] = wv(k), E = mr(A);
    $i(() => {
      F && (E == null ? void 0 : E());
    }, [
      F,
      E
    ]);
    const j = (_a = Z.arrow) == null ? void 0 : _a.x, K = (_b2 = Z.arrow) == null ? void 0 : _b2.y, W = ((_c = Z.arrow) == null ? void 0 : _c.centerOffset) !== 0, [et, at] = w.useState();
    return $i(() => {
      O && at(window.getComputedStyle(O).zIndex);
    }, [
      O
    ]), S.jsx("div", {
      ref: ht.setFloating,
      "data-radix-popper-content-wrapper": "",
      style: {
        ...mt,
        transform: F ? mt.transform : "translate(0, -200%)",
        minWidth: "max-content",
        zIndex: et,
        "--radix-popper-transform-origin": [
          (_d2 = Z.transformOrigin) == null ? void 0 : _d2.x,
          (_e2 = Z.transformOrigin) == null ? void 0 : _e2.y
        ].join(" "),
        ...((_f2 = Z.hide) == null ? void 0 : _f2.referenceHidden) && {
          visibility: "hidden",
          pointerEvents: "none"
        }
      },
      dir: n.dir,
      children: S.jsx(dw, {
        scope: l,
        placedSide: it,
        onArrowChange: q,
        arrowX: j,
        arrowY: K,
        shouldHideArrow: W,
        children: S.jsx(Je.div, {
          "data-side": it,
          "data-align": N,
          ...C,
          ref: z,
          style: {
            ...C.style,
            animation: F ? void 0 : "none"
          }
        })
      })
    });
  });
  xv.displayName = dd;
  var Sv = "PopperArrow", mw = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right"
  }, Tv = w.forwardRef(function(i, l) {
    const { __scopePopper: o, ...r } = i, d = hw(Sv, o), f = mw[d.placedSide];
    return S.jsx("span", {
      ref: d.onArrowChange,
      style: {
        position: "absolute",
        left: d.arrowX,
        top: d.arrowY,
        [f]: 0,
        transformOrigin: {
          top: "",
          right: "0 0",
          bottom: "center 0",
          left: "100% 0"
        }[d.placedSide],
        transform: {
          top: "translateY(100%)",
          right: "translateY(50%) rotate(90deg) translateX(-50%)",
          bottom: "rotate(180deg)",
          left: "translateY(50%) rotate(-90deg) translateX(50%)"
        }[d.placedSide],
        visibility: d.shouldHideArrow ? "hidden" : void 0
      },
      children: S.jsx(uw, {
        ...r,
        ref: l,
        style: {
          ...r.style,
          display: "block"
        }
      })
    });
  });
  Tv.displayName = Sv;
  function pw(n) {
    return n !== null;
  }
  var gw = (n) => ({
    name: "transformOrigin",
    options: n,
    fn(i) {
      var _a, _b2, _c;
      const { placement: l, rects: o, middlewareData: r } = i, f = ((_a = r.arrow) == null ? void 0 : _a.centerOffset) !== 0, h = f ? 0 : n.arrowWidth, m = f ? 0 : n.arrowHeight, [p, g] = wv(l), v = {
        start: "0%",
        center: "50%",
        end: "100%"
      }[g], b = (((_b2 = r.arrow) == null ? void 0 : _b2.x) ?? 0) + h / 2, T = (((_c = r.arrow) == null ? void 0 : _c.y) ?? 0) + m / 2;
      let A = "", C = "";
      return p === "bottom" ? (A = f ? v : `${b}px`, C = `${-m}px`) : p === "top" ? (A = f ? v : `${b}px`, C = `${o.floating.height + m}px`) : p === "right" ? (A = `${-m}px`, C = f ? v : `${T}px`) : p === "left" && (A = `${o.floating.width + m}px`, C = f ? v : `${T}px`), {
        data: {
          x: A,
          y: C
        }
      };
    }
  });
  function wv(n) {
    const [i, l = "center"] = n.split("-");
    return [
      i,
      l
    ];
  }
  var yw = yv, vw = bv, bw = xv, xw = Tv;
  function Sw(n, i) {
    return w.useReducer((l, o) => i[l][o] ?? l, n);
  }
  var Av = (n) => {
    const { present: i, children: l } = n, o = Tw(i), r = typeof l == "function" ? l({
      present: o.isPresent
    }) : w.Children.only(l), d = ge(o.ref, ww(r));
    return typeof l == "function" || o.isPresent ? w.cloneElement(r, {
      ref: d
    }) : null;
  };
  Av.displayName = "Presence";
  function Tw(n) {
    const [i, l] = w.useState(), o = w.useRef(null), r = w.useRef(n), d = w.useRef("none"), f = n ? "mounted" : "unmounted", [h, m] = Sw(f, {
      mounted: {
        UNMOUNT: "unmounted",
        ANIMATION_OUT: "unmountSuspended"
      },
      unmountSuspended: {
        MOUNT: "mounted",
        ANIMATION_END: "unmounted"
      },
      unmounted: {
        MOUNT: "mounted"
      }
    });
    return w.useEffect(() => {
      const p = ko(o.current);
      d.current = h === "mounted" ? p : "none";
    }, [
      h
    ]), $i(() => {
      const p = o.current, g = r.current;
      if (g !== n) {
        const b = d.current, T = ko(p);
        n ? m("MOUNT") : T === "none" || (p == null ? void 0 : p.display) === "none" ? m("UNMOUNT") : m(g && b !== T ? "ANIMATION_OUT" : "UNMOUNT"), r.current = n;
      }
    }, [
      n,
      m
    ]), $i(() => {
      if (i) {
        let p;
        const g = i.ownerDocument.defaultView ?? window, v = (T) => {
          const C = ko(o.current).includes(CSS.escape(T.animationName));
          if (T.target === i && C && (m("ANIMATION_END"), !r.current)) {
            const R = i.style.animationFillMode;
            i.style.animationFillMode = "forwards", p = g.setTimeout(() => {
              i.style.animationFillMode === "forwards" && (i.style.animationFillMode = R);
            });
          }
        }, b = (T) => {
          T.target === i && (d.current = ko(o.current));
        };
        return i.addEventListener("animationstart", b), i.addEventListener("animationcancel", v), i.addEventListener("animationend", v), () => {
          g.clearTimeout(p), i.removeEventListener("animationstart", b), i.removeEventListener("animationcancel", v), i.removeEventListener("animationend", v);
        };
      } else m("ANIMATION_END");
    }, [
      i,
      m
    ]), {
      isPresent: [
        "mounted",
        "unmountSuspended"
      ].includes(h),
      ref: w.useCallback((p) => {
        o.current = p ? getComputedStyle(p) : null, l(p);
      }, [])
    };
  }
  function ko(n) {
    return (n == null ? void 0 : n.animationName) || "none";
  }
  function ww(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  var Aw = id[" useInsertionEffect ".trim().toString()] || $i;
  function Ev({ prop: n, defaultProp: i, onChange: l = () => {
  }, caller: o }) {
    const [r, d, f] = Ew({
      defaultProp: i,
      onChange: l
    }), h = n !== void 0, m = h ? n : r;
    {
      const g = w.useRef(n !== void 0);
      w.useEffect(() => {
        const v = g.current;
        v !== h && console.warn(`${o} is changing from ${v ? "controlled" : "uncontrolled"} to ${h ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`), g.current = h;
      }, [
        h,
        o
      ]);
    }
    const p = w.useCallback((g) => {
      var _a;
      if (h) {
        const v = Cw(g) ? g(n) : g;
        v !== n && ((_a = f.current) == null ? void 0 : _a.call(f, v));
      } else d(g);
    }, [
      h,
      n,
      d,
      f
    ]);
    return [
      m,
      p
    ];
  }
  function Ew({ defaultProp: n, onChange: i }) {
    const [l, o] = w.useState(n), r = w.useRef(l), d = w.useRef(i);
    return Aw(() => {
      d.current = i;
    }, [
      i
    ]), w.useEffect(() => {
      var _a;
      r.current !== l && ((_a = d.current) == null ? void 0 : _a.call(d, l), r.current = l);
    }, [
      l,
      r
    ]), [
      l,
      o,
      d
    ];
  }
  function Cw(n) {
    return typeof n == "function";
  }
  var Mw = Object.freeze({
    position: "absolute",
    border: 0,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    wordWrap: "normal"
  }), Rw = "VisuallyHidden", Cv = w.forwardRef((n, i) => S.jsx(Je.span, {
    ...n,
    ref: i,
    style: {
      ...Mw,
      ...n.style
    }
  }));
  Cv.displayName = Rw;
  var Dw = Cv, [br] = hr("Tooltip", [
    pv
  ]), xr = pv(), Mv = "TooltipProvider", Ow = 700, Ef = "tooltip.open", [jw, hd] = br(Mv), Rv = (n) => {
    const { __scopeTooltip: i, delayDuration: l = Ow, skipDelayDuration: o = 300, disableHoverableContent: r = false, children: d } = n, f = w.useRef(true), h = w.useRef(false), m = w.useRef(0);
    return w.useEffect(() => {
      const p = m.current;
      return () => window.clearTimeout(p);
    }, []), S.jsx(jw, {
      scope: i,
      isOpenDelayedRef: f,
      delayDuration: l,
      onOpen: w.useCallback(() => {
        window.clearTimeout(m.current), f.current = false;
      }, []),
      onClose: w.useCallback(() => {
        window.clearTimeout(m.current), m.current = window.setTimeout(() => f.current = true, o);
      }, [
        o
      ]),
      isPointerInTransitRef: h,
      onPointerInTransitChange: w.useCallback((p) => {
        h.current = p;
      }, []),
      disableHoverableContent: r,
      children: d
    });
  };
  Rv.displayName = Mv;
  var ol = "Tooltip", [Nw, Sr] = br(ol), Dv = (n) => {
    const { __scopeTooltip: i, children: l, open: o, defaultOpen: r, onOpenChange: d, disableHoverableContent: f, delayDuration: h } = n, m = hd(ol, n.__scopeTooltip), p = xr(i), [g, v] = w.useState(null), b = a2(), T = w.useRef(0), A = f ?? m.disableHoverableContent, C = h ?? m.delayDuration, R = w.useRef(false), [O, L] = Ev({
      prop: o,
      defaultProp: r ?? false,
      onChange: (X) => {
        X ? (m.onOpen(), document.dispatchEvent(new CustomEvent(Ef))) : m.onClose(), d == null ? void 0 : d(X);
      },
      caller: ol
    }), z = w.useMemo(() => O ? R.current ? "delayed-open" : "instant-open" : "closed", [
      O
    ]), V = w.useCallback(() => {
      window.clearTimeout(T.current), T.current = 0, R.current = false, L(true);
    }, [
      L
    ]), q = w.useCallback(() => {
      window.clearTimeout(T.current), T.current = 0, L(false);
    }, [
      L
    ]), $ = w.useCallback(() => {
      window.clearTimeout(T.current), T.current = window.setTimeout(() => {
        R.current = true, L(true), T.current = 0;
      }, C);
    }, [
      C,
      L
    ]);
    return w.useEffect(() => () => {
      T.current && (window.clearTimeout(T.current), T.current = 0);
    }, []), S.jsx(yw, {
      ...p,
      children: S.jsx(Nw, {
        scope: i,
        contentId: b,
        open: O,
        stateAttribute: z,
        trigger: g,
        onTriggerChange: v,
        onTriggerEnter: w.useCallback(() => {
          m.isOpenDelayedRef.current ? $() : V();
        }, [
          m.isOpenDelayedRef,
          $,
          V
        ]),
        onTriggerLeave: w.useCallback(() => {
          A ? q() : (window.clearTimeout(T.current), T.current = 0);
        }, [
          q,
          A
        ]),
        onOpen: V,
        onClose: q,
        disableHoverableContent: A,
        children: l
      })
    });
  };
  Dv.displayName = ol;
  var Cf = "TooltipTrigger", Ov = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, ...o } = n, r = Sr(Cf, l), d = hd(Cf, l), f = xr(l), h = w.useRef(null), m = ge(i, h, r.onTriggerChange), p = w.useRef(false), g = w.useRef(false), v = w.useCallback(() => p.current = false, []);
    return w.useEffect(() => () => document.removeEventListener("pointerup", v), [
      v
    ]), S.jsx(vw, {
      asChild: true,
      ...f,
      children: S.jsx(Je.button, {
        "aria-describedby": r.open ? r.contentId : void 0,
        "data-state": r.stateAttribute,
        ...o,
        ref: m,
        onPointerMove: he(n.onPointerMove, (b) => {
          b.pointerType !== "touch" && !g.current && !d.isPointerInTransitRef.current && (r.onTriggerEnter(), g.current = true);
        }),
        onPointerLeave: he(n.onPointerLeave, () => {
          r.onTriggerLeave(), g.current = false;
        }),
        onPointerDown: he(n.onPointerDown, () => {
          r.open && r.onClose(), p.current = true, document.addEventListener("pointerup", v, {
            once: true
          });
        }),
        onFocus: he(n.onFocus, () => {
          p.current || r.onOpen();
        }),
        onBlur: he(n.onBlur, r.onClose),
        onClick: he(n.onClick, r.onClose)
      })
    });
  });
  Ov.displayName = Cf;
  var zw = "TooltipPortal", [IO, _w] = br(zw, {
    forceMount: void 0
  }), Fa = "TooltipContent", jv = w.forwardRef((n, i) => {
    const l = _w(Fa, n.__scopeTooltip), { forceMount: o = l.forceMount, side: r = "top", ...d } = n, f = Sr(Fa, n.__scopeTooltip);
    return S.jsx(Av, {
      present: o || f.open,
      children: f.disableHoverableContent ? S.jsx(Nv, {
        side: r,
        ...d,
        ref: i
      }) : S.jsx(Vw, {
        side: r,
        ...d,
        ref: i
      })
    });
  }), Vw = w.forwardRef((n, i) => {
    const l = Sr(Fa, n.__scopeTooltip), o = hd(Fa, n.__scopeTooltip), r = w.useRef(null), d = ge(i, r), [f, h] = w.useState(null), { trigger: m, onClose: p } = l, g = r.current, { onPointerInTransitChange: v } = o, b = w.useCallback(() => {
      h(null), v(false);
    }, [
      v
    ]), T = w.useCallback((A, C) => {
      const R = A.currentTarget, O = {
        x: A.clientX,
        y: A.clientY
      }, L = Hw(O, R.getBoundingClientRect()), z = Gw(O, L), V = Yw(C.getBoundingClientRect()), q = qw([
        ...z,
        ...V
      ]);
      h(q), v(true);
    }, [
      v
    ]);
    return w.useEffect(() => () => b(), [
      b
    ]), w.useEffect(() => {
      if (m && g) {
        const A = (R) => T(R, g), C = (R) => T(R, m);
        return m.addEventListener("pointerleave", A), g.addEventListener("pointerleave", C), () => {
          m.removeEventListener("pointerleave", A), g.removeEventListener("pointerleave", C);
        };
      }
    }, [
      m,
      g,
      T,
      b
    ]), w.useEffect(() => {
      if (f) {
        const A = (C) => {
          const R = C.target, O = {
            x: C.clientX,
            y: C.clientY
          }, L = (m == null ? void 0 : m.contains(R)) || (g == null ? void 0 : g.contains(R)), z = !Pw(O, f);
          L ? b() : z && (b(), p());
        };
        return document.addEventListener("pointermove", A), () => document.removeEventListener("pointermove", A);
      }
    }, [
      m,
      g,
      f,
      p,
      b
    ]), S.jsx(Nv, {
      ...n,
      ref: d
    });
  }), [kw, Lw] = br(ol, {
    isInside: false
  }), Bw = YT("TooltipContent"), Nv = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, children: o, "aria-label": r, onEscapeKeyDown: d, onPointerDownOutside: f, ...h } = n, m = Sr(Fa, l), p = xr(l), { onClose: g } = m;
    return w.useEffect(() => (document.addEventListener(Ef, g), () => document.removeEventListener(Ef, g)), [
      g
    ]), w.useEffect(() => {
      if (m.trigger) {
        const v = (b) => {
          var _a;
          ((_a = b.target) == null ? void 0 : _a.contains(m.trigger)) && g();
        };
        return window.addEventListener("scroll", v, {
          capture: true
        }), () => window.removeEventListener("scroll", v, {
          capture: true
        });
      }
    }, [
      m.trigger,
      g
    ]), S.jsx(I0, {
      asChild: true,
      disableOutsidePointerEvents: false,
      onEscapeKeyDown: d,
      onPointerDownOutside: f,
      onFocusOutside: (v) => v.preventDefault(),
      onDismiss: g,
      children: S.jsxs(bw, {
        "data-state": m.stateAttribute,
        ...p,
        ...h,
        ref: i,
        style: {
          ...h.style,
          "--radix-tooltip-content-transform-origin": "var(--radix-popper-transform-origin)",
          "--radix-tooltip-content-available-width": "var(--radix-popper-available-width)",
          "--radix-tooltip-content-available-height": "var(--radix-popper-available-height)",
          "--radix-tooltip-trigger-width": "var(--radix-popper-anchor-width)",
          "--radix-tooltip-trigger-height": "var(--radix-popper-anchor-height)"
        },
        children: [
          S.jsx(Bw, {
            children: o
          }),
          S.jsx(kw, {
            scope: l,
            isInside: true,
            children: S.jsx(Dw, {
              id: m.contentId,
              role: "tooltip",
              children: r || o
            })
          })
        ]
      })
    });
  });
  jv.displayName = Fa;
  var zv = "TooltipArrow", Uw = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, ...o } = n, r = xr(l);
    return Lw(zv, l).isInside ? null : S.jsx(xw, {
      ...r,
      ...o,
      ref: i
    });
  });
  Uw.displayName = zv;
  function Hw(n, i) {
    const l = Math.abs(i.top - n.y), o = Math.abs(i.bottom - n.y), r = Math.abs(i.right - n.x), d = Math.abs(i.left - n.x);
    switch (Math.min(l, o, r, d)) {
      case d:
        return "left";
      case r:
        return "right";
      case l:
        return "top";
      case o:
        return "bottom";
      default:
        throw new Error("unreachable");
    }
  }
  function Gw(n, i, l = 5) {
    const o = [];
    switch (i) {
      case "top":
        o.push({
          x: n.x - l,
          y: n.y + l
        }, {
          x: n.x + l,
          y: n.y + l
        });
        break;
      case "bottom":
        o.push({
          x: n.x - l,
          y: n.y - l
        }, {
          x: n.x + l,
          y: n.y - l
        });
        break;
      case "left":
        o.push({
          x: n.x + l,
          y: n.y - l
        }, {
          x: n.x + l,
          y: n.y + l
        });
        break;
      case "right":
        o.push({
          x: n.x - l,
          y: n.y - l
        }, {
          x: n.x - l,
          y: n.y + l
        });
        break;
    }
    return o;
  }
  function Yw(n) {
    const { top: i, right: l, bottom: o, left: r } = n;
    return [
      {
        x: r,
        y: i
      },
      {
        x: l,
        y: i
      },
      {
        x: l,
        y: o
      },
      {
        x: r,
        y: o
      }
    ];
  }
  function Pw(n, i) {
    const { x: l, y: o } = n;
    let r = false;
    for (let d = 0, f = i.length - 1; d < i.length; f = d++) {
      const h = i[d], m = i[f], p = h.x, g = h.y, v = m.x, b = m.y;
      g > o != b > o && l < (v - p) * (o - g) / (b - g) + p && (r = !r);
    }
    return r;
  }
  function qw(n) {
    const i = n.slice();
    return i.sort((l, o) => l.x < o.x ? -1 : l.x > o.x ? 1 : l.y < o.y ? -1 : l.y > o.y ? 1 : 0), Xw(i);
  }
  function Xw(n) {
    if (n.length <= 1) return n.slice();
    const i = [];
    for (let o = 0; o < n.length; o++) {
      const r = n[o];
      for (; i.length >= 2; ) {
        const d = i[i.length - 1], f = i[i.length - 2];
        if ((d.x - f.x) * (r.y - f.y) >= (d.y - f.y) * (r.x - f.x)) i.pop();
        else break;
      }
      i.push(r);
    }
    i.pop();
    const l = [];
    for (let o = n.length - 1; o >= 0; o--) {
      const r = n[o];
      for (; l.length >= 2; ) {
        const d = l[l.length - 1], f = l[l.length - 2];
        if ((d.x - f.x) * (r.y - f.y) >= (d.y - f.y) * (r.x - f.x)) l.pop();
        else break;
      }
      l.push(r);
    }
    return l.pop(), i.length === 1 && l.length === 1 && i[0].x === l[0].x && i[0].y === l[0].y ? i : i.concat(l);
  }
  var Kw = Rv, Zw = Dv, Qw = Ov, _v = jv;
  function Vv(n) {
    var i, l, o = "";
    if (typeof n == "string" || typeof n == "number") o += n;
    else if (typeof n == "object") if (Array.isArray(n)) {
      var r = n.length;
      for (i = 0; i < r; i++) n[i] && (l = Vv(n[i])) && (o && (o += " "), o += l);
    } else for (l in n) n[l] && (o && (o += " "), o += l);
    return o;
  }
  function kv() {
    for (var n, i, l = 0, o = "", r = arguments.length; l < r; l++) (n = arguments[l]) && (i = Vv(n)) && (o && (o += " "), o += i);
    return o;
  }
  const Fw = (n, i) => {
    const l = new Array(n.length + i.length);
    for (let o = 0; o < n.length; o++) l[o] = n[o];
    for (let o = 0; o < i.length; o++) l[n.length + o] = i[o];
    return l;
  }, Jw = (n, i) => ({
    classGroupId: n,
    validator: i
  }), Lv = (n = /* @__PURE__ */ new Map(), i = null, l) => ({
    nextPart: n,
    validators: i,
    classGroupId: l
  }), ir = "-", xy = [], $w = "arbitrary..", Ww = (n) => {
    const i = tA(n), { conflictingClassGroups: l, conflictingClassGroupModifiers: o } = n;
    return {
      getClassGroupId: (f) => {
        if (f.startsWith("[") && f.endsWith("]")) return Iw(f);
        const h = f.split(ir), m = h[0] === "" && h.length > 1 ? 1 : 0;
        return Bv(h, m, i);
      },
      getConflictingClassGroupIds: (f, h) => {
        if (h) {
          const m = o[f], p = l[f];
          return m ? p ? Fw(p, m) : m : p || xy;
        }
        return l[f] || xy;
      }
    };
  }, Bv = (n, i, l) => {
    if (n.length - i === 0) return l.classGroupId;
    const r = n[i], d = l.nextPart.get(r);
    if (d) {
      const p = Bv(n, i + 1, d);
      if (p) return p;
    }
    const f = l.validators;
    if (f === null) return;
    const h = i === 0 ? n.join(ir) : n.slice(i).join(ir), m = f.length;
    for (let p = 0; p < m; p++) {
      const g = f[p];
      if (g.validator(h)) return g.classGroupId;
    }
  }, Iw = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
    const i = n.slice(1, -1), l = i.indexOf(":"), o = i.slice(0, l);
    return o ? $w + o : void 0;
  })(), tA = (n) => {
    const { theme: i, classGroups: l } = n;
    return eA(l, i);
  }, eA = (n, i) => {
    const l = Lv();
    for (const o in n) {
      const r = n[o];
      md(r, l, o, i);
    }
    return l;
  }, md = (n, i, l, o) => {
    const r = n.length;
    for (let d = 0; d < r; d++) {
      const f = n[d];
      nA(f, i, l, o);
    }
  }, nA = (n, i, l, o) => {
    if (typeof n == "string") {
      iA(n, i, l);
      return;
    }
    if (typeof n == "function") {
      aA(n, i, l, o);
      return;
    }
    sA(n, i, l, o);
  }, iA = (n, i, l) => {
    const o = n === "" ? i : Uv(i, n);
    o.classGroupId = l;
  }, aA = (n, i, l, o) => {
    if (lA(n)) {
      md(n(o), i, l, o);
      return;
    }
    i.validators === null && (i.validators = []), i.validators.push(Jw(l, n));
  }, sA = (n, i, l, o) => {
    const r = Object.entries(n), d = r.length;
    for (let f = 0; f < d; f++) {
      const [h, m] = r[f];
      md(m, Uv(i, h), l, o);
    }
  }, Uv = (n, i) => {
    let l = n;
    const o = i.split(ir), r = o.length;
    for (let d = 0; d < r; d++) {
      const f = o[d];
      let h = l.nextPart.get(f);
      h || (h = Lv(), l.nextPart.set(f, h)), l = h;
    }
    return l;
  }, lA = (n) => "isThemeGetter" in n && n.isThemeGetter === true, oA = (n) => {
    if (n < 1) return {
      get: () => {
      },
      set: () => {
      }
    };
    let i = 0, l = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
    const r = (d, f) => {
      l[d] = f, i++, i > n && (i = 0, o = l, l = /* @__PURE__ */ Object.create(null));
    };
    return {
      get(d) {
        let f = l[d];
        if (f !== void 0) return f;
        if ((f = o[d]) !== void 0) return r(d, f), f;
      },
      set(d, f) {
        d in l ? l[d] = f : r(d, f);
      }
    };
  }, Mf = "!", Sy = ":", rA = [], Ty = (n, i, l, o, r) => ({
    modifiers: n,
    hasImportantModifier: i,
    baseClassName: l,
    maybePostfixModifierPosition: o,
    isExternal: r
  }), cA = (n) => {
    const { prefix: i, experimentalParseClassName: l } = n;
    let o = (r) => {
      const d = [];
      let f = 0, h = 0, m = 0, p;
      const g = r.length;
      for (let C = 0; C < g; C++) {
        const R = r[C];
        if (f === 0 && h === 0) {
          if (R === Sy) {
            d.push(r.slice(m, C)), m = C + 1;
            continue;
          }
          if (R === "/") {
            p = C;
            continue;
          }
        }
        R === "[" ? f++ : R === "]" ? f-- : R === "(" ? h++ : R === ")" && h--;
      }
      const v = d.length === 0 ? r : r.slice(m);
      let b = v, T = false;
      v.endsWith(Mf) ? (b = v.slice(0, -1), T = true) : v.startsWith(Mf) && (b = v.slice(1), T = true);
      const A = p && p > m ? p - m : void 0;
      return Ty(d, T, b, A);
    };
    if (i) {
      const r = i + Sy, d = o;
      o = (f) => f.startsWith(r) ? d(f.slice(r.length)) : Ty(rA, false, f, void 0, true);
    }
    if (l) {
      const r = o;
      o = (d) => l({
        className: d,
        parseClassName: r
      });
    }
    return o;
  }, uA = (n) => {
    const i = /* @__PURE__ */ new Map();
    return n.orderSensitiveModifiers.forEach((l, o) => {
      i.set(l, 1e6 + o);
    }), (l) => {
      const o = [];
      let r = [];
      for (let d = 0; d < l.length; d++) {
        const f = l[d], h = f[0] === "[", m = i.has(f);
        h || m ? (r.length > 0 && (r.sort(), o.push(...r), r = []), o.push(f)) : r.push(f);
      }
      return r.length > 0 && (r.sort(), o.push(...r)), o;
    };
  }, fA = (n) => ({
    cache: oA(n.cacheSize),
    parseClassName: cA(n),
    sortModifiers: uA(n),
    ...Ww(n)
  }), dA = /\s+/, hA = (n, i) => {
    const { parseClassName: l, getClassGroupId: o, getConflictingClassGroupIds: r, sortModifiers: d } = i, f = [], h = n.trim().split(dA);
    let m = "";
    for (let p = h.length - 1; p >= 0; p -= 1) {
      const g = h[p], { isExternal: v, modifiers: b, hasImportantModifier: T, baseClassName: A, maybePostfixModifierPosition: C } = l(g);
      if (v) {
        m = g + (m.length > 0 ? " " + m : m);
        continue;
      }
      let R = !!C, O = o(R ? A.substring(0, C) : A);
      if (!O) {
        if (!R) {
          m = g + (m.length > 0 ? " " + m : m);
          continue;
        }
        if (O = o(A), !O) {
          m = g + (m.length > 0 ? " " + m : m);
          continue;
        }
        R = false;
      }
      const L = b.length === 0 ? "" : b.length === 1 ? b[0] : d(b).join(":"), z = T ? L + Mf : L, V = z + O;
      if (f.indexOf(V) > -1) continue;
      f.push(V);
      const q = r(O, R);
      for (let $ = 0; $ < q.length; ++$) {
        const X = q[$];
        f.push(z + X);
      }
      m = g + (m.length > 0 ? " " + m : m);
    }
    return m;
  }, mA = (...n) => {
    let i = 0, l, o, r = "";
    for (; i < n.length; ) (l = n[i++]) && (o = Hv(l)) && (r && (r += " "), r += o);
    return r;
  }, Hv = (n) => {
    if (typeof n == "string") return n;
    let i, l = "";
    for (let o = 0; o < n.length; o++) n[o] && (i = Hv(n[o])) && (l && (l += " "), l += i);
    return l;
  }, pA = (n, ...i) => {
    let l, o, r, d;
    const f = (m) => {
      const p = i.reduce((g, v) => v(g), n());
      return l = fA(p), o = l.cache.get, r = l.cache.set, d = h, h(m);
    }, h = (m) => {
      const p = o(m);
      if (p) return p;
      const g = hA(m, l);
      return r(m, g), g;
    };
    return d = f, (...m) => d(mA(...m));
  }, gA = [], te = (n) => {
    const i = (l) => l[n] || gA;
    return i.isThemeGetter = true, i;
  }, Gv = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Yv = /^\((?:(\w[\w-]*):)?(.+)\)$/i, yA = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, vA = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, bA = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, xA = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, SA = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, TA = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, pi = (n) => yA.test(n), St = (n) => !!n && !Number.isNaN(Number(n)), gi = (n) => !!n && Number.isInteger(Number(n)), tf = (n) => n.endsWith("%") && St(n.slice(0, -1)), Hn = (n) => vA.test(n), Pv = () => true, wA = (n) => bA.test(n) && !xA.test(n), pd = () => false, AA = (n) => SA.test(n), EA = (n) => TA.test(n), CA = (n) => !ot(n) && !ct(n), MA = (n) => wi(n, Kv, pd), ot = (n) => Gv.test(n), qi = (n) => wi(n, Zv, wA), wy = (n) => wi(n, VA, St), RA = (n) => wi(n, Fv, Pv), DA = (n) => wi(n, Qv, pd), Ay = (n) => wi(n, qv, pd), OA = (n) => wi(n, Xv, EA), Lo = (n) => wi(n, Jv, AA), ct = (n) => Yv.test(n), Is = (n) => Ii(n, Zv), jA = (n) => Ii(n, Qv), Ey = (n) => Ii(n, qv), NA = (n) => Ii(n, Kv), zA = (n) => Ii(n, Xv), Bo = (n) => Ii(n, Jv, true), _A = (n) => Ii(n, Fv, true), wi = (n, i, l) => {
    const o = Gv.exec(n);
    return o ? o[1] ? i(o[1]) : l(o[2]) : false;
  }, Ii = (n, i, l = false) => {
    const o = Yv.exec(n);
    return o ? o[1] ? i(o[1]) : l : false;
  }, qv = (n) => n === "position" || n === "percentage", Xv = (n) => n === "image" || n === "url", Kv = (n) => n === "length" || n === "size" || n === "bg-size", Zv = (n) => n === "length", VA = (n) => n === "number", Qv = (n) => n === "family-name", Fv = (n) => n === "number" || n === "weight", Jv = (n) => n === "shadow", kA = () => {
    const n = te("color"), i = te("font"), l = te("text"), o = te("font-weight"), r = te("tracking"), d = te("leading"), f = te("breakpoint"), h = te("container"), m = te("spacing"), p = te("radius"), g = te("shadow"), v = te("inset-shadow"), b = te("text-shadow"), T = te("drop-shadow"), A = te("blur"), C = te("perspective"), R = te("aspect"), O = te("ease"), L = te("animate"), z = () => [
      "auto",
      "avoid",
      "all",
      "avoid-page",
      "page",
      "left",
      "right",
      "column"
    ], V = () => [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      "left-top",
      "top-right",
      "right-top",
      "bottom-right",
      "right-bottom",
      "bottom-left",
      "left-bottom"
    ], q = () => [
      ...V(),
      ct,
      ot
    ], $ = () => [
      "auto",
      "hidden",
      "clip",
      "visible",
      "scroll"
    ], X = () => [
      "auto",
      "contain",
      "none"
    ], G = () => [
      ct,
      ot,
      m
    ], tt = () => [
      pi,
      "full",
      "auto",
      ...G()
    ], I = () => [
      gi,
      "none",
      "subgrid",
      ct,
      ot
    ], nt = () => [
      "auto",
      {
        span: [
          "full",
          gi,
          ct,
          ot
        ]
      },
      gi,
      ct,
      ot
    ], st = () => [
      gi,
      "auto",
      ct,
      ot
    ], gt = () => [
      "auto",
      "min",
      "max",
      "fr",
      ct,
      ot
    ], ht = () => [
      "start",
      "end",
      "center",
      "between",
      "around",
      "evenly",
      "stretch",
      "baseline",
      "center-safe",
      "end-safe"
    ], mt = () => [
      "start",
      "end",
      "center",
      "stretch",
      "center-safe",
      "end-safe"
    ], k = () => [
      "auto",
      ...G()
    ], F = () => [
      pi,
      "auto",
      "full",
      "dvw",
      "dvh",
      "lvw",
      "lvh",
      "svw",
      "svh",
      "min",
      "max",
      "fit",
      ...G()
    ], Z = () => [
      pi,
      "screen",
      "full",
      "dvw",
      "lvw",
      "svw",
      "min",
      "max",
      "fit",
      ...G()
    ], it = () => [
      pi,
      "screen",
      "full",
      "lh",
      "dvh",
      "lvh",
      "svh",
      "min",
      "max",
      "fit",
      ...G()
    ], N = () => [
      n,
      ct,
      ot
    ], E = () => [
      ...V(),
      Ey,
      Ay,
      {
        position: [
          ct,
          ot
        ]
      }
    ], j = () => [
      "no-repeat",
      {
        repeat: [
          "",
          "x",
          "y",
          "space",
          "round"
        ]
      }
    ], K = () => [
      "auto",
      "cover",
      "contain",
      NA,
      MA,
      {
        size: [
          ct,
          ot
        ]
      }
    ], W = () => [
      tf,
      Is,
      qi
    ], et = () => [
      "",
      "none",
      "full",
      p,
      ct,
      ot
    ], at = () => [
      "",
      St,
      Is,
      qi
    ], dt = () => [
      "solid",
      "dashed",
      "dotted",
      "double"
    ], Ht = () => [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
      "hue",
      "saturation",
      "color",
      "luminosity"
    ], vt = () => [
      St,
      tf,
      Ey,
      Ay
    ], cn = () => [
      "",
      "none",
      A,
      ct,
      ot
    ], $e = () => [
      "none",
      St,
      ct,
      ot
    ], un = () => [
      "none",
      St,
      ct,
      ot
    ], We = () => [
      St,
      ct,
      ot
    ], Le = () => [
      pi,
      "full",
      ...G()
    ];
    return {
      cacheSize: 500,
      theme: {
        animate: [
          "spin",
          "ping",
          "pulse",
          "bounce"
        ],
        aspect: [
          "video"
        ],
        blur: [
          Hn
        ],
        breakpoint: [
          Hn
        ],
        color: [
          Pv
        ],
        container: [
          Hn
        ],
        "drop-shadow": [
          Hn
        ],
        ease: [
          "in",
          "out",
          "in-out"
        ],
        font: [
          CA
        ],
        "font-weight": [
          "thin",
          "extralight",
          "light",
          "normal",
          "medium",
          "semibold",
          "bold",
          "extrabold",
          "black"
        ],
        "inset-shadow": [
          Hn
        ],
        leading: [
          "none",
          "tight",
          "snug",
          "normal",
          "relaxed",
          "loose"
        ],
        perspective: [
          "dramatic",
          "near",
          "normal",
          "midrange",
          "distant",
          "none"
        ],
        radius: [
          Hn
        ],
        shadow: [
          Hn
        ],
        spacing: [
          "px",
          St
        ],
        text: [
          Hn
        ],
        "text-shadow": [
          Hn
        ],
        tracking: [
          "tighter",
          "tight",
          "normal",
          "wide",
          "wider",
          "widest"
        ]
      },
      classGroups: {
        aspect: [
          {
            aspect: [
              "auto",
              "square",
              pi,
              ot,
              ct,
              R
            ]
          }
        ],
        container: [
          "container"
        ],
        columns: [
          {
            columns: [
              St,
              ot,
              ct,
              h
            ]
          }
        ],
        "break-after": [
          {
            "break-after": z()
          }
        ],
        "break-before": [
          {
            "break-before": z()
          }
        ],
        "break-inside": [
          {
            "break-inside": [
              "auto",
              "avoid",
              "avoid-page",
              "avoid-column"
            ]
          }
        ],
        "box-decoration": [
          {
            "box-decoration": [
              "slice",
              "clone"
            ]
          }
        ],
        box: [
          {
            box: [
              "border",
              "content"
            ]
          }
        ],
        display: [
          "block",
          "inline-block",
          "inline",
          "flex",
          "inline-flex",
          "table",
          "inline-table",
          "table-caption",
          "table-cell",
          "table-column",
          "table-column-group",
          "table-footer-group",
          "table-header-group",
          "table-row-group",
          "table-row",
          "flow-root",
          "grid",
          "inline-grid",
          "contents",
          "list-item",
          "hidden"
        ],
        sr: [
          "sr-only",
          "not-sr-only"
        ],
        float: [
          {
            float: [
              "right",
              "left",
              "none",
              "start",
              "end"
            ]
          }
        ],
        clear: [
          {
            clear: [
              "left",
              "right",
              "both",
              "none",
              "start",
              "end"
            ]
          }
        ],
        isolation: [
          "isolate",
          "isolation-auto"
        ],
        "object-fit": [
          {
            object: [
              "contain",
              "cover",
              "fill",
              "none",
              "scale-down"
            ]
          }
        ],
        "object-position": [
          {
            object: q()
          }
        ],
        overflow: [
          {
            overflow: $()
          }
        ],
        "overflow-x": [
          {
            "overflow-x": $()
          }
        ],
        "overflow-y": [
          {
            "overflow-y": $()
          }
        ],
        overscroll: [
          {
            overscroll: X()
          }
        ],
        "overscroll-x": [
          {
            "overscroll-x": X()
          }
        ],
        "overscroll-y": [
          {
            "overscroll-y": X()
          }
        ],
        position: [
          "static",
          "fixed",
          "absolute",
          "relative",
          "sticky"
        ],
        inset: [
          {
            inset: tt()
          }
        ],
        "inset-x": [
          {
            "inset-x": tt()
          }
        ],
        "inset-y": [
          {
            "inset-y": tt()
          }
        ],
        start: [
          {
            "inset-s": tt(),
            start: tt()
          }
        ],
        end: [
          {
            "inset-e": tt(),
            end: tt()
          }
        ],
        "inset-bs": [
          {
            "inset-bs": tt()
          }
        ],
        "inset-be": [
          {
            "inset-be": tt()
          }
        ],
        top: [
          {
            top: tt()
          }
        ],
        right: [
          {
            right: tt()
          }
        ],
        bottom: [
          {
            bottom: tt()
          }
        ],
        left: [
          {
            left: tt()
          }
        ],
        visibility: [
          "visible",
          "invisible",
          "collapse"
        ],
        z: [
          {
            z: [
              gi,
              "auto",
              ct,
              ot
            ]
          }
        ],
        basis: [
          {
            basis: [
              pi,
              "full",
              "auto",
              h,
              ...G()
            ]
          }
        ],
        "flex-direction": [
          {
            flex: [
              "row",
              "row-reverse",
              "col",
              "col-reverse"
            ]
          }
        ],
        "flex-wrap": [
          {
            flex: [
              "nowrap",
              "wrap",
              "wrap-reverse"
            ]
          }
        ],
        flex: [
          {
            flex: [
              St,
              pi,
              "auto",
              "initial",
              "none",
              ot
            ]
          }
        ],
        grow: [
          {
            grow: [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        shrink: [
          {
            shrink: [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        order: [
          {
            order: [
              gi,
              "first",
              "last",
              "none",
              ct,
              ot
            ]
          }
        ],
        "grid-cols": [
          {
            "grid-cols": I()
          }
        ],
        "col-start-end": [
          {
            col: nt()
          }
        ],
        "col-start": [
          {
            "col-start": st()
          }
        ],
        "col-end": [
          {
            "col-end": st()
          }
        ],
        "grid-rows": [
          {
            "grid-rows": I()
          }
        ],
        "row-start-end": [
          {
            row: nt()
          }
        ],
        "row-start": [
          {
            "row-start": st()
          }
        ],
        "row-end": [
          {
            "row-end": st()
          }
        ],
        "grid-flow": [
          {
            "grid-flow": [
              "row",
              "col",
              "dense",
              "row-dense",
              "col-dense"
            ]
          }
        ],
        "auto-cols": [
          {
            "auto-cols": gt()
          }
        ],
        "auto-rows": [
          {
            "auto-rows": gt()
          }
        ],
        gap: [
          {
            gap: G()
          }
        ],
        "gap-x": [
          {
            "gap-x": G()
          }
        ],
        "gap-y": [
          {
            "gap-y": G()
          }
        ],
        "justify-content": [
          {
            justify: [
              ...ht(),
              "normal"
            ]
          }
        ],
        "justify-items": [
          {
            "justify-items": [
              ...mt(),
              "normal"
            ]
          }
        ],
        "justify-self": [
          {
            "justify-self": [
              "auto",
              ...mt()
            ]
          }
        ],
        "align-content": [
          {
            content: [
              "normal",
              ...ht()
            ]
          }
        ],
        "align-items": [
          {
            items: [
              ...mt(),
              {
                baseline: [
                  "",
                  "last"
                ]
              }
            ]
          }
        ],
        "align-self": [
          {
            self: [
              "auto",
              ...mt(),
              {
                baseline: [
                  "",
                  "last"
                ]
              }
            ]
          }
        ],
        "place-content": [
          {
            "place-content": ht()
          }
        ],
        "place-items": [
          {
            "place-items": [
              ...mt(),
              "baseline"
            ]
          }
        ],
        "place-self": [
          {
            "place-self": [
              "auto",
              ...mt()
            ]
          }
        ],
        p: [
          {
            p: G()
          }
        ],
        px: [
          {
            px: G()
          }
        ],
        py: [
          {
            py: G()
          }
        ],
        ps: [
          {
            ps: G()
          }
        ],
        pe: [
          {
            pe: G()
          }
        ],
        pbs: [
          {
            pbs: G()
          }
        ],
        pbe: [
          {
            pbe: G()
          }
        ],
        pt: [
          {
            pt: G()
          }
        ],
        pr: [
          {
            pr: G()
          }
        ],
        pb: [
          {
            pb: G()
          }
        ],
        pl: [
          {
            pl: G()
          }
        ],
        m: [
          {
            m: k()
          }
        ],
        mx: [
          {
            mx: k()
          }
        ],
        my: [
          {
            my: k()
          }
        ],
        ms: [
          {
            ms: k()
          }
        ],
        me: [
          {
            me: k()
          }
        ],
        mbs: [
          {
            mbs: k()
          }
        ],
        mbe: [
          {
            mbe: k()
          }
        ],
        mt: [
          {
            mt: k()
          }
        ],
        mr: [
          {
            mr: k()
          }
        ],
        mb: [
          {
            mb: k()
          }
        ],
        ml: [
          {
            ml: k()
          }
        ],
        "space-x": [
          {
            "space-x": G()
          }
        ],
        "space-x-reverse": [
          "space-x-reverse"
        ],
        "space-y": [
          {
            "space-y": G()
          }
        ],
        "space-y-reverse": [
          "space-y-reverse"
        ],
        size: [
          {
            size: F()
          }
        ],
        "inline-size": [
          {
            inline: [
              "auto",
              ...Z()
            ]
          }
        ],
        "min-inline-size": [
          {
            "min-inline": [
              "auto",
              ...Z()
            ]
          }
        ],
        "max-inline-size": [
          {
            "max-inline": [
              "none",
              ...Z()
            ]
          }
        ],
        "block-size": [
          {
            block: [
              "auto",
              ...it()
            ]
          }
        ],
        "min-block-size": [
          {
            "min-block": [
              "auto",
              ...it()
            ]
          }
        ],
        "max-block-size": [
          {
            "max-block": [
              "none",
              ...it()
            ]
          }
        ],
        w: [
          {
            w: [
              h,
              "screen",
              ...F()
            ]
          }
        ],
        "min-w": [
          {
            "min-w": [
              h,
              "screen",
              "none",
              ...F()
            ]
          }
        ],
        "max-w": [
          {
            "max-w": [
              h,
              "screen",
              "none",
              "prose",
              {
                screen: [
                  f
                ]
              },
              ...F()
            ]
          }
        ],
        h: [
          {
            h: [
              "screen",
              "lh",
              ...F()
            ]
          }
        ],
        "min-h": [
          {
            "min-h": [
              "screen",
              "lh",
              "none",
              ...F()
            ]
          }
        ],
        "max-h": [
          {
            "max-h": [
              "screen",
              "lh",
              ...F()
            ]
          }
        ],
        "font-size": [
          {
            text: [
              "base",
              l,
              Is,
              qi
            ]
          }
        ],
        "font-smoothing": [
          "antialiased",
          "subpixel-antialiased"
        ],
        "font-style": [
          "italic",
          "not-italic"
        ],
        "font-weight": [
          {
            font: [
              o,
              _A,
              RA
            ]
          }
        ],
        "font-stretch": [
          {
            "font-stretch": [
              "ultra-condensed",
              "extra-condensed",
              "condensed",
              "semi-condensed",
              "normal",
              "semi-expanded",
              "expanded",
              "extra-expanded",
              "ultra-expanded",
              tf,
              ot
            ]
          }
        ],
        "font-family": [
          {
            font: [
              jA,
              DA,
              i
            ]
          }
        ],
        "font-features": [
          {
            "font-features": [
              ot
            ]
          }
        ],
        "fvn-normal": [
          "normal-nums"
        ],
        "fvn-ordinal": [
          "ordinal"
        ],
        "fvn-slashed-zero": [
          "slashed-zero"
        ],
        "fvn-figure": [
          "lining-nums",
          "oldstyle-nums"
        ],
        "fvn-spacing": [
          "proportional-nums",
          "tabular-nums"
        ],
        "fvn-fraction": [
          "diagonal-fractions",
          "stacked-fractions"
        ],
        tracking: [
          {
            tracking: [
              r,
              ct,
              ot
            ]
          }
        ],
        "line-clamp": [
          {
            "line-clamp": [
              St,
              "none",
              ct,
              wy
            ]
          }
        ],
        leading: [
          {
            leading: [
              d,
              ...G()
            ]
          }
        ],
        "list-image": [
          {
            "list-image": [
              "none",
              ct,
              ot
            ]
          }
        ],
        "list-style-position": [
          {
            list: [
              "inside",
              "outside"
            ]
          }
        ],
        "list-style-type": [
          {
            list: [
              "disc",
              "decimal",
              "none",
              ct,
              ot
            ]
          }
        ],
        "text-alignment": [
          {
            text: [
              "left",
              "center",
              "right",
              "justify",
              "start",
              "end"
            ]
          }
        ],
        "placeholder-color": [
          {
            placeholder: N()
          }
        ],
        "text-color": [
          {
            text: N()
          }
        ],
        "text-decoration": [
          "underline",
          "overline",
          "line-through",
          "no-underline"
        ],
        "text-decoration-style": [
          {
            decoration: [
              ...dt(),
              "wavy"
            ]
          }
        ],
        "text-decoration-thickness": [
          {
            decoration: [
              St,
              "from-font",
              "auto",
              ct,
              qi
            ]
          }
        ],
        "text-decoration-color": [
          {
            decoration: N()
          }
        ],
        "underline-offset": [
          {
            "underline-offset": [
              St,
              "auto",
              ct,
              ot
            ]
          }
        ],
        "text-transform": [
          "uppercase",
          "lowercase",
          "capitalize",
          "normal-case"
        ],
        "text-overflow": [
          "truncate",
          "text-ellipsis",
          "text-clip"
        ],
        "text-wrap": [
          {
            text: [
              "wrap",
              "nowrap",
              "balance",
              "pretty"
            ]
          }
        ],
        indent: [
          {
            indent: G()
          }
        ],
        "vertical-align": [
          {
            align: [
              "baseline",
              "top",
              "middle",
              "bottom",
              "text-top",
              "text-bottom",
              "sub",
              "super",
              ct,
              ot
            ]
          }
        ],
        whitespace: [
          {
            whitespace: [
              "normal",
              "nowrap",
              "pre",
              "pre-line",
              "pre-wrap",
              "break-spaces"
            ]
          }
        ],
        break: [
          {
            break: [
              "normal",
              "words",
              "all",
              "keep"
            ]
          }
        ],
        wrap: [
          {
            wrap: [
              "break-word",
              "anywhere",
              "normal"
            ]
          }
        ],
        hyphens: [
          {
            hyphens: [
              "none",
              "manual",
              "auto"
            ]
          }
        ],
        content: [
          {
            content: [
              "none",
              ct,
              ot
            ]
          }
        ],
        "bg-attachment": [
          {
            bg: [
              "fixed",
              "local",
              "scroll"
            ]
          }
        ],
        "bg-clip": [
          {
            "bg-clip": [
              "border",
              "padding",
              "content",
              "text"
            ]
          }
        ],
        "bg-origin": [
          {
            "bg-origin": [
              "border",
              "padding",
              "content"
            ]
          }
        ],
        "bg-position": [
          {
            bg: E()
          }
        ],
        "bg-repeat": [
          {
            bg: j()
          }
        ],
        "bg-size": [
          {
            bg: K()
          }
        ],
        "bg-image": [
          {
            bg: [
              "none",
              {
                linear: [
                  {
                    to: [
                      "t",
                      "tr",
                      "r",
                      "br",
                      "b",
                      "bl",
                      "l",
                      "tl"
                    ]
                  },
                  gi,
                  ct,
                  ot
                ],
                radial: [
                  "",
                  ct,
                  ot
                ],
                conic: [
                  gi,
                  ct,
                  ot
                ]
              },
              zA,
              OA
            ]
          }
        ],
        "bg-color": [
          {
            bg: N()
          }
        ],
        "gradient-from-pos": [
          {
            from: W()
          }
        ],
        "gradient-via-pos": [
          {
            via: W()
          }
        ],
        "gradient-to-pos": [
          {
            to: W()
          }
        ],
        "gradient-from": [
          {
            from: N()
          }
        ],
        "gradient-via": [
          {
            via: N()
          }
        ],
        "gradient-to": [
          {
            to: N()
          }
        ],
        rounded: [
          {
            rounded: et()
          }
        ],
        "rounded-s": [
          {
            "rounded-s": et()
          }
        ],
        "rounded-e": [
          {
            "rounded-e": et()
          }
        ],
        "rounded-t": [
          {
            "rounded-t": et()
          }
        ],
        "rounded-r": [
          {
            "rounded-r": et()
          }
        ],
        "rounded-b": [
          {
            "rounded-b": et()
          }
        ],
        "rounded-l": [
          {
            "rounded-l": et()
          }
        ],
        "rounded-ss": [
          {
            "rounded-ss": et()
          }
        ],
        "rounded-se": [
          {
            "rounded-se": et()
          }
        ],
        "rounded-ee": [
          {
            "rounded-ee": et()
          }
        ],
        "rounded-es": [
          {
            "rounded-es": et()
          }
        ],
        "rounded-tl": [
          {
            "rounded-tl": et()
          }
        ],
        "rounded-tr": [
          {
            "rounded-tr": et()
          }
        ],
        "rounded-br": [
          {
            "rounded-br": et()
          }
        ],
        "rounded-bl": [
          {
            "rounded-bl": et()
          }
        ],
        "border-w": [
          {
            border: at()
          }
        ],
        "border-w-x": [
          {
            "border-x": at()
          }
        ],
        "border-w-y": [
          {
            "border-y": at()
          }
        ],
        "border-w-s": [
          {
            "border-s": at()
          }
        ],
        "border-w-e": [
          {
            "border-e": at()
          }
        ],
        "border-w-bs": [
          {
            "border-bs": at()
          }
        ],
        "border-w-be": [
          {
            "border-be": at()
          }
        ],
        "border-w-t": [
          {
            "border-t": at()
          }
        ],
        "border-w-r": [
          {
            "border-r": at()
          }
        ],
        "border-w-b": [
          {
            "border-b": at()
          }
        ],
        "border-w-l": [
          {
            "border-l": at()
          }
        ],
        "divide-x": [
          {
            "divide-x": at()
          }
        ],
        "divide-x-reverse": [
          "divide-x-reverse"
        ],
        "divide-y": [
          {
            "divide-y": at()
          }
        ],
        "divide-y-reverse": [
          "divide-y-reverse"
        ],
        "border-style": [
          {
            border: [
              ...dt(),
              "hidden",
              "none"
            ]
          }
        ],
        "divide-style": [
          {
            divide: [
              ...dt(),
              "hidden",
              "none"
            ]
          }
        ],
        "border-color": [
          {
            border: N()
          }
        ],
        "border-color-x": [
          {
            "border-x": N()
          }
        ],
        "border-color-y": [
          {
            "border-y": N()
          }
        ],
        "border-color-s": [
          {
            "border-s": N()
          }
        ],
        "border-color-e": [
          {
            "border-e": N()
          }
        ],
        "border-color-bs": [
          {
            "border-bs": N()
          }
        ],
        "border-color-be": [
          {
            "border-be": N()
          }
        ],
        "border-color-t": [
          {
            "border-t": N()
          }
        ],
        "border-color-r": [
          {
            "border-r": N()
          }
        ],
        "border-color-b": [
          {
            "border-b": N()
          }
        ],
        "border-color-l": [
          {
            "border-l": N()
          }
        ],
        "divide-color": [
          {
            divide: N()
          }
        ],
        "outline-style": [
          {
            outline: [
              ...dt(),
              "none",
              "hidden"
            ]
          }
        ],
        "outline-offset": [
          {
            "outline-offset": [
              St,
              ct,
              ot
            ]
          }
        ],
        "outline-w": [
          {
            outline: [
              "",
              St,
              Is,
              qi
            ]
          }
        ],
        "outline-color": [
          {
            outline: N()
          }
        ],
        shadow: [
          {
            shadow: [
              "",
              "none",
              g,
              Bo,
              Lo
            ]
          }
        ],
        "shadow-color": [
          {
            shadow: N()
          }
        ],
        "inset-shadow": [
          {
            "inset-shadow": [
              "none",
              v,
              Bo,
              Lo
            ]
          }
        ],
        "inset-shadow-color": [
          {
            "inset-shadow": N()
          }
        ],
        "ring-w": [
          {
            ring: at()
          }
        ],
        "ring-w-inset": [
          "ring-inset"
        ],
        "ring-color": [
          {
            ring: N()
          }
        ],
        "ring-offset-w": [
          {
            "ring-offset": [
              St,
              qi
            ]
          }
        ],
        "ring-offset-color": [
          {
            "ring-offset": N()
          }
        ],
        "inset-ring-w": [
          {
            "inset-ring": at()
          }
        ],
        "inset-ring-color": [
          {
            "inset-ring": N()
          }
        ],
        "text-shadow": [
          {
            "text-shadow": [
              "none",
              b,
              Bo,
              Lo
            ]
          }
        ],
        "text-shadow-color": [
          {
            "text-shadow": N()
          }
        ],
        opacity: [
          {
            opacity: [
              St,
              ct,
              ot
            ]
          }
        ],
        "mix-blend": [
          {
            "mix-blend": [
              ...Ht(),
              "plus-darker",
              "plus-lighter"
            ]
          }
        ],
        "bg-blend": [
          {
            "bg-blend": Ht()
          }
        ],
        "mask-clip": [
          {
            "mask-clip": [
              "border",
              "padding",
              "content",
              "fill",
              "stroke",
              "view"
            ]
          },
          "mask-no-clip"
        ],
        "mask-composite": [
          {
            mask: [
              "add",
              "subtract",
              "intersect",
              "exclude"
            ]
          }
        ],
        "mask-image-linear-pos": [
          {
            "mask-linear": [
              St
            ]
          }
        ],
        "mask-image-linear-from-pos": [
          {
            "mask-linear-from": vt()
          }
        ],
        "mask-image-linear-to-pos": [
          {
            "mask-linear-to": vt()
          }
        ],
        "mask-image-linear-from-color": [
          {
            "mask-linear-from": N()
          }
        ],
        "mask-image-linear-to-color": [
          {
            "mask-linear-to": N()
          }
        ],
        "mask-image-t-from-pos": [
          {
            "mask-t-from": vt()
          }
        ],
        "mask-image-t-to-pos": [
          {
            "mask-t-to": vt()
          }
        ],
        "mask-image-t-from-color": [
          {
            "mask-t-from": N()
          }
        ],
        "mask-image-t-to-color": [
          {
            "mask-t-to": N()
          }
        ],
        "mask-image-r-from-pos": [
          {
            "mask-r-from": vt()
          }
        ],
        "mask-image-r-to-pos": [
          {
            "mask-r-to": vt()
          }
        ],
        "mask-image-r-from-color": [
          {
            "mask-r-from": N()
          }
        ],
        "mask-image-r-to-color": [
          {
            "mask-r-to": N()
          }
        ],
        "mask-image-b-from-pos": [
          {
            "mask-b-from": vt()
          }
        ],
        "mask-image-b-to-pos": [
          {
            "mask-b-to": vt()
          }
        ],
        "mask-image-b-from-color": [
          {
            "mask-b-from": N()
          }
        ],
        "mask-image-b-to-color": [
          {
            "mask-b-to": N()
          }
        ],
        "mask-image-l-from-pos": [
          {
            "mask-l-from": vt()
          }
        ],
        "mask-image-l-to-pos": [
          {
            "mask-l-to": vt()
          }
        ],
        "mask-image-l-from-color": [
          {
            "mask-l-from": N()
          }
        ],
        "mask-image-l-to-color": [
          {
            "mask-l-to": N()
          }
        ],
        "mask-image-x-from-pos": [
          {
            "mask-x-from": vt()
          }
        ],
        "mask-image-x-to-pos": [
          {
            "mask-x-to": vt()
          }
        ],
        "mask-image-x-from-color": [
          {
            "mask-x-from": N()
          }
        ],
        "mask-image-x-to-color": [
          {
            "mask-x-to": N()
          }
        ],
        "mask-image-y-from-pos": [
          {
            "mask-y-from": vt()
          }
        ],
        "mask-image-y-to-pos": [
          {
            "mask-y-to": vt()
          }
        ],
        "mask-image-y-from-color": [
          {
            "mask-y-from": N()
          }
        ],
        "mask-image-y-to-color": [
          {
            "mask-y-to": N()
          }
        ],
        "mask-image-radial": [
          {
            "mask-radial": [
              ct,
              ot
            ]
          }
        ],
        "mask-image-radial-from-pos": [
          {
            "mask-radial-from": vt()
          }
        ],
        "mask-image-radial-to-pos": [
          {
            "mask-radial-to": vt()
          }
        ],
        "mask-image-radial-from-color": [
          {
            "mask-radial-from": N()
          }
        ],
        "mask-image-radial-to-color": [
          {
            "mask-radial-to": N()
          }
        ],
        "mask-image-radial-shape": [
          {
            "mask-radial": [
              "circle",
              "ellipse"
            ]
          }
        ],
        "mask-image-radial-size": [
          {
            "mask-radial": [
              {
                closest: [
                  "side",
                  "corner"
                ],
                farthest: [
                  "side",
                  "corner"
                ]
              }
            ]
          }
        ],
        "mask-image-radial-pos": [
          {
            "mask-radial-at": V()
          }
        ],
        "mask-image-conic-pos": [
          {
            "mask-conic": [
              St
            ]
          }
        ],
        "mask-image-conic-from-pos": [
          {
            "mask-conic-from": vt()
          }
        ],
        "mask-image-conic-to-pos": [
          {
            "mask-conic-to": vt()
          }
        ],
        "mask-image-conic-from-color": [
          {
            "mask-conic-from": N()
          }
        ],
        "mask-image-conic-to-color": [
          {
            "mask-conic-to": N()
          }
        ],
        "mask-mode": [
          {
            mask: [
              "alpha",
              "luminance",
              "match"
            ]
          }
        ],
        "mask-origin": [
          {
            "mask-origin": [
              "border",
              "padding",
              "content",
              "fill",
              "stroke",
              "view"
            ]
          }
        ],
        "mask-position": [
          {
            mask: E()
          }
        ],
        "mask-repeat": [
          {
            mask: j()
          }
        ],
        "mask-size": [
          {
            mask: K()
          }
        ],
        "mask-type": [
          {
            "mask-type": [
              "alpha",
              "luminance"
            ]
          }
        ],
        "mask-image": [
          {
            mask: [
              "none",
              ct,
              ot
            ]
          }
        ],
        filter: [
          {
            filter: [
              "",
              "none",
              ct,
              ot
            ]
          }
        ],
        blur: [
          {
            blur: cn()
          }
        ],
        brightness: [
          {
            brightness: [
              St,
              ct,
              ot
            ]
          }
        ],
        contrast: [
          {
            contrast: [
              St,
              ct,
              ot
            ]
          }
        ],
        "drop-shadow": [
          {
            "drop-shadow": [
              "",
              "none",
              T,
              Bo,
              Lo
            ]
          }
        ],
        "drop-shadow-color": [
          {
            "drop-shadow": N()
          }
        ],
        grayscale: [
          {
            grayscale: [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        "hue-rotate": [
          {
            "hue-rotate": [
              St,
              ct,
              ot
            ]
          }
        ],
        invert: [
          {
            invert: [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        saturate: [
          {
            saturate: [
              St,
              ct,
              ot
            ]
          }
        ],
        sepia: [
          {
            sepia: [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-filter": [
          {
            "backdrop-filter": [
              "",
              "none",
              ct,
              ot
            ]
          }
        ],
        "backdrop-blur": [
          {
            "backdrop-blur": cn()
          }
        ],
        "backdrop-brightness": [
          {
            "backdrop-brightness": [
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-contrast": [
          {
            "backdrop-contrast": [
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-grayscale": [
          {
            "backdrop-grayscale": [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-hue-rotate": [
          {
            "backdrop-hue-rotate": [
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-invert": [
          {
            "backdrop-invert": [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-opacity": [
          {
            "backdrop-opacity": [
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-saturate": [
          {
            "backdrop-saturate": [
              St,
              ct,
              ot
            ]
          }
        ],
        "backdrop-sepia": [
          {
            "backdrop-sepia": [
              "",
              St,
              ct,
              ot
            ]
          }
        ],
        "border-collapse": [
          {
            border: [
              "collapse",
              "separate"
            ]
          }
        ],
        "border-spacing": [
          {
            "border-spacing": G()
          }
        ],
        "border-spacing-x": [
          {
            "border-spacing-x": G()
          }
        ],
        "border-spacing-y": [
          {
            "border-spacing-y": G()
          }
        ],
        "table-layout": [
          {
            table: [
              "auto",
              "fixed"
            ]
          }
        ],
        caption: [
          {
            caption: [
              "top",
              "bottom"
            ]
          }
        ],
        transition: [
          {
            transition: [
              "",
              "all",
              "colors",
              "opacity",
              "shadow",
              "transform",
              "none",
              ct,
              ot
            ]
          }
        ],
        "transition-behavior": [
          {
            transition: [
              "normal",
              "discrete"
            ]
          }
        ],
        duration: [
          {
            duration: [
              St,
              "initial",
              ct,
              ot
            ]
          }
        ],
        ease: [
          {
            ease: [
              "linear",
              "initial",
              O,
              ct,
              ot
            ]
          }
        ],
        delay: [
          {
            delay: [
              St,
              ct,
              ot
            ]
          }
        ],
        animate: [
          {
            animate: [
              "none",
              L,
              ct,
              ot
            ]
          }
        ],
        backface: [
          {
            backface: [
              "hidden",
              "visible"
            ]
          }
        ],
        perspective: [
          {
            perspective: [
              C,
              ct,
              ot
            ]
          }
        ],
        "perspective-origin": [
          {
            "perspective-origin": q()
          }
        ],
        rotate: [
          {
            rotate: $e()
          }
        ],
        "rotate-x": [
          {
            "rotate-x": $e()
          }
        ],
        "rotate-y": [
          {
            "rotate-y": $e()
          }
        ],
        "rotate-z": [
          {
            "rotate-z": $e()
          }
        ],
        scale: [
          {
            scale: un()
          }
        ],
        "scale-x": [
          {
            "scale-x": un()
          }
        ],
        "scale-y": [
          {
            "scale-y": un()
          }
        ],
        "scale-z": [
          {
            "scale-z": un()
          }
        ],
        "scale-3d": [
          "scale-3d"
        ],
        skew: [
          {
            skew: We()
          }
        ],
        "skew-x": [
          {
            "skew-x": We()
          }
        ],
        "skew-y": [
          {
            "skew-y": We()
          }
        ],
        transform: [
          {
            transform: [
              ct,
              ot,
              "",
              "none",
              "gpu",
              "cpu"
            ]
          }
        ],
        "transform-origin": [
          {
            origin: q()
          }
        ],
        "transform-style": [
          {
            transform: [
              "3d",
              "flat"
            ]
          }
        ],
        translate: [
          {
            translate: Le()
          }
        ],
        "translate-x": [
          {
            "translate-x": Le()
          }
        ],
        "translate-y": [
          {
            "translate-y": Le()
          }
        ],
        "translate-z": [
          {
            "translate-z": Le()
          }
        ],
        "translate-none": [
          "translate-none"
        ],
        accent: [
          {
            accent: N()
          }
        ],
        appearance: [
          {
            appearance: [
              "none",
              "auto"
            ]
          }
        ],
        "caret-color": [
          {
            caret: N()
          }
        ],
        "color-scheme": [
          {
            scheme: [
              "normal",
              "dark",
              "light",
              "light-dark",
              "only-dark",
              "only-light"
            ]
          }
        ],
        cursor: [
          {
            cursor: [
              "auto",
              "default",
              "pointer",
              "wait",
              "text",
              "move",
              "help",
              "not-allowed",
              "none",
              "context-menu",
              "progress",
              "cell",
              "crosshair",
              "vertical-text",
              "alias",
              "copy",
              "no-drop",
              "grab",
              "grabbing",
              "all-scroll",
              "col-resize",
              "row-resize",
              "n-resize",
              "e-resize",
              "s-resize",
              "w-resize",
              "ne-resize",
              "nw-resize",
              "se-resize",
              "sw-resize",
              "ew-resize",
              "ns-resize",
              "nesw-resize",
              "nwse-resize",
              "zoom-in",
              "zoom-out",
              ct,
              ot
            ]
          }
        ],
        "field-sizing": [
          {
            "field-sizing": [
              "fixed",
              "content"
            ]
          }
        ],
        "pointer-events": [
          {
            "pointer-events": [
              "auto",
              "none"
            ]
          }
        ],
        resize: [
          {
            resize: [
              "none",
              "",
              "y",
              "x"
            ]
          }
        ],
        "scroll-behavior": [
          {
            scroll: [
              "auto",
              "smooth"
            ]
          }
        ],
        "scroll-m": [
          {
            "scroll-m": G()
          }
        ],
        "scroll-mx": [
          {
            "scroll-mx": G()
          }
        ],
        "scroll-my": [
          {
            "scroll-my": G()
          }
        ],
        "scroll-ms": [
          {
            "scroll-ms": G()
          }
        ],
        "scroll-me": [
          {
            "scroll-me": G()
          }
        ],
        "scroll-mbs": [
          {
            "scroll-mbs": G()
          }
        ],
        "scroll-mbe": [
          {
            "scroll-mbe": G()
          }
        ],
        "scroll-mt": [
          {
            "scroll-mt": G()
          }
        ],
        "scroll-mr": [
          {
            "scroll-mr": G()
          }
        ],
        "scroll-mb": [
          {
            "scroll-mb": G()
          }
        ],
        "scroll-ml": [
          {
            "scroll-ml": G()
          }
        ],
        "scroll-p": [
          {
            "scroll-p": G()
          }
        ],
        "scroll-px": [
          {
            "scroll-px": G()
          }
        ],
        "scroll-py": [
          {
            "scroll-py": G()
          }
        ],
        "scroll-ps": [
          {
            "scroll-ps": G()
          }
        ],
        "scroll-pe": [
          {
            "scroll-pe": G()
          }
        ],
        "scroll-pbs": [
          {
            "scroll-pbs": G()
          }
        ],
        "scroll-pbe": [
          {
            "scroll-pbe": G()
          }
        ],
        "scroll-pt": [
          {
            "scroll-pt": G()
          }
        ],
        "scroll-pr": [
          {
            "scroll-pr": G()
          }
        ],
        "scroll-pb": [
          {
            "scroll-pb": G()
          }
        ],
        "scroll-pl": [
          {
            "scroll-pl": G()
          }
        ],
        "snap-align": [
          {
            snap: [
              "start",
              "end",
              "center",
              "align-none"
            ]
          }
        ],
        "snap-stop": [
          {
            snap: [
              "normal",
              "always"
            ]
          }
        ],
        "snap-type": [
          {
            snap: [
              "none",
              "x",
              "y",
              "both"
            ]
          }
        ],
        "snap-strictness": [
          {
            snap: [
              "mandatory",
              "proximity"
            ]
          }
        ],
        touch: [
          {
            touch: [
              "auto",
              "none",
              "manipulation"
            ]
          }
        ],
        "touch-x": [
          {
            "touch-pan": [
              "x",
              "left",
              "right"
            ]
          }
        ],
        "touch-y": [
          {
            "touch-pan": [
              "y",
              "up",
              "down"
            ]
          }
        ],
        "touch-pz": [
          "touch-pinch-zoom"
        ],
        select: [
          {
            select: [
              "none",
              "text",
              "all",
              "auto"
            ]
          }
        ],
        "will-change": [
          {
            "will-change": [
              "auto",
              "scroll",
              "contents",
              "transform",
              ct,
              ot
            ]
          }
        ],
        fill: [
          {
            fill: [
              "none",
              ...N()
            ]
          }
        ],
        "stroke-w": [
          {
            stroke: [
              St,
              Is,
              qi,
              wy
            ]
          }
        ],
        stroke: [
          {
            stroke: [
              "none",
              ...N()
            ]
          }
        ],
        "forced-color-adjust": [
          {
            "forced-color-adjust": [
              "auto",
              "none"
            ]
          }
        ]
      },
      conflictingClassGroups: {
        overflow: [
          "overflow-x",
          "overflow-y"
        ],
        overscroll: [
          "overscroll-x",
          "overscroll-y"
        ],
        inset: [
          "inset-x",
          "inset-y",
          "inset-bs",
          "inset-be",
          "start",
          "end",
          "top",
          "right",
          "bottom",
          "left"
        ],
        "inset-x": [
          "right",
          "left"
        ],
        "inset-y": [
          "top",
          "bottom"
        ],
        flex: [
          "basis",
          "grow",
          "shrink"
        ],
        gap: [
          "gap-x",
          "gap-y"
        ],
        p: [
          "px",
          "py",
          "ps",
          "pe",
          "pbs",
          "pbe",
          "pt",
          "pr",
          "pb",
          "pl"
        ],
        px: [
          "pr",
          "pl"
        ],
        py: [
          "pt",
          "pb"
        ],
        m: [
          "mx",
          "my",
          "ms",
          "me",
          "mbs",
          "mbe",
          "mt",
          "mr",
          "mb",
          "ml"
        ],
        mx: [
          "mr",
          "ml"
        ],
        my: [
          "mt",
          "mb"
        ],
        size: [
          "w",
          "h"
        ],
        "font-size": [
          "leading"
        ],
        "fvn-normal": [
          "fvn-ordinal",
          "fvn-slashed-zero",
          "fvn-figure",
          "fvn-spacing",
          "fvn-fraction"
        ],
        "fvn-ordinal": [
          "fvn-normal"
        ],
        "fvn-slashed-zero": [
          "fvn-normal"
        ],
        "fvn-figure": [
          "fvn-normal"
        ],
        "fvn-spacing": [
          "fvn-normal"
        ],
        "fvn-fraction": [
          "fvn-normal"
        ],
        "line-clamp": [
          "display",
          "overflow"
        ],
        rounded: [
          "rounded-s",
          "rounded-e",
          "rounded-t",
          "rounded-r",
          "rounded-b",
          "rounded-l",
          "rounded-ss",
          "rounded-se",
          "rounded-ee",
          "rounded-es",
          "rounded-tl",
          "rounded-tr",
          "rounded-br",
          "rounded-bl"
        ],
        "rounded-s": [
          "rounded-ss",
          "rounded-es"
        ],
        "rounded-e": [
          "rounded-se",
          "rounded-ee"
        ],
        "rounded-t": [
          "rounded-tl",
          "rounded-tr"
        ],
        "rounded-r": [
          "rounded-tr",
          "rounded-br"
        ],
        "rounded-b": [
          "rounded-br",
          "rounded-bl"
        ],
        "rounded-l": [
          "rounded-tl",
          "rounded-bl"
        ],
        "border-spacing": [
          "border-spacing-x",
          "border-spacing-y"
        ],
        "border-w": [
          "border-w-x",
          "border-w-y",
          "border-w-s",
          "border-w-e",
          "border-w-bs",
          "border-w-be",
          "border-w-t",
          "border-w-r",
          "border-w-b",
          "border-w-l"
        ],
        "border-w-x": [
          "border-w-r",
          "border-w-l"
        ],
        "border-w-y": [
          "border-w-t",
          "border-w-b"
        ],
        "border-color": [
          "border-color-x",
          "border-color-y",
          "border-color-s",
          "border-color-e",
          "border-color-bs",
          "border-color-be",
          "border-color-t",
          "border-color-r",
          "border-color-b",
          "border-color-l"
        ],
        "border-color-x": [
          "border-color-r",
          "border-color-l"
        ],
        "border-color-y": [
          "border-color-t",
          "border-color-b"
        ],
        translate: [
          "translate-x",
          "translate-y",
          "translate-none"
        ],
        "translate-none": [
          "translate",
          "translate-x",
          "translate-y",
          "translate-z"
        ],
        "scroll-m": [
          "scroll-mx",
          "scroll-my",
          "scroll-ms",
          "scroll-me",
          "scroll-mbs",
          "scroll-mbe",
          "scroll-mt",
          "scroll-mr",
          "scroll-mb",
          "scroll-ml"
        ],
        "scroll-mx": [
          "scroll-mr",
          "scroll-ml"
        ],
        "scroll-my": [
          "scroll-mt",
          "scroll-mb"
        ],
        "scroll-p": [
          "scroll-px",
          "scroll-py",
          "scroll-ps",
          "scroll-pe",
          "scroll-pbs",
          "scroll-pbe",
          "scroll-pt",
          "scroll-pr",
          "scroll-pb",
          "scroll-pl"
        ],
        "scroll-px": [
          "scroll-pr",
          "scroll-pl"
        ],
        "scroll-py": [
          "scroll-pt",
          "scroll-pb"
        ],
        touch: [
          "touch-x",
          "touch-y",
          "touch-pz"
        ],
        "touch-x": [
          "touch"
        ],
        "touch-y": [
          "touch"
        ],
        "touch-pz": [
          "touch"
        ]
      },
      conflictingClassGroupModifiers: {
        "font-size": [
          "leading"
        ]
      },
      orderSensitiveModifiers: [
        "*",
        "**",
        "after",
        "backdrop",
        "before",
        "details-content",
        "file",
        "first-letter",
        "first-line",
        "marker",
        "placeholder",
        "selection"
      ]
    };
  }, LA = pA(kA);
  function gd(...n) {
    return LA(kv(n));
  }
  const BA = Kw, UA = Zw, HA = Qw, $v = w.forwardRef(({ className: n, sideOffset: i = 4, ...l }, o) => S.jsx(_v, {
    ref: o,
    sideOffset: i,
    className: gd("z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]", n),
    ...l
  }));
  $v.displayName = _v.displayName;
  const yd = w.createContext({});
  function vd(n) {
    const i = w.useRef(null);
    return i.current === null && (i.current = n()), i.current;
  }
  const GA = typeof window < "u", Wv = GA ? w.useLayoutEffect : w.useEffect, Tr = w.createContext(null);
  function bd(n, i) {
    n.indexOf(i) === -1 && n.push(i);
  }
  function ar(n, i) {
    const l = n.indexOf(i);
    l > -1 && n.splice(l, 1);
  }
  const xn = (n, i, l) => l > i ? i : l < n ? n : l;
  let xd = () => {
  };
  const Si = {}, Iv = (n) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(n);
  function tb(n) {
    return typeof n == "object" && n !== null;
  }
  const eb = (n) => /^0[^.\s]+$/u.test(n);
  function nb(n) {
    let i;
    return () => (i === void 0 && (i = n()), i);
  }
  const Fe = (n) => n, YA = (n, i) => (l) => i(n(l)), hl = (...n) => n.reduce(YA), rl = (n, i, l) => {
    const o = i - n;
    return o === 0 ? 1 : (l - n) / o;
  };
  class Sd {
    constructor() {
      this.subscriptions = [];
    }
    add(i) {
      return bd(this.subscriptions, i), () => ar(this.subscriptions, i);
    }
    notify(i, l, o) {
      const r = this.subscriptions.length;
      if (r) if (r === 1) this.subscriptions[0](i, l, o);
      else for (let d = 0; d < r; d++) {
        const f = this.subscriptions[d];
        f && f(i, l, o);
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  }
  const ke = (n) => n * 1e3, Qe = (n) => n / 1e3;
  function ib(n, i) {
    return i ? n * (1e3 / i) : 0;
  }
  const ab = (n, i, l) => (((1 - 3 * l + 3 * i) * n + (3 * l - 6 * i)) * n + 3 * i) * n, PA = 1e-7, qA = 12;
  function XA(n, i, l, o, r) {
    let d, f, h = 0;
    do
      f = i + (l - i) / 2, d = ab(f, o, r) - n, d > 0 ? l = f : i = f;
    while (Math.abs(d) > PA && ++h < qA);
    return f;
  }
  function ml(n, i, l, o) {
    if (n === i && l === o) return Fe;
    const r = (d) => XA(d, 0, 1, n, l);
    return (d) => d === 0 || d === 1 ? d : ab(r(d), i, o);
  }
  const sb = (n) => (i) => i <= 0.5 ? n(2 * i) / 2 : (2 - n(2 * (1 - i))) / 2, lb = (n) => (i) => 1 - n(1 - i), ob = ml(0.33, 1.53, 0.69, 0.99), Td = lb(ob), rb = sb(Td), cb = (n) => n >= 1 ? 1 : (n *= 2) < 1 ? 0.5 * Td(n) : 0.5 * (2 - Math.pow(2, -10 * (n - 1))), wd = (n) => 1 - Math.sin(Math.acos(n)), ub = lb(wd), fb = sb(wd), KA = ml(0.42, 0, 1, 1), ZA = ml(0, 0, 0.58, 1), db = ml(0.42, 0, 0.58, 1), QA = (n) => Array.isArray(n) && typeof n[0] != "number", hb = (n) => Array.isArray(n) && typeof n[0] == "number", FA = {
    linear: Fe,
    easeIn: KA,
    easeInOut: db,
    easeOut: ZA,
    circIn: wd,
    circInOut: fb,
    circOut: ub,
    backIn: Td,
    backInOut: rb,
    backOut: ob,
    anticipate: cb
  }, JA = (n) => typeof n == "string", Cy = (n) => {
    if (hb(n)) {
      xd(n.length === 4);
      const [i, l, o, r] = n;
      return ml(i, l, o, r);
    } else if (JA(n)) return FA[n];
    return n;
  }, Uo = [
    "setup",
    "read",
    "resolveKeyframes",
    "preUpdate",
    "update",
    "preRender",
    "render",
    "postRender"
  ];
  function $A(n, i) {
    let l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), r = false, d = false;
    const f = /* @__PURE__ */ new WeakSet();
    let h = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function m(g) {
      f.has(g) && (p.schedule(g), n()), g(h);
    }
    const p = {
      schedule: (g, v = false, b = false) => {
        const A = b && r ? l : o;
        return v && f.add(g), A.add(g), g;
      },
      cancel: (g) => {
        o.delete(g), f.delete(g);
      },
      process: (g) => {
        if (h = g, r) {
          d = true;
          return;
        }
        r = true;
        const v = l;
        l = o, o = v, l.forEach(m), l.clear(), r = false, d && (d = false, p.process(g));
      }
    };
    return p;
  }
  const WA = 40;
  function mb(n, i) {
    let l = false, o = true;
    const r = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    }, d = () => l = true, f = Uo.reduce((z, V) => (z[V] = $A(d), z), {}), { setup: h, read: m, resolveKeyframes: p, preUpdate: g, update: v, preRender: b, render: T, postRender: A } = f, C = () => {
      const z = Si.useManualTiming, V = z ? r.timestamp : performance.now();
      l = false, z || (r.delta = o ? 1e3 / 60 : Math.max(Math.min(V - r.timestamp, WA), 1)), r.timestamp = V, r.isProcessing = true, h.process(r), m.process(r), p.process(r), g.process(r), v.process(r), b.process(r), T.process(r), A.process(r), r.isProcessing = false, l && i && (o = false, n(C));
    }, R = () => {
      l = true, o = true, r.isProcessing || n(C);
    };
    return {
      schedule: Uo.reduce((z, V) => {
        const q = f[V];
        return z[V] = ($, X = false, G = false) => (l || R(), q.schedule($, X, G)), z;
      }, {}),
      cancel: (z) => {
        for (let V = 0; V < Uo.length; V++) f[Uo[V]].cancel(z);
      },
      state: r,
      steps: f
    };
  }
  const { schedule: Lt, cancel: Ti, state: ce, steps: ef } = mb(typeof requestAnimationFrame < "u" ? requestAnimationFrame : Fe, true);
  let Xo;
  function IA() {
    Xo = void 0;
  }
  const me = {
    now: () => (Xo === void 0 && me.set(ce.isProcessing || Si.useManualTiming ? ce.timestamp : performance.now()), Xo),
    set: (n) => {
      Xo = n, queueMicrotask(IA);
    }
  }, pb = (n) => (i) => typeof i == "string" && i.startsWith(n), gb = pb("--"), tE = pb("var(--"), Ad = (n) => tE(n) ? eE.test(n.split("/*")[0].trim()) : false, eE = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
  function My(n) {
    return typeof n != "string" ? false : n.split("/*")[0].includes("var(--");
  }
  const ts = {
    test: (n) => typeof n == "number",
    parse: parseFloat,
    transform: (n) => n
  }, cl = {
    ...ts,
    transform: (n) => xn(0, 1, n)
  }, Ho = {
    ...ts,
    default: 1
  }, nl = (n) => Math.round(n * 1e5) / 1e5, Ed = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
  function nE(n) {
    return n == null;
  }
  const iE = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, Cd = (n, i) => (l) => !!(typeof l == "string" && iE.test(l) && l.startsWith(n) || i && !nE(l) && Object.prototype.hasOwnProperty.call(l, i)), yb = (n, i, l) => (o) => {
    if (typeof o != "string") return o;
    const [r, d, f, h] = o.match(Ed);
    return {
      [n]: parseFloat(r),
      [i]: parseFloat(d),
      [l]: parseFloat(f),
      alpha: h !== void 0 ? parseFloat(h) : 1
    };
  }, aE = (n) => xn(0, 255, n), nf = {
    ...ts,
    transform: (n) => Math.round(aE(n))
  }, Zi = {
    test: Cd("rgb", "red"),
    parse: yb("red", "green", "blue"),
    transform: ({ red: n, green: i, blue: l, alpha: o = 1 }) => "rgba(" + nf.transform(n) + ", " + nf.transform(i) + ", " + nf.transform(l) + ", " + nl(cl.transform(o)) + ")"
  };
  function sE(n) {
    let i = "", l = "", o = "", r = "";
    return n.length > 5 ? (i = n.substring(1, 3), l = n.substring(3, 5), o = n.substring(5, 7), r = n.substring(7, 9)) : (i = n.substring(1, 2), l = n.substring(2, 3), o = n.substring(3, 4), r = n.substring(4, 5), i += i, l += l, o += o, r += r), {
      red: parseInt(i, 16),
      green: parseInt(l, 16),
      blue: parseInt(o, 16),
      alpha: r ? parseInt(r, 16) / 255 : 1
    };
  }
  const Rf = {
    test: Cd("#"),
    parse: sE,
    transform: Zi.transform
  }, pl = (n) => ({
    test: (i) => typeof i == "string" && i.endsWith(n) && i.split(" ").length === 1,
    parse: parseFloat,
    transform: (i) => `${i}${n}`
  }), yi = pl("deg"), bn = pl("%"), rt = pl("px"), lE = pl("vh"), oE = pl("vw"), Ry = {
    ...bn,
    parse: (n) => bn.parse(n) / 100,
    transform: (n) => bn.transform(n * 100)
  }, Ha = {
    test: Cd("hsl", "hue"),
    parse: yb("hue", "saturation", "lightness"),
    transform: ({ hue: n, saturation: i, lightness: l, alpha: o = 1 }) => "hsla(" + Math.round(n) + ", " + bn.transform(nl(i)) + ", " + bn.transform(nl(l)) + ", " + nl(cl.transform(o)) + ")"
  }, Wt = {
    test: (n) => Zi.test(n) || Rf.test(n) || Ha.test(n),
    parse: (n) => Zi.test(n) ? Zi.parse(n) : Ha.test(n) ? Ha.parse(n) : Rf.parse(n),
    transform: (n) => typeof n == "string" ? n : n.hasOwnProperty("red") ? Zi.transform(n) : Ha.transform(n),
    getAnimatableNone: (n) => {
      const i = Wt.parse(n);
      return i.alpha = 0, Wt.transform(i);
    }
  }, rE = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
  function cE(n) {
    var _a, _b2;
    return isNaN(n) && typeof n == "string" && (((_a = n.match(Ed)) == null ? void 0 : _a.length) || 0) + (((_b2 = n.match(rE)) == null ? void 0 : _b2.length) || 0) > 0;
  }
  const vb = "number", bb = "color", uE = "var", fE = "var(", Dy = "${}", dE = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function Ja(n) {
    const i = n.toString(), l = [], o = {
      color: [],
      number: [],
      var: []
    }, r = [];
    let d = 0;
    const h = i.replace(dE, (m) => (Wt.test(m) ? (o.color.push(d), r.push(bb), l.push(Wt.parse(m))) : m.startsWith(fE) ? (o.var.push(d), r.push(uE), l.push(m)) : (o.number.push(d), r.push(vb), l.push(parseFloat(m))), ++d, Dy)).split(Dy);
    return {
      values: l,
      split: h,
      indexes: o,
      types: r
    };
  }
  function hE(n) {
    return Ja(n).values;
  }
  function xb({ split: n, types: i }) {
    const l = n.length;
    return (o) => {
      let r = "";
      for (let d = 0; d < l; d++) if (r += n[d], o[d] !== void 0) {
        const f = i[d];
        f === vb ? r += nl(o[d]) : f === bb ? r += Wt.transform(o[d]) : r += o[d];
      }
      return r;
    };
  }
  function mE(n) {
    return xb(Ja(n));
  }
  const pE = (n) => typeof n == "number" ? 0 : Wt.test(n) ? Wt.getAnimatableNone(n) : n, gE = (n, i) => typeof n == "number" ? (i == null ? void 0 : i.trim().endsWith("/")) ? n : 0 : pE(n);
  function yE(n) {
    const i = Ja(n);
    return xb(i)(i.values.map((o, r) => gE(o, i.split[r])));
  }
  const sn = {
    test: cE,
    parse: hE,
    createTransformer: mE,
    getAnimatableNone: yE
  };
  function af(n, i, l) {
    return l < 0 && (l += 1), l > 1 && (l -= 1), l < 1 / 6 ? n + (i - n) * 6 * l : l < 1 / 2 ? i : l < 2 / 3 ? n + (i - n) * (2 / 3 - l) * 6 : n;
  }
  function vE({ hue: n, saturation: i, lightness: l, alpha: o }) {
    n /= 360, i /= 100, l /= 100;
    let r = 0, d = 0, f = 0;
    if (!i) r = d = f = l;
    else {
      const h = l < 0.5 ? l * (1 + i) : l + i - l * i, m = 2 * l - h;
      r = af(m, h, n + 1 / 3), d = af(m, h, n), f = af(m, h, n - 1 / 3);
    }
    return {
      red: Math.round(r * 255),
      green: Math.round(d * 255),
      blue: Math.round(f * 255),
      alpha: o
    };
  }
  function sr(n, i) {
    return (l) => l > 0 ? i : n;
  }
  const Yt = (n, i, l) => n + (i - n) * l, sf = (n, i, l) => {
    const o = n * n, r = l * (i * i - o) + o;
    return r < 0 ? 0 : Math.sqrt(r);
  }, bE = [
    Rf,
    Zi,
    Ha
  ], xE = (n) => bE.find((i) => i.test(n));
  function Oy(n) {
    const i = xE(n);
    if (!i) return false;
    let l = i.parse(n);
    return i === Ha && (l = vE(l)), l;
  }
  const jy = (n, i) => {
    const l = Oy(n), o = Oy(i);
    if (!l || !o) return sr(n, i);
    const r = {
      ...l
    };
    return (d) => (r.red = sf(l.red, o.red, d), r.green = sf(l.green, o.green, d), r.blue = sf(l.blue, o.blue, d), r.alpha = Yt(l.alpha, o.alpha, d), Zi.transform(r));
  }, Df = /* @__PURE__ */ new Set([
    "none",
    "hidden"
  ]);
  function SE(n, i) {
    return Df.has(n) ? (l) => l <= 0 ? n : i : (l) => l >= 1 ? i : n;
  }
  function TE(n, i) {
    return (l) => Yt(n, i, l);
  }
  function Md(n) {
    return typeof n == "number" ? TE : typeof n == "string" ? Ad(n) ? sr : Wt.test(n) ? jy : EE : Array.isArray(n) ? Sb : typeof n == "object" ? Wt.test(n) ? jy : wE : sr;
  }
  function Sb(n, i) {
    const l = [
      ...n
    ], o = l.length, r = n.map((d, f) => Md(d)(d, i[f]));
    return (d) => {
      for (let f = 0; f < o; f++) l[f] = r[f](d);
      return l;
    };
  }
  function wE(n, i) {
    const l = {
      ...n,
      ...i
    }, o = {};
    for (const r in l) n[r] !== void 0 && i[r] !== void 0 && (o[r] = Md(n[r])(n[r], i[r]));
    return (r) => {
      for (const d in o) l[d] = o[d](r);
      return l;
    };
  }
  function AE(n, i) {
    const l = [], o = {
      color: 0,
      var: 0,
      number: 0
    };
    for (let r = 0; r < i.values.length; r++) {
      const d = i.types[r], f = n.indexes[d][o[d]], h = n.values[f] ?? 0;
      l[r] = h, o[d]++;
    }
    return l;
  }
  const EE = (n, i) => {
    const l = sn.createTransformer(i), o = Ja(n), r = Ja(i);
    return o.indexes.var.length === r.indexes.var.length && o.indexes.color.length === r.indexes.color.length && o.indexes.number.length >= r.indexes.number.length ? Df.has(n) && !r.values.length || Df.has(i) && !o.values.length ? SE(n, i) : hl(Sb(AE(o, r), r.values), l) : sr(n, i);
  };
  function Tb(n, i, l) {
    return typeof n == "number" && typeof i == "number" && typeof l == "number" ? Yt(n, i, l) : Md(n)(n, i);
  }
  const CE = (n) => {
    const i = ({ timestamp: l }) => n(l);
    return {
      start: (l = true) => Lt.update(i, l),
      stop: () => Ti(i),
      now: () => ce.isProcessing ? ce.timestamp : me.now()
    };
  }, wb = (n, i, l = 10) => {
    let o = "";
    const r = Math.max(Math.round(i / l), 2);
    for (let d = 0; d < r; d++) o += Math.round(n(d / (r - 1)) * 1e4) / 1e4 + ", ";
    return `linear(${o.substring(0, o.length - 2)})`;
  }, lr = 2e4;
  function Rd(n) {
    let i = 0;
    const l = 50;
    let o = n.next(i);
    for (; !o.done && i < lr; ) i += l, o = n.next(i);
    return i >= lr ? 1 / 0 : i;
  }
  function ME(n, i = 100, l) {
    const o = l({
      ...n,
      keyframes: [
        0,
        i
      ]
    }), r = Math.min(Rd(o), lr);
    return {
      type: "keyframes",
      ease: (d) => o.next(r * d).value / i,
      duration: Qe(r)
    };
  }
  const Xt = {
    stiffness: 100,
    damping: 10,
    mass: 1,
    velocity: 0,
    duration: 800,
    bounce: 0.3,
    visualDuration: 0.3,
    restSpeed: {
      granular: 0.01,
      default: 2
    },
    restDelta: {
      granular: 5e-3,
      default: 0.5
    },
    minDuration: 0.01,
    maxDuration: 10,
    minDamping: 0.05,
    maxDamping: 1
  };
  function Of(n, i) {
    return n * Math.sqrt(1 - i * i);
  }
  const RE = 12;
  function DE(n, i, l) {
    let o = l;
    for (let r = 1; r < RE; r++) o = o - n(o) / i(o);
    return o;
  }
  const lf = 1e-3;
  function OE({ duration: n = Xt.duration, bounce: i = Xt.bounce, velocity: l = Xt.velocity, mass: o = Xt.mass }) {
    let r, d, f = 1 - i;
    f = xn(Xt.minDamping, Xt.maxDamping, f), n = xn(Xt.minDuration, Xt.maxDuration, Qe(n)), f < 1 ? (r = (p) => {
      const g = p * f, v = g * n, b = g - l, T = Of(p, f), A = Math.exp(-v);
      return lf - b / T * A;
    }, d = (p) => {
      const v = p * f * n, b = v * l + l, T = Math.pow(f, 2) * Math.pow(p, 2) * n, A = Math.exp(-v), C = Of(Math.pow(p, 2), f);
      return (-r(p) + lf > 0 ? -1 : 1) * ((b - T) * A) / C;
    }) : (r = (p) => {
      const g = Math.exp(-p * n), v = (p - l) * n + 1;
      return -lf + g * v;
    }, d = (p) => {
      const g = Math.exp(-p * n), v = (l - p) * (n * n);
      return g * v;
    });
    const h = 5 / n, m = DE(r, d, h);
    if (n = ke(n), isNaN(m)) return {
      stiffness: Xt.stiffness,
      damping: Xt.damping,
      duration: n
    };
    {
      const p = Math.pow(m, 2) * o;
      return {
        stiffness: p,
        damping: f * 2 * Math.sqrt(o * p),
        duration: n
      };
    }
  }
  const jE = [
    "duration",
    "bounce"
  ], NE = [
    "stiffness",
    "damping",
    "mass"
  ];
  function Ny(n, i) {
    return i.some((l) => n[l] !== void 0);
  }
  function zE(n) {
    let i = {
      velocity: Xt.velocity,
      stiffness: Xt.stiffness,
      damping: Xt.damping,
      mass: Xt.mass,
      isResolvedFromDuration: false,
      ...n
    };
    if (!Ny(n, NE) && Ny(n, jE)) if (i.velocity = 0, n.visualDuration) {
      const l = n.visualDuration, o = 2 * Math.PI / (l * 1.2), r = o * o, d = 2 * xn(0.05, 1, 1 - (n.bounce || 0)) * Math.sqrt(r);
      i = {
        ...i,
        mass: Xt.mass,
        stiffness: r,
        damping: d
      };
    } else {
      const l = OE({
        ...n,
        velocity: 0
      });
      i = {
        ...i,
        ...l,
        mass: Xt.mass
      }, i.isResolvedFromDuration = true;
    }
    return i;
  }
  function or(n = Xt.visualDuration, i = Xt.bounce) {
    const l = typeof n != "object" ? {
      visualDuration: n,
      keyframes: [
        0,
        1
      ],
      bounce: i
    } : n;
    let { restSpeed: o, restDelta: r } = l;
    const d = l.keyframes[0], f = l.keyframes[l.keyframes.length - 1], h = {
      done: false,
      value: d
    }, { stiffness: m, damping: p, mass: g, duration: v, velocity: b, isResolvedFromDuration: T } = zE({
      ...l,
      velocity: -Qe(l.velocity || 0)
    }), A = b || 0, C = p / (2 * Math.sqrt(m * g)), R = f - d, O = Qe(Math.sqrt(m / g)), L = Math.abs(R) < 5;
    o || (o = L ? Xt.restSpeed.granular : Xt.restSpeed.default), r || (r = L ? Xt.restDelta.granular : Xt.restDelta.default);
    let z, V, q, $, X, G;
    if (C < 1) q = Of(O, C), $ = (A + C * O * R) / q, z = (I) => {
      const nt = Math.exp(-C * O * I);
      return f - nt * ($ * Math.sin(q * I) + R * Math.cos(q * I));
    }, X = C * O * $ + R * q, G = C * O * R - $ * q, V = (I) => Math.exp(-C * O * I) * (X * Math.sin(q * I) + G * Math.cos(q * I));
    else if (C === 1) {
      z = (nt) => f - Math.exp(-O * nt) * (R + (A + O * R) * nt);
      const I = A + O * R;
      V = (nt) => Math.exp(-O * nt) * (O * I * nt - A);
    } else {
      const I = O * Math.sqrt(C * C - 1);
      z = (ht) => {
        const mt = Math.exp(-C * O * ht), k = Math.min(I * ht, 300);
        return f - mt * ((A + C * O * R) * Math.sinh(k) + I * R * Math.cosh(k)) / I;
      };
      const nt = (A + C * O * R) / I, st = C * O * nt - R * I, gt = C * O * R - nt * I;
      V = (ht) => {
        const mt = Math.exp(-C * O * ht), k = Math.min(I * ht, 300);
        return mt * (st * Math.sinh(k) + gt * Math.cosh(k));
      };
    }
    const tt = {
      calculatedDuration: T && v || null,
      velocity: (I) => ke(V(I)),
      next: (I) => {
        if (!T && C < 1) {
          const st = Math.exp(-C * O * I), gt = Math.sin(q * I), ht = Math.cos(q * I), mt = f - st * ($ * gt + R * ht), k = ke(st * (X * gt + G * ht));
          return h.done = Math.abs(k) <= o && Math.abs(f - mt) <= r, h.value = h.done ? f : mt, h;
        }
        const nt = z(I);
        if (T) h.done = I >= v;
        else {
          const st = ke(V(I));
          h.done = Math.abs(st) <= o && Math.abs(f - nt) <= r;
        }
        return h.value = h.done ? f : nt, h;
      },
      toString: () => {
        const I = Math.min(Rd(tt), lr), nt = wb((st) => tt.next(I * st).value, I, 30);
        return I + "ms " + nt;
      },
      toTransition: () => {
      }
    };
    return tt;
  }
  or.applyToOptions = (n) => {
    const i = ME(n, 100, or);
    return n.ease = i.ease, n.duration = ke(i.duration), n.type = "keyframes", n;
  };
  const _E = 5;
  function Ab(n, i, l) {
    const o = Math.max(i - _E, 0);
    return ib(l - n(o), i - o);
  }
  function jf({ keyframes: n, velocity: i = 0, power: l = 0.8, timeConstant: o = 325, bounceDamping: r = 10, bounceStiffness: d = 500, modifyTarget: f, min: h, max: m, restDelta: p = 0.5, restSpeed: g }) {
    const v = n[0], b = {
      done: false,
      value: v
    }, T = (G) => h !== void 0 && G < h || m !== void 0 && G > m, A = (G) => h === void 0 ? m : m === void 0 || Math.abs(h - G) < Math.abs(m - G) ? h : m;
    let C = l * i;
    const R = v + C, O = f === void 0 ? R : f(R);
    O !== R && (C = O - v);
    const L = (G) => -C * Math.exp(-G / o), z = (G) => O + L(G), V = (G) => {
      const tt = L(G), I = z(G);
      b.done = Math.abs(tt) <= p, b.value = b.done ? O : I;
    };
    let q, $;
    const X = (G) => {
      T(b.value) && (q = G, $ = or({
        keyframes: [
          b.value,
          A(b.value)
        ],
        velocity: Ab(z, G, b.value),
        damping: r,
        stiffness: d,
        restDelta: p,
        restSpeed: g
      }));
    };
    return X(0), {
      calculatedDuration: null,
      next: (G) => {
        let tt = false;
        return !$ && q === void 0 && (tt = true, V(G), X(G)), q !== void 0 && G >= q ? $.next(G - q) : (!tt && V(G), b);
      }
    };
  }
  function VE(n, i, l) {
    const o = [], r = l || Si.mix || Tb, d = n.length - 1;
    for (let f = 0; f < d; f++) {
      let h = r(n[f], n[f + 1]);
      if (i) {
        const m = Array.isArray(i) ? i[f] || Fe : i;
        h = hl(m, h);
      }
      o.push(h);
    }
    return o;
  }
  function kE(n, i, { clamp: l = true, ease: o, mixer: r } = {}) {
    const d = n.length;
    if (xd(d === i.length), d === 1) return () => i[0];
    if (d === 2 && i[0] === i[1]) return () => i[1];
    const f = n[0] === n[1];
    n[0] > n[d - 1] && (n = [
      ...n
    ].reverse(), i = [
      ...i
    ].reverse());
    const h = VE(i, o, r), m = h.length, p = (g) => {
      if (f && g < n[0]) return i[0];
      let v = 0;
      if (m > 1) for (; v < n.length - 2 && !(g < n[v + 1]); v++) ;
      const b = rl(n[v], n[v + 1], g);
      return h[v](b);
    };
    return l ? (g) => p(xn(n[0], n[d - 1], g)) : p;
  }
  function LE(n, i) {
    const l = n[n.length - 1];
    for (let o = 1; o <= i; o++) {
      const r = rl(0, i, o);
      n.push(Yt(l, 1, r));
    }
  }
  function BE(n) {
    const i = [
      0
    ];
    return LE(i, n.length - 1), i;
  }
  function UE(n, i) {
    return n.map((l) => l * i);
  }
  function HE(n, i) {
    return n.map(() => i || db).splice(0, n.length - 1);
  }
  function il({ duration: n = 300, keyframes: i, times: l, ease: o = "easeInOut" }) {
    const r = QA(o) ? o.map(Cy) : Cy(o), d = {
      done: false,
      value: i[0]
    }, f = UE(l && l.length === i.length ? l : BE(i), n), h = kE(f, i, {
      ease: Array.isArray(r) ? r : HE(i, r)
    });
    return {
      calculatedDuration: n,
      next: (m) => (d.value = h(m), d.done = m >= n, d)
    };
  }
  const GE = (n) => n !== null;
  function Dd(n, { repeat: i, repeatType: l = "loop" }, o, r = 1) {
    const d = n.filter(GE), h = r < 0 || i && l !== "loop" && i % 2 === 1 ? 0 : d.length - 1;
    return !h || o === void 0 ? d[h] : o;
  }
  const YE = {
    decay: jf,
    inertia: jf,
    tween: il,
    keyframes: il,
    spring: or
  };
  function Eb(n) {
    typeof n.type == "string" && (n.type = YE[n.type]);
  }
  class Od {
    constructor() {
      this.updateFinished();
    }
    get finished() {
      return this._finished;
    }
    updateFinished() {
      this._finished = new Promise((i) => {
        this.resolve = i;
      });
    }
    notifyFinished() {
      this.resolve();
    }
    then(i, l) {
      return this.finished.then(i, l);
    }
  }
  const PE = (n) => n / 100;
  class jd extends Od {
    constructor(i) {
      super(), this.state = "idle", this.startTime = null, this.isStopped = false, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.stop = () => {
        var _a, _b2;
        const { motionValue: l } = this.options;
        l && l.updatedAt !== me.now() && this.tick(me.now()), this.isStopped = true, this.state !== "idle" && (this.teardown(), (_b2 = (_a = this.options).onStop) == null ? void 0 : _b2.call(_a));
      }, this.options = i, this.initAnimation(), this.play(), i.autoplay === false && this.pause();
    }
    initAnimation() {
      const { options: i } = this;
      Eb(i);
      const { type: l = il, repeat: o = 0, repeatDelay: r = 0, repeatType: d, velocity: f = 0 } = i;
      let { keyframes: h } = i;
      const m = l || il;
      m !== il && typeof h[0] != "number" && (this.mixKeyframes = hl(PE, Tb(h[0], h[1])), h = [
        0,
        100
      ]);
      const p = m({
        ...i,
        keyframes: h
      });
      d === "mirror" && (this.mirroredGenerator = m({
        ...i,
        keyframes: [
          ...h
        ].reverse(),
        velocity: -f
      })), p.calculatedDuration === null && (p.calculatedDuration = Rd(p));
      const { calculatedDuration: g } = p;
      this.calculatedDuration = g, this.resolvedDuration = g + r, this.totalDuration = this.resolvedDuration * (o + 1) - r, this.generator = p;
    }
    updateTime(i) {
      const l = Math.round(i - this.startTime) * this.playbackSpeed;
      this.holdTime !== null ? this.currentTime = this.holdTime : this.currentTime = l;
    }
    tick(i, l = false) {
      const { generator: o, totalDuration: r, mixKeyframes: d, mirroredGenerator: f, resolvedDuration: h, calculatedDuration: m } = this;
      if (this.startTime === null) return o.next(0);
      const { delay: p = 0, keyframes: g, repeat: v, repeatType: b, repeatDelay: T, type: A, onUpdate: C, finalKeyframe: R } = this.options;
      this.speed > 0 ? this.startTime = Math.min(this.startTime, i) : this.speed < 0 && (this.startTime = Math.min(i - r / this.speed, this.startTime)), l ? this.currentTime = i : this.updateTime(i);
      const O = this.currentTime - p * (this.playbackSpeed >= 0 ? 1 : -1), L = this.playbackSpeed >= 0 ? O < 0 : O > r;
      this.currentTime = Math.max(O, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = r);
      let z = this.currentTime, V = o;
      if (v) {
        const G = Math.min(this.currentTime, r) / h;
        let tt = Math.floor(G), I = G % 1;
        !I && G >= 1 && (I = 1), I === 1 && tt--, tt = Math.min(tt, v + 1), !!(tt % 2) && (b === "reverse" ? (I = 1 - I, T && (I -= T / h)) : b === "mirror" && (V = f)), z = xn(0, 1, I) * h;
      }
      const q = L ? {
        done: false,
        value: g[0]
      } : V.next(z);
      d && !L && (q.value = d(q.value));
      let { done: $ } = q;
      !L && m !== null && ($ = this.playbackSpeed >= 0 ? this.currentTime >= r : this.currentTime <= 0);
      const X = this.holdTime === null && (this.state === "finished" || this.state === "running" && $);
      return X && A !== jf && (q.value = Dd(g, this.options, R, this.speed)), C && C(q.value), X && this.finish(), q;
    }
    then(i, l) {
      return this.finished.then(i, l);
    }
    get duration() {
      return Qe(this.calculatedDuration);
    }
    get iterationDuration() {
      const { delay: i = 0 } = this.options || {};
      return this.duration + Qe(i);
    }
    get time() {
      return Qe(this.currentTime);
    }
    set time(i) {
      i = ke(i), this.currentTime = i, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = i : this.driver && (this.startTime = this.driver.now() - i / this.playbackSpeed), this.driver ? this.driver.start(false) : (this.startTime = 0, this.state = "paused", this.holdTime = i, this.tick(i));
    }
    getGeneratorVelocity() {
      const i = this.currentTime;
      if (i <= 0) return this.options.velocity || 0;
      if (this.generator.velocity) return this.generator.velocity(i);
      const l = this.generator.next(i).value;
      return Ab((o) => this.generator.next(o).value, i, l);
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(i) {
      const l = this.playbackSpeed !== i;
      l && this.driver && this.updateTime(me.now()), this.playbackSpeed = i, l && this.driver && (this.time = Qe(this.currentTime));
    }
    play() {
      var _a, _b2;
      if (this.isStopped) return;
      const { driver: i = CE, startTime: l } = this.options;
      this.driver || (this.driver = i((r) => this.tick(r))), (_b2 = (_a = this.options).onPlay) == null ? void 0 : _b2.call(_a);
      const o = this.driver.now();
      this.state === "finished" ? (this.updateFinished(), this.startTime = o) : this.holdTime !== null ? this.startTime = o - this.holdTime : this.startTime || (this.startTime = l ?? o), this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
    }
    pause() {
      this.state = "paused", this.updateTime(me.now()), this.holdTime = this.currentTime;
    }
    complete() {
      this.state !== "running" && this.play(), this.state = "finished", this.holdTime = null;
    }
    finish() {
      var _a, _b2;
      this.notifyFinished(), this.teardown(), this.state = "finished", (_b2 = (_a = this.options).onComplete) == null ? void 0 : _b2.call(_a);
    }
    cancel() {
      var _a, _b2;
      this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), (_b2 = (_a = this.options).onCancel) == null ? void 0 : _b2.call(_a);
    }
    teardown() {
      this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null;
    }
    stopDriver() {
      this.driver && (this.driver.stop(), this.driver = void 0);
    }
    sample(i) {
      return this.startTime = 0, this.tick(i, true);
    }
    attachTimeline(i) {
      var _a;
      return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), (_a = this.driver) == null ? void 0 : _a.stop(), i.observe(this);
    }
  }
  function qE(n) {
    for (let i = 1; i < n.length; i++) n[i] ?? (n[i] = n[i - 1]);
  }
  const Qi = (n) => n * 180 / Math.PI, Nf = (n) => {
    const i = Qi(Math.atan2(n[1], n[0]));
    return zf(i);
  }, XE = {
    x: 4,
    y: 5,
    translateX: 4,
    translateY: 5,
    scaleX: 0,
    scaleY: 3,
    scale: (n) => (Math.abs(n[0]) + Math.abs(n[3])) / 2,
    rotate: Nf,
    rotateZ: Nf,
    skewX: (n) => Qi(Math.atan(n[1])),
    skewY: (n) => Qi(Math.atan(n[2])),
    skew: (n) => (Math.abs(n[1]) + Math.abs(n[2])) / 2
  }, zf = (n) => (n = n % 360, n < 0 && (n += 360), n), zy = Nf, _y = (n) => Math.sqrt(n[0] * n[0] + n[1] * n[1]), Vy = (n) => Math.sqrt(n[4] * n[4] + n[5] * n[5]), KE = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX: _y,
    scaleY: Vy,
    scale: (n) => (_y(n) + Vy(n)) / 2,
    rotateX: (n) => zf(Qi(Math.atan2(n[6], n[5]))),
    rotateY: (n) => zf(Qi(Math.atan2(-n[2], n[0]))),
    rotateZ: zy,
    rotate: zy,
    skewX: (n) => Qi(Math.atan(n[4])),
    skewY: (n) => Qi(Math.atan(n[1])),
    skew: (n) => (Math.abs(n[1]) + Math.abs(n[4])) / 2
  };
  function _f(n) {
    return n.includes("scale") ? 1 : 0;
  }
  function Vf(n, i) {
    if (!n || n === "none") return _f(i);
    const l = n.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
    let o, r;
    if (l) o = KE, r = l;
    else {
      const h = n.match(/^matrix\(([-\d.e\s,]+)\)$/u);
      o = XE, r = h;
    }
    if (!r) return _f(i);
    const d = o[i], f = r[1].split(",").map(QE);
    return typeof d == "function" ? d(f) : f[d];
  }
  const ZE = (n, i) => {
    const { transform: l = "none" } = getComputedStyle(n);
    return Vf(l, i);
  };
  function QE(n) {
    return parseFloat(n.trim());
  }
  const es = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY"
  ], ns = new Set(es), ky = (n) => n === ts || n === rt, FE = /* @__PURE__ */ new Set([
    "x",
    "y",
    "z"
  ]), JE = es.filter((n) => !FE.has(n));
  function $E(n) {
    const i = [];
    return JE.forEach((l) => {
      const o = n.getValue(l);
      o !== void 0 && (i.push([
        l,
        o.get()
      ]), o.set(l.startsWith("scale") ? 1 : 0));
    }), i;
  }
  const vi = {
    width: ({ x: n }, { paddingLeft: i = "0", paddingRight: l = "0", boxSizing: o }) => {
      const r = n.max - n.min;
      return o === "border-box" ? r : r - parseFloat(i) - parseFloat(l);
    },
    height: ({ y: n }, { paddingTop: i = "0", paddingBottom: l = "0", boxSizing: o }) => {
      const r = n.max - n.min;
      return o === "border-box" ? r : r - parseFloat(i) - parseFloat(l);
    },
    top: (n, { top: i }) => parseFloat(i),
    left: (n, { left: i }) => parseFloat(i),
    bottom: ({ y: n }, { top: i }) => parseFloat(i) + (n.max - n.min),
    right: ({ x: n }, { left: i }) => parseFloat(i) + (n.max - n.min),
    x: (n, { transform: i }) => Vf(i, "x"),
    y: (n, { transform: i }) => Vf(i, "y")
  };
  vi.translateX = vi.x;
  vi.translateY = vi.y;
  const Fi = /* @__PURE__ */ new Set();
  let kf = false, Lf = false, Bf = false;
  function Cb() {
    if (Lf) {
      const n = Array.from(Fi).filter((o) => o.needsMeasurement), i = new Set(n.map((o) => o.element)), l = /* @__PURE__ */ new Map();
      i.forEach((o) => {
        const r = $E(o);
        r.length && (l.set(o, r), o.render());
      }), n.forEach((o) => o.measureInitialState()), i.forEach((o) => {
        o.render();
        const r = l.get(o);
        r && r.forEach(([d, f]) => {
          var _a;
          (_a = o.getValue(d)) == null ? void 0 : _a.set(f);
        });
      }), n.forEach((o) => o.measureEndState()), n.forEach((o) => {
        o.suspendedScrollY !== void 0 && window.scrollTo(0, o.suspendedScrollY);
      });
    }
    Lf = false, kf = false, Fi.forEach((n) => n.complete(Bf)), Fi.clear();
  }
  function Mb() {
    Fi.forEach((n) => {
      n.readKeyframes(), n.needsMeasurement && (Lf = true);
    });
  }
  function WE() {
    Bf = true, Mb(), Cb(), Bf = false;
  }
  class Nd {
    constructor(i, l, o, r, d, f = false) {
      this.state = "pending", this.isAsync = false, this.needsMeasurement = false, this.unresolvedKeyframes = [
        ...i
      ], this.onComplete = l, this.name = o, this.motionValue = r, this.element = d, this.isAsync = f;
    }
    scheduleResolve() {
      this.state = "scheduled", this.isAsync ? (Fi.add(this), kf || (kf = true, Lt.read(Mb), Lt.resolveKeyframes(Cb))) : (this.readKeyframes(), this.complete());
    }
    readKeyframes() {
      const { unresolvedKeyframes: i, name: l, element: o, motionValue: r } = this;
      if (i[0] === null) {
        const d = r == null ? void 0 : r.get(), f = i[i.length - 1];
        if (d !== void 0) i[0] = d;
        else if (o && l) {
          const h = o.readValue(l, f);
          h != null && (i[0] = h);
        }
        i[0] === void 0 && (i[0] = f), r && d === void 0 && r.set(i[0]);
      }
      qE(i);
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete(i = false) {
      this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, i), Fi.delete(this);
    }
    cancel() {
      this.state === "scheduled" && (Fi.delete(this), this.state = "pending");
    }
    resume() {
      this.state === "pending" && this.scheduleResolve();
    }
  }
  const IE = (n) => n.startsWith("--");
  function Rb(n, i, l) {
    IE(i) ? n.style.setProperty(i, l) : n.style[i] = l;
  }
  const tC = {};
  function Db(n, i) {
    const l = nb(n);
    return () => tC[i] ?? l();
  }
  const eC = Db(() => window.ScrollTimeline !== void 0, "scrollTimeline"), Ob = Db(() => {
    try {
      document.createElement("div").animate({
        opacity: 0
      }, {
        easing: "linear(0, 1)"
      });
    } catch {
      return false;
    }
    return true;
  }, "linearEasing"), el = ([n, i, l, o]) => `cubic-bezier(${n}, ${i}, ${l}, ${o})`, Ly = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: el([
      0,
      0.65,
      0.55,
      1
    ]),
    circOut: el([
      0.55,
      0,
      1,
      0.45
    ]),
    backIn: el([
      0.31,
      0.01,
      0.66,
      -0.59
    ]),
    backOut: el([
      0.33,
      1.53,
      0.69,
      0.99
    ])
  };
  function jb(n, i) {
    if (n) return typeof n == "function" ? Ob() ? wb(n, i) : "ease-out" : hb(n) ? el(n) : Array.isArray(n) ? n.map((l) => jb(l, i) || Ly.easeOut) : Ly[n];
  }
  function nC(n, i, l, { delay: o = 0, duration: r = 300, repeat: d = 0, repeatType: f = "loop", ease: h = "easeOut", times: m } = {}, p = void 0) {
    const g = {
      [i]: l
    };
    m && (g.offset = m);
    const v = jb(h, r);
    Array.isArray(v) && (g.easing = v);
    const b = {
      delay: o,
      duration: r,
      easing: Array.isArray(v) ? "linear" : v,
      fill: "both",
      iterations: d + 1,
      direction: f === "reverse" ? "alternate" : "normal"
    };
    return p && (b.pseudoElement = p), n.animate(g, b);
  }
  function Nb(n) {
    return typeof n == "function" && "applyToOptions" in n;
  }
  function iC({ type: n, ...i }) {
    return Nb(n) && Ob() ? n.applyToOptions(i) : (i.duration ?? (i.duration = 300), i.ease ?? (i.ease = "easeOut"), i);
  }
  class zb extends Od {
    constructor(i) {
      if (super(), this.finishedTime = null, this.isStopped = false, this.manualStartTime = null, !i) return;
      const { element: l, name: o, keyframes: r, pseudoElement: d, allowFlatten: f = false, finalKeyframe: h, onComplete: m } = i;
      this.isPseudoElement = !!d, this.allowFlatten = f, this.options = i, xd(typeof i.type != "string");
      const p = iC(i);
      this.animation = nC(l, o, r, p, d), p.autoplay === false && this.animation.pause(), this.animation.onfinish = () => {
        if (this.finishedTime = this.time, !d) {
          const g = Dd(r, this.options, h, this.speed);
          this.updateMotionValue && this.updateMotionValue(g), Rb(l, o, g), this.animation.cancel();
        }
        m == null ? void 0 : m(), this.notifyFinished();
      };
    }
    play() {
      this.isStopped || (this.manualStartTime = null, this.animation.play(), this.state === "finished" && this.updateFinished());
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      var _a, _b2;
      (_b2 = (_a = this.animation).finish) == null ? void 0 : _b2.call(_a);
    }
    cancel() {
      try {
        this.animation.cancel();
      } catch {
      }
    }
    stop() {
      if (this.isStopped) return;
      this.isStopped = true;
      const { state: i } = this;
      i === "idle" || i === "finished" || (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
    }
    commitStyles() {
      var _a, _b2, _c;
      const i = (_a = this.options) == null ? void 0 : _a.element;
      !this.isPseudoElement && (i == null ? void 0 : i.isConnected) && ((_c = (_b2 = this.animation).commitStyles) == null ? void 0 : _c.call(_b2));
    }
    get duration() {
      var _a, _b2;
      const i = ((_b2 = (_a = this.animation.effect) == null ? void 0 : _a.getComputedTiming) == null ? void 0 : _b2.call(_a).duration) || 0;
      return Qe(Number(i));
    }
    get iterationDuration() {
      const { delay: i = 0 } = this.options || {};
      return this.duration + Qe(i);
    }
    get time() {
      return Qe(Number(this.animation.currentTime) || 0);
    }
    set time(i) {
      const l = this.finishedTime !== null;
      this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = ke(i), l && this.animation.pause();
    }
    get speed() {
      return this.animation.playbackRate;
    }
    set speed(i) {
      i < 0 && (this.finishedTime = null), this.animation.playbackRate = i;
    }
    get state() {
      return this.finishedTime !== null ? "finished" : this.animation.playState;
    }
    get startTime() {
      return this.manualStartTime ?? Number(this.animation.startTime);
    }
    set startTime(i) {
      this.manualStartTime = this.animation.startTime = i;
    }
    attachTimeline({ timeline: i, rangeStart: l, rangeEnd: o, observe: r }) {
      var _a;
      return this.allowFlatten && ((_a = this.animation.effect) == null ? void 0 : _a.updateTiming({
        easing: "linear"
      })), this.animation.onfinish = null, i && eC() ? (this.animation.timeline = i, l && (this.animation.rangeStart = l), o && (this.animation.rangeEnd = o), Fe) : r(this);
    }
  }
  const _b = {
    anticipate: cb,
    backInOut: rb,
    circInOut: fb
  };
  function aC(n) {
    return n in _b;
  }
  function sC(n) {
    typeof n.ease == "string" && aC(n.ease) && (n.ease = _b[n.ease]);
  }
  const of = 10;
  class lC extends zb {
    constructor(i) {
      sC(i), Eb(i), super(i), i.startTime !== void 0 && i.autoplay !== false && (this.startTime = i.startTime), this.options = i;
    }
    updateMotionValue(i) {
      const { motionValue: l, onUpdate: o, onComplete: r, element: d, ...f } = this.options;
      if (!l) return;
      if (i !== void 0) {
        l.set(i);
        return;
      }
      const h = new jd({
        ...f,
        autoplay: false
      }), m = Math.max(of, me.now() - this.startTime), p = xn(0, of, m - of), g = h.sample(m).value, { name: v } = this.options;
      d && v && Rb(d, v, g), l.setWithVelocity(h.sample(Math.max(0, m - p)).value, g, p), h.stop();
    }
  }
  const By = (n, i) => i === "zIndex" ? false : !!(typeof n == "number" || Array.isArray(n) || typeof n == "string" && (sn.test(n) || n === "0") && !n.startsWith("url("));
  function oC(n) {
    const i = n[0];
    if (n.length === 1) return true;
    for (let l = 0; l < n.length; l++) if (n[l] !== i) return true;
  }
  function rC(n, i, l, o) {
    const r = n[0];
    if (r === null) return false;
    if (i === "display" || i === "visibility") return true;
    const d = n[n.length - 1], f = By(r, i), h = By(d, i);
    return !f || !h ? false : oC(n) || (l === "spring" || Nb(l)) && o;
  }
  function Uf(n) {
    n.duration = 0, n.type = "keyframes";
  }
  const cC = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]), uC = nb(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
  function fC(n) {
    var _a;
    const { motionValue: i, name: l, repeatDelay: o, repeatType: r, damping: d, type: f } = n;
    if (!(((_a = i == null ? void 0 : i.owner) == null ? void 0 : _a.current) instanceof HTMLElement)) return false;
    const { onUpdate: m, transformTemplate: p } = i.owner.getProps();
    return uC() && l && cC.has(l) && (l !== "transform" || !p) && !m && !o && r !== "mirror" && d !== 0 && f !== "inertia";
  }
  const dC = 40;
  class hC extends Od {
    constructor({ autoplay: i = true, delay: l = 0, type: o = "keyframes", repeat: r = 0, repeatDelay: d = 0, repeatType: f = "loop", keyframes: h, name: m, motionValue: p, element: g, ...v }) {
      var _a;
      super(), this.stop = () => {
        var _a2, _b2;
        this._animation && (this._animation.stop(), (_a2 = this.stopTimeline) == null ? void 0 : _a2.call(this)), (_b2 = this.keyframeResolver) == null ? void 0 : _b2.cancel();
      }, this.createdAt = me.now();
      const b = {
        autoplay: i,
        delay: l,
        type: o,
        repeat: r,
        repeatDelay: d,
        repeatType: f,
        name: m,
        motionValue: p,
        element: g,
        ...v
      }, T = (g == null ? void 0 : g.KeyframeResolver) || Nd;
      this.keyframeResolver = new T(h, (A, C, R) => this.onKeyframesResolved(A, C, b, !R), m, p, g), (_a = this.keyframeResolver) == null ? void 0 : _a.scheduleResolve();
    }
    onKeyframesResolved(i, l, o, r) {
      var _a, _b2;
      this.keyframeResolver = void 0;
      const { name: d, type: f, velocity: h, delay: m, isHandoff: p, onUpdate: g } = o;
      this.resolvedAt = me.now();
      let v = true;
      rC(i, d, f, h) || (v = false, (Si.instantAnimations || !m) && (g == null ? void 0 : g(Dd(i, o, l))), i[0] = i[i.length - 1], Uf(o), o.repeat = 0);
      const T = {
        startTime: r ? this.resolvedAt ? this.resolvedAt - this.createdAt > dC ? this.resolvedAt : this.createdAt : this.createdAt : void 0,
        finalKeyframe: l,
        ...o,
        keyframes: i
      }, A = v && !p && fC(T), C = (_b2 = (_a = T.motionValue) == null ? void 0 : _a.owner) == null ? void 0 : _b2.current, R = A ? new lC({
        ...T,
        element: C
      }) : new jd(T);
      R.finished.then(() => {
        this.notifyFinished();
      }).catch(Fe), this.pendingTimeline && (this.stopTimeline = R.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = R;
    }
    get finished() {
      return this._animation ? this.animation.finished : this._finished;
    }
    then(i, l) {
      return this.finished.finally(i).then(() => {
      });
    }
    get animation() {
      var _a;
      return this._animation || ((_a = this.keyframeResolver) == null ? void 0 : _a.resume(), WE()), this._animation;
    }
    get duration() {
      return this.animation.duration;
    }
    get iterationDuration() {
      return this.animation.iterationDuration;
    }
    get time() {
      return this.animation.time;
    }
    set time(i) {
      this.animation.time = i;
    }
    get speed() {
      return this.animation.speed;
    }
    get state() {
      return this.animation.state;
    }
    set speed(i) {
      this.animation.speed = i;
    }
    get startTime() {
      return this.animation.startTime;
    }
    attachTimeline(i) {
      return this._animation ? this.stopTimeline = this.animation.attachTimeline(i) : this.pendingTimeline = i, () => this.stop();
    }
    play() {
      this.animation.play();
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      this.animation.complete();
    }
    cancel() {
      var _a;
      this._animation && this.animation.cancel(), (_a = this.keyframeResolver) == null ? void 0 : _a.cancel();
    }
  }
  function Vb(n, i, l, o = 0, r = 1) {
    const d = Array.from(n).sort((p, g) => p.sortNodePosition(g)).indexOf(i), f = n.size, h = (f - 1) * o;
    return typeof l == "function" ? l(d, f) : r === 1 ? d * o : h - d * o;
  }
  const mC = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
  function pC(n) {
    const i = mC.exec(n);
    if (!i) return [
      ,
    ];
    const [, l, o, r] = i;
    return [
      `--${l ?? o}`,
      r
    ];
  }
  function kb(n, i, l = 1) {
    const [o, r] = pC(n);
    if (!o) return;
    const d = window.getComputedStyle(i).getPropertyValue(o);
    if (d) {
      const f = d.trim();
      return Iv(f) ? parseFloat(f) : f;
    }
    return Ad(r) ? kb(r, i, l + 1) : r;
  }
  const gC = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  }, yC = (n) => ({
    type: "spring",
    stiffness: 550,
    damping: n === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  }), vC = {
    type: "keyframes",
    duration: 0.8
  }, bC = {
    type: "keyframes",
    ease: [
      0.25,
      0.1,
      0.35,
      1
    ],
    duration: 0.3
  }, xC = (n, { keyframes: i }) => i.length > 2 ? vC : ns.has(n) ? n.startsWith("scale") ? yC(i[1]) : gC : bC, SC = (n) => n !== null;
  function TC(n, { repeat: i, repeatType: l = "loop" }, o) {
    const r = n.filter(SC), d = i && l !== "loop" && i % 2 === 1 ? 0 : r.length - 1;
    return r[d];
  }
  function Lb(n, i) {
    if ((n == null ? void 0 : n.inherit) && i) {
      const { inherit: l, ...o } = n;
      return {
        ...i,
        ...o
      };
    }
    return n;
  }
  function zd(n, i) {
    const l = (n == null ? void 0 : n[i]) ?? (n == null ? void 0 : n.default) ?? n;
    return l !== n ? Lb(l, n) : l;
  }
  function wC({ when: n, delay: i, delayChildren: l, staggerChildren: o, staggerDirection: r, repeat: d, repeatType: f, repeatDelay: h, from: m, elapsed: p, ...g }) {
    return !!Object.keys(g).length;
  }
  const _d = (n, i, l, o = {}, r, d) => (f) => {
    const h = zd(o, n) || {}, m = h.delay || o.delay || 0;
    let { elapsed: p = 0 } = o;
    p = p - ke(m);
    const g = {
      keyframes: Array.isArray(l) ? l : [
        null,
        l
      ],
      ease: "easeOut",
      velocity: i.getVelocity(),
      ...h,
      delay: -p,
      onUpdate: (b) => {
        i.set(b), h.onUpdate && h.onUpdate(b);
      },
      onComplete: () => {
        f(), h.onComplete && h.onComplete();
      },
      name: n,
      motionValue: i,
      element: d ? void 0 : r
    };
    wC(h) || Object.assign(g, xC(n, g)), g.duration && (g.duration = ke(g.duration)), g.repeatDelay && (g.repeatDelay = ke(g.repeatDelay)), g.from !== void 0 && (g.keyframes[0] = g.from);
    let v = false;
    if ((g.type === false || g.duration === 0 && !g.repeatDelay) && (Uf(g), g.delay === 0 && (v = true)), (Si.instantAnimations || Si.skipAnimations || (r == null ? void 0 : r.shouldSkipAnimations)) && (v = true, Uf(g), g.delay = 0), g.allowFlatten = !h.type && !h.ease, v && !d && i.get() !== void 0) {
      const b = TC(g.keyframes, h);
      if (b !== void 0) {
        Lt.update(() => {
          g.onUpdate(b), g.onComplete();
        });
        return;
      }
    }
    return h.isSync ? new jd(g) : new hC(g);
  };
  function Uy(n) {
    const i = [
      {},
      {}
    ];
    return n == null ? void 0 : n.values.forEach((l, o) => {
      i[0][o] = l.get(), i[1][o] = l.getVelocity();
    }), i;
  }
  function Vd(n, i, l, o) {
    if (typeof i == "function") {
      const [r, d] = Uy(o);
      i = i(l !== void 0 ? l : n.custom, r, d);
    }
    if (typeof i == "string" && (i = n.variants && n.variants[i]), typeof i == "function") {
      const [r, d] = Uy(o);
      i = i(l !== void 0 ? l : n.custom, r, d);
    }
    return i;
  }
  function Ji(n, i, l) {
    const o = n.getProps();
    return Vd(o, i, l !== void 0 ? l : o.custom, n);
  }
  const Bb = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...es
  ]), Hy = 30, AC = (n) => !isNaN(parseFloat(n));
  class EC {
    constructor(i, l = {}) {
      this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (o) => {
        var _a;
        const r = me.now();
        if (this.updatedAt !== r && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(o), this.current !== this.prev && ((_a = this.events.change) == null ? void 0 : _a.notify(this.current), this.dependents)) for (const d of this.dependents) d.dirty();
      }, this.hasAnimated = false, this.setCurrent(i), this.owner = l.owner;
    }
    setCurrent(i) {
      this.current = i, this.updatedAt = me.now(), this.canTrackVelocity === null && i !== void 0 && (this.canTrackVelocity = AC(this.current));
    }
    setPrevFrameValue(i = this.current) {
      this.prevFrameValue = i, this.prevUpdatedAt = this.updatedAt;
    }
    onChange(i) {
      return this.on("change", i);
    }
    on(i, l) {
      this.events[i] || (this.events[i] = new Sd());
      const o = this.events[i].add(l);
      return i === "change" ? () => {
        o(), Lt.read(() => {
          this.events.change.getSize() || this.stop();
        });
      } : o;
    }
    clearListeners() {
      for (const i in this.events) this.events[i].clear();
    }
    attach(i, l) {
      this.passiveEffect = i, this.stopPassiveEffect = l;
    }
    set(i) {
      this.passiveEffect ? this.passiveEffect(i, this.updateAndNotify) : this.updateAndNotify(i);
    }
    setWithVelocity(i, l, o) {
      this.set(l), this.prev = void 0, this.prevFrameValue = i, this.prevUpdatedAt = this.updatedAt - o;
    }
    jump(i, l = true) {
      this.updateAndNotify(i), this.prev = i, this.prevUpdatedAt = this.prevFrameValue = void 0, l && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
    }
    dirty() {
      var _a;
      (_a = this.events.change) == null ? void 0 : _a.notify(this.current);
    }
    addDependent(i) {
      this.dependents || (this.dependents = /* @__PURE__ */ new Set()), this.dependents.add(i);
    }
    removeDependent(i) {
      this.dependents && this.dependents.delete(i);
    }
    get() {
      return this.current;
    }
    getPrevious() {
      return this.prev;
    }
    getVelocity() {
      const i = me.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || i - this.updatedAt > Hy) return 0;
      const l = Math.min(this.updatedAt - this.prevUpdatedAt, Hy);
      return ib(parseFloat(this.current) - parseFloat(this.prevFrameValue), l);
    }
    start(i) {
      return this.stop(), new Promise((l) => {
        this.hasAnimated = true, this.animation = i(l), this.events.animationStart && this.events.animationStart.notify();
      }).then(() => {
        this.events.animationComplete && this.events.animationComplete.notify(), this.clearAnimation();
      });
    }
    stop() {
      this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
    }
    isAnimating() {
      return !!this.animation;
    }
    clearAnimation() {
      delete this.animation;
    }
    destroy() {
      var _a, _b2;
      (_a = this.dependents) == null ? void 0 : _a.clear(), (_b2 = this.events.destroy) == null ? void 0 : _b2.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
    }
  }
  function $a(n, i) {
    return new EC(n, i);
  }
  const Hf = (n) => Array.isArray(n);
  function CC(n, i, l) {
    n.hasValue(i) ? n.getValue(i).set(l) : n.addValue(i, $a(l));
  }
  function MC(n) {
    return Hf(n) ? n[n.length - 1] || 0 : n;
  }
  function RC(n, i) {
    const l = Ji(n, i);
    let { transitionEnd: o = {}, transition: r = {}, ...d } = l || {};
    d = {
      ...d,
      ...o
    };
    for (const f in d) {
      const h = MC(d[f]);
      CC(n, f, h);
    }
  }
  const ue = (n) => !!(n && n.getVelocity);
  function DC(n) {
    return !!(ue(n) && n.add);
  }
  function Gf(n, i) {
    const l = n.getValue("willChange");
    if (DC(l)) return l.add(i);
    if (!l && Si.WillChange) {
      const o = new Si.WillChange("auto");
      n.addValue("willChange", o), o.add(i);
    }
  }
  function kd(n) {
    return n.replace(/([A-Z])/g, (i) => `-${i.toLowerCase()}`);
  }
  const OC = "framerAppearId", Ub = "data-" + kd(OC);
  function Hb(n) {
    return n.props[Ub];
  }
  function jC({ protectedKeys: n, needsAnimating: i }, l) {
    const o = n.hasOwnProperty(l) && i[l] !== true;
    return i[l] = false, o;
  }
  function Gb(n, i, { delay: l = 0, transitionOverride: o, type: r } = {}) {
    let { transition: d, transitionEnd: f, ...h } = i;
    const m = n.getDefaultTransition();
    d = d ? Lb(d, m) : m;
    const p = d == null ? void 0 : d.reduceMotion;
    o && (d = o);
    const g = [], v = r && n.animationState && n.animationState.getState()[r];
    for (const b in h) {
      const T = n.getValue(b, n.latestValues[b] ?? null), A = h[b];
      if (A === void 0 || v && jC(v, b)) continue;
      const C = {
        delay: l,
        ...zd(d || {}, b)
      }, R = T.get();
      if (R !== void 0 && !T.isAnimating && !Array.isArray(A) && A === R && !C.velocity) continue;
      let O = false;
      if (window.MotionHandoffAnimation) {
        const V = Hb(n);
        if (V) {
          const q = window.MotionHandoffAnimation(V, b, Lt);
          q !== null && (C.startTime = q, O = true);
        }
      }
      Gf(n, b);
      const L = p ?? n.shouldReduceMotion;
      T.start(_d(b, T, A, L && Bb.has(b) ? {
        type: false
      } : C, n, O));
      const z = T.animation;
      z && g.push(z);
    }
    if (f) {
      const b = () => Lt.update(() => {
        f && RC(n, f);
      });
      g.length ? Promise.all(g).then(b) : b();
    }
    return g;
  }
  function Yf(n, i, l = {}) {
    var _a;
    const o = Ji(n, i, l.type === "exit" ? (_a = n.presenceContext) == null ? void 0 : _a.custom : void 0);
    let { transition: r = n.getDefaultTransition() || {} } = o || {};
    l.transitionOverride && (r = l.transitionOverride);
    const d = o ? () => Promise.all(Gb(n, o, l)) : () => Promise.resolve(), f = n.variantChildren && n.variantChildren.size ? (m = 0) => {
      const { delayChildren: p = 0, staggerChildren: g, staggerDirection: v } = r;
      return NC(n, i, m, p, g, v, l);
    } : () => Promise.resolve(), { when: h } = r;
    if (h) {
      const [m, p] = h === "beforeChildren" ? [
        d,
        f
      ] : [
        f,
        d
      ];
      return m().then(() => p());
    } else return Promise.all([
      d(),
      f(l.delay)
    ]);
  }
  function NC(n, i, l = 0, o = 0, r = 0, d = 1, f) {
    const h = [];
    for (const m of n.variantChildren) m.notify("AnimationStart", i), h.push(Yf(m, i, {
      ...f,
      delay: l + (typeof o == "function" ? 0 : o) + Vb(n.variantChildren, m, o, r, d)
    }).then(() => m.notify("AnimationComplete", i)));
    return Promise.all(h);
  }
  function zC(n, i, l = {}) {
    n.notify("AnimationStart", i);
    let o;
    if (Array.isArray(i)) {
      const r = i.map((d) => Yf(n, d, l));
      o = Promise.all(r);
    } else if (typeof i == "string") o = Yf(n, i, l);
    else {
      const r = typeof i == "function" ? Ji(n, i, l.custom) : i;
      o = Promise.all(Gb(n, r, l));
    }
    return o.then(() => {
      n.notify("AnimationComplete", i);
    });
  }
  const _C = {
    test: (n) => n === "auto",
    parse: (n) => n
  }, Yb = (n) => (i) => i.test(n), Pb = [
    ts,
    rt,
    bn,
    yi,
    oE,
    lE,
    _C
  ], Gy = (n) => Pb.find(Yb(n));
  function VC(n) {
    return typeof n == "number" ? n === 0 : n !== null ? n === "none" || n === "0" || eb(n) : true;
  }
  const kC = /* @__PURE__ */ new Set([
    "brightness",
    "contrast",
    "saturate",
    "opacity"
  ]);
  function LC(n) {
    const [i, l] = n.slice(0, -1).split("(");
    if (i === "drop-shadow") return n;
    const [o] = l.match(Ed) || [];
    if (!o) return n;
    const r = l.replace(o, "");
    let d = kC.has(i) ? 1 : 0;
    return o !== l && (d *= 100), i + "(" + d + r + ")";
  }
  const BC = /\b([a-z-]*)\(.*?\)/gu, Pf = {
    ...sn,
    getAnimatableNone: (n) => {
      const i = n.match(BC);
      return i ? i.map(LC).join(" ") : n;
    }
  }, qf = {
    ...sn,
    getAnimatableNone: (n) => {
      const i = sn.parse(n);
      return sn.createTransformer(n)(i.map((o) => typeof o == "number" ? 0 : typeof o == "object" ? {
        ...o,
        alpha: 1
      } : o));
    }
  }, Yy = {
    ...ts,
    transform: Math.round
  }, UC = {
    rotate: yi,
    rotateX: yi,
    rotateY: yi,
    rotateZ: yi,
    scale: Ho,
    scaleX: Ho,
    scaleY: Ho,
    scaleZ: Ho,
    skew: yi,
    skewX: yi,
    skewY: yi,
    distance: rt,
    translateX: rt,
    translateY: rt,
    translateZ: rt,
    x: rt,
    y: rt,
    z: rt,
    perspective: rt,
    transformPerspective: rt,
    opacity: cl,
    originX: Ry,
    originY: Ry,
    originZ: rt
  }, Ld = {
    borderWidth: rt,
    borderTopWidth: rt,
    borderRightWidth: rt,
    borderBottomWidth: rt,
    borderLeftWidth: rt,
    borderRadius: rt,
    borderTopLeftRadius: rt,
    borderTopRightRadius: rt,
    borderBottomRightRadius: rt,
    borderBottomLeftRadius: rt,
    width: rt,
    maxWidth: rt,
    height: rt,
    maxHeight: rt,
    top: rt,
    right: rt,
    bottom: rt,
    left: rt,
    inset: rt,
    insetBlock: rt,
    insetBlockStart: rt,
    insetBlockEnd: rt,
    insetInline: rt,
    insetInlineStart: rt,
    insetInlineEnd: rt,
    padding: rt,
    paddingTop: rt,
    paddingRight: rt,
    paddingBottom: rt,
    paddingLeft: rt,
    paddingBlock: rt,
    paddingBlockStart: rt,
    paddingBlockEnd: rt,
    paddingInline: rt,
    paddingInlineStart: rt,
    paddingInlineEnd: rt,
    margin: rt,
    marginTop: rt,
    marginRight: rt,
    marginBottom: rt,
    marginLeft: rt,
    marginBlock: rt,
    marginBlockStart: rt,
    marginBlockEnd: rt,
    marginInline: rt,
    marginInlineStart: rt,
    marginInlineEnd: rt,
    fontSize: rt,
    backgroundPositionX: rt,
    backgroundPositionY: rt,
    ...UC,
    zIndex: Yy,
    fillOpacity: cl,
    strokeOpacity: cl,
    numOctaves: Yy
  }, HC = {
    ...Ld,
    color: Wt,
    backgroundColor: Wt,
    outlineColor: Wt,
    fill: Wt,
    stroke: Wt,
    borderColor: Wt,
    borderTopColor: Wt,
    borderRightColor: Wt,
    borderBottomColor: Wt,
    borderLeftColor: Wt,
    filter: Pf,
    WebkitFilter: Pf,
    mask: qf,
    WebkitMask: qf
  }, qb = (n) => HC[n], GC = /* @__PURE__ */ new Set([
    Pf,
    qf
  ]);
  function Xb(n, i) {
    let l = qb(n);
    return GC.has(l) || (l = sn), l.getAnimatableNone ? l.getAnimatableNone(i) : void 0;
  }
  const YC = /* @__PURE__ */ new Set([
    "auto",
    "none",
    "0"
  ]);
  function PC(n, i, l) {
    let o = 0, r;
    for (; o < n.length && !r; ) {
      const d = n[o];
      typeof d == "string" && !YC.has(d) && Ja(d).values.length && (r = n[o]), o++;
    }
    if (r && l) for (const d of i) n[d] = Xb(l, r);
  }
  class qC extends Nd {
    constructor(i, l, o, r, d) {
      super(i, l, o, r, d, true);
    }
    readKeyframes() {
      const { unresolvedKeyframes: i, element: l, name: o } = this;
      if (!l || !l.current) return;
      super.readKeyframes();
      for (let g = 0; g < i.length; g++) {
        let v = i[g];
        if (typeof v == "string" && (v = v.trim(), Ad(v))) {
          const b = kb(v, l.current);
          b !== void 0 && (i[g] = b), g === i.length - 1 && (this.finalKeyframe = v);
        }
      }
      if (this.resolveNoneKeyframes(), !Bb.has(o) || i.length !== 2) return;
      const [r, d] = i, f = Gy(r), h = Gy(d), m = My(r), p = My(d);
      if (m !== p && vi[o]) {
        this.needsMeasurement = true;
        return;
      }
      if (f !== h) if (ky(f) && ky(h)) for (let g = 0; g < i.length; g++) {
        const v = i[g];
        typeof v == "string" && (i[g] = parseFloat(v));
      }
      else vi[o] && (this.needsMeasurement = true);
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes: i, name: l } = this, o = [];
      for (let r = 0; r < i.length; r++) (i[r] === null || VC(i[r])) && o.push(r);
      o.length && PC(i, o, l);
    }
    measureInitialState() {
      const { element: i, unresolvedKeyframes: l, name: o } = this;
      if (!i || !i.current) return;
      o === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = vi[o](i.measureViewportBox(), window.getComputedStyle(i.current)), l[0] = this.measuredOrigin;
      const r = l[l.length - 1];
      r !== void 0 && i.getValue(o, r).jump(r, false);
    }
    measureEndState() {
      var _a;
      const { element: i, name: l, unresolvedKeyframes: o } = this;
      if (!i || !i.current) return;
      const r = i.getValue(l);
      r && r.jump(this.measuredOrigin, false);
      const d = o.length - 1, f = o[d];
      o[d] = vi[l](i.measureViewportBox(), window.getComputedStyle(i.current)), f !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = f), ((_a = this.removedTransforms) == null ? void 0 : _a.length) && this.removedTransforms.forEach(([h, m]) => {
        i.getValue(h).set(m);
      }), this.resolveNoneKeyframes();
    }
  }
  const XC = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]);
  function Kb(n, i, l) {
    if (n == null) return [];
    if (n instanceof EventTarget) return [
      n
    ];
    if (typeof n == "string") {
      let o = document;
      const r = (l == null ? void 0 : l[n]) ?? o.querySelectorAll(n);
      return r ? Array.from(r) : [];
    }
    return Array.from(n).filter((o) => o != null);
  }
  const Zb = (n, i) => i && typeof n == "number" ? i.transform(n) : n;
  function Ko(n) {
    return tb(n) && "offsetHeight" in n && !("ownerSVGElement" in n);
  }
  const { schedule: Bd } = mb(queueMicrotask, false), an = {
    x: false,
    y: false
  };
  function Qb() {
    return an.x || an.y;
  }
  function KC(n) {
    return n === "x" || n === "y" ? an[n] ? null : (an[n] = true, () => {
      an[n] = false;
    }) : an.x || an.y ? null : (an.x = an.y = true, () => {
      an.x = an.y = false;
    });
  }
  function Fb(n, i) {
    const l = Kb(n), o = new AbortController(), r = {
      passive: true,
      ...i,
      signal: o.signal
    };
    return [
      l,
      r,
      () => o.abort()
    ];
  }
  function ZC(n) {
    return !(n.pointerType === "touch" || Qb());
  }
  function QC(n, i, l = {}) {
    const [o, r, d] = Fb(n, l);
    return o.forEach((f) => {
      let h = false, m = false, p;
      const g = () => {
        f.removeEventListener("pointerleave", A);
      }, v = (R) => {
        p && (p(R), p = void 0), g();
      }, b = (R) => {
        h = false, window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", b), m && (m = false, v(R));
      }, T = () => {
        h = true, window.addEventListener("pointerup", b, r), window.addEventListener("pointercancel", b, r);
      }, A = (R) => {
        if (R.pointerType !== "touch") {
          if (h) {
            m = true;
            return;
          }
          v(R);
        }
      }, C = (R) => {
        if (!ZC(R)) return;
        m = false;
        const O = i(f, R);
        typeof O == "function" && (p = O, f.addEventListener("pointerleave", A, r));
      };
      f.addEventListener("pointerenter", C, r), f.addEventListener("pointerdown", T, r);
    }), d;
  }
  const Jb = (n, i) => i ? n === i ? true : Jb(n, i.parentElement) : false, Ud = (n) => n.pointerType === "mouse" ? typeof n.button != "number" || n.button <= 0 : n.isPrimary !== false, FC = /* @__PURE__ */ new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A"
  ]);
  function JC(n) {
    return FC.has(n.tagName) || n.isContentEditable === true;
  }
  const $C = /* @__PURE__ */ new Set([
    "INPUT",
    "SELECT",
    "TEXTAREA"
  ]);
  function WC(n) {
    return $C.has(n.tagName) || n.isContentEditable === true;
  }
  const Zo = /* @__PURE__ */ new WeakSet();
  function Py(n) {
    return (i) => {
      i.key === "Enter" && n(i);
    };
  }
  function rf(n, i) {
    n.dispatchEvent(new PointerEvent("pointer" + i, {
      isPrimary: true,
      bubbles: true
    }));
  }
  const IC = (n, i) => {
    const l = n.currentTarget;
    if (!l) return;
    const o = Py(() => {
      if (Zo.has(l)) return;
      rf(l, "down");
      const r = Py(() => {
        rf(l, "up");
      }), d = () => rf(l, "cancel");
      l.addEventListener("keyup", r, i), l.addEventListener("blur", d, i);
    });
    l.addEventListener("keydown", o, i), l.addEventListener("blur", () => l.removeEventListener("keydown", o), i);
  };
  function qy(n) {
    return Ud(n) && !Qb();
  }
  const Xy = /* @__PURE__ */ new WeakSet();
  function tM(n, i, l = {}) {
    const [o, r, d] = Fb(n, l), f = (h) => {
      const m = h.currentTarget;
      if (!qy(h) || Xy.has(h)) return;
      Zo.add(m), l.stopPropagation && Xy.add(h);
      const p = i(m, h), g = (T, A) => {
        window.removeEventListener("pointerup", v), window.removeEventListener("pointercancel", b), Zo.has(m) && Zo.delete(m), qy(T) && typeof p == "function" && p(T, {
          success: A
        });
      }, v = (T) => {
        g(T, m === window || m === document || l.useGlobalTarget || Jb(m, T.target));
      }, b = (T) => {
        g(T, false);
      };
      window.addEventListener("pointerup", v, r), window.addEventListener("pointercancel", b, r);
    };
    return o.forEach((h) => {
      (l.useGlobalTarget ? window : h).addEventListener("pointerdown", f, r), Ko(h) && (h.addEventListener("focus", (p) => IC(p, r)), !JC(h) && !h.hasAttribute("tabindex") && (h.tabIndex = 0));
    }), d;
  }
  function Hd(n) {
    return tb(n) && "ownerSVGElement" in n;
  }
  const Qo = /* @__PURE__ */ new WeakMap();
  let Fo;
  const $b = (n, i, l) => (o, r) => r && r[0] ? r[0][n + "Size"] : Hd(o) && "getBBox" in o ? o.getBBox()[i] : o[l], eM = $b("inline", "width", "offsetWidth"), nM = $b("block", "height", "offsetHeight");
  function iM({ target: n, borderBoxSize: i }) {
    var _a;
    (_a = Qo.get(n)) == null ? void 0 : _a.forEach((l) => {
      l(n, {
        get width() {
          return eM(n, i);
        },
        get height() {
          return nM(n, i);
        }
      });
    });
  }
  function aM(n) {
    n.forEach(iM);
  }
  function sM() {
    typeof ResizeObserver > "u" || (Fo = new ResizeObserver(aM));
  }
  function lM(n, i) {
    Fo || sM();
    const l = Kb(n);
    return l.forEach((o) => {
      let r = Qo.get(o);
      r || (r = /* @__PURE__ */ new Set(), Qo.set(o, r)), r.add(i), Fo == null ? void 0 : Fo.observe(o);
    }), () => {
      l.forEach((o) => {
        const r = Qo.get(o);
        r == null ? void 0 : r.delete(i), (r == null ? void 0 : r.size) || (Fo == null ? void 0 : Fo.unobserve(o));
      });
    };
  }
  const Jo = /* @__PURE__ */ new Set();
  let Ga;
  function oM() {
    Ga = () => {
      const n = {
        get width() {
          return window.innerWidth;
        },
        get height() {
          return window.innerHeight;
        }
      };
      Jo.forEach((i) => i(n));
    }, window.addEventListener("resize", Ga);
  }
  function rM(n) {
    return Jo.add(n), Ga || oM(), () => {
      Jo.delete(n), !Jo.size && typeof Ga == "function" && (window.removeEventListener("resize", Ga), Ga = void 0);
    };
  }
  function Ky(n, i) {
    return typeof n == "function" ? rM(n) : lM(n, i);
  }
  function cM(n) {
    return Hd(n) && n.tagName === "svg";
  }
  const uM = [
    ...Pb,
    Wt,
    sn
  ], fM = (n) => uM.find(Yb(n)), Zy = () => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0
  }), Ya = () => ({
    x: Zy(),
    y: Zy()
  }), Qy = () => ({
    min: 0,
    max: 0
  }), ee = () => ({
    x: Qy(),
    y: Qy()
  }), dM = /* @__PURE__ */ new WeakMap();
  function wr(n) {
    return n !== null && typeof n == "object" && typeof n.start == "function";
  }
  function ul(n) {
    return typeof n == "string" || Array.isArray(n);
  }
  const Gd = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit"
  ], Yd = [
    "initial",
    ...Gd
  ];
  function Ar(n) {
    return wr(n.animate) || Yd.some((i) => ul(n[i]));
  }
  function Wb(n) {
    return !!(Ar(n) || n.variants);
  }
  function hM(n, i, l) {
    for (const o in i) {
      const r = i[o], d = l[o];
      if (ue(r)) n.addValue(o, r);
      else if (ue(d)) n.addValue(o, $a(r, {
        owner: n
      }));
      else if (d !== r) if (n.hasValue(o)) {
        const f = n.getValue(o);
        f.liveStyle === true ? f.jump(r) : f.hasAnimated || f.set(r);
      } else {
        const f = n.getStaticValue(o);
        n.addValue(o, $a(f !== void 0 ? f : r, {
          owner: n
        }));
      }
    }
    for (const o in l) i[o] === void 0 && n.removeValue(o);
    return i;
  }
  const Xf = {
    current: null
  }, Ib = {
    current: false
  }, mM = typeof window < "u";
  function pM() {
    if (Ib.current = true, !!mM) if (window.matchMedia) {
      const n = window.matchMedia("(prefers-reduced-motion)"), i = () => Xf.current = n.matches;
      n.addEventListener("change", i), i();
    } else Xf.current = false;
  }
  const Fy = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete"
  ];
  let rr = {};
  function tx(n) {
    rr = n;
  }
  function gM() {
    return rr;
  }
  class yM {
    scrapeMotionValuesFromProps(i, l, o) {
      return {};
    }
    constructor({ parent: i, props: l, presenceContext: o, reducedMotionConfig: r, skipAnimations: d, blockInitialAnimation: f, visualState: h }, m = {}) {
      this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = false, this.isControllingVariants = false, this.shouldReduceMotion = null, this.shouldSkipAnimations = false, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = Nd, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = false, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
        this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
      }, this.renderScheduledAt = 0, this.scheduleRender = () => {
        const T = me.now();
        this.renderScheduledAt < T && (this.renderScheduledAt = T, Lt.render(this.render, false, true));
      };
      const { latestValues: p, renderState: g } = h;
      this.latestValues = p, this.baseTarget = {
        ...p
      }, this.initialValues = l.initial ? {
        ...p
      } : {}, this.renderState = g, this.parent = i, this.props = l, this.presenceContext = o, this.depth = i ? i.depth + 1 : 0, this.reducedMotionConfig = r, this.skipAnimationsConfig = d, this.options = m, this.blockInitialAnimation = !!f, this.isControllingVariants = Ar(l), this.isVariantNode = Wb(l), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(i && i.current);
      const { willChange: v, ...b } = this.scrapeMotionValuesFromProps(l, {}, this);
      for (const T in b) {
        const A = b[T];
        p[T] !== void 0 && ue(A) && A.set(p[T]);
      }
    }
    mount(i) {
      var _a, _b2;
      if (this.hasBeenMounted) for (const l in this.initialValues) (_a = this.values.get(l)) == null ? void 0 : _a.jump(this.initialValues[l]), this.latestValues[l] = this.initialValues[l];
      this.current = i, dM.set(i, this), this.projection && !this.projection.instance && this.projection.mount(i), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((l, o) => this.bindToMotionValue(o, l)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = false : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = true : (Ib.current || pM(), this.shouldReduceMotion = Xf.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? false, (_b2 = this.parent) == null ? void 0 : _b2.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = true;
    }
    unmount() {
      var _a;
      this.projection && this.projection.unmount(), Ti(this.notifyUpdate), Ti(this.render), this.valueSubscriptions.forEach((i) => i()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), (_a = this.parent) == null ? void 0 : _a.removeChild(this);
      for (const i in this.events) this.events[i].clear();
      for (const i in this.features) {
        const l = this.features[i];
        l && (l.unmount(), l.isMounted = false);
      }
      this.current = null;
    }
    addChild(i) {
      this.children.add(i), this.enteringChildren ?? (this.enteringChildren = /* @__PURE__ */ new Set()), this.enteringChildren.add(i);
    }
    removeChild(i) {
      this.children.delete(i), this.enteringChildren && this.enteringChildren.delete(i);
    }
    bindToMotionValue(i, l) {
      if (this.valueSubscriptions.has(i) && this.valueSubscriptions.get(i)(), l.accelerate && XC.has(i) && this.current instanceof HTMLElement) {
        const { factory: f, keyframes: h, times: m, ease: p, duration: g } = l.accelerate, v = new zb({
          element: this.current,
          name: i,
          keyframes: h,
          times: m,
          ease: p,
          duration: ke(g)
        }), b = f(v);
        this.valueSubscriptions.set(i, () => {
          b(), v.cancel();
        });
        return;
      }
      const o = ns.has(i);
      o && this.onBindTransform && this.onBindTransform();
      const r = l.on("change", (f) => {
        this.latestValues[i] = f, this.props.onUpdate && Lt.preRender(this.notifyUpdate), o && this.projection && (this.projection.isTransformDirty = true), this.scheduleRender();
      });
      let d;
      typeof window < "u" && window.MotionCheckAppearSync && (d = window.MotionCheckAppearSync(this, i, l)), this.valueSubscriptions.set(i, () => {
        r(), d && d(), l.owner && l.stop();
      });
    }
    sortNodePosition(i) {
      return !this.current || !this.sortInstanceNodePosition || this.type !== i.type ? 0 : this.sortInstanceNodePosition(this.current, i.current);
    }
    updateFeatures() {
      let i = "animation";
      for (i in rr) {
        const l = rr[i];
        if (!l) continue;
        const { isEnabled: o, Feature: r } = l;
        if (!this.features[i] && r && o(this.props) && (this.features[i] = new r(this)), this.features[i]) {
          const d = this.features[i];
          d.isMounted ? d.update() : (d.mount(), d.isMounted = true);
        }
      }
    }
    triggerBuild() {
      this.build(this.renderState, this.latestValues, this.props);
    }
    measureViewportBox() {
      return this.current ? this.measureInstanceViewportBox(this.current, this.props) : ee();
    }
    getStaticValue(i) {
      return this.latestValues[i];
    }
    setStaticValue(i, l) {
      this.latestValues[i] = l;
    }
    update(i, l) {
      (i.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = i, this.prevPresenceContext = this.presenceContext, this.presenceContext = l;
      for (let o = 0; o < Fy.length; o++) {
        const r = Fy[o];
        this.propEventSubscriptions[r] && (this.propEventSubscriptions[r](), delete this.propEventSubscriptions[r]);
        const d = "on" + r, f = i[d];
        f && (this.propEventSubscriptions[r] = this.on(r, f));
      }
      this.prevMotionValues = hM(this, this.scrapeMotionValuesFromProps(i, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
    }
    getProps() {
      return this.props;
    }
    getVariant(i) {
      return this.props.variants ? this.props.variants[i] : void 0;
    }
    getDefaultTransition() {
      return this.props.transition;
    }
    getTransformPagePoint() {
      return this.props.transformPagePoint;
    }
    getClosestVariantNode() {
      return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
    }
    addVariantChild(i) {
      const l = this.getClosestVariantNode();
      if (l) return l.variantChildren && l.variantChildren.add(i), () => l.variantChildren.delete(i);
    }
    addValue(i, l) {
      const o = this.values.get(i);
      l !== o && (o && this.removeValue(i), this.bindToMotionValue(i, l), this.values.set(i, l), this.latestValues[i] = l.get());
    }
    removeValue(i) {
      this.values.delete(i);
      const l = this.valueSubscriptions.get(i);
      l && (l(), this.valueSubscriptions.delete(i)), delete this.latestValues[i], this.removeValueFromRenderState(i, this.renderState);
    }
    hasValue(i) {
      return this.values.has(i);
    }
    getValue(i, l) {
      if (this.props.values && this.props.values[i]) return this.props.values[i];
      let o = this.values.get(i);
      return o === void 0 && l !== void 0 && (o = $a(l === null ? void 0 : l, {
        owner: this
      }), this.addValue(i, o)), o;
    }
    readValue(i, l) {
      let o = this.latestValues[i] !== void 0 || !this.current ? this.latestValues[i] : this.getBaseTargetFromProps(this.props, i) ?? this.readValueFromInstance(this.current, i, this.options);
      return o != null && (typeof o == "string" && (Iv(o) || eb(o)) ? o = parseFloat(o) : !fM(o) && sn.test(l) && (o = Xb(i, l)), this.setBaseTarget(i, ue(o) ? o.get() : o)), ue(o) ? o.get() : o;
    }
    setBaseTarget(i, l) {
      this.baseTarget[i] = l;
    }
    getBaseTarget(i) {
      var _a;
      const { initial: l } = this.props;
      let o;
      if (typeof l == "string" || typeof l == "object") {
        const d = Vd(this.props, l, (_a = this.presenceContext) == null ? void 0 : _a.custom);
        d && (o = d[i]);
      }
      if (l && o !== void 0) return o;
      const r = this.getBaseTargetFromProps(this.props, i);
      return r !== void 0 && !ue(r) ? r : this.initialValues[i] !== void 0 && o === void 0 ? void 0 : this.baseTarget[i];
    }
    on(i, l) {
      return this.events[i] || (this.events[i] = new Sd()), this.events[i].add(l);
    }
    notify(i, ...l) {
      this.events[i] && this.events[i].notify(...l);
    }
    scheduleRenderMicrotask() {
      Bd.render(this.render);
    }
  }
  class ex extends yM {
    constructor() {
      super(...arguments), this.KeyframeResolver = qC;
    }
    sortInstanceNodePosition(i, l) {
      return i.compareDocumentPosition(l) & 2 ? 1 : -1;
    }
    getBaseTargetFromProps(i, l) {
      const o = i.style;
      return o ? o[l] : void 0;
    }
    removeValueFromRenderState(i, { vars: l, style: o }) {
      delete l[i], delete o[i];
    }
    handleChildMotionValue() {
      this.childSubscription && (this.childSubscription(), delete this.childSubscription);
      const { children: i } = this.props;
      ue(i) && (this.childSubscription = i.on("change", (l) => {
        this.current && (this.current.textContent = `${l}`);
      }));
    }
  }
  class Ai {
    constructor(i) {
      this.isMounted = false, this.node = i;
    }
    update() {
    }
  }
  function nx({ top: n, left: i, right: l, bottom: o }) {
    return {
      x: {
        min: i,
        max: l
      },
      y: {
        min: n,
        max: o
      }
    };
  }
  function vM({ x: n, y: i }) {
    return {
      top: i.min,
      right: n.max,
      bottom: i.max,
      left: n.min
    };
  }
  function bM(n, i) {
    if (!i) return n;
    const l = i({
      x: n.left,
      y: n.top
    }), o = i({
      x: n.right,
      y: n.bottom
    });
    return {
      top: l.y,
      left: l.x,
      bottom: o.y,
      right: o.x
    };
  }
  function cf(n) {
    return n === void 0 || n === 1;
  }
  function Kf({ scale: n, scaleX: i, scaleY: l }) {
    return !cf(n) || !cf(i) || !cf(l);
  }
  function Ki(n) {
    return Kf(n) || ix(n) || n.z || n.rotate || n.rotateX || n.rotateY || n.skewX || n.skewY;
  }
  function ix(n) {
    return Jy(n.x) || Jy(n.y);
  }
  function Jy(n) {
    return n && n !== "0%";
  }
  function cr(n, i, l) {
    const o = n - l, r = i * o;
    return l + r;
  }
  function $y(n, i, l, o, r) {
    return r !== void 0 && (n = cr(n, r, o)), cr(n, l, o) + i;
  }
  function Zf(n, i = 0, l = 1, o, r) {
    n.min = $y(n.min, i, l, o, r), n.max = $y(n.max, i, l, o, r);
  }
  function ax(n, { x: i, y: l }) {
    Zf(n.x, i.translate, i.scale, i.originPoint), Zf(n.y, l.translate, l.scale, l.originPoint);
  }
  const Wy = 0.999999999999, Iy = 1.0000000000001;
  function xM(n, i, l, o = false) {
    var _a;
    const r = l.length;
    if (!r) return;
    i.x = i.y = 1;
    let d, f;
    for (let h = 0; h < r; h++) {
      d = l[h], f = d.projectionDelta;
      const { visualElement: m } = d.options;
      m && m.props.style && m.props.style.display === "contents" || (o && d.options.layoutScroll && d.scroll && d !== d.root && qa(n, {
        x: -d.scroll.offset.x,
        y: -d.scroll.offset.y
      }), f && (i.x *= f.x.scale, i.y *= f.y.scale, ax(n, f)), o && Ki(d.latestValues) && qa(n, d.latestValues, (_a = d.layout) == null ? void 0 : _a.layoutBox));
    }
    i.x < Iy && i.x > Wy && (i.x = 1), i.y < Iy && i.y > Wy && (i.y = 1);
  }
  function Pa(n, i) {
    n.min = n.min + i, n.max = n.max + i;
  }
  function t0(n, i, l, o, r = 0.5) {
    const d = Yt(n.min, n.max, r);
    Zf(n, i, l, d, o);
  }
  function e0(n, i) {
    return typeof n == "string" ? parseFloat(n) / 100 * (i.max - i.min) : n;
  }
  function qa(n, i, l) {
    const o = l ?? n;
    t0(n.x, e0(i.x, o.x), i.scaleX, i.scale, i.originX), t0(n.y, e0(i.y, o.y), i.scaleY, i.scale, i.originY);
  }
  function sx(n, i) {
    return nx(bM(n.getBoundingClientRect(), i));
  }
  function SM(n, i, l) {
    const o = sx(n, l), { scroll: r } = i;
    return r && (Pa(o.x, r.offset.x), Pa(o.y, r.offset.y)), o;
  }
  const TM = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  }, wM = es.length;
  function AM(n, i, l) {
    let o = "", r = true;
    for (let d = 0; d < wM; d++) {
      const f = es[d], h = n[f];
      if (h === void 0) continue;
      let m = true;
      if (typeof h == "number") m = h === (f.startsWith("scale") ? 1 : 0);
      else {
        const p = parseFloat(h);
        m = f.startsWith("scale") ? p === 1 : p === 0;
      }
      if (!m || l) {
        const p = Zb(h, Ld[f]);
        if (!m) {
          r = false;
          const g = TM[f] || f;
          o += `${g}(${p}) `;
        }
        l && (i[f] = p);
      }
    }
    return o = o.trim(), l ? o = l(i, r ? "" : o) : r && (o = "none"), o;
  }
  function Pd(n, i, l) {
    const { style: o, vars: r, transformOrigin: d } = n;
    let f = false, h = false;
    for (const m in i) {
      const p = i[m];
      if (ns.has(m)) {
        f = true;
        continue;
      } else if (gb(m)) {
        r[m] = p;
        continue;
      } else {
        const g = Zb(p, Ld[m]);
        m.startsWith("origin") ? (h = true, d[m] = g) : o[m] = g;
      }
    }
    if (i.transform || (f || l ? o.transform = AM(i, n.transform, l) : o.transform && (o.transform = "none")), h) {
      const { originX: m = "50%", originY: p = "50%", originZ: g = 0 } = d;
      o.transformOrigin = `${m} ${p} ${g}`;
    }
  }
  function lx(n, { style: i, vars: l }, o, r) {
    const d = n.style;
    let f;
    for (f in i) d[f] = i[f];
    r == null ? void 0 : r.applyProjectionStyles(d, o);
    for (f in l) d.setProperty(f, l[f]);
  }
  function n0(n, i) {
    return i.max === i.min ? 0 : n / (i.max - i.min) * 100;
  }
  const tl = {
    correct: (n, i) => {
      if (!i.target) return n;
      if (typeof n == "string") if (rt.test(n)) n = parseFloat(n);
      else return n;
      const l = n0(n, i.target.x), o = n0(n, i.target.y);
      return `${l}% ${o}%`;
    }
  }, EM = {
    correct: (n, { treeScale: i, projectionDelta: l }) => {
      const o = n, r = sn.parse(n);
      if (r.length > 5) return o;
      const d = sn.createTransformer(n), f = typeof r[0] != "number" ? 1 : 0, h = l.x.scale * i.x, m = l.y.scale * i.y;
      r[0 + f] /= h, r[1 + f] /= m;
      const p = Yt(h, m, 0.5);
      return typeof r[2 + f] == "number" && (r[2 + f] /= p), typeof r[3 + f] == "number" && (r[3 + f] /= p), d(r);
    }
  }, Qf = {
    borderRadius: {
      ...tl,
      applyTo: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius"
      ]
    },
    borderTopLeftRadius: tl,
    borderTopRightRadius: tl,
    borderBottomLeftRadius: tl,
    borderBottomRightRadius: tl,
    boxShadow: EM
  };
  function ox(n, { layout: i, layoutId: l }) {
    return ns.has(n) || n.startsWith("origin") || (i || l !== void 0) && (!!Qf[n] || n === "opacity");
  }
  function qd(n, i, l) {
    var _a;
    const o = n.style, r = i == null ? void 0 : i.style, d = {};
    if (!o) return d;
    for (const f in o) (ue(o[f]) || r && ue(r[f]) || ox(f, n) || ((_a = l == null ? void 0 : l.getValue(f)) == null ? void 0 : _a.liveStyle) !== void 0) && (d[f] = o[f]);
    return d;
  }
  function CM(n) {
    return window.getComputedStyle(n);
  }
  class MM extends ex {
    constructor() {
      super(...arguments), this.type = "html", this.renderInstance = lx;
    }
    readValueFromInstance(i, l) {
      var _a;
      if (ns.has(l)) return ((_a = this.projection) == null ? void 0 : _a.isProjecting) ? _f(l) : ZE(i, l);
      {
        const o = CM(i), r = (gb(l) ? o.getPropertyValue(l) : o[l]) || 0;
        return typeof r == "string" ? r.trim() : r;
      }
    }
    measureInstanceViewportBox(i, { transformPagePoint: l }) {
      return sx(i, l);
    }
    build(i, l, o) {
      Pd(i, l, o.transformTemplate);
    }
    scrapeMotionValuesFromProps(i, l, o) {
      return qd(i, l, o);
    }
  }
  const RM = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  }, DM = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  };
  function OM(n, i, l = 1, o = 0, r = true) {
    n.pathLength = 1;
    const d = r ? RM : DM;
    n[d.offset] = `${-o}`, n[d.array] = `${i} ${l}`;
  }
  const jM = [
    "offsetDistance",
    "offsetPath",
    "offsetRotate",
    "offsetAnchor"
  ];
  function rx(n, { attrX: i, attrY: l, attrScale: o, pathLength: r, pathSpacing: d = 1, pathOffset: f = 0, ...h }, m, p, g) {
    if (Pd(n, h, p), m) {
      n.style.viewBox && (n.attrs.viewBox = n.style.viewBox);
      return;
    }
    n.attrs = n.style, n.style = {};
    const { attrs: v, style: b } = n;
    v.transform && (b.transform = v.transform, delete v.transform), (b.transform || v.transformOrigin) && (b.transformOrigin = v.transformOrigin ?? "50% 50%", delete v.transformOrigin), b.transform && (b.transformBox = (g == null ? void 0 : g.transformBox) ?? "fill-box", delete v.transformBox);
    for (const T of jM) v[T] !== void 0 && (b[T] = v[T], delete v[T]);
    i !== void 0 && (v.x = i), l !== void 0 && (v.y = l), o !== void 0 && (v.scale = o), r !== void 0 && OM(v, r, d, f, false);
  }
  const cx = /* @__PURE__ */ new Set([
    "baseFrequency",
    "diffuseConstant",
    "kernelMatrix",
    "kernelUnitLength",
    "keySplines",
    "keyTimes",
    "limitingConeAngle",
    "markerHeight",
    "markerWidth",
    "numOctaves",
    "targetX",
    "targetY",
    "surfaceScale",
    "specularConstant",
    "specularExponent",
    "stdDeviation",
    "tableValues",
    "viewBox",
    "gradientTransform",
    "pathLength",
    "startOffset",
    "textLength",
    "lengthAdjust"
  ]), ux = (n) => typeof n == "string" && n.toLowerCase() === "svg";
  function NM(n, i, l, o) {
    lx(n, i, void 0, o);
    for (const r in i.attrs) n.setAttribute(cx.has(r) ? r : kd(r), i.attrs[r]);
  }
  function fx(n, i, l) {
    const o = qd(n, i, l);
    for (const r in n) if (ue(n[r]) || ue(i[r])) {
      const d = es.indexOf(r) !== -1 ? "attr" + r.charAt(0).toUpperCase() + r.substring(1) : r;
      o[d] = n[r];
    }
    return o;
  }
  class zM extends ex {
    constructor() {
      super(...arguments), this.type = "svg", this.isSVGTag = false, this.measureInstanceViewportBox = ee;
    }
    getBaseTargetFromProps(i, l) {
      return i[l];
    }
    readValueFromInstance(i, l) {
      if (ns.has(l)) {
        const o = qb(l);
        return o && o.default || 0;
      }
      return l = cx.has(l) ? l : kd(l), i.getAttribute(l);
    }
    scrapeMotionValuesFromProps(i, l, o) {
      return fx(i, l, o);
    }
    build(i, l, o) {
      rx(i, l, this.isSVGTag, o.transformTemplate, o.style);
    }
    renderInstance(i, l, o, r) {
      NM(i, l, o, r);
    }
    mount(i) {
      this.isSVGTag = ux(i.tagName), super.mount(i);
    }
  }
  const _M = Yd.length;
  function dx(n) {
    if (!n) return;
    if (!n.isControllingVariants) {
      const l = n.parent ? dx(n.parent) || {} : {};
      return n.props.initial !== void 0 && (l.initial = n.props.initial), l;
    }
    const i = {};
    for (let l = 0; l < _M; l++) {
      const o = Yd[l], r = n.props[o];
      (ul(r) || r === false) && (i[o] = r);
    }
    return i;
  }
  function hx(n, i) {
    if (!Array.isArray(i)) return false;
    const l = i.length;
    if (l !== n.length) return false;
    for (let o = 0; o < l; o++) if (i[o] !== n[o]) return false;
    return true;
  }
  const VM = [
    ...Gd
  ].reverse(), kM = Gd.length;
  function LM(n) {
    return (i) => Promise.all(i.map(({ animation: l, options: o }) => zC(n, l, o)));
  }
  function BM(n) {
    let i = LM(n), l = i0(), o = true, r = false;
    const d = (p) => (g, v) => {
      var _a;
      const b = Ji(n, v, p === "exit" ? (_a = n.presenceContext) == null ? void 0 : _a.custom : void 0);
      if (b) {
        const { transition: T, transitionEnd: A, ...C } = b;
        g = {
          ...g,
          ...C,
          ...A
        };
      }
      return g;
    };
    function f(p) {
      i = p(n);
    }
    function h(p) {
      const { props: g } = n, v = dx(n.parent) || {}, b = [], T = /* @__PURE__ */ new Set();
      let A = {}, C = 1 / 0;
      for (let O = 0; O < kM; O++) {
        const L = VM[O], z = l[L], V = g[L] !== void 0 ? g[L] : v[L], q = ul(V), $ = L === p ? z.isActive : null;
        $ === false && (C = O);
        let X = V === v[L] && V !== g[L] && q;
        if (X && (o || r) && n.manuallyAnimateOnMount && (X = false), z.protectedKeys = {
          ...A
        }, !z.isActive && $ === null || !V && !z.prevProp || wr(V) || typeof V == "boolean") continue;
        if (L === "exit" && z.isActive && $ !== true) {
          z.prevResolvedValues && (A = {
            ...A,
            ...z.prevResolvedValues
          });
          continue;
        }
        const G = UM(z.prevProp, V);
        let tt = G || L === p && z.isActive && !X && q || O > C && q, I = false;
        const nt = Array.isArray(V) ? V : [
          V
        ];
        let st = nt.reduce(d(L), {});
        $ === false && (st = {});
        const { prevResolvedValues: gt = {} } = z, ht = {
          ...gt,
          ...st
        }, mt = (Z) => {
          tt = true, T.has(Z) && (I = true, T.delete(Z)), z.needsAnimating[Z] = true;
          const it = n.getValue(Z);
          it && (it.liveStyle = false);
        };
        for (const Z in ht) {
          const it = st[Z], N = gt[Z];
          if (A.hasOwnProperty(Z)) continue;
          let E = false;
          Hf(it) && Hf(N) ? E = !hx(it, N) : E = it !== N, E ? it != null ? mt(Z) : T.add(Z) : it !== void 0 && T.has(Z) ? mt(Z) : z.protectedKeys[Z] = true;
        }
        z.prevProp = V, z.prevResolvedValues = st, z.isActive && (A = {
          ...A,
          ...st
        }), (o || r) && n.blockInitialAnimation && (tt = false);
        const k = X && G;
        tt && (!k || I) && b.push(...nt.map((Z) => {
          const it = {
            type: L
          };
          if (typeof Z == "string" && (o || r) && !k && n.manuallyAnimateOnMount && n.parent) {
            const { parent: N } = n, E = Ji(N, Z);
            if (N.enteringChildren && E) {
              const { delayChildren: j } = E.transition || {};
              it.delay = Vb(N.enteringChildren, n, j);
            }
          }
          return {
            animation: Z,
            options: it
          };
        }));
      }
      if (T.size) {
        const O = {};
        if (typeof g.initial != "boolean") {
          const L = Ji(n, Array.isArray(g.initial) ? g.initial[0] : g.initial);
          L && L.transition && (O.transition = L.transition);
        }
        T.forEach((L) => {
          const z = n.getBaseTarget(L), V = n.getValue(L);
          V && (V.liveStyle = true), O[L] = z ?? null;
        }), b.push({
          animation: O
        });
      }
      let R = !!b.length;
      return o && (g.initial === false || g.initial === g.animate) && !n.manuallyAnimateOnMount && (R = false), o = false, r = false, R ? i(b) : Promise.resolve();
    }
    function m(p, g) {
      var _a;
      if (l[p].isActive === g) return Promise.resolve();
      (_a = n.variantChildren) == null ? void 0 : _a.forEach((b) => {
        var _a2;
        return (_a2 = b.animationState) == null ? void 0 : _a2.setActive(p, g);
      }), l[p].isActive = g;
      const v = h(p);
      for (const b in l) l[b].protectedKeys = {};
      return v;
    }
    return {
      animateChanges: h,
      setActive: m,
      setAnimateFunction: f,
      getState: () => l,
      reset: () => {
        l = i0(), r = true;
      }
    };
  }
  function UM(n, i) {
    return typeof i == "string" ? i !== n : Array.isArray(i) ? !hx(i, n) : false;
  }
  function Xi(n = false) {
    return {
      isActive: n,
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {}
    };
  }
  function i0() {
    return {
      animate: Xi(true),
      whileInView: Xi(),
      whileHover: Xi(),
      whileTap: Xi(),
      whileDrag: Xi(),
      whileFocus: Xi(),
      exit: Xi()
    };
  }
  function Ff(n, i) {
    n.min = i.min, n.max = i.max;
  }
  function nn(n, i) {
    Ff(n.x, i.x), Ff(n.y, i.y);
  }
  function a0(n, i) {
    n.translate = i.translate, n.scale = i.scale, n.originPoint = i.originPoint, n.origin = i.origin;
  }
  const mx = 1e-4, HM = 1 - mx, GM = 1 + mx, px = 0.01, YM = 0 - px, PM = 0 + px;
  function pe(n) {
    return n.max - n.min;
  }
  function qM(n, i, l) {
    return Math.abs(n - i) <= l;
  }
  function s0(n, i, l, o = 0.5) {
    n.origin = o, n.originPoint = Yt(i.min, i.max, n.origin), n.scale = pe(l) / pe(i), n.translate = Yt(l.min, l.max, n.origin) - n.originPoint, (n.scale >= HM && n.scale <= GM || isNaN(n.scale)) && (n.scale = 1), (n.translate >= YM && n.translate <= PM || isNaN(n.translate)) && (n.translate = 0);
  }
  function al(n, i, l, o) {
    s0(n.x, i.x, l.x, o ? o.originX : void 0), s0(n.y, i.y, l.y, o ? o.originY : void 0);
  }
  function l0(n, i, l) {
    n.min = l.min + i.min, n.max = n.min + pe(i);
  }
  function XM(n, i, l) {
    l0(n.x, i.x, l.x), l0(n.y, i.y, l.y);
  }
  function o0(n, i, l) {
    n.min = i.min - l.min, n.max = n.min + pe(i);
  }
  function ur(n, i, l) {
    o0(n.x, i.x, l.x), o0(n.y, i.y, l.y);
  }
  function r0(n, i, l, o, r) {
    return n -= i, n = cr(n, 1 / l, o), r !== void 0 && (n = cr(n, 1 / r, o)), n;
  }
  function KM(n, i = 0, l = 1, o = 0.5, r, d = n, f = n) {
    if (bn.test(i) && (i = parseFloat(i), i = Yt(f.min, f.max, i / 100) - f.min), typeof i != "number") return;
    let h = Yt(d.min, d.max, o);
    n === d && (h -= i), n.min = r0(n.min, i, l, h, r), n.max = r0(n.max, i, l, h, r);
  }
  function c0(n, i, [l, o, r], d, f) {
    KM(n, i[l], i[o], i[r], i.scale, d, f);
  }
  const ZM = [
    "x",
    "scaleX",
    "originX"
  ], QM = [
    "y",
    "scaleY",
    "originY"
  ];
  function u0(n, i, l, o) {
    c0(n.x, i, ZM, l ? l.x : void 0, o ? o.x : void 0), c0(n.y, i, QM, l ? l.y : void 0, o ? o.y : void 0);
  }
  function f0(n) {
    return n.translate === 0 && n.scale === 1;
  }
  function gx(n) {
    return f0(n.x) && f0(n.y);
  }
  function d0(n, i) {
    return n.min === i.min && n.max === i.max;
  }
  function FM(n, i) {
    return d0(n.x, i.x) && d0(n.y, i.y);
  }
  function h0(n, i) {
    return Math.round(n.min) === Math.round(i.min) && Math.round(n.max) === Math.round(i.max);
  }
  function yx(n, i) {
    return h0(n.x, i.x) && h0(n.y, i.y);
  }
  function m0(n) {
    return pe(n.x) / pe(n.y);
  }
  function p0(n, i) {
    return n.translate === i.translate && n.scale === i.scale && n.originPoint === i.originPoint;
  }
  function pn(n) {
    return [
      n("x"),
      n("y")
    ];
  }
  function JM(n, i, l) {
    let o = "";
    const r = n.x.translate / i.x, d = n.y.translate / i.y, f = (l == null ? void 0 : l.z) || 0;
    if ((r || d || f) && (o = `translate3d(${r}px, ${d}px, ${f}px) `), (i.x !== 1 || i.y !== 1) && (o += `scale(${1 / i.x}, ${1 / i.y}) `), l) {
      const { transformPerspective: p, rotate: g, rotateX: v, rotateY: b, skewX: T, skewY: A } = l;
      p && (o = `perspective(${p}px) ${o}`), g && (o += `rotate(${g}deg) `), v && (o += `rotateX(${v}deg) `), b && (o += `rotateY(${b}deg) `), T && (o += `skewX(${T}deg) `), A && (o += `skewY(${A}deg) `);
    }
    const h = n.x.scale * i.x, m = n.y.scale * i.y;
    return (h !== 1 || m !== 1) && (o += `scale(${h}, ${m})`), o || "none";
  }
  const vx = [
    "TopLeft",
    "TopRight",
    "BottomLeft",
    "BottomRight"
  ], $M = vx.length, g0 = (n) => typeof n == "string" ? parseFloat(n) : n, y0 = (n) => typeof n == "number" || rt.test(n);
  function WM(n, i, l, o, r, d) {
    r ? (n.opacity = Yt(0, l.opacity ?? 1, IM(o)), n.opacityExit = Yt(i.opacity ?? 1, 0, tR(o))) : d && (n.opacity = Yt(i.opacity ?? 1, l.opacity ?? 1, o));
    for (let f = 0; f < $M; f++) {
      const h = `border${vx[f]}Radius`;
      let m = v0(i, h), p = v0(l, h);
      if (m === void 0 && p === void 0) continue;
      m || (m = 0), p || (p = 0), m === 0 || p === 0 || y0(m) === y0(p) ? (n[h] = Math.max(Yt(g0(m), g0(p), o), 0), (bn.test(p) || bn.test(m)) && (n[h] += "%")) : n[h] = p;
    }
    (i.rotate || l.rotate) && (n.rotate = Yt(i.rotate || 0, l.rotate || 0, o));
  }
  function v0(n, i) {
    return n[i] !== void 0 ? n[i] : n.borderRadius;
  }
  const IM = bx(0, 0.5, ub), tR = bx(0.5, 0.95, Fe);
  function bx(n, i, l) {
    return (o) => o < n ? 0 : o > i ? 1 : l(rl(n, i, o));
  }
  function eR(n, i, l) {
    const o = ue(n) ? n : $a(n);
    return o.start(_d("", o, i, l)), o.animation;
  }
  function fl(n, i, l, o = {
    passive: true
  }) {
    return n.addEventListener(i, l, o), () => n.removeEventListener(i, l);
  }
  const nR = (n, i) => n.depth - i.depth;
  class iR {
    constructor() {
      this.children = [], this.isDirty = false;
    }
    add(i) {
      bd(this.children, i), this.isDirty = true;
    }
    remove(i) {
      ar(this.children, i), this.isDirty = true;
    }
    forEach(i) {
      this.isDirty && this.children.sort(nR), this.isDirty = false, this.children.forEach(i);
    }
  }
  function aR(n, i) {
    const l = me.now(), o = ({ timestamp: r }) => {
      const d = r - l;
      d >= i && (Ti(o), n(d - i));
    };
    return Lt.setup(o, true), () => Ti(o);
  }
  function $o(n) {
    return ue(n) ? n.get() : n;
  }
  class sR {
    constructor() {
      this.members = [];
    }
    add(i) {
      bd(this.members, i);
      for (let l = this.members.length - 1; l >= 0; l--) {
        const o = this.members[l];
        if (o === i || o === this.lead || o === this.prevLead) continue;
        const r = o.instance;
        (!r || r.isConnected === false) && !o.snapshot && (ar(this.members, o), o.unmount());
      }
      i.scheduleRender();
    }
    remove(i) {
      if (ar(this.members, i), i === this.prevLead && (this.prevLead = void 0), i === this.lead) {
        const l = this.members[this.members.length - 1];
        l && this.promote(l);
      }
    }
    relegate(i) {
      var _a;
      for (let l = this.members.indexOf(i) - 1; l >= 0; l--) {
        const o = this.members[l];
        if (o.isPresent !== false && ((_a = o.instance) == null ? void 0 : _a.isConnected) !== false) return this.promote(o), true;
      }
      return false;
    }
    promote(i, l) {
      var _a;
      const o = this.lead;
      if (i !== o && (this.prevLead = o, this.lead = i, i.show(), o)) {
        o.updateSnapshot(), i.scheduleRender();
        const { layoutDependency: r } = o.options, { layoutDependency: d } = i.options;
        (r === void 0 || r !== d) && (i.resumeFrom = o, l && (o.preserveOpacity = true), o.snapshot && (i.snapshot = o.snapshot, i.snapshot.latestValues = o.animationValues || o.latestValues), ((_a = i.root) == null ? void 0 : _a.isUpdating) && (i.isLayoutDirty = true)), i.options.crossfade === false && o.hide();
      }
    }
    exitAnimationComplete() {
      this.members.forEach((i) => {
        var _a, _b2, _c, _d2, _e2;
        (_b2 = (_a = i.options).onExitComplete) == null ? void 0 : _b2.call(_a), (_e2 = (_c = i.resumingFrom) == null ? void 0 : (_d2 = _c.options).onExitComplete) == null ? void 0 : _e2.call(_d2);
      });
    }
    scheduleRender() {
      this.members.forEach((i) => i.instance && i.scheduleRender(false));
    }
    removeLeadSnapshot() {
      var _a;
      ((_a = this.lead) == null ? void 0 : _a.snapshot) && (this.lead.snapshot = void 0);
    }
  }
  const Wo = {
    hasAnimatedSinceResize: true,
    hasEverUpdated: false
  }, uf = [
    "",
    "X",
    "Y",
    "Z"
  ], lR = 1e3;
  let oR = 0;
  function ff(n, i, l, o) {
    const { latestValues: r } = i;
    r[n] && (l[n] = r[n], i.setStaticValue(n, 0), o && (o[n] = 0));
  }
  function xx(n) {
    if (n.hasCheckedOptimisedAppear = true, n.root === n) return;
    const { visualElement: i } = n.options;
    if (!i) return;
    const l = Hb(i);
    if (window.MotionHasOptimisedAnimation(l, "transform")) {
      const { layout: r, layoutId: d } = n.options;
      window.MotionCancelOptimisedAnimation(l, "transform", Lt, !(r || d));
    }
    const { parent: o } = n;
    o && !o.hasCheckedOptimisedAppear && xx(o);
  }
  function Sx({ attachResizeListener: n, defaultParent: i, measureScroll: l, checkIsScrollRoot: o, resetTransform: r }) {
    return class {
      constructor(f = {}, h = i == null ? void 0 : i()) {
        this.id = oR++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = false, this.isAnimationBlocked = false, this.isLayoutDirty = false, this.isProjectionDirty = false, this.isSharedProjectionDirty = false, this.isTransformDirty = false, this.updateManuallyBlocked = false, this.updateBlockedByResize = false, this.isUpdating = false, this.isSVG = false, this.needsReset = false, this.shouldResetTransform = false, this.hasCheckedOptimisedAppear = false, this.treeScale = {
          x: 1,
          y: 1
        }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = false, this.layoutVersion = 0, this.updateScheduled = false, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = false, this.checkUpdateFailed = () => {
          this.isUpdating && (this.isUpdating = false, this.clearAllSnapshots());
        }, this.updateProjection = () => {
          this.projectionUpdateScheduled = false, this.nodes.forEach(uR), this.nodes.forEach(mR), this.nodes.forEach(pR), this.nodes.forEach(fR);
        }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = false, this.isVisible = true, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = f, this.root = h ? h.root || h : this, this.path = h ? [
          ...h.path,
          h
        ] : [], this.parent = h, this.depth = h ? h.depth + 1 : 0;
        for (let m = 0; m < this.path.length; m++) this.path[m].shouldResetTransform = true;
        this.root === this && (this.nodes = new iR());
      }
      addEventListener(f, h) {
        return this.eventHandlers.has(f) || this.eventHandlers.set(f, new Sd()), this.eventHandlers.get(f).add(h);
      }
      notifyListeners(f, ...h) {
        const m = this.eventHandlers.get(f);
        m && m.notify(...h);
      }
      hasListeners(f) {
        return this.eventHandlers.has(f);
      }
      mount(f) {
        if (this.instance) return;
        this.isSVG = Hd(f) && !cM(f), this.instance = f;
        const { layoutId: h, layout: m, visualElement: p } = this.options;
        if (p && !p.current && p.mount(f), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (m || h) && (this.isLayoutDirty = true), n) {
          let g, v = 0;
          const b = () => this.root.updateBlockedByResize = false;
          Lt.read(() => {
            v = window.innerWidth;
          }), n(f, () => {
            const T = window.innerWidth;
            T !== v && (v = T, this.root.updateBlockedByResize = true, g && g(), g = aR(b, 250), Wo.hasAnimatedSinceResize && (Wo.hasAnimatedSinceResize = false, this.nodes.forEach(S0)));
          });
        }
        h && this.root.registerSharedNode(h, this), this.options.animate !== false && p && (h || m) && this.addEventListener("didUpdate", ({ delta: g, hasLayoutChanged: v, hasRelativeLayoutChanged: b, layout: T }) => {
          if (this.isTreeAnimationBlocked()) {
            this.target = void 0, this.relativeTarget = void 0;
            return;
          }
          const A = this.options.transition || p.getDefaultTransition() || xR, { onLayoutAnimationStart: C, onLayoutAnimationComplete: R } = p.getProps(), O = !this.targetLayout || !yx(this.targetLayout, T), L = !v && b;
          if (this.options.layoutRoot || this.resumeFrom || L || v && (O || !this.currentAnimation)) {
            this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
            const z = {
              ...zd(A, "layout"),
              onPlay: C,
              onComplete: R
            };
            (p.shouldReduceMotion || this.options.layoutRoot) && (z.delay = 0, z.type = false), this.startAnimation(z), this.setAnimationOrigin(g, L);
          } else v || S0(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
          this.targetLayout = T;
        });
      }
      unmount() {
        this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
        const f = this.getStack();
        f && f.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), Ti(this.updateProjection);
      }
      blockUpdate() {
        this.updateManuallyBlocked = true;
      }
      unblockUpdate() {
        this.updateManuallyBlocked = false;
      }
      isUpdateBlocked() {
        return this.updateManuallyBlocked || this.updateBlockedByResize;
      }
      isTreeAnimationBlocked() {
        return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || false;
      }
      startUpdate() {
        this.isUpdateBlocked() || (this.isUpdating = true, this.nodes && this.nodes.forEach(gR), this.animationId++);
      }
      getTransformTemplate() {
        const { visualElement: f } = this.options;
        return f && f.getProps().transformTemplate;
      }
      willUpdate(f = true) {
        if (this.root.hasTreeAnimated = true, this.root.isUpdateBlocked()) {
          this.options.onExitComplete && this.options.onExitComplete();
          return;
        }
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && xx(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
        this.isLayoutDirty = true;
        for (let g = 0; g < this.path.length; g++) {
          const v = this.path[g];
          v.shouldResetTransform = true, (typeof v.latestValues.x == "string" || typeof v.latestValues.y == "string") && (v.isLayoutDirty = true), v.updateScroll("snapshot"), v.options.layoutRoot && v.willUpdate(false);
        }
        const { layoutId: h, layout: m } = this.options;
        if (h === void 0 && !m) return;
        const p = this.getTransformTemplate();
        this.prevTransformTemplateValue = p ? p(this.latestValues, "") : void 0, this.updateSnapshot(), f && this.notifyListeners("willUpdate");
      }
      update() {
        if (this.updateScheduled = false, this.isUpdateBlocked()) {
          this.unblockUpdate(), this.clearAllSnapshots(), this.nodes.forEach(b0);
          return;
        }
        if (this.animationId <= this.animationCommitId) {
          this.nodes.forEach(x0);
          return;
        }
        this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = false, this.nodes.forEach(hR), this.nodes.forEach(rR), this.nodes.forEach(cR)) : this.nodes.forEach(x0), this.clearAllSnapshots();
        const h = me.now();
        ce.delta = xn(0, 1e3 / 60, h - ce.timestamp), ce.timestamp = h, ce.isProcessing = true, ef.update.process(ce), ef.preRender.process(ce), ef.render.process(ce), ce.isProcessing = false;
      }
      didUpdate() {
        this.updateScheduled || (this.updateScheduled = true, Bd.read(this.scheduleUpdate));
      }
      clearAllSnapshots() {
        this.nodes.forEach(dR), this.sharedNodes.forEach(yR);
      }
      scheduleUpdateProjection() {
        this.projectionUpdateScheduled || (this.projectionUpdateScheduled = true, Lt.preRender(this.updateProjection, false, true));
      }
      scheduleCheckAfterUnmount() {
        Lt.postRender(() => {
          this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
        });
      }
      updateSnapshot() {
        this.snapshot || !this.instance || (this.snapshot = this.measure(), this.snapshot && !pe(this.snapshot.measuredBox.x) && !pe(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
      }
      updateLayout() {
        if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
        if (this.resumeFrom && !this.resumeFrom.instance) for (let m = 0; m < this.path.length; m++) this.path[m].updateScroll();
        const f = this.layout;
        this.layout = this.measure(false), this.layoutVersion++, this.layoutCorrected = ee(), this.isLayoutDirty = false, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
        const { visualElement: h } = this.options;
        h && h.notify("LayoutMeasure", this.layout.layoutBox, f ? f.layoutBox : void 0);
      }
      updateScroll(f = "measure") {
        let h = !!(this.options.layoutScroll && this.instance);
        if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === f && (h = false), h && this.instance) {
          const m = o(this.instance);
          this.scroll = {
            animationId: this.root.animationId,
            phase: f,
            isRoot: m,
            offset: l(this.instance),
            wasRoot: this.scroll ? this.scroll.isRoot : m
          };
        }
      }
      resetTransform() {
        if (!r) return;
        const f = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, h = this.projectionDelta && !gx(this.projectionDelta), m = this.getTransformTemplate(), p = m ? m(this.latestValues, "") : void 0, g = p !== this.prevTransformTemplateValue;
        f && this.instance && (h || Ki(this.latestValues) || g) && (r(this.instance, p), this.shouldResetTransform = false, this.scheduleRender());
      }
      measure(f = true) {
        const h = this.measurePageBox();
        let m = this.removeElementScroll(h);
        return f && (m = this.removeTransform(m)), SR(m), {
          animationId: this.root.animationId,
          measuredBox: h,
          layoutBox: m,
          latestValues: {},
          source: this.id
        };
      }
      measurePageBox() {
        var _a;
        const { visualElement: f } = this.options;
        if (!f) return ee();
        const h = f.measureViewportBox();
        if (!(((_a = this.scroll) == null ? void 0 : _a.wasRoot) || this.path.some(TR))) {
          const { scroll: p } = this.root;
          p && (Pa(h.x, p.offset.x), Pa(h.y, p.offset.y));
        }
        return h;
      }
      removeElementScroll(f) {
        var _a;
        const h = ee();
        if (nn(h, f), (_a = this.scroll) == null ? void 0 : _a.wasRoot) return h;
        for (let m = 0; m < this.path.length; m++) {
          const p = this.path[m], { scroll: g, options: v } = p;
          p !== this.root && g && v.layoutScroll && (g.wasRoot && nn(h, f), Pa(h.x, g.offset.x), Pa(h.y, g.offset.y));
        }
        return h;
      }
      applyTransform(f, h = false) {
        var _a, _b2;
        const m = ee();
        nn(m, f);
        for (let p = 0; p < this.path.length; p++) {
          const g = this.path[p];
          !h && g.options.layoutScroll && g.scroll && g !== g.root && qa(m, {
            x: -g.scroll.offset.x,
            y: -g.scroll.offset.y
          }), Ki(g.latestValues) && qa(m, g.latestValues, (_a = g.layout) == null ? void 0 : _a.layoutBox);
        }
        return Ki(this.latestValues) && qa(m, this.latestValues, (_b2 = this.layout) == null ? void 0 : _b2.layoutBox), m;
      }
      removeTransform(f) {
        var _a;
        const h = ee();
        nn(h, f);
        for (let m = 0; m < this.path.length; m++) {
          const p = this.path[m];
          if (!Ki(p.latestValues)) continue;
          let g;
          p.instance && (Kf(p.latestValues) && p.updateSnapshot(), g = ee(), nn(g, p.measurePageBox())), u0(h, p.latestValues, (_a = p.snapshot) == null ? void 0 : _a.layoutBox, g);
        }
        return Ki(this.latestValues) && u0(h, this.latestValues), h;
      }
      setTargetDelta(f) {
        this.targetDelta = f, this.root.scheduleUpdateProjection(), this.isProjectionDirty = true;
      }
      setOptions(f) {
        this.options = {
          ...this.options,
          ...f,
          crossfade: f.crossfade !== void 0 ? f.crossfade : true
        };
      }
      clearMeasurements() {
        this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = false;
      }
      forceRelativeParentToResolveTarget() {
        this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== ce.timestamp && this.relativeParent.resolveTargetDelta(true);
      }
      resolveTargetDelta(f = false) {
        var _a;
        const h = this.getLead();
        this.isProjectionDirty || (this.isProjectionDirty = h.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = h.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = h.isSharedProjectionDirty);
        const m = !!this.resumingFrom || this !== h;
        if (!(f || m && this.isSharedProjectionDirty || this.isProjectionDirty || ((_a = this.parent) == null ? void 0 : _a.isProjectionDirty) || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
        const { layout: g, layoutId: v } = this.options;
        if (!this.layout || !(g || v)) return;
        this.resolvedRelativeTargetAt = ce.timestamp;
        const b = this.getClosestProjectingParent();
        b && this.linkedParentVersion !== b.layoutVersion && !b.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (b && b.layout ? this.createRelativeTarget(b, this.layout.layoutBox, b.layout.layoutBox) : this.removeRelativeTarget()), !(!this.relativeTarget && !this.targetDelta) && (this.target || (this.target = ee(), this.targetWithTransforms = ee()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), XM(this.target, this.relativeTarget, this.relativeParent.target)) : this.targetDelta ? (this.resumingFrom ? this.target = this.applyTransform(this.layout.layoutBox) : nn(this.target, this.layout.layoutBox), ax(this.target, this.targetDelta)) : nn(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = false, b && !!b.resumingFrom == !!this.resumingFrom && !b.options.layoutScroll && b.target && this.animationProgress !== 1 ? this.createRelativeTarget(b, this.target, b.target) : this.relativeParent = this.relativeTarget = void 0));
      }
      getClosestProjectingParent() {
        if (!(!this.parent || Kf(this.parent.latestValues) || ix(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
      }
      isProjecting() {
        return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      createRelativeTarget(f, h, m) {
        this.relativeParent = f, this.linkedParentVersion = f.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = ee(), this.relativeTargetOrigin = ee(), ur(this.relativeTargetOrigin, h, m), nn(this.relativeTarget, this.relativeTargetOrigin);
      }
      removeRelativeTarget() {
        this.relativeParent = this.relativeTarget = void 0;
      }
      calcProjection() {
        var _a;
        const f = this.getLead(), h = !!this.resumingFrom || this !== f;
        let m = true;
        if ((this.isProjectionDirty || ((_a = this.parent) == null ? void 0 : _a.isProjectionDirty)) && (m = false), h && (this.isSharedProjectionDirty || this.isTransformDirty) && (m = false), this.resolvedRelativeTargetAt === ce.timestamp && (m = false), m) return;
        const { layout: p, layoutId: g } = this.options;
        if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(p || g)) return;
        nn(this.layoutCorrected, this.layout.layoutBox);
        const v = this.treeScale.x, b = this.treeScale.y;
        xM(this.layoutCorrected, this.treeScale, this.path, h), f.layout && !f.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (f.target = f.layout.layoutBox, f.targetWithTransforms = ee());
        const { target: T } = f;
        if (!T) {
          this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
          return;
        }
        !this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (a0(this.prevProjectionDelta.x, this.projectionDelta.x), a0(this.prevProjectionDelta.y, this.projectionDelta.y)), al(this.projectionDelta, this.layoutCorrected, T, this.latestValues), (this.treeScale.x !== v || this.treeScale.y !== b || !p0(this.projectionDelta.x, this.prevProjectionDelta.x) || !p0(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = true, this.scheduleRender(), this.notifyListeners("projectionUpdate", T));
      }
      hide() {
        this.isVisible = false;
      }
      show() {
        this.isVisible = true;
      }
      scheduleRender(f = true) {
        var _a;
        if ((_a = this.options.visualElement) == null ? void 0 : _a.scheduleRender(), f) {
          const h = this.getStack();
          h && h.scheduleRender();
        }
        this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
      }
      createProjectionDeltas() {
        this.prevProjectionDelta = Ya(), this.projectionDelta = Ya(), this.projectionDeltaWithTransform = Ya();
      }
      setAnimationOrigin(f, h = false) {
        const m = this.snapshot, p = m ? m.latestValues : {}, g = {
          ...this.latestValues
        }, v = Ya();
        (!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !h;
        const b = ee(), T = m ? m.source : void 0, A = this.layout ? this.layout.source : void 0, C = T !== A, R = this.getStack(), O = !R || R.members.length <= 1, L = !!(C && !O && this.options.crossfade === true && !this.path.some(bR));
        this.animationProgress = 0;
        let z;
        this.mixTargetDelta = (V) => {
          const q = V / 1e3;
          T0(v.x, f.x, q), T0(v.y, f.y, q), this.setTargetDelta(v), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (ur(b, this.layout.layoutBox, this.relativeParent.layout.layoutBox), vR(this.relativeTarget, this.relativeTargetOrigin, b, q), z && FM(this.relativeTarget, z) && (this.isProjectionDirty = false), z || (z = ee()), nn(z, this.relativeTarget)), C && (this.animationValues = g, WM(g, p, this.latestValues, q, L, O)), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = q;
        }, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(f) {
        var _a, _b2, _c;
        this.notifyListeners("animationStart"), (_a = this.currentAnimation) == null ? void 0 : _a.stop(), (_c = (_b2 = this.resumingFrom) == null ? void 0 : _b2.currentAnimation) == null ? void 0 : _c.stop(), this.pendingAnimation && (Ti(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = Lt.update(() => {
          Wo.hasAnimatedSinceResize = true, this.motionValue || (this.motionValue = $a(0)), this.motionValue.jump(0, false), this.currentAnimation = eR(this.motionValue, [
            0,
            1e3
          ], {
            ...f,
            velocity: 0,
            isSync: true,
            onUpdate: (h) => {
              this.mixTargetDelta(h), f.onUpdate && f.onUpdate(h);
            },
            onStop: () => {
            },
            onComplete: () => {
              f.onComplete && f.onComplete(), this.completeAnimation();
            }
          }), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
        });
      }
      completeAnimation() {
        this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
        const f = this.getStack();
        f && f.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
      }
      finishAnimation() {
        this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(lR), this.currentAnimation.stop()), this.completeAnimation();
      }
      applyTransformsToTarget() {
        const f = this.getLead();
        let { targetWithTransforms: h, target: m, layout: p, latestValues: g } = f;
        if (!(!h || !m || !p)) {
          if (this !== f && this.layout && p && Tx(this.options.animationType, this.layout.layoutBox, p.layoutBox)) {
            m = this.target || ee();
            const v = pe(this.layout.layoutBox.x);
            m.x.min = f.target.x.min, m.x.max = m.x.min + v;
            const b = pe(this.layout.layoutBox.y);
            m.y.min = f.target.y.min, m.y.max = m.y.min + b;
          }
          nn(h, m), qa(h, g), al(this.projectionDeltaWithTransform, this.layoutCorrected, h, g);
        }
      }
      registerSharedNode(f, h) {
        this.sharedNodes.has(f) || this.sharedNodes.set(f, new sR()), this.sharedNodes.get(f).add(h);
        const p = h.options.initialPromotionConfig;
        h.promote({
          transition: p ? p.transition : void 0,
          preserveFollowOpacity: p && p.shouldPreserveFollowOpacity ? p.shouldPreserveFollowOpacity(h) : void 0
        });
      }
      isLead() {
        const f = this.getStack();
        return f ? f.lead === this : true;
      }
      getLead() {
        var _a;
        const { layoutId: f } = this.options;
        return f ? ((_a = this.getStack()) == null ? void 0 : _a.lead) || this : this;
      }
      getPrevLead() {
        var _a;
        const { layoutId: f } = this.options;
        return f ? (_a = this.getStack()) == null ? void 0 : _a.prevLead : void 0;
      }
      getStack() {
        const { layoutId: f } = this.options;
        if (f) return this.root.sharedNodes.get(f);
      }
      promote({ needsReset: f, transition: h, preserveFollowOpacity: m } = {}) {
        const p = this.getStack();
        p && p.promote(this, m), f && (this.projectionDelta = void 0, this.needsReset = true), h && this.setOptions({
          transition: h
        });
      }
      relegate() {
        const f = this.getStack();
        return f ? f.relegate(this) : false;
      }
      resetSkewAndRotation() {
        const { visualElement: f } = this.options;
        if (!f) return;
        let h = false;
        const { latestValues: m } = f;
        if ((m.z || m.rotate || m.rotateX || m.rotateY || m.rotateZ || m.skewX || m.skewY) && (h = true), !h) return;
        const p = {};
        m.z && ff("z", f, p, this.animationValues);
        for (let g = 0; g < uf.length; g++) ff(`rotate${uf[g]}`, f, p, this.animationValues), ff(`skew${uf[g]}`, f, p, this.animationValues);
        f.render();
        for (const g in p) f.setStaticValue(g, p[g]), this.animationValues && (this.animationValues[g] = p[g]);
        f.scheduleRender();
      }
      applyProjectionStyles(f, h) {
        if (!this.instance || this.isSVG) return;
        if (!this.isVisible) {
          f.visibility = "hidden";
          return;
        }
        const m = this.getTransformTemplate();
        if (this.needsReset) {
          this.needsReset = false, f.visibility = "", f.opacity = "", f.pointerEvents = $o(h == null ? void 0 : h.pointerEvents) || "", f.transform = m ? m(this.latestValues, "") : "none";
          return;
        }
        const p = this.getLead();
        if (!this.projectionDelta || !this.layout || !p.target) {
          this.options.layoutId && (f.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1, f.pointerEvents = $o(h == null ? void 0 : h.pointerEvents) || ""), this.hasProjected && !Ki(this.latestValues) && (f.transform = m ? m({}, "") : "none", this.hasProjected = false);
          return;
        }
        f.visibility = "";
        const g = p.animationValues || p.latestValues;
        this.applyTransformsToTarget();
        let v = JM(this.projectionDeltaWithTransform, this.treeScale, g);
        m && (v = m(g, v)), f.transform = v;
        const { x: b, y: T } = this.projectionDelta;
        f.transformOrigin = `${b.origin * 100}% ${T.origin * 100}% 0`, p.animationValues ? f.opacity = p === this ? g.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : g.opacityExit : f.opacity = p === this ? g.opacity !== void 0 ? g.opacity : "" : g.opacityExit !== void 0 ? g.opacityExit : 0;
        for (const A in Qf) {
          if (g[A] === void 0) continue;
          const { correct: C, applyTo: R, isCSSVariable: O } = Qf[A], L = v === "none" ? g[A] : C(g[A], p);
          if (R) {
            const z = R.length;
            for (let V = 0; V < z; V++) f[R[V]] = L;
          } else O ? this.options.visualElement.renderState.vars[A] = L : f[A] = L;
        }
        this.options.layoutId && (f.pointerEvents = p === this ? $o(h == null ? void 0 : h.pointerEvents) || "" : "none");
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      resetTree() {
        this.root.nodes.forEach((f) => {
          var _a;
          return (_a = f.currentAnimation) == null ? void 0 : _a.stop();
        }), this.root.nodes.forEach(b0), this.root.sharedNodes.clear();
      }
    };
  }
  function rR(n) {
    n.updateLayout();
  }
  function cR(n) {
    var _a;
    const i = ((_a = n.resumeFrom) == null ? void 0 : _a.snapshot) || n.snapshot;
    if (n.isLead() && n.layout && i && n.hasListeners("didUpdate")) {
      const { layoutBox: l, measuredBox: o } = n.layout, { animationType: r } = n.options, d = i.source !== n.layout.source;
      if (r === "size") pn((g) => {
        const v = d ? i.measuredBox[g] : i.layoutBox[g], b = pe(v);
        v.min = l[g].min, v.max = v.min + b;
      });
      else if (r === "x" || r === "y") {
        const g = r === "x" ? "y" : "x";
        Ff(d ? i.measuredBox[g] : i.layoutBox[g], l[g]);
      } else Tx(r, i.layoutBox, l) && pn((g) => {
        const v = d ? i.measuredBox[g] : i.layoutBox[g], b = pe(l[g]);
        v.max = v.min + b, n.relativeTarget && !n.currentAnimation && (n.isProjectionDirty = true, n.relativeTarget[g].max = n.relativeTarget[g].min + b);
      });
      const f = Ya();
      al(f, l, i.layoutBox);
      const h = Ya();
      d ? al(h, n.applyTransform(o, true), i.measuredBox) : al(h, l, i.layoutBox);
      const m = !gx(f);
      let p = false;
      if (!n.resumeFrom) {
        const g = n.getClosestProjectingParent();
        if (g && !g.resumeFrom) {
          const { snapshot: v, layout: b } = g;
          if (v && b) {
            const T = ee();
            ur(T, i.layoutBox, v.layoutBox);
            const A = ee();
            ur(A, l, b.layoutBox), yx(T, A) || (p = true), g.options.layoutRoot && (n.relativeTarget = A, n.relativeTargetOrigin = T, n.relativeParent = g);
          }
        }
      }
      n.notifyListeners("didUpdate", {
        layout: l,
        snapshot: i,
        delta: h,
        layoutDelta: f,
        hasLayoutChanged: m,
        hasRelativeLayoutChanged: p
      });
    } else if (n.isLead()) {
      const { onExitComplete: l } = n.options;
      l && l();
    }
    n.options.transition = void 0;
  }
  function uR(n) {
    n.parent && (n.isProjecting() || (n.isProjectionDirty = n.parent.isProjectionDirty), n.isSharedProjectionDirty || (n.isSharedProjectionDirty = !!(n.isProjectionDirty || n.parent.isProjectionDirty || n.parent.isSharedProjectionDirty)), n.isTransformDirty || (n.isTransformDirty = n.parent.isTransformDirty));
  }
  function fR(n) {
    n.isProjectionDirty = n.isSharedProjectionDirty = n.isTransformDirty = false;
  }
  function dR(n) {
    n.clearSnapshot();
  }
  function b0(n) {
    n.clearMeasurements();
  }
  function x0(n) {
    n.isLayoutDirty = false;
  }
  function hR(n) {
    const { visualElement: i } = n.options;
    i && i.getProps().onBeforeLayoutMeasure && i.notify("BeforeLayoutMeasure"), n.resetTransform();
  }
  function S0(n) {
    n.finishAnimation(), n.targetDelta = n.relativeTarget = n.target = void 0, n.isProjectionDirty = true;
  }
  function mR(n) {
    n.resolveTargetDelta();
  }
  function pR(n) {
    n.calcProjection();
  }
  function gR(n) {
    n.resetSkewAndRotation();
  }
  function yR(n) {
    n.removeLeadSnapshot();
  }
  function T0(n, i, l) {
    n.translate = Yt(i.translate, 0, l), n.scale = Yt(i.scale, 1, l), n.origin = i.origin, n.originPoint = i.originPoint;
  }
  function w0(n, i, l, o) {
    n.min = Yt(i.min, l.min, o), n.max = Yt(i.max, l.max, o);
  }
  function vR(n, i, l, o) {
    w0(n.x, i.x, l.x, o), w0(n.y, i.y, l.y, o);
  }
  function bR(n) {
    return n.animationValues && n.animationValues.opacityExit !== void 0;
  }
  const xR = {
    duration: 0.45,
    ease: [
      0.4,
      0,
      0.1,
      1
    ]
  }, A0 = (n) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(n), E0 = A0("applewebkit/") && !A0("chrome/") ? Math.round : Fe;
  function C0(n) {
    n.min = E0(n.min), n.max = E0(n.max);
  }
  function SR(n) {
    C0(n.x), C0(n.y);
  }
  function Tx(n, i, l) {
    return n === "position" || n === "preserve-aspect" && !qM(m0(i), m0(l), 0.2);
  }
  function TR(n) {
    var _a;
    return n !== n.root && ((_a = n.scroll) == null ? void 0 : _a.wasRoot);
  }
  const wR = Sx({
    attachResizeListener: (n, i) => fl(n, "resize", i),
    measureScroll: () => {
      var _a, _b2;
      return {
        x: document.documentElement.scrollLeft || ((_a = document.body) == null ? void 0 : _a.scrollLeft) || 0,
        y: document.documentElement.scrollTop || ((_b2 = document.body) == null ? void 0 : _b2.scrollTop) || 0
      };
    },
    checkIsScrollRoot: () => true
  }), df = {
    current: void 0
  }, wx = Sx({
    measureScroll: (n) => ({
      x: n.scrollLeft,
      y: n.scrollTop
    }),
    defaultParent: () => {
      if (!df.current) {
        const n = new wR({});
        n.mount(window), n.setOptions({
          layoutScroll: true
        }), df.current = n;
      }
      return df.current;
    },
    resetTransform: (n, i) => {
      n.style.transform = i !== void 0 ? i : "none";
    },
    checkIsScrollRoot: (n) => window.getComputedStyle(n).position === "fixed"
  }), Xd = w.createContext({
    transformPagePoint: (n) => n,
    isStatic: false,
    reducedMotion: "never"
  });
  function M0(n, i) {
    if (typeof n == "function") return n(i);
    n != null && (n.current = i);
  }
  function AR(...n) {
    return (i) => {
      let l = false;
      const o = n.map((r) => {
        const d = M0(r, i);
        return !l && typeof d == "function" && (l = true), d;
      });
      if (l) return () => {
        for (let r = 0; r < o.length; r++) {
          const d = o[r];
          typeof d == "function" ? d() : M0(n[r], null);
        }
      };
    };
  }
  function ER(...n) {
    return w.useCallback(AR(...n), n);
  }
  class CR extends w.Component {
    getSnapshotBeforeUpdate(i) {
      const l = this.props.childRef.current;
      if (Ko(l) && i.isPresent && !this.props.isPresent && this.props.pop !== false) {
        const o = l.offsetParent, r = Ko(o) && o.offsetWidth || 0, d = Ko(o) && o.offsetHeight || 0, f = getComputedStyle(l), h = this.props.sizeRef.current;
        h.height = parseFloat(f.height), h.width = parseFloat(f.width), h.top = l.offsetTop, h.left = l.offsetLeft, h.right = r - h.width - h.left, h.bottom = d - h.height - h.top;
      }
      return null;
    }
    componentDidUpdate() {
    }
    render() {
      return this.props.children;
    }
  }
  function MR({ children: n, isPresent: i, anchorX: l, anchorY: o, root: r, pop: d }) {
    var _a;
    const f = w.useId(), h = w.useRef(null), m = w.useRef({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }), { nonce: p } = w.useContext(Xd), g = ((_a = n.props) == null ? void 0 : _a.ref) ?? (n == null ? void 0 : n.ref), v = ER(h, g);
    return w.useInsertionEffect(() => {
      const { width: b, height: T, top: A, left: C, right: R, bottom: O } = m.current;
      if (i || d === false || !h.current || !b || !T) return;
      const L = l === "left" ? `left: ${C}` : `right: ${R}`, z = o === "bottom" ? `bottom: ${O}` : `top: ${A}`;
      h.current.dataset.motionPopId = f;
      const V = document.createElement("style");
      p && (V.nonce = p);
      const q = r ?? document.head;
      return q.appendChild(V), V.sheet && V.sheet.insertRule(`
          [data-motion-pop-id="${f}"] {
            position: absolute !important;
            width: ${b}px !important;
            height: ${T}px !important;
            ${L}px !important;
            ${z}px !important;
          }
        `), () => {
        var _a2;
        (_a2 = h.current) == null ? void 0 : _a2.removeAttribute("data-motion-pop-id"), q.contains(V) && q.removeChild(V);
      };
    }, [
      i
    ]), S.jsx(CR, {
      isPresent: i,
      childRef: h,
      sizeRef: m,
      pop: d,
      children: d === false ? n : w.cloneElement(n, {
        ref: v
      })
    });
  }
  const RR = ({ children: n, initial: i, isPresent: l, onExitComplete: o, custom: r, presenceAffectsLayout: d, mode: f, anchorX: h, anchorY: m, root: p }) => {
    const g = vd(DR), v = w.useId();
    let b = true, T = w.useMemo(() => (b = false, {
      id: v,
      initial: i,
      isPresent: l,
      custom: r,
      onExitComplete: (A) => {
        g.set(A, true);
        for (const C of g.values()) if (!C) return;
        o && o();
      },
      register: (A) => (g.set(A, false), () => g.delete(A))
    }), [
      l,
      g,
      o
    ]);
    return d && b && (T = {
      ...T
    }), w.useMemo(() => {
      g.forEach((A, C) => g.set(C, false));
    }, [
      l
    ]), w.useEffect(() => {
      !l && !g.size && o && o();
    }, [
      l
    ]), n = S.jsx(MR, {
      pop: f === "popLayout",
      isPresent: l,
      anchorX: h,
      anchorY: m,
      root: p,
      children: n
    }), S.jsx(Tr.Provider, {
      value: T,
      children: n
    });
  };
  function DR() {
    return /* @__PURE__ */ new Map();
  }
  function Ax(n = true) {
    const i = w.useContext(Tr);
    if (i === null) return [
      true,
      null
    ];
    const { isPresent: l, onExitComplete: o, register: r } = i, d = w.useId();
    w.useEffect(() => {
      if (n) return r(d);
    }, [
      n
    ]);
    const f = w.useCallback(() => n && o && o(d), [
      d,
      o,
      n
    ]);
    return !l && o ? [
      false,
      f
    ] : [
      true
    ];
  }
  const Go = (n) => n.key || "";
  function R0(n) {
    const i = [];
    return w.Children.forEach(n, (l) => {
      w.isValidElement(l) && i.push(l);
    }), i;
  }
  const Xa = ({ children: n, custom: i, initial: l = true, onExitComplete: o, presenceAffectsLayout: r = true, mode: d = "sync", propagate: f = false, anchorX: h = "left", anchorY: m = "top", root: p }) => {
    const [g, v] = Ax(f), b = w.useMemo(() => R0(n), [
      n
    ]), T = f && !g ? [] : b.map(Go), A = w.useRef(true), C = w.useRef(b), R = vd(() => /* @__PURE__ */ new Map()), O = w.useRef(/* @__PURE__ */ new Set()), [L, z] = w.useState(b), [V, q] = w.useState(b);
    Wv(() => {
      A.current = false, C.current = b;
      for (let G = 0; G < V.length; G++) {
        const tt = Go(V[G]);
        T.includes(tt) ? (R.delete(tt), O.current.delete(tt)) : R.get(tt) !== true && R.set(tt, false);
      }
    }, [
      V,
      T.length,
      T.join("-")
    ]);
    const $ = [];
    if (b !== L) {
      let G = [
        ...b
      ];
      for (let tt = 0; tt < V.length; tt++) {
        const I = V[tt], nt = Go(I);
        T.includes(nt) || (G.splice(tt, 0, I), $.push(I));
      }
      return d === "wait" && $.length && (G = $), q(R0(G)), z(b), null;
    }
    const { forceRender: X } = w.useContext(yd);
    return S.jsx(S.Fragment, {
      children: V.map((G) => {
        const tt = Go(G), I = f && !g ? false : b === V || T.includes(tt), nt = () => {
          if (O.current.has(tt)) return;
          if (R.has(tt)) O.current.add(tt), R.set(tt, true);
          else return;
          let st = true;
          R.forEach((gt) => {
            gt || (st = false);
          }), st && (X == null ? void 0 : X(), q(C.current), f && (v == null ? void 0 : v()), o && o());
        };
        return S.jsx(RR, {
          isPresent: I,
          initial: !A.current || l ? void 0 : false,
          custom: i,
          presenceAffectsLayout: r,
          mode: d,
          root: p,
          onExitComplete: I ? void 0 : nt,
          anchorX: h,
          anchorY: m,
          children: G
        }, tt);
      })
    });
  }, Ex = w.createContext({
    strict: false
  }), D0 = {
    animation: [
      "animate",
      "variants",
      "whileHover",
      "whileTap",
      "exit",
      "whileInView",
      "whileFocus",
      "whileDrag"
    ],
    exit: [
      "exit"
    ],
    drag: [
      "drag",
      "dragControls"
    ],
    focus: [
      "whileFocus"
    ],
    hover: [
      "whileHover",
      "onHoverStart",
      "onHoverEnd"
    ],
    tap: [
      "whileTap",
      "onTap",
      "onTapStart",
      "onTapCancel"
    ],
    pan: [
      "onPan",
      "onPanStart",
      "onPanSessionStart",
      "onPanEnd"
    ],
    inView: [
      "whileInView",
      "onViewportEnter",
      "onViewportLeave"
    ],
    layout: [
      "layout",
      "layoutId"
    ]
  };
  let O0 = false;
  function OR() {
    if (O0) return;
    const n = {};
    for (const i in D0) n[i] = {
      isEnabled: (l) => D0[i].some((o) => !!l[o])
    };
    tx(n), O0 = true;
  }
  function Cx() {
    return OR(), gM();
  }
  function jR(n) {
    const i = Cx();
    for (const l in n) i[l] = {
      ...i[l],
      ...n[l]
    };
    tx(i);
  }
  const NR = /* @__PURE__ */ new Set([
    "animate",
    "exit",
    "variants",
    "initial",
    "style",
    "values",
    "variants",
    "transition",
    "transformTemplate",
    "custom",
    "inherit",
    "onBeforeLayoutMeasure",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragStart",
    "onDrag",
    "onDragEnd",
    "onMeasureDragConstraints",
    "onDirectionLock",
    "onDragTransitionEnd",
    "_dragX",
    "_dragY",
    "onHoverStart",
    "onHoverEnd",
    "onViewportEnter",
    "onViewportLeave",
    "globalTapTarget",
    "propagate",
    "ignoreStrict",
    "viewport"
  ]);
  function fr(n) {
    return n.startsWith("while") || n.startsWith("drag") && n !== "draggable" || n.startsWith("layout") || n.startsWith("onTap") || n.startsWith("onPan") || n.startsWith("onLayout") || NR.has(n);
  }
  let Mx = (n) => !fr(n);
  function zR(n) {
    typeof n == "function" && (Mx = (i) => i.startsWith("on") ? !fr(i) : n(i));
  }
  try {
    zR(require("@emotion/is-prop-valid").default);
  } catch {
  }
  function _R(n, i, l) {
    const o = {};
    for (const r in n) r === "values" && typeof n.values == "object" || ue(n[r]) || (Mx(r) || l === true && fr(r) || !i && !fr(r) || n.draggable && r.startsWith("onDrag")) && (o[r] = n[r]);
    return o;
  }
  const Er = w.createContext({});
  function VR(n, i) {
    if (Ar(n)) {
      const { initial: l, animate: o } = n;
      return {
        initial: l === false || ul(l) ? l : void 0,
        animate: ul(o) ? o : void 0
      };
    }
    return n.inherit !== false ? i : {};
  }
  function kR(n) {
    const { initial: i, animate: l } = VR(n, w.useContext(Er));
    return w.useMemo(() => ({
      initial: i,
      animate: l
    }), [
      j0(i),
      j0(l)
    ]);
  }
  function j0(n) {
    return Array.isArray(n) ? n.join(" ") : n;
  }
  const Kd = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {}
  });
  function Rx(n, i, l) {
    for (const o in i) !ue(i[o]) && !ox(o, l) && (n[o] = i[o]);
  }
  function LR({ transformTemplate: n }, i) {
    return w.useMemo(() => {
      const l = Kd();
      return Pd(l, i, n), Object.assign({}, l.vars, l.style);
    }, [
      i
    ]);
  }
  function BR(n, i) {
    const l = n.style || {}, o = {};
    return Rx(o, l, n), Object.assign(o, LR(n, i)), o;
  }
  function UR(n, i) {
    const l = {}, o = BR(n, i);
    return n.drag && n.dragListener !== false && (l.draggable = false, o.userSelect = o.WebkitUserSelect = o.WebkitTouchCallout = "none", o.touchAction = n.drag === true ? "none" : `pan-${n.drag === "x" ? "y" : "x"}`), n.tabIndex === void 0 && (n.onTap || n.onTapStart || n.whileTap) && (l.tabIndex = 0), l.style = o, l;
  }
  const Dx = () => ({
    ...Kd(),
    attrs: {}
  });
  function HR(n, i, l, o) {
    const r = w.useMemo(() => {
      const d = Dx();
      return rx(d, i, ux(o), n.transformTemplate, n.style), {
        ...d.attrs,
        style: {
          ...d.style
        }
      };
    }, [
      i
    ]);
    if (n.style) {
      const d = {};
      Rx(d, n.style, n), r.style = {
        ...d,
        ...r.style
      };
    }
    return r;
  }
  const GR = [
    "animate",
    "circle",
    "defs",
    "desc",
    "ellipse",
    "g",
    "image",
    "line",
    "filter",
    "marker",
    "mask",
    "metadata",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "rect",
    "stop",
    "switch",
    "symbol",
    "svg",
    "text",
    "tspan",
    "use",
    "view"
  ];
  function Zd(n) {
    return typeof n != "string" || n.includes("-") ? false : !!(GR.indexOf(n) > -1 || /[A-Z]/u.test(n));
  }
  function YR(n, i, l, { latestValues: o }, r, d = false, f) {
    const m = (f ?? Zd(n) ? HR : UR)(i, o, r, n), p = _R(i, typeof n == "string", d), g = n !== w.Fragment ? {
      ...p,
      ...m,
      ref: l
    } : {}, { children: v } = i, b = w.useMemo(() => ue(v) ? v.get() : v, [
      v
    ]);
    return w.createElement(n, {
      ...g,
      children: b
    });
  }
  function PR({ scrapeMotionValuesFromProps: n, createRenderState: i }, l, o, r) {
    return {
      latestValues: qR(l, o, r, n),
      renderState: i()
    };
  }
  function qR(n, i, l, o) {
    const r = {}, d = o(n, {});
    for (const b in d) r[b] = $o(d[b]);
    let { initial: f, animate: h } = n;
    const m = Ar(n), p = Wb(n);
    i && p && !m && n.inherit !== false && (f === void 0 && (f = i.initial), h === void 0 && (h = i.animate));
    let g = l ? l.initial === false : false;
    g = g || f === false;
    const v = g ? h : f;
    if (v && typeof v != "boolean" && !wr(v)) {
      const b = Array.isArray(v) ? v : [
        v
      ];
      for (let T = 0; T < b.length; T++) {
        const A = Vd(n, b[T]);
        if (A) {
          const { transitionEnd: C, transition: R, ...O } = A;
          for (const L in O) {
            let z = O[L];
            if (Array.isArray(z)) {
              const V = g ? z.length - 1 : 0;
              z = z[V];
            }
            z !== null && (r[L] = z);
          }
          for (const L in C) r[L] = C[L];
        }
      }
    }
    return r;
  }
  const Ox = (n) => (i, l) => {
    const o = w.useContext(Er), r = w.useContext(Tr), d = () => PR(n, i, o, r);
    return l ? d() : vd(d);
  }, XR = Ox({
    scrapeMotionValuesFromProps: qd,
    createRenderState: Kd
  }), KR = Ox({
    scrapeMotionValuesFromProps: fx,
    createRenderState: Dx
  }), ZR = Symbol.for("motionComponentSymbol");
  function QR(n, i, l) {
    const o = w.useRef(l);
    w.useInsertionEffect(() => {
      o.current = l;
    });
    const r = w.useRef(null);
    return w.useCallback((d) => {
      var _a;
      d && ((_a = n.onMount) == null ? void 0 : _a.call(n, d));
      const f = o.current;
      if (typeof f == "function") if (d) {
        const h = f(d);
        typeof h == "function" && (r.current = h);
      } else r.current ? (r.current(), r.current = null) : f(d);
      else f && (f.current = d);
      i && (d ? i.mount(d) : i.unmount());
    }, [
      i
    ]);
  }
  const jx = w.createContext({});
  function Ba(n) {
    return n && typeof n == "object" && Object.prototype.hasOwnProperty.call(n, "current");
  }
  function FR(n, i, l, o, r, d) {
    var _a, _b2;
    const { visualElement: f } = w.useContext(Er), h = w.useContext(Ex), m = w.useContext(Tr), p = w.useContext(Xd), g = p.reducedMotion, v = p.skipAnimations, b = w.useRef(null), T = w.useRef(false);
    o = o || h.renderer, !b.current && o && (b.current = o(n, {
      visualState: i,
      parent: f,
      props: l,
      presenceContext: m,
      blockInitialAnimation: m ? m.initial === false : false,
      reducedMotionConfig: g,
      skipAnimations: v,
      isSVG: d
    }), T.current && b.current && (b.current.manuallyAnimateOnMount = true));
    const A = b.current, C = w.useContext(jx);
    A && !A.projection && r && (A.type === "html" || A.type === "svg") && JR(b.current, l, r, C);
    const R = w.useRef(false);
    w.useInsertionEffect(() => {
      A && R.current && A.update(l, m);
    });
    const O = l[Ub], L = w.useRef(!!O && typeof window < "u" && !((_a = window.MotionHandoffIsComplete) == null ? void 0 : _a.call(window, O)) && ((_b2 = window.MotionHasOptimisedAnimation) == null ? void 0 : _b2.call(window, O)));
    return Wv(() => {
      T.current = true, A && (R.current = true, window.MotionIsMounted = true, A.updateFeatures(), A.scheduleRenderMicrotask(), L.current && A.animationState && A.animationState.animateChanges());
    }), w.useEffect(() => {
      A && (!L.current && A.animationState && A.animationState.animateChanges(), L.current && (queueMicrotask(() => {
        var _a2;
        (_a2 = window.MotionHandoffMarkAsComplete) == null ? void 0 : _a2.call(window, O);
      }), L.current = false), A.enteringChildren = void 0);
    }), A;
  }
  function JR(n, i, l, o) {
    const { layoutId: r, layout: d, drag: f, dragConstraints: h, layoutScroll: m, layoutRoot: p, layoutCrossfade: g } = i;
    n.projection = new l(n.latestValues, i["data-framer-portal-id"] ? void 0 : Nx(n.parent)), n.projection.setOptions({
      layoutId: r,
      layout: d,
      alwaysMeasureLayout: !!f || h && Ba(h),
      visualElement: n,
      animationType: typeof d == "string" ? d : "both",
      initialPromotionConfig: o,
      crossfade: g,
      layoutScroll: m,
      layoutRoot: p
    });
  }
  function Nx(n) {
    if (n) return n.options.allowProjection !== false ? n.projection : Nx(n.parent);
  }
  function hf(n, { forwardMotionProps: i = false, type: l } = {}, o, r) {
    o && jR(o);
    const d = l ? l === "svg" : Zd(n), f = d ? KR : XR;
    function h(p, g) {
      let v;
      const b = {
        ...w.useContext(Xd),
        ...p,
        layoutId: $R(p)
      }, { isStatic: T } = b, A = kR(p), C = f(p, T);
      if (!T && typeof window < "u") {
        WR();
        const R = IR(b);
        v = R.MeasureLayout, A.visualElement = FR(n, C, b, r, R.ProjectionNode, d);
      }
      return S.jsxs(Er.Provider, {
        value: A,
        children: [
          v && A.visualElement ? S.jsx(v, {
            visualElement: A.visualElement,
            ...b
          }) : null,
          YR(n, p, QR(C, A.visualElement, g), C, T, i, d)
        ]
      });
    }
    h.displayName = `motion.${typeof n == "string" ? n : `create(${n.displayName ?? n.name ?? ""})`}`;
    const m = w.forwardRef(h);
    return m[ZR] = n, m;
  }
  function $R({ layoutId: n }) {
    const i = w.useContext(yd).id;
    return i && n !== void 0 ? i + "-" + n : n;
  }
  function WR(n, i) {
    w.useContext(Ex).strict;
  }
  function IR(n) {
    const i = Cx(), { drag: l, layout: o } = i;
    if (!l && !o) return {};
    const r = {
      ...l,
      ...o
    };
    return {
      MeasureLayout: (l == null ? void 0 : l.isEnabled(n)) || (o == null ? void 0 : o.isEnabled(n)) ? r.MeasureLayout : void 0,
      ProjectionNode: r.ProjectionNode
    };
  }
  function tD(n, i) {
    if (typeof Proxy > "u") return hf;
    const l = /* @__PURE__ */ new Map(), o = (d, f) => hf(d, f, n, i), r = (d, f) => o(d, f);
    return new Proxy(r, {
      get: (d, f) => f === "create" ? o : (l.has(f) || l.set(f, hf(f, void 0, n, i)), l.get(f))
    });
  }
  const eD = (n, i) => i.isSVG ?? Zd(n) ? new zM(i) : new MM(i, {
    allowProjection: n !== w.Fragment
  });
  class nD extends Ai {
    constructor(i) {
      super(i), i.animationState || (i.animationState = BM(i));
    }
    updateAnimationControlsSubscription() {
      const { animate: i } = this.node.getProps();
      wr(i) && (this.unmountControls = i.subscribe(this.node));
    }
    mount() {
      this.updateAnimationControlsSubscription();
    }
    update() {
      const { animate: i } = this.node.getProps(), { animate: l } = this.node.prevProps || {};
      i !== l && this.updateAnimationControlsSubscription();
    }
    unmount() {
      var _a;
      this.node.animationState.reset(), (_a = this.unmountControls) == null ? void 0 : _a.call(this);
    }
  }
  let iD = 0;
  class aD extends Ai {
    constructor() {
      super(...arguments), this.id = iD++, this.isExitComplete = false;
    }
    update() {
      var _a;
      if (!this.node.presenceContext) return;
      const { isPresent: i, onExitComplete: l } = this.node.presenceContext, { isPresent: o } = this.node.prevPresenceContext || {};
      if (!this.node.animationState || i === o) return;
      if (i && o === false) {
        if (this.isExitComplete) {
          const { initial: d, custom: f } = this.node.getProps();
          if (typeof d == "string") {
            const h = Ji(this.node, d, f);
            if (h) {
              const { transition: m, transitionEnd: p, ...g } = h;
              for (const v in g) (_a = this.node.getValue(v)) == null ? void 0 : _a.jump(g[v]);
            }
          }
          this.node.animationState.reset(), this.node.animationState.animateChanges();
        } else this.node.animationState.setActive("exit", false);
        this.isExitComplete = false;
        return;
      }
      const r = this.node.animationState.setActive("exit", !i);
      l && !i && r.then(() => {
        this.isExitComplete = true, l(this.id);
      });
    }
    mount() {
      const { register: i, onExitComplete: l } = this.node.presenceContext || {};
      l && l(this.id), i && (this.unmount = i(this.id));
    }
    unmount() {
    }
  }
  const sD = {
    animation: {
      Feature: nD
    },
    exit: {
      Feature: aD
    }
  };
  function gl(n) {
    return {
      point: {
        x: n.pageX,
        y: n.pageY
      }
    };
  }
  const lD = (n) => (i) => Ud(i) && n(i, gl(i));
  function sl(n, i, l, o) {
    return fl(n, i, lD(l), o);
  }
  const zx = ({ current: n }) => n ? n.ownerDocument.defaultView : null, N0 = (n, i) => Math.abs(n - i);
  function oD(n, i) {
    const l = N0(n.x, i.x), o = N0(n.y, i.y);
    return Math.sqrt(l ** 2 + o ** 2);
  }
  const z0 = /* @__PURE__ */ new Set([
    "auto",
    "scroll"
  ]);
  class _x {
    constructor(i, l, { transformPagePoint: o, contextWindow: r = window, dragSnapToOrigin: d = false, distanceThreshold: f = 3, element: h } = {}) {
      if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (T) => {
        this.handleScroll(T.target);
      }, this.onWindowScroll = () => {
        this.handleScroll(window);
      }, this.updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Yo(this.lastRawMoveEventInfo, this.transformPagePoint));
        const T = mf(this.lastMoveEventInfo, this.history), A = this.startEvent !== null, C = oD(T.offset, {
          x: 0,
          y: 0
        }) >= this.distanceThreshold;
        if (!A && !C) return;
        const { point: R } = T, { timestamp: O } = ce;
        this.history.push({
          ...R,
          timestamp: O
        });
        const { onStart: L, onMove: z } = this.handlers;
        A || (L && L(this.lastMoveEvent, T), this.startEvent = this.lastMoveEvent), z && z(this.lastMoveEvent, T);
      }, this.handlePointerMove = (T, A) => {
        this.lastMoveEvent = T, this.lastRawMoveEventInfo = A, this.lastMoveEventInfo = Yo(A, this.transformPagePoint), Lt.update(this.updatePoint, true);
      }, this.handlePointerUp = (T, A) => {
        this.end();
        const { onEnd: C, onSessionEnd: R, resumeAnimation: O } = this.handlers;
        if ((this.dragSnapToOrigin || !this.startEvent) && O && O(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        const L = mf(T.type === "pointercancel" ? this.lastMoveEventInfo : Yo(A, this.transformPagePoint), this.history);
        this.startEvent && C && C(T, L), R && R(T, L);
      }, !Ud(i)) return;
      this.dragSnapToOrigin = d, this.handlers = l, this.transformPagePoint = o, this.distanceThreshold = f, this.contextWindow = r || window;
      const m = gl(i), p = Yo(m, this.transformPagePoint), { point: g } = p, { timestamp: v } = ce;
      this.history = [
        {
          ...g,
          timestamp: v
        }
      ];
      const { onSessionStart: b } = l;
      b && b(i, mf(p, this.history)), this.removeListeners = hl(sl(this.contextWindow, "pointermove", this.handlePointerMove), sl(this.contextWindow, "pointerup", this.handlePointerUp), sl(this.contextWindow, "pointercancel", this.handlePointerUp)), h && this.startScrollTracking(h);
    }
    startScrollTracking(i) {
      let l = i.parentElement;
      for (; l; ) {
        const o = getComputedStyle(l);
        (z0.has(o.overflowX) || z0.has(o.overflowY)) && this.scrollPositions.set(l, {
          x: l.scrollLeft,
          y: l.scrollTop
        }), l = l.parentElement;
      }
      this.scrollPositions.set(window, {
        x: window.scrollX,
        y: window.scrollY
      }), window.addEventListener("scroll", this.onElementScroll, {
        capture: true
      }), window.addEventListener("scroll", this.onWindowScroll), this.removeScrollListeners = () => {
        window.removeEventListener("scroll", this.onElementScroll, {
          capture: true
        }), window.removeEventListener("scroll", this.onWindowScroll);
      };
    }
    handleScroll(i) {
      const l = this.scrollPositions.get(i);
      if (!l) return;
      const o = i === window, r = o ? {
        x: window.scrollX,
        y: window.scrollY
      } : {
        x: i.scrollLeft,
        y: i.scrollTop
      }, d = {
        x: r.x - l.x,
        y: r.y - l.y
      };
      d.x === 0 && d.y === 0 || (o ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += d.x, this.lastMoveEventInfo.point.y += d.y) : this.history.length > 0 && (this.history[0].x -= d.x, this.history[0].y -= d.y), this.scrollPositions.set(i, r), Lt.update(this.updatePoint, true));
    }
    updateHandlers(i) {
      this.handlers = i;
    }
    end() {
      this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), Ti(this.updatePoint);
    }
  }
  function Yo(n, i) {
    return i ? {
      point: i(n.point)
    } : n;
  }
  function _0(n, i) {
    return {
      x: n.x - i.x,
      y: n.y - i.y
    };
  }
  function mf({ point: n }, i) {
    return {
      point: n,
      delta: _0(n, Vx(i)),
      offset: _0(n, rD(i)),
      velocity: cD(i, 0.1)
    };
  }
  function rD(n) {
    return n[0];
  }
  function Vx(n) {
    return n[n.length - 1];
  }
  function cD(n, i) {
    if (n.length < 2) return {
      x: 0,
      y: 0
    };
    let l = n.length - 1, o = null;
    const r = Vx(n);
    for (; l >= 0 && (o = n[l], !(r.timestamp - o.timestamp > ke(i))); ) l--;
    if (!o) return {
      x: 0,
      y: 0
    };
    o === n[0] && n.length > 2 && r.timestamp - o.timestamp > ke(i) * 2 && (o = n[1]);
    const d = Qe(r.timestamp - o.timestamp);
    if (d === 0) return {
      x: 0,
      y: 0
    };
    const f = {
      x: (r.x - o.x) / d,
      y: (r.y - o.y) / d
    };
    return f.x === 1 / 0 && (f.x = 0), f.y === 1 / 0 && (f.y = 0), f;
  }
  function uD(n, { min: i, max: l }, o) {
    return i !== void 0 && n < i ? n = o ? Yt(i, n, o.min) : Math.max(n, i) : l !== void 0 && n > l && (n = o ? Yt(l, n, o.max) : Math.min(n, l)), n;
  }
  function V0(n, i, l) {
    return {
      min: i !== void 0 ? n.min + i : void 0,
      max: l !== void 0 ? n.max + l - (n.max - n.min) : void 0
    };
  }
  function fD(n, { top: i, left: l, bottom: o, right: r }) {
    return {
      x: V0(n.x, l, r),
      y: V0(n.y, i, o)
    };
  }
  function k0(n, i) {
    let l = i.min - n.min, o = i.max - n.max;
    return i.max - i.min < n.max - n.min && ([l, o] = [
      o,
      l
    ]), {
      min: l,
      max: o
    };
  }
  function dD(n, i) {
    return {
      x: k0(n.x, i.x),
      y: k0(n.y, i.y)
    };
  }
  function hD(n, i) {
    let l = 0.5;
    const o = pe(n), r = pe(i);
    return r > o ? l = rl(i.min, i.max - o, n.min) : o > r && (l = rl(n.min, n.max - r, i.min)), xn(0, 1, l);
  }
  function mD(n, i) {
    const l = {};
    return i.min !== void 0 && (l.min = i.min - n.min), i.max !== void 0 && (l.max = i.max - n.min), l;
  }
  const Jf = 0.35;
  function pD(n = Jf) {
    return n === false ? n = 0 : n === true && (n = Jf), {
      x: L0(n, "left", "right"),
      y: L0(n, "top", "bottom")
    };
  }
  function L0(n, i, l) {
    return {
      min: B0(n, i),
      max: B0(n, l)
    };
  }
  function B0(n, i) {
    return typeof n == "number" ? n : n[i] || 0;
  }
  const gD = /* @__PURE__ */ new WeakMap();
  class yD {
    constructor(i) {
      this.openDragLock = null, this.isDragging = false, this.currentDirection = null, this.originPoint = {
        x: 0,
        y: 0
      }, this.constraints = false, this.hasMutatedConstraints = false, this.elastic = ee(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = i;
    }
    start(i, { snapToCursor: l = false, distanceThreshold: o } = {}) {
      const { presenceContext: r } = this.visualElement;
      if (r && r.isPresent === false) return;
      const d = (v) => {
        l && this.snapToCursor(gl(v).point), this.stopAnimation();
      }, f = (v, b) => {
        const { drag: T, dragPropagation: A, onDragStart: C } = this.getProps();
        if (T && !A && (this.openDragLock && this.openDragLock(), this.openDragLock = KC(T), !this.openDragLock)) return;
        this.latestPointerEvent = v, this.latestPanInfo = b, this.isDragging = true, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = true, this.visualElement.projection.target = void 0), pn((O) => {
          let L = this.getAxisMotionValue(O).get() || 0;
          if (bn.test(L)) {
            const { projection: z } = this.visualElement;
            if (z && z.layout) {
              const V = z.layout.layoutBox[O];
              V && (L = pe(V) * (parseFloat(L) / 100));
            }
          }
          this.originPoint[O] = L;
        }), C && Lt.update(() => C(v, b), false, true), Gf(this.visualElement, "transform");
        const { animationState: R } = this.visualElement;
        R && R.setActive("whileDrag", true);
      }, h = (v, b) => {
        this.latestPointerEvent = v, this.latestPanInfo = b;
        const { dragPropagation: T, dragDirectionLock: A, onDirectionLock: C, onDrag: R } = this.getProps();
        if (!T && !this.openDragLock) return;
        const { offset: O } = b;
        if (A && this.currentDirection === null) {
          this.currentDirection = bD(O), this.currentDirection !== null && C && C(this.currentDirection);
          return;
        }
        this.updateAxis("x", b.point, O), this.updateAxis("y", b.point, O), this.visualElement.render(), R && Lt.update(() => R(v, b), false, true);
      }, m = (v, b) => {
        this.latestPointerEvent = v, this.latestPanInfo = b, this.stop(v, b), this.latestPointerEvent = null, this.latestPanInfo = null;
      }, p = () => {
        const { dragSnapToOrigin: v } = this.getProps();
        (v || this.constraints) && this.startAnimation({
          x: 0,
          y: 0
        });
      }, { dragSnapToOrigin: g } = this.getProps();
      this.panSession = new _x(i, {
        onSessionStart: d,
        onStart: f,
        onMove: h,
        onSessionEnd: m,
        resumeAnimation: p
      }, {
        transformPagePoint: this.visualElement.getTransformPagePoint(),
        dragSnapToOrigin: g,
        distanceThreshold: o,
        contextWindow: zx(this.visualElement),
        element: this.visualElement.current
      });
    }
    stop(i, l) {
      const o = i || this.latestPointerEvent, r = l || this.latestPanInfo, d = this.isDragging;
      if (this.cancel(), !d || !r || !o) return;
      const { velocity: f } = r;
      this.startAnimation(f);
      const { onDragEnd: h } = this.getProps();
      h && Lt.postRender(() => h(o, r));
    }
    cancel() {
      this.isDragging = false;
      const { projection: i, animationState: l } = this.visualElement;
      i && (i.isAnimationBlocked = false), this.endPanSession();
      const { dragPropagation: o } = this.getProps();
      !o && this.openDragLock && (this.openDragLock(), this.openDragLock = null), l && l.setActive("whileDrag", false);
    }
    endPanSession() {
      this.panSession && this.panSession.end(), this.panSession = void 0;
    }
    updateAxis(i, l, o) {
      const { drag: r } = this.getProps();
      if (!o || !Po(i, r, this.currentDirection)) return;
      const d = this.getAxisMotionValue(i);
      let f = this.originPoint[i] + o[i];
      this.constraints && this.constraints[i] && (f = uD(f, this.constraints[i], this.elastic[i])), d.set(f);
    }
    resolveConstraints() {
      var _a;
      const { dragConstraints: i, dragElastic: l } = this.getProps(), o = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : (_a = this.visualElement.projection) == null ? void 0 : _a.layout, r = this.constraints;
      i && Ba(i) ? this.constraints || (this.constraints = this.resolveRefConstraints()) : i && o ? this.constraints = fD(o.layoutBox, i) : this.constraints = false, this.elastic = pD(l), r !== this.constraints && !Ba(i) && o && this.constraints && !this.hasMutatedConstraints && pn((d) => {
        this.constraints !== false && this.getAxisMotionValue(d) && (this.constraints[d] = mD(o.layoutBox[d], this.constraints[d]));
      });
    }
    resolveRefConstraints() {
      const { dragConstraints: i, onMeasureDragConstraints: l } = this.getProps();
      if (!i || !Ba(i)) return false;
      const o = i.current, { projection: r } = this.visualElement;
      if (!r || !r.layout) return false;
      const d = SM(o, r.root, this.visualElement.getTransformPagePoint());
      let f = dD(r.layout.layoutBox, d);
      if (l) {
        const h = l(vM(f));
        this.hasMutatedConstraints = !!h, h && (f = nx(h));
      }
      return f;
    }
    startAnimation(i) {
      const { drag: l, dragMomentum: o, dragElastic: r, dragTransition: d, dragSnapToOrigin: f, onDragTransitionEnd: h } = this.getProps(), m = this.constraints || {}, p = pn((g) => {
        if (!Po(g, l, this.currentDirection)) return;
        let v = m && m[g] || {};
        (f === true || f === g) && (v = {
          min: 0,
          max: 0
        });
        const b = r ? 200 : 1e6, T = r ? 40 : 1e7, A = {
          type: "inertia",
          velocity: o ? i[g] : 0,
          bounceStiffness: b,
          bounceDamping: T,
          timeConstant: 750,
          restDelta: 1,
          restSpeed: 10,
          ...d,
          ...v
        };
        return this.startAxisValueAnimation(g, A);
      });
      return Promise.all(p).then(h);
    }
    startAxisValueAnimation(i, l) {
      const o = this.getAxisMotionValue(i);
      return Gf(this.visualElement, i), o.start(_d(i, o, 0, l, this.visualElement, false));
    }
    stopAnimation() {
      pn((i) => this.getAxisMotionValue(i).stop());
    }
    getAxisMotionValue(i) {
      const l = `_drag${i.toUpperCase()}`, o = this.visualElement.getProps(), r = o[l];
      return r || this.visualElement.getValue(i, (o.initial ? o.initial[i] : void 0) || 0);
    }
    snapToCursor(i) {
      pn((l) => {
        const { drag: o } = this.getProps();
        if (!Po(l, o, this.currentDirection)) return;
        const { projection: r } = this.visualElement, d = this.getAxisMotionValue(l);
        if (r && r.layout) {
          const { min: f, max: h } = r.layout.layoutBox[l], m = d.get() || 0;
          d.set(i[l] - Yt(f, h, 0.5) + m);
        }
      });
    }
    scalePositionWithinConstraints() {
      if (!this.visualElement.current) return;
      const { drag: i, dragConstraints: l } = this.getProps(), { projection: o } = this.visualElement;
      if (!Ba(l) || !o || !this.constraints) return;
      this.stopAnimation();
      const r = {
        x: 0,
        y: 0
      };
      pn((f) => {
        const h = this.getAxisMotionValue(f);
        if (h && this.constraints !== false) {
          const m = h.get();
          r[f] = hD({
            min: m,
            max: m
          }, this.constraints[f]);
        }
      });
      const { transformTemplate: d } = this.visualElement.getProps();
      this.visualElement.current.style.transform = d ? d({}, "") : "none", o.root && o.root.updateScroll(), o.updateLayout(), this.constraints = false, this.resolveConstraints(), pn((f) => {
        if (!Po(f, i, null)) return;
        const h = this.getAxisMotionValue(f), { min: m, max: p } = this.constraints[f];
        h.set(Yt(m, p, r[f]));
      }), this.visualElement.render();
    }
    addListeners() {
      if (!this.visualElement.current) return;
      gD.set(this.visualElement, this);
      const i = this.visualElement.current, l = sl(i, "pointerdown", (p) => {
        const { drag: g, dragListener: v = true } = this.getProps(), b = p.target, T = b !== i && WC(b);
        g && v && !T && this.start(p);
      });
      let o;
      const r = () => {
        const { dragConstraints: p } = this.getProps();
        Ba(p) && p.current && (this.constraints = this.resolveRefConstraints(), o || (o = vD(i, p.current, () => this.scalePositionWithinConstraints())));
      }, { projection: d } = this.visualElement, f = d.addEventListener("measure", r);
      d && !d.layout && (d.root && d.root.updateScroll(), d.updateLayout()), Lt.read(r);
      const h = fl(window, "resize", () => this.scalePositionWithinConstraints()), m = d.addEventListener("didUpdate", (({ delta: p, hasLayoutChanged: g }) => {
        this.isDragging && g && (pn((v) => {
          const b = this.getAxisMotionValue(v);
          b && (this.originPoint[v] += p[v].translate, b.set(b.get() + p[v].translate));
        }), this.visualElement.render());
      }));
      return () => {
        h(), l(), f(), m && m(), o && o();
      };
    }
    getProps() {
      const i = this.visualElement.getProps(), { drag: l = false, dragDirectionLock: o = false, dragPropagation: r = false, dragConstraints: d = false, dragElastic: f = Jf, dragMomentum: h = true } = i;
      return {
        ...i,
        drag: l,
        dragDirectionLock: o,
        dragPropagation: r,
        dragConstraints: d,
        dragElastic: f,
        dragMomentum: h
      };
    }
  }
  function U0(n) {
    let i = true;
    return () => {
      if (i) {
        i = false;
        return;
      }
      n();
    };
  }
  function vD(n, i, l) {
    const o = Ky(n, U0(l)), r = Ky(i, U0(l));
    return () => {
      o(), r();
    };
  }
  function Po(n, i, l) {
    return (i === true || i === n) && (l === null || l === n);
  }
  function bD(n, i = 10) {
    let l = null;
    return Math.abs(n.y) > i ? l = "y" : Math.abs(n.x) > i && (l = "x"), l;
  }
  class xD extends Ai {
    constructor(i) {
      super(i), this.removeGroupControls = Fe, this.removeListeners = Fe, this.controls = new yD(i);
    }
    mount() {
      const { dragControls: i } = this.node.getProps();
      i && (this.removeGroupControls = i.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || Fe;
    }
    update() {
      const { dragControls: i } = this.node.getProps(), { dragControls: l } = this.node.prevProps || {};
      i !== l && (this.removeGroupControls(), i && (this.removeGroupControls = i.subscribe(this.controls)));
    }
    unmount() {
      this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
    }
  }
  const pf = (n) => (i, l) => {
    n && Lt.update(() => n(i, l), false, true);
  };
  class SD extends Ai {
    constructor() {
      super(...arguments), this.removePointerDownListener = Fe;
    }
    onPointerDown(i) {
      this.session = new _x(i, this.createPanHandlers(), {
        transformPagePoint: this.node.getTransformPagePoint(),
        contextWindow: zx(this.node)
      });
    }
    createPanHandlers() {
      const { onPanSessionStart: i, onPanStart: l, onPan: o, onPanEnd: r } = this.node.getProps();
      return {
        onSessionStart: pf(i),
        onStart: pf(l),
        onMove: pf(o),
        onEnd: (d, f) => {
          delete this.session, r && Lt.postRender(() => r(d, f));
        }
      };
    }
    mount() {
      this.removePointerDownListener = sl(this.node.current, "pointerdown", (i) => this.onPointerDown(i));
    }
    update() {
      this.session && this.session.updateHandlers(this.createPanHandlers());
    }
    unmount() {
      this.removePointerDownListener(), this.session && this.session.end();
    }
  }
  let gf = false;
  class TD extends w.Component {
    componentDidMount() {
      const { visualElement: i, layoutGroup: l, switchLayoutGroup: o, layoutId: r } = this.props, { projection: d } = i;
      d && (l.group && l.group.add(d), o && o.register && r && o.register(d), gf && d.root.didUpdate(), d.addEventListener("animationComplete", () => {
        this.safeToRemove();
      }), d.setOptions({
        ...d.options,
        layoutDependency: this.props.layoutDependency,
        onExitComplete: () => this.safeToRemove()
      })), Wo.hasEverUpdated = true;
    }
    getSnapshotBeforeUpdate(i) {
      const { layoutDependency: l, visualElement: o, drag: r, isPresent: d } = this.props, { projection: f } = o;
      return f && (f.isPresent = d, i.layoutDependency !== l && f.setOptions({
        ...f.options,
        layoutDependency: l
      }), gf = true, r || i.layoutDependency !== l || l === void 0 || i.isPresent !== d ? f.willUpdate() : this.safeToRemove(), i.isPresent !== d && (d ? f.promote() : f.relegate() || Lt.postRender(() => {
        const h = f.getStack();
        (!h || !h.members.length) && this.safeToRemove();
      }))), null;
    }
    componentDidUpdate() {
      const { projection: i } = this.props.visualElement;
      i && (i.root.didUpdate(), Bd.postRender(() => {
        !i.currentAnimation && i.isLead() && this.safeToRemove();
      }));
    }
    componentWillUnmount() {
      const { visualElement: i, layoutGroup: l, switchLayoutGroup: o } = this.props, { projection: r } = i;
      gf = true, r && (r.scheduleCheckAfterUnmount(), l && l.group && l.group.remove(r), o && o.deregister && o.deregister(r));
    }
    safeToRemove() {
      const { safeToRemove: i } = this.props;
      i && i();
    }
    render() {
      return null;
    }
  }
  function kx(n) {
    const [i, l] = Ax(), o = w.useContext(yd);
    return S.jsx(TD, {
      ...n,
      layoutGroup: o,
      switchLayoutGroup: w.useContext(jx),
      isPresent: i,
      safeToRemove: l
    });
  }
  const wD = {
    pan: {
      Feature: SD
    },
    drag: {
      Feature: xD,
      ProjectionNode: wx,
      MeasureLayout: kx
    }
  };
  function H0(n, i, l) {
    const { props: o } = n;
    n.animationState && o.whileHover && n.animationState.setActive("whileHover", l === "Start");
    const r = "onHover" + l, d = o[r];
    d && Lt.postRender(() => d(i, gl(i)));
  }
  class AD extends Ai {
    mount() {
      const { current: i } = this.node;
      i && (this.unmount = QC(i, (l, o) => (H0(this.node, o, "Start"), (r) => H0(this.node, r, "End"))));
    }
    unmount() {
    }
  }
  class ED extends Ai {
    constructor() {
      super(...arguments), this.isActive = false;
    }
    onFocus() {
      let i = false;
      try {
        i = this.node.current.matches(":focus-visible");
      } catch {
        i = true;
      }
      !i || !this.node.animationState || (this.node.animationState.setActive("whileFocus", true), this.isActive = true);
    }
    onBlur() {
      !this.isActive || !this.node.animationState || (this.node.animationState.setActive("whileFocus", false), this.isActive = false);
    }
    mount() {
      this.unmount = hl(fl(this.node.current, "focus", () => this.onFocus()), fl(this.node.current, "blur", () => this.onBlur()));
    }
    unmount() {
    }
  }
  function G0(n, i, l) {
    const { props: o } = n;
    if (n.current instanceof HTMLButtonElement && n.current.disabled) return;
    n.animationState && o.whileTap && n.animationState.setActive("whileTap", l === "Start");
    const r = "onTap" + (l === "End" ? "" : l), d = o[r];
    d && Lt.postRender(() => d(i, gl(i)));
  }
  class CD extends Ai {
    mount() {
      const { current: i } = this.node;
      if (!i) return;
      const { globalTapTarget: l, propagate: o } = this.node.props;
      this.unmount = tM(i, (r, d) => (G0(this.node, d, "Start"), (f, { success: h }) => G0(this.node, f, h ? "End" : "Cancel")), {
        useGlobalTarget: l,
        stopPropagation: (o == null ? void 0 : o.tap) === false
      });
    }
    unmount() {
    }
  }
  const $f = /* @__PURE__ */ new WeakMap(), yf = /* @__PURE__ */ new WeakMap(), MD = (n) => {
    const i = $f.get(n.target);
    i && i(n);
  }, RD = (n) => {
    n.forEach(MD);
  };
  function DD({ root: n, ...i }) {
    const l = n || document;
    yf.has(l) || yf.set(l, {});
    const o = yf.get(l), r = JSON.stringify(i);
    return o[r] || (o[r] = new IntersectionObserver(RD, {
      root: n,
      ...i
    })), o[r];
  }
  function OD(n, i, l) {
    const o = DD(i);
    return $f.set(n, l), o.observe(n), () => {
      $f.delete(n), o.unobserve(n);
    };
  }
  const jD = {
    some: 0,
    all: 1
  };
  class ND extends Ai {
    constructor() {
      super(...arguments), this.hasEnteredView = false, this.isInView = false;
    }
    startObserver() {
      this.unmount();
      const { viewport: i = {} } = this.node.getProps(), { root: l, margin: o, amount: r = "some", once: d } = i, f = {
        root: l ? l.current : void 0,
        rootMargin: o,
        threshold: typeof r == "number" ? r : jD[r]
      }, h = (m) => {
        const { isIntersecting: p } = m;
        if (this.isInView === p || (this.isInView = p, d && !p && this.hasEnteredView)) return;
        p && (this.hasEnteredView = true), this.node.animationState && this.node.animationState.setActive("whileInView", p);
        const { onViewportEnter: g, onViewportLeave: v } = this.node.getProps(), b = p ? g : v;
        b && b(m);
      };
      return OD(this.node.current, f, h);
    }
    mount() {
      this.startObserver();
    }
    update() {
      if (typeof IntersectionObserver > "u") return;
      const { props: i, prevProps: l } = this.node;
      [
        "amount",
        "margin",
        "root"
      ].some(zD(i, l)) && this.startObserver();
    }
    unmount() {
    }
  }
  function zD({ viewport: n = {} }, { viewport: i = {} } = {}) {
    return (l) => n[l] !== i[l];
  }
  const _D = {
    inView: {
      Feature: ND
    },
    tap: {
      Feature: CD
    },
    focus: {
      Feature: ED
    },
    hover: {
      Feature: AD
    }
  }, VD = {
    layout: {
      ProjectionNode: wx,
      MeasureLayout: kx
    }
  }, kD = {
    ...sD,
    ..._D,
    ...wD,
    ...VD
  }, rn = tD(kD, eD), LD = "modulepreload", BD = function(n) {
    return "/" + n;
  }, Y0 = {}, UD = function(i, l, o) {
    let r = Promise.resolve();
    if (l && l.length > 0) {
      let f = function(p) {
        return Promise.all(p.map((g) => Promise.resolve(g).then((v) => ({
          status: "fulfilled",
          value: v
        }), (v) => ({
          status: "rejected",
          reason: v
        }))));
      };
      document.getElementsByTagName("link");
      const h = document.querySelector("meta[property=csp-nonce]"), m = (h == null ? void 0 : h.nonce) || (h == null ? void 0 : h.getAttribute("nonce"));
      r = f(l.map((p) => {
        if (p = BD(p), p in Y0) return;
        Y0[p] = true;
        const g = p.endsWith(".css"), v = g ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${p}"]${v}`)) return;
        const b = document.createElement("link");
        if (b.rel = g ? "stylesheet" : LD, g || (b.as = "script"), b.crossOrigin = "", b.href = p, m && b.setAttribute("nonce", m), document.head.appendChild(b), g) return new Promise((T, A) => {
          b.addEventListener("load", T), b.addEventListener("error", () => A(new Error(`Unable to preload CSS for ${p}`)));
        });
      }));
    }
    function d(f) {
      const h = new Event("vite:preloadError", {
        cancelable: true
      });
      if (h.payload = f, window.dispatchEvent(h), !h.defaultPrevented) throw f;
    }
    return r.then((f) => {
      for (const h of f || []) h.status === "rejected" && d(h.reason);
      return i().catch(d);
    });
  };
  function HD(n) {
    const i = w.useRef(null), l = w.useRef(false), o = w.useRef(null), [r, d] = w.useState({
      ready: false,
      hasSource: false,
      sourcePos: null,
      undoCount: 0,
      redoCount: 0,
      history: [],
      zoom: 1,
      width: 0,
      height: 0
    }), f = w.useCallback(() => {
      const N = i.current;
      if (!N) return;
      const E = N.history_labels().split("|").map((j, K) => {
        const W = j.indexOf(":");
        return {
          type: j.slice(0, W),
          label: j.slice(W + 1),
          index: K
        };
      });
      d({
        ready: true,
        hasSource: N.has_source(),
        sourcePos: o.current,
        undoCount: N.undo_count(),
        redoCount: N.redo_count(),
        history: E,
        zoom: N.get_zoom(),
        width: N.width(),
        height: N.height()
      });
    }, []), h = w.useCallback(() => {
      const N = i.current, E = n.current;
      if (!N || !E) return;
      (E.width !== N.width() || E.height !== N.height()) && (E.width = N.width(), E.height = N.height()), E.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(N.get_image_data()), N.width(), N.height()), 0, 0);
    }, [
      n
    ]), m = w.useCallback((N) => {
      const E = n.current;
      if (!E) return {
        x: 0,
        y: 0
      };
      const j = E.getBoundingClientRect();
      return {
        x: Math.floor((N.clientX - j.left) * E.width / j.width),
        y: Math.floor((N.clientY - j.top) * E.height / j.height)
      };
    }, [
      n
    ]), p = w.useCallback(async (N) => {
      const { default: E, CloneStampTool: j } = await UD(async () => {
        const { default: et, CloneStampTool: at } = await import("./stamp_tool-CrTC4tOM.js");
        return {
          default: et,
          CloneStampTool: at
        };
      }, []);
      await E();
      const K = URL.createObjectURL(N), W = new Image();
      W.onload = () => {
        const et = n.current;
        if (!et) return;
        et.width = W.width, et.height = W.height;
        const at = et.getContext("2d");
        at.drawImage(W, 0, 0);
        const dt = at.getImageData(0, 0, W.width, W.height), Ht = new j(W.width, W.height);
        Ht.load_image(new Uint8Array(dt.data)), i.current = Ht, o.current = null, URL.revokeObjectURL(K), f();
      }, W.src = K;
    }, [
      n,
      f
    ]), g = w.useCallback((N) => {
      var _a;
      (_a = i.current) == null ? void 0 : _a.set_brush_size(N);
    }, []), v = w.useCallback((N) => {
      var _a;
      (_a = i.current) == null ? void 0 : _a.set_hardness(N);
    }, []), b = w.useCallback((N) => {
      var _a;
      (_a = i.current) == null ? void 0 : _a.set_opacity(N);
    }, []), T = w.useCallback((N) => {
      var _a;
      (_a = i.current) == null ? void 0 : _a.set_spacing(N);
    }, []), A = w.useCallback(() => {
      var _a;
      ((_a = i.current) == null ? void 0 : _a.undo()) && (h(), f());
    }, [
      h,
      f
    ]), C = w.useCallback(() => {
      var _a;
      console.log("Redo function called, redoCount:", r.redoCount), ((_a = i.current) == null ? void 0 : _a.redo()) ? (console.log("Redo successful"), h(), f()) : console.log("Redo failed or no redo available");
    }, [
      h,
      f,
      r.redoCount
    ]), R = w.useCallback((N) => {
      var _a;
      ((_a = i.current) == null ? void 0 : _a.jump_to_history(N)) && (h(), f());
    }, [
      h,
      f
    ]), O = w.useCallback((N) => {
      var _a;
      ((_a = i.current) == null ? void 0 : _a.delete_history_entry(N)) && (h(), f());
    }, [
      h,
      f
    ]), L = w.useCallback(() => {
      var _a;
      (_a = i.current) == null ? void 0 : _a.clear_history(), f();
    }, [
      f
    ]), z = w.useCallback(() => {
      const N = i.current;
      if (!N) return;
      const E = N.export_png(), j = new Blob([
        new Uint8Array(E)
      ], {
        type: "image/png"
      }), K = URL.createObjectURL(j), W = document.createElement("a");
      W.href = K, W.download = "stamp-result.png", W.click(), URL.revokeObjectURL(K);
    }, []), V = w.useCallback((N, E = 0.92) => {
      if (N === "png") {
        z();
        return;
      }
      const j = n.current;
      if (!j) return;
      const K = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif"
      }, W = {
        jpeg: ".jpg",
        webp: ".webp",
        avif: ".avif"
      };
      j.toBlob((et) => {
        if (!et) return;
        const at = URL.createObjectURL(et), dt = document.createElement("a");
        dt.href = at, dt.download = `stamp-result${W[N]}`, dt.click(), URL.revokeObjectURL(at);
      }, K[N], E);
    }, [
      n,
      z
    ]), q = w.useCallback((N) => {
      const E = i.current;
      if (!E) return;
      const { x: j, y: K } = m(N);
      if (N.altKey) {
        E.set_source(j, K), o.current = {
          x: j,
          y: K
        }, f();
        return;
      }
      E.has_source() && (l.current = true, E.begin_stroke(j, K), h());
    }, [
      m,
      h,
      f
    ]), $ = w.useCallback((N) => {
      if (!l.current) return;
      const E = i.current;
      if (!E) return;
      const { x: j, y: K } = m(N);
      E.continue_stroke(j, K), h();
    }, [
      m,
      h
    ]), X = w.useCallback(() => {
      var _a;
      l.current && (l.current = false, (_a = i.current) == null ? void 0 : _a.end_stroke(), f());
    }, [
      f
    ]);
    w.useEffect(() => {
      const N = n.current, E = (N == null ? void 0 : N.parentElement) ?? N;
      if (!E) return;
      const j = (K) => {
        !K.altKey || !i.current || (K.preventDefault(), i.current.adjust_zoom(K.deltaY < 0 ? 1 : -1), f());
      };
      return E.addEventListener("wheel", j, {
        passive: false
      }), () => E.removeEventListener("wheel", j);
    }, [
      n,
      f
    ]), w.useEffect(() => {
      const N = (E) => {
        (E.metaKey || E.ctrlKey) && E.key === "z" && (E.shiftKey ? C() : A());
      };
      return window.addEventListener("keydown", N), () => window.removeEventListener("keydown", N);
    }, [
      A,
      C
    ]);
    const G = w.useCallback((N) => {
      const E = i.current;
      if (!E) return null;
      const j = E.thumbnail_width(N), K = E.thumbnail_height(N), W = E.thumbnail_data(N);
      return {
        data: new Uint8ClampedArray(W),
        width: j,
        height: K
      };
    }, []), tt = w.useCallback((N) => new Promise((E) => {
      const j = G(N);
      if (!j) return E(null);
      const K = new OffscreenCanvas(j.width, j.height);
      K.getContext("2d").putImageData(new ImageData(j.data, j.width, j.height), 0, 0), K.convertToBlob({
        type: "image/jpeg",
        quality: 0.82
      }).then((et) => {
        E(URL.createObjectURL(et));
      });
    }), [
      G
    ]), I = w.useCallback((N, E, j, K) => {
      const W = i.current;
      return W ? new Uint8ClampedArray(W.copy_region(N, E, j, K)) : null;
    }, []), nt = w.useCallback((N, E, j, K, W) => {
      const et = i.current;
      et && (et.paste_region(new Uint8Array(N.buffer), E, j, K, W), h(), f());
    }, [
      h,
      f
    ]), st = w.useCallback(() => {
      const N = i.current;
      N && (N.flip_horizontal(), o.current && (o.current = {
        x: N.width() - 1 - o.current.x,
        y: o.current.y
      }), h(), f());
    }, [
      h,
      f
    ]), gt = w.useCallback(() => {
      const N = i.current;
      N && (N.flip_vertical(), o.current && (o.current = {
        x: o.current.x,
        y: N.height() - 1 - o.current.y
      }), h(), f());
    }, [
      h,
      f
    ]), ht = w.useCallback(() => {
      const N = i.current;
      N && (N.rotate_90_cw(), o.current = null, h(), f());
    }, [
      h,
      f
    ]), mt = w.useCallback(() => {
      const N = i.current;
      N && (N.rotate_90_ccw(), o.current = null, h(), f());
    }, [
      h,
      f
    ]), k = w.useCallback((N, E, j, K) => {
      const W = i.current;
      !W || j < 1 || K < 1 || (W.crop(N, E, j, K), o.current = null, h(), f());
    }, [
      h,
      f
    ]), F = w.useCallback((N, E) => {
      const j = i.current;
      !j || N < 1 || E < 1 || (j.resize(N, E), o.current = null, h(), f());
    }, [
      h,
      f
    ]), Z = w.useCallback((N) => {
      const E = i.current;
      E && (E.adjust_brightness(N), h(), f());
    }, [
      h,
      f
    ]), it = w.useCallback((N) => {
      const E = i.current;
      E && (E.adjust_contrast(N), h(), f());
    }, [
      h,
      f
    ]);
    return {
      state: r,
      toolRef: i,
      loadImage: p,
      setBrushSize: g,
      setHardness: v,
      setOpacity: b,
      setSpacing: T,
      undo: A,
      redo: C,
      jumpToHistory: R,
      deleteHistoryEntry: O,
      clearHistory: L,
      exportPng: z,
      exportAs: V,
      onMouseDown: q,
      onMouseMove: $,
      onMouseUp: X,
      generateThumbnail: G,
      generateThumbnailUrl: tt,
      copyRegion: I,
      pasteRegion: nt,
      flipHorizontal: st,
      flipVertical: gt,
      rotate90Cw: ht,
      rotate90Ccw: mt,
      crop: k,
      resize: F,
      adjustBrightness: Z,
      adjustContrast: it
    };
  }
  function GD(n, i, l) {
    const [o, r] = w.useState({
      x: -999,
      y: -999
    }), [d, f] = w.useState(false), h = w.useRef(null);
    w.useEffect(() => {
      const T = (A) => {
        r({
          x: A.clientX,
          y: A.clientY
        });
      };
      return window.addEventListener("mousemove", T), () => window.removeEventListener("mousemove", T);
    }, []);
    const m = w.useCallback((T) => {
      h.current = T, f(true);
    }, []), p = w.useCallback(() => f(false), []);
    let g = n * 2;
    const v = l.current, b = h.current;
    if (v && b && v.width > 0) {
      const T = b.width / v.width;
      g = n * 2 * T;
    }
    return {
      pos: o,
      visible: d,
      diameter: g,
      onCanvasEnter: m,
      onCanvasLeave: p
    };
  }
  const is = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
  }, Qd = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
  }, YD = {
    hidden: {
      x: "-100%",
      opacity: 0
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: is
    },
    exit: {
      x: "-100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, PD = {
    hidden: {
      x: "100%",
      opacity: 0
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: is
    },
    exit: {
      x: "100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, qD = {
    hidden: {
      y: "-100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: is
    },
    exit: {
      y: "-100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, XD = {
    hidden: {
      y: "100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: is
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, Lx = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.15
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  };
  const Bx = (...n) => n.filter((i, l, o) => !!i && i.trim() !== "" && o.indexOf(i) === l).join(" ").trim();
  const KD = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const ZD = (n) => n.replace(/^([A-Z])|[\s-_]+(\w)/g, (i, l, o) => o ? o.toUpperCase() : l.toLowerCase());
  const P0 = (n) => {
    const i = ZD(n);
    return i.charAt(0).toUpperCase() + i.slice(1);
  };
  var QD = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  const FD = (n) => {
    for (const i in n) if (i.startsWith("aria-") || i === "role" || i === "title") return true;
    return false;
  };
  const JD = w.forwardRef(({ color: n = "currentColor", size: i = 24, strokeWidth: l = 2, absoluteStrokeWidth: o, className: r = "", children: d, iconNode: f, ...h }, m) => w.createElement("svg", {
    ref: m,
    ...QD,
    width: i,
    height: i,
    stroke: n,
    strokeWidth: o ? Number(l) * 24 / Number(i) : l,
    className: Bx("lucide", r),
    ...!d && !FD(h) && {
      "aria-hidden": "true"
    },
    ...h
  }, [
    ...f.map(([p, g]) => w.createElement(p, g)),
    ...Array.isArray(d) ? d : [
      d
    ]
  ]));
  const Ot = (n, i) => {
    const l = w.forwardRef(({ className: o, ...r }, d) => w.createElement(JD, {
      ref: d,
      iconNode: i,
      className: Bx(`lucide-${KD(P0(n))}`, `lucide-${n}`, o),
      ...r
    }));
    return l.displayName = P0(n), l;
  };
  const $D = [
    [
      "path",
      {
        d: "M7 7h10v10",
        key: "1tivn9"
      }
    ],
    [
      "path",
      {
        d: "M7 17 17 7",
        key: "1vkiza"
      }
    ]
  ], WD = Ot("arrow-up-right", $D);
  const ID = [
    [
      "path",
      {
        d: "m6 9 6 6 6-6",
        key: "qrunsl"
      }
    ]
  ], t3 = Ot("chevron-down", ID);
  const e3 = [
    [
      "path",
      {
        d: "m15 18-6-6 6-6",
        key: "1wnfg3"
      }
    ]
  ], n3 = Ot("chevron-left", e3);
  const i3 = [
    [
      "path",
      {
        d: "m9 18 6-6-6-6",
        key: "mthhwq"
      }
    ]
  ], a3 = Ot("chevron-right", i3);
  const s3 = [
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "10",
        key: "1mglay"
      }
    ],
    [
      "path",
      {
        d: "M12 18a6 6 0 0 0 0-12v12z",
        key: "j4l70d"
      }
    ]
  ], l3 = Ot("contrast", s3);
  const o3 = [
    [
      "path",
      {
        d: "M6 2v14a2 2 0 0 0 2 2h14",
        key: "ron5a4"
      }
    ],
    [
      "path",
      {
        d: "M18 22V8a2 2 0 0 0-2-2H2",
        key: "7s9ehn"
      }
    ]
  ], Ux = Ot("crop", o3);
  const r3 = [
    [
      "path",
      {
        d: "M12 15V3",
        key: "m9g1x1"
      }
    ],
    [
      "path",
      {
        d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
        key: "ih7n3h"
      }
    ],
    [
      "path",
      {
        d: "m7 10 5 5 5-5",
        key: "brsn70"
      }
    ]
  ], Hx = Ot("download", r3);
  const c3 = [
    [
      "path",
      {
        d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",
        key: "1ptgy4"
      }
    ],
    [
      "path",
      {
        d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
        key: "1sl1rz"
      }
    ]
  ], u3 = Ot("droplets", c3);
  const f3 = [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
        key: "usdka0"
      }
    ]
  ], d3 = Ot("folder-open", f3);
  const h3 = [
    [
      "path",
      {
        d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
        key: "1357e3"
      }
    ],
    [
      "path",
      {
        d: "M3 3v5h5",
        key: "1xhq8a"
      }
    ],
    [
      "path",
      {
        d: "M12 7v5l4 2",
        key: "1fdv2h"
      }
    ]
  ], m3 = Ot("history", h3);
  const p3 = [
    [
      "rect",
      {
        width: "18",
        height: "18",
        x: "3",
        y: "3",
        rx: "2",
        ry: "2",
        key: "1m3agn"
      }
    ],
    [
      "circle",
      {
        cx: "9",
        cy: "9",
        r: "2",
        key: "af1f0g"
      }
    ],
    [
      "path",
      {
        d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
        key: "1xmnt7"
      }
    ]
  ], Gx = Ot("image", p3);
  const g3 = [
    [
      "path",
      {
        d: "M10 8h.01",
        key: "1r9ogq"
      }
    ],
    [
      "path",
      {
        d: "M12 12h.01",
        key: "1mp3jc"
      }
    ],
    [
      "path",
      {
        d: "M14 8h.01",
        key: "1primd"
      }
    ],
    [
      "path",
      {
        d: "M16 12h.01",
        key: "1l6xoz"
      }
    ],
    [
      "path",
      {
        d: "M18 8h.01",
        key: "emo2bl"
      }
    ],
    [
      "path",
      {
        d: "M6 8h.01",
        key: "x9i8wu"
      }
    ],
    [
      "path",
      {
        d: "M7 16h10",
        key: "wp8him"
      }
    ],
    [
      "path",
      {
        d: "M8 12h.01",
        key: "czm47f"
      }
    ],
    [
      "rect",
      {
        width: "20",
        height: "16",
        x: "2",
        y: "4",
        rx: "2",
        key: "18n3k1"
      }
    ]
  ], y3 = Ot("keyboard", g3);
  const v3 = [
    [
      "path",
      {
        d: "m14.622 17.897-10.68-2.913",
        key: "vj2p1u"
      }
    ],
    [
      "path",
      {
        d: "M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z",
        key: "18tc5c"
      }
    ],
    [
      "path",
      {
        d: "M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15",
        key: "ytzfxy"
      }
    ]
  ], b3 = Ot("paintbrush", v3);
  const x3 = [
    [
      "path",
      {
        d: "M21 7v6h-6",
        key: "3ptur4"
      }
    ],
    [
      "path",
      {
        d: "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7",
        key: "1kgawr"
      }
    ]
  ], S3 = Ot("redo", x3);
  const T3 = [
    [
      "path",
      {
        d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
        key: "1357e3"
      }
    ],
    [
      "path",
      {
        d: "M3 3v5h5",
        key: "1xhq8a"
      }
    ]
  ], w3 = Ot("rotate-ccw", T3);
  const A3 = [
    [
      "path",
      {
        d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",
        key: "1p45f6"
      }
    ],
    [
      "path",
      {
        d: "M21 3v5h-5",
        key: "1q7to0"
      }
    ]
  ], E3 = Ot("rotate-cw", A3);
  const C3 = [
    [
      "path",
      {
        d: "M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z",
        key: "1bo67w"
      }
    ],
    [
      "rect",
      {
        x: "3",
        y: "14",
        width: "7",
        height: "7",
        rx: "1",
        key: "1bkyp8"
      }
    ],
    [
      "circle",
      {
        cx: "17.5",
        cy: "17.5",
        r: "3.5",
        key: "w3z12y"
      }
    ]
  ], M3 = Ot("shapes", C3);
  const R3 = [
    [
      "path",
      {
        d: "m15 15 6 6m-6-6v4.8m0-4.8h4.8",
        key: "17vawe"
      }
    ],
    [
      "path",
      {
        d: "M9 19.8V15m0 0H4.2M9 15l-6 6",
        key: "chjx8e"
      }
    ],
    [
      "path",
      {
        d: "M15 4.2V9m0 0h4.8M15 9l6-6",
        key: "lav6yq"
      }
    ],
    [
      "path",
      {
        d: "M9 4.2V9m0 0H4.2M9 9 3 3",
        key: "1pxi2q"
      }
    ]
  ], D3 = Ot("shrink", R3);
  const O3 = [
    [
      "path",
      {
        d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
        key: "1s2grr"
      }
    ],
    [
      "path",
      {
        d: "M20 2v4",
        key: "1rf3ol"
      }
    ],
    [
      "path",
      {
        d: "M22 4h-4",
        key: "gwowj6"
      }
    ],
    [
      "circle",
      {
        cx: "4",
        cy: "20",
        r: "2",
        key: "6kqj1y"
      }
    ]
  ], j3 = Ot("sparkles", O3);
  const N3 = [
    [
      "path",
      {
        d: "M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3",
        key: "1i73f7"
      }
    ],
    [
      "path",
      {
        d: "M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3",
        key: "saxlbk"
      }
    ],
    [
      "path",
      {
        d: "M12 20v2",
        key: "1lh1kg"
      }
    ],
    [
      "path",
      {
        d: "M12 14v2",
        key: "8jcxud"
      }
    ],
    [
      "path",
      {
        d: "M12 8v2",
        key: "1woqiv"
      }
    ],
    [
      "path",
      {
        d: "M12 2v2",
        key: "tus03m"
      }
    ]
  ], z3 = Ot("square-centerline-dashed-horizontal", N3);
  const _3 = [
    [
      "path",
      {
        d: "M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3",
        key: "14bfxa"
      }
    ],
    [
      "path",
      {
        d: "M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3",
        key: "14rx03"
      }
    ],
    [
      "path",
      {
        d: "M4 12H2",
        key: "rhcxmi"
      }
    ],
    [
      "path",
      {
        d: "M10 12H8",
        key: "s88cx1"
      }
    ],
    [
      "path",
      {
        d: "M16 12h-2",
        key: "10asgb"
      }
    ],
    [
      "path",
      {
        d: "M22 12h-2",
        key: "14jgyd"
      }
    ]
  ], V3 = Ot("square-centerline-dashed-vertical", _3);
  const k3 = [
    [
      "path",
      {
        d: "M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13",
        key: "i9gjdv"
      }
    ],
    [
      "path",
      {
        d: "M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z",
        key: "1vzg3v"
      }
    ],
    [
      "path",
      {
        d: "M5 22h14",
        key: "ehvnwv"
      }
    ]
  ], L3 = Ot("stamp", k3);
  const B3 = [
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "4",
        key: "4exip2"
      }
    ],
    [
      "path",
      {
        d: "M12 2v2",
        key: "tus03m"
      }
    ],
    [
      "path",
      {
        d: "M12 20v2",
        key: "1lh1kg"
      }
    ],
    [
      "path",
      {
        d: "m4.93 4.93 1.41 1.41",
        key: "149t6j"
      }
    ],
    [
      "path",
      {
        d: "m17.66 17.66 1.41 1.41",
        key: "ptbguv"
      }
    ],
    [
      "path",
      {
        d: "M2 12h2",
        key: "1t8f8n"
      }
    ],
    [
      "path",
      {
        d: "M20 12h2",
        key: "1q8mjw"
      }
    ],
    [
      "path",
      {
        d: "m6.34 17.66-1.41 1.41",
        key: "1m8zz5"
      }
    ],
    [
      "path",
      {
        d: "m19.07 4.93-1.41 1.41",
        key: "1shlcs"
      }
    ]
  ], U3 = Ot("sun", B3);
  const H3 = [
    [
      "path",
      {
        d: "M10 11v6",
        key: "nco0om"
      }
    ],
    [
      "path",
      {
        d: "M14 11v6",
        key: "outv1u"
      }
    ],
    [
      "path",
      {
        d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
        key: "miytrc"
      }
    ],
    [
      "path",
      {
        d: "M3 6h18",
        key: "d0wm0j"
      }
    ],
    [
      "path",
      {
        d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
        key: "e791ji"
      }
    ]
  ], G3 = Ot("trash-2", H3);
  const Y3 = [
    [
      "path",
      {
        d: "M12 4v16",
        key: "1654pz"
      }
    ],
    [
      "path",
      {
        d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2",
        key: "e0r10z"
      }
    ],
    [
      "path",
      {
        d: "M9 20h6",
        key: "s66wpe"
      }
    ]
  ], P3 = Ot("type", Y3);
  const q3 = [
    [
      "path",
      {
        d: "M3 7v6h6",
        key: "1v2h90"
      }
    ],
    [
      "path",
      {
        d: "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",
        key: "1r6uu6"
      }
    ]
  ], X3 = Ot("undo", q3);
  const K3 = [
    [
      "path",
      {
        d: "M12 3v12",
        key: "1x0j5s"
      }
    ],
    [
      "path",
      {
        d: "m17 8-5-5-5 5",
        key: "7q97r8"
      }
    ],
    [
      "path",
      {
        d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
        key: "ih7n3h"
      }
    ]
  ], Wf = Ot("upload", K3);
  const Z3 = [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
        key: "1ngwbx"
      }
    ]
  ], Yx = Ot("wrench", Z3);
  const Q3 = [
    [
      "path",
      {
        d: "M18 6 6 18",
        key: "1bl5f8"
      }
    ],
    [
      "path",
      {
        d: "m6 6 12 12",
        key: "d8bk6v"
      }
    ]
  ], Cr = Ot("x", Q3);
  const F3 = [
    [
      "circle",
      {
        cx: "11",
        cy: "11",
        r: "8",
        key: "4ej97u"
      }
    ],
    [
      "line",
      {
        x1: "21",
        x2: "16.65",
        y1: "21",
        y2: "16.65",
        key: "13gj7c"
      }
    ],
    [
      "line",
      {
        x1: "11",
        x2: "11",
        y1: "8",
        y2: "14",
        key: "1vmskp"
      }
    ],
    [
      "line",
      {
        x1: "8",
        x2: "14",
        y1: "11",
        y2: "11",
        key: "durymu"
      }
    ]
  ], J3 = Ot("zoom-in", F3);
  const $3 = [
    [
      "circle",
      {
        cx: "11",
        cy: "11",
        r: "8",
        key: "4ej97u"
      }
    ],
    [
      "line",
      {
        x1: "21",
        x2: "16.65",
        y1: "21",
        y2: "16.65",
        key: "13gj7c"
      }
    ],
    [
      "line",
      {
        x1: "8",
        x2: "14",
        y1: "11",
        y2: "11",
        key: "durymu"
      }
    ]
  ], W3 = Ot("zoom-out", $3), vf = {
    png: "PNG",
    jpeg: "JPEG",
    webp: "WebP",
    avif: "AVIF"
  };
  function I3({ zoom: n, onZoomIn: i, onZoomOut: l, showUpload: o, showTools: r, showGallery: d, showHistory: f, showKbdHints: h, onToggleUpload: m, onToggleTools: p, onToggleGallery: g, onToggleHistory: v, imageCount: b, exportFormat: T, onExportFormatChange: A, onExport: C, hasSelectedImage: R, onDeleteAll: O }) {
    const [L, z] = w.useState(false), V = w.useRef(null);
    w.useEffect(() => {
      if (!L) return;
      const $ = (X) => {
        V.current && !V.current.contains(X.target) && z(false);
      };
      return document.addEventListener("mousedown", $), () => document.removeEventListener("mousedown", $);
    }, [
      L
    ]);
    const q = [
      {
        key: "U",
        icon: Wf,
        label: "Upload",
        state: o,
        toggle: m,
        shortcut: "Alt U"
      },
      {
        key: "S",
        icon: Yx,
        label: "Tools",
        state: r,
        toggle: p,
        shortcut: "Alt S"
      },
      {
        key: "I",
        icon: Gx,
        label: "Gallery",
        state: d,
        toggle: g,
        shortcut: "Alt G"
      },
      {
        key: "H",
        icon: m3,
        label: "History",
        state: f,
        toggle: v,
        shortcut: "Alt H"
      }
    ];
    return S.jsx(rn.div, {
      variants: qD,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: "fixed top-3 left-0 right-0 z-30 pointer-events-none",
      children: S.jsx(rn.div, {
        animate: {
          paddingLeft: r ? 320 : 12,
          paddingRight: f ? 244 : 12
        },
        transition: Qd,
        children: S.jsx("div", {
          className: "pointer-events-auto",
          children: S.jsxs("div", {
            className: "flex items-center gap-3 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm rounded-xl border border-border",
            children: [
              S.jsxs("div", {
                className: "flex items-center gap-1.5 shrink-0",
                children: [
                  S.jsx("button", {
                    onClick: l,
                    disabled: n <= 0.25,
                    className: "p-1.5 rounded-md hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-text-secondary",
                    children: S.jsx(W3, {
                      className: "h-4 w-4"
                    })
                  }),
                  S.jsxs("div", {
                    className: "flex flex-col items-center leading-none",
                    children: [
                      S.jsxs("span", {
                        className: "text-sm font-semibold font-mono w-12 text-center tabular-nums text-text-primary",
                        children: [
                          Math.round(n * 100),
                          "%"
                        ]
                      }),
                      h && S.jsx("kbd", {
                        className: "text-[9px] mt-0.5 px-1",
                        children: "Alt Scroll"
                      })
                    ]
                  }),
                  S.jsx("button", {
                    onClick: i,
                    disabled: n >= 4,
                    className: "p-1.5 rounded-md hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-text-secondary",
                    children: S.jsx(J3, {
                      className: "h-4 w-4"
                    })
                  })
                ]
              }),
              S.jsx("div", {
                className: "w-px h-6 bg-border shrink-0"
              }),
              S.jsx("div", {
                className: "flex-1 flex justify-center",
                children: S.jsx("div", {
                  className: "flex gap-1 p-1 rounded-lg bg-bg-tertiary",
                  children: q.map(({ key: $, icon: X, label: G, state: tt, toggle: I, shortcut: nt }) => S.jsxs("button", {
                    onClick: I,
                    className: `flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${tt ? "bg-accent text-text-primary shadow-md" : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"}`,
                    children: [
                      S.jsx(X, {
                        className: "h-3.5 w-3.5"
                      }),
                      S.jsx("span", {
                        className: "hidden sm:inline",
                        children: G
                      }),
                      h && S.jsx("kbd", {
                        className: "hidden sm:inline text-[9px] px-1 ml-0.5 opacity-70",
                        children: nt
                      })
                    ]
                  }, $))
                })
              }),
              S.jsx("div", {
                className: "w-px h-6 bg-border shrink-0"
              }),
              S.jsxs("div", {
                className: "flex items-center gap-2 shrink-0",
                children: [
                  S.jsxs("div", {
                    className: "flex gap-1 p-1 rounded-lg bg-bg-tertiary",
                    ref: V,
                    children: [
                      S.jsxs("div", {
                        className: "relative",
                        children: [
                          S.jsxs("button", {
                            onClick: () => z(($) => !$),
                            className: "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold font-mono text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all",
                            children: [
                              vf[T],
                              S.jsx(t3, {
                                className: "h-3 w-3 opacity-50"
                              })
                            ]
                          }),
                          L && S.jsx("div", {
                            className: "absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[80px]",
                            children: Object.keys(vf).map(($) => S.jsx("button", {
                              onClick: () => {
                                A($), z(false);
                              },
                              className: `w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${$ === T ? "bg-accent text-text-primary" : "text-text-secondary hover:bg-bg-elevated"}`,
                              children: vf[$]
                            }, $))
                          })
                        ]
                      }),
                      S.jsxs("button", {
                        onClick: C,
                        disabled: !R,
                        className: "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono bg-accent text-text-primary shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                        children: [
                          S.jsx(Hx, {
                            className: "h-3.5 w-3.5"
                          }),
                          S.jsx("span", {
                            className: "hidden sm:inline",
                            children: "Export"
                          })
                        ]
                      })
                    ]
                  }),
                  S.jsxs("button", {
                    onClick: O,
                    disabled: b === 0,
                    className: "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono text-text-muted hover:text-red-400 hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                    title: "Delete all images",
                    children: [
                      S.jsx(G3, {
                        className: "h-3.5 w-3.5"
                      }),
                      S.jsx("span", {
                        className: "hidden sm:inline",
                        children: "Delete All"
                      })
                    ]
                  })
                ]
              })
            ]
          })
        })
      })
    });
  }
  function tO({ state: n, imageCount: i, showKbdHints: l }) {
    return S.jsxs("footer", {
      className: "status-bar",
      children: [
        S.jsx("div", {
          className: "status-section",
          children: S.jsxs("span", {
            className: `source-status ${n.hasSource ? "has-source" : ""}`,
            children: [
              S.jsx("span", {
                className: "status-dot"
              }),
              n.hasSource ? "Source set \u2014 click to paint" : "Alt+Click to set source"
            ]
          })
        }),
        S.jsxs("div", {
          className: "status-section status-center",
          children: [
            S.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                S.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                S.jsx("kbd", {
                  children: "Click"
                }),
                " source"
              ]
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                S.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                S.jsx("kbd", {
                  children: "Scroll"
                }),
                " zoom"
              ]
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                S.jsx("kbd", {
                  children: "Ctrl"
                }),
                "+",
                S.jsx("kbd", {
                  children: "Z"
                }),
                " undo"
              ]
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                S.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                S.jsx("kbd", {
                  children: "["
                }),
                S.jsx("kbd", {
                  children: "]"
                }),
                " brush"
              ]
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                S.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                S.jsx("kbd", {
                  children: "/"
                }),
                " shortcuts"
              ]
            })
          ]
        }),
        S.jsxs("div", {
          className: "status-section status-right",
          children: [
            S.jsxs("span", {
              className: "status-zoom-label",
              children: [
                i,
                " img",
                i !== 1 ? "s" : ""
              ]
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsx("span", {
              className: "status-zoom",
              children: n.width && n.height ? `${n.width}\xD7${n.height}` : "\u2014"
            }),
            S.jsx("span", {
              className: "status-divider"
            }),
            S.jsxs("span", {
              className: "status-zoom",
              children: [
                Math.round(n.zoom * 100),
                "%"
              ]
            })
          ]
        })
      ]
    });
  }
  const eO = [
    {
      title: "Panels",
      shortcuts: [
        {
          keys: [
            "Alt",
            "U"
          ],
          action: "Toggle Upload"
        },
        {
          keys: [
            "Alt",
            "S"
          ],
          action: "Toggle Tools"
        },
        {
          keys: [
            "Alt",
            "G"
          ],
          action: "Toggle Gallery"
        },
        {
          keys: [
            "Alt",
            "H"
          ],
          action: "Toggle History"
        },
        {
          keys: [
            "Alt",
            "/"
          ],
          action: "Toggle Shortcuts"
        }
      ]
    },
    {
      title: "Edit",
      shortcuts: [
        {
          keys: [
            "Ctrl",
            "Z"
          ],
          action: "Undo"
        },
        {
          keys: [
            "Ctrl",
            "Shift",
            "Z"
          ],
          action: "Redo"
        },
        {
          keys: [
            "Alt",
            "D"
          ],
          action: "Delete All Images"
        }
      ]
    },
    {
      title: "Clone Stamp",
      shortcuts: [
        {
          keys: [
            "Alt",
            "Click"
          ],
          action: "Set Source Point"
        },
        {
          keys: [
            "Alt",
            "["
          ],
          action: "Decrease Brush Size"
        },
        {
          keys: [
            "Alt",
            "]"
          ],
          action: "Increase Brush Size"
        }
      ]
    },
    {
      title: "View",
      shortcuts: [
        {
          keys: [
            "Alt",
            "Scroll"
          ],
          action: "Zoom In / Out"
        }
      ]
    },
    {
      title: "Export",
      shortcuts: [
        {
          keys: [
            "Alt",
            "E"
          ],
          action: "Export Image"
        }
      ]
    }
  ];
  function nO({ open: n, onClose: i }) {
    return S.jsx(Xa, {
      children: n && S.jsx(rn.div, {
        variants: Lx,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm",
        onClick: i,
        children: S.jsxs(rn.div, {
          initial: {
            scale: 0.95,
            opacity: 0
          },
          animate: {
            scale: 1,
            opacity: 1
          },
          exit: {
            scale: 0.95,
            opacity: 0
          },
          transition: is,
          className: "shortcut-modal",
          onClick: (l) => l.stopPropagation(),
          children: [
            S.jsxs("div", {
              className: "shortcut-modal-header",
              children: [
                S.jsxs("div", {
                  className: "shortcut-modal-title",
                  children: [
                    S.jsx(y3, {
                      className: "shortcut-modal-icon"
                    }),
                    S.jsx("span", {
                      children: "Keyboard Shortcuts"
                    })
                  ]
                }),
                S.jsx("button", {
                  onClick: i,
                  className: "shortcut-modal-close",
                  children: S.jsx(Cr, {
                    className: "shortcut-modal-close-icon"
                  })
                })
              ]
            }),
            S.jsx("div", {
              className: "shortcut-modal-body",
              children: eO.map((l) => S.jsxs("div", {
                className: "shortcut-group",
                children: [
                  S.jsx("h3", {
                    className: "shortcut-group-title",
                    children: l.title
                  }),
                  S.jsx("div", {
                    className: "shortcut-list",
                    children: l.shortcuts.map((o) => S.jsxs("div", {
                      className: "shortcut-row",
                      children: [
                        S.jsx("span", {
                          className: "shortcut-action",
                          children: o.action
                        }),
                        S.jsx("span", {
                          className: "shortcut-keys",
                          children: o.keys.map((r, d) => S.jsxs("span", {
                            children: [
                              d > 0 && S.jsx("span", {
                                className: "shortcut-plus",
                                children: "+"
                              }),
                              S.jsx("kbd", {
                                className: "shortcut-kbd",
                                children: r
                              })
                            ]
                          }, d))
                        })
                      ]
                    }, o.action))
                  })
                ]
              }, l.title))
            }),
            S.jsx("div", {
              className: "shortcut-modal-footer",
              children: S.jsxs("span", {
                children: [
                  "Press ",
                  S.jsx("kbd", {
                    className: "shortcut-kbd",
                    children: "Alt"
                  }),
                  S.jsx("span", {
                    className: "shortcut-plus",
                    children: "+"
                  }),
                  S.jsx("kbd", {
                    className: "shortcut-kbd",
                    children: "/"
                  }),
                  " to close"
                ]
              })
            })
          ]
        })
      })
    });
  }
  const iO = [
    {
      id: "compress",
      label: "Resize",
      description: "Resize & optimize images",
      icon: D3,
      gradient: "from-orange-500 to-red-500"
    },
    {
      id: "crop",
      label: "Crop",
      description: "Crop & trim images",
      icon: Ux,
      gradient: "from-cyan-500 to-blue-500"
    },
    {
      id: "brush",
      label: "Paint",
      description: "Freehand drawing",
      icon: b3,
      gradient: "from-blue-500 to-indigo-500"
    },
    {
      id: "text",
      label: "Text",
      description: "Add text annotations",
      icon: P3,
      gradient: "from-amber-400 to-orange-500"
    },
    {
      id: "arrow",
      label: "Arrows",
      description: "Point & highlight areas",
      icon: WD,
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      id: "ai",
      label: "AI",
      description: "AI-powered tools",
      icon: j3,
      gradient: "from-violet-500 to-purple-600"
    },
    {
      id: "shapes",
      label: "Shapes",
      description: "Add geometric shapes",
      icon: M3,
      gradient: "from-pink-500 to-rose-500"
    },
    {
      id: "blur",
      label: "Blur",
      description: "Blur sensitive areas",
      icon: u3,
      gradient: "from-slate-400 to-slate-600"
    },
    {
      id: "stamp",
      label: "Clone Stamp",
      description: "WASM-powered clone stamp",
      icon: L3,
      gradient: "from-rose-500 to-red-600"
    }
  ];
  function aO({ tool: n, active: i, onClick: l }) {
    const o = n.icon;
    return S.jsx("button", {
      onClick: l,
      className: `relative p-0.5 rounded-xl transition-all duration-200 ${i ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary shadow-xl" : "hover:ring-2 hover:ring-accent/50 hover:ring-offset-2 hover:ring-offset-bg-secondary"}`,
      children: S.jsx("span", {
        className: `flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${n.gradient} shadow-lg transition-all duration-200 ${i ? "scale-110 shadow-2xl" : "hover:scale-105 hover:shadow-xl"}`,
        children: S.jsx(o, {
          className: "h-5 w-5 text-white drop-shadow-sm"
        })
      })
    });
  }
  function sO({ activeTool: n, onToolChange: i }) {
    return S.jsx("div", {
      className: "grid grid-cols-3 gap-3",
      children: iO.map((l) => S.jsxs(UA, {
        children: [
          S.jsx(HA, {
            asChild: true,
            children: S.jsx("div", {
              children: S.jsx(aO, {
                tool: l,
                active: l.id === n,
                onClick: () => i(l.id)
              })
            })
          }),
          S.jsxs($v, {
            side: "bottom",
            sideOffset: 8,
            children: [
              S.jsx("p", {
                className: "font-medium",
                children: l.label
              }),
              S.jsx("p", {
                className: "text-muted-foreground text-xs",
                children: l.description
              })
            ]
          })
        ]
      }, l.id))
    });
  }
  function Px(n, [i, l]) {
    return Math.min(l, Math.max(i, n));
  }
  var lO = w.createContext(void 0);
  function oO(n) {
    const i = w.useContext(lO);
    return n || i || "ltr";
  }
  function rO(n) {
    const i = w.useRef({
      value: n,
      previous: n
    });
    return w.useMemo(() => (i.current.value !== n && (i.current.previous = i.current.value, i.current.value = n), i.current.previous), [
      n
    ]);
  }
  function cO(n) {
    const i = n + "CollectionProvider", [l, o] = hr(i), [r, d] = l(i, {
      collectionRef: {
        current: null
      },
      itemMap: /* @__PURE__ */ new Map()
    }), f = (C) => {
      const { scope: R, children: O } = C, L = gn.useRef(null), z = gn.useRef(/* @__PURE__ */ new Map()).current;
      return S.jsx(r, {
        scope: R,
        itemMap: z,
        collectionRef: L,
        children: O
      });
    };
    f.displayName = i;
    const h = n + "CollectionSlot", m = xf(h), p = gn.forwardRef((C, R) => {
      const { scope: O, children: L } = C, z = d(h, O), V = ge(R, z.collectionRef);
      return S.jsx(m, {
        ref: V,
        children: L
      });
    });
    p.displayName = h;
    const g = n + "CollectionItemSlot", v = "data-radix-collection-item", b = xf(g), T = gn.forwardRef((C, R) => {
      const { scope: O, children: L, ...z } = C, V = gn.useRef(null), q = ge(R, V), $ = d(g, O);
      return gn.useEffect(() => ($.itemMap.set(V, {
        ref: V,
        ...z
      }), () => void $.itemMap.delete(V))), S.jsx(b, {
        [v]: "",
        ref: q,
        children: L
      });
    });
    T.displayName = g;
    function A(C) {
      const R = d(n + "CollectionConsumer", C);
      return gn.useCallback(() => {
        const L = R.collectionRef.current;
        if (!L) return [];
        const z = Array.from(L.querySelectorAll(`[${v}]`));
        return Array.from(R.itemMap.values()).sort(($, X) => z.indexOf($.ref.current) - z.indexOf(X.ref.current));
      }, [
        R.collectionRef,
        R.itemMap
      ]);
    }
    return [
      {
        Provider: f,
        Slot: p,
        ItemSlot: T
      },
      A,
      o
    ];
  }
  var qx = [
    "PageUp",
    "PageDown"
  ], Xx = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight"
  ], Kx = {
    "from-left": [
      "Home",
      "PageDown",
      "ArrowDown",
      "ArrowLeft"
    ],
    "from-right": [
      "Home",
      "PageDown",
      "ArrowDown",
      "ArrowRight"
    ],
    "from-bottom": [
      "Home",
      "PageDown",
      "ArrowDown",
      "ArrowLeft"
    ],
    "from-top": [
      "Home",
      "PageDown",
      "ArrowUp",
      "ArrowLeft"
    ]
  }, as = "Slider", [If, uO, fO] = cO(as), [Zx] = hr(as, [
    fO
  ]), [dO, Mr] = Zx(as), Qx = w.forwardRef((n, i) => {
    const { name: l, min: o = 0, max: r = 100, step: d = 1, orientation: f = "horizontal", disabled: h = false, minStepsBetweenThumbs: m = 0, defaultValue: p = [
      o
    ], value: g, onValueChange: v = () => {
    }, onValueCommit: b = () => {
    }, inverted: T = false, form: A, ...C } = n, R = w.useRef(/* @__PURE__ */ new Set()), O = w.useRef(0), z = f === "horizontal" ? hO : mO, [V = [], q] = Ev({
      prop: g,
      defaultProp: p,
      onChange: (nt) => {
        var _a;
        (_a = [
          ...R.current
        ][O.current]) == null ? void 0 : _a.focus(), v(nt);
      }
    }), $ = w.useRef(V);
    function X(nt) {
      const st = bO(V, nt);
      I(nt, st);
    }
    function G(nt) {
      I(nt, O.current);
    }
    function tt() {
      const nt = $.current[O.current];
      V[O.current] !== nt && b(V);
    }
    function I(nt, st, { commit: gt } = {
      commit: false
    }) {
      const ht = wO(d), mt = AO(Math.round((nt - o) / d) * d + o, ht), k = Px(mt, [
        o,
        r
      ]);
      q((F = []) => {
        const Z = yO(F, k, st);
        if (TO(Z, m * d)) {
          O.current = Z.indexOf(k);
          const it = String(Z) !== String(F);
          return it && gt && b(Z), it ? Z : F;
        } else return F;
      });
    }
    return S.jsx(dO, {
      scope: n.__scopeSlider,
      name: l,
      disabled: h,
      min: o,
      max: r,
      valueIndexToChangeRef: O,
      thumbs: R.current,
      values: V,
      orientation: f,
      form: A,
      children: S.jsx(If.Provider, {
        scope: n.__scopeSlider,
        children: S.jsx(If.Slot, {
          scope: n.__scopeSlider,
          children: S.jsx(z, {
            "aria-disabled": h,
            "data-disabled": h ? "" : void 0,
            ...C,
            ref: i,
            onPointerDown: he(C.onPointerDown, () => {
              h || ($.current = V);
            }),
            min: o,
            max: r,
            inverted: T,
            onSlideStart: h ? void 0 : X,
            onSlideMove: h ? void 0 : G,
            onSlideEnd: h ? void 0 : tt,
            onHomeKeyDown: () => !h && I(o, 0, {
              commit: true
            }),
            onEndKeyDown: () => !h && I(r, V.length - 1, {
              commit: true
            }),
            onStepKeyDown: ({ event: nt, direction: st }) => {
              if (!h) {
                const mt = qx.includes(nt.key) || nt.shiftKey && Xx.includes(nt.key) ? 10 : 1, k = O.current, F = V[k], Z = d * mt * st;
                I(F + Z, k, {
                  commit: true
                });
              }
            }
          })
        })
      })
    });
  });
  Qx.displayName = as;
  var [Fx, Jx] = Zx(as, {
    startEdge: "left",
    endEdge: "right",
    size: "width",
    direction: 1
  }), hO = w.forwardRef((n, i) => {
    const { min: l, max: o, dir: r, inverted: d, onSlideStart: f, onSlideMove: h, onSlideEnd: m, onStepKeyDown: p, ...g } = n, [v, b] = w.useState(null), T = ge(i, (z) => b(z)), A = w.useRef(void 0), C = oO(r), R = C === "ltr", O = R && !d || !R && d;
    function L(z) {
      const V = A.current || v.getBoundingClientRect(), q = [
        0,
        V.width
      ], X = Fd(q, O ? [
        l,
        o
      ] : [
        o,
        l
      ]);
      return A.current = V, X(z - V.left);
    }
    return S.jsx(Fx, {
      scope: n.__scopeSlider,
      startEdge: O ? "left" : "right",
      endEdge: O ? "right" : "left",
      direction: O ? 1 : -1,
      size: "width",
      children: S.jsx($x, {
        dir: C,
        "data-orientation": "horizontal",
        ...g,
        ref: T,
        style: {
          ...g.style,
          "--radix-slider-thumb-transform": "translateX(-50%)"
        },
        onSlideStart: (z) => {
          const V = L(z.clientX);
          f == null ? void 0 : f(V);
        },
        onSlideMove: (z) => {
          const V = L(z.clientX);
          h == null ? void 0 : h(V);
        },
        onSlideEnd: () => {
          A.current = void 0, m == null ? void 0 : m();
        },
        onStepKeyDown: (z) => {
          const q = Kx[O ? "from-left" : "from-right"].includes(z.key);
          p == null ? void 0 : p({
            event: z,
            direction: q ? -1 : 1
          });
        }
      })
    });
  }), mO = w.forwardRef((n, i) => {
    const { min: l, max: o, inverted: r, onSlideStart: d, onSlideMove: f, onSlideEnd: h, onStepKeyDown: m, ...p } = n, g = w.useRef(null), v = ge(i, g), b = w.useRef(void 0), T = !r;
    function A(C) {
      const R = b.current || g.current.getBoundingClientRect(), O = [
        0,
        R.height
      ], z = Fd(O, T ? [
        o,
        l
      ] : [
        l,
        o
      ]);
      return b.current = R, z(C - R.top);
    }
    return S.jsx(Fx, {
      scope: n.__scopeSlider,
      startEdge: T ? "bottom" : "top",
      endEdge: T ? "top" : "bottom",
      size: "height",
      direction: T ? 1 : -1,
      children: S.jsx($x, {
        "data-orientation": "vertical",
        ...p,
        ref: v,
        style: {
          ...p.style,
          "--radix-slider-thumb-transform": "translateY(50%)"
        },
        onSlideStart: (C) => {
          const R = A(C.clientY);
          d == null ? void 0 : d(R);
        },
        onSlideMove: (C) => {
          const R = A(C.clientY);
          f == null ? void 0 : f(R);
        },
        onSlideEnd: () => {
          b.current = void 0, h == null ? void 0 : h();
        },
        onStepKeyDown: (C) => {
          const O = Kx[T ? "from-bottom" : "from-top"].includes(C.key);
          m == null ? void 0 : m({
            event: C,
            direction: O ? -1 : 1
          });
        }
      })
    });
  }), $x = w.forwardRef((n, i) => {
    const { __scopeSlider: l, onSlideStart: o, onSlideMove: r, onSlideEnd: d, onHomeKeyDown: f, onEndKeyDown: h, onStepKeyDown: m, ...p } = n, g = Mr(as, l);
    return S.jsx(Je.span, {
      ...p,
      ref: i,
      onKeyDown: he(n.onKeyDown, (v) => {
        v.key === "Home" ? (f(v), v.preventDefault()) : v.key === "End" ? (h(v), v.preventDefault()) : qx.concat(Xx).includes(v.key) && (m(v), v.preventDefault());
      }),
      onPointerDown: he(n.onPointerDown, (v) => {
        const b = v.target;
        b.setPointerCapture(v.pointerId), v.preventDefault(), g.thumbs.has(b) ? b.focus() : o(v);
      }),
      onPointerMove: he(n.onPointerMove, (v) => {
        v.target.hasPointerCapture(v.pointerId) && r(v);
      }),
      onPointerUp: he(n.onPointerUp, (v) => {
        const b = v.target;
        b.hasPointerCapture(v.pointerId) && (b.releasePointerCapture(v.pointerId), d(v));
      })
    });
  }), Wx = "SliderTrack", Ix = w.forwardRef((n, i) => {
    const { __scopeSlider: l, ...o } = n, r = Mr(Wx, l);
    return S.jsx(Je.span, {
      "data-disabled": r.disabled ? "" : void 0,
      "data-orientation": r.orientation,
      ...o,
      ref: i
    });
  });
  Ix.displayName = Wx;
  var td = "SliderRange", t1 = w.forwardRef((n, i) => {
    const { __scopeSlider: l, ...o } = n, r = Mr(td, l), d = Jx(td, l), f = w.useRef(null), h = ge(i, f), m = r.values.length, p = r.values.map((b) => i1(b, r.min, r.max)), g = m > 1 ? Math.min(...p) : 0, v = 100 - Math.max(...p);
    return S.jsx(Je.span, {
      "data-orientation": r.orientation,
      "data-disabled": r.disabled ? "" : void 0,
      ...o,
      ref: h,
      style: {
        ...n.style,
        [d.startEdge]: g + "%",
        [d.endEdge]: v + "%"
      }
    });
  });
  t1.displayName = td;
  var ed = "SliderThumb", e1 = w.forwardRef((n, i) => {
    const l = uO(n.__scopeSlider), [o, r] = w.useState(null), d = ge(i, (h) => r(h)), f = w.useMemo(() => o ? l().findIndex((h) => h.ref.current === o) : -1, [
      l,
      o
    ]);
    return S.jsx(pO, {
      ...n,
      ref: d,
      index: f
    });
  }), pO = w.forwardRef((n, i) => {
    const { __scopeSlider: l, index: o, name: r, ...d } = n, f = Mr(ed, l), h = Jx(ed, l), [m, p] = w.useState(null), g = ge(i, (L) => p(L)), v = m ? f.form || !!m.closest("form") : true, b = hv(m), T = f.values[o], A = T === void 0 ? 0 : i1(T, f.min, f.max), C = vO(o, f.values.length), R = b == null ? void 0 : b[h.size], O = R ? xO(R, A, h.direction) : 0;
    return w.useEffect(() => {
      if (m) return f.thumbs.add(m), () => {
        f.thumbs.delete(m);
      };
    }, [
      m,
      f.thumbs
    ]), S.jsxs("span", {
      style: {
        transform: "var(--radix-slider-thumb-transform)",
        position: "absolute",
        [h.startEdge]: `calc(${A}% + ${O}px)`
      },
      children: [
        S.jsx(If.ItemSlot, {
          scope: n.__scopeSlider,
          children: S.jsx(Je.span, {
            role: "slider",
            "aria-label": n["aria-label"] || C,
            "aria-valuemin": f.min,
            "aria-valuenow": T,
            "aria-valuemax": f.max,
            "aria-orientation": f.orientation,
            "data-orientation": f.orientation,
            "data-disabled": f.disabled ? "" : void 0,
            tabIndex: f.disabled ? void 0 : 0,
            ...d,
            ref: g,
            style: T === void 0 ? {
              display: "none"
            } : n.style,
            onFocus: he(n.onFocus, () => {
              f.valueIndexToChangeRef.current = o;
            })
          })
        }),
        v && S.jsx(n1, {
          name: r ?? (f.name ? f.name + (f.values.length > 1 ? "[]" : "") : void 0),
          form: f.form,
          value: T
        }, o)
      ]
    });
  });
  e1.displayName = ed;
  var gO = "RadioBubbleInput", n1 = w.forwardRef(({ __scopeSlider: n, value: i, ...l }, o) => {
    const r = w.useRef(null), d = ge(r, o), f = rO(i);
    return w.useEffect(() => {
      const h = r.current;
      if (!h) return;
      const m = window.HTMLInputElement.prototype, g = Object.getOwnPropertyDescriptor(m, "value").set;
      if (f !== i && g) {
        const v = new Event("input", {
          bubbles: true
        });
        g.call(h, i), h.dispatchEvent(v);
      }
    }, [
      f,
      i
    ]), S.jsx(Je.input, {
      style: {
        display: "none"
      },
      ...l,
      ref: d,
      defaultValue: i
    });
  });
  n1.displayName = gO;
  function yO(n = [], i, l) {
    const o = [
      ...n
    ];
    return o[l] = i, o.sort((r, d) => r - d);
  }
  function i1(n, i, l) {
    const d = 100 / (l - i) * (n - i);
    return Px(d, [
      0,
      100
    ]);
  }
  function vO(n, i) {
    return i > 2 ? `Value ${n + 1} of ${i}` : i === 2 ? [
      "Minimum",
      "Maximum"
    ][n] : void 0;
  }
  function bO(n, i) {
    if (n.length === 1) return 0;
    const l = n.map((r) => Math.abs(r - i)), o = Math.min(...l);
    return l.indexOf(o);
  }
  function xO(n, i, l) {
    const o = n / 2, d = Fd([
      0,
      50
    ], [
      0,
      o
    ]);
    return (o - d(i) * l) * l;
  }
  function SO(n) {
    return n.slice(0, -1).map((i, l) => n[l + 1] - i);
  }
  function TO(n, i) {
    if (i > 0) {
      const l = SO(n);
      return Math.min(...l) >= i;
    }
    return true;
  }
  function Fd(n, i) {
    return (l) => {
      if (n[0] === n[1] || i[0] === i[1]) return i[0];
      const o = (i[1] - i[0]) / (n[1] - n[0]);
      return i[0] + o * (l - n[0]);
    };
  }
  function wO(n) {
    return (String(n).split(".")[1] || "").length;
  }
  function AO(n, i) {
    const l = Math.pow(10, i);
    return Math.round(n * l) / l;
  }
  var a1 = Qx, EO = Ix, CO = t1, MO = e1;
  const Za = w.forwardRef(({ className: n, ...i }, l) => S.jsxs(a1, {
    ref: l,
    className: gd("relative flex w-full touch-none select-none items-center", n),
    ...i,
    children: [
      S.jsx(EO, {
        className: "relative h-1 w-full grow overflow-hidden rounded-full bg-bg-elevated",
        children: S.jsx(CO, {
          className: "absolute h-full bg-gradient-to-r from-accent to-[#8a7a6e]"
        })
      }),
      S.jsx(MO, {
        className: "block h-4 w-4 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)] ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      })
    ]
  }));
  Za.displayName = a1.displayName;
  const RO = [
    5,
    20,
    60,
    120
  ], DO = [
    0,
    33,
    66,
    100
  ], OO = [
    25,
    50,
    75,
    100
  ];
  function bf({ presets: n, value: i, onSelect: l, dot: o }) {
    return S.jsx("div", {
      className: "flex items-center justify-between",
      children: n.map((r) => {
        const d = i === r;
        return S.jsx("button", {
          type: "button",
          onClick: () => l(r),
          className: [
            "flex items-center justify-center",
            "w-10 h-10",
            "rounded-full",
            "transition-all",
            "focus:outline-none focus-visible:outline-none",
            d ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar" : "hover:bg-theme-accent"
          ].join(" "),
          "aria-label": String(r),
          children: o(r, d)
        }, r);
      })
    });
  }
  function jO({ settings: n, onChange: i, hasSource: l }) {
    return S.jsxs("div", {
      className: "space-y-5",
      children: [
        S.jsx("h3", {
          className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground",
          children: "Clone Stamp"
        }),
        S.jsxs("div", {
          className: [
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
            l ? "bg-emerald-500/10 text-emerald-400" : "bg-theme-accent text-theme-muted-foreground"
          ].join(" "),
          children: [
            S.jsx("span", {
              className: [
                "w-2 h-2 rounded-full shrink-0",
                l ? "bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-theme-muted-foreground"
              ].join(" ")
            }),
            l ? "Source set \u2014 click to paint" : "Alt+Click to set source"
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2.5",
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                S.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground",
                  children: "Size"
                }),
                S.jsxs("span", {
                  className: "text-xs text-theme-foreground tabular-nums",
                  children: [
                    n.brushSize,
                    "px"
                  ]
                })
              ]
            }),
            S.jsx(bf, {
              presets: RO,
              value: n.brushSize,
              onSelect: (o) => i({
                ...n,
                brushSize: o
              }),
              dot: (o, r) => {
                const d = o <= 5 ? 2 : o <= 20 ? 4 : o <= 60 ? 6 : 8;
                return S.jsx("span", {
                  className: "rounded-full bg-theme-foreground",
                  style: {
                    width: d,
                    height: d
                  }
                });
              }
            }),
            S.jsx(Za, {
              value: [
                n.brushSize
              ],
              onValueChange: ([o]) => i({
                ...n,
                brushSize: o
              }),
              min: 2,
              max: 200,
              step: 1
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2.5",
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                S.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground",
                  children: "Hardness"
                }),
                S.jsxs("span", {
                  className: "text-xs text-theme-foreground tabular-nums",
                  children: [
                    Math.round(n.hardness * 100),
                    "%"
                  ]
                })
              ]
            }),
            S.jsx(bf, {
              presets: DO,
              value: Math.round(n.hardness * 100),
              onSelect: (o) => i({
                ...n,
                hardness: o / 100
              }),
              dot: (o, r) => {
                const d = o === 0 ? 4 : o === 33 ? 2 : o === 66 ? 1 : 0;
                return S.jsx("span", {
                  className: "rounded-full bg-theme-foreground",
                  style: {
                    width: 8,
                    height: 8,
                    filter: d > 0 ? `blur(${d}px)` : "none"
                  }
                });
              }
            }),
            S.jsx(Za, {
              value: [
                Math.round(n.hardness * 100)
              ],
              onValueChange: ([o]) => i({
                ...n,
                hardness: o / 100
              }),
              min: 0,
              max: 100,
              step: 1
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2.5",
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                S.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground",
                  children: "Opacity"
                }),
                S.jsxs("span", {
                  className: "text-xs text-theme-foreground tabular-nums",
                  children: [
                    Math.round(n.opacity * 100),
                    "%"
                  ]
                })
              ]
            }),
            S.jsx(bf, {
              presets: OO,
              value: Math.round(n.opacity * 100),
              onSelect: (o) => i({
                ...n,
                opacity: o / 100
              }),
              dot: (o, r) => S.jsx("span", {
                className: "rounded-full bg-theme-foreground",
                style: {
                  width: 8,
                  height: 8,
                  opacity: o / 100
                }
              })
            }),
            S.jsx(Za, {
              value: [
                Math.round(n.opacity * 100)
              ],
              onValueChange: ([o]) => i({
                ...n,
                opacity: o / 100
              }),
              min: 0,
              max: 100,
              step: 1
            })
          ]
        })
      ]
    });
  }
  var NO = Symbol.for("react.lazy"), dr = id[" use ".trim().toString()];
  function zO(n) {
    return typeof n == "object" && n !== null && "then" in n;
  }
  function s1(n) {
    return n != null && typeof n == "object" && "$$typeof" in n && n.$$typeof === NO && "_payload" in n && zO(n._payload);
  }
  function _O(n) {
    const i = kO(n), l = w.forwardRef((o, r) => {
      let { children: d, ...f } = o;
      s1(d) && typeof dr == "function" && (d = dr(d._payload));
      const h = w.Children.toArray(d), m = h.find(BO);
      if (m) {
        const p = m.props.children, g = h.map((v) => v === m ? w.Children.count(p) > 1 ? w.Children.only(null) : w.isValidElement(p) ? p.props.children : null : v);
        return S.jsx(i, {
          ...f,
          ref: r,
          children: w.isValidElement(p) ? w.cloneElement(p, void 0, g) : null
        });
      }
      return S.jsx(i, {
        ...f,
        ref: r,
        children: d
      });
    });
    return l.displayName = `${n}.Slot`, l;
  }
  var VO = _O("Slot");
  function kO(n) {
    const i = w.forwardRef((l, o) => {
      let { children: r, ...d } = l;
      if (s1(r) && typeof dr == "function" && (r = dr(r._payload)), w.isValidElement(r)) {
        const f = HO(r), h = UO(d, r.props);
        return r.type !== w.Fragment && (h.ref = o ? ad(o, f) : f), w.cloneElement(r, h);
      }
      return w.Children.count(r) > 1 ? w.Children.only(null) : null;
    });
    return i.displayName = `${n}.SlotClone`, i;
  }
  var LO = Symbol("radix.slottable");
  function BO(n) {
    return w.isValidElement(n) && typeof n.type == "function" && "__radixId" in n.type && n.type.__radixId === LO;
  }
  function UO(n, i) {
    const l = {
      ...i
    };
    for (const o in i) {
      const r = n[o], d = i[o];
      /^on[A-Z]/.test(o) ? r && d ? l[o] = (...h) => {
        const m = d(...h);
        return r(...h), m;
      } : r && (l[o] = r) : o === "style" ? l[o] = {
        ...r,
        ...d
      } : o === "className" && (l[o] = [
        r,
        d
      ].filter(Boolean).join(" "));
    }
    return {
      ...n,
      ...l
    };
  }
  function HO(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  const q0 = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, X0 = kv, GO = (n, i) => (l) => {
    var o;
    if ((i == null ? void 0 : i.variants) == null) return X0(n, l == null ? void 0 : l.class, l == null ? void 0 : l.className);
    const { variants: r, defaultVariants: d } = i, f = Object.keys(r).map((p) => {
      const g = l == null ? void 0 : l[p], v = d == null ? void 0 : d[p];
      if (g === null) return null;
      const b = q0(g) || q0(v);
      return r[p][b];
    }), h = l && Object.entries(l).reduce((p, g) => {
      let [v, b] = g;
      return b === void 0 || (p[v] = b), p;
    }, {}), m = i == null || (o = i.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((p, g) => {
      let { class: v, className: b, ...T } = g;
      return Object.entries(T).every((A) => {
        let [C, R] = A;
        return Array.isArray(R) ? R.includes({
          ...d,
          ...h
        }[C]) : {
          ...d,
          ...h
        }[C] === R;
      }) ? [
        ...p,
        v,
        b
      ] : p;
    }, []);
    return X0(n, f, m, l == null ? void 0 : l.class, l == null ? void 0 : l.className);
  }, YO = GO("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }), Ua = w.forwardRef(({ className: n, variant: i, size: l, asChild: o = false, ...r }, d) => {
    const f = o ? VO : "button";
    return S.jsx(f, {
      className: gd(YO({
        variant: i,
        size: l,
        className: n
      })),
      ref: d,
      ...r
    });
  });
  Ua.displayName = "Button";
  const PO = [
    -50,
    -25,
    25,
    50
  ], qO = [
    50,
    100,
    150,
    200
  ];
  function K0({ presets: n, value: i, onSelect: l, dot: o }) {
    return S.jsx("div", {
      className: "flex items-center gap-1",
      children: n.map((r) => {
        const d = i === r;
        return S.jsx("button", {
          type: "button",
          onClick: () => l(r),
          className: [
            "relative flex items-center justify-center rounded-lg transition-all",
            "h-9 flex-1",
            d ? "bg-theme-primary/15 ring-1 ring-theme-primary/40" : "hover:bg-theme-accent/60"
          ].join(" "),
          "aria-label": String(r),
          children: o(r, d)
        }, r);
      })
    });
  }
  function Z0({ disabled: n, onFlipH: i, onFlipV: l, onRotate90Cw: o, onBrightness: r, onContrast: d, onApplyCrop: f }) {
    const [h, m] = w.useState(0), [p, g] = w.useState(100), v = (T) => {
      T !== 0 && (r(T / 100), m(0));
    }, b = (T) => {
      T !== 100 && (d(T / 100), g(100));
    };
    return S.jsxs("div", {
      className: "space-y-6",
      children: [
        S.jsxs("div", {
          className: "space-y-3",
          children: [
            S.jsx("h3", {
              className: "text-sm font-medium text-theme-foreground",
              children: "Transform"
            }),
            S.jsxs("div", {
              className: "grid grid-cols-2 gap-2",
              children: [
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: i,
                  children: [
                    S.jsx(z3, {
                      className: "h-4 w-4"
                    }),
                    " Flip H"
                  ]
                }),
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: l,
                  children: [
                    S.jsx(V3, {
                      className: "h-4 w-4"
                    }),
                    " Flip V"
                  ]
                }),
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: o,
                  children: [
                    S.jsx(E3, {
                      className: "h-4 w-4"
                    }),
                    " Rotate 90\xB0"
                  ]
                }),
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: () => {
                    o(), o(), o();
                  },
                  children: [
                    S.jsx(w3, {
                      className: "h-4 w-4"
                    }),
                    " Rotate \u221290\xB0"
                  ]
                })
              ]
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2.5",
          children: [
            S.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                S.jsx(U3, {
                  className: "h-3.5 w-3.5 text-theme-muted-foreground"
                }),
                S.jsx("span", {
                  className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1",
                  children: "Brightness"
                }),
                S.jsx("span", {
                  className: "text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums",
                  children: h > 0 ? `+${h}` : h
                })
              ]
            }),
            S.jsx(K0, {
              presets: PO,
              value: h,
              onSelect: v,
              dot: (T, A) => {
                const C = T < 0 ? `rgba(0,0,0,${0.4 + Math.abs(T) / 50 * 0.6})` : `rgba(255,255,255,${0.4 + T / 50 * 0.6})`;
                return S.jsx("span", {
                  className: "rounded-full border border-white/10",
                  style: {
                    width: 10,
                    height: 10,
                    backgroundColor: A ? "var(--theme-primary)" : C
                  }
                });
              }
            }),
            S.jsx(Za, {
              value: [
                h
              ],
              onValueChange: ([T]) => m(T),
              onValueCommit: ([T]) => v(T),
              min: -100,
              max: 100,
              step: 1,
              disabled: n
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2.5",
          children: [
            S.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                S.jsx(l3, {
                  className: "h-3.5 w-3.5 text-theme-muted-foreground"
                }),
                S.jsx("span", {
                  className: "text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1",
                  children: "Contrast"
                }),
                S.jsxs("span", {
                  className: "text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums",
                  children: [
                    p,
                    "%"
                  ]
                })
              ]
            }),
            S.jsx(K0, {
              presets: qO,
              value: p,
              onSelect: b,
              dot: (T, A) => {
                const C = T / 200;
                return S.jsx("span", {
                  className: "rounded-full",
                  style: {
                    width: 10,
                    height: 10,
                    background: A ? "var(--theme-primary)" : `radial-gradient(circle, rgba(255,255,255,${0.3 + C * 0.7}) 40%, rgba(0,0,0,${C * 0.6}) 100%)`,
                    border: "1px solid rgba(255,255,255,0.15)"
                  }
                });
              }
            }),
            S.jsx(Za, {
              value: [
                p
              ],
              onValueChange: ([T]) => g(T),
              onValueCommit: ([T]) => b(T),
              min: 0,
              max: 300,
              step: 1,
              disabled: n
            })
          ]
        }),
        f && S.jsxs("div", {
          className: "space-y-3 pt-3 border-t border-theme-sidebar-border",
          children: [
            S.jsx("h3", {
              className: "text-sm font-medium text-theme-foreground",
              children: "Crop"
            }),
            S.jsx("p", {
              className: "text-xs text-theme-muted-foreground leading-relaxed",
              children: "Click and drag on the canvas to select a crop area, then apply."
            }),
            S.jsxs(Ua, {
              variant: "default",
              className: "w-full gap-2",
              disabled: n,
              onClick: f,
              children: [
                S.jsx(Ux, {
                  className: "h-4 w-4"
                }),
                " Apply Crop"
              ]
            })
          ]
        })
      ]
    });
  }
  function XO({ onClose: n, activeTool: i, onToolChange: l, stampSettings: o, onStampSettingsChange: r, hasSource: d, onUndo: f, onRedo: h, canUndo: m, canRedo: p, onExport: g, canExport: v, onFlipH: b, onFlipV: T, onRotate90Cw: A, onBrightness: C, onContrast: R, imageReady: O, onApplyCrop: L, exportFormat: z }) {
    return S.jsxs(rn.div, {
      variants: YD,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: `
        fixed left-3 top-3 bottom-[48px] z-40
        w-[296px] rounded-xl
        bg-bg-secondary border border-border
        flex flex-col overflow-hidden
      `,
      style: {
        boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)"
      },
      children: [
        S.jsxs("div", {
          className: "flex items-center justify-between px-4 py-3 border-b border-border",
          children: [
            S.jsxs("h2", {
              className: "flex items-center gap-2 text-sm font-semibold text-text-primary font-mono",
              children: [
                S.jsx(Yx, {
                  className: "h-4 w-4 text-accent"
                }),
                "Tools"
              ]
            }),
            S.jsx("button", {
              onClick: n,
              className: "p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary",
              "aria-label": "Close tools",
              children: S.jsx(Cr, {
                className: "h-4 w-4"
              })
            })
          ]
        }),
        S.jsx("div", {
          className: "p-4 border-b border-border",
          children: S.jsx(sO, {
            activeTool: i,
            onToolChange: l
          })
        }),
        S.jsxs("div", {
          className: "flex-1 overflow-y-auto p-4 space-y-4",
          children: [
            i === "stamp" && S.jsx(jO, {
              settings: o,
              onChange: r,
              hasSource: d
            }),
            i === "transform" && S.jsx(Z0, {
              disabled: !O,
              onFlipH: b,
              onFlipV: T,
              onRotate90Cw: A,
              onBrightness: C,
              onContrast: R
            }),
            i === "crop" && S.jsx(Z0, {
              disabled: !O,
              onFlipH: b,
              onFlipV: T,
              onRotate90Cw: A,
              onBrightness: C,
              onContrast: R,
              onApplyCrop: L
            }),
            ![
              "stamp",
              "transform",
              "crop"
            ].includes(i) && S.jsxs("div", {
              className: "flex flex-col items-center justify-center py-12 text-center",
              children: [
                S.jsx("span", {
                  className: "text-2xl mb-3",
                  children: "\u{1F6A7}"
                }),
                S.jsxs("p", {
                  className: "text-xs text-text-muted font-mono",
                  children: [
                    i.toUpperCase(),
                    " tool coming soon"
                  ]
                }),
                S.jsx("p", {
                  className: "text-[10px] text-text-muted mt-1 opacity-60",
                  children: "Powered by Rust / WASM"
                })
              ]
            })
          ]
        }),
        S.jsx("div", {
          className: "p-4 border-t border-border",
          children: S.jsxs("button", {
            onClick: g,
            disabled: !v,
            className: `
            w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
            text-sm font-semibold
            bg-accent text-text-primary
            hover:brightness-110 transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
          `,
            children: [
              S.jsx(Hx, {
                className: "h-4 w-4"
              }),
              "Export ",
              z.toUpperCase()
            ]
          })
        }),
        S.jsxs("div", {
          className: "px-4 pb-4 flex gap-2",
          children: [
            S.jsxs("button", {
              onClick: f,
              disabled: !m,
              className: `
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-bg-elevated border border-border
            text-text-secondary
            hover:border-border-active hover:text-text-primary
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          `,
              children: [
                S.jsx(X3, {
                  className: "h-3.5 w-3.5"
                }),
                "Undo"
              ]
            }),
            S.jsxs("button", {
              onClick: h,
              disabled: !p,
              className: `
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-bg-elevated border border-border
            text-text-secondary
            hover:border-border-active hover:text-text-primary
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          `,
              children: [
                S.jsx(S3, {
                  className: "h-3.5 w-3.5"
                }),
                "Redo"
              ]
            })
          ]
        })
      ]
    });
  }
  const KO = gn.forwardRef(({ hookResult: n, brushDiameter: i, cursorPos: l, cursorVisible: o, onCanvasEnter: r, onCanvasLeave: d }, f) => {
    const { onMouseDown: h, onMouseMove: m, onMouseUp: p, state: g } = n, v = f;
    let b = null;
    if (g.sourcePos && v.current) {
      const A = v.current, C = A.getBoundingClientRect(), R = C.width / A.width, O = C.height / A.height;
      b = {
        left: C.left + g.sourcePos.x * R,
        top: C.top + g.sourcePos.y * O
      };
    }
    const T = g.zoom;
    return S.jsxs("div", {
      className: "canvas-wrapper",
      children: [
        S.jsx("canvas", {
          ref: f,
          className: "main-canvas",
          style: {
            transform: T !== 1 ? `scale(${T})` : void 0,
            transformOrigin: "center center"
          },
          onMouseDown: h,
          onMouseMove: m,
          onMouseUp: p,
          onMouseLeave: p,
          onMouseEnter: (A) => {
            r(A.currentTarget.getBoundingClientRect());
          },
          onMouseOut: d
        }),
        o && S.jsx("div", {
          className: "brush-cursor",
          style: {
            left: l.x,
            top: l.y,
            width: i,
            height: i
          }
        }),
        b && S.jsx("div", {
          className: "source-marker",
          style: b
        }),
        !g.ready && S.jsxs("div", {
          className: "canvas-empty-state",
          children: [
            S.jsx("div", {
              className: "canvas-empty-icon",
              children: S.jsxs("svg", {
                viewBox: "0 0 48 48",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: [
                  S.jsx("rect", {
                    x: "4",
                    y: "8",
                    width: "40",
                    height: "32",
                    rx: "4"
                  }),
                  S.jsx("circle", {
                    cx: "16",
                    cy: "20",
                    r: "4"
                  }),
                  S.jsx("path", {
                    d: "M4 32l10-8 8 8 8-12 14 12"
                  })
                ]
              })
            }),
            S.jsx("p", {
              className: "canvas-empty-title",
              children: "No image loaded"
            }),
            S.jsxs("p", {
              className: "canvas-empty-hint",
              children: [
                "Use ",
                S.jsx("kbd", {
                  children: "Open"
                }),
                " in the top bar to add images"
              ]
            })
          ]
        })
      ]
    });
  });
  function ZO({ history: n, onJump: i, onDelete: l, onClear: o, onClose: r }) {
    return S.jsxs(rn.aside, {
      variants: PD,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: "history-panel",
      children: [
        S.jsxs("div", {
          className: "panel-header",
          children: [
            S.jsx("span", {
              className: "panel-title",
              children: "History"
            }),
            S.jsx("span", {
              className: "panel-count",
              children: n.length
            }),
            S.jsx("button", {
              className: "btn-icon",
              onClick: o,
              title: "Clear history",
              style: {
                marginLeft: "auto"
              },
              children: S.jsx("svg", {
                viewBox: "0 0 16 16",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: S.jsx("path", {
                  d: "M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                })
              })
            }),
            S.jsx("button", {
              className: "btn-icon",
              onClick: r,
              title: "Close history",
              children: S.jsx("svg", {
                viewBox: "0 0 16 16",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: S.jsx("path", {
                  d: "M4 4l8 8M12 4l-8 8"
                })
              })
            })
          ]
        }),
        S.jsx("ul", {
          className: "history-list",
          children: n.map((d) => S.jsxs("li", {
            className: `history-item type-${d.type}`,
            onClick: () => i(d.index),
            children: [
              S.jsx("span", {
                className: "history-dot"
              }),
              S.jsx("span", {
                className: "history-index",
                children: d.index
              }),
              S.jsx("span", {
                className: "history-label",
                children: d.label
              }),
              d.type === "undo" && S.jsx("button", {
                className: "history-delete",
                title: "Delete entry",
                onClick: (f) => {
                  f.stopPropagation(), l(d.index);
                },
                children: S.jsx("svg", {
                  viewBox: "0 0 12 12",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  children: S.jsx("path", {
                    d: "M2 2l8 8M10 2l-8 8"
                  })
                })
              })
            ]
          }, d.index))
        })
      ]
    });
  }
  function QO({ photos: n, activeId: i, onSelect: l, onRemove: o, onClose: r, showTools: d, showHistory: f }) {
    const h = w.useRef(null);
    return w.useEffect(() => {
      var _a;
      if (!i || !h.current) return;
      (_a = h.current.querySelector(`[data-id="${i}"]`)) == null ? void 0 : _a.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest"
      });
    }, [
      i,
      n.length
    ]), n.length === 0 ? null : S.jsx(rn.div, {
      variants: XD,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: "fixed left-0 right-0 bottom-[48px] z-40",
      children: S.jsx(rn.div, {
        animate: {
          marginLeft: d ? 320 : 12,
          marginRight: f ? 244 : 12
        },
        transition: Qd,
        style: {
          position: "relative"
        },
        className: "bg-bg-secondary/90 backdrop-blur-sm rounded-xl shadow-2xl border border-border",
        children: S.jsxs("div", {
          className: "p-4",
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between mb-3",
              children: [
                S.jsxs("h2", {
                  className: "flex items-center gap-2 text-base font-semibold",
                  children: [
                    S.jsx(Gx, {
                      className: "h-4 w-4"
                    }),
                    "Gallery",
                    S.jsxs("span", {
                      className: "text-xs text-text-muted",
                      children: [
                        "(",
                        n.length,
                        ")"
                      ]
                    })
                  ]
                }),
                S.jsx("button", {
                  onClick: r,
                  className: "p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors",
                  children: S.jsx(Cr, {
                    className: "h-4 w-4"
                  })
                })
              ]
            }),
            S.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                S.jsx("button", {
                  disabled: true,
                  className: "p-1.5 rounded-lg disabled:opacity-30 flex-shrink-0 transition-colors hover:bg-bg-elevated",
                  "aria-label": "Previous images",
                  children: S.jsx(n3, {
                    className: "h-4 w-4"
                  })
                }),
                S.jsx("div", {
                  ref: h,
                  className: "flex gap-2 overflow-x-auto scrollbar-thin py-2 -my-2 px-1 -mx-1",
                  children: n.map((m) => S.jsxs("div", {
                    "data-id": m.id,
                    className: `photo-thumb ${m.id === i ? "active" : ""}`,
                    onClick: () => l(m),
                    title: m.name,
                    children: [
                      S.jsx("img", {
                        src: m.url,
                        alt: m.name,
                        draggable: false
                      }),
                      S.jsx("button", {
                        className: "photo-thumb-remove",
                        title: "Remove",
                        onClick: (p) => {
                          p.stopPropagation(), o(m.id);
                        },
                        children: S.jsx("svg", {
                          viewBox: "0 0 10 10",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: "1.8",
                          children: S.jsx("path", {
                            d: "M1.5 1.5l7 7M8.5 1.5l-7 7"
                          })
                        })
                      }),
                      S.jsx("span", {
                        className: "photo-thumb-label",
                        children: m.name
                      })
                    ]
                  }, m.id))
                }),
                S.jsx("button", {
                  disabled: true,
                  className: "p-1.5 rounded-lg disabled:opacity-30 flex-shrink-0 transition-colors hover:bg-bg-elevated",
                  "aria-label": "Next images",
                  children: S.jsx(a3, {
                    className: "h-4 w-4"
                  })
                })
              ]
            })
          ]
        })
      })
    });
  }
  function FO({ open: n, onClose: i, onFiles: l }) {
    const o = w.useRef(null), [r, d] = w.useState(false), f = (m) => {
      m.preventDefault(), d(false);
      const p = Array.from(m.dataTransfer.files).filter((g) => g.type.startsWith("image/"));
      p.length && (l(p), i());
    }, h = (m) => {
      const p = Array.from(m.target.files ?? []).filter((g) => g.type.startsWith("image/"));
      p.length && (l(p), i()), m.target.value = "";
    };
    return S.jsx(Xa, {
      children: n && S.jsx(rn.div, {
        variants: Lx,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
        onClick: i,
        children: S.jsxs(rn.div, {
          initial: {
            scale: 0.95,
            opacity: 0
          },
          animate: {
            scale: 1,
            opacity: 1
          },
          exit: {
            scale: 0.95,
            opacity: 0
          },
          transition: is,
          className: "relative w-full max-w-lg mx-4 bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden",
          onClick: (m) => m.stopPropagation(),
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between px-6 pt-5 pb-3",
              children: [
                S.jsxs("h2", {
                  className: "flex items-center gap-2 text-base font-semibold text-text-primary font-mono",
                  children: [
                    S.jsx(Wf, {
                      className: "h-5 w-5 text-accent"
                    }),
                    "Open Images"
                  ]
                }),
                S.jsx("button", {
                  onClick: i,
                  className: "p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors",
                  children: S.jsx(Cr, {
                    className: "h-4 w-4"
                  })
                })
              ]
            }),
            S.jsx("div", {
              className: "px-6 pb-6",
              onDrop: f,
              onDragOver: (m) => {
                m.preventDefault(), d(true);
              },
              onDragLeave: () => d(false),
              children: S.jsxs("div", {
                className: `
                  border-2 border-dashed rounded-xl p-12 text-center transition-all
                  ${r ? "border-accent bg-accent-dim" : "border-border bg-bg-tertiary"}
                `,
                children: [
                  S.jsxs("div", {
                    className: "flex flex-col items-center gap-4",
                    children: [
                      S.jsx("div", {
                        className: "w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center",
                        children: S.jsx(Wf, {
                          className: "h-8 w-8 text-text-muted"
                        })
                      }),
                      S.jsxs("button", {
                        onClick: () => {
                          var _a;
                          return (_a = o.current) == null ? void 0 : _a.click();
                        },
                        className: "flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-accent text-primary hover:brightness-110 transition-all",
                        children: [
                          S.jsx(d3, {
                            className: "h-5 w-5"
                          }),
                          "Browse Files"
                        ]
                      }),
                      S.jsx("p", {
                        className: "text-sm text-text-muted",
                        children: "or drag and drop images here"
                      }),
                      S.jsx("p", {
                        className: "text-xs text-text-muted opacity-50",
                        children: "Supports PNG, JPG, GIF, WebP, AVIF"
                      })
                    ]
                  }),
                  S.jsx("input", {
                    ref: o,
                    type: "file",
                    multiple: true,
                    accept: "image/*",
                    hidden: true,
                    onChange: h
                  })
                ]
              })
            })
          ]
        })
      })
    });
  }
  function JO({ onUndo: n, onRedo: i, onExport: l, onDeleteAll: o, onBrushSizeChange: r, setBrushSizeOnTool: d, setShowUpload: f, setShowTools: h, setShowGallery: m, setShowHistory: p, setShowKbdHints: g }) {
    w.useEffect(() => {
      const v = (b) => {
        if (!(b.target instanceof HTMLInputElement || b.target instanceof HTMLTextAreaElement)) {
          if ((b.metaKey || b.ctrlKey) && (b.key === "z" || b.key === "Z")) {
            b.preventDefault(), b.shiftKey ? (console.log("Redo hotkey triggered (Ctrl+Shift+Z)"), i()) : (console.log("Undo hotkey triggered (Ctrl+Z)"), n());
            return;
          }
          if (b.altKey) switch (b.code) {
            case "KeyU":
              b.preventDefault(), f((T) => !T);
              break;
            case "KeyS":
              b.preventDefault(), h((T) => !T);
              break;
            case "KeyG":
              b.preventDefault(), m((T) => !T);
              break;
            case "KeyH":
              b.preventDefault(), p((T) => !T);
              break;
            case "Slash":
              b.preventDefault(), g((T) => !T);
              break;
            case "BracketLeft":
              b.preventDefault(), r((T) => {
                const A = Math.max(2, T.brushSize - 5);
                return d(A), {
                  ...T,
                  brushSize: A
                };
              });
              break;
            case "BracketRight":
              b.preventDefault(), r((T) => {
                const A = Math.min(200, T.brushSize + 5);
                return d(A), {
                  ...T,
                  brushSize: A
                };
              });
              break;
            case "KeyE":
              b.preventDefault(), l();
              break;
            case "KeyD":
              b.preventDefault(), o();
              break;
          }
        }
      };
      return window.addEventListener("keydown", v), () => window.removeEventListener("keydown", v);
    }, [
      n,
      i,
      l,
      o,
      r,
      d,
      f,
      h,
      m,
      p,
      g
    ]);
  }
  function $O() {
    const n = w.useRef(null), i = HD(n), [l, o] = w.useState({
      brushSize: 20,
      hardness: 0.8,
      opacity: 1
    }), r = w.useCallback((j) => {
      o(j), i.setBrushSize(j.brushSize), i.setHardness(j.hardness), i.setOpacity(j.opacity);
    }, [
      i
    ]), [d, f] = w.useState([]), [h, m] = w.useState(null), p = w.useCallback((j) => {
      const K = j.map((et) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(et),
        name: et.name.replace(/\.[^.]+$/, ""),
        file: et
      }));
      f((et) => [
        ...et,
        ...K
      ]);
      const W = K[0];
      W && (i.loadImage(W.file), m(W.id));
    }, [
      i
    ]), g = w.useCallback((j) => {
      i.loadImage(j.file), m(j.id);
    }, [
      i
    ]), v = w.useCallback((j) => {
      f((K) => {
        const W = K.findIndex((dt) => dt.id === j), et = K.filter((dt) => dt.id !== j), at = K[W];
        if (at && URL.revokeObjectURL(at.url), j === h && et.length > 0) {
          const dt = et[Math.min(W, et.length - 1)];
          i.loadImage(dt.file), m(dt.id);
        } else et.length === 0 && m(null);
        return et;
      });
    }, [
      h,
      i
    ]), { pos: b, visible: T, diameter: A, onCanvasEnter: C, onCanvasLeave: R } = GD(l.brushSize, i.state.zoom, n), [O, L] = w.useState(true), [z, V] = w.useState(false), [q, $] = w.useState(false), [X, G] = w.useState(false), [tt, I] = w.useState(false), [nt, st] = w.useState(false), [gt, ht] = w.useState("stamp"), [mt, k] = w.useState("png"), F = w.useRef(0);
    w.useEffect(() => {
      const j = F.current, K = d.length;
      if (j === 0 && K > 0) {
        L(false);
        const W = setTimeout(() => V(true), 150), et = setTimeout(() => $(true), 500), at = setTimeout(() => G(true), 850);
        return F.current = K, () => {
          clearTimeout(W), clearTimeout(et), clearTimeout(at);
        };
      }
      K === 0 && (L(true), V(false), $(false), G(false), I(false)), F.current = K;
    }, [
      d.length
    ]);
    const Z = w.useCallback(() => {
      i.exportAs(mt);
    }, [
      i,
      mt
    ]), it = w.useCallback(() => {
      d.forEach((j) => URL.revokeObjectURL(j.url)), f([]), m(null);
    }, [
      d
    ]);
    JO({
      onUndo: i.undo,
      onRedo: i.redo,
      onExport: Z,
      onDeleteAll: it,
      onBrushSizeChange: o,
      setBrushSizeOnTool: i.setBrushSize,
      setShowUpload: L,
      setShowTools: $,
      setShowGallery: G,
      setShowHistory: I,
      setShowKbdHints: st
    });
    const N = w.useCallback(() => {
      var _a;
      (_a = i.toolRef.current) == null ? void 0 : _a.adjust_zoom(1);
    }, [
      i
    ]), E = w.useCallback(() => {
      var _a;
      (_a = i.toolRef.current) == null ? void 0 : _a.adjust_zoom(-1);
    }, [
      i
    ]);
    return S.jsxs("div", {
      className: "app-shell",
      children: [
        S.jsx(FO, {
          open: O,
          onClose: () => L(false),
          onFiles: p
        }),
        S.jsx(Xa, {
          children: z && S.jsx(I3, {
            zoom: i.state.zoom,
            onZoomIn: N,
            onZoomOut: E,
            showUpload: O,
            showTools: q,
            showGallery: X,
            showHistory: tt,
            showKbdHints: nt,
            onToggleUpload: () => L((j) => !j),
            onToggleTools: () => $((j) => !j),
            onToggleGallery: () => G((j) => !j),
            onToggleHistory: () => I((j) => !j),
            imageCount: d.length,
            exportFormat: mt,
            onExportFormatChange: k,
            onExport: Z,
            hasSelectedImage: i.state.ready,
            onDeleteAll: it
          })
        }),
        S.jsx(Xa, {
          children: q && S.jsx(XO, {
            onClose: () => $(false),
            activeTool: gt,
            onToolChange: ht,
            stampSettings: l,
            onStampSettingsChange: r,
            hasSource: i.state.hasSource,
            onUndo: i.undo,
            onRedo: i.redo,
            canUndo: i.state.undoCount > 0,
            canRedo: i.state.redoCount > 0,
            onExport: Z,
            canExport: i.state.ready,
            imageReady: i.state.ready,
            onFlipH: i.flipHorizontal,
            onFlipV: i.flipVertical,
            onRotate90Cw: i.rotate90Cw,
            onBrightness: i.adjustBrightness,
            onContrast: i.adjustContrast,
            exportFormat: mt
          })
        }),
        S.jsx(rn.main, {
          animate: {
            marginLeft: q ? 320 : 0,
            marginRight: tt ? 244 : 0
          },
          transition: Qd,
          className: "main-content",
          children: S.jsx(KO, {
            ref: n,
            hookResult: i,
            brushDiameter: A,
            cursorPos: b,
            cursorVisible: T,
            onCanvasEnter: C,
            onCanvasLeave: R
          })
        }),
        S.jsx(Xa, {
          children: tt && S.jsx(ZO, {
            history: i.state.history,
            onJump: i.jumpToHistory,
            onDelete: i.deleteHistoryEntry,
            onClear: i.clearHistory,
            onClose: () => I(false)
          })
        }),
        S.jsx(Xa, {
          children: X && S.jsx(QO, {
            photos: d,
            activeId: h,
            onSelect: g,
            onRemove: v,
            onClose: () => G(false),
            showTools: q,
            showHistory: tt
          })
        }),
        S.jsx(tO, {
          state: i.state,
          imageCount: d.length,
          showKbdHints: nt
        }),
        S.jsx(nO, {
          open: nt,
          onClose: () => st(false)
        })
      ]
    });
  }
  function WO() {
    return S.jsx(BA, {
      children: S.jsx($O, {})
    });
  }
  UT.createRoot(document.getElementById("root")).render(S.jsx(gn.StrictMode, {
    children: S.jsx(WO, {})
  }));
})();
