(async () => {
  function RT(n, i) {
    for (var l = 0; l < i.length; l++) {
      const o = i[l];
      if (typeof o != "string" && !Array.isArray(o)) {
        for (const c in o) if (c !== "default" && !(c in n)) {
          const d = Object.getOwnPropertyDescriptor(o, c);
          d && Object.defineProperty(n, c, d.get ? d : {
            enumerable: true,
            get: () => o[c]
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
    for (const c of document.querySelectorAll('link[rel="modulepreload"]')) o(c);
    new MutationObserver((c) => {
      for (const d of c) if (d.type === "childList") for (const f of d.addedNodes) f.tagName === "LINK" && f.rel === "modulepreload" && o(f);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function l(c) {
      const d = {};
      return c.integrity && (d.integrity = c.integrity), c.referrerPolicy && (d.referrerPolicy = c.referrerPolicy), c.crossOrigin === "use-credentials" ? d.credentials = "include" : c.crossOrigin === "anonymous" ? d.credentials = "omit" : d.credentials = "same-origin", d;
    }
    function o(c) {
      if (c.ep) return;
      c.ep = true;
      const d = l(c);
      fetch(c.href, d);
    }
  })();
  function Zv(n) {
    return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
  }
  var Pu = {
    exports: {}
  }, Js = {};
  var Jy;
  function DT() {
    if (Jy) return Js;
    Jy = 1;
    var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
    function l(o, c, d) {
      var f = null;
      if (d !== void 0 && (f = "" + d), c.key !== void 0 && (f = "" + c.key), "key" in c) {
        d = {};
        for (var h in c) h !== "key" && (d[h] = c[h]);
      } else d = c;
      return c = d.ref, {
        $$typeof: n,
        type: o,
        key: f,
        ref: c !== void 0 ? c : null,
        props: d
      };
    }
    return Js.Fragment = i, Js.jsx = l, Js.jsxs = l, Js;
  }
  var $y;
  function OT() {
    return $y || ($y = 1, Pu.exports = DT()), Pu.exports;
  }
  var S = OT(), Xu = {
    exports: {}
  }, gt = {};
  var Wy;
  function NT() {
    if (Wy) return gt;
    Wy = 1;
    var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), l = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), f = Symbol.for("react.context"), h = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), v = Symbol.for("react.activity"), b = Symbol.iterator;
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
    function O(E, B, I) {
      this.props = E, this.context = B, this.refs = R, this.updater = I || A;
    }
    O.prototype.isReactComponent = {}, O.prototype.setState = function(E, B) {
      if (typeof E != "object" && typeof E != "function" && E != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, E, B, "setState");
    }, O.prototype.forceUpdate = function(E) {
      this.updater.enqueueForceUpdate(this, E, "forceUpdate");
    };
    function L() {
    }
    L.prototype = O.prototype;
    function z(E, B, I) {
      this.props = E, this.context = B, this.refs = R, this.updater = I || A;
    }
    var _ = z.prototype = new L();
    _.constructor = z, C(_, O.prototype), _.isPureReactComponent = true;
    var K = Array.isArray;
    function J() {
    }
    var Z = {
      H: null,
      A: null,
      T: null,
      S: null
    }, Y = Object.prototype.hasOwnProperty;
    function tt(E, B, I) {
      var et = I.ref;
      return {
        $$typeof: n,
        type: E,
        key: B,
        ref: et !== void 0 ? et : null,
        props: I
      };
    }
    function W(E, B) {
      return tt(E.type, B, E.props);
    }
    function nt(E) {
      return typeof E == "object" && E !== null && E.$$typeof === n;
    }
    function at(E) {
      var B = {
        "=": "=0",
        ":": "=2"
      };
      return "$" + E.replace(/[=:]/g, function(I) {
        return B[I];
      });
    }
    var pt = /\/+/g;
    function dt(E, B) {
      return typeof E == "object" && E !== null && E.key != null ? at("" + E.key) : B.toString(36);
    }
    function ht(E) {
      switch (E.status) {
        case "fulfilled":
          return E.value;
        case "rejected":
          throw E.reason;
        default:
          switch (typeof E.status == "string" ? E.then(J, J) : (E.status = "pending", E.then(function(B) {
            E.status === "pending" && (E.status = "fulfilled", E.value = B);
          }, function(B) {
            E.status === "pending" && (E.status = "rejected", E.reason = B);
          })), E.status) {
            case "fulfilled":
              return E.value;
            case "rejected":
              throw E.reason;
          }
      }
      throw E;
    }
    function V(E, B, I, et, it) {
      var ut = typeof E;
      (ut === "undefined" || ut === "boolean") && (E = null);
      var yt = false;
      if (E === null) yt = true;
      else switch (ut) {
        case "bigint":
        case "string":
        case "number":
          yt = true;
          break;
        case "object":
          switch (E.$$typeof) {
            case n:
            case i:
              yt = true;
              break;
            case y:
              return yt = E._init, V(yt(E._payload), B, I, et, it);
          }
      }
      if (yt) return it = it(E), yt = et === "" ? "." + dt(E, 0) : et, K(it) ? (I = "", yt != null && (I = yt.replace(pt, "$&/") + "/"), V(it, B, I, "", function(cn) {
        return cn;
      })) : it != null && (nt(it) && (it = W(it, I + (it.key == null || E && E.key === it.key ? "" : ("" + it.key).replace(pt, "$&/") + "/") + yt)), B.push(it)), 1;
      yt = 0;
      var Xt = et === "" ? "." : et + ":";
      if (K(E)) for (var vt = 0; vt < E.length; vt++) et = E[vt], ut = Xt + dt(et, vt), yt += V(et, B, I, ut, it);
      else if (vt = T(E), typeof vt == "function") for (E = vt.call(E), vt = 0; !(et = E.next()).done; ) et = et.value, ut = Xt + dt(et, vt++), yt += V(et, B, I, ut, it);
      else if (ut === "object") {
        if (typeof E.then == "function") return V(ht(E), B, I, et, it);
        throw B = String(E), Error("Objects are not valid as a React child (found: " + (B === "[object Object]" ? "object with keys {" + Object.keys(E).join(", ") + "}" : B) + "). If you meant to render a collection of children, use an array instead.");
      }
      return yt;
    }
    function N(E, B, I) {
      if (E == null) return E;
      var et = [], it = 0;
      return V(E, et, "", "", function(ut) {
        return B.call(I, ut, it++);
      }), et;
    }
    function k(E) {
      if (E._status === -1) {
        var B = E._result;
        B = B(), B.then(function(I) {
          (E._status === 0 || E._status === -1) && (E._status = 1, E._result = I);
        }, function(I) {
          (E._status === 0 || E._status === -1) && (E._status = 2, E._result = I);
        }), E._status === -1 && (E._status = 0, E._result = B);
      }
      if (E._status === 1) return E._result.default;
      throw E._result;
    }
    var $ = typeof reportError == "function" ? reportError : function(E) {
      if (typeof window == "object" && typeof window.ErrorEvent == "function") {
        var B = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof E == "object" && E !== null && typeof E.message == "string" ? String(E.message) : String(E),
          error: E
        });
        if (!window.dispatchEvent(B)) return;
      } else if (typeof process == "object" && typeof process.emit == "function") {
        process.emit("uncaughtException", E);
        return;
      }
      console.error(E);
    }, P = {
      map: N,
      forEach: function(E, B, I) {
        N(E, function() {
          B.apply(this, arguments);
        }, I);
      },
      count: function(E) {
        var B = 0;
        return N(E, function() {
          B++;
        }), B;
      },
      toArray: function(E) {
        return N(E, function(B) {
          return B;
        }) || [];
      },
      only: function(E) {
        if (!nt(E)) throw Error("React.Children.only expected to receive a single React element child.");
        return E;
      }
    };
    return gt.Activity = v, gt.Children = P, gt.Component = O, gt.Fragment = l, gt.Profiler = c, gt.PureComponent = z, gt.StrictMode = o, gt.Suspense = m, gt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Z, gt.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(E) {
        return Z.H.useMemoCache(E);
      }
    }, gt.cache = function(E) {
      return function() {
        return E.apply(null, arguments);
      };
    }, gt.cacheSignal = function() {
      return null;
    }, gt.cloneElement = function(E, B, I) {
      if (E == null) throw Error("The argument must be a React element, but you passed " + E + ".");
      var et = C({}, E.props), it = E.key;
      if (B != null) for (ut in B.key !== void 0 && (it = "" + B.key), B) !Y.call(B, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && B.ref === void 0 || (et[ut] = B[ut]);
      var ut = arguments.length - 2;
      if (ut === 1) et.children = I;
      else if (1 < ut) {
        for (var yt = Array(ut), Xt = 0; Xt < ut; Xt++) yt[Xt] = arguments[Xt + 2];
        et.children = yt;
      }
      return tt(E.type, it, et);
    }, gt.createContext = function(E) {
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
    }, gt.createElement = function(E, B, I) {
      var et, it = {}, ut = null;
      if (B != null) for (et in B.key !== void 0 && (ut = "" + B.key), B) Y.call(B, et) && et !== "key" && et !== "__self" && et !== "__source" && (it[et] = B[et]);
      var yt = arguments.length - 2;
      if (yt === 1) it.children = I;
      else if (1 < yt) {
        for (var Xt = Array(yt), vt = 0; vt < yt; vt++) Xt[vt] = arguments[vt + 2];
        it.children = Xt;
      }
      if (E && E.defaultProps) for (et in yt = E.defaultProps, yt) it[et] === void 0 && (it[et] = yt[et]);
      return tt(E, ut, it);
    }, gt.createRef = function() {
      return {
        current: null
      };
    }, gt.forwardRef = function(E) {
      return {
        $$typeof: h,
        render: E
      };
    }, gt.isValidElement = nt, gt.lazy = function(E) {
      return {
        $$typeof: y,
        _payload: {
          _status: -1,
          _result: E
        },
        _init: k
      };
    }, gt.memo = function(E, B) {
      return {
        $$typeof: p,
        type: E,
        compare: B === void 0 ? null : B
      };
    }, gt.startTransition = function(E) {
      var B = Z.T, I = {};
      Z.T = I;
      try {
        var et = E(), it = Z.S;
        it !== null && it(I, et), typeof et == "object" && et !== null && typeof et.then == "function" && et.then(J, $);
      } catch (ut) {
        $(ut);
      } finally {
        B !== null && I.types !== null && (B.types = I.types), Z.T = B;
      }
    }, gt.unstable_useCacheRefresh = function() {
      return Z.H.useCacheRefresh();
    }, gt.use = function(E) {
      return Z.H.use(E);
    }, gt.useActionState = function(E, B, I) {
      return Z.H.useActionState(E, B, I);
    }, gt.useCallback = function(E, B) {
      return Z.H.useCallback(E, B);
    }, gt.useContext = function(E) {
      return Z.H.useContext(E);
    }, gt.useDebugValue = function() {
    }, gt.useDeferredValue = function(E, B) {
      return Z.H.useDeferredValue(E, B);
    }, gt.useEffect = function(E, B) {
      return Z.H.useEffect(E, B);
    }, gt.useEffectEvent = function(E) {
      return Z.H.useEffectEvent(E);
    }, gt.useId = function() {
      return Z.H.useId();
    }, gt.useImperativeHandle = function(E, B, I) {
      return Z.H.useImperativeHandle(E, B, I);
    }, gt.useInsertionEffect = function(E, B) {
      return Z.H.useInsertionEffect(E, B);
    }, gt.useLayoutEffect = function(E, B) {
      return Z.H.useLayoutEffect(E, B);
    }, gt.useMemo = function(E, B) {
      return Z.H.useMemo(E, B);
    }, gt.useOptimistic = function(E, B) {
      return Z.H.useOptimistic(E, B);
    }, gt.useReducer = function(E, B, I) {
      return Z.H.useReducer(E, B, I);
    }, gt.useRef = function(E) {
      return Z.H.useRef(E);
    }, gt.useState = function(E) {
      return Z.H.useState(E);
    }, gt.useSyncExternalStore = function(E, B, I) {
      return Z.H.useSyncExternalStore(E, B, I);
    }, gt.useTransition = function() {
      return Z.H.useTransition();
    }, gt.version = "19.2.4", gt;
  }
  var Iy;
  function nd() {
    return Iy || (Iy = 1, Xu.exports = NT()), Xu.exports;
  }
  var w = nd();
  const yn = Zv(w), id = RT({
    __proto__: null,
    default: yn
  }, [
    w
  ]);
  var Ku = {
    exports: {}
  }, $s = {}, Zu = {
    exports: {}
  }, Qu = {};
  var tg;
  function jT() {
    return tg || (tg = 1, (function(n) {
      function i(V, N) {
        var k = V.length;
        V.push(N);
        t: for (; 0 < k; ) {
          var $ = k - 1 >>> 1, P = V[$];
          if (0 < c(P, N)) V[$] = N, V[k] = P, k = $;
          else break t;
        }
      }
      function l(V) {
        return V.length === 0 ? null : V[0];
      }
      function o(V) {
        if (V.length === 0) return null;
        var N = V[0], k = V.pop();
        if (k !== N) {
          V[0] = k;
          t: for (var $ = 0, P = V.length, E = P >>> 1; $ < E; ) {
            var B = 2 * ($ + 1) - 1, I = V[B], et = B + 1, it = V[et];
            if (0 > c(I, k)) et < P && 0 > c(it, I) ? (V[$] = it, V[et] = k, $ = et) : (V[$] = I, V[B] = k, $ = B);
            else if (et < P && 0 > c(it, k)) V[$] = it, V[et] = k, $ = et;
            else break t;
          }
        }
        return N;
      }
      function c(V, N) {
        var k = V.sortIndex - N.sortIndex;
        return k !== 0 ? k : V.id - N.id;
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
      var m = [], p = [], y = 1, v = null, b = 3, T = false, A = false, C = false, R = false, O = typeof setTimeout == "function" ? setTimeout : null, L = typeof clearTimeout == "function" ? clearTimeout : null, z = typeof setImmediate < "u" ? setImmediate : null;
      function _(V) {
        for (var N = l(p); N !== null; ) {
          if (N.callback === null) o(p);
          else if (N.startTime <= V) o(p), N.sortIndex = N.expirationTime, i(m, N);
          else break;
          N = l(p);
        }
      }
      function K(V) {
        if (C = false, _(V), !A) if (l(m) !== null) A = true, J || (J = true, at());
        else {
          var N = l(p);
          N !== null && ht(K, N.startTime - V);
        }
      }
      var J = false, Z = -1, Y = 5, tt = -1;
      function W() {
        return R ? true : !(n.unstable_now() - tt < Y);
      }
      function nt() {
        if (R = false, J) {
          var V = n.unstable_now();
          tt = V;
          var N = true;
          try {
            t: {
              A = false, C && (C = false, L(Z), Z = -1), T = true;
              var k = b;
              try {
                e: {
                  for (_(V), v = l(m); v !== null && !(v.expirationTime > V && W()); ) {
                    var $ = v.callback;
                    if (typeof $ == "function") {
                      v.callback = null, b = v.priorityLevel;
                      var P = $(v.expirationTime <= V);
                      if (V = n.unstable_now(), typeof P == "function") {
                        v.callback = P, _(V), N = true;
                        break e;
                      }
                      v === l(m) && o(m), _(V);
                    } else o(m);
                    v = l(m);
                  }
                  if (v !== null) N = true;
                  else {
                    var E = l(p);
                    E !== null && ht(K, E.startTime - V), N = false;
                  }
                }
                break t;
              } finally {
                v = null, b = k, T = false;
              }
              N = void 0;
            }
          } finally {
            N ? at() : J = false;
          }
        }
      }
      var at;
      if (typeof z == "function") at = function() {
        z(nt);
      };
      else if (typeof MessageChannel < "u") {
        var pt = new MessageChannel(), dt = pt.port2;
        pt.port1.onmessage = nt, at = function() {
          dt.postMessage(null);
        };
      } else at = function() {
        O(nt, 0);
      };
      function ht(V, N) {
        Z = O(function() {
          V(n.unstable_now());
        }, N);
      }
      n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(V) {
        V.callback = null;
      }, n.unstable_forceFrameRate = function(V) {
        0 > V || 125 < V ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : Y = 0 < V ? Math.floor(1e3 / V) : 5;
      }, n.unstable_getCurrentPriorityLevel = function() {
        return b;
      }, n.unstable_next = function(V) {
        switch (b) {
          case 1:
          case 2:
          case 3:
            var N = 3;
            break;
          default:
            N = b;
        }
        var k = b;
        b = N;
        try {
          return V();
        } finally {
          b = k;
        }
      }, n.unstable_requestPaint = function() {
        R = true;
      }, n.unstable_runWithPriority = function(V, N) {
        switch (V) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            V = 3;
        }
        var k = b;
        b = V;
        try {
          return N();
        } finally {
          b = k;
        }
      }, n.unstable_scheduleCallback = function(V, N, k) {
        var $ = n.unstable_now();
        switch (typeof k == "object" && k !== null ? (k = k.delay, k = typeof k == "number" && 0 < k ? $ + k : $) : k = $, V) {
          case 1:
            var P = -1;
            break;
          case 2:
            P = 250;
            break;
          case 5:
            P = 1073741823;
            break;
          case 4:
            P = 1e4;
            break;
          default:
            P = 5e3;
        }
        return P = k + P, V = {
          id: y++,
          callback: N,
          priorityLevel: V,
          startTime: k,
          expirationTime: P,
          sortIndex: -1
        }, k > $ ? (V.sortIndex = k, i(p, V), l(m) === null && V === l(p) && (C ? (L(Z), Z = -1) : C = true, ht(K, k - $))) : (V.sortIndex = P, i(m, V), A || T || (A = true, J || (J = true, at()))), V;
      }, n.unstable_shouldYield = W, n.unstable_wrapCallback = function(V) {
        var N = b;
        return function() {
          var k = b;
          b = N;
          try {
            return V.apply(this, arguments);
          } finally {
            b = k;
          }
        };
      };
    })(Qu)), Qu;
  }
  var eg;
  function zT() {
    return eg || (eg = 1, Zu.exports = jT()), Zu.exports;
  }
  var Fu = {
    exports: {}
  }, fe = {};
  var ng;
  function _T() {
    if (ng) return fe;
    ng = 1;
    var n = nd();
    function i(m) {
      var p = "https://react.dev/errors/" + m;
      if (1 < arguments.length) {
        p += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var y = 2; y < arguments.length; y++) p += "&args[]=" + encodeURIComponent(arguments[y]);
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
    }, c = Symbol.for("react.portal");
    function d(m, p, y) {
      var v = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      return {
        $$typeof: c,
        key: v == null ? null : "" + v,
        children: m,
        containerInfo: p,
        implementation: y
      };
    }
    var f = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function h(m, p) {
      if (m === "font") return "";
      if (typeof p == "string") return p === "use-credentials" ? p : "";
    }
    return fe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = o, fe.createPortal = function(m, p) {
      var y = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11) throw Error(i(299));
      return d(m, p, null, y);
    }, fe.flushSync = function(m) {
      var p = f.T, y = o.p;
      try {
        if (f.T = null, o.p = 2, m) return m();
      } finally {
        f.T = p, o.p = y, o.d.f();
      }
    }, fe.preconnect = function(m, p) {
      typeof m == "string" && (p ? (p = p.crossOrigin, p = typeof p == "string" ? p === "use-credentials" ? p : "" : void 0) : p = null, o.d.C(m, p));
    }, fe.prefetchDNS = function(m) {
      typeof m == "string" && o.d.D(m);
    }, fe.preinit = function(m, p) {
      if (typeof m == "string" && p && typeof p.as == "string") {
        var y = p.as, v = h(y, p.crossOrigin), b = typeof p.integrity == "string" ? p.integrity : void 0, T = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        y === "style" ? o.d.S(m, typeof p.precedence == "string" ? p.precedence : void 0, {
          crossOrigin: v,
          integrity: b,
          fetchPriority: T
        }) : y === "script" && o.d.X(m, {
          crossOrigin: v,
          integrity: b,
          fetchPriority: T,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0
        });
      }
    }, fe.preinitModule = function(m, p) {
      if (typeof m == "string") if (typeof p == "object" && p !== null) {
        if (p.as == null || p.as === "script") {
          var y = h(p.as, p.crossOrigin);
          o.d.M(m, {
            crossOrigin: y,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
            nonce: typeof p.nonce == "string" ? p.nonce : void 0
          });
        }
      } else p == null && o.d.M(m);
    }, fe.preload = function(m, p) {
      if (typeof m == "string" && typeof p == "object" && p !== null && typeof p.as == "string") {
        var y = p.as, v = h(y, p.crossOrigin);
        o.d.L(m, y, {
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
        var y = h(p.as, p.crossOrigin);
        o.d.m(m, {
          as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
          crossOrigin: y,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0
        });
      } else o.d.m(m);
    }, fe.requestFormReset = function(m) {
      o.d.r(m);
    }, fe.unstable_batchedUpdates = function(m, p) {
      return m(p);
    }, fe.useFormState = function(m, p, y) {
      return f.H.useFormState(m, p, y);
    }, fe.useFormStatus = function() {
      return f.H.useHostTransitionStatus();
    }, fe.version = "19.2.4", fe;
  }
  var ig;
  function Qv() {
    if (ig) return Fu.exports;
    ig = 1;
    function n() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (i) {
        console.error(i);
      }
    }
    return n(), Fu.exports = _T(), Fu.exports;
  }
  var ag;
  function VT() {
    if (ag) return $s;
    ag = 1;
    var n = zT(), i = nd(), l = Qv();
    function o(t) {
      var e = "https://react.dev/errors/" + t;
      if (1 < arguments.length) {
        e += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var a = 2; a < arguments.length; a++) e += "&args[]=" + encodeURIComponent(arguments[a]);
      }
      return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function c(t) {
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
        var r = a.return;
        if (r === null) break;
        var u = r.alternate;
        if (u === null) {
          if (s = r.return, s !== null) {
            a = s;
            continue;
          }
          break;
        }
        if (r.child === u.child) {
          for (u = r.child; u; ) {
            if (u === a) return m(r), t;
            if (u === s) return m(r), e;
            u = u.sibling;
          }
          throw Error(o(188));
        }
        if (a.return !== s.return) a = r, s = u;
        else {
          for (var g = false, x = r.child; x; ) {
            if (x === a) {
              g = true, a = r, s = u;
              break;
            }
            if (x === s) {
              g = true, s = r, a = u;
              break;
            }
            x = x.sibling;
          }
          if (!g) {
            for (x = u.child; x; ) {
              if (x === a) {
                g = true, a = u, s = r;
                break;
              }
              if (x === s) {
                g = true, s = u, a = r;
                break;
              }
              x = x.sibling;
            }
            if (!g) throw Error(o(189));
          }
        }
        if (a.alternate !== s) throw Error(o(190));
      }
      if (a.tag !== 3) throw Error(o(188));
      return a.stateNode.current === a ? t : e;
    }
    function y(t) {
      var e = t.tag;
      if (e === 5 || e === 26 || e === 27 || e === 6) return t;
      for (t = t.child; t !== null; ) {
        if (e = y(t), e !== null) return e;
        t = t.sibling;
      }
      return null;
    }
    var v = Object.assign, b = Symbol.for("react.element"), T = Symbol.for("react.transitional.element"), A = Symbol.for("react.portal"), C = Symbol.for("react.fragment"), R = Symbol.for("react.strict_mode"), O = Symbol.for("react.profiler"), L = Symbol.for("react.consumer"), z = Symbol.for("react.context"), _ = Symbol.for("react.forward_ref"), K = Symbol.for("react.suspense"), J = Symbol.for("react.suspense_list"), Z = Symbol.for("react.memo"), Y = Symbol.for("react.lazy"), tt = Symbol.for("react.activity"), W = Symbol.for("react.memo_cache_sentinel"), nt = Symbol.iterator;
    function at(t) {
      return t === null || typeof t != "object" ? null : (t = nt && t[nt] || t["@@iterator"], typeof t == "function" ? t : null);
    }
    var pt = Symbol.for("react.client.reference");
    function dt(t) {
      if (t == null) return null;
      if (typeof t == "function") return t.$$typeof === pt ? null : t.displayName || t.name || null;
      if (typeof t == "string") return t;
      switch (t) {
        case C:
          return "Fragment";
        case O:
          return "Profiler";
        case R:
          return "StrictMode";
        case K:
          return "Suspense";
        case J:
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
        case _:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case Z:
          return e = t.displayName || null, e !== null ? e : dt(t.type) || "Memo";
        case Y:
          e = t._payload, t = t._init;
          try {
            return dt(t(e));
          } catch {
          }
      }
      return null;
    }
    var ht = Array.isArray, V = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, N = l.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, k = {
      pending: false,
      data: null,
      method: null,
      action: null
    }, $ = [], P = -1;
    function E(t) {
      return {
        current: t
      };
    }
    function B(t) {
      0 > P || (t.current = $[P], $[P] = null, P--);
    }
    function I(t, e) {
      P++, $[P] = t.current, t.current = e;
    }
    var et = E(null), it = E(null), ut = E(null), yt = E(null);
    function Xt(t, e) {
      switch (I(ut, e), I(it, t), I(et, null), e.nodeType) {
        case 9:
        case 11:
          t = (t = e.documentElement) && (t = t.namespaceURI) ? by(t) : 0;
          break;
        default:
          if (t = e.tagName, e = e.namespaceURI) e = by(e), t = xy(e, t);
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
      B(et), I(et, t);
    }
    function vt() {
      B(et), B(it), B(ut);
    }
    function cn(t) {
      t.memoizedState !== null && I(yt, t);
      var e = et.current, a = xy(e, t.type);
      e !== a && (I(it, t), I(et, a));
    }
    function $e(t) {
      it.current === t && (B(et), B(it)), yt.current === t && (B(yt), Ks._currentValue = k);
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
    var Mr = false;
    function Rr(t, e) {
      if (!t || Mr) return "";
      Mr = true;
      var a = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        var s = {
          DetermineComponentFrameRoot: function() {
            try {
              if (e) {
                var F = function() {
                  throw Error();
                };
                if (Object.defineProperty(F.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                }), typeof Reflect == "object" && Reflect.construct) {
                  try {
                    Reflect.construct(F, []);
                  } catch (q) {
                    var G = q;
                  }
                  Reflect.construct(t, [], F);
                } else {
                  try {
                    F.call();
                  } catch (q) {
                    G = q;
                  }
                  t.call(F.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (q) {
                  G = q;
                }
                (F = t()) && typeof F.catch == "function" && F.catch(function() {
                });
              }
            } catch (q) {
              if (q && G && typeof q.stack == "string") return [
                q.stack,
                G.stack
              ];
            }
            return [
              null,
              null
            ];
          }
        };
        s.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
        var r = Object.getOwnPropertyDescriptor(s.DetermineComponentFrameRoot, "name");
        r && r.configurable && Object.defineProperty(s.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot"
        });
        var u = s.DetermineComponentFrameRoot(), g = u[0], x = u[1];
        if (g && x) {
          var M = g.split(`
`), H = x.split(`
`);
          for (r = s = 0; s < M.length && !M[s].includes("DetermineComponentFrameRoot"); ) s++;
          for (; r < H.length && !H[r].includes("DetermineComponentFrameRoot"); ) r++;
          if (s === M.length || r === H.length) for (s = M.length - 1, r = H.length - 1; 1 <= s && 0 <= r && M[s] !== H[r]; ) r--;
          for (; 1 <= s && 0 <= r; s--, r--) if (M[s] !== H[r]) {
            if (s !== 1 || r !== 1) do
              if (s--, r--, 0 > r || M[s] !== H[r]) {
                var X = `
` + M[s].replace(" at new ", " at ");
                return t.displayName && X.includes("<anonymous>") && (X = X.replace("<anonymous>", t.displayName)), X;
              }
            while (1 <= s && 0 <= r);
            break;
          }
        }
      } finally {
        Mr = false, Error.prepareStackTrace = a;
      }
      return (a = t ? t.displayName || t.name : "") ? Le(a) : "";
    }
    function s1(t, e) {
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
          return Rr(t.type, false);
        case 11:
          return Rr(t.type.render, false);
        case 1:
          return Rr(t.type, true);
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
          e += s1(t, a), a = t, t = t.return;
        while (t);
        return e;
      } catch (s) {
        return `
Error generating stack: ` + s.message + `
` + s.stack;
      }
    }
    var Dr = Object.prototype.hasOwnProperty, Or = n.unstable_scheduleCallback, Nr = n.unstable_cancelCallback, l1 = n.unstable_shouldYield, o1 = n.unstable_requestPaint, Ae = n.unstable_now, r1 = n.unstable_getCurrentPriorityLevel, $d = n.unstable_ImmediatePriority, Wd = n.unstable_UserBlockingPriority, yl = n.unstable_NormalPriority, c1 = n.unstable_LowPriority, Id = n.unstable_IdlePriority, u1 = n.log, f1 = n.unstable_setDisableYieldValue, as = null, Ee = null;
    function Pn(t) {
      if (typeof u1 == "function" && f1(t), Ee && typeof Ee.setStrictMode == "function") try {
        Ee.setStrictMode(as, t);
      } catch {
      }
    }
    var Ce = Math.clz32 ? Math.clz32 : m1, d1 = Math.log, h1 = Math.LN2;
    function m1(t) {
      return t >>>= 0, t === 0 ? 32 : 31 - (d1(t) / h1 | 0) | 0;
    }
    var gl = 256, vl = 262144, bl = 4194304;
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
    function xl(t, e, a) {
      var s = t.pendingLanes;
      if (s === 0) return 0;
      var r = 0, u = t.suspendedLanes, g = t.pingedLanes;
      t = t.warmLanes;
      var x = s & 134217727;
      return x !== 0 ? (s = x & ~u, s !== 0 ? r = Ei(s) : (g &= x, g !== 0 ? r = Ei(g) : a || (a = x & ~t, a !== 0 && (r = Ei(a))))) : (x = s & ~u, x !== 0 ? r = Ei(x) : g !== 0 ? r = Ei(g) : a || (a = s & ~t, a !== 0 && (r = Ei(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
    }
    function ss(t, e) {
      return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
    }
    function p1(t, e) {
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
      var t = bl;
      return bl <<= 1, (bl & 62914560) === 0 && (bl = 4194304), t;
    }
    function jr(t) {
      for (var e = [], a = 0; 31 > a; a++) e.push(t);
      return e;
    }
    function ls(t, e) {
      t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
    }
    function y1(t, e, a, s, r, u) {
      var g = t.pendingLanes;
      t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
      var x = t.entanglements, M = t.expirationTimes, H = t.hiddenUpdates;
      for (a = g & ~a; 0 < a; ) {
        var X = 31 - Ce(a), F = 1 << X;
        x[X] = 0, M[X] = -1;
        var G = H[X];
        if (G !== null) for (H[X] = null, X = 0; X < G.length; X++) {
          var q = G[X];
          q !== null && (q.lane &= -536870913);
        }
        a &= ~F;
      }
      s !== 0 && eh(t, s, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
    }
    function eh(t, e, a) {
      t.pendingLanes |= e, t.suspendedLanes &= ~e;
      var s = 31 - Ce(e);
      t.entangledLanes |= e, t.entanglements[s] = t.entanglements[s] | 1073741824 | a & 261930;
    }
    function nh(t, e) {
      var a = t.entangledLanes |= e;
      for (t = t.entanglements; a; ) {
        var s = 31 - Ce(a), r = 1 << s;
        r & e | t[s] & e && (t[s] |= e), a &= ~r;
      }
    }
    function ih(t, e) {
      var a = e & -e;
      return a = (a & 42) !== 0 ? 1 : zr(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
    }
    function zr(t) {
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
    function _r(t) {
      return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
    }
    function ah() {
      var t = N.p;
      return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : qy(t.type));
    }
    function sh(t, e) {
      var a = N.p;
      try {
        return N.p = t, e();
      } finally {
        N.p = a;
      }
    }
    var Xn = Math.random().toString(36).slice(2), ae = "__reactFiber$" + Xn, ge = "__reactProps$" + Xn, ta = "__reactContainer$" + Xn, Vr = "__reactEvents$" + Xn, g1 = "__reactListeners$" + Xn, v1 = "__reactHandles$" + Xn, lh = "__reactResources$" + Xn, os = "__reactMarker$" + Xn;
    function kr(t) {
      delete t[ae], delete t[ge], delete t[Vr], delete t[g1], delete t[v1];
    }
    function ea(t) {
      var e = t[ae];
      if (e) return e;
      for (var a = t.parentNode; a; ) {
        if (e = a[ta] || a[ae]) {
          if (a = e.alternate, e.child !== null || a !== null && a.child !== null) for (t = My(t); t !== null; ) {
            if (a = t[ae]) return a;
            t = My(t);
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
    function rs(t) {
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
      t[os] = true;
    }
    var oh = /* @__PURE__ */ new Set(), rh = {};
    function Ci(t, e) {
      aa(t, e), aa(t + "Capture", e);
    }
    function aa(t, e) {
      for (rh[t] = e, t = 0; t < e.length; t++) oh.add(e[t]);
    }
    var b1 = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), ch = {}, uh = {};
    function x1(t) {
      return Dr.call(uh, t) ? true : Dr.call(ch, t) ? false : b1.test(t) ? uh[t] = true : (ch[t] = true, false);
    }
    function Sl(t, e, a) {
      if (x1(e)) if (a === null) t.removeAttribute(e);
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
    function Tl(t, e, a) {
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
    function S1(t, e, a) {
      var s = Object.getOwnPropertyDescriptor(t.constructor.prototype, e);
      if (!t.hasOwnProperty(e) && typeof s < "u" && typeof s.get == "function" && typeof s.set == "function") {
        var r = s.get, u = s.set;
        return Object.defineProperty(t, e, {
          configurable: true,
          get: function() {
            return r.call(this);
          },
          set: function(g) {
            a = "" + g, u.call(this, g);
          }
        }), Object.defineProperty(t, e, {
          enumerable: s.enumerable
        }), {
          getValue: function() {
            return a;
          },
          setValue: function(g) {
            a = "" + g;
          },
          stopTracking: function() {
            t._valueTracker = null, delete t[e];
          }
        };
      }
    }
    function Lr(t) {
      if (!t._valueTracker) {
        var e = fh(t) ? "checked" : "value";
        t._valueTracker = S1(t, e, "" + t[e]);
      }
    }
    function dh(t) {
      if (!t) return false;
      var e = t._valueTracker;
      if (!e) return true;
      var a = e.getValue(), s = "";
      return t && (s = fh(t) ? t.checked ? "true" : "false" : t.value), t = s, t !== a ? (e.setValue(t), true) : false;
    }
    function wl(t) {
      if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
      try {
        return t.activeElement || t.body;
      } catch {
        return t.body;
      }
    }
    var T1 = /[\n"\\]/g;
    function Ue(t) {
      return t.replace(T1, function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      });
    }
    function Br(t, e, a, s, r, u, g, x) {
      t.name = "", g != null && typeof g != "function" && typeof g != "symbol" && typeof g != "boolean" ? t.type = g : t.removeAttribute("type"), e != null ? g === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + Be(e)) : t.value !== "" + Be(e) && (t.value = "" + Be(e)) : g !== "submit" && g !== "reset" || t.removeAttribute("value"), e != null ? Ur(t, g, Be(e)) : a != null ? Ur(t, g, Be(a)) : s != null && t.removeAttribute("value"), r == null && u != null && (t.defaultChecked = !!u), r != null && (t.checked = r && typeof r != "function" && typeof r != "symbol"), x != null && typeof x != "function" && typeof x != "symbol" && typeof x != "boolean" ? t.name = "" + Be(x) : t.removeAttribute("name");
    }
    function hh(t, e, a, s, r, u, g, x) {
      if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (t.type = u), e != null || a != null) {
        if (!(u !== "submit" && u !== "reset" || e != null)) {
          Lr(t);
          return;
        }
        a = a != null ? "" + Be(a) : "", e = e != null ? "" + Be(e) : a, x || e === t.value || (t.value = e), t.defaultValue = e;
      }
      s = s ?? r, s = typeof s != "function" && typeof s != "symbol" && !!s, t.checked = x ? t.checked : !!s, t.defaultChecked = !!s, g != null && typeof g != "function" && typeof g != "symbol" && typeof g != "boolean" && (t.name = g), Lr(t);
    }
    function Ur(t, e, a) {
      e === "number" && wl(t.ownerDocument) === t || t.defaultValue === "" + a || (t.defaultValue = "" + a);
    }
    function sa(t, e, a, s) {
      if (t = t.options, e) {
        e = {};
        for (var r = 0; r < a.length; r++) e["$" + a[r]] = true;
        for (a = 0; a < t.length; a++) r = e.hasOwnProperty("$" + t[a].value), t[a].selected !== r && (t[a].selected = r), r && s && (t[a].defaultSelected = true);
      } else {
        for (a = "" + Be(a), e = null, r = 0; r < t.length; r++) {
          if (t[r].value === a) {
            t[r].selected = true, s && (t[r].defaultSelected = true);
            return;
          }
          e !== null || t[r].disabled || (e = t[r]);
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
          if (ht(s)) {
            if (1 < s.length) throw Error(o(93));
            s = s[0];
          }
          a = s;
        }
        a == null && (a = ""), e = a;
      }
      a = Be(e), t.defaultValue = a, s = t.textContent, s === a && s !== "" && s !== null && (t.value = s), Lr(t);
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
    var w1 = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
    function yh(t, e, a) {
      var s = e.indexOf("--") === 0;
      a == null || typeof a == "boolean" || a === "" ? s ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : s ? t.setProperty(e, a) : typeof a != "number" || a === 0 || w1.has(e) ? e === "float" ? t.cssFloat = a : t[e] = ("" + a).trim() : t[e] = a + "px";
    }
    function gh(t, e, a) {
      if (e != null && typeof e != "object") throw Error(o(62));
      if (t = t.style, a != null) {
        for (var s in a) !a.hasOwnProperty(s) || e != null && e.hasOwnProperty(s) || (s.indexOf("--") === 0 ? t.setProperty(s, "") : s === "float" ? t.cssFloat = "" : t[s] = "");
        for (var r in e) s = e[r], e.hasOwnProperty(r) && a[r] !== s && yh(t, r, s);
      } else for (var u in e) e.hasOwnProperty(u) && yh(t, u, e[u]);
    }
    function Hr(t) {
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
    var A1 = /* @__PURE__ */ new Map([
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
    ]), E1 = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    function Al(t) {
      return E1.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
    }
    function wn() {
    }
    var Gr = null;
    function Yr(t) {
      return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
    }
    var oa = null, ra = null;
    function vh(t) {
      var e = na(t);
      if (e && (t = e.stateNode)) {
        var a = t[ge] || null;
        t: switch (t = e.stateNode, e.type) {
          case "input":
            if (Br(t, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name), e = a.name, a.type === "radio" && e != null) {
              for (a = t; a.parentNode; ) a = a.parentNode;
              for (a = a.querySelectorAll('input[name="' + Ue("" + e) + '"][type="radio"]'), e = 0; e < a.length; e++) {
                var s = a[e];
                if (s !== t && s.form === t.form) {
                  var r = s[ge] || null;
                  if (!r) throw Error(o(90));
                  Br(s, r.value, r.defaultValue, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name);
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
        if (qr = false, (oa !== null || ra !== null) && (fo(), oa && (e = oa, t = ra, ra = oa = null, vh(e), t))) for (e = 0; e < t.length; e++) vh(t[e]);
      }
    }
    function cs(t, e) {
      var a = t.stateNode;
      if (a === null) return null;
      var s = a[ge] || null;
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
    var An = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Pr = false;
    if (An) try {
      var us = {};
      Object.defineProperty(us, "passive", {
        get: function() {
          Pr = true;
        }
      }), window.addEventListener("test", us, us), window.removeEventListener("test", us, us);
    } catch {
      Pr = false;
    }
    var Kn = null, Xr = null, El = null;
    function xh() {
      if (El) return El;
      var t, e = Xr, a = e.length, s, r = "value" in Kn ? Kn.value : Kn.textContent, u = r.length;
      for (t = 0; t < a && e[t] === r[t]; t++) ;
      var g = a - t;
      for (s = 1; s <= g && e[a - s] === r[u - s]; s++) ;
      return El = r.slice(t, 1 < s ? 1 - s : void 0);
    }
    function Cl(t) {
      var e = t.keyCode;
      return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
    }
    function Ml() {
      return true;
    }
    function Sh() {
      return false;
    }
    function ve(t) {
      function e(a, s, r, u, g) {
        this._reactName = a, this._targetInst = r, this.type = s, this.nativeEvent = u, this.target = g, this.currentTarget = null;
        for (var x in t) t.hasOwnProperty(x) && (a = t[x], this[x] = a ? a(u) : u[x]);
        return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === false) ? Ml : Sh, this.isPropagationStopped = Sh, this;
      }
      return v(e.prototype, {
        preventDefault: function() {
          this.defaultPrevented = true;
          var a = this.nativeEvent;
          a && (a.preventDefault ? a.preventDefault() : typeof a.returnValue != "unknown" && (a.returnValue = false), this.isDefaultPrevented = Ml);
        },
        stopPropagation: function() {
          var a = this.nativeEvent;
          a && (a.stopPropagation ? a.stopPropagation() : typeof a.cancelBubble != "unknown" && (a.cancelBubble = true), this.isPropagationStopped = Ml);
        },
        persist: function() {
        },
        isPersistent: Ml
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
    }, Rl = ve(Mi), fs = v({}, Mi, {
      view: 0,
      detail: 0
    }), C1 = ve(fs), Kr, Zr, ds, Dl = v({}, fs, {
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
      getModifierState: Fr,
      button: 0,
      buttons: 0,
      relatedTarget: function(t) {
        return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
      },
      movementX: function(t) {
        return "movementX" in t ? t.movementX : (t !== ds && (ds && t.type === "mousemove" ? (Kr = t.screenX - ds.screenX, Zr = t.screenY - ds.screenY) : Zr = Kr = 0, ds = t), Kr);
      },
      movementY: function(t) {
        return "movementY" in t ? t.movementY : Zr;
      }
    }), Th = ve(Dl), M1 = v({}, Dl, {
      dataTransfer: 0
    }), R1 = ve(M1), D1 = v({}, fs, {
      relatedTarget: 0
    }), Qr = ve(D1), O1 = v({}, Mi, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), N1 = ve(O1), j1 = v({}, Mi, {
      clipboardData: function(t) {
        return "clipboardData" in t ? t.clipboardData : window.clipboardData;
      }
    }), z1 = ve(j1), _1 = v({}, Mi, {
      data: 0
    }), wh = ve(_1), V1 = {
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
    }, k1 = {
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
    }, L1 = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey"
    };
    function B1(t) {
      var e = this.nativeEvent;
      return e.getModifierState ? e.getModifierState(t) : (t = L1[t]) ? !!e[t] : false;
    }
    function Fr() {
      return B1;
    }
    var U1 = v({}, fs, {
      key: function(t) {
        if (t.key) {
          var e = V1[t.key] || t.key;
          if (e !== "Unidentified") return e;
        }
        return t.type === "keypress" ? (t = Cl(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? k1[t.keyCode] || "Unidentified" : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Fr,
      charCode: function(t) {
        return t.type === "keypress" ? Cl(t) : 0;
      },
      keyCode: function(t) {
        return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      },
      which: function(t) {
        return t.type === "keypress" ? Cl(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      }
    }), H1 = ve(U1), G1 = v({}, Dl, {
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
    }), Ah = ve(G1), Y1 = v({}, fs, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Fr
    }), q1 = ve(Y1), P1 = v({}, Mi, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), X1 = ve(P1), K1 = v({}, Dl, {
      deltaX: function(t) {
        return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
      },
      deltaY: function(t) {
        return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    }), Z1 = ve(K1), Q1 = v({}, Mi, {
      newState: 0,
      oldState: 0
    }), F1 = ve(Q1), J1 = [
      9,
      13,
      27,
      32
    ], Jr = An && "CompositionEvent" in window, hs = null;
    An && "documentMode" in document && (hs = document.documentMode);
    var $1 = An && "TextEvent" in window && !hs, Eh = An && (!Jr || hs && 8 < hs && 11 >= hs), Ch = " ", Mh = false;
    function Rh(t, e) {
      switch (t) {
        case "keyup":
          return J1.indexOf(e.keyCode) !== -1;
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
    function W1(t, e) {
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
    function I1(t, e) {
      if (ca) return t === "compositionend" || !Jr && Rh(t, e) ? (t = xh(), El = Xr = Kn = null, ca = false, t) : null;
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
    var tS = {
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
      return e === "input" ? !!tS[t.type] : e === "textarea";
    }
    function Nh(t, e, a, s) {
      oa ? ra ? ra.push(s) : ra = [
        s
      ] : oa = s, e = bo(e, "onChange"), 0 < e.length && (a = new Rl("onChange", "change", null, a, s), t.push({
        event: a,
        listeners: e
      }));
    }
    var ms = null, ps = null;
    function eS(t) {
      hy(t, 0);
    }
    function Ol(t) {
      var e = rs(t);
      if (dh(e)) return t;
    }
    function jh(t, e) {
      if (t === "change") return e;
    }
    var zh = false;
    if (An) {
      var $r;
      if (An) {
        var Wr = "oninput" in document;
        if (!Wr) {
          var _h = document.createElement("div");
          _h.setAttribute("oninput", "return;"), Wr = typeof _h.oninput == "function";
        }
        $r = Wr;
      } else $r = false;
      zh = $r && (!document.documentMode || 9 < document.documentMode);
    }
    function Vh() {
      ms && (ms.detachEvent("onpropertychange", kh), ps = ms = null);
    }
    function kh(t) {
      if (t.propertyName === "value" && Ol(ps)) {
        var e = [];
        Nh(e, ps, t, Yr(t)), bh(eS, e);
      }
    }
    function nS(t, e, a) {
      t === "focusin" ? (Vh(), ms = e, ps = a, ms.attachEvent("onpropertychange", kh)) : t === "focusout" && Vh();
    }
    function iS(t) {
      if (t === "selectionchange" || t === "keyup" || t === "keydown") return Ol(ps);
    }
    function aS(t, e) {
      if (t === "click") return Ol(e);
    }
    function sS(t, e) {
      if (t === "input" || t === "change") return Ol(e);
    }
    function lS(t, e) {
      return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
    }
    var Me = typeof Object.is == "function" ? Object.is : lS;
    function ys(t, e) {
      if (Me(t, e)) return true;
      if (typeof t != "object" || t === null || typeof e != "object" || e === null) return false;
      var a = Object.keys(t), s = Object.keys(e);
      if (a.length !== s.length) return false;
      for (s = 0; s < a.length; s++) {
        var r = a[s];
        if (!Dr.call(e, r) || !Me(t[r], e[r])) return false;
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
      for (var e = wl(t.document); e instanceof t.HTMLIFrameElement; ) {
        try {
          var a = typeof e.contentWindow.location.href == "string";
        } catch {
          a = false;
        }
        if (a) t = e.contentWindow;
        else break;
        e = wl(t.document);
      }
      return e;
    }
    function Ir(t) {
      var e = t && t.nodeName && t.nodeName.toLowerCase();
      return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
    }
    var oS = An && "documentMode" in document && 11 >= document.documentMode, ua = null, tc = null, gs = null, ec = false;
    function Gh(t, e, a) {
      var s = a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
      ec || ua == null || ua !== wl(s) || (s = ua, "selectionStart" in s && Ir(s) ? s = {
        start: s.selectionStart,
        end: s.selectionEnd
      } : (s = (s.ownerDocument && s.ownerDocument.defaultView || window).getSelection(), s = {
        anchorNode: s.anchorNode,
        anchorOffset: s.anchorOffset,
        focusNode: s.focusNode,
        focusOffset: s.focusOffset
      }), gs && ys(gs, s) || (gs = s, s = bo(tc, "onSelect"), 0 < s.length && (e = new Rl("onSelect", "select", null, e, a), t.push({
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
    }, nc = {}, Yh = {};
    An && (Yh = document.createElement("div").style, "AnimationEvent" in window || (delete fa.animationend.animation, delete fa.animationiteration.animation, delete fa.animationstart.animation), "TransitionEvent" in window || delete fa.transitionend.transition);
    function Di(t) {
      if (nc[t]) return nc[t];
      if (!fa[t]) return t;
      var e = fa[t], a;
      for (a in e) if (e.hasOwnProperty(a) && a in Yh) return nc[t] = e[a];
      return t;
    }
    var qh = Di("animationend"), Ph = Di("animationiteration"), Xh = Di("animationstart"), rS = Di("transitionrun"), cS = Di("transitionstart"), uS = Di("transitioncancel"), Kh = Di("transitionend"), Zh = /* @__PURE__ */ new Map(), ic = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
    ic.push("scrollEnd");
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
    }, He = [], da = 0, ac = 0;
    function jl() {
      for (var t = da, e = ac = da = 0; e < t; ) {
        var a = He[e];
        He[e++] = null;
        var s = He[e];
        He[e++] = null;
        var r = He[e];
        He[e++] = null;
        var u = He[e];
        if (He[e++] = null, s !== null && r !== null) {
          var g = s.pending;
          g === null ? r.next = r : (r.next = g.next, g.next = r), s.pending = r;
        }
        u !== 0 && Qh(a, r, u);
      }
    }
    function zl(t, e, a, s) {
      He[da++] = t, He[da++] = e, He[da++] = a, He[da++] = s, ac |= s, t.lanes |= s, t = t.alternate, t !== null && (t.lanes |= s);
    }
    function sc(t, e, a, s) {
      return zl(t, e, a, s), _l(t);
    }
    function Oi(t, e) {
      return zl(t, null, null, e), _l(t);
    }
    function Qh(t, e, a) {
      t.lanes |= a;
      var s = t.alternate;
      s !== null && (s.lanes |= a);
      for (var r = false, u = t.return; u !== null; ) u.childLanes |= a, s = u.alternate, s !== null && (s.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = true)), t = u, u = u.return;
      return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - Ce(a), t = u.hiddenUpdates, s = t[r], s === null ? t[r] = [
        e
      ] : s.push(e), e.lane = a | 536870912), u) : null;
    }
    function _l(t) {
      if (50 < Us) throw Us = 0, mu = null, Error(o(185));
      for (var e = t.return; e !== null; ) t = e, e = t.return;
      return t.tag === 3 ? t.stateNode : null;
    }
    var ha = {};
    function fS(t, e, a, s) {
      this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = s, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
    }
    function Re(t, e, a, s) {
      return new fS(t, e, a, s);
    }
    function lc(t) {
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
    function Vl(t, e, a, s, r, u) {
      var g = 0;
      if (s = t, typeof t == "function") lc(t) && (g = 1);
      else if (typeof t == "string") g = yT(t, a, et.current) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
      else t: switch (t) {
        case tt:
          return t = Re(31, a, e, r), t.elementType = tt, t.lanes = u, t;
        case C:
          return Ni(a.children, r, u, e);
        case R:
          g = 8, r |= 24;
          break;
        case O:
          return t = Re(12, a, e, r | 2), t.elementType = O, t.lanes = u, t;
        case K:
          return t = Re(13, a, e, r), t.elementType = K, t.lanes = u, t;
        case J:
          return t = Re(19, a, e, r), t.elementType = J, t.lanes = u, t;
        default:
          if (typeof t == "object" && t !== null) switch (t.$$typeof) {
            case z:
              g = 10;
              break t;
            case L:
              g = 9;
              break t;
            case _:
              g = 11;
              break t;
            case Z:
              g = 14;
              break t;
            case Y:
              g = 16, s = null;
              break t;
          }
          g = 29, a = Error(o(130, t === null ? "null" : typeof t, "")), s = null;
      }
      return e = Re(g, a, e, r), e.elementType = t, e.type = s, e.lanes = u, e;
    }
    function Ni(t, e, a, s) {
      return t = Re(7, t, s, e), t.lanes = a, t;
    }
    function oc(t, e, a) {
      return t = Re(6, t, null, e), t.lanes = a, t;
    }
    function Jh(t) {
      var e = Re(18, null, null, 0);
      return e.stateNode = t, e;
    }
    function rc(t, e, a) {
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
    var ma = [], pa = 0, kl = null, vs = 0, Ye = [], qe = 0, Zn = null, fn = 1, dn = "";
    function Cn(t, e) {
      ma[pa++] = vs, ma[pa++] = kl, kl = t, vs = e;
    }
    function Wh(t, e, a) {
      Ye[qe++] = fn, Ye[qe++] = dn, Ye[qe++] = Zn, Zn = t;
      var s = fn;
      t = dn;
      var r = 32 - Ce(s) - 1;
      s &= ~(1 << r), a += 1;
      var u = 32 - Ce(e) + r;
      if (30 < u) {
        var g = r - r % 5;
        u = (s & (1 << g) - 1).toString(32), s >>= g, r -= g, fn = 1 << 32 - Ce(e) + r | a << r | s, dn = u + t;
      } else fn = 1 << u | a << r | s, dn = t;
    }
    function cc(t) {
      t.return !== null && (Cn(t, 1), Wh(t, 1, 0));
    }
    function uc(t) {
      for (; t === kl; ) kl = ma[--pa], ma[pa] = null, vs = ma[--pa], ma[pa] = null;
      for (; t === Zn; ) Zn = Ye[--qe], Ye[qe] = null, dn = Ye[--qe], Ye[qe] = null, fn = Ye[--qe], Ye[qe] = null;
    }
    function Ih(t, e) {
      Ye[qe++] = fn, Ye[qe++] = dn, Ye[qe++] = Zn, fn = e.id, dn = e.overflow, Zn = t;
    }
    var se = null, Bt = null, Ct = false, Qn = null, Pe = false, fc = Error(o(519));
    function Fn(t) {
      var e = Error(o(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", ""));
      throw bs(Ge(e, t)), fc;
    }
    function tm(t) {
      var e = t.stateNode, a = t.type, s = t.memoizedProps;
      switch (e[ae] = t, e[ge] = s, a) {
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
          for (a = 0; a < Gs.length; a++) wt(Gs[a], e);
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
      a = s.children, typeof a != "string" && typeof a != "number" && typeof a != "bigint" || e.textContent === "" + a || s.suppressHydrationWarning === true || gy(e.textContent, a) ? (s.popover != null && (wt("beforetoggle", e), wt("toggle", e)), s.onScroll != null && wt("scroll", e), s.onScrollEnd != null && wt("scrollend", e), s.onClick != null && (e.onclick = wn), e = true) : e = false, e || Fn(t, true);
    }
    function em(t) {
      for (se = t.return; se; ) switch (se.tag) {
        case 5:
        case 31:
        case 13:
          Pe = false;
          return;
        case 27:
        case 3:
          Pe = true;
          return;
        default:
          se = se.return;
      }
    }
    function ya(t) {
      if (t !== se) return false;
      if (!Ct) return em(t), Ct = true, false;
      var e = t.tag, a;
      if ((a = e !== 3 && e !== 27) && ((a = e === 5) && (a = t.type, a = !(a !== "form" && a !== "button") || Du(t.type, t.memoizedProps)), a = !a), a && Bt && Fn(t), em(t), e === 13) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Bt = Cy(t);
      } else if (e === 31) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Bt = Cy(t);
      } else e === 27 ? (e = Bt, ci(t.type) ? (t = _u, _u = null, Bt = t) : Bt = e) : Bt = se ? Ke(t.stateNode.nextSibling) : null;
      return true;
    }
    function ji() {
      Bt = se = null, Ct = false;
    }
    function dc() {
      var t = Qn;
      return t !== null && (Te === null ? Te = t : Te.push.apply(Te, t), Qn = null), t;
    }
    function bs(t) {
      Qn === null ? Qn = [
        t
      ] : Qn.push(t);
    }
    var hc = E(null), zi = null, Mn = null;
    function Jn(t, e, a) {
      I(hc, e._currentValue), e._currentValue = a;
    }
    function Rn(t) {
      t._currentValue = hc.current, B(hc);
    }
    function mc(t, e, a) {
      for (; t !== null; ) {
        var s = t.alternate;
        if ((t.childLanes & e) !== e ? (t.childLanes |= e, s !== null && (s.childLanes |= e)) : s !== null && (s.childLanes & e) !== e && (s.childLanes |= e), t === a) break;
        t = t.return;
      }
    }
    function pc(t, e, a, s) {
      var r = t.child;
      for (r !== null && (r.return = t); r !== null; ) {
        var u = r.dependencies;
        if (u !== null) {
          var g = r.child;
          u = u.firstContext;
          t: for (; u !== null; ) {
            var x = u;
            u = r;
            for (var M = 0; M < e.length; M++) if (x.context === e[M]) {
              u.lanes |= a, x = u.alternate, x !== null && (x.lanes |= a), mc(u.return, a, t), s || (g = null);
              break t;
            }
            u = x.next;
          }
        } else if (r.tag === 18) {
          if (g = r.return, g === null) throw Error(o(341));
          g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), mc(g, a, t), g = null;
        } else g = r.child;
        if (g !== null) g.return = r;
        else for (g = r; g !== null; ) {
          if (g === t) {
            g = null;
            break;
          }
          if (r = g.sibling, r !== null) {
            r.return = g.return, g = r;
            break;
          }
          g = g.return;
        }
        r = g;
      }
    }
    function ga(t, e, a, s) {
      t = null;
      for (var r = e, u = false; r !== null; ) {
        if (!u) {
          if ((r.flags & 524288) !== 0) u = true;
          else if ((r.flags & 262144) !== 0) break;
        }
        if (r.tag === 10) {
          var g = r.alternate;
          if (g === null) throw Error(o(387));
          if (g = g.memoizedProps, g !== null) {
            var x = r.type;
            Me(r.pendingProps.value, g.value) || (t !== null ? t.push(x) : t = [
              x
            ]);
          }
        } else if (r === yt.current) {
          if (g = r.alternate, g === null) throw Error(o(387));
          g.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ks) : t = [
            Ks
          ]);
        }
        r = r.return;
      }
      t !== null && pc(e, t, a, s), e.flags |= 262144;
    }
    function Ll(t) {
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
    function Bl(t, e) {
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
    var dS = typeof AbortController < "u" ? AbortController : function() {
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
    }, hS = n.unstable_scheduleCallback, mS = n.unstable_NormalPriority, Qt = {
      $$typeof: z,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0
    };
    function yc() {
      return {
        controller: new dS(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function xs(t) {
      t.refCount--, t.refCount === 0 && hS(mS, function() {
        t.controller.abort();
      });
    }
    var Ss = null, gc = 0, va = 0, ba = null;
    function pS(t, e) {
      if (Ss === null) {
        var a = Ss = [];
        gc = 0, va = xu(), ba = {
          status: "pending",
          value: void 0,
          then: function(s) {
            a.push(s);
          }
        };
      }
      return gc++, e.then(im, im), e;
    }
    function im() {
      if (--gc === 0 && Ss !== null) {
        ba !== null && (ba.status = "fulfilled");
        var t = Ss;
        Ss = null, va = 0, ba = null;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
    }
    function yS(t, e) {
      var a = [], s = {
        status: "pending",
        value: null,
        reason: null,
        then: function(r) {
          a.push(r);
        }
      };
      return t.then(function() {
        s.status = "fulfilled", s.value = e;
        for (var r = 0; r < a.length; r++) (0, a[r])(e);
      }, function(r) {
        for (s.status = "rejected", s.reason = r, r = 0; r < a.length; r++) (0, a[r])(void 0);
      }), s;
    }
    var am = V.S;
    V.S = function(t, e) {
      Gp = Ae(), typeof e == "object" && e !== null && typeof e.then == "function" && pS(t, e), am !== null && am(t, e);
    };
    var Vi = E(null);
    function vc() {
      var t = Vi.current;
      return t !== null ? t : kt.pooledCache;
    }
    function Ul(t, e) {
      e === null ? I(Vi, Vi.current) : I(Vi, e.pool);
    }
    function sm() {
      var t = vc();
      return t === null ? null : {
        parent: Qt._currentValue,
        pool: t
      };
    }
    var xa = Error(o(460)), bc = Error(o(474)), Hl = Error(o(542)), Gl = {
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
                var r = e;
                r.status = "fulfilled", r.value = s;
              }
            }, function(s) {
              if (e.status === "pending") {
                var r = e;
                r.status = "rejected", r.reason = s;
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
      if (t === xa || t === Hl) throw Error(o(483));
    }
    var Sa = null, Ts = 0;
    function Yl(t) {
      var e = Ts;
      return Ts += 1, Sa === null && (Sa = []), om(Sa, t, e);
    }
    function ws(t, e) {
      e = e.props.ref, t.ref = e !== void 0 ? e : null;
    }
    function ql(t, e) {
      throw e.$$typeof === b ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t)));
    }
    function um(t) {
      function e(j, D) {
        if (t) {
          var U = j.deletions;
          U === null ? (j.deletions = [
            D
          ], j.flags |= 16) : U.push(D);
        }
      }
      function a(j, D) {
        if (!t) return null;
        for (; D !== null; ) e(j, D), D = D.sibling;
        return null;
      }
      function s(j) {
        for (var D = /* @__PURE__ */ new Map(); j !== null; ) j.key !== null ? D.set(j.key, j) : D.set(j.index, j), j = j.sibling;
        return D;
      }
      function r(j, D) {
        return j = En(j, D), j.index = 0, j.sibling = null, j;
      }
      function u(j, D, U) {
        return j.index = U, t ? (U = j.alternate, U !== null ? (U = U.index, U < D ? (j.flags |= 67108866, D) : U) : (j.flags |= 67108866, D)) : (j.flags |= 1048576, D);
      }
      function g(j) {
        return t && j.alternate === null && (j.flags |= 67108866), j;
      }
      function x(j, D, U, Q) {
        return D === null || D.tag !== 6 ? (D = oc(U, j.mode, Q), D.return = j, D) : (D = r(D, U), D.return = j, D);
      }
      function M(j, D, U, Q) {
        var ft = U.type;
        return ft === C ? X(j, D, U.props.children, Q, U.key) : D !== null && (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Y && ki(ft) === D.type) ? (D = r(D, U.props), ws(D, U), D.return = j, D) : (D = Vl(U.type, U.key, U.props, null, j.mode, Q), ws(D, U), D.return = j, D);
      }
      function H(j, D, U, Q) {
        return D === null || D.tag !== 4 || D.stateNode.containerInfo !== U.containerInfo || D.stateNode.implementation !== U.implementation ? (D = rc(U, j.mode, Q), D.return = j, D) : (D = r(D, U.children || []), D.return = j, D);
      }
      function X(j, D, U, Q, ft) {
        return D === null || D.tag !== 7 ? (D = Ni(U, j.mode, Q, ft), D.return = j, D) : (D = r(D, U), D.return = j, D);
      }
      function F(j, D, U) {
        if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint") return D = oc("" + D, j.mode, U), D.return = j, D;
        if (typeof D == "object" && D !== null) {
          switch (D.$$typeof) {
            case T:
              return U = Vl(D.type, D.key, D.props, null, j.mode, U), ws(U, D), U.return = j, U;
            case A:
              return D = rc(D, j.mode, U), D.return = j, D;
            case Y:
              return D = ki(D), F(j, D, U);
          }
          if (ht(D) || at(D)) return D = Ni(D, j.mode, U, null), D.return = j, D;
          if (typeof D.then == "function") return F(j, Yl(D), U);
          if (D.$$typeof === z) return F(j, Bl(j, D), U);
          ql(j, D);
        }
        return null;
      }
      function G(j, D, U, Q) {
        var ft = D !== null ? D.key : null;
        if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint") return ft !== null ? null : x(j, D, "" + U, Q);
        if (typeof U == "object" && U !== null) {
          switch (U.$$typeof) {
            case T:
              return U.key === ft ? M(j, D, U, Q) : null;
            case A:
              return U.key === ft ? H(j, D, U, Q) : null;
            case Y:
              return U = ki(U), G(j, D, U, Q);
          }
          if (ht(U) || at(U)) return ft !== null ? null : X(j, D, U, Q, null);
          if (typeof U.then == "function") return G(j, D, Yl(U), Q);
          if (U.$$typeof === z) return G(j, D, Bl(j, U), Q);
          ql(j, U);
        }
        return null;
      }
      function q(j, D, U, Q, ft) {
        if (typeof Q == "string" && Q !== "" || typeof Q == "number" || typeof Q == "bigint") return j = j.get(U) || null, x(D, j, "" + Q, ft);
        if (typeof Q == "object" && Q !== null) {
          switch (Q.$$typeof) {
            case T:
              return j = j.get(Q.key === null ? U : Q.key) || null, M(D, j, Q, ft);
            case A:
              return j = j.get(Q.key === null ? U : Q.key) || null, H(D, j, Q, ft);
            case Y:
              return Q = ki(Q), q(j, D, U, Q, ft);
          }
          if (ht(Q) || at(Q)) return j = j.get(U) || null, X(D, j, Q, ft, null);
          if (typeof Q.then == "function") return q(j, D, U, Yl(Q), ft);
          if (Q.$$typeof === z) return q(j, D, U, Bl(D, Q), ft);
          ql(D, Q);
        }
        return null;
      }
      function st(j, D, U, Q) {
        for (var ft = null, Mt = null, ct = D, xt = D = 0, Et = null; ct !== null && xt < U.length; xt++) {
          ct.index > xt ? (Et = ct, ct = null) : Et = ct.sibling;
          var Rt = G(j, ct, U[xt], Q);
          if (Rt === null) {
            ct === null && (ct = Et);
            break;
          }
          t && ct && Rt.alternate === null && e(j, ct), D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt, ct = Et;
        }
        if (xt === U.length) return a(j, ct), Ct && Cn(j, xt), ft;
        if (ct === null) {
          for (; xt < U.length; xt++) ct = F(j, U[xt], Q), ct !== null && (D = u(ct, D, xt), Mt === null ? ft = ct : Mt.sibling = ct, Mt = ct);
          return Ct && Cn(j, xt), ft;
        }
        for (ct = s(ct); xt < U.length; xt++) Et = q(ct, j, xt, U[xt], Q), Et !== null && (t && Et.alternate !== null && ct.delete(Et.key === null ? xt : Et.key), D = u(Et, D, xt), Mt === null ? ft = Et : Mt.sibling = Et, Mt = Et);
        return t && ct.forEach(function(mi) {
          return e(j, mi);
        }), Ct && Cn(j, xt), ft;
      }
      function mt(j, D, U, Q) {
        if (U == null) throw Error(o(151));
        for (var ft = null, Mt = null, ct = D, xt = D = 0, Et = null, Rt = U.next(); ct !== null && !Rt.done; xt++, Rt = U.next()) {
          ct.index > xt ? (Et = ct, ct = null) : Et = ct.sibling;
          var mi = G(j, ct, Rt.value, Q);
          if (mi === null) {
            ct === null && (ct = Et);
            break;
          }
          t && ct && mi.alternate === null && e(j, ct), D = u(mi, D, xt), Mt === null ? ft = mi : Mt.sibling = mi, Mt = mi, ct = Et;
        }
        if (Rt.done) return a(j, ct), Ct && Cn(j, xt), ft;
        if (ct === null) {
          for (; !Rt.done; xt++, Rt = U.next()) Rt = F(j, Rt.value, Q), Rt !== null && (D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt);
          return Ct && Cn(j, xt), ft;
        }
        for (ct = s(ct); !Rt.done; xt++, Rt = U.next()) Rt = q(ct, j, xt, Rt.value, Q), Rt !== null && (t && Rt.alternate !== null && ct.delete(Rt.key === null ? xt : Rt.key), D = u(Rt, D, xt), Mt === null ? ft = Rt : Mt.sibling = Rt, Mt = Rt);
        return t && ct.forEach(function(MT) {
          return e(j, MT);
        }), Ct && Cn(j, xt), ft;
      }
      function Vt(j, D, U, Q) {
        if (typeof U == "object" && U !== null && U.type === C && U.key === null && (U = U.props.children), typeof U == "object" && U !== null) {
          switch (U.$$typeof) {
            case T:
              t: {
                for (var ft = U.key; D !== null; ) {
                  if (D.key === ft) {
                    if (ft = U.type, ft === C) {
                      if (D.tag === 7) {
                        a(j, D.sibling), Q = r(D, U.props.children), Q.return = j, j = Q;
                        break t;
                      }
                    } else if (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Y && ki(ft) === D.type) {
                      a(j, D.sibling), Q = r(D, U.props), ws(Q, U), Q.return = j, j = Q;
                      break t;
                    }
                    a(j, D);
                    break;
                  } else e(j, D);
                  D = D.sibling;
                }
                U.type === C ? (Q = Ni(U.props.children, j.mode, Q, U.key), Q.return = j, j = Q) : (Q = Vl(U.type, U.key, U.props, null, j.mode, Q), ws(Q, U), Q.return = j, j = Q);
              }
              return g(j);
            case A:
              t: {
                for (ft = U.key; D !== null; ) {
                  if (D.key === ft) if (D.tag === 4 && D.stateNode.containerInfo === U.containerInfo && D.stateNode.implementation === U.implementation) {
                    a(j, D.sibling), Q = r(D, U.children || []), Q.return = j, j = Q;
                    break t;
                  } else {
                    a(j, D);
                    break;
                  }
                  else e(j, D);
                  D = D.sibling;
                }
                Q = rc(U, j.mode, Q), Q.return = j, j = Q;
              }
              return g(j);
            case Y:
              return U = ki(U), Vt(j, D, U, Q);
          }
          if (ht(U)) return st(j, D, U, Q);
          if (at(U)) {
            if (ft = at(U), typeof ft != "function") throw Error(o(150));
            return U = ft.call(U), mt(j, D, U, Q);
          }
          if (typeof U.then == "function") return Vt(j, D, Yl(U), Q);
          if (U.$$typeof === z) return Vt(j, D, Bl(j, U), Q);
          ql(j, U);
        }
        return typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint" ? (U = "" + U, D !== null && D.tag === 6 ? (a(j, D.sibling), Q = r(D, U), Q.return = j, j = Q) : (a(j, D), Q = oc(U, j.mode, Q), Q.return = j, j = Q), g(j)) : a(j, D);
      }
      return function(j, D, U, Q) {
        try {
          Ts = 0;
          var ft = Vt(j, D, U, Q);
          return Sa = null, ft;
        } catch (ct) {
          if (ct === xa || ct === Hl) throw ct;
          var Mt = Re(29, ct, null, j.mode);
          return Mt.lanes = Q, Mt.return = j, Mt;
        } finally {
        }
      };
    }
    var Bi = um(true), fm = um(false), $n = false;
    function xc(t) {
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
    function Sc(t, e) {
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
        var r = s.pending;
        return r === null ? e.next = e : (e.next = r.next, r.next = e), s.pending = e, e = _l(t), Qh(t, null, a), e;
      }
      return zl(t, s, e, a), _l(t);
    }
    function As(t, e, a) {
      if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
        var s = e.lanes;
        s &= t.pendingLanes, a |= s, e.lanes = a, nh(t, a);
      }
    }
    function Tc(t, e) {
      var a = t.updateQueue, s = t.alternate;
      if (s !== null && (s = s.updateQueue, a === s)) {
        var r = null, u = null;
        if (a = a.firstBaseUpdate, a !== null) {
          do {
            var g = {
              lane: a.lane,
              tag: a.tag,
              payload: a.payload,
              callback: null,
              next: null
            };
            u === null ? r = u = g : u = u.next = g, a = a.next;
          } while (a !== null);
          u === null ? r = u = e : u = u.next = e;
        } else r = u = e;
        a = {
          baseState: s.baseState,
          firstBaseUpdate: r,
          lastBaseUpdate: u,
          shared: s.shared,
          callbacks: s.callbacks
        }, t.updateQueue = a;
        return;
      }
      t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
    }
    var wc = false;
    function Es() {
      if (wc) {
        var t = ba;
        if (t !== null) throw t;
      }
    }
    function Cs(t, e, a, s) {
      wc = false;
      var r = t.updateQueue;
      $n = false;
      var u = r.firstBaseUpdate, g = r.lastBaseUpdate, x = r.shared.pending;
      if (x !== null) {
        r.shared.pending = null;
        var M = x, H = M.next;
        M.next = null, g === null ? u = H : g.next = H, g = M;
        var X = t.alternate;
        X !== null && (X = X.updateQueue, x = X.lastBaseUpdate, x !== g && (x === null ? X.firstBaseUpdate = H : x.next = H, X.lastBaseUpdate = M));
      }
      if (u !== null) {
        var F = r.baseState;
        g = 0, X = H = M = null, x = u;
        do {
          var G = x.lane & -536870913, q = G !== x.lane;
          if (q ? (At & G) === G : (s & G) === G) {
            G !== 0 && G === va && (wc = true), X !== null && (X = X.next = {
              lane: 0,
              tag: x.tag,
              payload: x.payload,
              callback: null,
              next: null
            });
            t: {
              var st = t, mt = x;
              G = e;
              var Vt = a;
              switch (mt.tag) {
                case 1:
                  if (st = mt.payload, typeof st == "function") {
                    F = st.call(Vt, F, G);
                    break t;
                  }
                  F = st;
                  break t;
                case 3:
                  st.flags = st.flags & -65537 | 128;
                case 0:
                  if (st = mt.payload, G = typeof st == "function" ? st.call(Vt, F, G) : st, G == null) break t;
                  F = v({}, F, G);
                  break t;
                case 2:
                  $n = true;
              }
            }
            G = x.callback, G !== null && (t.flags |= 64, q && (t.flags |= 8192), q = r.callbacks, q === null ? r.callbacks = [
              G
            ] : q.push(G));
          } else q = {
            lane: G,
            tag: x.tag,
            payload: x.payload,
            callback: x.callback,
            next: null
          }, X === null ? (H = X = q, M = F) : X = X.next = q, g |= G;
          if (x = x.next, x === null) {
            if (x = r.shared.pending, x === null) break;
            q = x, x = q.next, q.next = null, r.lastBaseUpdate = q, r.shared.pending = null;
          }
        } while (true);
        X === null && (M = F), r.baseState = M, r.firstBaseUpdate = H, r.lastBaseUpdate = X, u === null && (r.shared.lanes = 0), ai |= g, t.lanes = g, t.memoizedState = F;
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
    var Ta = E(null), Pl = E(0);
    function mm(t, e) {
      t = Ln, I(Pl, t), I(Ta, e), Ln = t | e.baseLanes;
    }
    function Ac() {
      I(Pl, Ln), I(Ta, Ta.current);
    }
    function Ec() {
      Ln = Pl.current, B(Ta), B(Pl);
    }
    var De = E(null), Xe = null;
    function ti(t) {
      var e = t.alternate;
      I(Kt, Kt.current & 1), I(De, t), Xe === null && (e === null || Ta.current !== null || e.memoizedState !== null) && (Xe = t);
    }
    function Cc(t) {
      I(Kt, Kt.current), I(De, t), Xe === null && (Xe = t);
    }
    function pm(t) {
      t.tag === 22 ? (I(Kt, Kt.current), I(De, t), Xe === null && (Xe = t)) : ei();
    }
    function ei() {
      I(Kt, Kt.current), I(De, De.current);
    }
    function Oe(t) {
      B(De), Xe === t && (Xe = null), B(Kt);
    }
    var Kt = E(0);
    function Xl(t) {
      for (var e = t; e !== null; ) {
        if (e.tag === 13) {
          var a = e.memoizedState;
          if (a !== null && (a = a.dehydrated, a === null || ju(a) || zu(a))) return e;
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
    var Dn = 0, bt = null, zt = null, Ft = null, Kl = false, wa = false, Ui = false, Zl = 0, Ms = 0, Aa = null, gS = 0;
    function Yt() {
      throw Error(o(321));
    }
    function Mc(t, e) {
      if (e === null) return false;
      for (var a = 0; a < e.length && a < t.length; a++) if (!Me(t[a], e[a])) return false;
      return true;
    }
    function Rc(t, e, a, s, r, u) {
      return Dn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, V.H = t === null || t.memoizedState === null ? Wm : qc, Ui = false, u = a(s, r), Ui = false, wa && (u = gm(e, a, s, r)), ym(t), u;
    }
    function ym(t) {
      V.H = Os;
      var e = zt !== null && zt.next !== null;
      if (Dn = 0, Ft = zt = bt = null, Kl = false, Ms = 0, Aa = null, e) throw Error(o(300));
      t === null || Jt || (t = t.dependencies, t !== null && Ll(t) && (Jt = true));
    }
    function gm(t, e, a, s) {
      bt = t;
      var r = 0;
      do {
        if (wa && (Aa = null), Ms = 0, wa = false, 25 <= r) throw Error(o(301));
        if (r += 1, Ft = zt = null, t.updateQueue != null) {
          var u = t.updateQueue;
          u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
        }
        V.H = Im, u = e(a, s);
      } while (wa);
      return u;
    }
    function vS() {
      var t = V.H, e = t.useState()[0];
      return e = typeof e.then == "function" ? Rs(e) : e, t = t.useState()[0], (zt !== null ? zt.memoizedState : null) !== t && (bt.flags |= 1024), e;
    }
    function Dc() {
      var t = Zl !== 0;
      return Zl = 0, t;
    }
    function Oc(t, e, a) {
      e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
    }
    function Nc(t) {
      if (Kl) {
        for (t = t.memoizedState; t !== null; ) {
          var e = t.queue;
          e !== null && (e.pending = null), t = t.next;
        }
        Kl = false;
      }
      Dn = 0, Ft = zt = bt = null, wa = false, Ms = Zl = 0, Aa = null;
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
    function Ql() {
      return {
        lastEffect: null,
        events: null,
        stores: null,
        memoCache: null
      };
    }
    function Rs(t) {
      var e = Ms;
      return Ms += 1, Aa === null && (Aa = []), t = om(Aa, t, e), e = bt, (Ft === null ? e.memoizedState : Ft.next) === null && (e = e.alternate, V.H = e === null || e.memoizedState === null ? Wm : qc), t;
    }
    function Fl(t) {
      if (t !== null && typeof t == "object") {
        if (typeof t.then == "function") return Rs(t);
        if (t.$$typeof === z) return le(t);
      }
      throw Error(o(438, String(t)));
    }
    function jc(t) {
      var e = null, a = bt.updateQueue;
      if (a !== null && (e = a.memoCache), e == null) {
        var s = bt.alternate;
        s !== null && (s = s.updateQueue, s !== null && (s = s.memoCache, s != null && (e = {
          data: s.data.map(function(r) {
            return r.slice();
          }),
          index: 0
        })));
      }
      if (e == null && (e = {
        data: [],
        index: 0
      }), a === null && (a = Ql(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0) for (a = e.data[e.index] = Array(t), s = 0; s < t; s++) a[s] = W;
      return e.index++, a;
    }
    function On(t, e) {
      return typeof e == "function" ? e(t) : e;
    }
    function Jl(t) {
      var e = Zt();
      return zc(e, zt, t);
    }
    function zc(t, e, a) {
      var s = t.queue;
      if (s === null) throw Error(o(311));
      s.lastRenderedReducer = a;
      var r = t.baseQueue, u = s.pending;
      if (u !== null) {
        if (r !== null) {
          var g = r.next;
          r.next = u.next, u.next = g;
        }
        e.baseQueue = r = u, s.pending = null;
      }
      if (u = t.baseState, r === null) t.memoizedState = u;
      else {
        e = r.next;
        var x = g = null, M = null, H = e, X = false;
        do {
          var F = H.lane & -536870913;
          if (F !== H.lane ? (At & F) === F : (Dn & F) === F) {
            var G = H.revertLane;
            if (G === 0) M !== null && (M = M.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: H.action,
              hasEagerState: H.hasEagerState,
              eagerState: H.eagerState,
              next: null
            }), F === va && (X = true);
            else if ((Dn & G) === G) {
              H = H.next, G === va && (X = true);
              continue;
            } else F = {
              lane: 0,
              revertLane: H.revertLane,
              gesture: null,
              action: H.action,
              hasEagerState: H.hasEagerState,
              eagerState: H.eagerState,
              next: null
            }, M === null ? (x = M = F, g = u) : M = M.next = F, bt.lanes |= G, ai |= G;
            F = H.action, Ui && a(u, F), u = H.hasEagerState ? H.eagerState : a(u, F);
          } else G = {
            lane: F,
            revertLane: H.revertLane,
            gesture: H.gesture,
            action: H.action,
            hasEagerState: H.hasEagerState,
            eagerState: H.eagerState,
            next: null
          }, M === null ? (x = M = G, g = u) : M = M.next = G, bt.lanes |= F, ai |= F;
          H = H.next;
        } while (H !== null && H !== e);
        if (M === null ? g = u : M.next = x, !Me(u, t.memoizedState) && (Jt = true, X && (a = ba, a !== null))) throw a;
        t.memoizedState = u, t.baseState = g, t.baseQueue = M, s.lastRenderedState = u;
      }
      return r === null && (s.lanes = 0), [
        t.memoizedState,
        s.dispatch
      ];
    }
    function _c(t) {
      var e = Zt(), a = e.queue;
      if (a === null) throw Error(o(311));
      a.lastRenderedReducer = t;
      var s = a.dispatch, r = a.pending, u = e.memoizedState;
      if (r !== null) {
        a.pending = null;
        var g = r = r.next;
        do
          u = t(u, g.action), g = g.next;
        while (g !== r);
        Me(u, e.memoizedState) || (Jt = true), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
      }
      return [
        u,
        s
      ];
    }
    function vm(t, e, a) {
      var s = bt, r = Zt(), u = Ct;
      if (u) {
        if (a === void 0) throw Error(o(407));
        a = a();
      } else a = e();
      var g = !Me((zt || r).memoizedState, a);
      if (g && (r.memoizedState = a, Jt = true), r = r.queue, Lc(Sm.bind(null, s, r, t), [
        t
      ]), r.getSnapshot !== e || g || Ft !== null && Ft.memoizedState.tag & 1) {
        if (s.flags |= 2048, Ea(9, {
          destroy: void 0
        }, xm.bind(null, s, r, a, e), null), kt === null) throw Error(o(349));
        u || (Dn & 127) !== 0 || bm(s, e, a);
      }
      return a;
    }
    function bm(t, e, a) {
      t.flags |= 16384, t = {
        getSnapshot: e,
        value: a
      }, e = bt.updateQueue, e === null ? (e = Ql(), bt.updateQueue = e, e.stores = [
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
    function Vc(t) {
      var e = de();
      if (typeof t == "function") {
        var a = t;
        if (t = a(), Ui) {
          Pn(true);
          try {
            a();
          } finally {
            Pn(false);
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
      return t.baseState = a, zc(t, zt, typeof s == "function" ? s : On);
    }
    function bS(t, e, a, s, r) {
      if (Il(t)) throw Error(o(485));
      if (t = e.action, t !== null) {
        var u = {
          payload: r,
          action: t,
          next: null,
          isTransition: true,
          status: "pending",
          value: null,
          reason: null,
          listeners: [],
          then: function(g) {
            u.listeners.push(g);
          }
        };
        V.T !== null ? a(true) : u.isTransition = false, s(u), a = e.pending, a === null ? (u.next = e.pending = u, Em(e, u)) : (u.next = a.next, e.pending = a.next = u);
      }
    }
    function Em(t, e) {
      var a = e.action, s = e.payload, r = t.state;
      if (e.isTransition) {
        var u = V.T, g = {};
        V.T = g;
        try {
          var x = a(r, s), M = V.S;
          M !== null && M(g, x), Cm(t, e, x);
        } catch (H) {
          kc(t, e, H);
        } finally {
          u !== null && g.types !== null && (u.types = g.types), V.T = u;
        }
      } else try {
        u = a(r, s), Cm(t, e, u);
      } catch (H) {
        kc(t, e, H);
      }
    }
    function Cm(t, e, a) {
      a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(function(s) {
        Mm(t, e, s);
      }, function(s) {
        return kc(t, e, s);
      }) : Mm(t, e, a);
    }
    function Mm(t, e, a) {
      e.status = "fulfilled", e.value = a, Rm(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Em(t, a)));
    }
    function kc(t, e, a) {
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
                  for (var r = Bt, u = Pe; r.nodeType !== 8; ) {
                    if (!u) {
                      r = null;
                      break e;
                    }
                    if (r = Ke(r.nextSibling), r === null) {
                      r = null;
                      break e;
                    }
                  }
                  u = r.data, r = u === "F!" || u === "F" ? r : null;
                }
                if (r) {
                  Bt = Ke(r.nextSibling), s = r.data === "F!";
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
      }, a.queue = s, a = Fm.bind(null, bt, s), s.dispatch = a, s = Vc(false), u = Yc.bind(null, bt, false, s.queue), s = de(), r = {
        state: e,
        dispatch: null,
        action: t,
        pending: null
      }, s.queue = r, a = bS.bind(null, bt, r, u, a), r.dispatch = a, s.memoizedState = t, [
        e,
        a,
        false
      ];
    }
    function Nm(t) {
      var e = Zt();
      return jm(e, zt, t);
    }
    function jm(t, e, a) {
      if (e = zc(t, e, Dm)[0], t = Jl(On)[0], typeof e == "object" && e !== null && typeof e.then == "function") try {
        var s = Rs(e);
      } catch (g) {
        throw g === xa ? Hl : g;
      }
      else s = e;
      e = Zt();
      var r = e.queue, u = r.dispatch;
      return a !== e.memoizedState && (bt.flags |= 2048, Ea(9, {
        destroy: void 0
      }, xS.bind(null, r, a), null)), [
        s,
        u,
        t
      ];
    }
    function xS(t, e) {
      t.action = e;
    }
    function zm(t) {
      var e = Zt(), a = zt;
      if (a !== null) return jm(e, a, t);
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
      }, e = bt.updateQueue, e === null && (e = Ql(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (s = a.next, a.next = t, t.next = s, e.lastEffect = t), t;
    }
    function _m() {
      return Zt().memoizedState;
    }
    function $l(t, e, a, s) {
      var r = de();
      bt.flags |= t, r.memoizedState = Ea(1 | e, {
        destroy: void 0
      }, a, s === void 0 ? null : s);
    }
    function Wl(t, e, a, s) {
      var r = Zt();
      s = s === void 0 ? null : s;
      var u = r.memoizedState.inst;
      zt !== null && s !== null && Mc(s, zt.memoizedState.deps) ? r.memoizedState = Ea(e, u, a, s) : (bt.flags |= t, r.memoizedState = Ea(1 | e, u, a, s));
    }
    function Vm(t, e) {
      $l(8390656, 8, t, e);
    }
    function Lc(t, e) {
      Wl(2048, 8, t, e);
    }
    function SS(t) {
      bt.flags |= 4;
      var e = bt.updateQueue;
      if (e === null) e = Ql(), bt.updateQueue = e, e.events = [
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
      return SS({
        ref: e,
        nextImpl: t
      }), function() {
        if ((Dt & 2) !== 0) throw Error(o(440));
        return e.impl.apply(void 0, arguments);
      };
    }
    function Lm(t, e) {
      return Wl(4, 2, t, e);
    }
    function Bm(t, e) {
      return Wl(4, 4, t, e);
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
      ]) : null, Wl(4, 4, Um.bind(null, e, t), a);
    }
    function Bc() {
    }
    function Gm(t, e) {
      var a = Zt();
      e = e === void 0 ? null : e;
      var s = a.memoizedState;
      return e !== null && Mc(e, s[1]) ? s[0] : (a.memoizedState = [
        t,
        e
      ], t);
    }
    function Ym(t, e) {
      var a = Zt();
      e = e === void 0 ? null : e;
      var s = a.memoizedState;
      if (e !== null && Mc(e, s[1])) return s[0];
      if (s = t(), Ui) {
        Pn(true);
        try {
          t();
        } finally {
          Pn(false);
        }
      }
      return a.memoizedState = [
        s,
        e
      ], s;
    }
    function Uc(t, e, a) {
      return a === void 0 || (Dn & 1073741824) !== 0 && (At & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = qp(), bt.lanes |= t, ai |= t, a);
    }
    function qm(t, e, a, s) {
      return Me(a, e) ? a : Ta.current !== null ? (t = Uc(t, a, s), Me(t, e) || (Jt = true), t) : (Dn & 42) === 0 || (Dn & 1073741824) !== 0 && (At & 261930) === 0 ? (Jt = true, t.memoizedState = a) : (t = qp(), bt.lanes |= t, ai |= t, e);
    }
    function Pm(t, e, a, s, r) {
      var u = N.p;
      N.p = u !== 0 && 8 > u ? u : 8;
      var g = V.T, x = {};
      V.T = x, Yc(t, false, e, a);
      try {
        var M = r(), H = V.S;
        if (H !== null && H(x, M), M !== null && typeof M == "object" && typeof M.then == "function") {
          var X = yS(M, s);
          Ds(t, e, X, ze(t));
        } else Ds(t, e, s, ze(t));
      } catch (F) {
        Ds(t, e, {
          then: function() {
          },
          status: "rejected",
          reason: F
        }, ze());
      } finally {
        N.p = u, g !== null && x.types !== null && (g.types = x.types), V.T = g;
      }
    }
    function TS() {
    }
    function Hc(t, e, a, s) {
      if (t.tag !== 5) throw Error(o(476));
      var r = Xm(t).queue;
      Pm(t, r, e, k, a === null ? TS : function() {
        return Km(t), a(s);
      });
    }
    function Xm(t) {
      var e = t.memoizedState;
      if (e !== null) return e;
      e = {
        memoizedState: k,
        baseState: k,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: On,
          lastRenderedState: k
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
      e.next === null && (e = t.alternate.memoizedState), Ds(t, e.next.queue, {}, ze());
    }
    function Gc() {
      return le(Ks);
    }
    function Zm() {
      return Zt().memoizedState;
    }
    function Qm() {
      return Zt().memoizedState;
    }
    function wS(t) {
      for (var e = t.return; e !== null; ) {
        switch (e.tag) {
          case 24:
          case 3:
            var a = ze();
            t = Wn(a);
            var s = In(e, t, a);
            s !== null && (we(s, e, a), As(s, e, a)), e = {
              cache: yc()
            }, t.payload = e;
            return;
        }
        e = e.return;
      }
    }
    function AS(t, e, a) {
      var s = ze();
      a = {
        lane: s,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, Il(t) ? Jm(e, a) : (a = sc(t, e, a, s), a !== null && (we(a, t, s), $m(a, e, s)));
    }
    function Fm(t, e, a) {
      var s = ze();
      Ds(t, e, a, s);
    }
    function Ds(t, e, a, s) {
      var r = {
        lane: s,
        revertLane: 0,
        gesture: null,
        action: a,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (Il(t)) Jm(e, r);
      else {
        var u = t.alternate;
        if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null)) try {
          var g = e.lastRenderedState, x = u(g, a);
          if (r.hasEagerState = true, r.eagerState = x, Me(x, g)) return zl(t, e, r, 0), kt === null && jl(), false;
        } catch {
        } finally {
        }
        if (a = sc(t, e, r, s), a !== null) return we(a, t, s), $m(a, e, s), true;
      }
      return false;
    }
    function Yc(t, e, a, s) {
      if (s = {
        lane: 2,
        revertLane: xu(),
        gesture: null,
        action: s,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, Il(t)) {
        if (e) throw Error(o(479));
      } else e = sc(t, a, s, 2), e !== null && we(e, t, 2);
    }
    function Il(t) {
      var e = t.alternate;
      return t === bt || e !== null && e === bt;
    }
    function Jm(t, e) {
      wa = Kl = true;
      var a = t.pending;
      a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
    }
    function $m(t, e, a) {
      if ((a & 4194048) !== 0) {
        var s = e.lanes;
        s &= t.pendingLanes, a |= s, e.lanes = a, nh(t, a);
      }
    }
    var Os = {
      readContext: le,
      use: Fl,
      useCallback: Yt,
      useContext: Yt,
      useEffect: Yt,
      useImperativeHandle: Yt,
      useLayoutEffect: Yt,
      useInsertionEffect: Yt,
      useMemo: Yt,
      useReducer: Yt,
      useRef: Yt,
      useState: Yt,
      useDebugValue: Yt,
      useDeferredValue: Yt,
      useTransition: Yt,
      useSyncExternalStore: Yt,
      useId: Yt,
      useHostTransitionStatus: Yt,
      useFormState: Yt,
      useActionState: Yt,
      useOptimistic: Yt,
      useMemoCache: Yt,
      useCacheRefresh: Yt
    };
    Os.useEffectEvent = Yt;
    var Wm = {
      readContext: le,
      use: Fl,
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
        ]) : null, $l(4194308, 4, Um.bind(null, e, t), a);
      },
      useLayoutEffect: function(t, e) {
        return $l(4194308, 4, t, e);
      },
      useInsertionEffect: function(t, e) {
        $l(4, 2, t, e);
      },
      useMemo: function(t, e) {
        var a = de();
        e = e === void 0 ? null : e;
        var s = t();
        if (Ui) {
          Pn(true);
          try {
            t();
          } finally {
            Pn(false);
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
          var r = a(e);
          if (Ui) {
            Pn(true);
            try {
              a(e);
            } finally {
              Pn(false);
            }
          }
        } else r = e;
        return s.memoizedState = s.baseState = r, t = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: t,
          lastRenderedState: r
        }, s.queue = t, t = t.dispatch = AS.bind(null, bt, t), [
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
        t = Vc(t);
        var e = t.queue, a = Fm.bind(null, bt, e);
        return e.dispatch = a, [
          t.memoizedState,
          a
        ];
      },
      useDebugValue: Bc,
      useDeferredValue: function(t, e) {
        var a = de();
        return Uc(a, t, e);
      },
      useTransition: function() {
        var t = Vc(false);
        return t = Pm.bind(null, bt, t.queue, true, false), de().memoizedState = t, [
          false,
          t
        ];
      },
      useSyncExternalStore: function(t, e, a) {
        var s = bt, r = de();
        if (Ct) {
          if (a === void 0) throw Error(o(407));
          a = a();
        } else {
          if (a = e(), kt === null) throw Error(o(349));
          (At & 127) !== 0 || bm(s, e, a);
        }
        r.memoizedState = a;
        var u = {
          value: a,
          getSnapshot: e
        };
        return r.queue = u, Vm(Sm.bind(null, s, u, t), [
          t
        ]), s.flags |= 2048, Ea(9, {
          destroy: void 0
        }, xm.bind(null, s, u, a, e), null), a;
      },
      useId: function() {
        var t = de(), e = kt.identifierPrefix;
        if (Ct) {
          var a = dn, s = fn;
          a = (s & ~(1 << 32 - Ce(s) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = Zl++, 0 < a && (e += "H" + a.toString(32)), e += "_";
        } else a = gS++, e = "_" + e + "r_" + a.toString(32) + "_";
        return t.memoizedState = e;
      },
      useHostTransitionStatus: Gc,
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
        return e.queue = a, e = Yc.bind(null, bt, true, a), a.dispatch = e, [
          t,
          e
        ];
      },
      useMemoCache: jc,
      useCacheRefresh: function() {
        return de().memoizedState = wS.bind(null, bt);
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
      use: Fl,
      useCallback: Gm,
      useContext: le,
      useEffect: Lc,
      useImperativeHandle: Hm,
      useInsertionEffect: Lm,
      useLayoutEffect: Bm,
      useMemo: Ym,
      useReducer: Jl,
      useRef: _m,
      useState: function() {
        return Jl(On);
      },
      useDebugValue: Bc,
      useDeferredValue: function(t, e) {
        var a = Zt();
        return qm(a, zt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = Jl(On)[0], e = Zt().memoizedState;
        return [
          typeof t == "boolean" ? t : Rs(t),
          e
        ];
      },
      useSyncExternalStore: vm,
      useId: Zm,
      useHostTransitionStatus: Gc,
      useFormState: Nm,
      useActionState: Nm,
      useOptimistic: function(t, e) {
        var a = Zt();
        return Am(a, zt, t, e);
      },
      useMemoCache: jc,
      useCacheRefresh: Qm
    };
    qc.useEffectEvent = km;
    var Im = {
      readContext: le,
      use: Fl,
      useCallback: Gm,
      useContext: le,
      useEffect: Lc,
      useImperativeHandle: Hm,
      useInsertionEffect: Lm,
      useLayoutEffect: Bm,
      useMemo: Ym,
      useReducer: _c,
      useRef: _m,
      useState: function() {
        return _c(On);
      },
      useDebugValue: Bc,
      useDeferredValue: function(t, e) {
        var a = Zt();
        return zt === null ? Uc(a, t, e) : qm(a, zt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = _c(On)[0], e = Zt().memoizedState;
        return [
          typeof t == "boolean" ? t : Rs(t),
          e
        ];
      },
      useSyncExternalStore: vm,
      useId: Zm,
      useHostTransitionStatus: Gc,
      useFormState: zm,
      useActionState: zm,
      useOptimistic: function(t, e) {
        var a = Zt();
        return zt !== null ? Am(a, zt, t, e) : (a.baseState = t, [
          t,
          a.queue.dispatch
        ]);
      },
      useMemoCache: jc,
      useCacheRefresh: Qm
    };
    Im.useEffectEvent = km;
    function Pc(t, e, a, s) {
      e = t.memoizedState, a = a(s, e), a = a == null ? e : v({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
    }
    var Xc = {
      enqueueSetState: function(t, e, a) {
        t = t._reactInternals;
        var s = ze(), r = Wn(s);
        r.payload = e, a != null && (r.callback = a), e = In(t, r, s), e !== null && (we(e, t, s), As(e, t, s));
      },
      enqueueReplaceState: function(t, e, a) {
        t = t._reactInternals;
        var s = ze(), r = Wn(s);
        r.tag = 1, r.payload = e, a != null && (r.callback = a), e = In(t, r, s), e !== null && (we(e, t, s), As(e, t, s));
      },
      enqueueForceUpdate: function(t, e) {
        t = t._reactInternals;
        var a = ze(), s = Wn(a);
        s.tag = 2, e != null && (s.callback = e), e = In(t, s, a), e !== null && (we(e, t, a), As(e, t, a));
      }
    };
    function tp(t, e, a, s, r, u, g) {
      return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(s, u, g) : e.prototype && e.prototype.isPureReactComponent ? !ys(a, s) || !ys(r, u) : true;
    }
    function ep(t, e, a, s) {
      t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, s), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, s), e.state !== t && Xc.enqueueReplaceState(e, e.state, null);
    }
    function Hi(t, e) {
      var a = e;
      if ("ref" in e) {
        a = {};
        for (var s in e) s !== "ref" && (a[s] = e[s]);
      }
      if (t = t.defaultProps) {
        a === e && (a = v({}, a));
        for (var r in t) a[r] === void 0 && (a[r] = t[r]);
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
    function to(t, e) {
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
      } catch (r) {
        setTimeout(function() {
          throw r;
        });
      }
    }
    function Kc(t, e, a) {
      return a = Wn(a), a.tag = 3, a.payload = {
        element: null
      }, a.callback = function() {
        to(t, e);
      }, a;
    }
    function lp(t) {
      return t = Wn(t), t.tag = 3, t;
    }
    function op(t, e, a, s) {
      var r = a.type.getDerivedStateFromError;
      if (typeof r == "function") {
        var u = s.value;
        t.payload = function() {
          return r(u);
        }, t.callback = function() {
          sp(e, a, s);
        };
      }
      var g = a.stateNode;
      g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
        sp(e, a, s), typeof r != "function" && (si === null ? si = /* @__PURE__ */ new Set([
          this
        ]) : si.add(this));
        var x = s.stack;
        this.componentDidCatch(s.value, {
          componentStack: x !== null ? x : ""
        });
      });
    }
    function ES(t, e, a, s, r) {
      if (a.flags |= 32768, s !== null && typeof s == "object" && typeof s.then == "function") {
        if (e = a.alternate, e !== null && ga(e, a, r, true), a = De.current, a !== null) {
          switch (a.tag) {
            case 31:
            case 13:
              return Xe === null ? ho() : a.alternate === null && qt === 0 && (qt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, s === Gl ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([
                s
              ]) : e.add(s), gu(t, s, r)), false;
            case 22:
              return a.flags |= 65536, s === Gl ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([
                  s
                ])
              }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([
                s
              ]) : a.add(s)), gu(t, s, r)), false;
          }
          throw Error(o(435, a.tag));
        }
        return gu(t, s, r), ho(), false;
      }
      if (Ct) return e = De.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, s !== fc && (t = Error(o(422), {
        cause: s
      }), bs(Ge(t, a)))) : (s !== fc && (e = Error(o(423), {
        cause: s
      }), bs(Ge(e, a))), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, s = Ge(s, a), r = Kc(t.stateNode, s, r), Tc(t, r), qt !== 4 && (qt = 2)), false;
      var u = Error(o(520), {
        cause: s
      });
      if (u = Ge(u, a), Bs === null ? Bs = [
        u
      ] : Bs.push(u), qt !== 4 && (qt = 2), e === null) return true;
      s = Ge(s, a), a = e;
      do {
        switch (a.tag) {
          case 3:
            return a.flags |= 65536, t = r & -r, a.lanes |= t, t = Kc(a.stateNode, s, t), Tc(a, t), false;
          case 1:
            if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (si === null || !si.has(u)))) return a.flags |= 65536, r &= -r, a.lanes |= r, r = lp(r), op(r, t, a, s), Tc(a, r), false;
        }
        a = a.return;
      } while (a !== null);
      return false;
    }
    var Zc = Error(o(461)), Jt = false;
    function oe(t, e, a, s) {
      e.child = t === null ? fm(e, null, a, s) : Bi(e, t.child, a, s);
    }
    function rp(t, e, a, s, r) {
      a = a.render;
      var u = e.ref;
      if ("ref" in s) {
        var g = {};
        for (var x in s) x !== "ref" && (g[x] = s[x]);
      } else g = s;
      return _i(e), s = Rc(t, e, a, g, u, r), x = Dc(), t !== null && !Jt ? (Oc(t, e, r), Nn(t, e, r)) : (Ct && x && cc(e), e.flags |= 1, oe(t, e, s, r), e.child);
    }
    function cp(t, e, a, s, r) {
      if (t === null) {
        var u = a.type;
        return typeof u == "function" && !lc(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, up(t, e, u, s, r)) : (t = Vl(a.type, null, s, e, e.mode, r), t.ref = e.ref, t.return = e, e.child = t);
      }
      if (u = t.child, !eu(t, r)) {
        var g = u.memoizedProps;
        if (a = a.compare, a = a !== null ? a : ys, a(g, s) && t.ref === e.ref) return Nn(t, e, r);
      }
      return e.flags |= 1, t = En(u, s), t.ref = e.ref, t.return = e, e.child = t;
    }
    function up(t, e, a, s, r) {
      if (t !== null) {
        var u = t.memoizedProps;
        if (ys(u, s) && t.ref === e.ref) if (Jt = false, e.pendingProps = s = u, eu(t, r)) (t.flags & 131072) !== 0 && (Jt = true);
        else return e.lanes = t.lanes, Nn(t, e, r);
      }
      return Qc(t, e, a, s, r);
    }
    function fp(t, e, a, s) {
      var r = s.children, u = t !== null ? t.memoizedState : null;
      if (t === null && e.stateNode === null && (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), s.mode === "hidden") {
        if ((e.flags & 128) !== 0) {
          if (u = u !== null ? u.baseLanes | a : a, t !== null) {
            for (s = e.child = t.child, r = 0; s !== null; ) r = r | s.lanes | s.childLanes, s = s.sibling;
            s = r & ~u;
          } else s = 0, e.child = null;
          return dp(t, e, u, a, s);
        }
        if ((a & 536870912) !== 0) e.memoizedState = {
          baseLanes: 0,
          cachePool: null
        }, t !== null && Ul(e, u !== null ? u.cachePool : null), u !== null ? mm(e, u) : Ac(), pm(e);
        else return s = e.lanes = 536870912, dp(t, e, u !== null ? u.baseLanes | a : a, a, s);
      } else u !== null ? (Ul(e, u.cachePool), mm(e, u), ei(), e.memoizedState = null) : (t !== null && Ul(e, null), Ac(), ei());
      return oe(t, e, r, a), e.child;
    }
    function Ns(t, e) {
      return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), e.sibling;
    }
    function dp(t, e, a, s, r) {
      var u = vc();
      return u = u === null ? null : {
        parent: Qt._currentValue,
        pool: u
      }, e.memoizedState = {
        baseLanes: a,
        cachePool: u
      }, t !== null && Ul(e, null), Ac(), pm(e), t !== null && ga(t, e, s, true), e.childLanes = r, null;
    }
    function eo(t, e) {
      return e = io({
        mode: e.mode,
        children: e.children
      }, t.mode), e.ref = t.ref, t.child = e, e.return = t, e;
    }
    function hp(t, e, a) {
      return Bi(e, t.child, null, a), t = eo(e, e.pendingProps), t.flags |= 2, Oe(e), e.memoizedState = null, t;
    }
    function CS(t, e, a) {
      var s = e.pendingProps, r = (e.flags & 128) !== 0;
      if (e.flags &= -129, t === null) {
        if (Ct) {
          if (s.mode === "hidden") return t = eo(e, s), e.lanes = 536870912, Ns(null, t);
          if (Cc(e), (t = Bt) ? (t = Ey(t, Pe), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
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
        return eo(e, s);
      }
      var u = t.memoizedState;
      if (u !== null) {
        var g = u.dehydrated;
        if (Cc(e), r) if (e.flags & 256) e.flags &= -257, e = hp(t, e, a);
        else if (e.memoizedState !== null) e.child = t.child, e.flags |= 128, e = null;
        else throw Error(o(558));
        else if (Jt || ga(t, e, a, false), r = (a & t.childLanes) !== 0, Jt || r) {
          if (s = kt, s !== null && (g = ih(s, a), g !== 0 && g !== u.retryLane)) throw u.retryLane = g, Oi(t, g), we(s, t, g), Zc;
          ho(), e = hp(t, e, a);
        } else t = u.treeContext, Bt = Ke(g.nextSibling), se = e, Ct = true, Qn = null, Pe = false, t !== null && Ih(e, t), e = eo(e, s), e.flags |= 4096;
        return e;
      }
      return t = En(t.child, {
        mode: s.mode,
        children: s.children
      }), t.ref = e.ref, e.child = t, t.return = e, t;
    }
    function no(t, e) {
      var a = e.ref;
      if (a === null) t !== null && t.ref !== null && (e.flags |= 4194816);
      else {
        if (typeof a != "function" && typeof a != "object") throw Error(o(284));
        (t === null || t.ref !== a) && (e.flags |= 4194816);
      }
    }
    function Qc(t, e, a, s, r) {
      return _i(e), a = Rc(t, e, a, s, void 0, r), s = Dc(), t !== null && !Jt ? (Oc(t, e, r), Nn(t, e, r)) : (Ct && s && cc(e), e.flags |= 1, oe(t, e, a, r), e.child);
    }
    function mp(t, e, a, s, r, u) {
      return _i(e), e.updateQueue = null, a = gm(e, s, a, r), ym(t), s = Dc(), t !== null && !Jt ? (Oc(t, e, u), Nn(t, e, u)) : (Ct && s && cc(e), e.flags |= 1, oe(t, e, a, u), e.child);
    }
    function pp(t, e, a, s, r) {
      if (_i(e), e.stateNode === null) {
        var u = ha, g = a.contextType;
        typeof g == "object" && g !== null && (u = le(g)), u = new a(s, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Xc, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = s, u.state = e.memoizedState, u.refs = {}, xc(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? le(g) : ha, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Pc(e, a, g, s), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Xc.enqueueReplaceState(u, u.state, null), Cs(e, s, u, r), Es(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), s = true;
      } else if (t === null) {
        u = e.stateNode;
        var x = e.memoizedProps, M = Hi(a, x);
        u.props = M;
        var H = u.context, X = a.contextType;
        g = ha, typeof X == "object" && X !== null && (g = le(X));
        var F = a.getDerivedStateFromProps;
        X = typeof F == "function" || typeof u.getSnapshotBeforeUpdate == "function", x = e.pendingProps !== x, X || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (x || H !== g) && ep(e, u, s, g), $n = false;
        var G = e.memoizedState;
        u.state = G, Cs(e, s, u, r), Es(), H = e.memoizedState, x || G !== H || $n ? (typeof F == "function" && (Pc(e, a, F, s), H = e.memoizedState), (M = $n || tp(e, a, M, s, G, H, g)) ? (X || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = s, e.memoizedState = H), u.props = s, u.state = H, u.context = g, s = M) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), s = false);
      } else {
        u = e.stateNode, Sc(t, e), g = e.memoizedProps, X = Hi(a, g), u.props = X, F = e.pendingProps, G = u.context, H = a.contextType, M = ha, typeof H == "object" && H !== null && (M = le(H)), x = a.getDerivedStateFromProps, (H = typeof x == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== F || G !== M) && ep(e, u, s, M), $n = false, G = e.memoizedState, u.state = G, Cs(e, s, u, r), Es();
        var q = e.memoizedState;
        g !== F || G !== q || $n || t !== null && t.dependencies !== null && Ll(t.dependencies) ? (typeof x == "function" && (Pc(e, a, x, s), q = e.memoizedState), (X = $n || tp(e, a, X, s, G, q, M) || t !== null && t.dependencies !== null && Ll(t.dependencies)) ? (H || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(s, q, M), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(s, q, M)), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && G === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && G === t.memoizedState || (e.flags |= 1024), e.memoizedProps = s, e.memoizedState = q), u.props = s, u.state = q, u.context = M, s = X) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && G === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && G === t.memoizedState || (e.flags |= 1024), s = false);
      }
      return u = s, no(t, e), s = (e.flags & 128) !== 0, u || s ? (u = e.stateNode, a = s && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && s ? (e.child = Bi(e, t.child, null, r), e.child = Bi(e, null, a, r)) : oe(t, e, a, r), e.memoizedState = u.state, t = e.child) : t = Nn(t, e, r), t;
    }
    function yp(t, e, a, s) {
      return ji(), e.flags |= 256, oe(t, e, a, s), e.child;
    }
    var Fc = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    };
    function Jc(t) {
      return {
        baseLanes: t,
        cachePool: sm()
      };
    }
    function $c(t, e, a) {
      return t = t !== null ? t.childLanes & ~a : 0, e && (t |= je), t;
    }
    function gp(t, e, a) {
      var s = e.pendingProps, r = false, u = (e.flags & 128) !== 0, g;
      if ((g = u) || (g = t !== null && t.memoizedState === null ? false : (Kt.current & 2) !== 0), g && (r = true, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
        if (Ct) {
          if (r ? ti(e) : ei(), (t = Bt) ? (t = Ey(t, Pe), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
            dehydrated: t,
            treeContext: Zn !== null ? {
              id: fn,
              overflow: dn
            } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, a = Jh(t), a.return = e, e.child = a, se = e, Bt = null)) : t = null, t === null) throw Fn(e);
          return zu(t) ? e.lanes = 32 : e.lanes = 536870912, null;
        }
        var x = s.children;
        return s = s.fallback, r ? (ei(), r = e.mode, x = io({
          mode: "hidden",
          children: x
        }, r), s = Ni(s, r, a, null), x.return = e, s.return = e, x.sibling = s, e.child = x, s = e.child, s.memoizedState = Jc(a), s.childLanes = $c(t, g, a), e.memoizedState = Fc, Ns(null, s)) : (ti(e), Wc(e, x));
      }
      var M = t.memoizedState;
      if (M !== null && (x = M.dehydrated, x !== null)) {
        if (u) e.flags & 256 ? (ti(e), e.flags &= -257, e = Ic(t, e, a)) : e.memoizedState !== null ? (ei(), e.child = t.child, e.flags |= 128, e = null) : (ei(), x = s.fallback, r = e.mode, s = io({
          mode: "visible",
          children: s.children
        }, r), x = Ni(x, r, a, null), x.flags |= 2, s.return = e, x.return = e, s.sibling = x, e.child = s, Bi(e, t.child, null, a), s = e.child, s.memoizedState = Jc(a), s.childLanes = $c(t, g, a), e.memoizedState = Fc, e = Ns(null, s));
        else if (ti(e), zu(x)) {
          if (g = x.nextSibling && x.nextSibling.dataset, g) var H = g.dgst;
          g = H, s = Error(o(419)), s.stack = "", s.digest = g, bs({
            value: s,
            source: null,
            stack: null
          }), e = Ic(t, e, a);
        } else if (Jt || ga(t, e, a, false), g = (a & t.childLanes) !== 0, Jt || g) {
          if (g = kt, g !== null && (s = ih(g, a), s !== 0 && s !== M.retryLane)) throw M.retryLane = s, Oi(t, s), we(g, t, s), Zc;
          ju(x) || ho(), e = Ic(t, e, a);
        } else ju(x) ? (e.flags |= 192, e.child = t.child, e = null) : (t = M.treeContext, Bt = Ke(x.nextSibling), se = e, Ct = true, Qn = null, Pe = false, t !== null && Ih(e, t), e = Wc(e, s.children), e.flags |= 4096);
        return e;
      }
      return r ? (ei(), x = s.fallback, r = e.mode, M = t.child, H = M.sibling, s = En(M, {
        mode: "hidden",
        children: s.children
      }), s.subtreeFlags = M.subtreeFlags & 65011712, H !== null ? x = En(H, x) : (x = Ni(x, r, a, null), x.flags |= 2), x.return = e, s.return = e, s.sibling = x, e.child = s, Ns(null, s), s = e.child, x = t.child.memoizedState, x === null ? x = Jc(a) : (r = x.cachePool, r !== null ? (M = Qt._currentValue, r = r.parent !== M ? {
        parent: M,
        pool: M
      } : r) : r = sm(), x = {
        baseLanes: x.baseLanes | a,
        cachePool: r
      }), s.memoizedState = x, s.childLanes = $c(t, g, a), e.memoizedState = Fc, Ns(t.child, s)) : (ti(e), a = t.child, t = a.sibling, a = En(a, {
        mode: "visible",
        children: s.children
      }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [
        t
      ], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
    }
    function Wc(t, e) {
      return e = io({
        mode: "visible",
        children: e
      }, t.mode), e.return = t, t.child = e;
    }
    function io(t, e) {
      return t = Re(22, t, null, e), t.lanes = 0, t;
    }
    function Ic(t, e, a) {
      return Bi(e, t.child, null, a), t = Wc(e, e.pendingProps.children), t.flags |= 2, e.memoizedState = null, t;
    }
    function vp(t, e, a) {
      t.lanes |= e;
      var s = t.alternate;
      s !== null && (s.lanes |= e), mc(t.return, e, a);
    }
    function tu(t, e, a, s, r, u) {
      var g = t.memoizedState;
      g === null ? t.memoizedState = {
        isBackwards: e,
        rendering: null,
        renderingStartTime: 0,
        last: s,
        tail: a,
        tailMode: r,
        treeForkCount: u
      } : (g.isBackwards = e, g.rendering = null, g.renderingStartTime = 0, g.last = s, g.tail = a, g.tailMode = r, g.treeForkCount = u);
    }
    function bp(t, e, a) {
      var s = e.pendingProps, r = s.revealOrder, u = s.tail;
      s = s.children;
      var g = Kt.current, x = (g & 2) !== 0;
      if (x ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, I(Kt, g), oe(t, e, s, a), s = Ct ? vs : 0, !x && t !== null && (t.flags & 128) !== 0) t: for (t = e.child; t !== null; ) {
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
      switch (r) {
        case "forwards":
          for (a = e.child, r = null; a !== null; ) t = a.alternate, t !== null && Xl(t) === null && (r = a), a = a.sibling;
          a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), tu(e, false, r, a, u, s);
          break;
        case "backwards":
        case "unstable_legacy-backwards":
          for (a = null, r = e.child, e.child = null; r !== null; ) {
            if (t = r.alternate, t !== null && Xl(t) === null) {
              e.child = r;
              break;
            }
            t = r.sibling, r.sibling = a, a = r, r = t;
          }
          tu(e, true, a, null, u, s);
          break;
        case "together":
          tu(e, false, null, null, void 0, s);
          break;
        default:
          e.memoizedState = null;
      }
      return e.child;
    }
    function Nn(t, e, a) {
      if (t !== null && (e.dependencies = t.dependencies), ai |= e.lanes, (a & e.childLanes) === 0) if (t !== null) {
        if (ga(t, e, a, false), (a & e.childLanes) === 0) return null;
      } else return null;
      if (t !== null && e.child !== t.child) throw Error(o(153));
      if (e.child !== null) {
        for (t = e.child, a = En(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; ) t = t.sibling, a = a.sibling = En(t, t.pendingProps), a.return = e;
        a.sibling = null;
      }
      return e.child;
    }
    function eu(t, e) {
      return (t.lanes & e) !== 0 ? true : (t = t.dependencies, !!(t !== null && Ll(t)));
    }
    function MS(t, e, a) {
      switch (e.tag) {
        case 3:
          Xt(e, e.stateNode.containerInfo), Jn(e, Qt, t.memoizedState.cache), ji();
          break;
        case 27:
        case 5:
          cn(e);
          break;
        case 4:
          Xt(e, e.stateNode.containerInfo);
          break;
        case 10:
          Jn(e, e.type, e.memoizedProps.value);
          break;
        case 31:
          if (e.memoizedState !== null) return e.flags |= 128, Cc(e), null;
          break;
        case 13:
          var s = e.memoizedState;
          if (s !== null) return s.dehydrated !== null ? (ti(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? gp(t, e, a) : (ti(e), t = Nn(t, e, a), t !== null ? t.sibling : null);
          ti(e);
          break;
        case 19:
          var r = (t.flags & 128) !== 0;
          if (s = (a & e.childLanes) !== 0, s || (ga(t, e, a, false), s = (a & e.childLanes) !== 0), r) {
            if (s) return bp(t, e, a);
            e.flags |= 128;
          }
          if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), I(Kt, Kt.current), s) break;
          return null;
        case 22:
          return e.lanes = 0, fp(t, e, a, e.pendingProps);
        case 24:
          Jn(e, Qt, t.memoizedState.cache);
      }
      return Nn(t, e, a);
    }
    function xp(t, e, a) {
      if (t !== null) if (t.memoizedProps !== e.pendingProps) Jt = true;
      else {
        if (!eu(t, a) && (e.flags & 128) === 0) return Jt = false, MS(t, e, a);
        Jt = (t.flags & 131072) !== 0;
      }
      else Jt = false, Ct && (e.flags & 1048576) !== 0 && Wh(e, vs, e.index);
      switch (e.lanes = 0, e.tag) {
        case 16:
          t: {
            var s = e.pendingProps;
            if (t = ki(e.elementType), e.type = t, typeof t == "function") lc(t) ? (s = Hi(t, s), e.tag = 1, e = pp(null, e, t, s, a)) : (e.tag = 0, e = Qc(null, e, t, s, a));
            else {
              if (t != null) {
                var r = t.$$typeof;
                if (r === _) {
                  e.tag = 11, e = rp(null, e, t, s, a);
                  break t;
                } else if (r === Z) {
                  e.tag = 14, e = cp(null, e, t, s, a);
                  break t;
                }
              }
              throw e = dt(t) || t, Error(o(306, e, ""));
            }
          }
          return e;
        case 0:
          return Qc(t, e, e.type, e.pendingProps, a);
        case 1:
          return s = e.type, r = Hi(s, e.pendingProps), pp(t, e, s, r, a);
        case 3:
          t: {
            if (Xt(e, e.stateNode.containerInfo), t === null) throw Error(o(387));
            s = e.pendingProps;
            var u = e.memoizedState;
            r = u.element, Sc(t, e), Cs(e, s, null, a);
            var g = e.memoizedState;
            if (s = g.cache, Jn(e, Qt, s), s !== u.cache && pc(e, [
              Qt
            ], a, true), Es(), s = g.element, u.isDehydrated) if (u = {
              element: s,
              isDehydrated: false,
              cache: g.cache
            }, e.updateQueue.baseState = u, e.memoizedState = u, e.flags & 256) {
              e = yp(t, e, s, a);
              break t;
            } else if (s !== r) {
              r = Ge(Error(o(424)), e), bs(r), e = yp(t, e, s, a);
              break t;
            } else {
              switch (t = e.stateNode.containerInfo, t.nodeType) {
                case 9:
                  t = t.body;
                  break;
                default:
                  t = t.nodeName === "HTML" ? t.ownerDocument.body : t;
              }
              for (Bt = Ke(t.firstChild), se = e, Ct = true, Qn = null, Pe = true, a = fm(e, null, s, a), e.child = a; a; ) a.flags = a.flags & -3 | 4096, a = a.sibling;
            }
            else {
              if (ji(), s === r) {
                e = Nn(t, e, a);
                break t;
              }
              oe(t, e, s, a);
            }
            e = e.child;
          }
          return e;
        case 26:
          return no(t, e), t === null ? (a = Ny(e.type, null, e.pendingProps, null)) ? e.memoizedState = a : Ct || (a = e.type, t = e.pendingProps, s = xo(ut.current).createElement(a), s[ae] = e, s[ge] = t, re(s, a, t), ne(s), e.stateNode = s) : e.memoizedState = Ny(e.type, t.memoizedProps, e.pendingProps, t.memoizedState), null;
        case 27:
          return cn(e), t === null && Ct && (s = e.stateNode = Ry(e.type, e.pendingProps, ut.current), se = e, Pe = true, r = Bt, ci(e.type) ? (_u = r, Bt = Ke(s.firstChild)) : Bt = r), oe(t, e, e.pendingProps.children, a), no(t, e), t === null && (e.flags |= 4194304), e.child;
        case 5:
          return t === null && Ct && ((r = s = Bt) && (s = iT(s, e.type, e.pendingProps, Pe), s !== null ? (e.stateNode = s, se = e, Bt = Ke(s.firstChild), Pe = false, r = true) : r = false), r || Fn(e)), cn(e), r = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, s = u.children, Du(r, u) ? s = null : g !== null && Du(r, g) && (e.flags |= 32), e.memoizedState !== null && (r = Rc(t, e, vS, null, null, a), Ks._currentValue = r), no(t, e), oe(t, e, s, a), e.child;
        case 6:
          return t === null && Ct && ((t = a = Bt) && (a = aT(a, e.pendingProps, Pe), a !== null ? (e.stateNode = a, se = e, Bt = null, t = true) : t = false), t || Fn(e)), null;
        case 13:
          return gp(t, e, a);
        case 4:
          return Xt(e, e.stateNode.containerInfo), s = e.pendingProps, t === null ? e.child = Bi(e, null, s, a) : oe(t, e, s, a), e.child;
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
          return r = e.type._context, s = e.pendingProps.children, _i(e), r = le(r), s = s(r), e.flags |= 1, oe(t, e, s, a), e.child;
        case 14:
          return cp(t, e, e.type, e.pendingProps, a);
        case 15:
          return up(t, e, e.type, e.pendingProps, a);
        case 19:
          return bp(t, e, a);
        case 31:
          return CS(t, e, a);
        case 22:
          return fp(t, e, a, e.pendingProps);
        case 24:
          return _i(e), s = le(Qt), t === null ? (r = vc(), r === null && (r = kt, u = yc(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
            parent: s,
            cache: r
          }, xc(e), Jn(e, Qt, r)) : ((t.lanes & a) !== 0 && (Sc(t, e), Cs(e, null, null, a), Es()), r = t.memoizedState, u = e.memoizedState, r.parent !== s ? (r = {
            parent: s,
            cache: s
          }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), Jn(e, Qt, s)) : (s = u.cache, Jn(e, Qt, s), s !== r.cache && pc(e, [
            Qt
          ], a, true))), oe(t, e, e.pendingProps.children, a), e.child;
        case 29:
          throw e.pendingProps;
      }
      throw Error(o(156, e.tag));
    }
    function jn(t) {
      t.flags |= 4;
    }
    function nu(t, e, a, s, r) {
      if ((e = (t.mode & 32) !== 0) && (e = false), e) {
        if (t.flags |= 16777216, (r & 335544128) === r) if (t.stateNode.complete) t.flags |= 8192;
        else if (Zp()) t.flags |= 8192;
        else throw Li = Gl, bc;
      } else t.flags &= -16777217;
    }
    function Sp(t, e) {
      if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0) t.flags &= -16777217;
      else if (t.flags |= 16777216, !ky(e)) if (Zp()) t.flags |= 8192;
      else throw Li = Gl, bc;
    }
    function ao(t, e) {
      e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? th() : 536870912, t.lanes |= e, Da |= e);
    }
    function js(t, e) {
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
      if (e) for (var r = t.child; r !== null; ) a |= r.lanes | r.childLanes, s |= r.subtreeFlags & 65011712, s |= r.flags & 65011712, r.return = t, r = r.sibling;
      else for (r = t.child; r !== null; ) a |= r.lanes | r.childLanes, s |= r.subtreeFlags, s |= r.flags, r.return = t, r = r.sibling;
      return t.subtreeFlags |= s, t.childLanes = a, e;
    }
    function RS(t, e, a) {
      var s = e.pendingProps;
      switch (uc(e), e.tag) {
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
          return a = e.stateNode, s = null, t !== null && (s = t.memoizedState.cache), e.memoizedState.cache !== s && (e.flags |= 2048), Rn(Qt), vt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (ya(e) ? jn(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, dc())), Ut(e), null;
        case 26:
          var r = e.type, u = e.memoizedState;
          return t === null ? (jn(e), u !== null ? (Ut(e), Sp(e, u)) : (Ut(e), nu(e, r, null, s, a))) : u ? u !== t.memoizedState ? (jn(e), Ut(e), Sp(e, u)) : (Ut(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== s && jn(e), Ut(e), nu(e, r, t, s, a)), null;
        case 27:
          if ($e(e), a = ut.current, r = e.type, t !== null && e.stateNode != null) t.memoizedProps !== s && jn(e);
          else {
            if (!s) {
              if (e.stateNode === null) throw Error(o(166));
              return Ut(e), null;
            }
            t = et.current, ya(e) ? tm(e) : (t = Ry(r, s, a), e.stateNode = t, jn(e));
          }
          return Ut(e), null;
        case 5:
          if ($e(e), r = e.type, t !== null && e.stateNode != null) t.memoizedProps !== s && jn(e);
          else {
            if (!s) {
              if (e.stateNode === null) throw Error(o(166));
              return Ut(e), null;
            }
            if (u = et.current, ya(e)) tm(e);
            else {
              var g = xo(ut.current);
              switch (u) {
                case 1:
                  u = g.createElementNS("http://www.w3.org/2000/svg", r);
                  break;
                case 2:
                  u = g.createElementNS("http://www.w3.org/1998/Math/MathML", r);
                  break;
                default:
                  switch (r) {
                    case "svg":
                      u = g.createElementNS("http://www.w3.org/2000/svg", r);
                      break;
                    case "math":
                      u = g.createElementNS("http://www.w3.org/1998/Math/MathML", r);
                      break;
                    case "script":
                      u = g.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(u.firstChild);
                      break;
                    case "select":
                      u = typeof s.is == "string" ? g.createElement("select", {
                        is: s.is
                      }) : g.createElement("select"), s.multiple ? u.multiple = true : s.size && (u.size = s.size);
                      break;
                    default:
                      u = typeof s.is == "string" ? g.createElement(r, {
                        is: s.is
                      }) : g.createElement(r);
                  }
              }
              u[ae] = e, u[ge] = s;
              t: for (g = e.child; g !== null; ) {
                if (g.tag === 5 || g.tag === 6) u.appendChild(g.stateNode);
                else if (g.tag !== 4 && g.tag !== 27 && g.child !== null) {
                  g.child.return = g, g = g.child;
                  continue;
                }
                if (g === e) break t;
                for (; g.sibling === null; ) {
                  if (g.return === null || g.return === e) break t;
                  g = g.return;
                }
                g.sibling.return = g.return, g = g.sibling;
              }
              e.stateNode = u;
              t: switch (re(u, r, s), r) {
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
              s && jn(e);
            }
          }
          return Ut(e), nu(e, e.type, t === null ? null : t.memoizedProps, e.pendingProps, a), null;
        case 6:
          if (t && e.stateNode != null) t.memoizedProps !== s && jn(e);
          else {
            if (typeof s != "string" && e.stateNode === null) throw Error(o(166));
            if (t = ut.current, ya(e)) {
              if (t = e.stateNode, a = e.memoizedProps, s = null, r = se, r !== null) switch (r.tag) {
                case 27:
                case 5:
                  s = r.memoizedProps;
              }
              t[ae] = e, t = !!(t.nodeValue === a || s !== null && s.suppressHydrationWarning === true || gy(t.nodeValue, a)), t || Fn(e, true);
            } else t = xo(t).createTextNode(s), t[ae] = e, e.stateNode = t;
          }
          return Ut(e), null;
        case 31:
          if (a = e.memoizedState, t === null || t.memoizedState !== null) {
            if (s = ya(e), a !== null) {
              if (t === null) {
                if (!s) throw Error(o(318));
                if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                t[ae] = e;
              } else ji(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Ut(e), t = false;
            } else a = dc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = true;
            if (!t) return e.flags & 256 ? (Oe(e), e) : (Oe(e), null);
            if ((e.flags & 128) !== 0) throw Error(o(558));
          }
          return Ut(e), null;
        case 13:
          if (s = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
            if (r = ya(e), s !== null && s.dehydrated !== null) {
              if (t === null) {
                if (!r) throw Error(o(318));
                if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(o(317));
                r[ae] = e;
              } else ji(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Ut(e), r = false;
            } else r = dc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = true;
            if (!r) return e.flags & 256 ? (Oe(e), e) : (Oe(e), null);
          }
          return Oe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = s !== null, t = t !== null && t.memoizedState !== null, a && (s = e.child, r = null, s.alternate !== null && s.alternate.memoizedState !== null && s.alternate.memoizedState.cachePool !== null && (r = s.alternate.memoizedState.cachePool.pool), u = null, s.memoizedState !== null && s.memoizedState.cachePool !== null && (u = s.memoizedState.cachePool.pool), u !== r && (s.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), ao(e, e.updateQueue), Ut(e), null);
        case 4:
          return vt(), t === null && Au(e.stateNode.containerInfo), Ut(e), null;
        case 10:
          return Rn(e.type), Ut(e), null;
        case 19:
          if (B(Kt), s = e.memoizedState, s === null) return Ut(e), null;
          if (r = (e.flags & 128) !== 0, u = s.rendering, u === null) if (r) js(s, false);
          else {
            if (qt !== 0 || t !== null && (t.flags & 128) !== 0) for (t = e.child; t !== null; ) {
              if (u = Xl(t), u !== null) {
                for (e.flags |= 128, js(s, false), t = u.updateQueue, e.updateQueue = t, ao(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; ) Fh(a, t), a = a.sibling;
                return I(Kt, Kt.current & 1 | 2), Ct && Cn(e, s.treeForkCount), e.child;
              }
              t = t.sibling;
            }
            s.tail !== null && Ae() > co && (e.flags |= 128, r = true, js(s, false), e.lanes = 4194304);
          }
          else {
            if (!r) if (t = Xl(u), t !== null) {
              if (e.flags |= 128, r = true, t = t.updateQueue, e.updateQueue = t, ao(e, t), js(s, true), s.tail === null && s.tailMode === "hidden" && !u.alternate && !Ct) return Ut(e), null;
            } else 2 * Ae() - s.renderingStartTime > co && a !== 536870912 && (e.flags |= 128, r = true, js(s, false), e.lanes = 4194304);
            s.isBackwards ? (u.sibling = e.child, e.child = u) : (t = s.last, t !== null ? t.sibling = u : e.child = u, s.last = u);
          }
          return s.tail !== null ? (t = s.tail, s.rendering = t, s.tail = t.sibling, s.renderingStartTime = Ae(), t.sibling = null, a = Kt.current, I(Kt, r ? a & 1 | 2 : a & 1), Ct && Cn(e, s.treeForkCount), t) : (Ut(e), null);
        case 22:
        case 23:
          return Oe(e), Ec(), s = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== s && (e.flags |= 8192) : s && (e.flags |= 8192), s ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ut(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ut(e), a = e.updateQueue, a !== null && ao(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), s = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (s = e.memoizedState.cachePool.pool), s !== a && (e.flags |= 2048), t !== null && B(Vi), null;
        case 24:
          return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Rn(Qt), Ut(e), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(o(156, e.tag));
    }
    function DS(t, e) {
      switch (uc(e), e.tag) {
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
            ji();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 13:
          if (Oe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
            if (e.alternate === null) throw Error(o(340));
            ji();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 19:
          return B(Kt), null;
        case 4:
          return vt(), null;
        case 10:
          return Rn(e.type), null;
        case 22:
        case 23:
          return Oe(e), Ec(), t !== null && B(Vi), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 24:
          return Rn(Qt), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function Tp(t, e) {
      switch (uc(e), e.tag) {
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
          B(Kt);
          break;
        case 10:
          Rn(e.type);
          break;
        case 22:
        case 23:
          Oe(e), Ec(), t !== null && B(Vi);
          break;
        case 24:
          Rn(Qt);
      }
    }
    function zs(t, e) {
      try {
        var a = e.updateQueue, s = a !== null ? a.lastEffect : null;
        if (s !== null) {
          var r = s.next;
          a = r;
          do {
            if ((a.tag & t) === t) {
              s = void 0;
              var u = a.create, g = a.inst;
              s = u(), g.destroy = s;
            }
            a = a.next;
          } while (a !== r);
        }
      } catch (x) {
        jt(e, e.return, x);
      }
    }
    function ni(t, e, a) {
      try {
        var s = e.updateQueue, r = s !== null ? s.lastEffect : null;
        if (r !== null) {
          var u = r.next;
          s = u;
          do {
            if ((s.tag & t) === t) {
              var g = s.inst, x = g.destroy;
              if (x !== void 0) {
                g.destroy = void 0, r = e;
                var M = a, H = x;
                try {
                  H();
                } catch (X) {
                  jt(r, M, X);
                }
              }
            }
            s = s.next;
          } while (s !== u);
        }
      } catch (X) {
        jt(e, e.return, X);
      }
    }
    function wp(t) {
      var e = t.updateQueue;
      if (e !== null) {
        var a = t.stateNode;
        try {
          hm(e, a);
        } catch (s) {
          jt(t, t.return, s);
        }
      }
    }
    function Ap(t, e, a) {
      a.props = Hi(t.type, t.memoizedProps), a.state = t.memoizedState;
      try {
        a.componentWillUnmount();
      } catch (s) {
        jt(t, e, s);
      }
    }
    function _s(t, e) {
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
      } catch (r) {
        jt(t, e, r);
      }
    }
    function hn(t, e) {
      var a = t.ref, s = t.refCleanup;
      if (a !== null) if (typeof s == "function") try {
        s();
      } catch (r) {
        jt(t, e, r);
      } finally {
        t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
      }
      else if (typeof a == "function") try {
        a(null);
      } catch (r) {
        jt(t, e, r);
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
      } catch (r) {
        jt(t, t.return, r);
      }
    }
    function iu(t, e, a) {
      try {
        var s = t.stateNode;
        $S(s, t.type, a, e), s[ge] = e;
      } catch (r) {
        jt(t, t.return, r);
      }
    }
    function Cp(t) {
      return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && ci(t.type) || t.tag === 4;
    }
    function au(t) {
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
    function su(t, e, a) {
      var s = t.tag;
      if (s === 5 || s === 6) t = t.stateNode, e ? (a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a).insertBefore(t, e) : (e = a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a, e.appendChild(t), a = a._reactRootContainer, a != null || e.onclick !== null || (e.onclick = wn));
      else if (s !== 4 && (s === 27 && ci(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null)) for (su(t, e, a), t = t.sibling; t !== null; ) su(t, e, a), t = t.sibling;
    }
    function so(t, e, a) {
      var s = t.tag;
      if (s === 5 || s === 6) t = t.stateNode, e ? a.insertBefore(t, e) : a.appendChild(t);
      else if (s !== 4 && (s === 27 && ci(t.type) && (a = t.stateNode), t = t.child, t !== null)) for (so(t, e, a), t = t.sibling; t !== null; ) so(t, e, a), t = t.sibling;
    }
    function Mp(t) {
      var e = t.stateNode, a = t.memoizedProps;
      try {
        for (var s = t.type, r = e.attributes; r.length; ) e.removeAttributeNode(r[0]);
        re(e, s, a), e[ae] = t, e[ge] = a;
      } catch (u) {
        jt(t, t.return, u);
      }
    }
    var zn = false, $t = false, lu = false, Rp = typeof WeakSet == "function" ? WeakSet : Set, ie = null;
    function OS(t, e) {
      if (t = t.containerInfo, Mu = Mo, t = Hh(t), Ir(t)) {
        if ("selectionStart" in t) var a = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
        else t: {
          a = (a = t.ownerDocument) && a.defaultView || window;
          var s = a.getSelection && a.getSelection();
          if (s && s.rangeCount !== 0) {
            a = s.anchorNode;
            var r = s.anchorOffset, u = s.focusNode;
            s = s.focusOffset;
            try {
              a.nodeType, u.nodeType;
            } catch {
              a = null;
              break t;
            }
            var g = 0, x = -1, M = -1, H = 0, X = 0, F = t, G = null;
            e: for (; ; ) {
              for (var q; F !== a || r !== 0 && F.nodeType !== 3 || (x = g + r), F !== u || s !== 0 && F.nodeType !== 3 || (M = g + s), F.nodeType === 3 && (g += F.nodeValue.length), (q = F.firstChild) !== null; ) G = F, F = q;
              for (; ; ) {
                if (F === t) break e;
                if (G === a && ++H === r && (x = g), G === u && ++X === s && (M = g), (q = F.nextSibling) !== null) break;
                F = G, G = F.parentNode;
              }
              F = q;
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
      for (Ru = {
        focusedElem: t,
        selectionRange: a
      }, Mo = false, ie = e; ie !== null; ) if (e = ie, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null) t.return = e, ie = t;
      else for (; ie !== null; ) {
        switch (e = ie, u = e.alternate, t = e.flags, e.tag) {
          case 0:
            if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null)) for (a = 0; a < t.length; a++) r = t[a], r.ref.impl = r.nextImpl;
            break;
          case 11:
          case 15:
            break;
          case 1:
            if ((t & 1024) !== 0 && u !== null) {
              t = void 0, a = e, r = u.memoizedProps, u = u.memoizedState, s = a.stateNode;
              try {
                var st = Hi(a.type, r);
                t = s.getSnapshotBeforeUpdate(st, u), s.__reactInternalSnapshotBeforeUpdate = t;
              } catch (mt) {
                jt(a, a.return, mt);
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
          Vn(t, a), s & 4 && zs(5, a);
          break;
        case 1:
          if (Vn(t, a), s & 4) if (t = a.stateNode, e === null) try {
            t.componentDidMount();
          } catch (g) {
            jt(a, a.return, g);
          }
          else {
            var r = Hi(a.type, e.memoizedProps);
            e = e.memoizedState;
            try {
              t.componentDidUpdate(r, e, t.__reactInternalSnapshotBeforeUpdate);
            } catch (g) {
              jt(a, a.return, g);
            }
          }
          s & 64 && wp(a), s & 512 && _s(a, a.return);
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
            } catch (g) {
              jt(a, a.return, g);
            }
          }
          break;
        case 27:
          e === null && s & 4 && Mp(a);
        case 26:
        case 5:
          Vn(t, a), e === null && s & 4 && Ep(a), s & 512 && _s(a, a.return);
          break;
        case 12:
          Vn(t, a);
          break;
        case 31:
          Vn(t, a), s & 4 && jp(t, a);
          break;
        case 13:
          Vn(t, a), s & 4 && zp(t, a), s & 64 && (t = a.memoizedState, t !== null && (t = t.dehydrated, t !== null && (a = US.bind(null, a), sT(t, a))));
          break;
        case 22:
          if (s = a.memoizedState !== null || zn, !s) {
            e = e !== null && e.memoizedState !== null || $t, r = zn;
            var u = $t;
            zn = s, ($t = e) && !u ? kn(t, a, (a.subtreeFlags & 8772) !== 0) : Vn(t, a), zn = r, $t = u;
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
      e !== null && (t.alternate = null, Op(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && kr(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
    }
    var Ht = null, be = false;
    function _n(t, e, a) {
      for (a = a.child; a !== null; ) Np(t, e, a), a = a.sibling;
    }
    function Np(t, e, a) {
      if (Ee && typeof Ee.onCommitFiberUnmount == "function") try {
        Ee.onCommitFiberUnmount(as, a);
      } catch {
      }
      switch (a.tag) {
        case 26:
          $t || hn(a, e), _n(t, e, a), a.memoizedState ? a.memoizedState.count-- : a.stateNode && (a = a.stateNode, a.parentNode.removeChild(a));
          break;
        case 27:
          $t || hn(a, e);
          var s = Ht, r = be;
          ci(a.type) && (Ht = a.stateNode, be = false), _n(t, e, a), qs(a.stateNode), Ht = s, be = r;
          break;
        case 5:
          $t || hn(a, e);
        case 6:
          if (s = Ht, r = be, Ht = null, _n(t, e, a), Ht = s, be = r, Ht !== null) if (be) try {
            (Ht.nodeType === 9 ? Ht.body : Ht.nodeName === "HTML" ? Ht.ownerDocument.body : Ht).removeChild(a.stateNode);
          } catch (u) {
            jt(a, e, u);
          }
          else try {
            Ht.removeChild(a.stateNode);
          } catch (u) {
            jt(a, e, u);
          }
          break;
        case 18:
          Ht !== null && (be ? (t = Ht, wy(t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t, a.stateNode), La(t)) : wy(Ht, a.stateNode));
          break;
        case 4:
          s = Ht, r = be, Ht = a.stateNode.containerInfo, be = true, _n(t, e, a), Ht = s, be = r;
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
    function jp(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
        t = t.dehydrated;
        try {
          La(t);
        } catch (a) {
          jt(e, e.return, a);
        }
      }
    }
    function zp(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null)))) try {
        La(t);
      } catch (a) {
        jt(e, e.return, a);
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
    function lo(t, e) {
      var a = NS(t);
      e.forEach(function(s) {
        if (!a.has(s)) {
          a.add(s);
          var r = HS.bind(null, t, s);
          s.then(r, r);
        }
      });
    }
    function xe(t, e) {
      var a = e.deletions;
      if (a !== null) for (var s = 0; s < a.length; s++) {
        var r = a[s], u = t, g = e, x = g;
        t: for (; x !== null; ) {
          switch (x.tag) {
            case 27:
              if (ci(x.type)) {
                Ht = x.stateNode, be = false;
                break t;
              }
              break;
            case 5:
              Ht = x.stateNode, be = false;
              break t;
            case 3:
            case 4:
              Ht = x.stateNode.containerInfo, be = true;
              break t;
          }
          x = x.return;
        }
        if (Ht === null) throw Error(o(160));
        Np(u, g, r), Ht = null, be = false, u = r.alternate, u !== null && (u.return = null), r.return = null;
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
          xe(e, t), Se(t), s & 4 && (ni(3, t, t.return), zs(3, t), ni(5, t, t.return));
          break;
        case 1:
          xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), s & 64 && zn && (t = t.updateQueue, t !== null && (s = t.callbacks, s !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? s : a.concat(s))));
          break;
        case 26:
          var r = tn;
          if (xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), s & 4) {
            var u = a !== null ? a.memoizedState : null;
            if (s = t.memoizedState, a === null) if (s === null) if (t.stateNode === null) {
              t: {
                s = t.type, a = t.memoizedProps, r = r.ownerDocument || r;
                e: switch (s) {
                  case "title":
                    u = r.getElementsByTagName("title")[0], (!u || u[os] || u[ae] || u.namespaceURI === "http://www.w3.org/2000/svg" || u.hasAttribute("itemprop")) && (u = r.createElement(s), r.head.insertBefore(u, r.querySelector("head > title"))), re(u, s, a), u[ae] = t, ne(u), s = u;
                    break t;
                  case "link":
                    var g = _y("link", "href", r).get(s + (a.href || ""));
                    if (g) {
                      for (var x = 0; x < g.length; x++) if (u = g[x], u.getAttribute("href") === (a.href == null || a.href === "" ? null : a.href) && u.getAttribute("rel") === (a.rel == null ? null : a.rel) && u.getAttribute("title") === (a.title == null ? null : a.title) && u.getAttribute("crossorigin") === (a.crossOrigin == null ? null : a.crossOrigin)) {
                        g.splice(x, 1);
                        break e;
                      }
                    }
                    u = r.createElement(s), re(u, s, a), r.head.appendChild(u);
                    break;
                  case "meta":
                    if (g = _y("meta", "content", r).get(s + (a.content || ""))) {
                      for (x = 0; x < g.length; x++) if (u = g[x], u.getAttribute("content") === (a.content == null ? null : "" + a.content) && u.getAttribute("name") === (a.name == null ? null : a.name) && u.getAttribute("property") === (a.property == null ? null : a.property) && u.getAttribute("http-equiv") === (a.httpEquiv == null ? null : a.httpEquiv) && u.getAttribute("charset") === (a.charSet == null ? null : a.charSet)) {
                        g.splice(x, 1);
                        break e;
                      }
                    }
                    u = r.createElement(s), re(u, s, a), r.head.appendChild(u);
                    break;
                  default:
                    throw Error(o(468, s));
                }
                u[ae] = t, ne(u), s = u;
              }
              t.stateNode = s;
            } else Vy(r, t.type, t.stateNode);
            else t.stateNode = zy(r, s, t.memoizedProps);
            else u !== s ? (u === null ? a.stateNode !== null && (a = a.stateNode, a.parentNode.removeChild(a)) : u.count--, s === null ? Vy(r, t.type, t.stateNode) : zy(r, s, t.memoizedProps)) : s === null && t.stateNode !== null && iu(t, t.memoizedProps, a.memoizedProps);
          }
          break;
        case 27:
          xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), a !== null && s & 4 && iu(t, t.memoizedProps, a.memoizedProps);
          break;
        case 5:
          if (xe(e, t), Se(t), s & 512 && ($t || a === null || hn(a, a.return)), t.flags & 32) {
            r = t.stateNode;
            try {
              la(r, "");
            } catch (st) {
              jt(t, t.return, st);
            }
          }
          s & 4 && t.stateNode != null && (r = t.memoizedProps, iu(t, r, a !== null ? a.memoizedProps : r)), s & 1024 && (lu = true);
          break;
        case 6:
          if (xe(e, t), Se(t), s & 4) {
            if (t.stateNode === null) throw Error(o(162));
            s = t.memoizedProps, a = t.stateNode;
            try {
              a.nodeValue = s;
            } catch (st) {
              jt(t, t.return, st);
            }
          }
          break;
        case 3:
          if (wo = null, r = tn, tn = So(e.containerInfo), xe(e, t), tn = r, Se(t), s & 4 && a !== null && a.memoizedState.isDehydrated) try {
            La(e.containerInfo);
          } catch (st) {
            jt(t, t.return, st);
          }
          lu && (lu = false, Vp(t));
          break;
        case 4:
          s = tn, tn = So(t.stateNode.containerInfo), xe(e, t), Se(t), tn = s;
          break;
        case 12:
          xe(e, t), Se(t);
          break;
        case 31:
          xe(e, t), Se(t), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, lo(t, s)));
          break;
        case 13:
          xe(e, t), Se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (ro = Ae()), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, lo(t, s)));
          break;
        case 22:
          r = t.memoizedState !== null;
          var M = a !== null && a.memoizedState !== null, H = zn, X = $t;
          if (zn = H || r, $t = X || M, xe(e, t), $t = X, zn = H, Se(t), s & 8192) t: for (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || M || zn || $t || Gi(t)), a = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (a === null) {
                M = a = e;
                try {
                  if (u = M.stateNode, r) g = u.style, typeof g.setProperty == "function" ? g.setProperty("display", "none", "important") : g.display = "none";
                  else {
                    x = M.stateNode;
                    var F = M.memoizedProps.style, G = F != null && F.hasOwnProperty("display") ? F.display : null;
                    x.style.display = G == null || typeof G == "boolean" ? "" : ("" + G).trim();
                  }
                } catch (st) {
                  jt(M, M.return, st);
                }
              }
            } else if (e.tag === 6) {
              if (a === null) {
                M = e;
                try {
                  M.stateNode.nodeValue = r ? "" : M.memoizedProps;
                } catch (st) {
                  jt(M, M.return, st);
                }
              }
            } else if (e.tag === 18) {
              if (a === null) {
                M = e;
                try {
                  var q = M.stateNode;
                  r ? Ay(q, true) : Ay(M.stateNode, false);
                } catch (st) {
                  jt(M, M.return, st);
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
          s & 4 && (s = t.updateQueue, s !== null && (a = s.retryQueue, a !== null && (s.retryQueue = null, lo(t, a))));
          break;
        case 19:
          xe(e, t), Se(t), s & 4 && (s = t.updateQueue, s !== null && (t.updateQueue = null, lo(t, s)));
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
              var r = a.stateNode, u = au(t);
              so(t, u, r);
              break;
            case 5:
              var g = a.stateNode;
              a.flags & 32 && (la(g, ""), a.flags &= -33);
              var x = au(t);
              so(t, x, g);
              break;
            case 3:
            case 4:
              var M = a.stateNode.containerInfo, H = au(t);
              su(t, H, M);
              break;
            default:
              throw Error(o(161));
          }
        } catch (X) {
          jt(t, t.return, X);
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
        var s = e.alternate, r = t, u = e, g = u.flags;
        switch (u.tag) {
          case 0:
          case 11:
          case 15:
            kn(r, u, a), zs(4, u);
            break;
          case 1:
            if (kn(r, u, a), s = u, r = s.stateNode, typeof r.componentDidMount == "function") try {
              r.componentDidMount();
            } catch (H) {
              jt(s, s.return, H);
            }
            if (s = u, r = s.updateQueue, r !== null) {
              var x = s.stateNode;
              try {
                var M = r.shared.hiddenCallbacks;
                if (M !== null) for (r.shared.hiddenCallbacks = null, r = 0; r < M.length; r++) dm(M[r], x);
              } catch (H) {
                jt(s, s.return, H);
              }
            }
            a && g & 64 && wp(u), _s(u, u.return);
            break;
          case 27:
            Mp(u);
          case 26:
          case 5:
            kn(r, u, a), a && s === null && g & 4 && Ep(u), _s(u, u.return);
            break;
          case 12:
            kn(r, u, a);
            break;
          case 31:
            kn(r, u, a), a && g & 4 && jp(r, u);
            break;
          case 13:
            kn(r, u, a), a && g & 4 && zp(r, u);
            break;
          case 22:
            u.memoizedState === null && kn(r, u, a), _s(u, u.return);
            break;
          case 30:
            break;
          default:
            kn(r, u, a);
        }
        e = e.sibling;
      }
    }
    function ou(t, e) {
      var a = null;
      t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && xs(a));
    }
    function ru(t, e) {
      t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && xs(t));
    }
    function en(t, e, a, s) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) kp(t, e, a, s), e = e.sibling;
    }
    function kp(t, e, a, s) {
      var r = e.flags;
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          en(t, e, a, s), r & 2048 && zs(9, e);
          break;
        case 1:
          en(t, e, a, s);
          break;
        case 3:
          en(t, e, a, s), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && xs(t)));
          break;
        case 12:
          if (r & 2048) {
            en(t, e, a, s), t = e.stateNode;
            try {
              var u = e.memoizedProps, g = u.id, x = u.onPostCommit;
              typeof x == "function" && x(g, e.alternate === null ? "mount" : "update", t.passiveEffectDuration, -0);
            } catch (M) {
              jt(e, e.return, M);
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
          u = e.stateNode, g = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? en(t, e, a, s) : Vs(t, e) : u._visibility & 2 ? en(t, e, a, s) : (u._visibility |= 2, Ca(t, e, a, s, (e.subtreeFlags & 10256) !== 0 || false)), r & 2048 && ou(g, e);
          break;
        case 24:
          en(t, e, a, s), r & 2048 && ru(e.alternate, e);
          break;
        default:
          en(t, e, a, s);
      }
    }
    function Ca(t, e, a, s, r) {
      for (r = r && ((e.subtreeFlags & 10256) !== 0 || false), e = e.child; e !== null; ) {
        var u = t, g = e, x = a, M = s, H = g.flags;
        switch (g.tag) {
          case 0:
          case 11:
          case 15:
            Ca(u, g, x, M, r), zs(8, g);
            break;
          case 23:
            break;
          case 22:
            var X = g.stateNode;
            g.memoizedState !== null ? X._visibility & 2 ? Ca(u, g, x, M, r) : Vs(u, g) : (X._visibility |= 2, Ca(u, g, x, M, r)), r && H & 2048 && ou(g.alternate, g);
            break;
          case 24:
            Ca(u, g, x, M, r), r && H & 2048 && ru(g.alternate, g);
            break;
          default:
            Ca(u, g, x, M, r);
        }
        e = e.sibling;
      }
    }
    function Vs(t, e) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) {
        var a = t, s = e, r = s.flags;
        switch (s.tag) {
          case 22:
            Vs(a, s), r & 2048 && ou(s.alternate, s);
            break;
          case 24:
            Vs(a, s), r & 2048 && ru(s.alternate, s);
            break;
          default:
            Vs(a, s);
        }
        e = e.sibling;
      }
    }
    var ks = 8192;
    function Ma(t, e, a) {
      if (t.subtreeFlags & ks) for (t = t.child; t !== null; ) Lp(t, e, a), t = t.sibling;
    }
    function Lp(t, e, a) {
      switch (t.tag) {
        case 26:
          Ma(t, e, a), t.flags & ks && t.memoizedState !== null && gT(a, tn, t.memoizedState, t.memoizedProps);
          break;
        case 5:
          Ma(t, e, a);
          break;
        case 3:
        case 4:
          var s = tn;
          tn = So(t.stateNode.containerInfo), Ma(t, e, a), tn = s;
          break;
        case 22:
          t.memoizedState === null && (s = t.alternate, s !== null && s.memoizedState !== null ? (s = ks, ks = 16777216, Ma(t, e, a), ks = s) : Ma(t, e, a));
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
    function Ls(t) {
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
          Ls(t), t.flags & 2048 && ni(9, t, t.return);
          break;
        case 3:
          Ls(t);
          break;
        case 12:
          Ls(t);
          break;
        case 22:
          var e = t.stateNode;
          t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, oo(t)) : Ls(t);
          break;
        default:
          Ls(t);
      }
    }
    function oo(t) {
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
            ni(8, e, e.return), oo(e);
            break;
          case 22:
            a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, oo(e));
            break;
          default:
            oo(e);
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
            xs(a.memoizedState.cache);
        }
        if (s = a.child, s !== null) s.return = a, ie = s;
        else t: for (a = t; ie !== null; ) {
          s = ie;
          var r = s.sibling, u = s.return;
          if (Op(s), s === a) {
            ie = null;
            break t;
          }
          if (r !== null) {
            r.return = u, ie = r;
            break t;
          }
          ie = u;
        }
      }
    }
    var jS = {
      getCacheForType: function(t) {
        var e = le(Qt), a = e.data.get(t);
        return a === void 0 && (a = t(), e.data.set(t, a)), a;
      },
      cacheSignal: function() {
        return le(Qt).controller.signal;
      }
    }, zS = typeof WeakMap == "function" ? WeakMap : Map, Dt = 0, kt = null, Tt = null, At = 0, Nt = 0, Ne = null, ii = false, Ra = false, cu = false, Ln = 0, qt = 0, ai = 0, Yi = 0, uu = 0, je = 0, Da = 0, Bs = null, Te = null, fu = false, ro = 0, Gp = 0, co = 1 / 0, uo = null, si = null, It = 0, li = null, Oa = null, Bn = 0, du = 0, hu = null, Yp = null, Us = 0, mu = null;
    function ze() {
      return (Dt & 2) !== 0 && At !== 0 ? At & -At : V.T !== null ? xu() : ah();
    }
    function qp() {
      if (je === 0) if ((At & 536870912) === 0 || Ct) {
        var t = vl;
        vl <<= 1, (vl & 3932160) === 0 && (vl = 262144), je = t;
      } else je = 536870912;
      return t = De.current, t !== null && (t.flags |= 32), je;
    }
    function we(t, e, a) {
      (t === kt && (Nt === 2 || Nt === 9) || t.cancelPendingCommit !== null) && (Na(t, 0), oi(t, At, je, false)), ls(t, a), ((Dt & 2) === 0 || t !== kt) && (t === kt && ((Dt & 2) === 0 && (Yi |= a), qt === 4 && oi(t, At, je, false)), mn(t));
    }
    function Pp(t, e, a) {
      if ((Dt & 6) !== 0) throw Error(o(327));
      var s = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || ss(t, e), r = s ? kS(t, e) : yu(t, e, true), u = s;
      do {
        if (r === 0) {
          Ra && !s && oi(t, e, 0, false);
          break;
        } else {
          if (a = t.current.alternate, u && !_S(a)) {
            r = yu(t, e, false), u = false;
            continue;
          }
          if (r === 2) {
            if (u = e, t.errorRecoveryDisabledLanes & u) var g = 0;
            else g = t.pendingLanes & -536870913, g = g !== 0 ? g : g & 536870912 ? 536870912 : 0;
            if (g !== 0) {
              e = g;
              t: {
                var x = t;
                r = Bs;
                var M = x.current.memoizedState.isDehydrated;
                if (M && (Na(x, g).flags |= 256), g = yu(x, g, false), g !== 2) {
                  if (cu && !M) {
                    x.errorRecoveryDisabledLanes |= u, Yi |= u, r = 4;
                    break t;
                  }
                  u = Te, Te = r, u !== null && (Te === null ? Te = u : Te.push.apply(Te, u));
                }
                r = g;
              }
              if (u = false, r !== 2) continue;
            }
          }
          if (r === 1) {
            Na(t, 0), oi(t, e, 0, true);
            break;
          }
          t: {
            switch (s = t, u = r, u) {
              case 0:
              case 1:
                throw Error(o(345));
              case 4:
                if ((e & 4194048) !== e) break;
              case 6:
                oi(s, e, je, !ii);
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
            if ((e & 62914560) === e && (r = ro + 300 - Ae(), 10 < r)) {
              if (oi(s, e, je, !ii), xl(s, 0, true) !== 0) break t;
              Bn = e, s.timeoutHandle = Sy(Xp.bind(null, s, a, Te, uo, fu, e, je, Yi, Da, ii, u, "Throttled", -0, 0), r);
              break t;
            }
            Xp(s, a, Te, uo, fu, e, je, Yi, Da, ii, u, null, -0, 0);
          }
        }
        break;
      } while (true);
      mn(t);
    }
    function Xp(t, e, a, s, r, u, g, x, M, H, X, F, G, q) {
      if (t.timeoutHandle = -1, F = e.subtreeFlags, F & 8192 || (F & 16785408) === 16785408) {
        F = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: true,
          waitingForViewTransition: false,
          unsuspend: wn
        }, Lp(e, u, F);
        var st = (u & 62914560) === u ? ro - Ae() : (u & 4194048) === u ? Gp - Ae() : 0;
        if (st = vT(F, st), st !== null) {
          Bn = u, t.cancelPendingCommit = st(Ip.bind(null, t, e, u, a, s, r, g, x, M, X, F, null, G, q)), oi(t, u, g, !H);
          return;
        }
      }
      Ip(t, e, u, a, s, r, g, x, M);
    }
    function _S(t) {
      for (var e = t; ; ) {
        var a = e.tag;
        if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null))) for (var s = 0; s < a.length; s++) {
          var r = a[s], u = r.getSnapshot;
          r = r.value;
          try {
            if (!Me(u(), r)) return false;
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
      e &= ~uu, e &= ~Yi, t.suspendedLanes |= e, t.pingedLanes &= ~e, s && (t.warmLanes |= e), s = t.expirationTimes;
      for (var r = e; 0 < r; ) {
        var u = 31 - Ce(r), g = 1 << u;
        s[u] = -1, r &= ~g;
      }
      a !== 0 && eh(t, a, e);
    }
    function fo() {
      return (Dt & 6) === 0 ? (Hs(0), false) : true;
    }
    function pu() {
      if (Tt !== null) {
        if (Nt === 0) var t = Tt.return;
        else t = Tt, Mn = zi = null, Nc(t), Sa = null, Ts = 0, t = Tt;
        for (; t !== null; ) Tp(t.alternate, t), t = t.return;
        Tt = null;
      }
    }
    function Na(t, e) {
      var a = t.timeoutHandle;
      a !== -1 && (t.timeoutHandle = -1, tT(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), Bn = 0, pu(), kt = t, Tt = a = En(t.current, null), At = e, Nt = 0, Ne = null, ii = false, Ra = ss(t, e), cu = false, Da = je = uu = Yi = ai = qt = 0, Te = Bs = null, fu = false, (e & 8) !== 0 && (e |= e & 32);
      var s = t.entangledLanes;
      if (s !== 0) for (t = t.entanglements, s &= e; 0 < s; ) {
        var r = 31 - Ce(s), u = 1 << r;
        e |= t[r], s &= ~u;
      }
      return Ln = e, jl(), a;
    }
    function Kp(t, e) {
      bt = null, V.H = Os, e === xa || e === Hl ? (e = rm(), Nt = 3) : e === bc ? (e = rm(), Nt = 4) : Nt = e === Zc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ne = e, Tt === null && (qt = 1, to(t, Ge(e, t.current)));
    }
    function Zp() {
      var t = De.current;
      return t === null ? true : (At & 4194048) === At ? Xe === null : (At & 62914560) === At || (At & 536870912) !== 0 ? t === Xe : false;
    }
    function Qp() {
      var t = V.H;
      return V.H = Os, t === null ? Os : t;
    }
    function Fp() {
      var t = V.A;
      return V.A = jS, t;
    }
    function ho() {
      qt = 4, ii || (At & 4194048) !== At && De.current !== null || (Ra = true), (ai & 134217727) === 0 && (Yi & 134217727) === 0 || kt === null || oi(kt, At, je, false);
    }
    function yu(t, e, a) {
      var s = Dt;
      Dt |= 2;
      var r = Qp(), u = Fp();
      (kt !== t || At !== e) && (uo = null, Na(t, e)), e = false;
      var g = qt;
      t: do
        try {
          if (Nt !== 0 && Tt !== null) {
            var x = Tt, M = Ne;
            switch (Nt) {
              case 8:
                pu(), g = 6;
                break t;
              case 3:
              case 2:
              case 9:
              case 6:
                De.current === null && (e = true);
                var H = Nt;
                if (Nt = 0, Ne = null, ja(t, x, M, H), a && Ra) {
                  g = 0;
                  break t;
                }
                break;
              default:
                H = Nt, Nt = 0, Ne = null, ja(t, x, M, H);
            }
          }
          VS(), g = qt;
          break;
        } catch (X) {
          Kp(t, X);
        }
      while (true);
      return e && t.shellSuspendCounter++, Mn = zi = null, Dt = s, V.H = r, V.A = u, Tt === null && (kt = null, At = 0, jl()), g;
    }
    function VS() {
      for (; Tt !== null; ) Jp(Tt);
    }
    function kS(t, e) {
      var a = Dt;
      Dt |= 2;
      var s = Qp(), r = Fp();
      kt !== t || At !== e ? (uo = null, co = Ae() + 500, Na(t, e)) : Ra = ss(t, e);
      t: do
        try {
          if (Nt !== 0 && Tt !== null) {
            e = Tt;
            var u = Ne;
            e: switch (Nt) {
              case 1:
                Nt = 0, Ne = null, ja(t, e, u, 1);
                break;
              case 2:
              case 9:
                if (lm(u)) {
                  Nt = 0, Ne = null, $p(e);
                  break;
                }
                e = function() {
                  Nt !== 2 && Nt !== 9 || kt !== t || (Nt = 7), mn(t);
                }, u.then(e, e);
                break t;
              case 3:
                Nt = 7;
                break t;
              case 4:
                Nt = 5;
                break t;
              case 7:
                lm(u) ? (Nt = 0, Ne = null, $p(e)) : (Nt = 0, Ne = null, ja(t, e, u, 7));
                break;
              case 5:
                var g = null;
                switch (Tt.tag) {
                  case 26:
                    g = Tt.memoizedState;
                  case 5:
                  case 27:
                    var x = Tt;
                    if (g ? ky(g) : x.stateNode.complete) {
                      Nt = 0, Ne = null;
                      var M = x.sibling;
                      if (M !== null) Tt = M;
                      else {
                        var H = x.return;
                        H !== null ? (Tt = H, mo(H)) : Tt = null;
                      }
                      break e;
                    }
                }
                Nt = 0, Ne = null, ja(t, e, u, 5);
                break;
              case 6:
                Nt = 0, Ne = null, ja(t, e, u, 6);
                break;
              case 8:
                pu(), qt = 6;
                break t;
              default:
                throw Error(o(462));
            }
          }
          LS();
          break;
        } catch (X) {
          Kp(t, X);
        }
      while (true);
      return Mn = zi = null, V.H = s, V.A = r, Dt = a, Tt !== null ? 0 : (kt = null, At = 0, jl(), qt);
    }
    function LS() {
      for (; Tt !== null && !l1(); ) Jp(Tt);
    }
    function Jp(t) {
      var e = xp(t.alternate, t, Ln);
      t.memoizedProps = t.pendingProps, e === null ? mo(t) : Tt = e;
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
      t.memoizedProps = t.pendingProps, e === null ? mo(t) : Tt = e;
    }
    function ja(t, e, a, s) {
      Mn = zi = null, Nc(e), Sa = null, Ts = 0;
      var r = e.return;
      try {
        if (ES(t, r, e, a, At)) {
          qt = 1, to(t, Ge(a, t.current)), Tt = null;
          return;
        }
      } catch (u) {
        if (r !== null) throw Tt = r, u;
        qt = 1, to(t, Ge(a, t.current)), Tt = null;
        return;
      }
      e.flags & 32768 ? (Ct || s === 1 ? t = true : Ra || (At & 536870912) !== 0 ? t = false : (ii = t = true, (s === 2 || s === 9 || s === 3 || s === 6) && (s = De.current, s !== null && s.tag === 13 && (s.flags |= 16384))), Wp(e, t)) : mo(e);
    }
    function mo(t) {
      var e = t;
      do {
        if ((e.flags & 32768) !== 0) {
          Wp(e, ii);
          return;
        }
        t = e.return;
        var a = RS(e.alternate, e, Ln);
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
        var a = DS(t.alternate, t);
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
    function Ip(t, e, a, s, r, u, g, x, M) {
      t.cancelPendingCommit = null;
      do
        po();
      while (It !== 0);
      if ((Dt & 6) !== 0) throw Error(o(327));
      if (e !== null) {
        if (e === t.current) throw Error(o(177));
        if (u = e.lanes | e.childLanes, u |= ac, y1(t, a, u, g, x, M), t === kt && (Tt = kt = null, At = 0), Oa = e, li = t, Bn = a, du = u, hu = r, Yp = s, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, GS(yl, function() {
          return ay(), null;
        })) : (t.callbackNode = null, t.callbackPriority = 0), s = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || s) {
          s = V.T, V.T = null, r = N.p, N.p = 2, g = Dt, Dt |= 4;
          try {
            OS(t, e, a);
          } finally {
            Dt = g, N.p = r, V.T = s;
          }
        }
        It = 1, ty(), ey(), ny();
      }
    }
    function ty() {
      if (It === 1) {
        It = 0;
        var t = li, e = Oa, a = (e.flags & 13878) !== 0;
        if ((e.subtreeFlags & 13878) !== 0 || a) {
          a = V.T, V.T = null;
          var s = N.p;
          N.p = 2;
          var r = Dt;
          Dt |= 4;
          try {
            _p(e, t);
            var u = Ru, g = Hh(t.containerInfo), x = u.focusedElem, M = u.selectionRange;
            if (g !== x && x && x.ownerDocument && Uh(x.ownerDocument.documentElement, x)) {
              if (M !== null && Ir(x)) {
                var H = M.start, X = M.end;
                if (X === void 0 && (X = H), "selectionStart" in x) x.selectionStart = H, x.selectionEnd = Math.min(X, x.value.length);
                else {
                  var F = x.ownerDocument || document, G = F && F.defaultView || window;
                  if (G.getSelection) {
                    var q = G.getSelection(), st = x.textContent.length, mt = Math.min(M.start, st), Vt = M.end === void 0 ? mt : Math.min(M.end, st);
                    !q.extend && mt > Vt && (g = Vt, Vt = mt, mt = g);
                    var j = Bh(x, mt), D = Bh(x, Vt);
                    if (j && D && (q.rangeCount !== 1 || q.anchorNode !== j.node || q.anchorOffset !== j.offset || q.focusNode !== D.node || q.focusOffset !== D.offset)) {
                      var U = F.createRange();
                      U.setStart(j.node, j.offset), q.removeAllRanges(), mt > Vt ? (q.addRange(U), q.extend(D.node, D.offset)) : (U.setEnd(D.node, D.offset), q.addRange(U));
                    }
                  }
                }
              }
              for (F = [], q = x; q = q.parentNode; ) q.nodeType === 1 && F.push({
                element: q,
                left: q.scrollLeft,
                top: q.scrollTop
              });
              for (typeof x.focus == "function" && x.focus(), x = 0; x < F.length; x++) {
                var Q = F[x];
                Q.element.scrollLeft = Q.left, Q.element.scrollTop = Q.top;
              }
            }
            Mo = !!Mu, Ru = Mu = null;
          } finally {
            Dt = r, N.p = s, V.T = a;
          }
        }
        t.current = e, It = 2;
      }
    }
    function ey() {
      if (It === 2) {
        It = 0;
        var t = li, e = Oa, a = (e.flags & 8772) !== 0;
        if ((e.subtreeFlags & 8772) !== 0 || a) {
          a = V.T, V.T = null;
          var s = N.p;
          N.p = 2;
          var r = Dt;
          Dt |= 4;
          try {
            Dp(t, e.alternate, e);
          } finally {
            Dt = r, N.p = s, V.T = a;
          }
        }
        It = 3;
      }
    }
    function ny() {
      if (It === 4 || It === 3) {
        It = 0, o1();
        var t = li, e = Oa, a = Bn, s = Yp;
        (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? It = 5 : (It = 0, Oa = li = null, iy(t, t.pendingLanes));
        var r = t.pendingLanes;
        if (r === 0 && (si = null), _r(a), e = e.stateNode, Ee && typeof Ee.onCommitFiberRoot == "function") try {
          Ee.onCommitFiberRoot(as, e, void 0, (e.current.flags & 128) === 128);
        } catch {
        }
        if (s !== null) {
          e = V.T, r = N.p, N.p = 2, V.T = null;
          try {
            for (var u = t.onRecoverableError, g = 0; g < s.length; g++) {
              var x = s[g];
              u(x.value, {
                componentStack: x.stack
              });
            }
          } finally {
            V.T = e, N.p = r;
          }
        }
        (Bn & 3) !== 0 && po(), mn(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === mu ? Us++ : (Us = 0, mu = t) : Us = 0, Hs(0);
      }
    }
    function iy(t, e) {
      (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, xs(e)));
    }
    function po() {
      return ty(), ey(), ny(), ay();
    }
    function ay() {
      if (It !== 5) return false;
      var t = li, e = du;
      du = 0;
      var a = _r(Bn), s = V.T, r = N.p;
      try {
        N.p = 32 > a ? 32 : a, V.T = null, a = hu, hu = null;
        var u = li, g = Bn;
        if (It = 0, Oa = li = null, Bn = 0, (Dt & 6) !== 0) throw Error(o(331));
        var x = Dt;
        if (Dt |= 4, Up(u.current), kp(u, u.current, g, a), Dt = x, Hs(0, false), Ee && typeof Ee.onPostCommitFiberRoot == "function") try {
          Ee.onPostCommitFiberRoot(as, u);
        } catch {
        }
        return true;
      } finally {
        N.p = r, V.T = s, iy(t, e);
      }
    }
    function sy(t, e, a) {
      e = Ge(a, e), e = Kc(t.stateNode, e, 2), t = In(t, e, 2), t !== null && (ls(t, 2), mn(t));
    }
    function jt(t, e, a) {
      if (t.tag === 3) sy(t, t, a);
      else for (; e !== null; ) {
        if (e.tag === 3) {
          sy(e, t, a);
          break;
        } else if (e.tag === 1) {
          var s = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof s.componentDidCatch == "function" && (si === null || !si.has(s))) {
            t = Ge(a, t), a = lp(2), s = In(e, a, 2), s !== null && (op(a, s, e, t), ls(s, 2), mn(s));
            break;
          }
        }
        e = e.return;
      }
    }
    function gu(t, e, a) {
      var s = t.pingCache;
      if (s === null) {
        s = t.pingCache = new zS();
        var r = /* @__PURE__ */ new Set();
        s.set(e, r);
      } else r = s.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), s.set(e, r));
      r.has(a) || (cu = true, r.add(a), t = BS.bind(null, t, e, a), e.then(t, t));
    }
    function BS(t, e, a) {
      var s = t.pingCache;
      s !== null && s.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, kt === t && (At & a) === a && (qt === 4 || qt === 3 && (At & 62914560) === At && 300 > Ae() - ro ? (Dt & 2) === 0 && Na(t, 0) : uu |= a, Da === At && (Da = 0)), mn(t);
    }
    function ly(t, e) {
      e === 0 && (e = th()), t = Oi(t, e), t !== null && (ls(t, e), mn(t));
    }
    function US(t) {
      var e = t.memoizedState, a = 0;
      e !== null && (a = e.retryLane), ly(t, a);
    }
    function HS(t, e) {
      var a = 0;
      switch (t.tag) {
        case 31:
        case 13:
          var s = t.stateNode, r = t.memoizedState;
          r !== null && (a = r.retryLane);
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
      s !== null && s.delete(e), ly(t, a);
    }
    function GS(t, e) {
      return Or(t, e);
    }
    var yo = null, za = null, vu = false, go = false, bu = false, ri = 0;
    function mn(t) {
      t !== za && t.next === null && (za === null ? yo = za = t : za = za.next = t), go = true, vu || (vu = true, qS());
    }
    function Hs(t, e) {
      if (!bu && go) {
        bu = true;
        do
          for (var a = false, s = yo; s !== null; ) {
            if (t !== 0) {
              var r = s.pendingLanes;
              if (r === 0) var u = 0;
              else {
                var g = s.suspendedLanes, x = s.pingedLanes;
                u = (1 << 31 - Ce(42 | t) + 1) - 1, u &= r & ~(g & ~x), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
              }
              u !== 0 && (a = true, uy(s, u));
            } else u = At, u = xl(s, s === kt ? u : 0, s.cancelPendingCommit !== null || s.timeoutHandle !== -1), (u & 3) === 0 || ss(s, u) || (a = true, uy(s, u));
            s = s.next;
          }
        while (a);
        bu = false;
      }
    }
    function YS() {
      oy();
    }
    function oy() {
      go = vu = false;
      var t = 0;
      ri !== 0 && IS() && (t = ri);
      for (var e = Ae(), a = null, s = yo; s !== null; ) {
        var r = s.next, u = ry(s, e);
        u === 0 ? (s.next = null, a === null ? yo = r : a.next = r, r === null && (za = a)) : (a = s, (t !== 0 || (u & 3) !== 0) && (go = true)), s = r;
      }
      It !== 0 && It !== 5 || Hs(t), ri !== 0 && (ri = 0);
    }
    function ry(t, e) {
      for (var a = t.suspendedLanes, s = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
        var g = 31 - Ce(u), x = 1 << g, M = r[g];
        M === -1 ? ((x & a) === 0 || (x & s) !== 0) && (r[g] = p1(x, e)) : M <= e && (t.expiredLanes |= x), u &= ~x;
      }
      if (e = kt, a = At, a = xl(t, t === e ? a : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), s = t.callbackNode, a === 0 || t === e && (Nt === 2 || Nt === 9) || t.cancelPendingCommit !== null) return s !== null && s !== null && Nr(s), t.callbackNode = null, t.callbackPriority = 0;
      if ((a & 3) === 0 || ss(t, a)) {
        if (e = a & -a, e === t.callbackPriority) return e;
        switch (s !== null && Nr(s), _r(a)) {
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
        return s = cy.bind(null, t), a = Or(a, s), t.callbackPriority = e, t.callbackNode = a, e;
      }
      return s !== null && s !== null && Nr(s), t.callbackPriority = 2, t.callbackNode = null, 2;
    }
    function cy(t, e) {
      if (It !== 0 && It !== 5) return t.callbackNode = null, t.callbackPriority = 0, null;
      var a = t.callbackNode;
      if (po() && t.callbackNode !== a) return null;
      var s = At;
      return s = xl(t, t === kt ? s : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), s === 0 ? null : (Pp(t, s, e), ry(t, Ae()), t.callbackNode != null && t.callbackNode === a ? cy.bind(null, t) : null);
    }
    function uy(t, e) {
      if (po()) return null;
      Pp(t, e, true);
    }
    function qS() {
      eT(function() {
        (Dt & 6) !== 0 ? Or($d, YS) : oy();
      });
    }
    function xu() {
      if (ri === 0) {
        var t = va;
        t === 0 && (t = gl, gl <<= 1, (gl & 261888) === 0 && (gl = 256)), ri = t;
      }
      return ri;
    }
    function fy(t) {
      return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : Al("" + t);
    }
    function dy(t, e) {
      var a = e.ownerDocument.createElement("input");
      return a.name = e.name, a.value = e.value, t.id && a.setAttribute("form", t.id), e.parentNode.insertBefore(a, e), t = new FormData(t), a.parentNode.removeChild(a), t;
    }
    function PS(t, e, a, s, r) {
      if (e === "submit" && a && a.stateNode === r) {
        var u = fy((r[ge] || null).action), g = s.submitter;
        g && (e = (e = g[ge] || null) ? fy(e.formAction) : g.getAttribute("formAction"), e !== null && (u = e, g = null));
        var x = new Rl("action", "action", null, s, r);
        t.push({
          event: x,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (s.defaultPrevented) {
                  if (ri !== 0) {
                    var M = g ? dy(r, g) : new FormData(r);
                    Hc(a, {
                      pending: true,
                      data: M,
                      method: r.method,
                      action: u
                    }, null, M);
                  }
                } else typeof u == "function" && (x.preventDefault(), M = g ? dy(r, g) : new FormData(r), Hc(a, {
                  pending: true,
                  data: M,
                  method: r.method,
                  action: u
                }, u, M));
              },
              currentTarget: r
            }
          ]
        });
      }
    }
    for (var Su = 0; Su < ic.length; Su++) {
      var Tu = ic[Su], XS = Tu.toLowerCase(), KS = Tu[0].toUpperCase() + Tu.slice(1);
      Ie(XS, "on" + KS);
    }
    Ie(qh, "onAnimationEnd"), Ie(Ph, "onAnimationIteration"), Ie(Xh, "onAnimationStart"), Ie("dblclick", "onDoubleClick"), Ie("focusin", "onFocus"), Ie("focusout", "onBlur"), Ie(rS, "onTransitionRun"), Ie(cS, "onTransitionStart"), Ie(uS, "onTransitionCancel"), Ie(Kh, "onTransitionEnd"), aa("onMouseEnter", [
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
    var Gs = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), ZS = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Gs));
    function hy(t, e) {
      e = (e & 4) !== 0;
      for (var a = 0; a < t.length; a++) {
        var s = t[a], r = s.event;
        s = s.listeners;
        t: {
          var u = void 0;
          if (e) for (var g = s.length - 1; 0 <= g; g--) {
            var x = s[g], M = x.instance, H = x.currentTarget;
            if (x = x.listener, M !== u && r.isPropagationStopped()) break t;
            u = x, r.currentTarget = H;
            try {
              u(r);
            } catch (X) {
              Nl(X);
            }
            r.currentTarget = null, u = M;
          }
          else for (g = 0; g < s.length; g++) {
            if (x = s[g], M = x.instance, H = x.currentTarget, x = x.listener, M !== u && r.isPropagationStopped()) break t;
            u = x, r.currentTarget = H;
            try {
              u(r);
            } catch (X) {
              Nl(X);
            }
            r.currentTarget = null, u = M;
          }
        }
      }
    }
    function wt(t, e) {
      var a = e[Vr];
      a === void 0 && (a = e[Vr] = /* @__PURE__ */ new Set());
      var s = t + "__bubble";
      a.has(s) || (my(e, t, 2, false), a.add(s));
    }
    function wu(t, e, a) {
      var s = 0;
      e && (s |= 4), my(a, t, s, e);
    }
    var vo = "_reactListening" + Math.random().toString(36).slice(2);
    function Au(t) {
      if (!t[vo]) {
        t[vo] = true, oh.forEach(function(a) {
          a !== "selectionchange" && (ZS.has(a) || wu(a, false, t), wu(a, true, t));
        });
        var e = t.nodeType === 9 ? t : t.ownerDocument;
        e === null || e[vo] || (e[vo] = true, wu("selectionchange", false, e));
      }
    }
    function my(t, e, a, s) {
      switch (qy(e)) {
        case 2:
          var r = ST;
          break;
        case 8:
          r = TT;
          break;
        default:
          r = Uu;
      }
      a = r.bind(null, e, a, t), r = void 0, !Pr || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (r = true), s ? r !== void 0 ? t.addEventListener(e, a, {
        capture: true,
        passive: r
      }) : t.addEventListener(e, a, true) : r !== void 0 ? t.addEventListener(e, a, {
        passive: r
      }) : t.addEventListener(e, a, false);
    }
    function Eu(t, e, a, s, r) {
      var u = s;
      if ((e & 1) === 0 && (e & 2) === 0 && s !== null) t: for (; ; ) {
        if (s === null) return;
        var g = s.tag;
        if (g === 3 || g === 4) {
          var x = s.stateNode.containerInfo;
          if (x === r) break;
          if (g === 4) for (g = s.return; g !== null; ) {
            var M = g.tag;
            if ((M === 3 || M === 4) && g.stateNode.containerInfo === r) return;
            g = g.return;
          }
          for (; x !== null; ) {
            if (g = ea(x), g === null) return;
            if (M = g.tag, M === 5 || M === 6 || M === 26 || M === 27) {
              s = u = g;
              continue t;
            }
            x = x.parentNode;
          }
        }
        s = s.return;
      }
      bh(function() {
        var H = u, X = Yr(a), F = [];
        t: {
          var G = Zh.get(t);
          if (G !== void 0) {
            var q = Rl, st = t;
            switch (t) {
              case "keypress":
                if (Cl(a) === 0) break t;
              case "keydown":
              case "keyup":
                q = H1;
                break;
              case "focusin":
                st = "focus", q = Qr;
                break;
              case "focusout":
                st = "blur", q = Qr;
                break;
              case "beforeblur":
              case "afterblur":
                q = Qr;
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
                q = Th;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                q = R1;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                q = q1;
                break;
              case qh:
              case Ph:
              case Xh:
                q = N1;
                break;
              case Kh:
                q = X1;
                break;
              case "scroll":
              case "scrollend":
                q = C1;
                break;
              case "wheel":
                q = Z1;
                break;
              case "copy":
              case "cut":
              case "paste":
                q = z1;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                q = Ah;
                break;
              case "toggle":
              case "beforetoggle":
                q = F1;
            }
            var mt = (e & 4) !== 0, Vt = !mt && (t === "scroll" || t === "scrollend"), j = mt ? G !== null ? G + "Capture" : null : G;
            mt = [];
            for (var D = H, U; D !== null; ) {
              var Q = D;
              if (U = Q.stateNode, Q = Q.tag, Q !== 5 && Q !== 26 && Q !== 27 || U === null || j === null || (Q = cs(D, j), Q != null && mt.push(Ys(D, Q, U))), Vt) break;
              D = D.return;
            }
            0 < mt.length && (G = new q(G, st, null, a, X), F.push({
              event: G,
              listeners: mt
            }));
          }
        }
        if ((e & 7) === 0) {
          t: {
            if (G = t === "mouseover" || t === "pointerover", q = t === "mouseout" || t === "pointerout", G && a !== Gr && (st = a.relatedTarget || a.fromElement) && (ea(st) || st[ta])) break t;
            if ((q || G) && (G = X.window === X ? X : (G = X.ownerDocument) ? G.defaultView || G.parentWindow : window, q ? (st = a.relatedTarget || a.toElement, q = H, st = st ? ea(st) : null, st !== null && (Vt = d(st), mt = st.tag, st !== Vt || mt !== 5 && mt !== 27 && mt !== 6) && (st = null)) : (q = null, st = H), q !== st)) {
              if (mt = Th, Q = "onMouseLeave", j = "onMouseEnter", D = "mouse", (t === "pointerout" || t === "pointerover") && (mt = Ah, Q = "onPointerLeave", j = "onPointerEnter", D = "pointer"), Vt = q == null ? G : rs(q), U = st == null ? G : rs(st), G = new mt(Q, D + "leave", q, a, X), G.target = Vt, G.relatedTarget = U, Q = null, ea(X) === H && (mt = new mt(j, D + "enter", st, a, X), mt.target = U, mt.relatedTarget = Vt, Q = mt), Vt = Q, q && st) e: {
                for (mt = QS, j = q, D = st, U = 0, Q = j; Q; Q = mt(Q)) U++;
                Q = 0;
                for (var ft = D; ft; ft = mt(ft)) Q++;
                for (; 0 < U - Q; ) j = mt(j), U--;
                for (; 0 < Q - U; ) D = mt(D), Q--;
                for (; U--; ) {
                  if (j === D || D !== null && j === D.alternate) {
                    mt = j;
                    break e;
                  }
                  j = mt(j), D = mt(D);
                }
                mt = null;
              }
              else mt = null;
              q !== null && py(F, G, q, mt, false), st !== null && Vt !== null && py(F, Vt, st, mt, true);
            }
          }
          t: {
            if (G = H ? rs(H) : window, q = G.nodeName && G.nodeName.toLowerCase(), q === "select" || q === "input" && G.type === "file") var Mt = jh;
            else if (Oh(G)) if (zh) Mt = sS;
            else {
              Mt = iS;
              var ct = nS;
            }
            else q = G.nodeName, !q || q.toLowerCase() !== "input" || G.type !== "checkbox" && G.type !== "radio" ? H && Hr(H.elementType) && (Mt = jh) : Mt = aS;
            if (Mt && (Mt = Mt(t, H))) {
              Nh(F, Mt, a, X);
              break t;
            }
            ct && ct(t, G, H), t === "focusout" && H && G.type === "number" && H.memoizedProps.value != null && Ur(G, "number", G.value);
          }
          switch (ct = H ? rs(H) : window, t) {
            case "focusin":
              (Oh(ct) || ct.contentEditable === "true") && (ua = ct, tc = H, gs = null);
              break;
            case "focusout":
              gs = tc = ua = null;
              break;
            case "mousedown":
              ec = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              ec = false, Gh(F, a, X);
              break;
            case "selectionchange":
              if (oS) break;
            case "keydown":
            case "keyup":
              Gh(F, a, X);
          }
          var xt;
          if (Jr) t: {
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
          Et && (Eh && a.locale !== "ko" && (ca || Et !== "onCompositionStart" ? Et === "onCompositionEnd" && ca && (xt = xh()) : (Kn = X, Xr = "value" in Kn ? Kn.value : Kn.textContent, ca = true)), ct = bo(H, Et), 0 < ct.length && (Et = new wh(Et, t, null, a, X), F.push({
            event: Et,
            listeners: ct
          }), xt ? Et.data = xt : (xt = Dh(a), xt !== null && (Et.data = xt)))), (xt = $1 ? W1(t, a) : I1(t, a)) && (Et = bo(H, "onBeforeInput"), 0 < Et.length && (ct = new wh("onBeforeInput", "beforeinput", null, a, X), F.push({
            event: ct,
            listeners: Et
          }), ct.data = xt)), PS(F, t, H, a, X);
        }
        hy(F, e);
      });
    }
    function Ys(t, e, a) {
      return {
        instance: t,
        listener: e,
        currentTarget: a
      };
    }
    function bo(t, e) {
      for (var a = e + "Capture", s = []; t !== null; ) {
        var r = t, u = r.stateNode;
        if (r = r.tag, r !== 5 && r !== 26 && r !== 27 || u === null || (r = cs(t, a), r != null && s.unshift(Ys(t, r, u)), r = cs(t, e), r != null && s.push(Ys(t, r, u))), t.tag === 3) return s;
        t = t.return;
      }
      return [];
    }
    function QS(t) {
      if (t === null) return null;
      do
        t = t.return;
      while (t && t.tag !== 5 && t.tag !== 27);
      return t || null;
    }
    function py(t, e, a, s, r) {
      for (var u = e._reactName, g = []; a !== null && a !== s; ) {
        var x = a, M = x.alternate, H = x.stateNode;
        if (x = x.tag, M !== null && M === s) break;
        x !== 5 && x !== 26 && x !== 27 || H === null || (M = H, r ? (H = cs(a, u), H != null && g.unshift(Ys(a, H, M))) : r || (H = cs(a, u), H != null && g.push(Ys(a, H, M)))), a = a.return;
      }
      g.length !== 0 && t.push({
        event: e,
        listeners: g
      });
    }
    var FS = /\r\n?/g, JS = /\u0000|\uFFFD/g;
    function yy(t) {
      return (typeof t == "string" ? t : "" + t).replace(FS, `
`).replace(JS, "");
    }
    function gy(t, e) {
      return e = yy(e), yy(t) === e;
    }
    function _t(t, e, a, s, r, u) {
      switch (a) {
        case "children":
          typeof s == "string" ? e === "body" || e === "textarea" && s === "" || la(t, s) : (typeof s == "number" || typeof s == "bigint") && e !== "body" && la(t, "" + s);
          break;
        case "className":
          Tl(t, "class", s);
          break;
        case "tabIndex":
          Tl(t, "tabindex", s);
          break;
        case "dir":
        case "role":
        case "viewBox":
        case "width":
        case "height":
          Tl(t, a, s);
          break;
        case "style":
          gh(t, s, u);
          break;
        case "data":
          if (e !== "object") {
            Tl(t, "data", s);
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
          s = Al("" + s), t.setAttribute(a, s);
          break;
        case "action":
        case "formAction":
          if (typeof s == "function") {
            t.setAttribute(a, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
            break;
          } else typeof u == "function" && (a === "formAction" ? (e !== "input" && _t(t, e, "name", r.name, r, null), _t(t, e, "formEncType", r.formEncType, r, null), _t(t, e, "formMethod", r.formMethod, r, null), _t(t, e, "formTarget", r.formTarget, r, null)) : (_t(t, e, "encType", r.encType, r, null), _t(t, e, "method", r.method, r, null), _t(t, e, "target", r.target, r, null)));
          if (s == null || typeof s == "symbol" || typeof s == "boolean") {
            t.removeAttribute(a);
            break;
          }
          s = Al("" + s), t.setAttribute(a, s);
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
              if (r.children != null) throw Error(o(60));
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
          a = Al("" + s), t.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", a);
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
          wt("beforetoggle", t), wt("toggle", t), Sl(t, "popover", s);
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
          Sl(t, "is", s);
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          (!(2 < a.length) || a[0] !== "o" && a[0] !== "O" || a[1] !== "n" && a[1] !== "N") && (a = A1.get(a) || a, Sl(t, a, s));
      }
    }
    function Cu(t, e, a, s, r, u) {
      switch (a) {
        case "style":
          gh(t, s, u);
          break;
        case "dangerouslySetInnerHTML":
          if (s != null) {
            if (typeof s != "object" || !("__html" in s)) throw Error(o(61));
            if (a = s.__html, a != null) {
              if (r.children != null) throw Error(o(60));
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
            if (a[0] === "o" && a[1] === "n" && (r = a.endsWith("Capture"), e = a.slice(2, r ? a.length - 7 : void 0), u = t[ge] || null, u = u != null ? u[a] : null, typeof u == "function" && t.removeEventListener(e, u, r), typeof s == "function")) {
              typeof u != "function" && u !== null && (a in t ? t[a] = null : t.hasAttribute(a) && t.removeAttribute(a)), t.addEventListener(e, s, r);
              break t;
            }
            a in t ? t[a] = s : s === true ? t.setAttribute(a, "") : Sl(t, a, s);
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
          var s = false, r = false, u;
          for (u in a) if (a.hasOwnProperty(u)) {
            var g = a[u];
            if (g != null) switch (u) {
              case "src":
                s = true;
                break;
              case "srcSet":
                r = true;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(o(137, e));
              default:
                _t(t, e, u, g, a, null);
            }
          }
          r && _t(t, e, "srcSet", a.srcSet, a, null), s && _t(t, e, "src", a.src, a, null);
          return;
        case "input":
          wt("invalid", t);
          var x = u = g = r = null, M = null, H = null;
          for (s in a) if (a.hasOwnProperty(s)) {
            var X = a[s];
            if (X != null) switch (s) {
              case "name":
                r = X;
                break;
              case "type":
                g = X;
                break;
              case "checked":
                M = X;
                break;
              case "defaultChecked":
                H = X;
                break;
              case "value":
                u = X;
                break;
              case "defaultValue":
                x = X;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (X != null) throw Error(o(137, e));
                break;
              default:
                _t(t, e, s, X, a, null);
            }
          }
          hh(t, u, x, M, H, g, r, false);
          return;
        case "select":
          wt("invalid", t), s = g = u = null;
          for (r in a) if (a.hasOwnProperty(r) && (x = a[r], x != null)) switch (r) {
            case "value":
              u = x;
              break;
            case "defaultValue":
              g = x;
              break;
            case "multiple":
              s = x;
            default:
              _t(t, e, r, x, a, null);
          }
          e = u, a = g, t.multiple = !!s, e != null ? sa(t, !!s, e, false) : a != null && sa(t, !!s, a, true);
          return;
        case "textarea":
          wt("invalid", t), u = r = s = null;
          for (g in a) if (a.hasOwnProperty(g) && (x = a[g], x != null)) switch (g) {
            case "value":
              s = x;
              break;
            case "defaultValue":
              r = x;
              break;
            case "children":
              u = x;
              break;
            case "dangerouslySetInnerHTML":
              if (x != null) throw Error(o(91));
              break;
            default:
              _t(t, e, g, x, a, null);
          }
          ph(t, s, r, u);
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
          for (s = 0; s < Gs.length; s++) wt(Gs[s], t);
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
          for (H in a) if (a.hasOwnProperty(H) && (s = a[H], s != null)) switch (H) {
            case "children":
            case "dangerouslySetInnerHTML":
              throw Error(o(137, e));
            default:
              _t(t, e, H, s, a, null);
          }
          return;
        default:
          if (Hr(e)) {
            for (X in a) a.hasOwnProperty(X) && (s = a[X], s !== void 0 && Cu(t, e, X, s, a, void 0));
            return;
          }
      }
      for (x in a) a.hasOwnProperty(x) && (s = a[x], s != null && _t(t, e, x, s, a, null));
    }
    function $S(t, e, a, s) {
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
          var r = null, u = null, g = null, x = null, M = null, H = null, X = null;
          for (q in a) {
            var F = a[q];
            if (a.hasOwnProperty(q) && F != null) switch (q) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                M = F;
              default:
                s.hasOwnProperty(q) || _t(t, e, q, null, s, F);
            }
          }
          for (var G in s) {
            var q = s[G];
            if (F = a[G], s.hasOwnProperty(G) && (q != null || F != null)) switch (G) {
              case "type":
                u = q;
                break;
              case "name":
                r = q;
                break;
              case "checked":
                H = q;
                break;
              case "defaultChecked":
                X = q;
                break;
              case "value":
                g = q;
                break;
              case "defaultValue":
                x = q;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (q != null) throw Error(o(137, e));
                break;
              default:
                q !== F && _t(t, e, G, q, s, F);
            }
          }
          Br(t, g, x, M, H, X, u, r);
          return;
        case "select":
          q = g = x = G = null;
          for (u in a) if (M = a[u], a.hasOwnProperty(u) && M != null) switch (u) {
            case "value":
              break;
            case "multiple":
              q = M;
            default:
              s.hasOwnProperty(u) || _t(t, e, u, null, s, M);
          }
          for (r in s) if (u = s[r], M = a[r], s.hasOwnProperty(r) && (u != null || M != null)) switch (r) {
            case "value":
              G = u;
              break;
            case "defaultValue":
              x = u;
              break;
            case "multiple":
              g = u;
            default:
              u !== M && _t(t, e, r, u, s, M);
          }
          e = x, a = g, s = q, G != null ? sa(t, !!a, G, false) : !!s != !!a && (e != null ? sa(t, !!a, e, true) : sa(t, !!a, a ? [] : "", false));
          return;
        case "textarea":
          q = G = null;
          for (x in a) if (r = a[x], a.hasOwnProperty(x) && r != null && !s.hasOwnProperty(x)) switch (x) {
            case "value":
              break;
            case "children":
              break;
            default:
              _t(t, e, x, null, s, r);
          }
          for (g in s) if (r = s[g], u = a[g], s.hasOwnProperty(g) && (r != null || u != null)) switch (g) {
            case "value":
              G = r;
              break;
            case "defaultValue":
              q = r;
              break;
            case "children":
              break;
            case "dangerouslySetInnerHTML":
              if (r != null) throw Error(o(91));
              break;
            default:
              r !== u && _t(t, e, g, r, s, u);
          }
          mh(t, G, q);
          return;
        case "option":
          for (var st in a) if (G = a[st], a.hasOwnProperty(st) && G != null && !s.hasOwnProperty(st)) switch (st) {
            case "selected":
              t.selected = false;
              break;
            default:
              _t(t, e, st, null, s, G);
          }
          for (M in s) if (G = s[M], q = a[M], s.hasOwnProperty(M) && G !== q && (G != null || q != null)) switch (M) {
            case "selected":
              t.selected = G && typeof G != "function" && typeof G != "symbol";
              break;
            default:
              _t(t, e, M, G, s, q);
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
          for (var mt in a) G = a[mt], a.hasOwnProperty(mt) && G != null && !s.hasOwnProperty(mt) && _t(t, e, mt, null, s, G);
          for (H in s) if (G = s[H], q = a[H], s.hasOwnProperty(H) && G !== q && (G != null || q != null)) switch (H) {
            case "children":
            case "dangerouslySetInnerHTML":
              if (G != null) throw Error(o(137, e));
              break;
            default:
              _t(t, e, H, G, s, q);
          }
          return;
        default:
          if (Hr(e)) {
            for (var Vt in a) G = a[Vt], a.hasOwnProperty(Vt) && G !== void 0 && !s.hasOwnProperty(Vt) && Cu(t, e, Vt, void 0, s, G);
            for (X in s) G = s[X], q = a[X], !s.hasOwnProperty(X) || G === q || G === void 0 && q === void 0 || Cu(t, e, X, G, s, q);
            return;
          }
      }
      for (var j in a) G = a[j], a.hasOwnProperty(j) && G != null && !s.hasOwnProperty(j) && _t(t, e, j, null, s, G);
      for (F in s) G = s[F], q = a[F], !s.hasOwnProperty(F) || G === q || G == null && q == null || _t(t, e, F, G, s, q);
    }
    function vy(t) {
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
    function WS() {
      if (typeof performance.getEntriesByType == "function") {
        for (var t = 0, e = 0, a = performance.getEntriesByType("resource"), s = 0; s < a.length; s++) {
          var r = a[s], u = r.transferSize, g = r.initiatorType, x = r.duration;
          if (u && x && vy(g)) {
            for (g = 0, x = r.responseEnd, s += 1; s < a.length; s++) {
              var M = a[s], H = M.startTime;
              if (H > x) break;
              var X = M.transferSize, F = M.initiatorType;
              X && vy(F) && (M = M.responseEnd, g += X * (M < x ? 1 : (x - H) / (M - H)));
            }
            if (--s, e += 8 * (u + g) / (r.duration / 1e3), t++, 10 < t) break;
          }
        }
        if (0 < t) return e / t / 1e6;
      }
      return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
    }
    var Mu = null, Ru = null;
    function xo(t) {
      return t.nodeType === 9 ? t : t.ownerDocument;
    }
    function by(t) {
      switch (t) {
        case "http://www.w3.org/2000/svg":
          return 1;
        case "http://www.w3.org/1998/Math/MathML":
          return 2;
        default:
          return 0;
      }
    }
    function xy(t, e) {
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
    function Du(t, e) {
      return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
    }
    var Ou = null;
    function IS() {
      var t = window.event;
      return t && t.type === "popstate" ? t === Ou ? false : (Ou = t, true) : (Ou = null, false);
    }
    var Sy = typeof setTimeout == "function" ? setTimeout : void 0, tT = typeof clearTimeout == "function" ? clearTimeout : void 0, Ty = typeof Promise == "function" ? Promise : void 0, eT = typeof queueMicrotask == "function" ? queueMicrotask : typeof Ty < "u" ? function(t) {
      return Ty.resolve(null).then(t).catch(nT);
    } : Sy;
    function nT(t) {
      setTimeout(function() {
        throw t;
      });
    }
    function ci(t) {
      return t === "head";
    }
    function wy(t, e) {
      var a = e, s = 0;
      do {
        var r = a.nextSibling;
        if (t.removeChild(a), r && r.nodeType === 8) if (a = r.data, a === "/$" || a === "/&") {
          if (s === 0) {
            t.removeChild(r), La(e);
            return;
          }
          s--;
        } else if (a === "$" || a === "$?" || a === "$~" || a === "$!" || a === "&") s++;
        else if (a === "html") qs(t.ownerDocument.documentElement);
        else if (a === "head") {
          a = t.ownerDocument.head, qs(a);
          for (var u = a.firstChild; u; ) {
            var g = u.nextSibling, x = u.nodeName;
            u[os] || x === "SCRIPT" || x === "STYLE" || x === "LINK" && u.rel.toLowerCase() === "stylesheet" || a.removeChild(u), u = g;
          }
        } else a === "body" && qs(t.ownerDocument.body);
        a = r;
      } while (a);
      La(e);
    }
    function Ay(t, e) {
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
            Nu(a), kr(a);
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
    function iT(t, e, a, s) {
      for (; t.nodeType === 1; ) {
        var r = a;
        if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
          if (!s && (t.nodeName !== "INPUT" || t.type !== "hidden")) break;
        } else if (s) {
          if (!t[os]) switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (u = t.getAttribute("rel"), u === "stylesheet" && t.hasAttribute("data-precedence")) break;
              if (u !== r.rel || t.getAttribute("href") !== (r.href == null || r.href === "" ? null : r.href) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin) || t.getAttribute("title") !== (r.title == null ? null : r.title)) break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (u = t.getAttribute("src"), (u !== (r.src == null ? null : r.src) || t.getAttribute("type") !== (r.type == null ? null : r.type) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin)) && u && t.hasAttribute("async") && !t.hasAttribute("itemprop")) break;
              return t;
            default:
              return t;
          }
        } else if (e === "input" && t.type === "hidden") {
          var u = r.name == null ? null : "" + r.name;
          if (r.type === "hidden" && t.getAttribute("name") === u) return t;
        } else return t;
        if (t = Ke(t.nextSibling), t === null) break;
      }
      return null;
    }
    function aT(t, e, a) {
      if (e === "") return null;
      for (; t.nodeType !== 3; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !a || (t = Ke(t.nextSibling), t === null)) return null;
      return t;
    }
    function Ey(t, e) {
      for (; t.nodeType !== 8; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = Ke(t.nextSibling), t === null)) return null;
      return t;
    }
    function ju(t) {
      return t.data === "$?" || t.data === "$~";
    }
    function zu(t) {
      return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
    }
    function sT(t, e) {
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
    var _u = null;
    function Cy(t) {
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
    function My(t) {
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
    function Ry(t, e, a) {
      switch (e = xo(a), t) {
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
      kr(t);
    }
    var Ze = /* @__PURE__ */ new Map(), Dy = /* @__PURE__ */ new Set();
    function So(t) {
      return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
    }
    var Un = N.d;
    N.d = {
      f: lT,
      r: oT,
      D: rT,
      C: cT,
      L: uT,
      m: fT,
      X: hT,
      S: dT,
      M: mT
    };
    function lT() {
      var t = Un.f(), e = fo();
      return t || e;
    }
    function oT(t) {
      var e = na(t);
      e !== null && e.tag === 5 && e.type === "form" ? Km(e) : Un.r(t);
    }
    var _a = typeof document > "u" ? null : document;
    function Oy(t, e, a) {
      var s = _a;
      if (s && typeof e == "string" && e) {
        var r = Ue(e);
        r = 'link[rel="' + t + '"][href="' + r + '"]', typeof a == "string" && (r += '[crossorigin="' + a + '"]'), Dy.has(r) || (Dy.add(r), t = {
          rel: t,
          crossOrigin: a,
          href: e
        }, s.querySelector(r) === null && (e = s.createElement("link"), re(e, "link", t), ne(e), s.head.appendChild(e)));
      }
    }
    function rT(t) {
      Un.D(t), Oy("dns-prefetch", t, null);
    }
    function cT(t, e) {
      Un.C(t, e), Oy("preconnect", t, e);
    }
    function uT(t, e, a) {
      Un.L(t, e, a);
      var s = _a;
      if (s && t && e) {
        var r = 'link[rel="preload"][as="' + Ue(e) + '"]';
        e === "image" && a && a.imageSrcSet ? (r += '[imagesrcset="' + Ue(a.imageSrcSet) + '"]', typeof a.imageSizes == "string" && (r += '[imagesizes="' + Ue(a.imageSizes) + '"]')) : r += '[href="' + Ue(t) + '"]';
        var u = r;
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
        }, a), Ze.set(u, t), s.querySelector(r) !== null || e === "style" && s.querySelector(Ps(u)) || e === "script" && s.querySelector(Xs(u)) || (e = s.createElement("link"), re(e, "link", t), ne(e), s.head.appendChild(e)));
      }
    }
    function fT(t, e) {
      Un.m(t, e);
      var a = _a;
      if (a && t) {
        var s = e && typeof e.as == "string" ? e.as : "script", r = 'link[rel="modulepreload"][as="' + Ue(s) + '"][href="' + Ue(t) + '"]', u = r;
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
        }, e), Ze.set(u, t), a.querySelector(r) === null)) {
          switch (s) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              if (a.querySelector(Xs(u))) return;
          }
          s = a.createElement("link"), re(s, "link", t), ne(s), a.head.appendChild(s);
        }
      }
    }
    function dT(t, e, a) {
      Un.S(t, e, a);
      var s = _a;
      if (s && t) {
        var r = ia(s).hoistableStyles, u = Va(t);
        e = e || "default";
        var g = r.get(u);
        if (!g) {
          var x = {
            loading: 0,
            preload: null
          };
          if (g = s.querySelector(Ps(u))) x.loading = 5;
          else {
            t = v({
              rel: "stylesheet",
              href: t,
              "data-precedence": e
            }, a), (a = Ze.get(u)) && Vu(t, a);
            var M = g = s.createElement("link");
            ne(M), re(M, "link", t), M._p = new Promise(function(H, X) {
              M.onload = H, M.onerror = X;
            }), M.addEventListener("load", function() {
              x.loading |= 1;
            }), M.addEventListener("error", function() {
              x.loading |= 2;
            }), x.loading |= 4, To(g, e, s);
          }
          g = {
            type: "stylesheet",
            instance: g,
            count: 1,
            state: x
          }, r.set(u, g);
        }
      }
    }
    function hT(t, e) {
      Un.X(t, e);
      var a = _a;
      if (a && t) {
        var s = ia(a).hoistableScripts, r = ka(t), u = s.get(r);
        u || (u = a.querySelector(Xs(r)), u || (t = v({
          src: t,
          async: true
        }, e), (e = Ze.get(r)) && ku(t, e), u = a.createElement("script"), ne(u), re(u, "link", t), a.head.appendChild(u)), u = {
          type: "script",
          instance: u,
          count: 1,
          state: null
        }, s.set(r, u));
      }
    }
    function mT(t, e) {
      Un.M(t, e);
      var a = _a;
      if (a && t) {
        var s = ia(a).hoistableScripts, r = ka(t), u = s.get(r);
        u || (u = a.querySelector(Xs(r)), u || (t = v({
          src: t,
          async: true,
          type: "module"
        }, e), (e = Ze.get(r)) && ku(t, e), u = a.createElement("script"), ne(u), re(u, "link", t), a.head.appendChild(u)), u = {
          type: "script",
          instance: u,
          count: 1,
          state: null
        }, s.set(r, u));
      }
    }
    function Ny(t, e, a, s) {
      var r = (r = ut.current) ? So(r) : null;
      if (!r) throw Error(o(446));
      switch (t) {
        case "meta":
        case "title":
          return null;
        case "style":
          return typeof a.precedence == "string" && typeof a.href == "string" ? (e = Va(a.href), a = ia(r).hoistableStyles, s = a.get(e), s || (s = {
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
            var u = ia(r).hoistableStyles, g = u.get(t);
            if (g || (r = r.ownerDocument || r, g = {
              type: "stylesheet",
              instance: null,
              count: 0,
              state: {
                loading: 0,
                preload: null
              }
            }, u.set(t, g), (u = r.querySelector(Ps(t))) && !u._p && (g.instance = u, g.state.loading = 5), Ze.has(t) || (a = {
              rel: "preload",
              as: "style",
              href: a.href,
              crossOrigin: a.crossOrigin,
              integrity: a.integrity,
              media: a.media,
              hrefLang: a.hrefLang,
              referrerPolicy: a.referrerPolicy
            }, Ze.set(t, a), u || pT(r, t, a, g.state))), e && s === null) throw Error(o(528, ""));
            return g;
          }
          if (e && s !== null) throw Error(o(529, ""));
          return null;
        case "script":
          return e = a.async, a = a.src, typeof a == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = ka(a), a = ia(r).hoistableScripts, s = a.get(e), s || (s = {
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
    function Ps(t) {
      return 'link[rel="stylesheet"][' + t + "]";
    }
    function jy(t) {
      return v({}, t, {
        "data-precedence": t.precedence,
        precedence: null
      });
    }
    function pT(t, e, a, s) {
      t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? s.loading = 1 : (e = t.createElement("link"), s.preload = e, e.addEventListener("load", function() {
        return s.loading |= 1;
      }), e.addEventListener("error", function() {
        return s.loading |= 2;
      }), re(e, "link", a), ne(e), t.head.appendChild(e));
    }
    function ka(t) {
      return '[src="' + Ue(t) + '"]';
    }
    function Xs(t) {
      return "script[async]" + t;
    }
    function zy(t, e, a) {
      if (e.count++, e.instance === null) switch (e.type) {
        case "style":
          var s = t.querySelector('style[data-href~="' + Ue(a.href) + '"]');
          if (s) return e.instance = s, ne(s), s;
          var r = v({}, a, {
            "data-href": a.href,
            "data-precedence": a.precedence,
            href: null,
            precedence: null
          });
          return s = (t.ownerDocument || t).createElement("style"), ne(s), re(s, "style", r), To(s, a.precedence, t), e.instance = s;
        case "stylesheet":
          r = Va(a.href);
          var u = t.querySelector(Ps(r));
          if (u) return e.state.loading |= 4, e.instance = u, ne(u), u;
          s = jy(a), (r = Ze.get(r)) && Vu(s, r), u = (t.ownerDocument || t).createElement("link"), ne(u);
          var g = u;
          return g._p = new Promise(function(x, M) {
            g.onload = x, g.onerror = M;
          }), re(u, "link", s), e.state.loading |= 4, To(u, a.precedence, t), e.instance = u;
        case "script":
          return u = ka(a.src), (r = t.querySelector(Xs(u))) ? (e.instance = r, ne(r), r) : (s = a, (r = Ze.get(u)) && (s = v({}, a), ku(s, r)), t = t.ownerDocument || t, r = t.createElement("script"), ne(r), re(r, "link", s), t.head.appendChild(r), e.instance = r);
        case "void":
          return null;
        default:
          throw Error(o(443, e.type));
      }
      else e.type === "stylesheet" && (e.state.loading & 4) === 0 && (s = e.instance, e.state.loading |= 4, To(s, a.precedence, t));
      return e.instance;
    }
    function To(t, e, a) {
      for (var s = a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'), r = s.length ? s[s.length - 1] : null, u = r, g = 0; g < s.length; g++) {
        var x = s[g];
        if (x.dataset.precedence === e) u = x;
        else if (u !== r) break;
      }
      u ? u.parentNode.insertBefore(t, u.nextSibling) : (e = a.nodeType === 9 ? a.head : a, e.insertBefore(t, e.firstChild));
    }
    function Vu(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
    }
    function ku(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
    }
    var wo = null;
    function _y(t, e, a) {
      if (wo === null) {
        var s = /* @__PURE__ */ new Map(), r = wo = /* @__PURE__ */ new Map();
        r.set(a, s);
      } else r = wo, s = r.get(a), s || (s = /* @__PURE__ */ new Map(), r.set(a, s));
      if (s.has(t)) return s;
      for (s.set(t, null), a = a.getElementsByTagName(t), r = 0; r < a.length; r++) {
        var u = a[r];
        if (!(u[os] || u[ae] || t === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
          var g = u.getAttribute(e) || "";
          g = t + g;
          var x = s.get(g);
          x ? x.push(u) : s.set(g, [
            u
          ]);
        }
      }
      return s;
    }
    function Vy(t, e, a) {
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
    function ky(t) {
      return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
    }
    function gT(t, e, a, s) {
      if (a.type === "stylesheet" && (typeof s.media != "string" || matchMedia(s.media).matches !== false) && (a.state.loading & 4) === 0) {
        if (a.instance === null) {
          var r = Va(s.href), u = e.querySelector(Ps(r));
          if (u) {
            e = u._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = Ao.bind(t), e.then(t, t)), a.state.loading |= 4, a.instance = u, ne(u);
            return;
          }
          u = e.ownerDocument || e, s = jy(s), (r = Ze.get(r)) && Vu(s, r), u = u.createElement("link"), ne(u);
          var g = u;
          g._p = new Promise(function(x, M) {
            g.onload = x, g.onerror = M;
          }), re(u, "link", s), a.instance = u;
        }
        t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(a, e), (e = a.state.preload) && (a.state.loading & 3) === 0 && (t.count++, a = Ao.bind(t), e.addEventListener("load", a), e.addEventListener("error", a));
      }
    }
    var Lu = 0;
    function vT(t, e) {
      return t.stylesheets && t.count === 0 && Co(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(a) {
        var s = setTimeout(function() {
          if (t.stylesheets && Co(t, t.stylesheets), t.unsuspend) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        }, 6e4 + e);
        0 < t.imgBytes && Lu === 0 && (Lu = 62500 * WS());
        var r = setTimeout(function() {
          if (t.waitingForImages = false, t.count === 0 && (t.stylesheets && Co(t, t.stylesheets), t.unsuspend)) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        }, (t.imgBytes > Lu ? 50 : 800) + e);
        return t.unsuspend = a, function() {
          t.unsuspend = null, clearTimeout(s), clearTimeout(r);
        };
      } : null;
    }
    function Ao() {
      if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
        if (this.stylesheets) Co(this, this.stylesheets);
        else if (this.unsuspend) {
          var t = this.unsuspend;
          this.unsuspend = null, t();
        }
      }
    }
    var Eo = null;
    function Co(t, e) {
      t.stylesheets = null, t.unsuspend !== null && (t.count++, Eo = /* @__PURE__ */ new Map(), e.forEach(bT, t), Eo = null, Ao.call(t));
    }
    function bT(t, e) {
      if (!(e.state.loading & 4)) {
        var a = Eo.get(t);
        if (a) var s = a.get(null);
        else {
          a = /* @__PURE__ */ new Map(), Eo.set(t, a);
          for (var r = t.querySelectorAll("link[data-precedence],style[data-precedence]"), u = 0; u < r.length; u++) {
            var g = r[u];
            (g.nodeName === "LINK" || g.getAttribute("media") !== "not all") && (a.set(g.dataset.precedence, g), s = g);
          }
          s && a.set(null, s);
        }
        r = e.instance, g = r.getAttribute("data-precedence"), u = a.get(g) || s, u === s && a.set(null, r), a.set(g, r), this.count++, s = Ao.bind(this), r.addEventListener("load", s), r.addEventListener("error", s), u ? u.parentNode.insertBefore(r, u.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(r, t.firstChild)), e.state.loading |= 4;
      }
    }
    var Ks = {
      $$typeof: z,
      Provider: null,
      Consumer: null,
      _currentValue: k,
      _currentValue2: k,
      _threadCount: 0
    };
    function xT(t, e, a, s, r, u, g, x, M) {
      this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = jr(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = jr(0), this.hiddenUpdates = jr(null), this.identifierPrefix = s, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = M, this.incompleteTransitions = /* @__PURE__ */ new Map();
    }
    function Ly(t, e, a, s, r, u, g, x, M, H, X, F) {
      return t = new xT(t, e, a, g, M, H, X, F, x), e = 1, u === true && (e |= 24), u = Re(3, null, null, e), t.current = u, u.stateNode = t, e = yc(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
        element: s,
        isDehydrated: a,
        cache: e
      }, xc(u), t;
    }
    function By(t) {
      return t ? (t = ha, t) : ha;
    }
    function Uy(t, e, a, s, r, u) {
      r = By(r), s.context === null ? s.context = r : s.pendingContext = r, s = Wn(e), s.payload = {
        element: a
      }, u = u === void 0 ? null : u, u !== null && (s.callback = u), a = In(t, s, e), a !== null && (we(a, t, e), As(a, t, e));
    }
    function Hy(t, e) {
      if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
        var a = t.retryLane;
        t.retryLane = a !== 0 && a < e ? a : e;
      }
    }
    function Bu(t, e) {
      Hy(t, e), (t = t.alternate) && Hy(t, e);
    }
    function Gy(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = Oi(t, 67108864);
        e !== null && we(e, t, 67108864), Bu(t, 67108864);
      }
    }
    function Yy(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = ze();
        e = zr(e);
        var a = Oi(t, e);
        a !== null && we(a, t, e), Bu(t, e);
      }
    }
    var Mo = true;
    function ST(t, e, a, s) {
      var r = V.T;
      V.T = null;
      var u = N.p;
      try {
        N.p = 2, Uu(t, e, a, s);
      } finally {
        N.p = u, V.T = r;
      }
    }
    function TT(t, e, a, s) {
      var r = V.T;
      V.T = null;
      var u = N.p;
      try {
        N.p = 8, Uu(t, e, a, s);
      } finally {
        N.p = u, V.T = r;
      }
    }
    function Uu(t, e, a, s) {
      if (Mo) {
        var r = Hu(s);
        if (r === null) Eu(t, e, s, Ro, a), Py(t, s);
        else if (AT(r, t, e, a, s)) s.stopPropagation();
        else if (Py(t, s), e & 4 && -1 < wT.indexOf(t)) {
          for (; r !== null; ) {
            var u = na(r);
            if (u !== null) switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var g = Ei(u.pendingLanes);
                  if (g !== 0) {
                    var x = u;
                    for (x.pendingLanes |= 2, x.entangledLanes |= 2; g; ) {
                      var M = 1 << 31 - Ce(g);
                      x.entanglements[1] |= M, g &= ~M;
                    }
                    mn(u), (Dt & 6) === 0 && (co = Ae() + 500, Hs(0));
                  }
                }
                break;
              case 31:
              case 13:
                x = Oi(u, 2), x !== null && we(x, u, 2), fo(), Bu(u, 2);
            }
            if (u = Hu(s), u === null && Eu(t, e, s, Ro, a), u === r) break;
            r = u;
          }
          r !== null && s.stopPropagation();
        } else Eu(t, e, s, null, a);
      }
    }
    function Hu(t) {
      return t = Yr(t), Gu(t);
    }
    var Ro = null;
    function Gu(t) {
      if (Ro = null, t = ea(t), t !== null) {
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
      return Ro = t, null;
    }
    function qy(t) {
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
          switch (r1()) {
            case $d:
              return 2;
            case Wd:
              return 8;
            case yl:
            case c1:
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
    var Yu = false, ui = null, fi = null, di = null, Zs = /* @__PURE__ */ new Map(), Qs = /* @__PURE__ */ new Map(), hi = [], wT = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
    function Py(t, e) {
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
          Zs.delete(e.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          Qs.delete(e.pointerId);
      }
    }
    function Fs(t, e, a, s, r, u) {
      return t === null || t.nativeEvent !== u ? (t = {
        blockedOn: e,
        domEventName: a,
        eventSystemFlags: s,
        nativeEvent: u,
        targetContainers: [
          r
        ]
      }, e !== null && (e = na(e), e !== null && Gy(e)), t) : (t.eventSystemFlags |= s, e = t.targetContainers, r !== null && e.indexOf(r) === -1 && e.push(r), t);
    }
    function AT(t, e, a, s, r) {
      switch (e) {
        case "focusin":
          return ui = Fs(ui, t, e, a, s, r), true;
        case "dragenter":
          return fi = Fs(fi, t, e, a, s, r), true;
        case "mouseover":
          return di = Fs(di, t, e, a, s, r), true;
        case "pointerover":
          var u = r.pointerId;
          return Zs.set(u, Fs(Zs.get(u) || null, t, e, a, s, r)), true;
        case "gotpointercapture":
          return u = r.pointerId, Qs.set(u, Fs(Qs.get(u) || null, t, e, a, s, r)), true;
      }
      return false;
    }
    function Xy(t) {
      var e = ea(t.target);
      if (e !== null) {
        var a = d(e);
        if (a !== null) {
          if (e = a.tag, e === 13) {
            if (e = f(a), e !== null) {
              t.blockedOn = e, sh(t.priority, function() {
                Yy(a);
              });
              return;
            }
          } else if (e === 31) {
            if (e = h(a), e !== null) {
              t.blockedOn = e, sh(t.priority, function() {
                Yy(a);
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
    function Do(t) {
      if (t.blockedOn !== null) return false;
      for (var e = t.targetContainers; 0 < e.length; ) {
        var a = Hu(t.nativeEvent);
        if (a === null) {
          a = t.nativeEvent;
          var s = new a.constructor(a.type, a);
          Gr = s, a.target.dispatchEvent(s), Gr = null;
        } else return e = na(a), e !== null && Gy(e), t.blockedOn = a, false;
        e.shift();
      }
      return true;
    }
    function Ky(t, e, a) {
      Do(t) && a.delete(e);
    }
    function ET() {
      Yu = false, ui !== null && Do(ui) && (ui = null), fi !== null && Do(fi) && (fi = null), di !== null && Do(di) && (di = null), Zs.forEach(Ky), Qs.forEach(Ky);
    }
    function Oo(t, e) {
      t.blockedOn === e && (t.blockedOn = null, Yu || (Yu = true, n.unstable_scheduleCallback(n.unstable_NormalPriority, ET)));
    }
    var No = null;
    function Zy(t) {
      No !== t && (No = t, n.unstable_scheduleCallback(n.unstable_NormalPriority, function() {
        No === t && (No = null);
        for (var e = 0; e < t.length; e += 3) {
          var a = t[e], s = t[e + 1], r = t[e + 2];
          if (typeof s != "function") {
            if (Gu(s || a) === null) continue;
            break;
          }
          var u = na(a);
          u !== null && (t.splice(e, 3), e -= 3, Hc(u, {
            pending: true,
            data: r,
            method: a.method,
            action: s
          }, s, r));
        }
      }));
    }
    function La(t) {
      function e(M) {
        return Oo(M, t);
      }
      ui !== null && Oo(ui, t), fi !== null && Oo(fi, t), di !== null && Oo(di, t), Zs.forEach(e), Qs.forEach(e);
      for (var a = 0; a < hi.length; a++) {
        var s = hi[a];
        s.blockedOn === t && (s.blockedOn = null);
      }
      for (; 0 < hi.length && (a = hi[0], a.blockedOn === null); ) Xy(a), a.blockedOn === null && hi.shift();
      if (a = (t.ownerDocument || t).$$reactFormReplay, a != null) for (s = 0; s < a.length; s += 3) {
        var r = a[s], u = a[s + 1], g = r[ge] || null;
        if (typeof u == "function") g || Zy(a);
        else if (g) {
          var x = null;
          if (u && u.hasAttribute("formAction")) {
            if (r = u, g = u[ge] || null) x = g.formAction;
            else if (Gu(r) !== null) continue;
          } else x = g.action;
          typeof x == "function" ? a[s + 1] = x : (a.splice(s, 3), s -= 3), Zy(a);
        }
      }
    }
    function Qy() {
      function t(u) {
        u.canIntercept && u.info === "react-transition" && u.intercept({
          handler: function() {
            return new Promise(function(g) {
              return r = g;
            });
          },
          focusReset: "manual",
          scroll: "manual"
        });
      }
      function e() {
        r !== null && (r(), r = null), s || setTimeout(a, 20);
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
        var s = false, r = null;
        return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(a, 100), function() {
          s = true, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), r !== null && (r(), r = null);
        };
      }
    }
    function qu(t) {
      this._internalRoot = t;
    }
    jo.prototype.render = qu.prototype.render = function(t) {
      var e = this._internalRoot;
      if (e === null) throw Error(o(409));
      var a = e.current, s = ze();
      Uy(a, s, t, e, null, null);
    }, jo.prototype.unmount = qu.prototype.unmount = function() {
      var t = this._internalRoot;
      if (t !== null) {
        this._internalRoot = null;
        var e = t.containerInfo;
        Uy(t.current, 2, null, t, null, null), fo(), e[ta] = null;
      }
    };
    function jo(t) {
      this._internalRoot = t;
    }
    jo.prototype.unstable_scheduleHydration = function(t) {
      if (t) {
        var e = ah();
        t = {
          blockedOn: null,
          target: t,
          priority: e
        };
        for (var a = 0; a < hi.length && e !== 0 && e < hi[a].priority; a++) ;
        hi.splice(a, 0, t), a === 0 && Xy(t);
      }
    };
    var Fy = i.version;
    if (Fy !== "19.2.4") throw Error(o(527, Fy, "19.2.4"));
    N.findDOMNode = function(t) {
      var e = t._reactInternals;
      if (e === void 0) throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
      return t = p(e), t = t !== null ? y(t) : null, t = t === null ? null : t.stateNode, t;
    };
    var CT = {
      bundleType: 0,
      version: "19.2.4",
      rendererPackageName: "react-dom",
      currentDispatcherRef: V,
      reconcilerVersion: "19.2.4"
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
      var zo = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!zo.isDisabled && zo.supportsFiber) try {
        as = zo.inject(CT), Ee = zo;
      } catch {
      }
    }
    return $s.createRoot = function(t, e) {
      if (!c(t)) throw Error(o(299));
      var a = false, s = "", r = np, u = ip, g = ap;
      return e != null && (e.unstable_strictMode === true && (a = true), e.identifierPrefix !== void 0 && (s = e.identifierPrefix), e.onUncaughtError !== void 0 && (r = e.onUncaughtError), e.onCaughtError !== void 0 && (u = e.onCaughtError), e.onRecoverableError !== void 0 && (g = e.onRecoverableError)), e = Ly(t, 1, false, null, null, a, s, null, r, u, g, Qy), t[ta] = e.current, Au(t), new qu(e);
    }, $s.hydrateRoot = function(t, e, a) {
      if (!c(t)) throw Error(o(299));
      var s = false, r = "", u = np, g = ip, x = ap, M = null;
      return a != null && (a.unstable_strictMode === true && (s = true), a.identifierPrefix !== void 0 && (r = a.identifierPrefix), a.onUncaughtError !== void 0 && (u = a.onUncaughtError), a.onCaughtError !== void 0 && (g = a.onCaughtError), a.onRecoverableError !== void 0 && (x = a.onRecoverableError), a.formState !== void 0 && (M = a.formState)), e = Ly(t, 1, true, e, a ?? null, s, r, M, u, g, x, Qy), e.context = By(null), a = e.current, s = ze(), s = zr(s), r = Wn(s), r.callback = null, In(a, r, s), a = s, e.current.lanes = a, ls(e, a), mn(e), t[ta] = e.current, Au(t), new jo(e);
    }, $s.version = "19.2.4", $s;
  }
  var sg;
  function kT() {
    if (sg) return Ku.exports;
    sg = 1;
    function n() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (i) {
        console.error(i);
      }
    }
    return n(), Ku.exports = VT(), Ku.exports;
  }
  var LT = kT();
  const BT = Zv(LT);
  function he(n, i, { checkForDefaultPrevented: l = true } = {}) {
    return function(c) {
      if (n == null ? void 0 : n(c), l === false || !c.defaultPrevented) return i == null ? void 0 : i(c);
    };
  }
  function lg(n, i) {
    if (typeof n == "function") return n(i);
    n != null && (n.current = i);
  }
  function ad(...n) {
    return (i) => {
      let l = false;
      const o = n.map((c) => {
        const d = lg(c, i);
        return !l && typeof d == "function" && (l = true), d;
      });
      if (l) return () => {
        for (let c = 0; c < o.length; c++) {
          const d = o[c];
          typeof d == "function" ? d() : lg(n[c], null);
        }
      };
    };
  }
  function ye(...n) {
    return w.useCallback(ad(...n), n);
  }
  function dr(n, i = []) {
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
      function y(v, b) {
        var _a;
        const T = ((_a = b == null ? void 0 : b[n]) == null ? void 0 : _a[m]) || h, A = w.useContext(T);
        if (A) return A;
        if (f !== void 0) return f;
        throw new Error(`\`${v}\` must be used within \`${d}\``);
      }
      return [
        p,
        y
      ];
    }
    const c = () => {
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
    return c.scopeName = n, [
      o,
      UT(c, ...i)
    ];
  }
  function UT(...n) {
    const i = n[0];
    if (n.length === 1) return i;
    const l = () => {
      const o = n.map((c) => ({
        useScope: c(),
        scopeName: c.scopeName
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
  var Fv = Qv();
  function bf(n) {
    const i = HT(n), l = w.forwardRef((o, c) => {
      const { children: d, ...f } = o, h = w.Children.toArray(d), m = h.find(YT);
      if (m) {
        const p = m.props.children, y = h.map((v) => v === m ? w.Children.count(p) > 1 ? w.Children.only(null) : w.isValidElement(p) ? p.props.children : null : v);
        return S.jsx(i, {
          ...f,
          ref: c,
          children: w.isValidElement(p) ? w.cloneElement(p, void 0, y) : null
        });
      }
      return S.jsx(i, {
        ...f,
        ref: c,
        children: d
      });
    });
    return l.displayName = `${n}.Slot`, l;
  }
  function HT(n) {
    const i = w.forwardRef((l, o) => {
      const { children: c, ...d } = l;
      if (w.isValidElement(c)) {
        const f = PT(c), h = qT(d, c.props);
        return c.type !== w.Fragment && (h.ref = o ? ad(o, f) : f), w.cloneElement(c, h);
      }
      return w.Children.count(c) > 1 ? w.Children.only(null) : null;
    });
    return i.displayName = `${n}.SlotClone`, i;
  }
  var Jv = Symbol("radix.slottable");
  function GT(n) {
    const i = ({ children: l }) => S.jsx(S.Fragment, {
      children: l
    });
    return i.displayName = `${n}.Slottable`, i.__radixId = Jv, i;
  }
  function YT(n) {
    return w.isValidElement(n) && typeof n.type == "function" && "__radixId" in n.type && n.type.__radixId === Jv;
  }
  function qT(n, i) {
    const l = {
      ...i
    };
    for (const o in i) {
      const c = n[o], d = i[o];
      /^on[A-Z]/.test(o) ? c && d ? l[o] = (...h) => {
        const m = d(...h);
        return c(...h), m;
      } : c && (l[o] = c) : o === "style" ? l[o] = {
        ...c,
        ...d
      } : o === "className" && (l[o] = [
        c,
        d
      ].filter(Boolean).join(" "));
    }
    return {
      ...n,
      ...l
    };
  }
  function PT(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  var XT = [
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
  ], Je = XT.reduce((n, i) => {
    const l = bf(`Primitive.${i}`), o = w.forwardRef((c, d) => {
      const { asChild: f, ...h } = c, m = f ? l : i;
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
  function KT(n, i) {
    n && Fv.flushSync(() => n.dispatchEvent(i));
  }
  function hr(n) {
    const i = w.useRef(n);
    return w.useEffect(() => {
      i.current = n;
    }), w.useMemo(() => (...l) => {
      var _a;
      return (_a = i.current) == null ? void 0 : _a.call(i, ...l);
    }, []);
  }
  function ZT(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = hr(n);
    w.useEffect(() => {
      const o = (c) => {
        c.key === "Escape" && l(c);
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
  var QT = "DismissableLayer", xf = "dismissableLayer.update", FT = "dismissableLayer.pointerDownOutside", JT = "dismissableLayer.focusOutside", og, $v = w.createContext({
    layers: /* @__PURE__ */ new Set(),
    layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
    branches: /* @__PURE__ */ new Set()
  }), Wv = w.forwardRef((n, i) => {
    const { disableOutsidePointerEvents: l = false, onEscapeKeyDown: o, onPointerDownOutside: c, onFocusOutside: d, onInteractOutside: f, onDismiss: h, ...m } = n, p = w.useContext($v), [y, v] = w.useState(null), b = (y == null ? void 0 : y.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, T] = w.useState({}), A = ye(i, (Z) => v(Z)), C = Array.from(p.layers), [R] = [
      ...p.layersWithOutsidePointerEventsDisabled
    ].slice(-1), O = C.indexOf(R), L = y ? C.indexOf(y) : -1, z = p.layersWithOutsidePointerEventsDisabled.size > 0, _ = L >= O, K = IT((Z) => {
      const Y = Z.target, tt = [
        ...p.branches
      ].some((W) => W.contains(Y));
      !_ || tt || (c == null ? void 0 : c(Z), f == null ? void 0 : f(Z), Z.defaultPrevented || (h == null ? void 0 : h()));
    }, b), J = t2((Z) => {
      const Y = Z.target;
      [
        ...p.branches
      ].some((W) => W.contains(Y)) || (d == null ? void 0 : d(Z), f == null ? void 0 : f(Z), Z.defaultPrevented || (h == null ? void 0 : h()));
    }, b);
    return ZT((Z) => {
      L === p.layers.size - 1 && (o == null ? void 0 : o(Z), !Z.defaultPrevented && h && (Z.preventDefault(), h()));
    }, b), w.useEffect(() => {
      if (y) return l && (p.layersWithOutsidePointerEventsDisabled.size === 0 && (og = b.body.style.pointerEvents, b.body.style.pointerEvents = "none"), p.layersWithOutsidePointerEventsDisabled.add(y)), p.layers.add(y), rg(), () => {
        l && p.layersWithOutsidePointerEventsDisabled.size === 1 && (b.body.style.pointerEvents = og);
      };
    }, [
      y,
      b,
      l,
      p
    ]), w.useEffect(() => () => {
      y && (p.layers.delete(y), p.layersWithOutsidePointerEventsDisabled.delete(y), rg());
    }, [
      y,
      p
    ]), w.useEffect(() => {
      const Z = () => T({});
      return document.addEventListener(xf, Z), () => document.removeEventListener(xf, Z);
    }, []), S.jsx(Je.div, {
      ...m,
      ref: A,
      style: {
        pointerEvents: z ? _ ? "auto" : "none" : void 0,
        ...n.style
      },
      onFocusCapture: he(n.onFocusCapture, J.onFocusCapture),
      onBlurCapture: he(n.onBlurCapture, J.onBlurCapture),
      onPointerDownCapture: he(n.onPointerDownCapture, K.onPointerDownCapture)
    });
  });
  Wv.displayName = QT;
  var $T = "DismissableLayerBranch", WT = w.forwardRef((n, i) => {
    const l = w.useContext($v), o = w.useRef(null), c = ye(i, o);
    return w.useEffect(() => {
      const d = o.current;
      if (d) return l.branches.add(d), () => {
        l.branches.delete(d);
      };
    }, [
      l.branches
    ]), S.jsx(Je.div, {
      ...n,
      ref: c
    });
  });
  WT.displayName = $T;
  function IT(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = hr(n), o = w.useRef(false), c = w.useRef(() => {
    });
    return w.useEffect(() => {
      const d = (h) => {
        if (h.target && !o.current) {
          let m = function() {
            Iv(FT, l, p, {
              discrete: true
            });
          };
          const p = {
            originalEvent: h
          };
          h.pointerType === "touch" ? (i.removeEventListener("click", c.current), c.current = m, i.addEventListener("click", c.current, {
            once: true
          })) : m();
        } else i.removeEventListener("click", c.current);
        o.current = false;
      }, f = window.setTimeout(() => {
        i.addEventListener("pointerdown", d);
      }, 0);
      return () => {
        window.clearTimeout(f), i.removeEventListener("pointerdown", d), i.removeEventListener("click", c.current);
      };
    }, [
      i,
      l
    ]), {
      onPointerDownCapture: () => o.current = true
    };
  }
  function t2(n, i = globalThis == null ? void 0 : globalThis.document) {
    const l = hr(n), o = w.useRef(false);
    return w.useEffect(() => {
      const c = (d) => {
        d.target && !o.current && Iv(JT, l, {
          originalEvent: d
        }, {
          discrete: false
        });
      };
      return i.addEventListener("focusin", c), () => i.removeEventListener("focusin", c);
    }, [
      i,
      l
    ]), {
      onFocusCapture: () => o.current = true,
      onBlurCapture: () => o.current = false
    };
  }
  function rg() {
    const n = new CustomEvent(xf);
    document.dispatchEvent(n);
  }
  function Iv(n, i, l, { discrete: o }) {
    const c = l.originalEvent.target, d = new CustomEvent(n, {
      bubbles: false,
      cancelable: true,
      detail: l
    });
    i && c.addEventListener(n, i, {
      once: true
    }), o ? KT(c, d) : c.dispatchEvent(d);
  }
  var $i = (globalThis == null ? void 0 : globalThis.document) ? w.useLayoutEffect : () => {
  }, e2 = id[" useId ".trim().toString()] || (() => {
  }), n2 = 0;
  function i2(n) {
    const [i, l] = w.useState(e2());
    return $i(() => {
      l((o) => o ?? String(n2++));
    }, [
      n
    ]), i ? `radix-${i}` : "";
  }
  const a2 = [
    "top",
    "right",
    "bottom",
    "left"
  ], bi = Math.min, _e = Math.max, Wo = Math.round, _o = Math.floor, vn = (n) => ({
    x: n,
    y: n
  }), s2 = {
    left: "right",
    right: "left",
    bottom: "top",
    top: "bottom"
  };
  function Sf(n, i, l) {
    return _e(n, bi(i, l));
  }
  function Gn(n, i) {
    return typeof n == "function" ? n(i) : n;
  }
  function Yn(n) {
    return n.split("-")[0];
  }
  function $a(n) {
    return n.split("-")[1];
  }
  function sd(n) {
    return n === "x" ? "y" : "x";
  }
  function ld(n) {
    return n === "y" ? "height" : "width";
  }
  function gn(n) {
    const i = n[0];
    return i === "t" || i === "b" ? "y" : "x";
  }
  function od(n) {
    return sd(gn(n));
  }
  function l2(n, i, l) {
    l === void 0 && (l = false);
    const o = $a(n), c = od(n), d = ld(c);
    let f = c === "x" ? o === (l ? "end" : "start") ? "right" : "left" : o === "start" ? "bottom" : "top";
    return i.reference[d] > i.floating[d] && (f = Io(f)), [
      f,
      Io(f)
    ];
  }
  function o2(n) {
    const i = Io(n);
    return [
      Tf(n),
      i,
      Tf(i)
    ];
  }
  function Tf(n) {
    return n.includes("start") ? n.replace("start", "end") : n.replace("end", "start");
  }
  const cg = [
    "left",
    "right"
  ], ug = [
    "right",
    "left"
  ], r2 = [
    "top",
    "bottom"
  ], c2 = [
    "bottom",
    "top"
  ];
  function u2(n, i, l) {
    switch (n) {
      case "top":
      case "bottom":
        return l ? i ? ug : cg : i ? cg : ug;
      case "left":
      case "right":
        return i ? r2 : c2;
      default:
        return [];
    }
  }
  function f2(n, i, l, o) {
    const c = $a(n);
    let d = u2(Yn(n), l === "start", o);
    return c && (d = d.map((f) => f + "-" + c), i && (d = d.concat(d.map(Tf)))), d;
  }
  function Io(n) {
    const i = Yn(n);
    return s2[i] + n.slice(i.length);
  }
  function d2(n) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      ...n
    };
  }
  function t0(n) {
    return typeof n != "number" ? d2(n) : {
      top: n,
      right: n,
      bottom: n,
      left: n
    };
  }
  function tr(n) {
    const { x: i, y: l, width: o, height: c } = n;
    return {
      width: o,
      height: c,
      top: l,
      left: i,
      right: i + o,
      bottom: l + c,
      x: i,
      y: l
    };
  }
  function fg(n, i, l) {
    let { reference: o, floating: c } = n;
    const d = gn(i), f = od(i), h = ld(f), m = Yn(i), p = d === "y", y = o.x + o.width / 2 - c.width / 2, v = o.y + o.height / 2 - c.height / 2, b = o[h] / 2 - c[h] / 2;
    let T;
    switch (m) {
      case "top":
        T = {
          x: y,
          y: o.y - c.height
        };
        break;
      case "bottom":
        T = {
          x: y,
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
          x: o.x - c.width,
          y: v
        };
        break;
      default:
        T = {
          x: o.x,
          y: o.y
        };
    }
    switch ($a(i)) {
      case "start":
        T[f] -= b * (l && p ? -1 : 1);
        break;
      case "end":
        T[f] += b * (l && p ? -1 : 1);
        break;
    }
    return T;
  }
  async function h2(n, i) {
    var l;
    i === void 0 && (i = {});
    const { x: o, y: c, platform: d, rects: f, elements: h, strategy: m } = n, { boundary: p = "clippingAncestors", rootBoundary: y = "viewport", elementContext: v = "floating", altBoundary: b = false, padding: T = 0 } = Gn(i, n), A = t0(T), R = h[b ? v === "floating" ? "reference" : "floating" : v], O = tr(await d.getClippingRect({
      element: (l = await (d.isElement == null ? void 0 : d.isElement(R))) == null || l ? R : R.contextElement || await (d.getDocumentElement == null ? void 0 : d.getDocumentElement(h.floating)),
      boundary: p,
      rootBoundary: y,
      strategy: m
    })), L = v === "floating" ? {
      x: o,
      y: c,
      width: f.floating.width,
      height: f.floating.height
    } : f.reference, z = await (d.getOffsetParent == null ? void 0 : d.getOffsetParent(h.floating)), _ = await (d.isElement == null ? void 0 : d.isElement(z)) ? await (d.getScale == null ? void 0 : d.getScale(z)) || {
      x: 1,
      y: 1
    } : {
      x: 1,
      y: 1
    }, K = tr(d.convertOffsetParentRelativeRectToViewportRelativeRect ? await d.convertOffsetParentRelativeRectToViewportRelativeRect({
      elements: h,
      rect: L,
      offsetParent: z,
      strategy: m
    }) : L);
    return {
      top: (O.top - K.top + A.top) / _.y,
      bottom: (K.bottom - O.bottom + A.bottom) / _.y,
      left: (O.left - K.left + A.left) / _.x,
      right: (K.right - O.right + A.right) / _.x
    };
  }
  const m2 = 50, p2 = async (n, i, l) => {
    const { placement: o = "bottom", strategy: c = "absolute", middleware: d = [], platform: f } = l, h = f.detectOverflow ? f : {
      ...f,
      detectOverflow: h2
    }, m = await (f.isRTL == null ? void 0 : f.isRTL(i));
    let p = await f.getElementRects({
      reference: n,
      floating: i,
      strategy: c
    }), { x: y, y: v } = fg(p, o, m), b = o, T = 0;
    const A = {};
    for (let C = 0; C < d.length; C++) {
      const R = d[C];
      if (!R) continue;
      const { name: O, fn: L } = R, { x: z, y: _, data: K, reset: J } = await L({
        x: y,
        y: v,
        initialPlacement: o,
        placement: b,
        strategy: c,
        middlewareData: A,
        rects: p,
        platform: h,
        elements: {
          reference: n,
          floating: i
        }
      });
      y = z ?? y, v = _ ?? v, A[O] = {
        ...A[O],
        ...K
      }, J && T < m2 && (T++, typeof J == "object" && (J.placement && (b = J.placement), J.rects && (p = J.rects === true ? await f.getElementRects({
        reference: n,
        floating: i,
        strategy: c
      }) : J.rects), { x: y, y: v } = fg(p, b, m)), C = -1);
    }
    return {
      x: y,
      y: v,
      placement: b,
      strategy: c,
      middlewareData: A
    };
  }, y2 = (n) => ({
    name: "arrow",
    options: n,
    async fn(i) {
      const { x: l, y: o, placement: c, rects: d, platform: f, elements: h, middlewareData: m } = i, { element: p, padding: y = 0 } = Gn(n, i) || {};
      if (p == null) return {};
      const v = t0(y), b = {
        x: l,
        y: o
      }, T = od(c), A = ld(T), C = await f.getDimensions(p), R = T === "y", O = R ? "top" : "left", L = R ? "bottom" : "right", z = R ? "clientHeight" : "clientWidth", _ = d.reference[A] + d.reference[T] - b[T] - d.floating[A], K = b[T] - d.reference[T], J = await (f.getOffsetParent == null ? void 0 : f.getOffsetParent(p));
      let Z = J ? J[z] : 0;
      (!Z || !await (f.isElement == null ? void 0 : f.isElement(J))) && (Z = h.floating[z] || d.floating[A]);
      const Y = _ / 2 - K / 2, tt = Z / 2 - C[A] / 2 - 1, W = bi(v[O], tt), nt = bi(v[L], tt), at = W, pt = Z - C[A] - nt, dt = Z / 2 - C[A] / 2 + Y, ht = Sf(at, dt, pt), V = !m.arrow && $a(c) != null && dt !== ht && d.reference[A] / 2 - (dt < at ? W : nt) - C[A] / 2 < 0, N = V ? dt < at ? dt - at : dt - pt : 0;
      return {
        [T]: b[T] + N,
        data: {
          [T]: ht,
          centerOffset: dt - ht - N,
          ...V && {
            alignmentOffset: N
          }
        },
        reset: V
      };
    }
  }), g2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "flip",
      options: n,
      async fn(i) {
        var l, o;
        const { placement: c, middlewareData: d, rects: f, initialPlacement: h, platform: m, elements: p } = i, { mainAxis: y = true, crossAxis: v = true, fallbackPlacements: b, fallbackStrategy: T = "bestFit", fallbackAxisSideDirection: A = "none", flipAlignment: C = true, ...R } = Gn(n, i);
        if ((l = d.arrow) != null && l.alignmentOffset) return {};
        const O = Yn(c), L = gn(h), z = Yn(h) === h, _ = await (m.isRTL == null ? void 0 : m.isRTL(p.floating)), K = b || (z || !C ? [
          Io(h)
        ] : o2(h)), J = A !== "none";
        !b && J && K.push(...f2(h, C, A, _));
        const Z = [
          h,
          ...K
        ], Y = await m.detectOverflow(i, R), tt = [];
        let W = ((o = d.flip) == null ? void 0 : o.overflows) || [];
        if (y && tt.push(Y[O]), v) {
          const dt = l2(c, f, _);
          tt.push(Y[dt[0]], Y[dt[1]]);
        }
        if (W = [
          ...W,
          {
            placement: c,
            overflows: tt
          }
        ], !tt.every((dt) => dt <= 0)) {
          var nt, at;
          const dt = (((nt = d.flip) == null ? void 0 : nt.index) || 0) + 1, ht = Z[dt];
          if (ht && (!(v === "alignment" ? L !== gn(ht) : false) || W.every((k) => gn(k.placement) === L ? k.overflows[0] > 0 : true))) return {
            data: {
              index: dt,
              overflows: W
            },
            reset: {
              placement: ht
            }
          };
          let V = (at = W.filter((N) => N.overflows[0] <= 0).sort((N, k) => N.overflows[1] - k.overflows[1])[0]) == null ? void 0 : at.placement;
          if (!V) switch (T) {
            case "bestFit": {
              var pt;
              const N = (pt = W.filter((k) => {
                if (J) {
                  const $ = gn(k.placement);
                  return $ === L || $ === "y";
                }
                return true;
              }).map((k) => [
                k.placement,
                k.overflows.filter(($) => $ > 0).reduce(($, P) => $ + P, 0)
              ]).sort((k, $) => k[1] - $[1])[0]) == null ? void 0 : pt[0];
              N && (V = N);
              break;
            }
            case "initialPlacement":
              V = h;
              break;
          }
          if (c !== V) return {
            reset: {
              placement: V
            }
          };
        }
        return {};
      }
    };
  };
  function dg(n, i) {
    return {
      top: n.top - i.height,
      right: n.right - i.width,
      bottom: n.bottom - i.height,
      left: n.left - i.width
    };
  }
  function hg(n) {
    return a2.some((i) => n[i] >= 0);
  }
  const v2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "hide",
      options: n,
      async fn(i) {
        const { rects: l, platform: o } = i, { strategy: c = "referenceHidden", ...d } = Gn(n, i);
        switch (c) {
          case "referenceHidden": {
            const f = await o.detectOverflow(i, {
              ...d,
              elementContext: "reference"
            }), h = dg(f, l.reference);
            return {
              data: {
                referenceHiddenOffsets: h,
                referenceHidden: hg(h)
              }
            };
          }
          case "escaped": {
            const f = await o.detectOverflow(i, {
              ...d,
              altBoundary: true
            }), h = dg(f, l.floating);
            return {
              data: {
                escapedOffsets: h,
                escaped: hg(h)
              }
            };
          }
          default:
            return {};
        }
      }
    };
  }, e0 = /* @__PURE__ */ new Set([
    "left",
    "top"
  ]);
  async function b2(n, i) {
    const { placement: l, platform: o, elements: c } = n, d = await (o.isRTL == null ? void 0 : o.isRTL(c.floating)), f = Yn(l), h = $a(l), m = gn(l) === "y", p = e0.has(f) ? -1 : 1, y = d && m ? -1 : 1, v = Gn(i, n);
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
      x: T * y,
      y: b * p
    } : {
      x: b * p,
      y: T * y
    };
  }
  const x2 = function(n) {
    return n === void 0 && (n = 0), {
      name: "offset",
      options: n,
      async fn(i) {
        var l, o;
        const { x: c, y: d, placement: f, middlewareData: h } = i, m = await b2(i, n);
        return f === ((l = h.offset) == null ? void 0 : l.placement) && (o = h.arrow) != null && o.alignmentOffset ? {} : {
          x: c + m.x,
          y: d + m.y,
          data: {
            ...m,
            placement: f
          }
        };
      }
    };
  }, S2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "shift",
      options: n,
      async fn(i) {
        const { x: l, y: o, placement: c, platform: d } = i, { mainAxis: f = true, crossAxis: h = false, limiter: m = {
          fn: (O) => {
            let { x: L, y: z } = O;
            return {
              x: L,
              y: z
            };
          }
        }, ...p } = Gn(n, i), y = {
          x: l,
          y: o
        }, v = await d.detectOverflow(i, p), b = gn(Yn(c)), T = sd(b);
        let A = y[T], C = y[b];
        if (f) {
          const O = T === "y" ? "top" : "left", L = T === "y" ? "bottom" : "right", z = A + v[O], _ = A - v[L];
          A = Sf(z, A, _);
        }
        if (h) {
          const O = b === "y" ? "top" : "left", L = b === "y" ? "bottom" : "right", z = C + v[O], _ = C - v[L];
          C = Sf(z, C, _);
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
  }, T2 = function(n) {
    return n === void 0 && (n = {}), {
      options: n,
      fn(i) {
        const { x: l, y: o, placement: c, rects: d, middlewareData: f } = i, { offset: h = 0, mainAxis: m = true, crossAxis: p = true } = Gn(n, i), y = {
          x: l,
          y: o
        }, v = gn(c), b = sd(v);
        let T = y[b], A = y[v];
        const C = Gn(h, i), R = typeof C == "number" ? {
          mainAxis: C,
          crossAxis: 0
        } : {
          mainAxis: 0,
          crossAxis: 0,
          ...C
        };
        if (m) {
          const z = b === "y" ? "height" : "width", _ = d.reference[b] - d.floating[z] + R.mainAxis, K = d.reference[b] + d.reference[z] - R.mainAxis;
          T < _ ? T = _ : T > K && (T = K);
        }
        if (p) {
          var O, L;
          const z = b === "y" ? "width" : "height", _ = e0.has(Yn(c)), K = d.reference[v] - d.floating[z] + (_ && ((O = f.offset) == null ? void 0 : O[v]) || 0) + (_ ? 0 : R.crossAxis), J = d.reference[v] + d.reference[z] + (_ ? 0 : ((L = f.offset) == null ? void 0 : L[v]) || 0) - (_ ? R.crossAxis : 0);
          A < K ? A = K : A > J && (A = J);
        }
        return {
          [b]: T,
          [v]: A
        };
      }
    };
  }, w2 = function(n) {
    return n === void 0 && (n = {}), {
      name: "size",
      options: n,
      async fn(i) {
        var l, o;
        const { placement: c, rects: d, platform: f, elements: h } = i, { apply: m = () => {
        }, ...p } = Gn(n, i), y = await f.detectOverflow(i, p), v = Yn(c), b = $a(c), T = gn(c) === "y", { width: A, height: C } = d.floating;
        let R, O;
        v === "top" || v === "bottom" ? (R = v, O = b === (await (f.isRTL == null ? void 0 : f.isRTL(h.floating)) ? "start" : "end") ? "left" : "right") : (O = v, R = b === "end" ? "top" : "bottom");
        const L = C - y.top - y.bottom, z = A - y.left - y.right, _ = bi(C - y[R], L), K = bi(A - y[O], z), J = !i.middlewareData.shift;
        let Z = _, Y = K;
        if ((l = i.middlewareData.shift) != null && l.enabled.x && (Y = z), (o = i.middlewareData.shift) != null && o.enabled.y && (Z = L), J && !b) {
          const W = _e(y.left, 0), nt = _e(y.right, 0), at = _e(y.top, 0), pt = _e(y.bottom, 0);
          T ? Y = A - 2 * (W !== 0 || nt !== 0 ? W + nt : _e(y.left, y.right)) : Z = C - 2 * (at !== 0 || pt !== 0 ? at + pt : _e(y.top, y.bottom));
        }
        await m({
          ...i,
          availableWidth: Y,
          availableHeight: Z
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
  function mr() {
    return typeof window < "u";
  }
  function Wa(n) {
    return n0(n) ? (n.nodeName || "").toLowerCase() : "#document";
  }
  function Ve(n) {
    var i;
    return (n == null || (i = n.ownerDocument) == null ? void 0 : i.defaultView) || window;
  }
  function Sn(n) {
    var i;
    return (i = (n0(n) ? n.ownerDocument : n.document) || window.document) == null ? void 0 : i.documentElement;
  }
  function n0(n) {
    return mr() ? n instanceof Node || n instanceof Ve(n).Node : false;
  }
  function ln(n) {
    return mr() ? n instanceof Element || n instanceof Ve(n).Element : false;
  }
  function qn(n) {
    return mr() ? n instanceof HTMLElement || n instanceof Ve(n).HTMLElement : false;
  }
  function mg(n) {
    return !mr() || typeof ShadowRoot > "u" ? false : n instanceof ShadowRoot || n instanceof Ve(n).ShadowRoot;
  }
  function fl(n) {
    const { overflow: i, overflowX: l, overflowY: o, display: c } = on(n);
    return /auto|scroll|overlay|hidden|clip/.test(i + o + l) && c !== "inline" && c !== "contents";
  }
  function A2(n) {
    return /^(table|td|th)$/.test(Wa(n));
  }
  function pr(n) {
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
  const E2 = /transform|translate|scale|rotate|perspective|filter/, C2 = /paint|layout|strict|content/, qi = (n) => !!n && n !== "none";
  let Ju;
  function rd(n) {
    const i = ln(n) ? on(n) : n;
    return qi(i.transform) || qi(i.translate) || qi(i.scale) || qi(i.rotate) || qi(i.perspective) || !cd() && (qi(i.backdropFilter) || qi(i.filter)) || E2.test(i.willChange || "") || C2.test(i.contain || "");
  }
  function M2(n) {
    let i = xi(n);
    for (; qn(i) && !Za(i); ) {
      if (rd(i)) return i;
      if (pr(i)) return null;
      i = xi(i);
    }
    return null;
  }
  function cd() {
    return Ju == null && (Ju = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), Ju;
  }
  function Za(n) {
    return /^(html|body|#document)$/.test(Wa(n));
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
    if (Wa(n) === "html") return n;
    const i = n.assignedSlot || n.parentNode || mg(n) && n.host || Sn(n);
    return mg(i) ? i.host : i;
  }
  function i0(n) {
    const i = xi(n);
    return Za(i) ? n.ownerDocument ? n.ownerDocument.body : n.body : qn(i) && fl(i) ? i : i0(i);
  }
  function sl(n, i, l) {
    var o;
    i === void 0 && (i = []), l === void 0 && (l = true);
    const c = i0(n), d = c === ((o = n.ownerDocument) == null ? void 0 : o.body), f = Ve(c);
    if (d) {
      const h = wf(f);
      return i.concat(f, f.visualViewport || [], fl(c) ? c : [], h && l ? sl(h) : []);
    } else return i.concat(c, sl(c, [], l));
  }
  function wf(n) {
    return n.parent && Object.getPrototypeOf(n.parent) ? n.frameElement : null;
  }
  function a0(n) {
    const i = on(n);
    let l = parseFloat(i.width) || 0, o = parseFloat(i.height) || 0;
    const c = qn(n), d = c ? n.offsetWidth : l, f = c ? n.offsetHeight : o, h = Wo(l) !== d || Wo(o) !== f;
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
    if (!qn(i)) return vn(1);
    const l = i.getBoundingClientRect(), { width: o, height: c, $: d } = a0(i);
    let f = (d ? Wo(l.width) : l.width) / o, h = (d ? Wo(l.height) : l.height) / c;
    return (!f || !Number.isFinite(f)) && (f = 1), (!h || !Number.isFinite(h)) && (h = 1), {
      x: f,
      y: h
    };
  }
  const R2 = vn(0);
  function s0(n) {
    const i = Ve(n);
    return !cd() || !i.visualViewport ? R2 : {
      x: i.visualViewport.offsetLeft,
      y: i.visualViewport.offsetTop
    };
  }
  function D2(n, i, l) {
    return i === void 0 && (i = false), !l || i && l !== Ve(n) ? false : i;
  }
  function Wi(n, i, l, o) {
    i === void 0 && (i = false), l === void 0 && (l = false);
    const c = n.getBoundingClientRect(), d = ud(n);
    let f = vn(1);
    i && (o ? ln(o) && (f = Ka(o)) : f = Ka(n));
    const h = D2(d, l, o) ? s0(d) : vn(0);
    let m = (c.left + h.x) / f.x, p = (c.top + h.y) / f.y, y = c.width / f.x, v = c.height / f.y;
    if (d) {
      const b = Ve(d), T = o && ln(o) ? Ve(o) : o;
      let A = b, C = wf(A);
      for (; C && o && T !== A; ) {
        const R = Ka(C), O = C.getBoundingClientRect(), L = on(C), z = O.left + (C.clientLeft + parseFloat(L.paddingLeft)) * R.x, _ = O.top + (C.clientTop + parseFloat(L.paddingTop)) * R.y;
        m *= R.x, p *= R.y, y *= R.x, v *= R.y, m += z, p += _, A = Ve(C), C = wf(A);
      }
    }
    return tr({
      width: y,
      height: v,
      x: m,
      y: p
    });
  }
  function gr(n, i) {
    const l = yr(n).scrollLeft;
    return i ? i.left + l : Wi(Sn(n)).left + l;
  }
  function l0(n, i) {
    const l = n.getBoundingClientRect(), o = l.left + i.scrollLeft - gr(n, l), c = l.top + i.scrollTop;
    return {
      x: o,
      y: c
    };
  }
  function O2(n) {
    let { elements: i, rect: l, offsetParent: o, strategy: c } = n;
    const d = c === "fixed", f = Sn(o), h = i ? pr(i.floating) : false;
    if (o === f || h && d) return l;
    let m = {
      scrollLeft: 0,
      scrollTop: 0
    }, p = vn(1);
    const y = vn(0), v = qn(o);
    if ((v || !v && !d) && ((Wa(o) !== "body" || fl(f)) && (m = yr(o)), v)) {
      const T = Wi(o);
      p = Ka(o), y.x = T.x + o.clientLeft, y.y = T.y + o.clientTop;
    }
    const b = f && !v && !d ? l0(f, m) : vn(0);
    return {
      width: l.width * p.x,
      height: l.height * p.y,
      x: l.x * p.x - m.scrollLeft * p.x + y.x + b.x,
      y: l.y * p.y - m.scrollTop * p.y + y.y + b.y
    };
  }
  function N2(n) {
    return Array.from(n.getClientRects());
  }
  function j2(n) {
    const i = Sn(n), l = yr(n), o = n.ownerDocument.body, c = _e(i.scrollWidth, i.clientWidth, o.scrollWidth, o.clientWidth), d = _e(i.scrollHeight, i.clientHeight, o.scrollHeight, o.clientHeight);
    let f = -l.scrollLeft + gr(n);
    const h = -l.scrollTop;
    return on(o).direction === "rtl" && (f += _e(i.clientWidth, o.clientWidth) - c), {
      width: c,
      height: d,
      x: f,
      y: h
    };
  }
  const pg = 25;
  function z2(n, i) {
    const l = Ve(n), o = Sn(n), c = l.visualViewport;
    let d = o.clientWidth, f = o.clientHeight, h = 0, m = 0;
    if (c) {
      d = c.width, f = c.height;
      const y = cd();
      (!y || y && i === "fixed") && (h = c.offsetLeft, m = c.offsetTop);
    }
    const p = gr(o);
    if (p <= 0) {
      const y = o.ownerDocument, v = y.body, b = getComputedStyle(v), T = y.compatMode === "CSS1Compat" && parseFloat(b.marginLeft) + parseFloat(b.marginRight) || 0, A = Math.abs(o.clientWidth - v.clientWidth - T);
      A <= pg && (d -= A);
    } else p <= pg && (d += p);
    return {
      width: d,
      height: f,
      x: h,
      y: m
    };
  }
  function _2(n, i) {
    const l = Wi(n, true, i === "fixed"), o = l.top + n.clientTop, c = l.left + n.clientLeft, d = qn(n) ? Ka(n) : vn(1), f = n.clientWidth * d.x, h = n.clientHeight * d.y, m = c * d.x, p = o * d.y;
    return {
      width: f,
      height: h,
      x: m,
      y: p
    };
  }
  function yg(n, i, l) {
    let o;
    if (i === "viewport") o = z2(n, l);
    else if (i === "document") o = j2(Sn(n));
    else if (ln(i)) o = _2(i, l);
    else {
      const c = s0(n);
      o = {
        x: i.x - c.x,
        y: i.y - c.y,
        width: i.width,
        height: i.height
      };
    }
    return tr(o);
  }
  function o0(n, i) {
    const l = xi(n);
    return l === i || !ln(l) || Za(l) ? false : on(l).position === "fixed" || o0(l, i);
  }
  function V2(n, i) {
    const l = i.get(n);
    if (l) return l;
    let o = sl(n, [], false).filter((h) => ln(h) && Wa(h) !== "body"), c = null;
    const d = on(n).position === "fixed";
    let f = d ? xi(n) : n;
    for (; ln(f) && !Za(f); ) {
      const h = on(f), m = rd(f);
      !m && h.position === "fixed" && (c = null), (d ? !m && !c : !m && h.position === "static" && !!c && (c.position === "absolute" || c.position === "fixed") || fl(f) && !m && o0(n, f)) ? o = o.filter((y) => y !== f) : c = h, f = xi(f);
    }
    return i.set(n, o), o;
  }
  function k2(n) {
    let { element: i, boundary: l, rootBoundary: o, strategy: c } = n;
    const f = [
      ...l === "clippingAncestors" ? pr(i) ? [] : V2(i, this._c) : [].concat(l),
      o
    ], h = yg(i, f[0], c);
    let m = h.top, p = h.right, y = h.bottom, v = h.left;
    for (let b = 1; b < f.length; b++) {
      const T = yg(i, f[b], c);
      m = _e(T.top, m), p = bi(T.right, p), y = bi(T.bottom, y), v = _e(T.left, v);
    }
    return {
      width: p - v,
      height: y - m,
      x: v,
      y: m
    };
  }
  function L2(n) {
    const { width: i, height: l } = a0(n);
    return {
      width: i,
      height: l
    };
  }
  function B2(n, i, l) {
    const o = qn(i), c = Sn(i), d = l === "fixed", f = Wi(n, true, d, i);
    let h = {
      scrollLeft: 0,
      scrollTop: 0
    };
    const m = vn(0);
    function p() {
      m.x = gr(c);
    }
    if (o || !o && !d) if ((Wa(i) !== "body" || fl(c)) && (h = yr(i)), o) {
      const T = Wi(i, true, d, i);
      m.x = T.x + i.clientLeft, m.y = T.y + i.clientTop;
    } else c && p();
    d && !o && c && p();
    const y = c && !o && !d ? l0(c, h) : vn(0), v = f.left + h.scrollLeft - m.x - y.x, b = f.top + h.scrollTop - m.y - y.y;
    return {
      x: v,
      y: b,
      width: f.width,
      height: f.height
    };
  }
  function $u(n) {
    return on(n).position === "static";
  }
  function gg(n, i) {
    if (!qn(n) || on(n).position === "fixed") return null;
    if (i) return i(n);
    let l = n.offsetParent;
    return Sn(n) === l && (l = l.ownerDocument.body), l;
  }
  function r0(n, i) {
    const l = Ve(n);
    if (pr(n)) return l;
    if (!qn(n)) {
      let c = xi(n);
      for (; c && !Za(c); ) {
        if (ln(c) && !$u(c)) return c;
        c = xi(c);
      }
      return l;
    }
    let o = gg(n, i);
    for (; o && A2(o) && $u(o); ) o = gg(o, i);
    return o && Za(o) && $u(o) && !rd(o) ? l : o || M2(n) || l;
  }
  const U2 = async function(n) {
    const i = this.getOffsetParent || r0, l = this.getDimensions, o = await l(n.floating);
    return {
      reference: B2(n.reference, await i(n.floating), n.strategy),
      floating: {
        x: 0,
        y: 0,
        width: o.width,
        height: o.height
      }
    };
  };
  function H2(n) {
    return on(n).direction === "rtl";
  }
  const G2 = {
    convertOffsetParentRelativeRectToViewportRelativeRect: O2,
    getDocumentElement: Sn,
    getClippingRect: k2,
    getOffsetParent: r0,
    getElementRects: U2,
    getClientRects: N2,
    getDimensions: L2,
    getScale: Ka,
    isElement: ln,
    isRTL: H2
  };
  function c0(n, i) {
    return n.x === i.x && n.y === i.y && n.width === i.width && n.height === i.height;
  }
  function Y2(n, i) {
    let l = null, o;
    const c = Sn(n);
    function d() {
      var h;
      clearTimeout(o), (h = l) == null || h.disconnect(), l = null;
    }
    function f(h, m) {
      h === void 0 && (h = false), m === void 0 && (m = 1), d();
      const p = n.getBoundingClientRect(), { left: y, top: v, width: b, height: T } = p;
      if (h || i(), !b || !T) return;
      const A = _o(v), C = _o(c.clientWidth - (y + b)), R = _o(c.clientHeight - (v + T)), O = _o(y), z = {
        rootMargin: -A + "px " + -C + "px " + -R + "px " + -O + "px",
        threshold: _e(0, bi(1, m)) || 1
      };
      let _ = true;
      function K(J) {
        const Z = J[0].intersectionRatio;
        if (Z !== m) {
          if (!_) return f();
          Z ? f(false, Z) : o = setTimeout(() => {
            f(false, 1e-7);
          }, 1e3);
        }
        Z === 1 && !c0(p, n.getBoundingClientRect()) && f(), _ = false;
      }
      try {
        l = new IntersectionObserver(K, {
          ...z,
          root: c.ownerDocument
        });
      } catch {
        l = new IntersectionObserver(K, z);
      }
      l.observe(n);
    }
    return f(true), d;
  }
  function q2(n, i, l, o) {
    o === void 0 && (o = {});
    const { ancestorScroll: c = true, ancestorResize: d = true, elementResize: f = typeof ResizeObserver == "function", layoutShift: h = typeof IntersectionObserver == "function", animationFrame: m = false } = o, p = ud(n), y = c || d ? [
      ...p ? sl(p) : [],
      ...i ? sl(i) : []
    ] : [];
    y.forEach((O) => {
      c && O.addEventListener("scroll", l, {
        passive: true
      }), d && O.addEventListener("resize", l);
    });
    const v = p && h ? Y2(p, l) : null;
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
      C && !c0(C, O) && l(), C = O, A = requestAnimationFrame(R);
    }
    return l(), () => {
      var O;
      y.forEach((L) => {
        c && L.removeEventListener("scroll", l), d && L.removeEventListener("resize", l);
      }), v == null ? void 0 : v(), (O = T) == null || O.disconnect(), T = null, m && cancelAnimationFrame(A);
    };
  }
  const P2 = x2, X2 = S2, K2 = g2, Z2 = w2, Q2 = v2, vg = y2, F2 = T2, J2 = (n, i, l) => {
    const o = /* @__PURE__ */ new Map(), c = {
      platform: G2,
      ...l
    }, d = {
      ...c.platform,
      _c: o
    };
    return p2(n, i, {
      ...c,
      platform: d
    });
  };
  var $2 = typeof document < "u", W2 = function() {
  }, qo = $2 ? w.useLayoutEffect : W2;
  function er(n, i) {
    if (n === i) return true;
    if (typeof n != typeof i) return false;
    if (typeof n == "function" && n.toString() === i.toString()) return true;
    let l, o, c;
    if (n && i && typeof n == "object") {
      if (Array.isArray(n)) {
        if (l = n.length, l !== i.length) return false;
        for (o = l; o-- !== 0; ) if (!er(n[o], i[o])) return false;
        return true;
      }
      if (c = Object.keys(n), l = c.length, l !== Object.keys(i).length) return false;
      for (o = l; o-- !== 0; ) if (!{}.hasOwnProperty.call(i, c[o])) return false;
      for (o = l; o-- !== 0; ) {
        const d = c[o];
        if (!(d === "_owner" && n.$$typeof) && !er(n[d], i[d])) return false;
      }
      return true;
    }
    return n !== n && i !== i;
  }
  function u0(n) {
    return typeof window > "u" ? 1 : (n.ownerDocument.defaultView || window).devicePixelRatio || 1;
  }
  function bg(n, i) {
    const l = u0(n);
    return Math.round(i * l) / l;
  }
  function Wu(n) {
    const i = w.useRef(n);
    return qo(() => {
      i.current = n;
    }), i;
  }
  function I2(n) {
    n === void 0 && (n = {});
    const { placement: i = "bottom", strategy: l = "absolute", middleware: o = [], platform: c, elements: { reference: d, floating: f } = {}, transform: h = true, whileElementsMounted: m, open: p } = n, [y, v] = w.useState({
      x: 0,
      y: 0,
      strategy: l,
      placement: i,
      middlewareData: {},
      isPositioned: false
    }), [b, T] = w.useState(o);
    er(b, o) || T(o);
    const [A, C] = w.useState(null), [R, O] = w.useState(null), L = w.useCallback((k) => {
      k !== J.current && (J.current = k, C(k));
    }, []), z = w.useCallback((k) => {
      k !== Z.current && (Z.current = k, O(k));
    }, []), _ = d || A, K = f || R, J = w.useRef(null), Z = w.useRef(null), Y = w.useRef(y), tt = m != null, W = Wu(m), nt = Wu(c), at = Wu(p), pt = w.useCallback(() => {
      if (!J.current || !Z.current) return;
      const k = {
        placement: i,
        strategy: l,
        middleware: b
      };
      nt.current && (k.platform = nt.current), J2(J.current, Z.current, k).then(($) => {
        const P = {
          ...$,
          isPositioned: at.current !== false
        };
        dt.current && !er(Y.current, P) && (Y.current = P, Fv.flushSync(() => {
          v(P);
        }));
      });
    }, [
      b,
      i,
      l,
      nt,
      at
    ]);
    qo(() => {
      p === false && Y.current.isPositioned && (Y.current.isPositioned = false, v((k) => ({
        ...k,
        isPositioned: false
      })));
    }, [
      p
    ]);
    const dt = w.useRef(false);
    qo(() => (dt.current = true, () => {
      dt.current = false;
    }), []), qo(() => {
      if (_ && (J.current = _), K && (Z.current = K), _ && K) {
        if (W.current) return W.current(_, K, pt);
        pt();
      }
    }, [
      _,
      K,
      pt,
      W,
      tt
    ]);
    const ht = w.useMemo(() => ({
      reference: J,
      floating: Z,
      setReference: L,
      setFloating: z
    }), [
      L,
      z
    ]), V = w.useMemo(() => ({
      reference: _,
      floating: K
    }), [
      _,
      K
    ]), N = w.useMemo(() => {
      const k = {
        position: l,
        left: 0,
        top: 0
      };
      if (!V.floating) return k;
      const $ = bg(V.floating, y.x), P = bg(V.floating, y.y);
      return h ? {
        ...k,
        transform: "translate(" + $ + "px, " + P + "px)",
        ...u0(V.floating) >= 1.5 && {
          willChange: "transform"
        }
      } : {
        position: l,
        left: $,
        top: P
      };
    }, [
      l,
      h,
      V.floating,
      y.x,
      y.y
    ]);
    return w.useMemo(() => ({
      ...y,
      update: pt,
      refs: ht,
      elements: V,
      floatingStyles: N
    }), [
      y,
      pt,
      ht,
      V,
      N
    ]);
  }
  const tw = (n) => {
    function i(l) {
      return {}.hasOwnProperty.call(l, "current");
    }
    return {
      name: "arrow",
      options: n,
      fn(l) {
        const { element: o, padding: c } = typeof n == "function" ? n(l) : n;
        return o && i(o) ? o.current != null ? vg({
          element: o.current,
          padding: c
        }).fn(l) : {} : o ? vg({
          element: o,
          padding: c
        }).fn(l) : {};
      }
    };
  }, ew = (n, i) => {
    const l = P2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
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
  }, iw = (n, i) => ({
    fn: F2(n).fn,
    options: [
      n,
      i
    ]
  }), aw = (n, i) => {
    const l = K2(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  }, sw = (n, i) => {
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
    const l = tw(n);
    return {
      name: l.name,
      fn: l.fn,
      options: [
        n,
        i
      ]
    };
  };
  var rw = "Arrow", f0 = w.forwardRef((n, i) => {
    const { children: l, width: o = 10, height: c = 5, ...d } = n;
    return S.jsx(Je.svg, {
      ...d,
      ref: i,
      width: o,
      height: c,
      viewBox: "0 0 30 10",
      preserveAspectRatio: "none",
      children: n.asChild ? l : S.jsx("polygon", {
        points: "0,0 30,0 15,10"
      })
    });
  });
  f0.displayName = rw;
  var cw = f0;
  function d0(n) {
    const [i, l] = w.useState(void 0);
    return $i(() => {
      if (n) {
        l({
          width: n.offsetWidth,
          height: n.offsetHeight
        });
        const o = new ResizeObserver((c) => {
          if (!Array.isArray(c) || !c.length) return;
          const d = c[0];
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
  var fd = "Popper", [h0, m0] = dr(fd), [uw, p0] = h0(fd), y0 = (n) => {
    const { __scopePopper: i, children: l } = n, [o, c] = w.useState(null);
    return S.jsx(uw, {
      scope: i,
      anchor: o,
      onAnchorChange: c,
      children: l
    });
  };
  y0.displayName = fd;
  var g0 = "PopperAnchor", v0 = w.forwardRef((n, i) => {
    const { __scopePopper: l, virtualRef: o, ...c } = n, d = p0(g0, l), f = w.useRef(null), h = ye(i, f), m = w.useRef(null);
    return w.useEffect(() => {
      const p = m.current;
      m.current = (o == null ? void 0 : o.current) || f.current, p !== m.current && d.onAnchorChange(m.current);
    }), o ? null : S.jsx(Je.div, {
      ...c,
      ref: h
    });
  });
  v0.displayName = g0;
  var dd = "PopperContent", [fw, dw] = h0(dd), b0 = w.forwardRef((n, i) => {
    var _a, _b2, _c, _d2, _e2, _f2;
    const { __scopePopper: l, side: o = "bottom", sideOffset: c = 0, align: d = "center", alignOffset: f = 0, arrowPadding: h = 0, avoidCollisions: m = true, collisionBoundary: p = [], collisionPadding: y = 0, sticky: v = "partial", hideWhenDetached: b = false, updatePositionStrategy: T = "optimized", onPlaced: A, ...C } = n, R = p0(dd, l), [O, L] = w.useState(null), z = ye(i, (yt) => L(yt)), [_, K] = w.useState(null), J = d0(_), Z = (J == null ? void 0 : J.width) ?? 0, Y = (J == null ? void 0 : J.height) ?? 0, tt = o + (d !== "center" ? "-" + d : ""), W = typeof y == "number" ? y : {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      ...y
    }, nt = Array.isArray(p) ? p : [
      p
    ], at = nt.length > 0, pt = {
      padding: W,
      boundary: nt.filter(mw),
      altBoundary: at
    }, { refs: dt, floatingStyles: ht, placement: V, isPositioned: N, middlewareData: k } = I2({
      strategy: "fixed",
      placement: tt,
      whileElementsMounted: (...yt) => q2(...yt, {
        animationFrame: T === "always"
      }),
      elements: {
        reference: R.anchor
      },
      middleware: [
        ew({
          mainAxis: c + Y,
          alignmentAxis: f
        }),
        m && nw({
          mainAxis: true,
          crossAxis: false,
          limiter: v === "partial" ? iw() : void 0,
          ...pt
        }),
        m && aw({
          ...pt
        }),
        sw({
          ...pt,
          apply: ({ elements: yt, rects: Xt, availableWidth: vt, availableHeight: cn }) => {
            const { width: $e, height: un } = Xt.reference, We = yt.floating.style;
            We.setProperty("--radix-popper-available-width", `${vt}px`), We.setProperty("--radix-popper-available-height", `${cn}px`), We.setProperty("--radix-popper-anchor-width", `${$e}px`), We.setProperty("--radix-popper-anchor-height", `${un}px`);
          }
        }),
        _ && ow({
          element: _,
          padding: h
        }),
        pw({
          arrowWidth: Z,
          arrowHeight: Y
        }),
        b && lw({
          strategy: "referenceHidden",
          ...pt
        })
      ]
    }), [$, P] = T0(V), E = hr(A);
    $i(() => {
      N && (E == null ? void 0 : E());
    }, [
      N,
      E
    ]);
    const B = (_a = k.arrow) == null ? void 0 : _a.x, I = (_b2 = k.arrow) == null ? void 0 : _b2.y, et = ((_c = k.arrow) == null ? void 0 : _c.centerOffset) !== 0, [it, ut] = w.useState();
    return $i(() => {
      O && ut(window.getComputedStyle(O).zIndex);
    }, [
      O
    ]), S.jsx("div", {
      ref: dt.setFloating,
      "data-radix-popper-content-wrapper": "",
      style: {
        ...ht,
        transform: N ? ht.transform : "translate(0, -200%)",
        minWidth: "max-content",
        zIndex: it,
        "--radix-popper-transform-origin": [
          (_d2 = k.transformOrigin) == null ? void 0 : _d2.x,
          (_e2 = k.transformOrigin) == null ? void 0 : _e2.y
        ].join(" "),
        ...((_f2 = k.hide) == null ? void 0 : _f2.referenceHidden) && {
          visibility: "hidden",
          pointerEvents: "none"
        }
      },
      dir: n.dir,
      children: S.jsx(fw, {
        scope: l,
        placedSide: $,
        onArrowChange: K,
        arrowX: B,
        arrowY: I,
        shouldHideArrow: et,
        children: S.jsx(Je.div, {
          "data-side": $,
          "data-align": P,
          ...C,
          ref: z,
          style: {
            ...C.style,
            animation: N ? void 0 : "none"
          }
        })
      })
    });
  });
  b0.displayName = dd;
  var x0 = "PopperArrow", hw = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right"
  }, S0 = w.forwardRef(function(i, l) {
    const { __scopePopper: o, ...c } = i, d = dw(x0, o), f = hw[d.placedSide];
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
      children: S.jsx(cw, {
        ...c,
        ref: l,
        style: {
          ...c.style,
          display: "block"
        }
      })
    });
  });
  S0.displayName = x0;
  function mw(n) {
    return n !== null;
  }
  var pw = (n) => ({
    name: "transformOrigin",
    options: n,
    fn(i) {
      var _a, _b2, _c;
      const { placement: l, rects: o, middlewareData: c } = i, f = ((_a = c.arrow) == null ? void 0 : _a.centerOffset) !== 0, h = f ? 0 : n.arrowWidth, m = f ? 0 : n.arrowHeight, [p, y] = T0(l), v = {
        start: "0%",
        center: "50%",
        end: "100%"
      }[y], b = (((_b2 = c.arrow) == null ? void 0 : _b2.x) ?? 0) + h / 2, T = (((_c = c.arrow) == null ? void 0 : _c.y) ?? 0) + m / 2;
      let A = "", C = "";
      return p === "bottom" ? (A = f ? v : `${b}px`, C = `${-m}px`) : p === "top" ? (A = f ? v : `${b}px`, C = `${o.floating.height + m}px`) : p === "right" ? (A = `${-m}px`, C = f ? v : `${T}px`) : p === "left" && (A = `${o.floating.width + m}px`, C = f ? v : `${T}px`), {
        data: {
          x: A,
          y: C
        }
      };
    }
  });
  function T0(n) {
    const [i, l = "center"] = n.split("-");
    return [
      i,
      l
    ];
  }
  var yw = y0, gw = v0, vw = b0, bw = S0;
  function xw(n, i) {
    return w.useReducer((l, o) => i[l][o] ?? l, n);
  }
  var w0 = (n) => {
    const { present: i, children: l } = n, o = Sw(i), c = typeof l == "function" ? l({
      present: o.isPresent
    }) : w.Children.only(l), d = ye(o.ref, Tw(c));
    return typeof l == "function" || o.isPresent ? w.cloneElement(c, {
      ref: d
    }) : null;
  };
  w0.displayName = "Presence";
  function Sw(n) {
    const [i, l] = w.useState(), o = w.useRef(null), c = w.useRef(n), d = w.useRef("none"), f = n ? "mounted" : "unmounted", [h, m] = xw(f, {
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
      const p = Vo(o.current);
      d.current = h === "mounted" ? p : "none";
    }, [
      h
    ]), $i(() => {
      const p = o.current, y = c.current;
      if (y !== n) {
        const b = d.current, T = Vo(p);
        n ? m("MOUNT") : T === "none" || (p == null ? void 0 : p.display) === "none" ? m("UNMOUNT") : m(y && b !== T ? "ANIMATION_OUT" : "UNMOUNT"), c.current = n;
      }
    }, [
      n,
      m
    ]), $i(() => {
      if (i) {
        let p;
        const y = i.ownerDocument.defaultView ?? window, v = (T) => {
          const C = Vo(o.current).includes(CSS.escape(T.animationName));
          if (T.target === i && C && (m("ANIMATION_END"), !c.current)) {
            const R = i.style.animationFillMode;
            i.style.animationFillMode = "forwards", p = y.setTimeout(() => {
              i.style.animationFillMode === "forwards" && (i.style.animationFillMode = R);
            });
          }
        }, b = (T) => {
          T.target === i && (d.current = Vo(o.current));
        };
        return i.addEventListener("animationstart", b), i.addEventListener("animationcancel", v), i.addEventListener("animationend", v), () => {
          y.clearTimeout(p), i.removeEventListener("animationstart", b), i.removeEventListener("animationcancel", v), i.removeEventListener("animationend", v);
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
  function Vo(n) {
    return (n == null ? void 0 : n.animationName) || "none";
  }
  function Tw(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  var ww = id[" useInsertionEffect ".trim().toString()] || $i;
  function A0({ prop: n, defaultProp: i, onChange: l = () => {
  }, caller: o }) {
    const [c, d, f] = Aw({
      defaultProp: i,
      onChange: l
    }), h = n !== void 0, m = h ? n : c;
    {
      const y = w.useRef(n !== void 0);
      w.useEffect(() => {
        const v = y.current;
        v !== h && console.warn(`${o} is changing from ${v ? "controlled" : "uncontrolled"} to ${h ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`), y.current = h;
      }, [
        h,
        o
      ]);
    }
    const p = w.useCallback((y) => {
      var _a;
      if (h) {
        const v = Ew(y) ? y(n) : y;
        v !== n && ((_a = f.current) == null ? void 0 : _a.call(f, v));
      } else d(y);
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
  function Aw({ defaultProp: n, onChange: i }) {
    const [l, o] = w.useState(n), c = w.useRef(l), d = w.useRef(i);
    return ww(() => {
      d.current = i;
    }, [
      i
    ]), w.useEffect(() => {
      var _a;
      c.current !== l && ((_a = d.current) == null ? void 0 : _a.call(d, l), c.current = l);
    }, [
      l,
      c
    ]), [
      l,
      o,
      d
    ];
  }
  function Ew(n) {
    return typeof n == "function";
  }
  var Cw = Object.freeze({
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
  }), Mw = "VisuallyHidden", E0 = w.forwardRef((n, i) => S.jsx(Je.span, {
    ...n,
    ref: i,
    style: {
      ...Cw,
      ...n.style
    }
  }));
  E0.displayName = Mw;
  var Rw = E0, [vr] = dr("Tooltip", [
    m0
  ]), br = m0(), C0 = "TooltipProvider", Dw = 700, Af = "tooltip.open", [Ow, hd] = vr(C0), M0 = (n) => {
    const { __scopeTooltip: i, delayDuration: l = Dw, skipDelayDuration: o = 300, disableHoverableContent: c = false, children: d } = n, f = w.useRef(true), h = w.useRef(false), m = w.useRef(0);
    return w.useEffect(() => {
      const p = m.current;
      return () => window.clearTimeout(p);
    }, []), S.jsx(Ow, {
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
      disableHoverableContent: c,
      children: d
    });
  };
  M0.displayName = C0;
  var ll = "Tooltip", [Nw, xr] = vr(ll), R0 = (n) => {
    const { __scopeTooltip: i, children: l, open: o, defaultOpen: c, onOpenChange: d, disableHoverableContent: f, delayDuration: h } = n, m = hd(ll, n.__scopeTooltip), p = br(i), [y, v] = w.useState(null), b = i2(), T = w.useRef(0), A = f ?? m.disableHoverableContent, C = h ?? m.delayDuration, R = w.useRef(false), [O, L] = A0({
      prop: o,
      defaultProp: c ?? false,
      onChange: (Z) => {
        Z ? (m.onOpen(), document.dispatchEvent(new CustomEvent(Af))) : m.onClose(), d == null ? void 0 : d(Z);
      },
      caller: ll
    }), z = w.useMemo(() => O ? R.current ? "delayed-open" : "instant-open" : "closed", [
      O
    ]), _ = w.useCallback(() => {
      window.clearTimeout(T.current), T.current = 0, R.current = false, L(true);
    }, [
      L
    ]), K = w.useCallback(() => {
      window.clearTimeout(T.current), T.current = 0, L(false);
    }, [
      L
    ]), J = w.useCallback(() => {
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
        trigger: y,
        onTriggerChange: v,
        onTriggerEnter: w.useCallback(() => {
          m.isOpenDelayedRef.current ? J() : _();
        }, [
          m.isOpenDelayedRef,
          J,
          _
        ]),
        onTriggerLeave: w.useCallback(() => {
          A ? K() : (window.clearTimeout(T.current), T.current = 0);
        }, [
          K,
          A
        ]),
        onOpen: _,
        onClose: K,
        disableHoverableContent: A,
        children: l
      })
    });
  };
  R0.displayName = ll;
  var Ef = "TooltipTrigger", D0 = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, ...o } = n, c = xr(Ef, l), d = hd(Ef, l), f = br(l), h = w.useRef(null), m = ye(i, h, c.onTriggerChange), p = w.useRef(false), y = w.useRef(false), v = w.useCallback(() => p.current = false, []);
    return w.useEffect(() => () => document.removeEventListener("pointerup", v), [
      v
    ]), S.jsx(gw, {
      asChild: true,
      ...f,
      children: S.jsx(Je.button, {
        "aria-describedby": c.open ? c.contentId : void 0,
        "data-state": c.stateAttribute,
        ...o,
        ref: m,
        onPointerMove: he(n.onPointerMove, (b) => {
          b.pointerType !== "touch" && !y.current && !d.isPointerInTransitRef.current && (c.onTriggerEnter(), y.current = true);
        }),
        onPointerLeave: he(n.onPointerLeave, () => {
          c.onTriggerLeave(), y.current = false;
        }),
        onPointerDown: he(n.onPointerDown, () => {
          c.open && c.onClose(), p.current = true, document.addEventListener("pointerup", v, {
            once: true
          });
        }),
        onFocus: he(n.onFocus, () => {
          p.current || c.onOpen();
        }),
        onBlur: he(n.onBlur, c.onClose),
        onClick: he(n.onClick, c.onClose)
      })
    });
  });
  D0.displayName = Ef;
  var jw = "TooltipPortal", [QO, zw] = vr(jw, {
    forceMount: void 0
  }), Qa = "TooltipContent", O0 = w.forwardRef((n, i) => {
    const l = zw(Qa, n.__scopeTooltip), { forceMount: o = l.forceMount, side: c = "top", ...d } = n, f = xr(Qa, n.__scopeTooltip);
    return S.jsx(w0, {
      present: o || f.open,
      children: f.disableHoverableContent ? S.jsx(N0, {
        side: c,
        ...d,
        ref: i
      }) : S.jsx(_w, {
        side: c,
        ...d,
        ref: i
      })
    });
  }), _w = w.forwardRef((n, i) => {
    const l = xr(Qa, n.__scopeTooltip), o = hd(Qa, n.__scopeTooltip), c = w.useRef(null), d = ye(i, c), [f, h] = w.useState(null), { trigger: m, onClose: p } = l, y = c.current, { onPointerInTransitChange: v } = o, b = w.useCallback(() => {
      h(null), v(false);
    }, [
      v
    ]), T = w.useCallback((A, C) => {
      const R = A.currentTarget, O = {
        x: A.clientX,
        y: A.clientY
      }, L = Uw(O, R.getBoundingClientRect()), z = Hw(O, L), _ = Gw(C.getBoundingClientRect()), K = qw([
        ...z,
        ..._
      ]);
      h(K), v(true);
    }, [
      v
    ]);
    return w.useEffect(() => () => b(), [
      b
    ]), w.useEffect(() => {
      if (m && y) {
        const A = (R) => T(R, y), C = (R) => T(R, m);
        return m.addEventListener("pointerleave", A), y.addEventListener("pointerleave", C), () => {
          m.removeEventListener("pointerleave", A), y.removeEventListener("pointerleave", C);
        };
      }
    }, [
      m,
      y,
      T,
      b
    ]), w.useEffect(() => {
      if (f) {
        const A = (C) => {
          const R = C.target, O = {
            x: C.clientX,
            y: C.clientY
          }, L = (m == null ? void 0 : m.contains(R)) || (y == null ? void 0 : y.contains(R)), z = !Yw(O, f);
          L ? b() : z && (b(), p());
        };
        return document.addEventListener("pointermove", A), () => document.removeEventListener("pointermove", A);
      }
    }, [
      m,
      y,
      f,
      p,
      b
    ]), S.jsx(N0, {
      ...n,
      ref: d
    });
  }), [Vw, kw] = vr(ll, {
    isInside: false
  }), Lw = GT("TooltipContent"), N0 = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, children: o, "aria-label": c, onEscapeKeyDown: d, onPointerDownOutside: f, ...h } = n, m = xr(Qa, l), p = br(l), { onClose: y } = m;
    return w.useEffect(() => (document.addEventListener(Af, y), () => document.removeEventListener(Af, y)), [
      y
    ]), w.useEffect(() => {
      if (m.trigger) {
        const v = (b) => {
          var _a;
          ((_a = b.target) == null ? void 0 : _a.contains(m.trigger)) && y();
        };
        return window.addEventListener("scroll", v, {
          capture: true
        }), () => window.removeEventListener("scroll", v, {
          capture: true
        });
      }
    }, [
      m.trigger,
      y
    ]), S.jsx(Wv, {
      asChild: true,
      disableOutsidePointerEvents: false,
      onEscapeKeyDown: d,
      onPointerDownOutside: f,
      onFocusOutside: (v) => v.preventDefault(),
      onDismiss: y,
      children: S.jsxs(vw, {
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
          S.jsx(Lw, {
            children: o
          }),
          S.jsx(Vw, {
            scope: l,
            isInside: true,
            children: S.jsx(Rw, {
              id: m.contentId,
              role: "tooltip",
              children: c || o
            })
          })
        ]
      })
    });
  });
  O0.displayName = Qa;
  var j0 = "TooltipArrow", Bw = w.forwardRef((n, i) => {
    const { __scopeTooltip: l, ...o } = n, c = br(l);
    return kw(j0, l).isInside ? null : S.jsx(bw, {
      ...c,
      ...o,
      ref: i
    });
  });
  Bw.displayName = j0;
  function Uw(n, i) {
    const l = Math.abs(i.top - n.y), o = Math.abs(i.bottom - n.y), c = Math.abs(i.right - n.x), d = Math.abs(i.left - n.x);
    switch (Math.min(l, o, c, d)) {
      case d:
        return "left";
      case c:
        return "right";
      case l:
        return "top";
      case o:
        return "bottom";
      default:
        throw new Error("unreachable");
    }
  }
  function Hw(n, i, l = 5) {
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
  function Gw(n) {
    const { top: i, right: l, bottom: o, left: c } = n;
    return [
      {
        x: c,
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
        x: c,
        y: o
      }
    ];
  }
  function Yw(n, i) {
    const { x: l, y: o } = n;
    let c = false;
    for (let d = 0, f = i.length - 1; d < i.length; f = d++) {
      const h = i[d], m = i[f], p = h.x, y = h.y, v = m.x, b = m.y;
      y > o != b > o && l < (v - p) * (o - y) / (b - y) + p && (c = !c);
    }
    return c;
  }
  function qw(n) {
    const i = n.slice();
    return i.sort((l, o) => l.x < o.x ? -1 : l.x > o.x ? 1 : l.y < o.y ? -1 : l.y > o.y ? 1 : 0), Pw(i);
  }
  function Pw(n) {
    if (n.length <= 1) return n.slice();
    const i = [];
    for (let o = 0; o < n.length; o++) {
      const c = n[o];
      for (; i.length >= 2; ) {
        const d = i[i.length - 1], f = i[i.length - 2];
        if ((d.x - f.x) * (c.y - f.y) >= (d.y - f.y) * (c.x - f.x)) i.pop();
        else break;
      }
      i.push(c);
    }
    i.pop();
    const l = [];
    for (let o = n.length - 1; o >= 0; o--) {
      const c = n[o];
      for (; l.length >= 2; ) {
        const d = l[l.length - 1], f = l[l.length - 2];
        if ((d.x - f.x) * (c.y - f.y) >= (d.y - f.y) * (c.x - f.x)) l.pop();
        else break;
      }
      l.push(c);
    }
    return l.pop(), i.length === 1 && l.length === 1 && i[0].x === l[0].x && i[0].y === l[0].y ? i : i.concat(l);
  }
  var Xw = M0, Kw = R0, Zw = D0, z0 = O0;
  function _0(n) {
    var i, l, o = "";
    if (typeof n == "string" || typeof n == "number") o += n;
    else if (typeof n == "object") if (Array.isArray(n)) {
      var c = n.length;
      for (i = 0; i < c; i++) n[i] && (l = _0(n[i])) && (o && (o += " "), o += l);
    } else for (l in n) n[l] && (o && (o += " "), o += l);
    return o;
  }
  function V0() {
    for (var n, i, l = 0, o = "", c = arguments.length; l < c; l++) (n = arguments[l]) && (i = _0(n)) && (o && (o += " "), o += i);
    return o;
  }
  const Qw = (n, i) => {
    const l = new Array(n.length + i.length);
    for (let o = 0; o < n.length; o++) l[o] = n[o];
    for (let o = 0; o < i.length; o++) l[n.length + o] = i[o];
    return l;
  }, Fw = (n, i) => ({
    classGroupId: n,
    validator: i
  }), k0 = (n = /* @__PURE__ */ new Map(), i = null, l) => ({
    nextPart: n,
    validators: i,
    classGroupId: l
  }), nr = "-", xg = [], Jw = "arbitrary..", $w = (n) => {
    const i = Iw(n), { conflictingClassGroups: l, conflictingClassGroupModifiers: o } = n;
    return {
      getClassGroupId: (f) => {
        if (f.startsWith("[") && f.endsWith("]")) return Ww(f);
        const h = f.split(nr), m = h[0] === "" && h.length > 1 ? 1 : 0;
        return L0(h, m, i);
      },
      getConflictingClassGroupIds: (f, h) => {
        if (h) {
          const m = o[f], p = l[f];
          return m ? p ? Qw(p, m) : m : p || xg;
        }
        return l[f] || xg;
      }
    };
  }, L0 = (n, i, l) => {
    if (n.length - i === 0) return l.classGroupId;
    const c = n[i], d = l.nextPart.get(c);
    if (d) {
      const p = L0(n, i + 1, d);
      if (p) return p;
    }
    const f = l.validators;
    if (f === null) return;
    const h = i === 0 ? n.join(nr) : n.slice(i).join(nr), m = f.length;
    for (let p = 0; p < m; p++) {
      const y = f[p];
      if (y.validator(h)) return y.classGroupId;
    }
  }, Ww = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
    const i = n.slice(1, -1), l = i.indexOf(":"), o = i.slice(0, l);
    return o ? Jw + o : void 0;
  })(), Iw = (n) => {
    const { theme: i, classGroups: l } = n;
    return tA(l, i);
  }, tA = (n, i) => {
    const l = k0();
    for (const o in n) {
      const c = n[o];
      md(c, l, o, i);
    }
    return l;
  }, md = (n, i, l, o) => {
    const c = n.length;
    for (let d = 0; d < c; d++) {
      const f = n[d];
      eA(f, i, l, o);
    }
  }, eA = (n, i, l, o) => {
    if (typeof n == "string") {
      nA(n, i, l);
      return;
    }
    if (typeof n == "function") {
      iA(n, i, l, o);
      return;
    }
    aA(n, i, l, o);
  }, nA = (n, i, l) => {
    const o = n === "" ? i : B0(i, n);
    o.classGroupId = l;
  }, iA = (n, i, l, o) => {
    if (sA(n)) {
      md(n(o), i, l, o);
      return;
    }
    i.validators === null && (i.validators = []), i.validators.push(Fw(l, n));
  }, aA = (n, i, l, o) => {
    const c = Object.entries(n), d = c.length;
    for (let f = 0; f < d; f++) {
      const [h, m] = c[f];
      md(m, B0(i, h), l, o);
    }
  }, B0 = (n, i) => {
    let l = n;
    const o = i.split(nr), c = o.length;
    for (let d = 0; d < c; d++) {
      const f = o[d];
      let h = l.nextPart.get(f);
      h || (h = k0(), l.nextPart.set(f, h)), l = h;
    }
    return l;
  }, sA = (n) => "isThemeGetter" in n && n.isThemeGetter === true, lA = (n) => {
    if (n < 1) return {
      get: () => {
      },
      set: () => {
      }
    };
    let i = 0, l = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
    const c = (d, f) => {
      l[d] = f, i++, i > n && (i = 0, o = l, l = /* @__PURE__ */ Object.create(null));
    };
    return {
      get(d) {
        let f = l[d];
        if (f !== void 0) return f;
        if ((f = o[d]) !== void 0) return c(d, f), f;
      },
      set(d, f) {
        d in l ? l[d] = f : c(d, f);
      }
    };
  }, Cf = "!", Sg = ":", oA = [], Tg = (n, i, l, o, c) => ({
    modifiers: n,
    hasImportantModifier: i,
    baseClassName: l,
    maybePostfixModifierPosition: o,
    isExternal: c
  }), rA = (n) => {
    const { prefix: i, experimentalParseClassName: l } = n;
    let o = (c) => {
      const d = [];
      let f = 0, h = 0, m = 0, p;
      const y = c.length;
      for (let C = 0; C < y; C++) {
        const R = c[C];
        if (f === 0 && h === 0) {
          if (R === Sg) {
            d.push(c.slice(m, C)), m = C + 1;
            continue;
          }
          if (R === "/") {
            p = C;
            continue;
          }
        }
        R === "[" ? f++ : R === "]" ? f-- : R === "(" ? h++ : R === ")" && h--;
      }
      const v = d.length === 0 ? c : c.slice(m);
      let b = v, T = false;
      v.endsWith(Cf) ? (b = v.slice(0, -1), T = true) : v.startsWith(Cf) && (b = v.slice(1), T = true);
      const A = p && p > m ? p - m : void 0;
      return Tg(d, T, b, A);
    };
    if (i) {
      const c = i + Sg, d = o;
      o = (f) => f.startsWith(c) ? d(f.slice(c.length)) : Tg(oA, false, f, void 0, true);
    }
    if (l) {
      const c = o;
      o = (d) => l({
        className: d,
        parseClassName: c
      });
    }
    return o;
  }, cA = (n) => {
    const i = /* @__PURE__ */ new Map();
    return n.orderSensitiveModifiers.forEach((l, o) => {
      i.set(l, 1e6 + o);
    }), (l) => {
      const o = [];
      let c = [];
      for (let d = 0; d < l.length; d++) {
        const f = l[d], h = f[0] === "[", m = i.has(f);
        h || m ? (c.length > 0 && (c.sort(), o.push(...c), c = []), o.push(f)) : c.push(f);
      }
      return c.length > 0 && (c.sort(), o.push(...c)), o;
    };
  }, uA = (n) => ({
    cache: lA(n.cacheSize),
    parseClassName: rA(n),
    sortModifiers: cA(n),
    ...$w(n)
  }), fA = /\s+/, dA = (n, i) => {
    const { parseClassName: l, getClassGroupId: o, getConflictingClassGroupIds: c, sortModifiers: d } = i, f = [], h = n.trim().split(fA);
    let m = "";
    for (let p = h.length - 1; p >= 0; p -= 1) {
      const y = h[p], { isExternal: v, modifiers: b, hasImportantModifier: T, baseClassName: A, maybePostfixModifierPosition: C } = l(y);
      if (v) {
        m = y + (m.length > 0 ? " " + m : m);
        continue;
      }
      let R = !!C, O = o(R ? A.substring(0, C) : A);
      if (!O) {
        if (!R) {
          m = y + (m.length > 0 ? " " + m : m);
          continue;
        }
        if (O = o(A), !O) {
          m = y + (m.length > 0 ? " " + m : m);
          continue;
        }
        R = false;
      }
      const L = b.length === 0 ? "" : b.length === 1 ? b[0] : d(b).join(":"), z = T ? L + Cf : L, _ = z + O;
      if (f.indexOf(_) > -1) continue;
      f.push(_);
      const K = c(O, R);
      for (let J = 0; J < K.length; ++J) {
        const Z = K[J];
        f.push(z + Z);
      }
      m = y + (m.length > 0 ? " " + m : m);
    }
    return m;
  }, hA = (...n) => {
    let i = 0, l, o, c = "";
    for (; i < n.length; ) (l = n[i++]) && (o = U0(l)) && (c && (c += " "), c += o);
    return c;
  }, U0 = (n) => {
    if (typeof n == "string") return n;
    let i, l = "";
    for (let o = 0; o < n.length; o++) n[o] && (i = U0(n[o])) && (l && (l += " "), l += i);
    return l;
  }, mA = (n, ...i) => {
    let l, o, c, d;
    const f = (m) => {
      const p = i.reduce((y, v) => v(y), n());
      return l = uA(p), o = l.cache.get, c = l.cache.set, d = h, h(m);
    }, h = (m) => {
      const p = o(m);
      if (p) return p;
      const y = dA(m, l);
      return c(m, y), y;
    };
    return d = f, (...m) => d(hA(...m));
  }, pA = [], te = (n) => {
    const i = (l) => l[n] || pA;
    return i.isThemeGetter = true, i;
  }, H0 = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, G0 = /^\((?:(\w[\w-]*):)?(.+)\)$/i, yA = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, gA = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, vA = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, bA = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, xA = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, SA = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, pi = (n) => yA.test(n), St = (n) => !!n && !Number.isNaN(Number(n)), yi = (n) => !!n && Number.isInteger(Number(n)), Iu = (n) => n.endsWith("%") && St(n.slice(0, -1)), Hn = (n) => gA.test(n), Y0 = () => true, TA = (n) => vA.test(n) && !bA.test(n), pd = () => false, wA = (n) => xA.test(n), AA = (n) => SA.test(n), EA = (n) => !lt(n) && !rt(n), CA = (n) => wi(n, X0, pd), lt = (n) => H0.test(n), Pi = (n) => wi(n, K0, TA), wg = (n) => wi(n, _A, St), MA = (n) => wi(n, Q0, Y0), RA = (n) => wi(n, Z0, pd), Ag = (n) => wi(n, q0, pd), DA = (n) => wi(n, P0, AA), ko = (n) => wi(n, F0, wA), rt = (n) => G0.test(n), Ws = (n) => Ii(n, K0), OA = (n) => Ii(n, Z0), Eg = (n) => Ii(n, q0), NA = (n) => Ii(n, X0), jA = (n) => Ii(n, P0), Lo = (n) => Ii(n, F0, true), zA = (n) => Ii(n, Q0, true), wi = (n, i, l) => {
    const o = H0.exec(n);
    return o ? o[1] ? i(o[1]) : l(o[2]) : false;
  }, Ii = (n, i, l = false) => {
    const o = G0.exec(n);
    return o ? o[1] ? i(o[1]) : l : false;
  }, q0 = (n) => n === "position" || n === "percentage", P0 = (n) => n === "image" || n === "url", X0 = (n) => n === "length" || n === "size" || n === "bg-size", K0 = (n) => n === "length", _A = (n) => n === "number", Z0 = (n) => n === "family-name", Q0 = (n) => n === "number" || n === "weight", F0 = (n) => n === "shadow", VA = () => {
    const n = te("color"), i = te("font"), l = te("text"), o = te("font-weight"), c = te("tracking"), d = te("leading"), f = te("breakpoint"), h = te("container"), m = te("spacing"), p = te("radius"), y = te("shadow"), v = te("inset-shadow"), b = te("text-shadow"), T = te("drop-shadow"), A = te("blur"), C = te("perspective"), R = te("aspect"), O = te("ease"), L = te("animate"), z = () => [
      "auto",
      "avoid",
      "all",
      "avoid-page",
      "page",
      "left",
      "right",
      "column"
    ], _ = () => [
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
    ], K = () => [
      ..._(),
      rt,
      lt
    ], J = () => [
      "auto",
      "hidden",
      "clip",
      "visible",
      "scroll"
    ], Z = () => [
      "auto",
      "contain",
      "none"
    ], Y = () => [
      rt,
      lt,
      m
    ], tt = () => [
      pi,
      "full",
      "auto",
      ...Y()
    ], W = () => [
      yi,
      "none",
      "subgrid",
      rt,
      lt
    ], nt = () => [
      "auto",
      {
        span: [
          "full",
          yi,
          rt,
          lt
        ]
      },
      yi,
      rt,
      lt
    ], at = () => [
      yi,
      "auto",
      rt,
      lt
    ], pt = () => [
      "auto",
      "min",
      "max",
      "fr",
      rt,
      lt
    ], dt = () => [
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
    ], ht = () => [
      "start",
      "end",
      "center",
      "stretch",
      "center-safe",
      "end-safe"
    ], V = () => [
      "auto",
      ...Y()
    ], N = () => [
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
      ...Y()
    ], k = () => [
      pi,
      "screen",
      "full",
      "dvw",
      "lvw",
      "svw",
      "min",
      "max",
      "fit",
      ...Y()
    ], $ = () => [
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
      ...Y()
    ], P = () => [
      n,
      rt,
      lt
    ], E = () => [
      ..._(),
      Eg,
      Ag,
      {
        position: [
          rt,
          lt
        ]
      }
    ], B = () => [
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
    ], I = () => [
      "auto",
      "cover",
      "contain",
      NA,
      CA,
      {
        size: [
          rt,
          lt
        ]
      }
    ], et = () => [
      Iu,
      Ws,
      Pi
    ], it = () => [
      "",
      "none",
      "full",
      p,
      rt,
      lt
    ], ut = () => [
      "",
      St,
      Ws,
      Pi
    ], yt = () => [
      "solid",
      "dashed",
      "dotted",
      "double"
    ], Xt = () => [
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
      Iu,
      Eg,
      Ag
    ], cn = () => [
      "",
      "none",
      A,
      rt,
      lt
    ], $e = () => [
      "none",
      St,
      rt,
      lt
    ], un = () => [
      "none",
      St,
      rt,
      lt
    ], We = () => [
      St,
      rt,
      lt
    ], Le = () => [
      pi,
      "full",
      ...Y()
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
          Y0
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
          EA
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
              lt,
              rt,
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
              lt,
              rt,
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
            object: K()
          }
        ],
        overflow: [
          {
            overflow: J()
          }
        ],
        "overflow-x": [
          {
            "overflow-x": J()
          }
        ],
        "overflow-y": [
          {
            "overflow-y": J()
          }
        ],
        overscroll: [
          {
            overscroll: Z()
          }
        ],
        "overscroll-x": [
          {
            "overscroll-x": Z()
          }
        ],
        "overscroll-y": [
          {
            "overscroll-y": Z()
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
              yi,
              "auto",
              rt,
              lt
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
              ...Y()
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
              lt
            ]
          }
        ],
        grow: [
          {
            grow: [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        shrink: [
          {
            shrink: [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        order: [
          {
            order: [
              yi,
              "first",
              "last",
              "none",
              rt,
              lt
            ]
          }
        ],
        "grid-cols": [
          {
            "grid-cols": W()
          }
        ],
        "col-start-end": [
          {
            col: nt()
          }
        ],
        "col-start": [
          {
            "col-start": at()
          }
        ],
        "col-end": [
          {
            "col-end": at()
          }
        ],
        "grid-rows": [
          {
            "grid-rows": W()
          }
        ],
        "row-start-end": [
          {
            row: nt()
          }
        ],
        "row-start": [
          {
            "row-start": at()
          }
        ],
        "row-end": [
          {
            "row-end": at()
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
            "auto-cols": pt()
          }
        ],
        "auto-rows": [
          {
            "auto-rows": pt()
          }
        ],
        gap: [
          {
            gap: Y()
          }
        ],
        "gap-x": [
          {
            "gap-x": Y()
          }
        ],
        "gap-y": [
          {
            "gap-y": Y()
          }
        ],
        "justify-content": [
          {
            justify: [
              ...dt(),
              "normal"
            ]
          }
        ],
        "justify-items": [
          {
            "justify-items": [
              ...ht(),
              "normal"
            ]
          }
        ],
        "justify-self": [
          {
            "justify-self": [
              "auto",
              ...ht()
            ]
          }
        ],
        "align-content": [
          {
            content: [
              "normal",
              ...dt()
            ]
          }
        ],
        "align-items": [
          {
            items: [
              ...ht(),
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
              ...ht(),
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
            "place-content": dt()
          }
        ],
        "place-items": [
          {
            "place-items": [
              ...ht(),
              "baseline"
            ]
          }
        ],
        "place-self": [
          {
            "place-self": [
              "auto",
              ...ht()
            ]
          }
        ],
        p: [
          {
            p: Y()
          }
        ],
        px: [
          {
            px: Y()
          }
        ],
        py: [
          {
            py: Y()
          }
        ],
        ps: [
          {
            ps: Y()
          }
        ],
        pe: [
          {
            pe: Y()
          }
        ],
        pbs: [
          {
            pbs: Y()
          }
        ],
        pbe: [
          {
            pbe: Y()
          }
        ],
        pt: [
          {
            pt: Y()
          }
        ],
        pr: [
          {
            pr: Y()
          }
        ],
        pb: [
          {
            pb: Y()
          }
        ],
        pl: [
          {
            pl: Y()
          }
        ],
        m: [
          {
            m: V()
          }
        ],
        mx: [
          {
            mx: V()
          }
        ],
        my: [
          {
            my: V()
          }
        ],
        ms: [
          {
            ms: V()
          }
        ],
        me: [
          {
            me: V()
          }
        ],
        mbs: [
          {
            mbs: V()
          }
        ],
        mbe: [
          {
            mbe: V()
          }
        ],
        mt: [
          {
            mt: V()
          }
        ],
        mr: [
          {
            mr: V()
          }
        ],
        mb: [
          {
            mb: V()
          }
        ],
        ml: [
          {
            ml: V()
          }
        ],
        "space-x": [
          {
            "space-x": Y()
          }
        ],
        "space-x-reverse": [
          "space-x-reverse"
        ],
        "space-y": [
          {
            "space-y": Y()
          }
        ],
        "space-y-reverse": [
          "space-y-reverse"
        ],
        size: [
          {
            size: N()
          }
        ],
        "inline-size": [
          {
            inline: [
              "auto",
              ...k()
            ]
          }
        ],
        "min-inline-size": [
          {
            "min-inline": [
              "auto",
              ...k()
            ]
          }
        ],
        "max-inline-size": [
          {
            "max-inline": [
              "none",
              ...k()
            ]
          }
        ],
        "block-size": [
          {
            block: [
              "auto",
              ...$()
            ]
          }
        ],
        "min-block-size": [
          {
            "min-block": [
              "auto",
              ...$()
            ]
          }
        ],
        "max-block-size": [
          {
            "max-block": [
              "none",
              ...$()
            ]
          }
        ],
        w: [
          {
            w: [
              h,
              "screen",
              ...N()
            ]
          }
        ],
        "min-w": [
          {
            "min-w": [
              h,
              "screen",
              "none",
              ...N()
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
              ...N()
            ]
          }
        ],
        h: [
          {
            h: [
              "screen",
              "lh",
              ...N()
            ]
          }
        ],
        "min-h": [
          {
            "min-h": [
              "screen",
              "lh",
              "none",
              ...N()
            ]
          }
        ],
        "max-h": [
          {
            "max-h": [
              "screen",
              "lh",
              ...N()
            ]
          }
        ],
        "font-size": [
          {
            text: [
              "base",
              l,
              Ws,
              Pi
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
              zA,
              MA
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
              Iu,
              lt
            ]
          }
        ],
        "font-family": [
          {
            font: [
              OA,
              RA,
              i
            ]
          }
        ],
        "font-features": [
          {
            "font-features": [
              lt
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
              c,
              rt,
              lt
            ]
          }
        ],
        "line-clamp": [
          {
            "line-clamp": [
              St,
              "none",
              rt,
              wg
            ]
          }
        ],
        leading: [
          {
            leading: [
              d,
              ...Y()
            ]
          }
        ],
        "list-image": [
          {
            "list-image": [
              "none",
              rt,
              lt
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
              rt,
              lt
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
            placeholder: P()
          }
        ],
        "text-color": [
          {
            text: P()
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
              ...yt(),
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
              rt,
              Pi
            ]
          }
        ],
        "text-decoration-color": [
          {
            decoration: P()
          }
        ],
        "underline-offset": [
          {
            "underline-offset": [
              St,
              "auto",
              rt,
              lt
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
            indent: Y()
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
              rt,
              lt
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
              rt,
              lt
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
            bg: B()
          }
        ],
        "bg-size": [
          {
            bg: I()
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
                  yi,
                  rt,
                  lt
                ],
                radial: [
                  "",
                  rt,
                  lt
                ],
                conic: [
                  yi,
                  rt,
                  lt
                ]
              },
              jA,
              DA
            ]
          }
        ],
        "bg-color": [
          {
            bg: P()
          }
        ],
        "gradient-from-pos": [
          {
            from: et()
          }
        ],
        "gradient-via-pos": [
          {
            via: et()
          }
        ],
        "gradient-to-pos": [
          {
            to: et()
          }
        ],
        "gradient-from": [
          {
            from: P()
          }
        ],
        "gradient-via": [
          {
            via: P()
          }
        ],
        "gradient-to": [
          {
            to: P()
          }
        ],
        rounded: [
          {
            rounded: it()
          }
        ],
        "rounded-s": [
          {
            "rounded-s": it()
          }
        ],
        "rounded-e": [
          {
            "rounded-e": it()
          }
        ],
        "rounded-t": [
          {
            "rounded-t": it()
          }
        ],
        "rounded-r": [
          {
            "rounded-r": it()
          }
        ],
        "rounded-b": [
          {
            "rounded-b": it()
          }
        ],
        "rounded-l": [
          {
            "rounded-l": it()
          }
        ],
        "rounded-ss": [
          {
            "rounded-ss": it()
          }
        ],
        "rounded-se": [
          {
            "rounded-se": it()
          }
        ],
        "rounded-ee": [
          {
            "rounded-ee": it()
          }
        ],
        "rounded-es": [
          {
            "rounded-es": it()
          }
        ],
        "rounded-tl": [
          {
            "rounded-tl": it()
          }
        ],
        "rounded-tr": [
          {
            "rounded-tr": it()
          }
        ],
        "rounded-br": [
          {
            "rounded-br": it()
          }
        ],
        "rounded-bl": [
          {
            "rounded-bl": it()
          }
        ],
        "border-w": [
          {
            border: ut()
          }
        ],
        "border-w-x": [
          {
            "border-x": ut()
          }
        ],
        "border-w-y": [
          {
            "border-y": ut()
          }
        ],
        "border-w-s": [
          {
            "border-s": ut()
          }
        ],
        "border-w-e": [
          {
            "border-e": ut()
          }
        ],
        "border-w-bs": [
          {
            "border-bs": ut()
          }
        ],
        "border-w-be": [
          {
            "border-be": ut()
          }
        ],
        "border-w-t": [
          {
            "border-t": ut()
          }
        ],
        "border-w-r": [
          {
            "border-r": ut()
          }
        ],
        "border-w-b": [
          {
            "border-b": ut()
          }
        ],
        "border-w-l": [
          {
            "border-l": ut()
          }
        ],
        "divide-x": [
          {
            "divide-x": ut()
          }
        ],
        "divide-x-reverse": [
          "divide-x-reverse"
        ],
        "divide-y": [
          {
            "divide-y": ut()
          }
        ],
        "divide-y-reverse": [
          "divide-y-reverse"
        ],
        "border-style": [
          {
            border: [
              ...yt(),
              "hidden",
              "none"
            ]
          }
        ],
        "divide-style": [
          {
            divide: [
              ...yt(),
              "hidden",
              "none"
            ]
          }
        ],
        "border-color": [
          {
            border: P()
          }
        ],
        "border-color-x": [
          {
            "border-x": P()
          }
        ],
        "border-color-y": [
          {
            "border-y": P()
          }
        ],
        "border-color-s": [
          {
            "border-s": P()
          }
        ],
        "border-color-e": [
          {
            "border-e": P()
          }
        ],
        "border-color-bs": [
          {
            "border-bs": P()
          }
        ],
        "border-color-be": [
          {
            "border-be": P()
          }
        ],
        "border-color-t": [
          {
            "border-t": P()
          }
        ],
        "border-color-r": [
          {
            "border-r": P()
          }
        ],
        "border-color-b": [
          {
            "border-b": P()
          }
        ],
        "border-color-l": [
          {
            "border-l": P()
          }
        ],
        "divide-color": [
          {
            divide: P()
          }
        ],
        "outline-style": [
          {
            outline: [
              ...yt(),
              "none",
              "hidden"
            ]
          }
        ],
        "outline-offset": [
          {
            "outline-offset": [
              St,
              rt,
              lt
            ]
          }
        ],
        "outline-w": [
          {
            outline: [
              "",
              St,
              Ws,
              Pi
            ]
          }
        ],
        "outline-color": [
          {
            outline: P()
          }
        ],
        shadow: [
          {
            shadow: [
              "",
              "none",
              y,
              Lo,
              ko
            ]
          }
        ],
        "shadow-color": [
          {
            shadow: P()
          }
        ],
        "inset-shadow": [
          {
            "inset-shadow": [
              "none",
              v,
              Lo,
              ko
            ]
          }
        ],
        "inset-shadow-color": [
          {
            "inset-shadow": P()
          }
        ],
        "ring-w": [
          {
            ring: ut()
          }
        ],
        "ring-w-inset": [
          "ring-inset"
        ],
        "ring-color": [
          {
            ring: P()
          }
        ],
        "ring-offset-w": [
          {
            "ring-offset": [
              St,
              Pi
            ]
          }
        ],
        "ring-offset-color": [
          {
            "ring-offset": P()
          }
        ],
        "inset-ring-w": [
          {
            "inset-ring": ut()
          }
        ],
        "inset-ring-color": [
          {
            "inset-ring": P()
          }
        ],
        "text-shadow": [
          {
            "text-shadow": [
              "none",
              b,
              Lo,
              ko
            ]
          }
        ],
        "text-shadow-color": [
          {
            "text-shadow": P()
          }
        ],
        opacity: [
          {
            opacity: [
              St,
              rt,
              lt
            ]
          }
        ],
        "mix-blend": [
          {
            "mix-blend": [
              ...Xt(),
              "plus-darker",
              "plus-lighter"
            ]
          }
        ],
        "bg-blend": [
          {
            "bg-blend": Xt()
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
            "mask-linear-from": P()
          }
        ],
        "mask-image-linear-to-color": [
          {
            "mask-linear-to": P()
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
            "mask-t-from": P()
          }
        ],
        "mask-image-t-to-color": [
          {
            "mask-t-to": P()
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
            "mask-r-from": P()
          }
        ],
        "mask-image-r-to-color": [
          {
            "mask-r-to": P()
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
            "mask-b-from": P()
          }
        ],
        "mask-image-b-to-color": [
          {
            "mask-b-to": P()
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
            "mask-l-from": P()
          }
        ],
        "mask-image-l-to-color": [
          {
            "mask-l-to": P()
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
            "mask-x-from": P()
          }
        ],
        "mask-image-x-to-color": [
          {
            "mask-x-to": P()
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
            "mask-y-from": P()
          }
        ],
        "mask-image-y-to-color": [
          {
            "mask-y-to": P()
          }
        ],
        "mask-image-radial": [
          {
            "mask-radial": [
              rt,
              lt
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
            "mask-radial-from": P()
          }
        ],
        "mask-image-radial-to-color": [
          {
            "mask-radial-to": P()
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
            "mask-radial-at": _()
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
            "mask-conic-from": P()
          }
        ],
        "mask-image-conic-to-color": [
          {
            "mask-conic-to": P()
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
            mask: B()
          }
        ],
        "mask-size": [
          {
            mask: I()
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
              rt,
              lt
            ]
          }
        ],
        filter: [
          {
            filter: [
              "",
              "none",
              rt,
              lt
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
              rt,
              lt
            ]
          }
        ],
        contrast: [
          {
            contrast: [
              St,
              rt,
              lt
            ]
          }
        ],
        "drop-shadow": [
          {
            "drop-shadow": [
              "",
              "none",
              T,
              Lo,
              ko
            ]
          }
        ],
        "drop-shadow-color": [
          {
            "drop-shadow": P()
          }
        ],
        grayscale: [
          {
            grayscale: [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        "hue-rotate": [
          {
            "hue-rotate": [
              St,
              rt,
              lt
            ]
          }
        ],
        invert: [
          {
            invert: [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        saturate: [
          {
            saturate: [
              St,
              rt,
              lt
            ]
          }
        ],
        sepia: [
          {
            sepia: [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-filter": [
          {
            "backdrop-filter": [
              "",
              "none",
              rt,
              lt
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
              rt,
              lt
            ]
          }
        ],
        "backdrop-contrast": [
          {
            "backdrop-contrast": [
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-grayscale": [
          {
            "backdrop-grayscale": [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-hue-rotate": [
          {
            "backdrop-hue-rotate": [
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-invert": [
          {
            "backdrop-invert": [
              "",
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-opacity": [
          {
            "backdrop-opacity": [
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-saturate": [
          {
            "backdrop-saturate": [
              St,
              rt,
              lt
            ]
          }
        ],
        "backdrop-sepia": [
          {
            "backdrop-sepia": [
              "",
              St,
              rt,
              lt
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
            "border-spacing": Y()
          }
        ],
        "border-spacing-x": [
          {
            "border-spacing-x": Y()
          }
        ],
        "border-spacing-y": [
          {
            "border-spacing-y": Y()
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
              rt,
              lt
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
              rt,
              lt
            ]
          }
        ],
        ease: [
          {
            ease: [
              "linear",
              "initial",
              O,
              rt,
              lt
            ]
          }
        ],
        delay: [
          {
            delay: [
              St,
              rt,
              lt
            ]
          }
        ],
        animate: [
          {
            animate: [
              "none",
              L,
              rt,
              lt
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
              rt,
              lt
            ]
          }
        ],
        "perspective-origin": [
          {
            "perspective-origin": K()
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
              rt,
              lt,
              "",
              "none",
              "gpu",
              "cpu"
            ]
          }
        ],
        "transform-origin": [
          {
            origin: K()
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
            accent: P()
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
            caret: P()
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
              rt,
              lt
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
            "scroll-m": Y()
          }
        ],
        "scroll-mx": [
          {
            "scroll-mx": Y()
          }
        ],
        "scroll-my": [
          {
            "scroll-my": Y()
          }
        ],
        "scroll-ms": [
          {
            "scroll-ms": Y()
          }
        ],
        "scroll-me": [
          {
            "scroll-me": Y()
          }
        ],
        "scroll-mbs": [
          {
            "scroll-mbs": Y()
          }
        ],
        "scroll-mbe": [
          {
            "scroll-mbe": Y()
          }
        ],
        "scroll-mt": [
          {
            "scroll-mt": Y()
          }
        ],
        "scroll-mr": [
          {
            "scroll-mr": Y()
          }
        ],
        "scroll-mb": [
          {
            "scroll-mb": Y()
          }
        ],
        "scroll-ml": [
          {
            "scroll-ml": Y()
          }
        ],
        "scroll-p": [
          {
            "scroll-p": Y()
          }
        ],
        "scroll-px": [
          {
            "scroll-px": Y()
          }
        ],
        "scroll-py": [
          {
            "scroll-py": Y()
          }
        ],
        "scroll-ps": [
          {
            "scroll-ps": Y()
          }
        ],
        "scroll-pe": [
          {
            "scroll-pe": Y()
          }
        ],
        "scroll-pbs": [
          {
            "scroll-pbs": Y()
          }
        ],
        "scroll-pbe": [
          {
            "scroll-pbe": Y()
          }
        ],
        "scroll-pt": [
          {
            "scroll-pt": Y()
          }
        ],
        "scroll-pr": [
          {
            "scroll-pr": Y()
          }
        ],
        "scroll-pb": [
          {
            "scroll-pb": Y()
          }
        ],
        "scroll-pl": [
          {
            "scroll-pl": Y()
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
              rt,
              lt
            ]
          }
        ],
        fill: [
          {
            fill: [
              "none",
              ...P()
            ]
          }
        ],
        "stroke-w": [
          {
            stroke: [
              St,
              Ws,
              Pi,
              wg
            ]
          }
        ],
        stroke: [
          {
            stroke: [
              "none",
              ...P()
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
  }, kA = mA(VA);
  function yd(...n) {
    return kA(V0(n));
  }
  const LA = Xw, BA = Kw, UA = Zw, J0 = w.forwardRef(({ className: n, sideOffset: i = 4, ...l }, o) => S.jsx(z0, {
    ref: o,
    sideOffset: i,
    className: yd("z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]", n),
    ...l
  }));
  J0.displayName = z0.displayName;
  const gd = w.createContext({});
  function vd(n) {
    const i = w.useRef(null);
    return i.current === null && (i.current = n()), i.current;
  }
  const HA = typeof window < "u", $0 = HA ? w.useLayoutEffect : w.useEffect, Sr = w.createContext(null);
  function bd(n, i) {
    n.indexOf(i) === -1 && n.push(i);
  }
  function ir(n, i) {
    const l = n.indexOf(i);
    l > -1 && n.splice(l, 1);
  }
  const xn = (n, i, l) => l > i ? i : l < n ? n : l;
  let xd = () => {
  };
  const Si = {}, W0 = (n) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(n);
  function I0(n) {
    return typeof n == "object" && n !== null;
  }
  const tb = (n) => /^0[^.\s]+$/u.test(n);
  function eb(n) {
    let i;
    return () => (i === void 0 && (i = n()), i);
  }
  const Fe = (n) => n, GA = (n, i) => (l) => i(n(l)), dl = (...n) => n.reduce(GA), ol = (n, i, l) => {
    const o = i - n;
    return o === 0 ? 1 : (l - n) / o;
  };
  class Sd {
    constructor() {
      this.subscriptions = [];
    }
    add(i) {
      return bd(this.subscriptions, i), () => ir(this.subscriptions, i);
    }
    notify(i, l, o) {
      const c = this.subscriptions.length;
      if (c) if (c === 1) this.subscriptions[0](i, l, o);
      else for (let d = 0; d < c; d++) {
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
  function nb(n, i) {
    return i ? n * (1e3 / i) : 0;
  }
  const ib = (n, i, l) => (((1 - 3 * l + 3 * i) * n + (3 * l - 6 * i)) * n + 3 * i) * n, YA = 1e-7, qA = 12;
  function PA(n, i, l, o, c) {
    let d, f, h = 0;
    do
      f = i + (l - i) / 2, d = ib(f, o, c) - n, d > 0 ? l = f : i = f;
    while (Math.abs(d) > YA && ++h < qA);
    return f;
  }
  function hl(n, i, l, o) {
    if (n === i && l === o) return Fe;
    const c = (d) => PA(d, 0, 1, n, l);
    return (d) => d === 0 || d === 1 ? d : ib(c(d), i, o);
  }
  const ab = (n) => (i) => i <= 0.5 ? n(2 * i) / 2 : (2 - n(2 * (1 - i))) / 2, sb = (n) => (i) => 1 - n(1 - i), lb = hl(0.33, 1.53, 0.69, 0.99), Td = sb(lb), ob = ab(Td), rb = (n) => n >= 1 ? 1 : (n *= 2) < 1 ? 0.5 * Td(n) : 0.5 * (2 - Math.pow(2, -10 * (n - 1))), wd = (n) => 1 - Math.sin(Math.acos(n)), cb = sb(wd), ub = ab(wd), XA = hl(0.42, 0, 1, 1), KA = hl(0, 0, 0.58, 1), fb = hl(0.42, 0, 0.58, 1), ZA = (n) => Array.isArray(n) && typeof n[0] != "number", db = (n) => Array.isArray(n) && typeof n[0] == "number", QA = {
    linear: Fe,
    easeIn: XA,
    easeInOut: fb,
    easeOut: KA,
    circIn: wd,
    circInOut: ub,
    circOut: cb,
    backIn: Td,
    backInOut: ob,
    backOut: lb,
    anticipate: rb
  }, FA = (n) => typeof n == "string", Cg = (n) => {
    if (db(n)) {
      xd(n.length === 4);
      const [i, l, o, c] = n;
      return hl(i, l, o, c);
    } else if (FA(n)) return QA[n];
    return n;
  }, Bo = [
    "setup",
    "read",
    "resolveKeyframes",
    "preUpdate",
    "update",
    "preRender",
    "render",
    "postRender"
  ];
  function JA(n, i) {
    let l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = false, d = false;
    const f = /* @__PURE__ */ new WeakSet();
    let h = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function m(y) {
      f.has(y) && (p.schedule(y), n()), y(h);
    }
    const p = {
      schedule: (y, v = false, b = false) => {
        const A = b && c ? l : o;
        return v && f.add(y), A.add(y), y;
      },
      cancel: (y) => {
        o.delete(y), f.delete(y);
      },
      process: (y) => {
        if (h = y, c) {
          d = true;
          return;
        }
        c = true;
        const v = l;
        l = o, o = v, l.forEach(m), l.clear(), c = false, d && (d = false, p.process(y));
      }
    };
    return p;
  }
  const $A = 40;
  function hb(n, i) {
    let l = false, o = true;
    const c = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    }, d = () => l = true, f = Bo.reduce((z, _) => (z[_] = JA(d), z), {}), { setup: h, read: m, resolveKeyframes: p, preUpdate: y, update: v, preRender: b, render: T, postRender: A } = f, C = () => {
      const z = Si.useManualTiming, _ = z ? c.timestamp : performance.now();
      l = false, z || (c.delta = o ? 1e3 / 60 : Math.max(Math.min(_ - c.timestamp, $A), 1)), c.timestamp = _, c.isProcessing = true, h.process(c), m.process(c), p.process(c), y.process(c), v.process(c), b.process(c), T.process(c), A.process(c), c.isProcessing = false, l && i && (o = false, n(C));
    }, R = () => {
      l = true, o = true, c.isProcessing || n(C);
    };
    return {
      schedule: Bo.reduce((z, _) => {
        const K = f[_];
        return z[_] = (J, Z = false, Y = false) => (l || R(), K.schedule(J, Z, Y)), z;
      }, {}),
      cancel: (z) => {
        for (let _ = 0; _ < Bo.length; _++) f[Bo[_]].cancel(z);
      },
      state: c,
      steps: f
    };
  }
  const { schedule: Lt, cancel: Ti, state: ce, steps: tf } = hb(typeof requestAnimationFrame < "u" ? requestAnimationFrame : Fe, true);
  let Po;
  function WA() {
    Po = void 0;
  }
  const me = {
    now: () => (Po === void 0 && me.set(ce.isProcessing || Si.useManualTiming ? ce.timestamp : performance.now()), Po),
    set: (n) => {
      Po = n, queueMicrotask(WA);
    }
  }, mb = (n) => (i) => typeof i == "string" && i.startsWith(n), pb = mb("--"), IA = mb("var(--"), Ad = (n) => IA(n) ? tE.test(n.split("/*")[0].trim()) : false, tE = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
  function Mg(n) {
    return typeof n != "string" ? false : n.split("/*")[0].includes("var(--");
  }
  const Ia = {
    test: (n) => typeof n == "number",
    parse: parseFloat,
    transform: (n) => n
  }, rl = {
    ...Ia,
    transform: (n) => xn(0, 1, n)
  }, Uo = {
    ...Ia,
    default: 1
  }, el = (n) => Math.round(n * 1e5) / 1e5, Ed = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
  function eE(n) {
    return n == null;
  }
  const nE = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, Cd = (n, i) => (l) => !!(typeof l == "string" && nE.test(l) && l.startsWith(n) || i && !eE(l) && Object.prototype.hasOwnProperty.call(l, i)), yb = (n, i, l) => (o) => {
    if (typeof o != "string") return o;
    const [c, d, f, h] = o.match(Ed);
    return {
      [n]: parseFloat(c),
      [i]: parseFloat(d),
      [l]: parseFloat(f),
      alpha: h !== void 0 ? parseFloat(h) : 1
    };
  }, iE = (n) => xn(0, 255, n), ef = {
    ...Ia,
    transform: (n) => Math.round(iE(n))
  }, Zi = {
    test: Cd("rgb", "red"),
    parse: yb("red", "green", "blue"),
    transform: ({ red: n, green: i, blue: l, alpha: o = 1 }) => "rgba(" + ef.transform(n) + ", " + ef.transform(i) + ", " + ef.transform(l) + ", " + el(rl.transform(o)) + ")"
  };
  function aE(n) {
    let i = "", l = "", o = "", c = "";
    return n.length > 5 ? (i = n.substring(1, 3), l = n.substring(3, 5), o = n.substring(5, 7), c = n.substring(7, 9)) : (i = n.substring(1, 2), l = n.substring(2, 3), o = n.substring(3, 4), c = n.substring(4, 5), i += i, l += l, o += o, c += c), {
      red: parseInt(i, 16),
      green: parseInt(l, 16),
      blue: parseInt(o, 16),
      alpha: c ? parseInt(c, 16) / 255 : 1
    };
  }
  const Mf = {
    test: Cd("#"),
    parse: aE,
    transform: Zi.transform
  }, ml = (n) => ({
    test: (i) => typeof i == "string" && i.endsWith(n) && i.split(" ").length === 1,
    parse: parseFloat,
    transform: (i) => `${i}${n}`
  }), gi = ml("deg"), bn = ml("%"), ot = ml("px"), sE = ml("vh"), lE = ml("vw"), Rg = {
    ...bn,
    parse: (n) => bn.parse(n) / 100,
    transform: (n) => bn.transform(n * 100)
  }, Ha = {
    test: Cd("hsl", "hue"),
    parse: yb("hue", "saturation", "lightness"),
    transform: ({ hue: n, saturation: i, lightness: l, alpha: o = 1 }) => "hsla(" + Math.round(n) + ", " + bn.transform(el(i)) + ", " + bn.transform(el(l)) + ", " + el(rl.transform(o)) + ")"
  }, Wt = {
    test: (n) => Zi.test(n) || Mf.test(n) || Ha.test(n),
    parse: (n) => Zi.test(n) ? Zi.parse(n) : Ha.test(n) ? Ha.parse(n) : Mf.parse(n),
    transform: (n) => typeof n == "string" ? n : n.hasOwnProperty("red") ? Zi.transform(n) : Ha.transform(n),
    getAnimatableNone: (n) => {
      const i = Wt.parse(n);
      return i.alpha = 0, Wt.transform(i);
    }
  }, oE = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
  function rE(n) {
    var _a, _b2;
    return isNaN(n) && typeof n == "string" && (((_a = n.match(Ed)) == null ? void 0 : _a.length) || 0) + (((_b2 = n.match(oE)) == null ? void 0 : _b2.length) || 0) > 0;
  }
  const gb = "number", vb = "color", cE = "var", uE = "var(", Dg = "${}", fE = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function Fa(n) {
    const i = n.toString(), l = [], o = {
      color: [],
      number: [],
      var: []
    }, c = [];
    let d = 0;
    const h = i.replace(fE, (m) => (Wt.test(m) ? (o.color.push(d), c.push(vb), l.push(Wt.parse(m))) : m.startsWith(uE) ? (o.var.push(d), c.push(cE), l.push(m)) : (o.number.push(d), c.push(gb), l.push(parseFloat(m))), ++d, Dg)).split(Dg);
    return {
      values: l,
      split: h,
      indexes: o,
      types: c
    };
  }
  function dE(n) {
    return Fa(n).values;
  }
  function bb({ split: n, types: i }) {
    const l = n.length;
    return (o) => {
      let c = "";
      for (let d = 0; d < l; d++) if (c += n[d], o[d] !== void 0) {
        const f = i[d];
        f === gb ? c += el(o[d]) : f === vb ? c += Wt.transform(o[d]) : c += o[d];
      }
      return c;
    };
  }
  function hE(n) {
    return bb(Fa(n));
  }
  const mE = (n) => typeof n == "number" ? 0 : Wt.test(n) ? Wt.getAnimatableNone(n) : n, pE = (n, i) => typeof n == "number" ? (i == null ? void 0 : i.trim().endsWith("/")) ? n : 0 : mE(n);
  function yE(n) {
    const i = Fa(n);
    return bb(i)(i.values.map((o, c) => pE(o, i.split[c])));
  }
  const sn = {
    test: rE,
    parse: dE,
    createTransformer: hE,
    getAnimatableNone: yE
  };
  function nf(n, i, l) {
    return l < 0 && (l += 1), l > 1 && (l -= 1), l < 1 / 6 ? n + (i - n) * 6 * l : l < 1 / 2 ? i : l < 2 / 3 ? n + (i - n) * (2 / 3 - l) * 6 : n;
  }
  function gE({ hue: n, saturation: i, lightness: l, alpha: o }) {
    n /= 360, i /= 100, l /= 100;
    let c = 0, d = 0, f = 0;
    if (!i) c = d = f = l;
    else {
      const h = l < 0.5 ? l * (1 + i) : l + i - l * i, m = 2 * l - h;
      c = nf(m, h, n + 1 / 3), d = nf(m, h, n), f = nf(m, h, n - 1 / 3);
    }
    return {
      red: Math.round(c * 255),
      green: Math.round(d * 255),
      blue: Math.round(f * 255),
      alpha: o
    };
  }
  function ar(n, i) {
    return (l) => l > 0 ? i : n;
  }
  const Gt = (n, i, l) => n + (i - n) * l, af = (n, i, l) => {
    const o = n * n, c = l * (i * i - o) + o;
    return c < 0 ? 0 : Math.sqrt(c);
  }, vE = [
    Mf,
    Zi,
    Ha
  ], bE = (n) => vE.find((i) => i.test(n));
  function Og(n) {
    const i = bE(n);
    if (!i) return false;
    let l = i.parse(n);
    return i === Ha && (l = gE(l)), l;
  }
  const Ng = (n, i) => {
    const l = Og(n), o = Og(i);
    if (!l || !o) return ar(n, i);
    const c = {
      ...l
    };
    return (d) => (c.red = af(l.red, o.red, d), c.green = af(l.green, o.green, d), c.blue = af(l.blue, o.blue, d), c.alpha = Gt(l.alpha, o.alpha, d), Zi.transform(c));
  }, Rf = /* @__PURE__ */ new Set([
    "none",
    "hidden"
  ]);
  function xE(n, i) {
    return Rf.has(n) ? (l) => l <= 0 ? n : i : (l) => l >= 1 ? i : n;
  }
  function SE(n, i) {
    return (l) => Gt(n, i, l);
  }
  function Md(n) {
    return typeof n == "number" ? SE : typeof n == "string" ? Ad(n) ? ar : Wt.test(n) ? Ng : AE : Array.isArray(n) ? xb : typeof n == "object" ? Wt.test(n) ? Ng : TE : ar;
  }
  function xb(n, i) {
    const l = [
      ...n
    ], o = l.length, c = n.map((d, f) => Md(d)(d, i[f]));
    return (d) => {
      for (let f = 0; f < o; f++) l[f] = c[f](d);
      return l;
    };
  }
  function TE(n, i) {
    const l = {
      ...n,
      ...i
    }, o = {};
    for (const c in l) n[c] !== void 0 && i[c] !== void 0 && (o[c] = Md(n[c])(n[c], i[c]));
    return (c) => {
      for (const d in o) l[d] = o[d](c);
      return l;
    };
  }
  function wE(n, i) {
    const l = [], o = {
      color: 0,
      var: 0,
      number: 0
    };
    for (let c = 0; c < i.values.length; c++) {
      const d = i.types[c], f = n.indexes[d][o[d]], h = n.values[f] ?? 0;
      l[c] = h, o[d]++;
    }
    return l;
  }
  const AE = (n, i) => {
    const l = sn.createTransformer(i), o = Fa(n), c = Fa(i);
    return o.indexes.var.length === c.indexes.var.length && o.indexes.color.length === c.indexes.color.length && o.indexes.number.length >= c.indexes.number.length ? Rf.has(n) && !c.values.length || Rf.has(i) && !o.values.length ? xE(n, i) : dl(xb(wE(o, c), c.values), l) : ar(n, i);
  };
  function Sb(n, i, l) {
    return typeof n == "number" && typeof i == "number" && typeof l == "number" ? Gt(n, i, l) : Md(n)(n, i);
  }
  const EE = (n) => {
    const i = ({ timestamp: l }) => n(l);
    return {
      start: (l = true) => Lt.update(i, l),
      stop: () => Ti(i),
      now: () => ce.isProcessing ? ce.timestamp : me.now()
    };
  }, Tb = (n, i, l = 10) => {
    let o = "";
    const c = Math.max(Math.round(i / l), 2);
    for (let d = 0; d < c; d++) o += Math.round(n(d / (c - 1)) * 1e4) / 1e4 + ", ";
    return `linear(${o.substring(0, o.length - 2)})`;
  }, sr = 2e4;
  function Rd(n) {
    let i = 0;
    const l = 50;
    let o = n.next(i);
    for (; !o.done && i < sr; ) i += l, o = n.next(i);
    return i >= sr ? 1 / 0 : i;
  }
  function CE(n, i = 100, l) {
    const o = l({
      ...n,
      keyframes: [
        0,
        i
      ]
    }), c = Math.min(Rd(o), sr);
    return {
      type: "keyframes",
      ease: (d) => o.next(c * d).value / i,
      duration: Qe(c)
    };
  }
  const Pt = {
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
  function Df(n, i) {
    return n * Math.sqrt(1 - i * i);
  }
  const ME = 12;
  function RE(n, i, l) {
    let o = l;
    for (let c = 1; c < ME; c++) o = o - n(o) / i(o);
    return o;
  }
  const sf = 1e-3;
  function DE({ duration: n = Pt.duration, bounce: i = Pt.bounce, velocity: l = Pt.velocity, mass: o = Pt.mass }) {
    let c, d, f = 1 - i;
    f = xn(Pt.minDamping, Pt.maxDamping, f), n = xn(Pt.minDuration, Pt.maxDuration, Qe(n)), f < 1 ? (c = (p) => {
      const y = p * f, v = y * n, b = y - l, T = Df(p, f), A = Math.exp(-v);
      return sf - b / T * A;
    }, d = (p) => {
      const v = p * f * n, b = v * l + l, T = Math.pow(f, 2) * Math.pow(p, 2) * n, A = Math.exp(-v), C = Df(Math.pow(p, 2), f);
      return (-c(p) + sf > 0 ? -1 : 1) * ((b - T) * A) / C;
    }) : (c = (p) => {
      const y = Math.exp(-p * n), v = (p - l) * n + 1;
      return -sf + y * v;
    }, d = (p) => {
      const y = Math.exp(-p * n), v = (l - p) * (n * n);
      return y * v;
    });
    const h = 5 / n, m = RE(c, d, h);
    if (n = ke(n), isNaN(m)) return {
      stiffness: Pt.stiffness,
      damping: Pt.damping,
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
  const OE = [
    "duration",
    "bounce"
  ], NE = [
    "stiffness",
    "damping",
    "mass"
  ];
  function jg(n, i) {
    return i.some((l) => n[l] !== void 0);
  }
  function jE(n) {
    let i = {
      velocity: Pt.velocity,
      stiffness: Pt.stiffness,
      damping: Pt.damping,
      mass: Pt.mass,
      isResolvedFromDuration: false,
      ...n
    };
    if (!jg(n, NE) && jg(n, OE)) if (i.velocity = 0, n.visualDuration) {
      const l = n.visualDuration, o = 2 * Math.PI / (l * 1.2), c = o * o, d = 2 * xn(0.05, 1, 1 - (n.bounce || 0)) * Math.sqrt(c);
      i = {
        ...i,
        mass: Pt.mass,
        stiffness: c,
        damping: d
      };
    } else {
      const l = DE({
        ...n,
        velocity: 0
      });
      i = {
        ...i,
        ...l,
        mass: Pt.mass
      }, i.isResolvedFromDuration = true;
    }
    return i;
  }
  function lr(n = Pt.visualDuration, i = Pt.bounce) {
    const l = typeof n != "object" ? {
      visualDuration: n,
      keyframes: [
        0,
        1
      ],
      bounce: i
    } : n;
    let { restSpeed: o, restDelta: c } = l;
    const d = l.keyframes[0], f = l.keyframes[l.keyframes.length - 1], h = {
      done: false,
      value: d
    }, { stiffness: m, damping: p, mass: y, duration: v, velocity: b, isResolvedFromDuration: T } = jE({
      ...l,
      velocity: -Qe(l.velocity || 0)
    }), A = b || 0, C = p / (2 * Math.sqrt(m * y)), R = f - d, O = Qe(Math.sqrt(m / y)), L = Math.abs(R) < 5;
    o || (o = L ? Pt.restSpeed.granular : Pt.restSpeed.default), c || (c = L ? Pt.restDelta.granular : Pt.restDelta.default);
    let z, _, K, J, Z, Y;
    if (C < 1) K = Df(O, C), J = (A + C * O * R) / K, z = (W) => {
      const nt = Math.exp(-C * O * W);
      return f - nt * (J * Math.sin(K * W) + R * Math.cos(K * W));
    }, Z = C * O * J + R * K, Y = C * O * R - J * K, _ = (W) => Math.exp(-C * O * W) * (Z * Math.sin(K * W) + Y * Math.cos(K * W));
    else if (C === 1) {
      z = (nt) => f - Math.exp(-O * nt) * (R + (A + O * R) * nt);
      const W = A + O * R;
      _ = (nt) => Math.exp(-O * nt) * (O * W * nt - A);
    } else {
      const W = O * Math.sqrt(C * C - 1);
      z = (dt) => {
        const ht = Math.exp(-C * O * dt), V = Math.min(W * dt, 300);
        return f - ht * ((A + C * O * R) * Math.sinh(V) + W * R * Math.cosh(V)) / W;
      };
      const nt = (A + C * O * R) / W, at = C * O * nt - R * W, pt = C * O * R - nt * W;
      _ = (dt) => {
        const ht = Math.exp(-C * O * dt), V = Math.min(W * dt, 300);
        return ht * (at * Math.sinh(V) + pt * Math.cosh(V));
      };
    }
    const tt = {
      calculatedDuration: T && v || null,
      velocity: (W) => ke(_(W)),
      next: (W) => {
        if (!T && C < 1) {
          const at = Math.exp(-C * O * W), pt = Math.sin(K * W), dt = Math.cos(K * W), ht = f - at * (J * pt + R * dt), V = ke(at * (Z * pt + Y * dt));
          return h.done = Math.abs(V) <= o && Math.abs(f - ht) <= c, h.value = h.done ? f : ht, h;
        }
        const nt = z(W);
        if (T) h.done = W >= v;
        else {
          const at = ke(_(W));
          h.done = Math.abs(at) <= o && Math.abs(f - nt) <= c;
        }
        return h.value = h.done ? f : nt, h;
      },
      toString: () => {
        const W = Math.min(Rd(tt), sr), nt = Tb((at) => tt.next(W * at).value, W, 30);
        return W + "ms " + nt;
      },
      toTransition: () => {
      }
    };
    return tt;
  }
  lr.applyToOptions = (n) => {
    const i = CE(n, 100, lr);
    return n.ease = i.ease, n.duration = ke(i.duration), n.type = "keyframes", n;
  };
  const zE = 5;
  function wb(n, i, l) {
    const o = Math.max(i - zE, 0);
    return nb(l - n(o), i - o);
  }
  function Of({ keyframes: n, velocity: i = 0, power: l = 0.8, timeConstant: o = 325, bounceDamping: c = 10, bounceStiffness: d = 500, modifyTarget: f, min: h, max: m, restDelta: p = 0.5, restSpeed: y }) {
    const v = n[0], b = {
      done: false,
      value: v
    }, T = (Y) => h !== void 0 && Y < h || m !== void 0 && Y > m, A = (Y) => h === void 0 ? m : m === void 0 || Math.abs(h - Y) < Math.abs(m - Y) ? h : m;
    let C = l * i;
    const R = v + C, O = f === void 0 ? R : f(R);
    O !== R && (C = O - v);
    const L = (Y) => -C * Math.exp(-Y / o), z = (Y) => O + L(Y), _ = (Y) => {
      const tt = L(Y), W = z(Y);
      b.done = Math.abs(tt) <= p, b.value = b.done ? O : W;
    };
    let K, J;
    const Z = (Y) => {
      T(b.value) && (K = Y, J = lr({
        keyframes: [
          b.value,
          A(b.value)
        ],
        velocity: wb(z, Y, b.value),
        damping: c,
        stiffness: d,
        restDelta: p,
        restSpeed: y
      }));
    };
    return Z(0), {
      calculatedDuration: null,
      next: (Y) => {
        let tt = false;
        return !J && K === void 0 && (tt = true, _(Y), Z(Y)), K !== void 0 && Y >= K ? J.next(Y - K) : (!tt && _(Y), b);
      }
    };
  }
  function _E(n, i, l) {
    const o = [], c = l || Si.mix || Sb, d = n.length - 1;
    for (let f = 0; f < d; f++) {
      let h = c(n[f], n[f + 1]);
      if (i) {
        const m = Array.isArray(i) ? i[f] || Fe : i;
        h = dl(m, h);
      }
      o.push(h);
    }
    return o;
  }
  function VE(n, i, { clamp: l = true, ease: o, mixer: c } = {}) {
    const d = n.length;
    if (xd(d === i.length), d === 1) return () => i[0];
    if (d === 2 && i[0] === i[1]) return () => i[1];
    const f = n[0] === n[1];
    n[0] > n[d - 1] && (n = [
      ...n
    ].reverse(), i = [
      ...i
    ].reverse());
    const h = _E(i, o, c), m = h.length, p = (y) => {
      if (f && y < n[0]) return i[0];
      let v = 0;
      if (m > 1) for (; v < n.length - 2 && !(y < n[v + 1]); v++) ;
      const b = ol(n[v], n[v + 1], y);
      return h[v](b);
    };
    return l ? (y) => p(xn(n[0], n[d - 1], y)) : p;
  }
  function kE(n, i) {
    const l = n[n.length - 1];
    for (let o = 1; o <= i; o++) {
      const c = ol(0, i, o);
      n.push(Gt(l, 1, c));
    }
  }
  function LE(n) {
    const i = [
      0
    ];
    return kE(i, n.length - 1), i;
  }
  function BE(n, i) {
    return n.map((l) => l * i);
  }
  function UE(n, i) {
    return n.map(() => i || fb).splice(0, n.length - 1);
  }
  function nl({ duration: n = 300, keyframes: i, times: l, ease: o = "easeInOut" }) {
    const c = ZA(o) ? o.map(Cg) : Cg(o), d = {
      done: false,
      value: i[0]
    }, f = BE(l && l.length === i.length ? l : LE(i), n), h = VE(f, i, {
      ease: Array.isArray(c) ? c : UE(i, c)
    });
    return {
      calculatedDuration: n,
      next: (m) => (d.value = h(m), d.done = m >= n, d)
    };
  }
  const HE = (n) => n !== null;
  function Dd(n, { repeat: i, repeatType: l = "loop" }, o, c = 1) {
    const d = n.filter(HE), h = c < 0 || i && l !== "loop" && i % 2 === 1 ? 0 : d.length - 1;
    return !h || o === void 0 ? d[h] : o;
  }
  const GE = {
    decay: Of,
    inertia: Of,
    tween: nl,
    keyframes: nl,
    spring: lr
  };
  function Ab(n) {
    typeof n.type == "string" && (n.type = GE[n.type]);
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
  const YE = (n) => n / 100;
  class Nd extends Od {
    constructor(i) {
      super(), this.state = "idle", this.startTime = null, this.isStopped = false, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.stop = () => {
        var _a, _b2;
        const { motionValue: l } = this.options;
        l && l.updatedAt !== me.now() && this.tick(me.now()), this.isStopped = true, this.state !== "idle" && (this.teardown(), (_b2 = (_a = this.options).onStop) == null ? void 0 : _b2.call(_a));
      }, this.options = i, this.initAnimation(), this.play(), i.autoplay === false && this.pause();
    }
    initAnimation() {
      const { options: i } = this;
      Ab(i);
      const { type: l = nl, repeat: o = 0, repeatDelay: c = 0, repeatType: d, velocity: f = 0 } = i;
      let { keyframes: h } = i;
      const m = l || nl;
      m !== nl && typeof h[0] != "number" && (this.mixKeyframes = dl(YE, Sb(h[0], h[1])), h = [
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
      const { calculatedDuration: y } = p;
      this.calculatedDuration = y, this.resolvedDuration = y + c, this.totalDuration = this.resolvedDuration * (o + 1) - c, this.generator = p;
    }
    updateTime(i) {
      const l = Math.round(i - this.startTime) * this.playbackSpeed;
      this.holdTime !== null ? this.currentTime = this.holdTime : this.currentTime = l;
    }
    tick(i, l = false) {
      const { generator: o, totalDuration: c, mixKeyframes: d, mirroredGenerator: f, resolvedDuration: h, calculatedDuration: m } = this;
      if (this.startTime === null) return o.next(0);
      const { delay: p = 0, keyframes: y, repeat: v, repeatType: b, repeatDelay: T, type: A, onUpdate: C, finalKeyframe: R } = this.options;
      this.speed > 0 ? this.startTime = Math.min(this.startTime, i) : this.speed < 0 && (this.startTime = Math.min(i - c / this.speed, this.startTime)), l ? this.currentTime = i : this.updateTime(i);
      const O = this.currentTime - p * (this.playbackSpeed >= 0 ? 1 : -1), L = this.playbackSpeed >= 0 ? O < 0 : O > c;
      this.currentTime = Math.max(O, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = c);
      let z = this.currentTime, _ = o;
      if (v) {
        const Y = Math.min(this.currentTime, c) / h;
        let tt = Math.floor(Y), W = Y % 1;
        !W && Y >= 1 && (W = 1), W === 1 && tt--, tt = Math.min(tt, v + 1), !!(tt % 2) && (b === "reverse" ? (W = 1 - W, T && (W -= T / h)) : b === "mirror" && (_ = f)), z = xn(0, 1, W) * h;
      }
      const K = L ? {
        done: false,
        value: y[0]
      } : _.next(z);
      d && !L && (K.value = d(K.value));
      let { done: J } = K;
      !L && m !== null && (J = this.playbackSpeed >= 0 ? this.currentTime >= c : this.currentTime <= 0);
      const Z = this.holdTime === null && (this.state === "finished" || this.state === "running" && J);
      return Z && A !== Of && (K.value = Dd(y, this.options, R, this.speed)), C && C(K.value), Z && this.finish(), K;
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
      return wb((o) => this.generator.next(o).value, i, l);
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
      const { driver: i = EE, startTime: l } = this.options;
      this.driver || (this.driver = i((c) => this.tick(c))), (_b2 = (_a = this.options).onPlay) == null ? void 0 : _b2.call(_a);
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
    return jf(i);
  }, PE = {
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
  }, jf = (n) => (n = n % 360, n < 0 && (n += 360), n), zg = Nf, _g = (n) => Math.sqrt(n[0] * n[0] + n[1] * n[1]), Vg = (n) => Math.sqrt(n[4] * n[4] + n[5] * n[5]), XE = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX: _g,
    scaleY: Vg,
    scale: (n) => (_g(n) + Vg(n)) / 2,
    rotateX: (n) => jf(Qi(Math.atan2(n[6], n[5]))),
    rotateY: (n) => jf(Qi(Math.atan2(-n[2], n[0]))),
    rotateZ: zg,
    rotate: zg,
    skewX: (n) => Qi(Math.atan(n[4])),
    skewY: (n) => Qi(Math.atan(n[1])),
    skew: (n) => (Math.abs(n[1]) + Math.abs(n[4])) / 2
  };
  function zf(n) {
    return n.includes("scale") ? 1 : 0;
  }
  function _f(n, i) {
    if (!n || n === "none") return zf(i);
    const l = n.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
    let o, c;
    if (l) o = XE, c = l;
    else {
      const h = n.match(/^matrix\(([-\d.e\s,]+)\)$/u);
      o = PE, c = h;
    }
    if (!c) return zf(i);
    const d = o[i], f = c[1].split(",").map(ZE);
    return typeof d == "function" ? d(f) : f[d];
  }
  const KE = (n, i) => {
    const { transform: l = "none" } = getComputedStyle(n);
    return _f(l, i);
  };
  function ZE(n) {
    return parseFloat(n.trim());
  }
  const ts = [
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
  ], es = new Set(ts), kg = (n) => n === Ia || n === ot, QE = /* @__PURE__ */ new Set([
    "x",
    "y",
    "z"
  ]), FE = ts.filter((n) => !QE.has(n));
  function JE(n) {
    const i = [];
    return FE.forEach((l) => {
      const o = n.getValue(l);
      o !== void 0 && (i.push([
        l,
        o.get()
      ]), o.set(l.startsWith("scale") ? 1 : 0));
    }), i;
  }
  const vi = {
    width: ({ x: n }, { paddingLeft: i = "0", paddingRight: l = "0", boxSizing: o }) => {
      const c = n.max - n.min;
      return o === "border-box" ? c : c - parseFloat(i) - parseFloat(l);
    },
    height: ({ y: n }, { paddingTop: i = "0", paddingBottom: l = "0", boxSizing: o }) => {
      const c = n.max - n.min;
      return o === "border-box" ? c : c - parseFloat(i) - parseFloat(l);
    },
    top: (n, { top: i }) => parseFloat(i),
    left: (n, { left: i }) => parseFloat(i),
    bottom: ({ y: n }, { top: i }) => parseFloat(i) + (n.max - n.min),
    right: ({ x: n }, { left: i }) => parseFloat(i) + (n.max - n.min),
    x: (n, { transform: i }) => _f(i, "x"),
    y: (n, { transform: i }) => _f(i, "y")
  };
  vi.translateX = vi.x;
  vi.translateY = vi.y;
  const Fi = /* @__PURE__ */ new Set();
  let Vf = false, kf = false, Lf = false;
  function Eb() {
    if (kf) {
      const n = Array.from(Fi).filter((o) => o.needsMeasurement), i = new Set(n.map((o) => o.element)), l = /* @__PURE__ */ new Map();
      i.forEach((o) => {
        const c = JE(o);
        c.length && (l.set(o, c), o.render());
      }), n.forEach((o) => o.measureInitialState()), i.forEach((o) => {
        o.render();
        const c = l.get(o);
        c && c.forEach(([d, f]) => {
          var _a;
          (_a = o.getValue(d)) == null ? void 0 : _a.set(f);
        });
      }), n.forEach((o) => o.measureEndState()), n.forEach((o) => {
        o.suspendedScrollY !== void 0 && window.scrollTo(0, o.suspendedScrollY);
      });
    }
    kf = false, Vf = false, Fi.forEach((n) => n.complete(Lf)), Fi.clear();
  }
  function Cb() {
    Fi.forEach((n) => {
      n.readKeyframes(), n.needsMeasurement && (kf = true);
    });
  }
  function $E() {
    Lf = true, Cb(), Eb(), Lf = false;
  }
  class jd {
    constructor(i, l, o, c, d, f = false) {
      this.state = "pending", this.isAsync = false, this.needsMeasurement = false, this.unresolvedKeyframes = [
        ...i
      ], this.onComplete = l, this.name = o, this.motionValue = c, this.element = d, this.isAsync = f;
    }
    scheduleResolve() {
      this.state = "scheduled", this.isAsync ? (Fi.add(this), Vf || (Vf = true, Lt.read(Cb), Lt.resolveKeyframes(Eb))) : (this.readKeyframes(), this.complete());
    }
    readKeyframes() {
      const { unresolvedKeyframes: i, name: l, element: o, motionValue: c } = this;
      if (i[0] === null) {
        const d = c == null ? void 0 : c.get(), f = i[i.length - 1];
        if (d !== void 0) i[0] = d;
        else if (o && l) {
          const h = o.readValue(l, f);
          h != null && (i[0] = h);
        }
        i[0] === void 0 && (i[0] = f), c && d === void 0 && c.set(i[0]);
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
  const WE = (n) => n.startsWith("--");
  function Mb(n, i, l) {
    WE(i) ? n.style.setProperty(i, l) : n.style[i] = l;
  }
  const IE = {};
  function Rb(n, i) {
    const l = eb(n);
    return () => IE[i] ?? l();
  }
  const tC = Rb(() => window.ScrollTimeline !== void 0, "scrollTimeline"), Db = Rb(() => {
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
  }, "linearEasing"), tl = ([n, i, l, o]) => `cubic-bezier(${n}, ${i}, ${l}, ${o})`, Lg = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: tl([
      0,
      0.65,
      0.55,
      1
    ]),
    circOut: tl([
      0.55,
      0,
      1,
      0.45
    ]),
    backIn: tl([
      0.31,
      0.01,
      0.66,
      -0.59
    ]),
    backOut: tl([
      0.33,
      1.53,
      0.69,
      0.99
    ])
  };
  function Ob(n, i) {
    if (n) return typeof n == "function" ? Db() ? Tb(n, i) : "ease-out" : db(n) ? tl(n) : Array.isArray(n) ? n.map((l) => Ob(l, i) || Lg.easeOut) : Lg[n];
  }
  function eC(n, i, l, { delay: o = 0, duration: c = 300, repeat: d = 0, repeatType: f = "loop", ease: h = "easeOut", times: m } = {}, p = void 0) {
    const y = {
      [i]: l
    };
    m && (y.offset = m);
    const v = Ob(h, c);
    Array.isArray(v) && (y.easing = v);
    const b = {
      delay: o,
      duration: c,
      easing: Array.isArray(v) ? "linear" : v,
      fill: "both",
      iterations: d + 1,
      direction: f === "reverse" ? "alternate" : "normal"
    };
    return p && (b.pseudoElement = p), n.animate(y, b);
  }
  function Nb(n) {
    return typeof n == "function" && "applyToOptions" in n;
  }
  function nC({ type: n, ...i }) {
    return Nb(n) && Db() ? n.applyToOptions(i) : (i.duration ?? (i.duration = 300), i.ease ?? (i.ease = "easeOut"), i);
  }
  class jb extends Od {
    constructor(i) {
      if (super(), this.finishedTime = null, this.isStopped = false, this.manualStartTime = null, !i) return;
      const { element: l, name: o, keyframes: c, pseudoElement: d, allowFlatten: f = false, finalKeyframe: h, onComplete: m } = i;
      this.isPseudoElement = !!d, this.allowFlatten = f, this.options = i, xd(typeof i.type != "string");
      const p = nC(i);
      this.animation = eC(l, o, c, p, d), p.autoplay === false && this.animation.pause(), this.animation.onfinish = () => {
        if (this.finishedTime = this.time, !d) {
          const y = Dd(c, this.options, h, this.speed);
          this.updateMotionValue && this.updateMotionValue(y), Mb(l, o, y), this.animation.cancel();
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
    attachTimeline({ timeline: i, rangeStart: l, rangeEnd: o, observe: c }) {
      var _a;
      return this.allowFlatten && ((_a = this.animation.effect) == null ? void 0 : _a.updateTiming({
        easing: "linear"
      })), this.animation.onfinish = null, i && tC() ? (this.animation.timeline = i, l && (this.animation.rangeStart = l), o && (this.animation.rangeEnd = o), Fe) : c(this);
    }
  }
  const zb = {
    anticipate: rb,
    backInOut: ob,
    circInOut: ub
  };
  function iC(n) {
    return n in zb;
  }
  function aC(n) {
    typeof n.ease == "string" && iC(n.ease) && (n.ease = zb[n.ease]);
  }
  const lf = 10;
  class sC extends jb {
    constructor(i) {
      aC(i), Ab(i), super(i), i.startTime !== void 0 && i.autoplay !== false && (this.startTime = i.startTime), this.options = i;
    }
    updateMotionValue(i) {
      const { motionValue: l, onUpdate: o, onComplete: c, element: d, ...f } = this.options;
      if (!l) return;
      if (i !== void 0) {
        l.set(i);
        return;
      }
      const h = new Nd({
        ...f,
        autoplay: false
      }), m = Math.max(lf, me.now() - this.startTime), p = xn(0, lf, m - lf), y = h.sample(m).value, { name: v } = this.options;
      d && v && Mb(d, v, y), l.setWithVelocity(h.sample(Math.max(0, m - p)).value, y, p), h.stop();
    }
  }
  const Bg = (n, i) => i === "zIndex" ? false : !!(typeof n == "number" || Array.isArray(n) || typeof n == "string" && (sn.test(n) || n === "0") && !n.startsWith("url("));
  function lC(n) {
    const i = n[0];
    if (n.length === 1) return true;
    for (let l = 0; l < n.length; l++) if (n[l] !== i) return true;
  }
  function oC(n, i, l, o) {
    const c = n[0];
    if (c === null) return false;
    if (i === "display" || i === "visibility") return true;
    const d = n[n.length - 1], f = Bg(c, i), h = Bg(d, i);
    return !f || !h ? false : lC(n) || (l === "spring" || Nb(l)) && o;
  }
  function Bf(n) {
    n.duration = 0, n.type = "keyframes";
  }
  const rC = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]), cC = eb(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
  function uC(n) {
    var _a;
    const { motionValue: i, name: l, repeatDelay: o, repeatType: c, damping: d, type: f } = n;
    if (!(((_a = i == null ? void 0 : i.owner) == null ? void 0 : _a.current) instanceof HTMLElement)) return false;
    const { onUpdate: m, transformTemplate: p } = i.owner.getProps();
    return cC() && l && rC.has(l) && (l !== "transform" || !p) && !m && !o && c !== "mirror" && d !== 0 && f !== "inertia";
  }
  const fC = 40;
  class dC extends Od {
    constructor({ autoplay: i = true, delay: l = 0, type: o = "keyframes", repeat: c = 0, repeatDelay: d = 0, repeatType: f = "loop", keyframes: h, name: m, motionValue: p, element: y, ...v }) {
      var _a;
      super(), this.stop = () => {
        var _a2, _b2;
        this._animation && (this._animation.stop(), (_a2 = this.stopTimeline) == null ? void 0 : _a2.call(this)), (_b2 = this.keyframeResolver) == null ? void 0 : _b2.cancel();
      }, this.createdAt = me.now();
      const b = {
        autoplay: i,
        delay: l,
        type: o,
        repeat: c,
        repeatDelay: d,
        repeatType: f,
        name: m,
        motionValue: p,
        element: y,
        ...v
      }, T = (y == null ? void 0 : y.KeyframeResolver) || jd;
      this.keyframeResolver = new T(h, (A, C, R) => this.onKeyframesResolved(A, C, b, !R), m, p, y), (_a = this.keyframeResolver) == null ? void 0 : _a.scheduleResolve();
    }
    onKeyframesResolved(i, l, o, c) {
      var _a, _b2;
      this.keyframeResolver = void 0;
      const { name: d, type: f, velocity: h, delay: m, isHandoff: p, onUpdate: y } = o;
      this.resolvedAt = me.now();
      let v = true;
      oC(i, d, f, h) || (v = false, (Si.instantAnimations || !m) && (y == null ? void 0 : y(Dd(i, o, l))), i[0] = i[i.length - 1], Bf(o), o.repeat = 0);
      const T = {
        startTime: c ? this.resolvedAt ? this.resolvedAt - this.createdAt > fC ? this.resolvedAt : this.createdAt : this.createdAt : void 0,
        finalKeyframe: l,
        ...o,
        keyframes: i
      }, A = v && !p && uC(T), C = (_b2 = (_a = T.motionValue) == null ? void 0 : _a.owner) == null ? void 0 : _b2.current, R = A ? new sC({
        ...T,
        element: C
      }) : new Nd(T);
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
      return this._animation || ((_a = this.keyframeResolver) == null ? void 0 : _a.resume(), $E()), this._animation;
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
  function _b(n, i, l, o = 0, c = 1) {
    const d = Array.from(n).sort((p, y) => p.sortNodePosition(y)).indexOf(i), f = n.size, h = (f - 1) * o;
    return typeof l == "function" ? l(d, f) : c === 1 ? d * o : h - d * o;
  }
  const hC = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
  function mC(n) {
    const i = hC.exec(n);
    if (!i) return [
      ,
    ];
    const [, l, o, c] = i;
    return [
      `--${l ?? o}`,
      c
    ];
  }
  function Vb(n, i, l = 1) {
    const [o, c] = mC(n);
    if (!o) return;
    const d = window.getComputedStyle(i).getPropertyValue(o);
    if (d) {
      const f = d.trim();
      return W0(f) ? parseFloat(f) : f;
    }
    return Ad(c) ? Vb(c, i, l + 1) : c;
  }
  const pC = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  }, yC = (n) => ({
    type: "spring",
    stiffness: 550,
    damping: n === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  }), gC = {
    type: "keyframes",
    duration: 0.8
  }, vC = {
    type: "keyframes",
    ease: [
      0.25,
      0.1,
      0.35,
      1
    ],
    duration: 0.3
  }, bC = (n, { keyframes: i }) => i.length > 2 ? gC : es.has(n) ? n.startsWith("scale") ? yC(i[1]) : pC : vC, xC = (n) => n !== null;
  function SC(n, { repeat: i, repeatType: l = "loop" }, o) {
    const c = n.filter(xC), d = i && l !== "loop" && i % 2 === 1 ? 0 : c.length - 1;
    return c[d];
  }
  function kb(n, i) {
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
    return l !== n ? kb(l, n) : l;
  }
  function TC({ when: n, delay: i, delayChildren: l, staggerChildren: o, staggerDirection: c, repeat: d, repeatType: f, repeatDelay: h, from: m, elapsed: p, ...y }) {
    return !!Object.keys(y).length;
  }
  const _d = (n, i, l, o = {}, c, d) => (f) => {
    const h = zd(o, n) || {}, m = h.delay || o.delay || 0;
    let { elapsed: p = 0 } = o;
    p = p - ke(m);
    const y = {
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
      element: d ? void 0 : c
    };
    TC(h) || Object.assign(y, bC(n, y)), y.duration && (y.duration = ke(y.duration)), y.repeatDelay && (y.repeatDelay = ke(y.repeatDelay)), y.from !== void 0 && (y.keyframes[0] = y.from);
    let v = false;
    if ((y.type === false || y.duration === 0 && !y.repeatDelay) && (Bf(y), y.delay === 0 && (v = true)), (Si.instantAnimations || Si.skipAnimations || (c == null ? void 0 : c.shouldSkipAnimations)) && (v = true, Bf(y), y.delay = 0), y.allowFlatten = !h.type && !h.ease, v && !d && i.get() !== void 0) {
      const b = SC(y.keyframes, h);
      if (b !== void 0) {
        Lt.update(() => {
          y.onUpdate(b), y.onComplete();
        });
        return;
      }
    }
    return h.isSync ? new Nd(y) : new dC(y);
  };
  function Ug(n) {
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
      const [c, d] = Ug(o);
      i = i(l !== void 0 ? l : n.custom, c, d);
    }
    if (typeof i == "string" && (i = n.variants && n.variants[i]), typeof i == "function") {
      const [c, d] = Ug(o);
      i = i(l !== void 0 ? l : n.custom, c, d);
    }
    return i;
  }
  function Ji(n, i, l) {
    const o = n.getProps();
    return Vd(o, i, l !== void 0 ? l : o.custom, n);
  }
  const Lb = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...ts
  ]), Hg = 30, wC = (n) => !isNaN(parseFloat(n));
  class AC {
    constructor(i, l = {}) {
      this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (o) => {
        var _a;
        const c = me.now();
        if (this.updatedAt !== c && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(o), this.current !== this.prev && ((_a = this.events.change) == null ? void 0 : _a.notify(this.current), this.dependents)) for (const d of this.dependents) d.dirty();
      }, this.hasAnimated = false, this.setCurrent(i), this.owner = l.owner;
    }
    setCurrent(i) {
      this.current = i, this.updatedAt = me.now(), this.canTrackVelocity === null && i !== void 0 && (this.canTrackVelocity = wC(this.current));
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
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || i - this.updatedAt > Hg) return 0;
      const l = Math.min(this.updatedAt - this.prevUpdatedAt, Hg);
      return nb(parseFloat(this.current) - parseFloat(this.prevFrameValue), l);
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
  function Ja(n, i) {
    return new AC(n, i);
  }
  const Uf = (n) => Array.isArray(n);
  function EC(n, i, l) {
    n.hasValue(i) ? n.getValue(i).set(l) : n.addValue(i, Ja(l));
  }
  function CC(n) {
    return Uf(n) ? n[n.length - 1] || 0 : n;
  }
  function MC(n, i) {
    const l = Ji(n, i);
    let { transitionEnd: o = {}, transition: c = {}, ...d } = l || {};
    d = {
      ...d,
      ...o
    };
    for (const f in d) {
      const h = CC(d[f]);
      EC(n, f, h);
    }
  }
  const ue = (n) => !!(n && n.getVelocity);
  function RC(n) {
    return !!(ue(n) && n.add);
  }
  function Hf(n, i) {
    const l = n.getValue("willChange");
    if (RC(l)) return l.add(i);
    if (!l && Si.WillChange) {
      const o = new Si.WillChange("auto");
      n.addValue("willChange", o), o.add(i);
    }
  }
  function kd(n) {
    return n.replace(/([A-Z])/g, (i) => `-${i.toLowerCase()}`);
  }
  const DC = "framerAppearId", Bb = "data-" + kd(DC);
  function Ub(n) {
    return n.props[Bb];
  }
  function OC({ protectedKeys: n, needsAnimating: i }, l) {
    const o = n.hasOwnProperty(l) && i[l] !== true;
    return i[l] = false, o;
  }
  function Hb(n, i, { delay: l = 0, transitionOverride: o, type: c } = {}) {
    let { transition: d, transitionEnd: f, ...h } = i;
    const m = n.getDefaultTransition();
    d = d ? kb(d, m) : m;
    const p = d == null ? void 0 : d.reduceMotion;
    o && (d = o);
    const y = [], v = c && n.animationState && n.animationState.getState()[c];
    for (const b in h) {
      const T = n.getValue(b, n.latestValues[b] ?? null), A = h[b];
      if (A === void 0 || v && OC(v, b)) continue;
      const C = {
        delay: l,
        ...zd(d || {}, b)
      }, R = T.get();
      if (R !== void 0 && !T.isAnimating && !Array.isArray(A) && A === R && !C.velocity) continue;
      let O = false;
      if (window.MotionHandoffAnimation) {
        const _ = Ub(n);
        if (_) {
          const K = window.MotionHandoffAnimation(_, b, Lt);
          K !== null && (C.startTime = K, O = true);
        }
      }
      Hf(n, b);
      const L = p ?? n.shouldReduceMotion;
      T.start(_d(b, T, A, L && Lb.has(b) ? {
        type: false
      } : C, n, O));
      const z = T.animation;
      z && y.push(z);
    }
    if (f) {
      const b = () => Lt.update(() => {
        f && MC(n, f);
      });
      y.length ? Promise.all(y).then(b) : b();
    }
    return y;
  }
  function Gf(n, i, l = {}) {
    var _a;
    const o = Ji(n, i, l.type === "exit" ? (_a = n.presenceContext) == null ? void 0 : _a.custom : void 0);
    let { transition: c = n.getDefaultTransition() || {} } = o || {};
    l.transitionOverride && (c = l.transitionOverride);
    const d = o ? () => Promise.all(Hb(n, o, l)) : () => Promise.resolve(), f = n.variantChildren && n.variantChildren.size ? (m = 0) => {
      const { delayChildren: p = 0, staggerChildren: y, staggerDirection: v } = c;
      return NC(n, i, m, p, y, v, l);
    } : () => Promise.resolve(), { when: h } = c;
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
  function NC(n, i, l = 0, o = 0, c = 0, d = 1, f) {
    const h = [];
    for (const m of n.variantChildren) m.notify("AnimationStart", i), h.push(Gf(m, i, {
      ...f,
      delay: l + (typeof o == "function" ? 0 : o) + _b(n.variantChildren, m, o, c, d)
    }).then(() => m.notify("AnimationComplete", i)));
    return Promise.all(h);
  }
  function jC(n, i, l = {}) {
    n.notify("AnimationStart", i);
    let o;
    if (Array.isArray(i)) {
      const c = i.map((d) => Gf(n, d, l));
      o = Promise.all(c);
    } else if (typeof i == "string") o = Gf(n, i, l);
    else {
      const c = typeof i == "function" ? Ji(n, i, l.custom) : i;
      o = Promise.all(Hb(n, c, l));
    }
    return o.then(() => {
      n.notify("AnimationComplete", i);
    });
  }
  const zC = {
    test: (n) => n === "auto",
    parse: (n) => n
  }, Gb = (n) => (i) => i.test(n), Yb = [
    Ia,
    ot,
    bn,
    gi,
    lE,
    sE,
    zC
  ], Gg = (n) => Yb.find(Gb(n));
  function _C(n) {
    return typeof n == "number" ? n === 0 : n !== null ? n === "none" || n === "0" || tb(n) : true;
  }
  const VC = /* @__PURE__ */ new Set([
    "brightness",
    "contrast",
    "saturate",
    "opacity"
  ]);
  function kC(n) {
    const [i, l] = n.slice(0, -1).split("(");
    if (i === "drop-shadow") return n;
    const [o] = l.match(Ed) || [];
    if (!o) return n;
    const c = l.replace(o, "");
    let d = VC.has(i) ? 1 : 0;
    return o !== l && (d *= 100), i + "(" + d + c + ")";
  }
  const LC = /\b([a-z-]*)\(.*?\)/gu, Yf = {
    ...sn,
    getAnimatableNone: (n) => {
      const i = n.match(LC);
      return i ? i.map(kC).join(" ") : n;
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
  }, Yg = {
    ...Ia,
    transform: Math.round
  }, BC = {
    rotate: gi,
    rotateX: gi,
    rotateY: gi,
    rotateZ: gi,
    scale: Uo,
    scaleX: Uo,
    scaleY: Uo,
    scaleZ: Uo,
    skew: gi,
    skewX: gi,
    skewY: gi,
    distance: ot,
    translateX: ot,
    translateY: ot,
    translateZ: ot,
    x: ot,
    y: ot,
    z: ot,
    perspective: ot,
    transformPerspective: ot,
    opacity: rl,
    originX: Rg,
    originY: Rg,
    originZ: ot
  }, Ld = {
    borderWidth: ot,
    borderTopWidth: ot,
    borderRightWidth: ot,
    borderBottomWidth: ot,
    borderLeftWidth: ot,
    borderRadius: ot,
    borderTopLeftRadius: ot,
    borderTopRightRadius: ot,
    borderBottomRightRadius: ot,
    borderBottomLeftRadius: ot,
    width: ot,
    maxWidth: ot,
    height: ot,
    maxHeight: ot,
    top: ot,
    right: ot,
    bottom: ot,
    left: ot,
    inset: ot,
    insetBlock: ot,
    insetBlockStart: ot,
    insetBlockEnd: ot,
    insetInline: ot,
    insetInlineStart: ot,
    insetInlineEnd: ot,
    padding: ot,
    paddingTop: ot,
    paddingRight: ot,
    paddingBottom: ot,
    paddingLeft: ot,
    paddingBlock: ot,
    paddingBlockStart: ot,
    paddingBlockEnd: ot,
    paddingInline: ot,
    paddingInlineStart: ot,
    paddingInlineEnd: ot,
    margin: ot,
    marginTop: ot,
    marginRight: ot,
    marginBottom: ot,
    marginLeft: ot,
    marginBlock: ot,
    marginBlockStart: ot,
    marginBlockEnd: ot,
    marginInline: ot,
    marginInlineStart: ot,
    marginInlineEnd: ot,
    fontSize: ot,
    backgroundPositionX: ot,
    backgroundPositionY: ot,
    ...BC,
    zIndex: Yg,
    fillOpacity: rl,
    strokeOpacity: rl,
    numOctaves: Yg
  }, UC = {
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
    filter: Yf,
    WebkitFilter: Yf,
    mask: qf,
    WebkitMask: qf
  }, qb = (n) => UC[n], HC = /* @__PURE__ */ new Set([
    Yf,
    qf
  ]);
  function Pb(n, i) {
    let l = qb(n);
    return HC.has(l) || (l = sn), l.getAnimatableNone ? l.getAnimatableNone(i) : void 0;
  }
  const GC = /* @__PURE__ */ new Set([
    "auto",
    "none",
    "0"
  ]);
  function YC(n, i, l) {
    let o = 0, c;
    for (; o < n.length && !c; ) {
      const d = n[o];
      typeof d == "string" && !GC.has(d) && Fa(d).values.length && (c = n[o]), o++;
    }
    if (c && l) for (const d of i) n[d] = Pb(l, c);
  }
  class qC extends jd {
    constructor(i, l, o, c, d) {
      super(i, l, o, c, d, true);
    }
    readKeyframes() {
      const { unresolvedKeyframes: i, element: l, name: o } = this;
      if (!l || !l.current) return;
      super.readKeyframes();
      for (let y = 0; y < i.length; y++) {
        let v = i[y];
        if (typeof v == "string" && (v = v.trim(), Ad(v))) {
          const b = Vb(v, l.current);
          b !== void 0 && (i[y] = b), y === i.length - 1 && (this.finalKeyframe = v);
        }
      }
      if (this.resolveNoneKeyframes(), !Lb.has(o) || i.length !== 2) return;
      const [c, d] = i, f = Gg(c), h = Gg(d), m = Mg(c), p = Mg(d);
      if (m !== p && vi[o]) {
        this.needsMeasurement = true;
        return;
      }
      if (f !== h) if (kg(f) && kg(h)) for (let y = 0; y < i.length; y++) {
        const v = i[y];
        typeof v == "string" && (i[y] = parseFloat(v));
      }
      else vi[o] && (this.needsMeasurement = true);
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes: i, name: l } = this, o = [];
      for (let c = 0; c < i.length; c++) (i[c] === null || _C(i[c])) && o.push(c);
      o.length && YC(i, o, l);
    }
    measureInitialState() {
      const { element: i, unresolvedKeyframes: l, name: o } = this;
      if (!i || !i.current) return;
      o === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = vi[o](i.measureViewportBox(), window.getComputedStyle(i.current)), l[0] = this.measuredOrigin;
      const c = l[l.length - 1];
      c !== void 0 && i.getValue(o, c).jump(c, false);
    }
    measureEndState() {
      var _a;
      const { element: i, name: l, unresolvedKeyframes: o } = this;
      if (!i || !i.current) return;
      const c = i.getValue(l);
      c && c.jump(this.measuredOrigin, false);
      const d = o.length - 1, f = o[d];
      o[d] = vi[l](i.measureViewportBox(), window.getComputedStyle(i.current)), f !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = f), ((_a = this.removedTransforms) == null ? void 0 : _a.length) && this.removedTransforms.forEach(([h, m]) => {
        i.getValue(h).set(m);
      }), this.resolveNoneKeyframes();
    }
  }
  const PC = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]);
  function Xb(n, i, l) {
    if (n == null) return [];
    if (n instanceof EventTarget) return [
      n
    ];
    if (typeof n == "string") {
      let o = document;
      const c = (l == null ? void 0 : l[n]) ?? o.querySelectorAll(n);
      return c ? Array.from(c) : [];
    }
    return Array.from(n).filter((o) => o != null);
  }
  const Kb = (n, i) => i && typeof n == "number" ? i.transform(n) : n;
  function Xo(n) {
    return I0(n) && "offsetHeight" in n && !("ownerSVGElement" in n);
  }
  const { schedule: Bd } = hb(queueMicrotask, false), an = {
    x: false,
    y: false
  };
  function Zb() {
    return an.x || an.y;
  }
  function XC(n) {
    return n === "x" || n === "y" ? an[n] ? null : (an[n] = true, () => {
      an[n] = false;
    }) : an.x || an.y ? null : (an.x = an.y = true, () => {
      an.x = an.y = false;
    });
  }
  function Qb(n, i) {
    const l = Xb(n), o = new AbortController(), c = {
      passive: true,
      ...i,
      signal: o.signal
    };
    return [
      l,
      c,
      () => o.abort()
    ];
  }
  function KC(n) {
    return !(n.pointerType === "touch" || Zb());
  }
  function ZC(n, i, l = {}) {
    const [o, c, d] = Qb(n, l);
    return o.forEach((f) => {
      let h = false, m = false, p;
      const y = () => {
        f.removeEventListener("pointerleave", A);
      }, v = (R) => {
        p && (p(R), p = void 0), y();
      }, b = (R) => {
        h = false, window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", b), m && (m = false, v(R));
      }, T = () => {
        h = true, window.addEventListener("pointerup", b, c), window.addEventListener("pointercancel", b, c);
      }, A = (R) => {
        if (R.pointerType !== "touch") {
          if (h) {
            m = true;
            return;
          }
          v(R);
        }
      }, C = (R) => {
        if (!KC(R)) return;
        m = false;
        const O = i(f, R);
        typeof O == "function" && (p = O, f.addEventListener("pointerleave", A, c));
      };
      f.addEventListener("pointerenter", C, c), f.addEventListener("pointerdown", T, c);
    }), d;
  }
  const Fb = (n, i) => i ? n === i ? true : Fb(n, i.parentElement) : false, Ud = (n) => n.pointerType === "mouse" ? typeof n.button != "number" || n.button <= 0 : n.isPrimary !== false, QC = /* @__PURE__ */ new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A"
  ]);
  function FC(n) {
    return QC.has(n.tagName) || n.isContentEditable === true;
  }
  const JC = /* @__PURE__ */ new Set([
    "INPUT",
    "SELECT",
    "TEXTAREA"
  ]);
  function $C(n) {
    return JC.has(n.tagName) || n.isContentEditable === true;
  }
  const Ko = /* @__PURE__ */ new WeakSet();
  function qg(n) {
    return (i) => {
      i.key === "Enter" && n(i);
    };
  }
  function of(n, i) {
    n.dispatchEvent(new PointerEvent("pointer" + i, {
      isPrimary: true,
      bubbles: true
    }));
  }
  const WC = (n, i) => {
    const l = n.currentTarget;
    if (!l) return;
    const o = qg(() => {
      if (Ko.has(l)) return;
      of(l, "down");
      const c = qg(() => {
        of(l, "up");
      }), d = () => of(l, "cancel");
      l.addEventListener("keyup", c, i), l.addEventListener("blur", d, i);
    });
    l.addEventListener("keydown", o, i), l.addEventListener("blur", () => l.removeEventListener("keydown", o), i);
  };
  function Pg(n) {
    return Ud(n) && !Zb();
  }
  const Xg = /* @__PURE__ */ new WeakSet();
  function IC(n, i, l = {}) {
    const [o, c, d] = Qb(n, l), f = (h) => {
      const m = h.currentTarget;
      if (!Pg(h) || Xg.has(h)) return;
      Ko.add(m), l.stopPropagation && Xg.add(h);
      const p = i(m, h), y = (T, A) => {
        window.removeEventListener("pointerup", v), window.removeEventListener("pointercancel", b), Ko.has(m) && Ko.delete(m), Pg(T) && typeof p == "function" && p(T, {
          success: A
        });
      }, v = (T) => {
        y(T, m === window || m === document || l.useGlobalTarget || Fb(m, T.target));
      }, b = (T) => {
        y(T, false);
      };
      window.addEventListener("pointerup", v, c), window.addEventListener("pointercancel", b, c);
    };
    return o.forEach((h) => {
      (l.useGlobalTarget ? window : h).addEventListener("pointerdown", f, c), Xo(h) && (h.addEventListener("focus", (p) => WC(p, c)), !FC(h) && !h.hasAttribute("tabindex") && (h.tabIndex = 0));
    }), d;
  }
  function Hd(n) {
    return I0(n) && "ownerSVGElement" in n;
  }
  const Zo = /* @__PURE__ */ new WeakMap();
  let Qo;
  const Jb = (n, i, l) => (o, c) => c && c[0] ? c[0][n + "Size"] : Hd(o) && "getBBox" in o ? o.getBBox()[i] : o[l], tM = Jb("inline", "width", "offsetWidth"), eM = Jb("block", "height", "offsetHeight");
  function nM({ target: n, borderBoxSize: i }) {
    var _a;
    (_a = Zo.get(n)) == null ? void 0 : _a.forEach((l) => {
      l(n, {
        get width() {
          return tM(n, i);
        },
        get height() {
          return eM(n, i);
        }
      });
    });
  }
  function iM(n) {
    n.forEach(nM);
  }
  function aM() {
    typeof ResizeObserver > "u" || (Qo = new ResizeObserver(iM));
  }
  function sM(n, i) {
    Qo || aM();
    const l = Xb(n);
    return l.forEach((o) => {
      let c = Zo.get(o);
      c || (c = /* @__PURE__ */ new Set(), Zo.set(o, c)), c.add(i), Qo == null ? void 0 : Qo.observe(o);
    }), () => {
      l.forEach((o) => {
        const c = Zo.get(o);
        c == null ? void 0 : c.delete(i), (c == null ? void 0 : c.size) || (Qo == null ? void 0 : Qo.unobserve(o));
      });
    };
  }
  const Fo = /* @__PURE__ */ new Set();
  let Ga;
  function lM() {
    Ga = () => {
      const n = {
        get width() {
          return window.innerWidth;
        },
        get height() {
          return window.innerHeight;
        }
      };
      Fo.forEach((i) => i(n));
    }, window.addEventListener("resize", Ga);
  }
  function oM(n) {
    return Fo.add(n), Ga || lM(), () => {
      Fo.delete(n), !Fo.size && typeof Ga == "function" && (window.removeEventListener("resize", Ga), Ga = void 0);
    };
  }
  function Kg(n, i) {
    return typeof n == "function" ? oM(n) : sM(n, i);
  }
  function rM(n) {
    return Hd(n) && n.tagName === "svg";
  }
  const cM = [
    ...Yb,
    Wt,
    sn
  ], uM = (n) => cM.find(Gb(n)), Zg = () => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0
  }), Ya = () => ({
    x: Zg(),
    y: Zg()
  }), Qg = () => ({
    min: 0,
    max: 0
  }), ee = () => ({
    x: Qg(),
    y: Qg()
  }), fM = /* @__PURE__ */ new WeakMap();
  function Tr(n) {
    return n !== null && typeof n == "object" && typeof n.start == "function";
  }
  function cl(n) {
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
  function wr(n) {
    return Tr(n.animate) || Yd.some((i) => cl(n[i]));
  }
  function $b(n) {
    return !!(wr(n) || n.variants);
  }
  function dM(n, i, l) {
    for (const o in i) {
      const c = i[o], d = l[o];
      if (ue(c)) n.addValue(o, c);
      else if (ue(d)) n.addValue(o, Ja(c, {
        owner: n
      }));
      else if (d !== c) if (n.hasValue(o)) {
        const f = n.getValue(o);
        f.liveStyle === true ? f.jump(c) : f.hasAnimated || f.set(c);
      } else {
        const f = n.getStaticValue(o);
        n.addValue(o, Ja(f !== void 0 ? f : c, {
          owner: n
        }));
      }
    }
    for (const o in l) i[o] === void 0 && n.removeValue(o);
    return i;
  }
  const Pf = {
    current: null
  }, Wb = {
    current: false
  }, hM = typeof window < "u";
  function mM() {
    if (Wb.current = true, !!hM) if (window.matchMedia) {
      const n = window.matchMedia("(prefers-reduced-motion)"), i = () => Pf.current = n.matches;
      n.addEventListener("change", i), i();
    } else Pf.current = false;
  }
  const Fg = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete"
  ];
  let or = {};
  function Ib(n) {
    or = n;
  }
  function pM() {
    return or;
  }
  class yM {
    scrapeMotionValuesFromProps(i, l, o) {
      return {};
    }
    constructor({ parent: i, props: l, presenceContext: o, reducedMotionConfig: c, skipAnimations: d, blockInitialAnimation: f, visualState: h }, m = {}) {
      this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = false, this.isControllingVariants = false, this.shouldReduceMotion = null, this.shouldSkipAnimations = false, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = jd, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = false, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
        this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
      }, this.renderScheduledAt = 0, this.scheduleRender = () => {
        const T = me.now();
        this.renderScheduledAt < T && (this.renderScheduledAt = T, Lt.render(this.render, false, true));
      };
      const { latestValues: p, renderState: y } = h;
      this.latestValues = p, this.baseTarget = {
        ...p
      }, this.initialValues = l.initial ? {
        ...p
      } : {}, this.renderState = y, this.parent = i, this.props = l, this.presenceContext = o, this.depth = i ? i.depth + 1 : 0, this.reducedMotionConfig = c, this.skipAnimationsConfig = d, this.options = m, this.blockInitialAnimation = !!f, this.isControllingVariants = wr(l), this.isVariantNode = $b(l), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(i && i.current);
      const { willChange: v, ...b } = this.scrapeMotionValuesFromProps(l, {}, this);
      for (const T in b) {
        const A = b[T];
        p[T] !== void 0 && ue(A) && A.set(p[T]);
      }
    }
    mount(i) {
      var _a, _b2;
      if (this.hasBeenMounted) for (const l in this.initialValues) (_a = this.values.get(l)) == null ? void 0 : _a.jump(this.initialValues[l]), this.latestValues[l] = this.initialValues[l];
      this.current = i, fM.set(i, this), this.projection && !this.projection.instance && this.projection.mount(i), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((l, o) => this.bindToMotionValue(o, l)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = false : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = true : (Wb.current || mM(), this.shouldReduceMotion = Pf.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? false, (_b2 = this.parent) == null ? void 0 : _b2.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = true;
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
      if (this.valueSubscriptions.has(i) && this.valueSubscriptions.get(i)(), l.accelerate && PC.has(i) && this.current instanceof HTMLElement) {
        const { factory: f, keyframes: h, times: m, ease: p, duration: y } = l.accelerate, v = new jb({
          element: this.current,
          name: i,
          keyframes: h,
          times: m,
          ease: p,
          duration: ke(y)
        }), b = f(v);
        this.valueSubscriptions.set(i, () => {
          b(), v.cancel();
        });
        return;
      }
      const o = es.has(i);
      o && this.onBindTransform && this.onBindTransform();
      const c = l.on("change", (f) => {
        this.latestValues[i] = f, this.props.onUpdate && Lt.preRender(this.notifyUpdate), o && this.projection && (this.projection.isTransformDirty = true), this.scheduleRender();
      });
      let d;
      typeof window < "u" && window.MotionCheckAppearSync && (d = window.MotionCheckAppearSync(this, i, l)), this.valueSubscriptions.set(i, () => {
        c(), d && d(), l.owner && l.stop();
      });
    }
    sortNodePosition(i) {
      return !this.current || !this.sortInstanceNodePosition || this.type !== i.type ? 0 : this.sortInstanceNodePosition(this.current, i.current);
    }
    updateFeatures() {
      let i = "animation";
      for (i in or) {
        const l = or[i];
        if (!l) continue;
        const { isEnabled: o, Feature: c } = l;
        if (!this.features[i] && c && o(this.props) && (this.features[i] = new c(this)), this.features[i]) {
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
      for (let o = 0; o < Fg.length; o++) {
        const c = Fg[o];
        this.propEventSubscriptions[c] && (this.propEventSubscriptions[c](), delete this.propEventSubscriptions[c]);
        const d = "on" + c, f = i[d];
        f && (this.propEventSubscriptions[c] = this.on(c, f));
      }
      this.prevMotionValues = dM(this, this.scrapeMotionValuesFromProps(i, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
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
      return o === void 0 && l !== void 0 && (o = Ja(l === null ? void 0 : l, {
        owner: this
      }), this.addValue(i, o)), o;
    }
    readValue(i, l) {
      let o = this.latestValues[i] !== void 0 || !this.current ? this.latestValues[i] : this.getBaseTargetFromProps(this.props, i) ?? this.readValueFromInstance(this.current, i, this.options);
      return o != null && (typeof o == "string" && (W0(o) || tb(o)) ? o = parseFloat(o) : !uM(o) && sn.test(l) && (o = Pb(i, l)), this.setBaseTarget(i, ue(o) ? o.get() : o)), ue(o) ? o.get() : o;
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
      const c = this.getBaseTargetFromProps(this.props, i);
      return c !== void 0 && !ue(c) ? c : this.initialValues[i] !== void 0 && o === void 0 ? void 0 : this.baseTarget[i];
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
  class tx extends yM {
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
  function ex({ top: n, left: i, right: l, bottom: o }) {
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
  function gM({ x: n, y: i }) {
    return {
      top: i.min,
      right: n.max,
      bottom: i.max,
      left: n.min
    };
  }
  function vM(n, i) {
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
  function rf(n) {
    return n === void 0 || n === 1;
  }
  function Xf({ scale: n, scaleX: i, scaleY: l }) {
    return !rf(n) || !rf(i) || !rf(l);
  }
  function Ki(n) {
    return Xf(n) || nx(n) || n.z || n.rotate || n.rotateX || n.rotateY || n.skewX || n.skewY;
  }
  function nx(n) {
    return Jg(n.x) || Jg(n.y);
  }
  function Jg(n) {
    return n && n !== "0%";
  }
  function rr(n, i, l) {
    const o = n - l, c = i * o;
    return l + c;
  }
  function $g(n, i, l, o, c) {
    return c !== void 0 && (n = rr(n, c, o)), rr(n, l, o) + i;
  }
  function Kf(n, i = 0, l = 1, o, c) {
    n.min = $g(n.min, i, l, o, c), n.max = $g(n.max, i, l, o, c);
  }
  function ix(n, { x: i, y: l }) {
    Kf(n.x, i.translate, i.scale, i.originPoint), Kf(n.y, l.translate, l.scale, l.originPoint);
  }
  const Wg = 0.999999999999, Ig = 1.0000000000001;
  function bM(n, i, l, o = false) {
    var _a;
    const c = l.length;
    if (!c) return;
    i.x = i.y = 1;
    let d, f;
    for (let h = 0; h < c; h++) {
      d = l[h], f = d.projectionDelta;
      const { visualElement: m } = d.options;
      m && m.props.style && m.props.style.display === "contents" || (o && d.options.layoutScroll && d.scroll && d !== d.root && Pa(n, {
        x: -d.scroll.offset.x,
        y: -d.scroll.offset.y
      }), f && (i.x *= f.x.scale, i.y *= f.y.scale, ix(n, f)), o && Ki(d.latestValues) && Pa(n, d.latestValues, (_a = d.layout) == null ? void 0 : _a.layoutBox));
    }
    i.x < Ig && i.x > Wg && (i.x = 1), i.y < Ig && i.y > Wg && (i.y = 1);
  }
  function qa(n, i) {
    n.min = n.min + i, n.max = n.max + i;
  }
  function tv(n, i, l, o, c = 0.5) {
    const d = Gt(n.min, n.max, c);
    Kf(n, i, l, d, o);
  }
  function ev(n, i) {
    return typeof n == "string" ? parseFloat(n) / 100 * (i.max - i.min) : n;
  }
  function Pa(n, i, l) {
    const o = l ?? n;
    tv(n.x, ev(i.x, o.x), i.scaleX, i.scale, i.originX), tv(n.y, ev(i.y, o.y), i.scaleY, i.scale, i.originY);
  }
  function ax(n, i) {
    return ex(vM(n.getBoundingClientRect(), i));
  }
  function xM(n, i, l) {
    const o = ax(n, l), { scroll: c } = i;
    return c && (qa(o.x, c.offset.x), qa(o.y, c.offset.y)), o;
  }
  const SM = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  }, TM = ts.length;
  function wM(n, i, l) {
    let o = "", c = true;
    for (let d = 0; d < TM; d++) {
      const f = ts[d], h = n[f];
      if (h === void 0) continue;
      let m = true;
      if (typeof h == "number") m = h === (f.startsWith("scale") ? 1 : 0);
      else {
        const p = parseFloat(h);
        m = f.startsWith("scale") ? p === 1 : p === 0;
      }
      if (!m || l) {
        const p = Kb(h, Ld[f]);
        if (!m) {
          c = false;
          const y = SM[f] || f;
          o += `${y}(${p}) `;
        }
        l && (i[f] = p);
      }
    }
    return o = o.trim(), l ? o = l(i, c ? "" : o) : c && (o = "none"), o;
  }
  function qd(n, i, l) {
    const { style: o, vars: c, transformOrigin: d } = n;
    let f = false, h = false;
    for (const m in i) {
      const p = i[m];
      if (es.has(m)) {
        f = true;
        continue;
      } else if (pb(m)) {
        c[m] = p;
        continue;
      } else {
        const y = Kb(p, Ld[m]);
        m.startsWith("origin") ? (h = true, d[m] = y) : o[m] = y;
      }
    }
    if (i.transform || (f || l ? o.transform = wM(i, n.transform, l) : o.transform && (o.transform = "none")), h) {
      const { originX: m = "50%", originY: p = "50%", originZ: y = 0 } = d;
      o.transformOrigin = `${m} ${p} ${y}`;
    }
  }
  function sx(n, { style: i, vars: l }, o, c) {
    const d = n.style;
    let f;
    for (f in i) d[f] = i[f];
    c == null ? void 0 : c.applyProjectionStyles(d, o);
    for (f in l) d.setProperty(f, l[f]);
  }
  function nv(n, i) {
    return i.max === i.min ? 0 : n / (i.max - i.min) * 100;
  }
  const Is = {
    correct: (n, i) => {
      if (!i.target) return n;
      if (typeof n == "string") if (ot.test(n)) n = parseFloat(n);
      else return n;
      const l = nv(n, i.target.x), o = nv(n, i.target.y);
      return `${l}% ${o}%`;
    }
  }, AM = {
    correct: (n, { treeScale: i, projectionDelta: l }) => {
      const o = n, c = sn.parse(n);
      if (c.length > 5) return o;
      const d = sn.createTransformer(n), f = typeof c[0] != "number" ? 1 : 0, h = l.x.scale * i.x, m = l.y.scale * i.y;
      c[0 + f] /= h, c[1 + f] /= m;
      const p = Gt(h, m, 0.5);
      return typeof c[2 + f] == "number" && (c[2 + f] /= p), typeof c[3 + f] == "number" && (c[3 + f] /= p), d(c);
    }
  }, Zf = {
    borderRadius: {
      ...Is,
      applyTo: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius"
      ]
    },
    borderTopLeftRadius: Is,
    borderTopRightRadius: Is,
    borderBottomLeftRadius: Is,
    borderBottomRightRadius: Is,
    boxShadow: AM
  };
  function lx(n, { layout: i, layoutId: l }) {
    return es.has(n) || n.startsWith("origin") || (i || l !== void 0) && (!!Zf[n] || n === "opacity");
  }
  function Pd(n, i, l) {
    var _a;
    const o = n.style, c = i == null ? void 0 : i.style, d = {};
    if (!o) return d;
    for (const f in o) (ue(o[f]) || c && ue(c[f]) || lx(f, n) || ((_a = l == null ? void 0 : l.getValue(f)) == null ? void 0 : _a.liveStyle) !== void 0) && (d[f] = o[f]);
    return d;
  }
  function EM(n) {
    return window.getComputedStyle(n);
  }
  class CM extends tx {
    constructor() {
      super(...arguments), this.type = "html", this.renderInstance = sx;
    }
    readValueFromInstance(i, l) {
      var _a;
      if (es.has(l)) return ((_a = this.projection) == null ? void 0 : _a.isProjecting) ? zf(l) : KE(i, l);
      {
        const o = EM(i), c = (pb(l) ? o.getPropertyValue(l) : o[l]) || 0;
        return typeof c == "string" ? c.trim() : c;
      }
    }
    measureInstanceViewportBox(i, { transformPagePoint: l }) {
      return ax(i, l);
    }
    build(i, l, o) {
      qd(i, l, o.transformTemplate);
    }
    scrapeMotionValuesFromProps(i, l, o) {
      return Pd(i, l, o);
    }
  }
  const MM = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  }, RM = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  };
  function DM(n, i, l = 1, o = 0, c = true) {
    n.pathLength = 1;
    const d = c ? MM : RM;
    n[d.offset] = `${-o}`, n[d.array] = `${i} ${l}`;
  }
  const OM = [
    "offsetDistance",
    "offsetPath",
    "offsetRotate",
    "offsetAnchor"
  ];
  function ox(n, { attrX: i, attrY: l, attrScale: o, pathLength: c, pathSpacing: d = 1, pathOffset: f = 0, ...h }, m, p, y) {
    if (qd(n, h, p), m) {
      n.style.viewBox && (n.attrs.viewBox = n.style.viewBox);
      return;
    }
    n.attrs = n.style, n.style = {};
    const { attrs: v, style: b } = n;
    v.transform && (b.transform = v.transform, delete v.transform), (b.transform || v.transformOrigin) && (b.transformOrigin = v.transformOrigin ?? "50% 50%", delete v.transformOrigin), b.transform && (b.transformBox = (y == null ? void 0 : y.transformBox) ?? "fill-box", delete v.transformBox);
    for (const T of OM) v[T] !== void 0 && (b[T] = v[T], delete v[T]);
    i !== void 0 && (v.x = i), l !== void 0 && (v.y = l), o !== void 0 && (v.scale = o), c !== void 0 && DM(v, c, d, f, false);
  }
  const rx = /* @__PURE__ */ new Set([
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
  ]), cx = (n) => typeof n == "string" && n.toLowerCase() === "svg";
  function NM(n, i, l, o) {
    sx(n, i, void 0, o);
    for (const c in i.attrs) n.setAttribute(rx.has(c) ? c : kd(c), i.attrs[c]);
  }
  function ux(n, i, l) {
    const o = Pd(n, i, l);
    for (const c in n) if (ue(n[c]) || ue(i[c])) {
      const d = ts.indexOf(c) !== -1 ? "attr" + c.charAt(0).toUpperCase() + c.substring(1) : c;
      o[d] = n[c];
    }
    return o;
  }
  class jM extends tx {
    constructor() {
      super(...arguments), this.type = "svg", this.isSVGTag = false, this.measureInstanceViewportBox = ee;
    }
    getBaseTargetFromProps(i, l) {
      return i[l];
    }
    readValueFromInstance(i, l) {
      if (es.has(l)) {
        const o = qb(l);
        return o && o.default || 0;
      }
      return l = rx.has(l) ? l : kd(l), i.getAttribute(l);
    }
    scrapeMotionValuesFromProps(i, l, o) {
      return ux(i, l, o);
    }
    build(i, l, o) {
      ox(i, l, this.isSVGTag, o.transformTemplate, o.style);
    }
    renderInstance(i, l, o, c) {
      NM(i, l, o, c);
    }
    mount(i) {
      this.isSVGTag = cx(i.tagName), super.mount(i);
    }
  }
  const zM = Yd.length;
  function fx(n) {
    if (!n) return;
    if (!n.isControllingVariants) {
      const l = n.parent ? fx(n.parent) || {} : {};
      return n.props.initial !== void 0 && (l.initial = n.props.initial), l;
    }
    const i = {};
    for (let l = 0; l < zM; l++) {
      const o = Yd[l], c = n.props[o];
      (cl(c) || c === false) && (i[o] = c);
    }
    return i;
  }
  function dx(n, i) {
    if (!Array.isArray(i)) return false;
    const l = i.length;
    if (l !== n.length) return false;
    for (let o = 0; o < l; o++) if (i[o] !== n[o]) return false;
    return true;
  }
  const _M = [
    ...Gd
  ].reverse(), VM = Gd.length;
  function kM(n) {
    return (i) => Promise.all(i.map(({ animation: l, options: o }) => jC(n, l, o)));
  }
  function LM(n) {
    let i = kM(n), l = iv(), o = true, c = false;
    const d = (p) => (y, v) => {
      var _a;
      const b = Ji(n, v, p === "exit" ? (_a = n.presenceContext) == null ? void 0 : _a.custom : void 0);
      if (b) {
        const { transition: T, transitionEnd: A, ...C } = b;
        y = {
          ...y,
          ...C,
          ...A
        };
      }
      return y;
    };
    function f(p) {
      i = p(n);
    }
    function h(p) {
      const { props: y } = n, v = fx(n.parent) || {}, b = [], T = /* @__PURE__ */ new Set();
      let A = {}, C = 1 / 0;
      for (let O = 0; O < VM; O++) {
        const L = _M[O], z = l[L], _ = y[L] !== void 0 ? y[L] : v[L], K = cl(_), J = L === p ? z.isActive : null;
        J === false && (C = O);
        let Z = _ === v[L] && _ !== y[L] && K;
        if (Z && (o || c) && n.manuallyAnimateOnMount && (Z = false), z.protectedKeys = {
          ...A
        }, !z.isActive && J === null || !_ && !z.prevProp || Tr(_) || typeof _ == "boolean") continue;
        if (L === "exit" && z.isActive && J !== true) {
          z.prevResolvedValues && (A = {
            ...A,
            ...z.prevResolvedValues
          });
          continue;
        }
        const Y = BM(z.prevProp, _);
        let tt = Y || L === p && z.isActive && !Z && K || O > C && K, W = false;
        const nt = Array.isArray(_) ? _ : [
          _
        ];
        let at = nt.reduce(d(L), {});
        J === false && (at = {});
        const { prevResolvedValues: pt = {} } = z, dt = {
          ...pt,
          ...at
        }, ht = (k) => {
          tt = true, T.has(k) && (W = true, T.delete(k)), z.needsAnimating[k] = true;
          const $ = n.getValue(k);
          $ && ($.liveStyle = false);
        };
        for (const k in dt) {
          const $ = at[k], P = pt[k];
          if (A.hasOwnProperty(k)) continue;
          let E = false;
          Uf($) && Uf(P) ? E = !dx($, P) : E = $ !== P, E ? $ != null ? ht(k) : T.add(k) : $ !== void 0 && T.has(k) ? ht(k) : z.protectedKeys[k] = true;
        }
        z.prevProp = _, z.prevResolvedValues = at, z.isActive && (A = {
          ...A,
          ...at
        }), (o || c) && n.blockInitialAnimation && (tt = false);
        const V = Z && Y;
        tt && (!V || W) && b.push(...nt.map((k) => {
          const $ = {
            type: L
          };
          if (typeof k == "string" && (o || c) && !V && n.manuallyAnimateOnMount && n.parent) {
            const { parent: P } = n, E = Ji(P, k);
            if (P.enteringChildren && E) {
              const { delayChildren: B } = E.transition || {};
              $.delay = _b(P.enteringChildren, n, B);
            }
          }
          return {
            animation: k,
            options: $
          };
        }));
      }
      if (T.size) {
        const O = {};
        if (typeof y.initial != "boolean") {
          const L = Ji(n, Array.isArray(y.initial) ? y.initial[0] : y.initial);
          L && L.transition && (O.transition = L.transition);
        }
        T.forEach((L) => {
          const z = n.getBaseTarget(L), _ = n.getValue(L);
          _ && (_.liveStyle = true), O[L] = z ?? null;
        }), b.push({
          animation: O
        });
      }
      let R = !!b.length;
      return o && (y.initial === false || y.initial === y.animate) && !n.manuallyAnimateOnMount && (R = false), o = false, c = false, R ? i(b) : Promise.resolve();
    }
    function m(p, y) {
      var _a;
      if (l[p].isActive === y) return Promise.resolve();
      (_a = n.variantChildren) == null ? void 0 : _a.forEach((b) => {
        var _a2;
        return (_a2 = b.animationState) == null ? void 0 : _a2.setActive(p, y);
      }), l[p].isActive = y;
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
        l = iv(), c = true;
      }
    };
  }
  function BM(n, i) {
    return typeof i == "string" ? i !== n : Array.isArray(i) ? !dx(i, n) : false;
  }
  function Xi(n = false) {
    return {
      isActive: n,
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {}
    };
  }
  function iv() {
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
  function Qf(n, i) {
    n.min = i.min, n.max = i.max;
  }
  function nn(n, i) {
    Qf(n.x, i.x), Qf(n.y, i.y);
  }
  function av(n, i) {
    n.translate = i.translate, n.scale = i.scale, n.originPoint = i.originPoint, n.origin = i.origin;
  }
  const hx = 1e-4, UM = 1 - hx, HM = 1 + hx, mx = 0.01, GM = 0 - mx, YM = 0 + mx;
  function pe(n) {
    return n.max - n.min;
  }
  function qM(n, i, l) {
    return Math.abs(n - i) <= l;
  }
  function sv(n, i, l, o = 0.5) {
    n.origin = o, n.originPoint = Gt(i.min, i.max, n.origin), n.scale = pe(l) / pe(i), n.translate = Gt(l.min, l.max, n.origin) - n.originPoint, (n.scale >= UM && n.scale <= HM || isNaN(n.scale)) && (n.scale = 1), (n.translate >= GM && n.translate <= YM || isNaN(n.translate)) && (n.translate = 0);
  }
  function il(n, i, l, o) {
    sv(n.x, i.x, l.x, o ? o.originX : void 0), sv(n.y, i.y, l.y, o ? o.originY : void 0);
  }
  function lv(n, i, l) {
    n.min = l.min + i.min, n.max = n.min + pe(i);
  }
  function PM(n, i, l) {
    lv(n.x, i.x, l.x), lv(n.y, i.y, l.y);
  }
  function ov(n, i, l) {
    n.min = i.min - l.min, n.max = n.min + pe(i);
  }
  function cr(n, i, l) {
    ov(n.x, i.x, l.x), ov(n.y, i.y, l.y);
  }
  function rv(n, i, l, o, c) {
    return n -= i, n = rr(n, 1 / l, o), c !== void 0 && (n = rr(n, 1 / c, o)), n;
  }
  function XM(n, i = 0, l = 1, o = 0.5, c, d = n, f = n) {
    if (bn.test(i) && (i = parseFloat(i), i = Gt(f.min, f.max, i / 100) - f.min), typeof i != "number") return;
    let h = Gt(d.min, d.max, o);
    n === d && (h -= i), n.min = rv(n.min, i, l, h, c), n.max = rv(n.max, i, l, h, c);
  }
  function cv(n, i, [l, o, c], d, f) {
    XM(n, i[l], i[o], i[c], i.scale, d, f);
  }
  const KM = [
    "x",
    "scaleX",
    "originX"
  ], ZM = [
    "y",
    "scaleY",
    "originY"
  ];
  function uv(n, i, l, o) {
    cv(n.x, i, KM, l ? l.x : void 0, o ? o.x : void 0), cv(n.y, i, ZM, l ? l.y : void 0, o ? o.y : void 0);
  }
  function fv(n) {
    return n.translate === 0 && n.scale === 1;
  }
  function px(n) {
    return fv(n.x) && fv(n.y);
  }
  function dv(n, i) {
    return n.min === i.min && n.max === i.max;
  }
  function QM(n, i) {
    return dv(n.x, i.x) && dv(n.y, i.y);
  }
  function hv(n, i) {
    return Math.round(n.min) === Math.round(i.min) && Math.round(n.max) === Math.round(i.max);
  }
  function yx(n, i) {
    return hv(n.x, i.x) && hv(n.y, i.y);
  }
  function mv(n) {
    return pe(n.x) / pe(n.y);
  }
  function pv(n, i) {
    return n.translate === i.translate && n.scale === i.scale && n.originPoint === i.originPoint;
  }
  function pn(n) {
    return [
      n("x"),
      n("y")
    ];
  }
  function FM(n, i, l) {
    let o = "";
    const c = n.x.translate / i.x, d = n.y.translate / i.y, f = (l == null ? void 0 : l.z) || 0;
    if ((c || d || f) && (o = `translate3d(${c}px, ${d}px, ${f}px) `), (i.x !== 1 || i.y !== 1) && (o += `scale(${1 / i.x}, ${1 / i.y}) `), l) {
      const { transformPerspective: p, rotate: y, rotateX: v, rotateY: b, skewX: T, skewY: A } = l;
      p && (o = `perspective(${p}px) ${o}`), y && (o += `rotate(${y}deg) `), v && (o += `rotateX(${v}deg) `), b && (o += `rotateY(${b}deg) `), T && (o += `skewX(${T}deg) `), A && (o += `skewY(${A}deg) `);
    }
    const h = n.x.scale * i.x, m = n.y.scale * i.y;
    return (h !== 1 || m !== 1) && (o += `scale(${h}, ${m})`), o || "none";
  }
  const gx = [
    "TopLeft",
    "TopRight",
    "BottomLeft",
    "BottomRight"
  ], JM = gx.length, yv = (n) => typeof n == "string" ? parseFloat(n) : n, gv = (n) => typeof n == "number" || ot.test(n);
  function $M(n, i, l, o, c, d) {
    c ? (n.opacity = Gt(0, l.opacity ?? 1, WM(o)), n.opacityExit = Gt(i.opacity ?? 1, 0, IM(o))) : d && (n.opacity = Gt(i.opacity ?? 1, l.opacity ?? 1, o));
    for (let f = 0; f < JM; f++) {
      const h = `border${gx[f]}Radius`;
      let m = vv(i, h), p = vv(l, h);
      if (m === void 0 && p === void 0) continue;
      m || (m = 0), p || (p = 0), m === 0 || p === 0 || gv(m) === gv(p) ? (n[h] = Math.max(Gt(yv(m), yv(p), o), 0), (bn.test(p) || bn.test(m)) && (n[h] += "%")) : n[h] = p;
    }
    (i.rotate || l.rotate) && (n.rotate = Gt(i.rotate || 0, l.rotate || 0, o));
  }
  function vv(n, i) {
    return n[i] !== void 0 ? n[i] : n.borderRadius;
  }
  const WM = vx(0, 0.5, cb), IM = vx(0.5, 0.95, Fe);
  function vx(n, i, l) {
    return (o) => o < n ? 0 : o > i ? 1 : l(ol(n, i, o));
  }
  function tR(n, i, l) {
    const o = ue(n) ? n : Ja(n);
    return o.start(_d("", o, i, l)), o.animation;
  }
  function ul(n, i, l, o = {
    passive: true
  }) {
    return n.addEventListener(i, l, o), () => n.removeEventListener(i, l);
  }
  const eR = (n, i) => n.depth - i.depth;
  class nR {
    constructor() {
      this.children = [], this.isDirty = false;
    }
    add(i) {
      bd(this.children, i), this.isDirty = true;
    }
    remove(i) {
      ir(this.children, i), this.isDirty = true;
    }
    forEach(i) {
      this.isDirty && this.children.sort(eR), this.isDirty = false, this.children.forEach(i);
    }
  }
  function iR(n, i) {
    const l = me.now(), o = ({ timestamp: c }) => {
      const d = c - l;
      d >= i && (Ti(o), n(d - i));
    };
    return Lt.setup(o, true), () => Ti(o);
  }
  function Jo(n) {
    return ue(n) ? n.get() : n;
  }
  class aR {
    constructor() {
      this.members = [];
    }
    add(i) {
      bd(this.members, i);
      for (let l = this.members.length - 1; l >= 0; l--) {
        const o = this.members[l];
        if (o === i || o === this.lead || o === this.prevLead) continue;
        const c = o.instance;
        (!c || c.isConnected === false) && !o.snapshot && (ir(this.members, o), o.unmount());
      }
      i.scheduleRender();
    }
    remove(i) {
      if (ir(this.members, i), i === this.prevLead && (this.prevLead = void 0), i === this.lead) {
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
        const { layoutDependency: c } = o.options, { layoutDependency: d } = i.options;
        (c === void 0 || c !== d) && (i.resumeFrom = o, l && (o.preserveOpacity = true), o.snapshot && (i.snapshot = o.snapshot, i.snapshot.latestValues = o.animationValues || o.latestValues), ((_a = i.root) == null ? void 0 : _a.isUpdating) && (i.isLayoutDirty = true)), i.options.crossfade === false && o.hide();
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
  const $o = {
    hasAnimatedSinceResize: true,
    hasEverUpdated: false
  }, cf = [
    "",
    "X",
    "Y",
    "Z"
  ], sR = 1e3;
  let lR = 0;
  function uf(n, i, l, o) {
    const { latestValues: c } = i;
    c[n] && (l[n] = c[n], i.setStaticValue(n, 0), o && (o[n] = 0));
  }
  function bx(n) {
    if (n.hasCheckedOptimisedAppear = true, n.root === n) return;
    const { visualElement: i } = n.options;
    if (!i) return;
    const l = Ub(i);
    if (window.MotionHasOptimisedAnimation(l, "transform")) {
      const { layout: c, layoutId: d } = n.options;
      window.MotionCancelOptimisedAnimation(l, "transform", Lt, !(c || d));
    }
    const { parent: o } = n;
    o && !o.hasCheckedOptimisedAppear && bx(o);
  }
  function xx({ attachResizeListener: n, defaultParent: i, measureScroll: l, checkIsScrollRoot: o, resetTransform: c }) {
    return class {
      constructor(f = {}, h = i == null ? void 0 : i()) {
        this.id = lR++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = false, this.isAnimationBlocked = false, this.isLayoutDirty = false, this.isProjectionDirty = false, this.isSharedProjectionDirty = false, this.isTransformDirty = false, this.updateManuallyBlocked = false, this.updateBlockedByResize = false, this.isUpdating = false, this.isSVG = false, this.needsReset = false, this.shouldResetTransform = false, this.hasCheckedOptimisedAppear = false, this.treeScale = {
          x: 1,
          y: 1
        }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = false, this.layoutVersion = 0, this.updateScheduled = false, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = false, this.checkUpdateFailed = () => {
          this.isUpdating && (this.isUpdating = false, this.clearAllSnapshots());
        }, this.updateProjection = () => {
          this.projectionUpdateScheduled = false, this.nodes.forEach(cR), this.nodes.forEach(hR), this.nodes.forEach(mR), this.nodes.forEach(uR);
        }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = false, this.isVisible = true, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = f, this.root = h ? h.root || h : this, this.path = h ? [
          ...h.path,
          h
        ] : [], this.parent = h, this.depth = h ? h.depth + 1 : 0;
        for (let m = 0; m < this.path.length; m++) this.path[m].shouldResetTransform = true;
        this.root === this && (this.nodes = new nR());
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
        this.isSVG = Hd(f) && !rM(f), this.instance = f;
        const { layoutId: h, layout: m, visualElement: p } = this.options;
        if (p && !p.current && p.mount(f), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (m || h) && (this.isLayoutDirty = true), n) {
          let y, v = 0;
          const b = () => this.root.updateBlockedByResize = false;
          Lt.read(() => {
            v = window.innerWidth;
          }), n(f, () => {
            const T = window.innerWidth;
            T !== v && (v = T, this.root.updateBlockedByResize = true, y && y(), y = iR(b, 250), $o.hasAnimatedSinceResize && ($o.hasAnimatedSinceResize = false, this.nodes.forEach(Sv)));
          });
        }
        h && this.root.registerSharedNode(h, this), this.options.animate !== false && p && (h || m) && this.addEventListener("didUpdate", ({ delta: y, hasLayoutChanged: v, hasRelativeLayoutChanged: b, layout: T }) => {
          if (this.isTreeAnimationBlocked()) {
            this.target = void 0, this.relativeTarget = void 0;
            return;
          }
          const A = this.options.transition || p.getDefaultTransition() || bR, { onLayoutAnimationStart: C, onLayoutAnimationComplete: R } = p.getProps(), O = !this.targetLayout || !yx(this.targetLayout, T), L = !v && b;
          if (this.options.layoutRoot || this.resumeFrom || L || v && (O || !this.currentAnimation)) {
            this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
            const z = {
              ...zd(A, "layout"),
              onPlay: C,
              onComplete: R
            };
            (p.shouldReduceMotion || this.options.layoutRoot) && (z.delay = 0, z.type = false), this.startAnimation(z), this.setAnimationOrigin(y, L);
          } else v || Sv(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
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
        this.isUpdateBlocked() || (this.isUpdating = true, this.nodes && this.nodes.forEach(pR), this.animationId++);
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
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && bx(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
        this.isLayoutDirty = true;
        for (let y = 0; y < this.path.length; y++) {
          const v = this.path[y];
          v.shouldResetTransform = true, (typeof v.latestValues.x == "string" || typeof v.latestValues.y == "string") && (v.isLayoutDirty = true), v.updateScroll("snapshot"), v.options.layoutRoot && v.willUpdate(false);
        }
        const { layoutId: h, layout: m } = this.options;
        if (h === void 0 && !m) return;
        const p = this.getTransformTemplate();
        this.prevTransformTemplateValue = p ? p(this.latestValues, "") : void 0, this.updateSnapshot(), f && this.notifyListeners("willUpdate");
      }
      update() {
        if (this.updateScheduled = false, this.isUpdateBlocked()) {
          this.unblockUpdate(), this.clearAllSnapshots(), this.nodes.forEach(bv);
          return;
        }
        if (this.animationId <= this.animationCommitId) {
          this.nodes.forEach(xv);
          return;
        }
        this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = false, this.nodes.forEach(dR), this.nodes.forEach(oR), this.nodes.forEach(rR)) : this.nodes.forEach(xv), this.clearAllSnapshots();
        const h = me.now();
        ce.delta = xn(0, 1e3 / 60, h - ce.timestamp), ce.timestamp = h, ce.isProcessing = true, tf.update.process(ce), tf.preRender.process(ce), tf.render.process(ce), ce.isProcessing = false;
      }
      didUpdate() {
        this.updateScheduled || (this.updateScheduled = true, Bd.read(this.scheduleUpdate));
      }
      clearAllSnapshots() {
        this.nodes.forEach(fR), this.sharedNodes.forEach(yR);
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
        if (!c) return;
        const f = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, h = this.projectionDelta && !px(this.projectionDelta), m = this.getTransformTemplate(), p = m ? m(this.latestValues, "") : void 0, y = p !== this.prevTransformTemplateValue;
        f && this.instance && (h || Ki(this.latestValues) || y) && (c(this.instance, p), this.shouldResetTransform = false, this.scheduleRender());
      }
      measure(f = true) {
        const h = this.measurePageBox();
        let m = this.removeElementScroll(h);
        return f && (m = this.removeTransform(m)), xR(m), {
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
        if (!(((_a = this.scroll) == null ? void 0 : _a.wasRoot) || this.path.some(SR))) {
          const { scroll: p } = this.root;
          p && (qa(h.x, p.offset.x), qa(h.y, p.offset.y));
        }
        return h;
      }
      removeElementScroll(f) {
        var _a;
        const h = ee();
        if (nn(h, f), (_a = this.scroll) == null ? void 0 : _a.wasRoot) return h;
        for (let m = 0; m < this.path.length; m++) {
          const p = this.path[m], { scroll: y, options: v } = p;
          p !== this.root && y && v.layoutScroll && (y.wasRoot && nn(h, f), qa(h.x, y.offset.x), qa(h.y, y.offset.y));
        }
        return h;
      }
      applyTransform(f, h = false) {
        var _a, _b2;
        const m = ee();
        nn(m, f);
        for (let p = 0; p < this.path.length; p++) {
          const y = this.path[p];
          !h && y.options.layoutScroll && y.scroll && y !== y.root && Pa(m, {
            x: -y.scroll.offset.x,
            y: -y.scroll.offset.y
          }), Ki(y.latestValues) && Pa(m, y.latestValues, (_a = y.layout) == null ? void 0 : _a.layoutBox);
        }
        return Ki(this.latestValues) && Pa(m, this.latestValues, (_b2 = this.layout) == null ? void 0 : _b2.layoutBox), m;
      }
      removeTransform(f) {
        var _a;
        const h = ee();
        nn(h, f);
        for (let m = 0; m < this.path.length; m++) {
          const p = this.path[m];
          if (!Ki(p.latestValues)) continue;
          let y;
          p.instance && (Xf(p.latestValues) && p.updateSnapshot(), y = ee(), nn(y, p.measurePageBox())), uv(h, p.latestValues, (_a = p.snapshot) == null ? void 0 : _a.layoutBox, y);
        }
        return Ki(this.latestValues) && uv(h, this.latestValues), h;
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
        const { layout: y, layoutId: v } = this.options;
        if (!this.layout || !(y || v)) return;
        this.resolvedRelativeTargetAt = ce.timestamp;
        const b = this.getClosestProjectingParent();
        b && this.linkedParentVersion !== b.layoutVersion && !b.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (b && b.layout ? this.createRelativeTarget(b, this.layout.layoutBox, b.layout.layoutBox) : this.removeRelativeTarget()), !(!this.relativeTarget && !this.targetDelta) && (this.target || (this.target = ee(), this.targetWithTransforms = ee()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), PM(this.target, this.relativeTarget, this.relativeParent.target)) : this.targetDelta ? (this.resumingFrom ? this.target = this.applyTransform(this.layout.layoutBox) : nn(this.target, this.layout.layoutBox), ix(this.target, this.targetDelta)) : nn(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = false, b && !!b.resumingFrom == !!this.resumingFrom && !b.options.layoutScroll && b.target && this.animationProgress !== 1 ? this.createRelativeTarget(b, this.target, b.target) : this.relativeParent = this.relativeTarget = void 0));
      }
      getClosestProjectingParent() {
        if (!(!this.parent || Xf(this.parent.latestValues) || nx(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
      }
      isProjecting() {
        return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      createRelativeTarget(f, h, m) {
        this.relativeParent = f, this.linkedParentVersion = f.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = ee(), this.relativeTargetOrigin = ee(), cr(this.relativeTargetOrigin, h, m), nn(this.relativeTarget, this.relativeTargetOrigin);
      }
      removeRelativeTarget() {
        this.relativeParent = this.relativeTarget = void 0;
      }
      calcProjection() {
        var _a;
        const f = this.getLead(), h = !!this.resumingFrom || this !== f;
        let m = true;
        if ((this.isProjectionDirty || ((_a = this.parent) == null ? void 0 : _a.isProjectionDirty)) && (m = false), h && (this.isSharedProjectionDirty || this.isTransformDirty) && (m = false), this.resolvedRelativeTargetAt === ce.timestamp && (m = false), m) return;
        const { layout: p, layoutId: y } = this.options;
        if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(p || y)) return;
        nn(this.layoutCorrected, this.layout.layoutBox);
        const v = this.treeScale.x, b = this.treeScale.y;
        bM(this.layoutCorrected, this.treeScale, this.path, h), f.layout && !f.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (f.target = f.layout.layoutBox, f.targetWithTransforms = ee());
        const { target: T } = f;
        if (!T) {
          this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
          return;
        }
        !this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (av(this.prevProjectionDelta.x, this.projectionDelta.x), av(this.prevProjectionDelta.y, this.projectionDelta.y)), il(this.projectionDelta, this.layoutCorrected, T, this.latestValues), (this.treeScale.x !== v || this.treeScale.y !== b || !pv(this.projectionDelta.x, this.prevProjectionDelta.x) || !pv(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = true, this.scheduleRender(), this.notifyListeners("projectionUpdate", T));
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
        const m = this.snapshot, p = m ? m.latestValues : {}, y = {
          ...this.latestValues
        }, v = Ya();
        (!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !h;
        const b = ee(), T = m ? m.source : void 0, A = this.layout ? this.layout.source : void 0, C = T !== A, R = this.getStack(), O = !R || R.members.length <= 1, L = !!(C && !O && this.options.crossfade === true && !this.path.some(vR));
        this.animationProgress = 0;
        let z;
        this.mixTargetDelta = (_) => {
          const K = _ / 1e3;
          Tv(v.x, f.x, K), Tv(v.y, f.y, K), this.setTargetDelta(v), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (cr(b, this.layout.layoutBox, this.relativeParent.layout.layoutBox), gR(this.relativeTarget, this.relativeTargetOrigin, b, K), z && QM(this.relativeTarget, z) && (this.isProjectionDirty = false), z || (z = ee()), nn(z, this.relativeTarget)), C && (this.animationValues = y, $M(y, p, this.latestValues, K, L, O)), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = K;
        }, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(f) {
        var _a, _b2, _c;
        this.notifyListeners("animationStart"), (_a = this.currentAnimation) == null ? void 0 : _a.stop(), (_c = (_b2 = this.resumingFrom) == null ? void 0 : _b2.currentAnimation) == null ? void 0 : _c.stop(), this.pendingAnimation && (Ti(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = Lt.update(() => {
          $o.hasAnimatedSinceResize = true, this.motionValue || (this.motionValue = Ja(0)), this.motionValue.jump(0, false), this.currentAnimation = tR(this.motionValue, [
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
        this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(sR), this.currentAnimation.stop()), this.completeAnimation();
      }
      applyTransformsToTarget() {
        const f = this.getLead();
        let { targetWithTransforms: h, target: m, layout: p, latestValues: y } = f;
        if (!(!h || !m || !p)) {
          if (this !== f && this.layout && p && Sx(this.options.animationType, this.layout.layoutBox, p.layoutBox)) {
            m = this.target || ee();
            const v = pe(this.layout.layoutBox.x);
            m.x.min = f.target.x.min, m.x.max = m.x.min + v;
            const b = pe(this.layout.layoutBox.y);
            m.y.min = f.target.y.min, m.y.max = m.y.min + b;
          }
          nn(h, m), Pa(h, y), il(this.projectionDeltaWithTransform, this.layoutCorrected, h, y);
        }
      }
      registerSharedNode(f, h) {
        this.sharedNodes.has(f) || this.sharedNodes.set(f, new aR()), this.sharedNodes.get(f).add(h);
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
        m.z && uf("z", f, p, this.animationValues);
        for (let y = 0; y < cf.length; y++) uf(`rotate${cf[y]}`, f, p, this.animationValues), uf(`skew${cf[y]}`, f, p, this.animationValues);
        f.render();
        for (const y in p) f.setStaticValue(y, p[y]), this.animationValues && (this.animationValues[y] = p[y]);
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
          this.needsReset = false, f.visibility = "", f.opacity = "", f.pointerEvents = Jo(h == null ? void 0 : h.pointerEvents) || "", f.transform = m ? m(this.latestValues, "") : "none";
          return;
        }
        const p = this.getLead();
        if (!this.projectionDelta || !this.layout || !p.target) {
          this.options.layoutId && (f.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1, f.pointerEvents = Jo(h == null ? void 0 : h.pointerEvents) || ""), this.hasProjected && !Ki(this.latestValues) && (f.transform = m ? m({}, "") : "none", this.hasProjected = false);
          return;
        }
        f.visibility = "";
        const y = p.animationValues || p.latestValues;
        this.applyTransformsToTarget();
        let v = FM(this.projectionDeltaWithTransform, this.treeScale, y);
        m && (v = m(y, v)), f.transform = v;
        const { x: b, y: T } = this.projectionDelta;
        f.transformOrigin = `${b.origin * 100}% ${T.origin * 100}% 0`, p.animationValues ? f.opacity = p === this ? y.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : y.opacityExit : f.opacity = p === this ? y.opacity !== void 0 ? y.opacity : "" : y.opacityExit !== void 0 ? y.opacityExit : 0;
        for (const A in Zf) {
          if (y[A] === void 0) continue;
          const { correct: C, applyTo: R, isCSSVariable: O } = Zf[A], L = v === "none" ? y[A] : C(y[A], p);
          if (R) {
            const z = R.length;
            for (let _ = 0; _ < z; _++) f[R[_]] = L;
          } else O ? this.options.visualElement.renderState.vars[A] = L : f[A] = L;
        }
        this.options.layoutId && (f.pointerEvents = p === this ? Jo(h == null ? void 0 : h.pointerEvents) || "" : "none");
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      resetTree() {
        this.root.nodes.forEach((f) => {
          var _a;
          return (_a = f.currentAnimation) == null ? void 0 : _a.stop();
        }), this.root.nodes.forEach(bv), this.root.sharedNodes.clear();
      }
    };
  }
  function oR(n) {
    n.updateLayout();
  }
  function rR(n) {
    var _a;
    const i = ((_a = n.resumeFrom) == null ? void 0 : _a.snapshot) || n.snapshot;
    if (n.isLead() && n.layout && i && n.hasListeners("didUpdate")) {
      const { layoutBox: l, measuredBox: o } = n.layout, { animationType: c } = n.options, d = i.source !== n.layout.source;
      if (c === "size") pn((y) => {
        const v = d ? i.measuredBox[y] : i.layoutBox[y], b = pe(v);
        v.min = l[y].min, v.max = v.min + b;
      });
      else if (c === "x" || c === "y") {
        const y = c === "x" ? "y" : "x";
        Qf(d ? i.measuredBox[y] : i.layoutBox[y], l[y]);
      } else Sx(c, i.layoutBox, l) && pn((y) => {
        const v = d ? i.measuredBox[y] : i.layoutBox[y], b = pe(l[y]);
        v.max = v.min + b, n.relativeTarget && !n.currentAnimation && (n.isProjectionDirty = true, n.relativeTarget[y].max = n.relativeTarget[y].min + b);
      });
      const f = Ya();
      il(f, l, i.layoutBox);
      const h = Ya();
      d ? il(h, n.applyTransform(o, true), i.measuredBox) : il(h, l, i.layoutBox);
      const m = !px(f);
      let p = false;
      if (!n.resumeFrom) {
        const y = n.getClosestProjectingParent();
        if (y && !y.resumeFrom) {
          const { snapshot: v, layout: b } = y;
          if (v && b) {
            const T = ee();
            cr(T, i.layoutBox, v.layoutBox);
            const A = ee();
            cr(A, l, b.layoutBox), yx(T, A) || (p = true), y.options.layoutRoot && (n.relativeTarget = A, n.relativeTargetOrigin = T, n.relativeParent = y);
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
  function cR(n) {
    n.parent && (n.isProjecting() || (n.isProjectionDirty = n.parent.isProjectionDirty), n.isSharedProjectionDirty || (n.isSharedProjectionDirty = !!(n.isProjectionDirty || n.parent.isProjectionDirty || n.parent.isSharedProjectionDirty)), n.isTransformDirty || (n.isTransformDirty = n.parent.isTransformDirty));
  }
  function uR(n) {
    n.isProjectionDirty = n.isSharedProjectionDirty = n.isTransformDirty = false;
  }
  function fR(n) {
    n.clearSnapshot();
  }
  function bv(n) {
    n.clearMeasurements();
  }
  function xv(n) {
    n.isLayoutDirty = false;
  }
  function dR(n) {
    const { visualElement: i } = n.options;
    i && i.getProps().onBeforeLayoutMeasure && i.notify("BeforeLayoutMeasure"), n.resetTransform();
  }
  function Sv(n) {
    n.finishAnimation(), n.targetDelta = n.relativeTarget = n.target = void 0, n.isProjectionDirty = true;
  }
  function hR(n) {
    n.resolveTargetDelta();
  }
  function mR(n) {
    n.calcProjection();
  }
  function pR(n) {
    n.resetSkewAndRotation();
  }
  function yR(n) {
    n.removeLeadSnapshot();
  }
  function Tv(n, i, l) {
    n.translate = Gt(i.translate, 0, l), n.scale = Gt(i.scale, 1, l), n.origin = i.origin, n.originPoint = i.originPoint;
  }
  function wv(n, i, l, o) {
    n.min = Gt(i.min, l.min, o), n.max = Gt(i.max, l.max, o);
  }
  function gR(n, i, l, o) {
    wv(n.x, i.x, l.x, o), wv(n.y, i.y, l.y, o);
  }
  function vR(n) {
    return n.animationValues && n.animationValues.opacityExit !== void 0;
  }
  const bR = {
    duration: 0.45,
    ease: [
      0.4,
      0,
      0.1,
      1
    ]
  }, Av = (n) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(n), Ev = Av("applewebkit/") && !Av("chrome/") ? Math.round : Fe;
  function Cv(n) {
    n.min = Ev(n.min), n.max = Ev(n.max);
  }
  function xR(n) {
    Cv(n.x), Cv(n.y);
  }
  function Sx(n, i, l) {
    return n === "position" || n === "preserve-aspect" && !qM(mv(i), mv(l), 0.2);
  }
  function SR(n) {
    var _a;
    return n !== n.root && ((_a = n.scroll) == null ? void 0 : _a.wasRoot);
  }
  const TR = xx({
    attachResizeListener: (n, i) => ul(n, "resize", i),
    measureScroll: () => {
      var _a, _b2;
      return {
        x: document.documentElement.scrollLeft || ((_a = document.body) == null ? void 0 : _a.scrollLeft) || 0,
        y: document.documentElement.scrollTop || ((_b2 = document.body) == null ? void 0 : _b2.scrollTop) || 0
      };
    },
    checkIsScrollRoot: () => true
  }), ff = {
    current: void 0
  }, Tx = xx({
    measureScroll: (n) => ({
      x: n.scrollLeft,
      y: n.scrollTop
    }),
    defaultParent: () => {
      if (!ff.current) {
        const n = new TR({});
        n.mount(window), n.setOptions({
          layoutScroll: true
        }), ff.current = n;
      }
      return ff.current;
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
  function Mv(n, i) {
    if (typeof n == "function") return n(i);
    n != null && (n.current = i);
  }
  function wR(...n) {
    return (i) => {
      let l = false;
      const o = n.map((c) => {
        const d = Mv(c, i);
        return !l && typeof d == "function" && (l = true), d;
      });
      if (l) return () => {
        for (let c = 0; c < o.length; c++) {
          const d = o[c];
          typeof d == "function" ? d() : Mv(n[c], null);
        }
      };
    };
  }
  function AR(...n) {
    return w.useCallback(wR(...n), n);
  }
  class ER extends w.Component {
    getSnapshotBeforeUpdate(i) {
      const l = this.props.childRef.current;
      if (Xo(l) && i.isPresent && !this.props.isPresent && this.props.pop !== false) {
        const o = l.offsetParent, c = Xo(o) && o.offsetWidth || 0, d = Xo(o) && o.offsetHeight || 0, f = getComputedStyle(l), h = this.props.sizeRef.current;
        h.height = parseFloat(f.height), h.width = parseFloat(f.width), h.top = l.offsetTop, h.left = l.offsetLeft, h.right = c - h.width - h.left, h.bottom = d - h.height - h.top;
      }
      return null;
    }
    componentDidUpdate() {
    }
    render() {
      return this.props.children;
    }
  }
  function CR({ children: n, isPresent: i, anchorX: l, anchorY: o, root: c, pop: d }) {
    var _a;
    const f = w.useId(), h = w.useRef(null), m = w.useRef({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }), { nonce: p } = w.useContext(Xd), y = ((_a = n.props) == null ? void 0 : _a.ref) ?? (n == null ? void 0 : n.ref), v = AR(h, y);
    return w.useInsertionEffect(() => {
      const { width: b, height: T, top: A, left: C, right: R, bottom: O } = m.current;
      if (i || d === false || !h.current || !b || !T) return;
      const L = l === "left" ? `left: ${C}` : `right: ${R}`, z = o === "bottom" ? `bottom: ${O}` : `top: ${A}`;
      h.current.dataset.motionPopId = f;
      const _ = document.createElement("style");
      p && (_.nonce = p);
      const K = c ?? document.head;
      return K.appendChild(_), _.sheet && _.sheet.insertRule(`
          [data-motion-pop-id="${f}"] {
            position: absolute !important;
            width: ${b}px !important;
            height: ${T}px !important;
            ${L}px !important;
            ${z}px !important;
          }
        `), () => {
        var _a2;
        (_a2 = h.current) == null ? void 0 : _a2.removeAttribute("data-motion-pop-id"), K.contains(_) && K.removeChild(_);
      };
    }, [
      i
    ]), S.jsx(ER, {
      isPresent: i,
      childRef: h,
      sizeRef: m,
      pop: d,
      children: d === false ? n : w.cloneElement(n, {
        ref: v
      })
    });
  }
  const MR = ({ children: n, initial: i, isPresent: l, onExitComplete: o, custom: c, presenceAffectsLayout: d, mode: f, anchorX: h, anchorY: m, root: p }) => {
    const y = vd(RR), v = w.useId();
    let b = true, T = w.useMemo(() => (b = false, {
      id: v,
      initial: i,
      isPresent: l,
      custom: c,
      onExitComplete: (A) => {
        y.set(A, true);
        for (const C of y.values()) if (!C) return;
        o && o();
      },
      register: (A) => (y.set(A, false), () => y.delete(A))
    }), [
      l,
      y,
      o
    ]);
    return d && b && (T = {
      ...T
    }), w.useMemo(() => {
      y.forEach((A, C) => y.set(C, false));
    }, [
      l
    ]), w.useEffect(() => {
      !l && !y.size && o && o();
    }, [
      l
    ]), n = S.jsx(CR, {
      pop: f === "popLayout",
      isPresent: l,
      anchorX: h,
      anchorY: m,
      root: p,
      children: n
    }), S.jsx(Sr.Provider, {
      value: T,
      children: n
    });
  };
  function RR() {
    return /* @__PURE__ */ new Map();
  }
  function wx(n = true) {
    const i = w.useContext(Sr);
    if (i === null) return [
      true,
      null
    ];
    const { isPresent: l, onExitComplete: o, register: c } = i, d = w.useId();
    w.useEffect(() => {
      if (n) return c(d);
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
  const Ho = (n) => n.key || "";
  function Rv(n) {
    const i = [];
    return w.Children.forEach(n, (l) => {
      w.isValidElement(l) && i.push(l);
    }), i;
  }
  const Xa = ({ children: n, custom: i, initial: l = true, onExitComplete: o, presenceAffectsLayout: c = true, mode: d = "sync", propagate: f = false, anchorX: h = "left", anchorY: m = "top", root: p }) => {
    const [y, v] = wx(f), b = w.useMemo(() => Rv(n), [
      n
    ]), T = f && !y ? [] : b.map(Ho), A = w.useRef(true), C = w.useRef(b), R = vd(() => /* @__PURE__ */ new Map()), O = w.useRef(/* @__PURE__ */ new Set()), [L, z] = w.useState(b), [_, K] = w.useState(b);
    $0(() => {
      A.current = false, C.current = b;
      for (let Y = 0; Y < _.length; Y++) {
        const tt = Ho(_[Y]);
        T.includes(tt) ? (R.delete(tt), O.current.delete(tt)) : R.get(tt) !== true && R.set(tt, false);
      }
    }, [
      _,
      T.length,
      T.join("-")
    ]);
    const J = [];
    if (b !== L) {
      let Y = [
        ...b
      ];
      for (let tt = 0; tt < _.length; tt++) {
        const W = _[tt], nt = Ho(W);
        T.includes(nt) || (Y.splice(tt, 0, W), J.push(W));
      }
      return d === "wait" && J.length && (Y = J), K(Rv(Y)), z(b), null;
    }
    const { forceRender: Z } = w.useContext(gd);
    return S.jsx(S.Fragment, {
      children: _.map((Y) => {
        const tt = Ho(Y), W = f && !y ? false : b === _ || T.includes(tt), nt = () => {
          if (O.current.has(tt)) return;
          if (R.has(tt)) O.current.add(tt), R.set(tt, true);
          else return;
          let at = true;
          R.forEach((pt) => {
            pt || (at = false);
          }), at && (Z == null ? void 0 : Z(), K(C.current), f && (v == null ? void 0 : v()), o && o());
        };
        return S.jsx(MR, {
          isPresent: W,
          initial: !A.current || l ? void 0 : false,
          custom: i,
          presenceAffectsLayout: c,
          mode: d,
          root: p,
          onExitComplete: W ? void 0 : nt,
          anchorX: h,
          anchorY: m,
          children: Y
        }, tt);
      })
    });
  }, Ax = w.createContext({
    strict: false
  }), Dv = {
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
  let Ov = false;
  function DR() {
    if (Ov) return;
    const n = {};
    for (const i in Dv) n[i] = {
      isEnabled: (l) => Dv[i].some((o) => !!l[o])
    };
    Ib(n), Ov = true;
  }
  function Ex() {
    return DR(), pM();
  }
  function OR(n) {
    const i = Ex();
    for (const l in n) i[l] = {
      ...i[l],
      ...n[l]
    };
    Ib(i);
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
  function ur(n) {
    return n.startsWith("while") || n.startsWith("drag") && n !== "draggable" || n.startsWith("layout") || n.startsWith("onTap") || n.startsWith("onPan") || n.startsWith("onLayout") || NR.has(n);
  }
  let Cx = (n) => !ur(n);
  function jR(n) {
    typeof n == "function" && (Cx = (i) => i.startsWith("on") ? !ur(i) : n(i));
  }
  try {
    jR(require("@emotion/is-prop-valid").default);
  } catch {
  }
  function zR(n, i, l) {
    const o = {};
    for (const c in n) c === "values" && typeof n.values == "object" || ue(n[c]) || (Cx(c) || l === true && ur(c) || !i && !ur(c) || n.draggable && c.startsWith("onDrag")) && (o[c] = n[c]);
    return o;
  }
  const Ar = w.createContext({});
  function _R(n, i) {
    if (wr(n)) {
      const { initial: l, animate: o } = n;
      return {
        initial: l === false || cl(l) ? l : void 0,
        animate: cl(o) ? o : void 0
      };
    }
    return n.inherit !== false ? i : {};
  }
  function VR(n) {
    const { initial: i, animate: l } = _R(n, w.useContext(Ar));
    return w.useMemo(() => ({
      initial: i,
      animate: l
    }), [
      Nv(i),
      Nv(l)
    ]);
  }
  function Nv(n) {
    return Array.isArray(n) ? n.join(" ") : n;
  }
  const Kd = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {}
  });
  function Mx(n, i, l) {
    for (const o in i) !ue(i[o]) && !lx(o, l) && (n[o] = i[o]);
  }
  function kR({ transformTemplate: n }, i) {
    return w.useMemo(() => {
      const l = Kd();
      return qd(l, i, n), Object.assign({}, l.vars, l.style);
    }, [
      i
    ]);
  }
  function LR(n, i) {
    const l = n.style || {}, o = {};
    return Mx(o, l, n), Object.assign(o, kR(n, i)), o;
  }
  function BR(n, i) {
    const l = {}, o = LR(n, i);
    return n.drag && n.dragListener !== false && (l.draggable = false, o.userSelect = o.WebkitUserSelect = o.WebkitTouchCallout = "none", o.touchAction = n.drag === true ? "none" : `pan-${n.drag === "x" ? "y" : "x"}`), n.tabIndex === void 0 && (n.onTap || n.onTapStart || n.whileTap) && (l.tabIndex = 0), l.style = o, l;
  }
  const Rx = () => ({
    ...Kd(),
    attrs: {}
  });
  function UR(n, i, l, o) {
    const c = w.useMemo(() => {
      const d = Rx();
      return ox(d, i, cx(o), n.transformTemplate, n.style), {
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
      Mx(d, n.style, n), c.style = {
        ...d,
        ...c.style
      };
    }
    return c;
  }
  const HR = [
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
    return typeof n != "string" || n.includes("-") ? false : !!(HR.indexOf(n) > -1 || /[A-Z]/u.test(n));
  }
  function GR(n, i, l, { latestValues: o }, c, d = false, f) {
    const m = (f ?? Zd(n) ? UR : BR)(i, o, c, n), p = zR(i, typeof n == "string", d), y = n !== w.Fragment ? {
      ...p,
      ...m,
      ref: l
    } : {}, { children: v } = i, b = w.useMemo(() => ue(v) ? v.get() : v, [
      v
    ]);
    return w.createElement(n, {
      ...y,
      children: b
    });
  }
  function YR({ scrapeMotionValuesFromProps: n, createRenderState: i }, l, o, c) {
    return {
      latestValues: qR(l, o, c, n),
      renderState: i()
    };
  }
  function qR(n, i, l, o) {
    const c = {}, d = o(n, {});
    for (const b in d) c[b] = Jo(d[b]);
    let { initial: f, animate: h } = n;
    const m = wr(n), p = $b(n);
    i && p && !m && n.inherit !== false && (f === void 0 && (f = i.initial), h === void 0 && (h = i.animate));
    let y = l ? l.initial === false : false;
    y = y || f === false;
    const v = y ? h : f;
    if (v && typeof v != "boolean" && !Tr(v)) {
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
              const _ = y ? z.length - 1 : 0;
              z = z[_];
            }
            z !== null && (c[L] = z);
          }
          for (const L in C) c[L] = C[L];
        }
      }
    }
    return c;
  }
  const Dx = (n) => (i, l) => {
    const o = w.useContext(Ar), c = w.useContext(Sr), d = () => YR(n, i, o, c);
    return l ? d() : vd(d);
  }, PR = Dx({
    scrapeMotionValuesFromProps: Pd,
    createRenderState: Kd
  }), XR = Dx({
    scrapeMotionValuesFromProps: ux,
    createRenderState: Rx
  }), KR = Symbol.for("motionComponentSymbol");
  function ZR(n, i, l) {
    const o = w.useRef(l);
    w.useInsertionEffect(() => {
      o.current = l;
    });
    const c = w.useRef(null);
    return w.useCallback((d) => {
      var _a;
      d && ((_a = n.onMount) == null ? void 0 : _a.call(n, d));
      const f = o.current;
      if (typeof f == "function") if (d) {
        const h = f(d);
        typeof h == "function" && (c.current = h);
      } else c.current ? (c.current(), c.current = null) : f(d);
      else f && (f.current = d);
      i && (d ? i.mount(d) : i.unmount());
    }, [
      i
    ]);
  }
  const Ox = w.createContext({});
  function Ba(n) {
    return n && typeof n == "object" && Object.prototype.hasOwnProperty.call(n, "current");
  }
  function QR(n, i, l, o, c, d) {
    var _a, _b2;
    const { visualElement: f } = w.useContext(Ar), h = w.useContext(Ax), m = w.useContext(Sr), p = w.useContext(Xd), y = p.reducedMotion, v = p.skipAnimations, b = w.useRef(null), T = w.useRef(false);
    o = o || h.renderer, !b.current && o && (b.current = o(n, {
      visualState: i,
      parent: f,
      props: l,
      presenceContext: m,
      blockInitialAnimation: m ? m.initial === false : false,
      reducedMotionConfig: y,
      skipAnimations: v,
      isSVG: d
    }), T.current && b.current && (b.current.manuallyAnimateOnMount = true));
    const A = b.current, C = w.useContext(Ox);
    A && !A.projection && c && (A.type === "html" || A.type === "svg") && FR(b.current, l, c, C);
    const R = w.useRef(false);
    w.useInsertionEffect(() => {
      A && R.current && A.update(l, m);
    });
    const O = l[Bb], L = w.useRef(!!O && typeof window < "u" && !((_a = window.MotionHandoffIsComplete) == null ? void 0 : _a.call(window, O)) && ((_b2 = window.MotionHasOptimisedAnimation) == null ? void 0 : _b2.call(window, O)));
    return $0(() => {
      T.current = true, A && (R.current = true, window.MotionIsMounted = true, A.updateFeatures(), A.scheduleRenderMicrotask(), L.current && A.animationState && A.animationState.animateChanges());
    }), w.useEffect(() => {
      A && (!L.current && A.animationState && A.animationState.animateChanges(), L.current && (queueMicrotask(() => {
        var _a2;
        (_a2 = window.MotionHandoffMarkAsComplete) == null ? void 0 : _a2.call(window, O);
      }), L.current = false), A.enteringChildren = void 0);
    }), A;
  }
  function FR(n, i, l, o) {
    const { layoutId: c, layout: d, drag: f, dragConstraints: h, layoutScroll: m, layoutRoot: p, layoutCrossfade: y } = i;
    n.projection = new l(n.latestValues, i["data-framer-portal-id"] ? void 0 : Nx(n.parent)), n.projection.setOptions({
      layoutId: c,
      layout: d,
      alwaysMeasureLayout: !!f || h && Ba(h),
      visualElement: n,
      animationType: typeof d == "string" ? d : "both",
      initialPromotionConfig: o,
      crossfade: y,
      layoutScroll: m,
      layoutRoot: p
    });
  }
  function Nx(n) {
    if (n) return n.options.allowProjection !== false ? n.projection : Nx(n.parent);
  }
  function df(n, { forwardMotionProps: i = false, type: l } = {}, o, c) {
    o && OR(o);
    const d = l ? l === "svg" : Zd(n), f = d ? XR : PR;
    function h(p, y) {
      let v;
      const b = {
        ...w.useContext(Xd),
        ...p,
        layoutId: JR(p)
      }, { isStatic: T } = b, A = VR(p), C = f(p, T);
      if (!T && typeof window < "u") {
        $R();
        const R = WR(b);
        v = R.MeasureLayout, A.visualElement = QR(n, C, b, c, R.ProjectionNode, d);
      }
      return S.jsxs(Ar.Provider, {
        value: A,
        children: [
          v && A.visualElement ? S.jsx(v, {
            visualElement: A.visualElement,
            ...b
          }) : null,
          GR(n, p, ZR(C, A.visualElement, y), C, T, i, d)
        ]
      });
    }
    h.displayName = `motion.${typeof n == "string" ? n : `create(${n.displayName ?? n.name ?? ""})`}`;
    const m = w.forwardRef(h);
    return m[KR] = n, m;
  }
  function JR({ layoutId: n }) {
    const i = w.useContext(gd).id;
    return i && n !== void 0 ? i + "-" + n : n;
  }
  function $R(n, i) {
    w.useContext(Ax).strict;
  }
  function WR(n) {
    const i = Ex(), { drag: l, layout: o } = i;
    if (!l && !o) return {};
    const c = {
      ...l,
      ...o
    };
    return {
      MeasureLayout: (l == null ? void 0 : l.isEnabled(n)) || (o == null ? void 0 : o.isEnabled(n)) ? c.MeasureLayout : void 0,
      ProjectionNode: c.ProjectionNode
    };
  }
  function IR(n, i) {
    if (typeof Proxy > "u") return df;
    const l = /* @__PURE__ */ new Map(), o = (d, f) => df(d, f, n, i), c = (d, f) => o(d, f);
    return new Proxy(c, {
      get: (d, f) => f === "create" ? o : (l.has(f) || l.set(f, df(f, void 0, n, i)), l.get(f))
    });
  }
  const tD = (n, i) => i.isSVG ?? Zd(n) ? new jM(i) : new CM(i, {
    allowProjection: n !== w.Fragment
  });
  class eD extends Ai {
    constructor(i) {
      super(i), i.animationState || (i.animationState = LM(i));
    }
    updateAnimationControlsSubscription() {
      const { animate: i } = this.node.getProps();
      Tr(i) && (this.unmountControls = i.subscribe(this.node));
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
  let nD = 0;
  class iD extends Ai {
    constructor() {
      super(...arguments), this.id = nD++, this.isExitComplete = false;
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
              const { transition: m, transitionEnd: p, ...y } = h;
              for (const v in y) (_a = this.node.getValue(v)) == null ? void 0 : _a.jump(y[v]);
            }
          }
          this.node.animationState.reset(), this.node.animationState.animateChanges();
        } else this.node.animationState.setActive("exit", false);
        this.isExitComplete = false;
        return;
      }
      const c = this.node.animationState.setActive("exit", !i);
      l && !i && c.then(() => {
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
  const aD = {
    animation: {
      Feature: eD
    },
    exit: {
      Feature: iD
    }
  };
  function pl(n) {
    return {
      point: {
        x: n.pageX,
        y: n.pageY
      }
    };
  }
  const sD = (n) => (i) => Ud(i) && n(i, pl(i));
  function al(n, i, l, o) {
    return ul(n, i, sD(l), o);
  }
  const jx = ({ current: n }) => n ? n.ownerDocument.defaultView : null, jv = (n, i) => Math.abs(n - i);
  function lD(n, i) {
    const l = jv(n.x, i.x), o = jv(n.y, i.y);
    return Math.sqrt(l ** 2 + o ** 2);
  }
  const zv = /* @__PURE__ */ new Set([
    "auto",
    "scroll"
  ]);
  class zx {
    constructor(i, l, { transformPagePoint: o, contextWindow: c = window, dragSnapToOrigin: d = false, distanceThreshold: f = 3, element: h } = {}) {
      if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (T) => {
        this.handleScroll(T.target);
      }, this.onWindowScroll = () => {
        this.handleScroll(window);
      }, this.updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Go(this.lastRawMoveEventInfo, this.transformPagePoint));
        const T = hf(this.lastMoveEventInfo, this.history), A = this.startEvent !== null, C = lD(T.offset, {
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
        this.lastMoveEvent = T, this.lastRawMoveEventInfo = A, this.lastMoveEventInfo = Go(A, this.transformPagePoint), Lt.update(this.updatePoint, true);
      }, this.handlePointerUp = (T, A) => {
        this.end();
        const { onEnd: C, onSessionEnd: R, resumeAnimation: O } = this.handlers;
        if ((this.dragSnapToOrigin || !this.startEvent) && O && O(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        const L = hf(T.type === "pointercancel" ? this.lastMoveEventInfo : Go(A, this.transformPagePoint), this.history);
        this.startEvent && C && C(T, L), R && R(T, L);
      }, !Ud(i)) return;
      this.dragSnapToOrigin = d, this.handlers = l, this.transformPagePoint = o, this.distanceThreshold = f, this.contextWindow = c || window;
      const m = pl(i), p = Go(m, this.transformPagePoint), { point: y } = p, { timestamp: v } = ce;
      this.history = [
        {
          ...y,
          timestamp: v
        }
      ];
      const { onSessionStart: b } = l;
      b && b(i, hf(p, this.history)), this.removeListeners = dl(al(this.contextWindow, "pointermove", this.handlePointerMove), al(this.contextWindow, "pointerup", this.handlePointerUp), al(this.contextWindow, "pointercancel", this.handlePointerUp)), h && this.startScrollTracking(h);
    }
    startScrollTracking(i) {
      let l = i.parentElement;
      for (; l; ) {
        const o = getComputedStyle(l);
        (zv.has(o.overflowX) || zv.has(o.overflowY)) && this.scrollPositions.set(l, {
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
      const o = i === window, c = o ? {
        x: window.scrollX,
        y: window.scrollY
      } : {
        x: i.scrollLeft,
        y: i.scrollTop
      }, d = {
        x: c.x - l.x,
        y: c.y - l.y
      };
      d.x === 0 && d.y === 0 || (o ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += d.x, this.lastMoveEventInfo.point.y += d.y) : this.history.length > 0 && (this.history[0].x -= d.x, this.history[0].y -= d.y), this.scrollPositions.set(i, c), Lt.update(this.updatePoint, true));
    }
    updateHandlers(i) {
      this.handlers = i;
    }
    end() {
      this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), Ti(this.updatePoint);
    }
  }
  function Go(n, i) {
    return i ? {
      point: i(n.point)
    } : n;
  }
  function _v(n, i) {
    return {
      x: n.x - i.x,
      y: n.y - i.y
    };
  }
  function hf({ point: n }, i) {
    return {
      point: n,
      delta: _v(n, _x(i)),
      offset: _v(n, oD(i)),
      velocity: rD(i, 0.1)
    };
  }
  function oD(n) {
    return n[0];
  }
  function _x(n) {
    return n[n.length - 1];
  }
  function rD(n, i) {
    if (n.length < 2) return {
      x: 0,
      y: 0
    };
    let l = n.length - 1, o = null;
    const c = _x(n);
    for (; l >= 0 && (o = n[l], !(c.timestamp - o.timestamp > ke(i))); ) l--;
    if (!o) return {
      x: 0,
      y: 0
    };
    o === n[0] && n.length > 2 && c.timestamp - o.timestamp > ke(i) * 2 && (o = n[1]);
    const d = Qe(c.timestamp - o.timestamp);
    if (d === 0) return {
      x: 0,
      y: 0
    };
    const f = {
      x: (c.x - o.x) / d,
      y: (c.y - o.y) / d
    };
    return f.x === 1 / 0 && (f.x = 0), f.y === 1 / 0 && (f.y = 0), f;
  }
  function cD(n, { min: i, max: l }, o) {
    return i !== void 0 && n < i ? n = o ? Gt(i, n, o.min) : Math.max(n, i) : l !== void 0 && n > l && (n = o ? Gt(l, n, o.max) : Math.min(n, l)), n;
  }
  function Vv(n, i, l) {
    return {
      min: i !== void 0 ? n.min + i : void 0,
      max: l !== void 0 ? n.max + l - (n.max - n.min) : void 0
    };
  }
  function uD(n, { top: i, left: l, bottom: o, right: c }) {
    return {
      x: Vv(n.x, l, c),
      y: Vv(n.y, i, o)
    };
  }
  function kv(n, i) {
    let l = i.min - n.min, o = i.max - n.max;
    return i.max - i.min < n.max - n.min && ([l, o] = [
      o,
      l
    ]), {
      min: l,
      max: o
    };
  }
  function fD(n, i) {
    return {
      x: kv(n.x, i.x),
      y: kv(n.y, i.y)
    };
  }
  function dD(n, i) {
    let l = 0.5;
    const o = pe(n), c = pe(i);
    return c > o ? l = ol(i.min, i.max - o, n.min) : o > c && (l = ol(n.min, n.max - c, i.min)), xn(0, 1, l);
  }
  function hD(n, i) {
    const l = {};
    return i.min !== void 0 && (l.min = i.min - n.min), i.max !== void 0 && (l.max = i.max - n.min), l;
  }
  const Ff = 0.35;
  function mD(n = Ff) {
    return n === false ? n = 0 : n === true && (n = Ff), {
      x: Lv(n, "left", "right"),
      y: Lv(n, "top", "bottom")
    };
  }
  function Lv(n, i, l) {
    return {
      min: Bv(n, i),
      max: Bv(n, l)
    };
  }
  function Bv(n, i) {
    return typeof n == "number" ? n : n[i] || 0;
  }
  const pD = /* @__PURE__ */ new WeakMap();
  class yD {
    constructor(i) {
      this.openDragLock = null, this.isDragging = false, this.currentDirection = null, this.originPoint = {
        x: 0,
        y: 0
      }, this.constraints = false, this.hasMutatedConstraints = false, this.elastic = ee(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = i;
    }
    start(i, { snapToCursor: l = false, distanceThreshold: o } = {}) {
      const { presenceContext: c } = this.visualElement;
      if (c && c.isPresent === false) return;
      const d = (v) => {
        l && this.snapToCursor(pl(v).point), this.stopAnimation();
      }, f = (v, b) => {
        const { drag: T, dragPropagation: A, onDragStart: C } = this.getProps();
        if (T && !A && (this.openDragLock && this.openDragLock(), this.openDragLock = XC(T), !this.openDragLock)) return;
        this.latestPointerEvent = v, this.latestPanInfo = b, this.isDragging = true, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = true, this.visualElement.projection.target = void 0), pn((O) => {
          let L = this.getAxisMotionValue(O).get() || 0;
          if (bn.test(L)) {
            const { projection: z } = this.visualElement;
            if (z && z.layout) {
              const _ = z.layout.layoutBox[O];
              _ && (L = pe(_) * (parseFloat(L) / 100));
            }
          }
          this.originPoint[O] = L;
        }), C && Lt.update(() => C(v, b), false, true), Hf(this.visualElement, "transform");
        const { animationState: R } = this.visualElement;
        R && R.setActive("whileDrag", true);
      }, h = (v, b) => {
        this.latestPointerEvent = v, this.latestPanInfo = b;
        const { dragPropagation: T, dragDirectionLock: A, onDirectionLock: C, onDrag: R } = this.getProps();
        if (!T && !this.openDragLock) return;
        const { offset: O } = b;
        if (A && this.currentDirection === null) {
          this.currentDirection = vD(O), this.currentDirection !== null && C && C(this.currentDirection);
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
      }, { dragSnapToOrigin: y } = this.getProps();
      this.panSession = new zx(i, {
        onSessionStart: d,
        onStart: f,
        onMove: h,
        onSessionEnd: m,
        resumeAnimation: p
      }, {
        transformPagePoint: this.visualElement.getTransformPagePoint(),
        dragSnapToOrigin: y,
        distanceThreshold: o,
        contextWindow: jx(this.visualElement),
        element: this.visualElement.current
      });
    }
    stop(i, l) {
      const o = i || this.latestPointerEvent, c = l || this.latestPanInfo, d = this.isDragging;
      if (this.cancel(), !d || !c || !o) return;
      const { velocity: f } = c;
      this.startAnimation(f);
      const { onDragEnd: h } = this.getProps();
      h && Lt.postRender(() => h(o, c));
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
      const { drag: c } = this.getProps();
      if (!o || !Yo(i, c, this.currentDirection)) return;
      const d = this.getAxisMotionValue(i);
      let f = this.originPoint[i] + o[i];
      this.constraints && this.constraints[i] && (f = cD(f, this.constraints[i], this.elastic[i])), d.set(f);
    }
    resolveConstraints() {
      var _a;
      const { dragConstraints: i, dragElastic: l } = this.getProps(), o = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : (_a = this.visualElement.projection) == null ? void 0 : _a.layout, c = this.constraints;
      i && Ba(i) ? this.constraints || (this.constraints = this.resolveRefConstraints()) : i && o ? this.constraints = uD(o.layoutBox, i) : this.constraints = false, this.elastic = mD(l), c !== this.constraints && !Ba(i) && o && this.constraints && !this.hasMutatedConstraints && pn((d) => {
        this.constraints !== false && this.getAxisMotionValue(d) && (this.constraints[d] = hD(o.layoutBox[d], this.constraints[d]));
      });
    }
    resolveRefConstraints() {
      const { dragConstraints: i, onMeasureDragConstraints: l } = this.getProps();
      if (!i || !Ba(i)) return false;
      const o = i.current, { projection: c } = this.visualElement;
      if (!c || !c.layout) return false;
      const d = xM(o, c.root, this.visualElement.getTransformPagePoint());
      let f = fD(c.layout.layoutBox, d);
      if (l) {
        const h = l(gM(f));
        this.hasMutatedConstraints = !!h, h && (f = ex(h));
      }
      return f;
    }
    startAnimation(i) {
      const { drag: l, dragMomentum: o, dragElastic: c, dragTransition: d, dragSnapToOrigin: f, onDragTransitionEnd: h } = this.getProps(), m = this.constraints || {}, p = pn((y) => {
        if (!Yo(y, l, this.currentDirection)) return;
        let v = m && m[y] || {};
        (f === true || f === y) && (v = {
          min: 0,
          max: 0
        });
        const b = c ? 200 : 1e6, T = c ? 40 : 1e7, A = {
          type: "inertia",
          velocity: o ? i[y] : 0,
          bounceStiffness: b,
          bounceDamping: T,
          timeConstant: 750,
          restDelta: 1,
          restSpeed: 10,
          ...d,
          ...v
        };
        return this.startAxisValueAnimation(y, A);
      });
      return Promise.all(p).then(h);
    }
    startAxisValueAnimation(i, l) {
      const o = this.getAxisMotionValue(i);
      return Hf(this.visualElement, i), o.start(_d(i, o, 0, l, this.visualElement, false));
    }
    stopAnimation() {
      pn((i) => this.getAxisMotionValue(i).stop());
    }
    getAxisMotionValue(i) {
      const l = `_drag${i.toUpperCase()}`, o = this.visualElement.getProps(), c = o[l];
      return c || this.visualElement.getValue(i, (o.initial ? o.initial[i] : void 0) || 0);
    }
    snapToCursor(i) {
      pn((l) => {
        const { drag: o } = this.getProps();
        if (!Yo(l, o, this.currentDirection)) return;
        const { projection: c } = this.visualElement, d = this.getAxisMotionValue(l);
        if (c && c.layout) {
          const { min: f, max: h } = c.layout.layoutBox[l], m = d.get() || 0;
          d.set(i[l] - Gt(f, h, 0.5) + m);
        }
      });
    }
    scalePositionWithinConstraints() {
      if (!this.visualElement.current) return;
      const { drag: i, dragConstraints: l } = this.getProps(), { projection: o } = this.visualElement;
      if (!Ba(l) || !o || !this.constraints) return;
      this.stopAnimation();
      const c = {
        x: 0,
        y: 0
      };
      pn((f) => {
        const h = this.getAxisMotionValue(f);
        if (h && this.constraints !== false) {
          const m = h.get();
          c[f] = dD({
            min: m,
            max: m
          }, this.constraints[f]);
        }
      });
      const { transformTemplate: d } = this.visualElement.getProps();
      this.visualElement.current.style.transform = d ? d({}, "") : "none", o.root && o.root.updateScroll(), o.updateLayout(), this.constraints = false, this.resolveConstraints(), pn((f) => {
        if (!Yo(f, i, null)) return;
        const h = this.getAxisMotionValue(f), { min: m, max: p } = this.constraints[f];
        h.set(Gt(m, p, c[f]));
      }), this.visualElement.render();
    }
    addListeners() {
      if (!this.visualElement.current) return;
      pD.set(this.visualElement, this);
      const i = this.visualElement.current, l = al(i, "pointerdown", (p) => {
        const { drag: y, dragListener: v = true } = this.getProps(), b = p.target, T = b !== i && $C(b);
        y && v && !T && this.start(p);
      });
      let o;
      const c = () => {
        const { dragConstraints: p } = this.getProps();
        Ba(p) && p.current && (this.constraints = this.resolveRefConstraints(), o || (o = gD(i, p.current, () => this.scalePositionWithinConstraints())));
      }, { projection: d } = this.visualElement, f = d.addEventListener("measure", c);
      d && !d.layout && (d.root && d.root.updateScroll(), d.updateLayout()), Lt.read(c);
      const h = ul(window, "resize", () => this.scalePositionWithinConstraints()), m = d.addEventListener("didUpdate", (({ delta: p, hasLayoutChanged: y }) => {
        this.isDragging && y && (pn((v) => {
          const b = this.getAxisMotionValue(v);
          b && (this.originPoint[v] += p[v].translate, b.set(b.get() + p[v].translate));
        }), this.visualElement.render());
      }));
      return () => {
        h(), l(), f(), m && m(), o && o();
      };
    }
    getProps() {
      const i = this.visualElement.getProps(), { drag: l = false, dragDirectionLock: o = false, dragPropagation: c = false, dragConstraints: d = false, dragElastic: f = Ff, dragMomentum: h = true } = i;
      return {
        ...i,
        drag: l,
        dragDirectionLock: o,
        dragPropagation: c,
        dragConstraints: d,
        dragElastic: f,
        dragMomentum: h
      };
    }
  }
  function Uv(n) {
    let i = true;
    return () => {
      if (i) {
        i = false;
        return;
      }
      n();
    };
  }
  function gD(n, i, l) {
    const o = Kg(n, Uv(l)), c = Kg(i, Uv(l));
    return () => {
      o(), c();
    };
  }
  function Yo(n, i, l) {
    return (i === true || i === n) && (l === null || l === n);
  }
  function vD(n, i = 10) {
    let l = null;
    return Math.abs(n.y) > i ? l = "y" : Math.abs(n.x) > i && (l = "x"), l;
  }
  class bD extends Ai {
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
  const mf = (n) => (i, l) => {
    n && Lt.update(() => n(i, l), false, true);
  };
  class xD extends Ai {
    constructor() {
      super(...arguments), this.removePointerDownListener = Fe;
    }
    onPointerDown(i) {
      this.session = new zx(i, this.createPanHandlers(), {
        transformPagePoint: this.node.getTransformPagePoint(),
        contextWindow: jx(this.node)
      });
    }
    createPanHandlers() {
      const { onPanSessionStart: i, onPanStart: l, onPan: o, onPanEnd: c } = this.node.getProps();
      return {
        onSessionStart: mf(i),
        onStart: mf(l),
        onMove: mf(o),
        onEnd: (d, f) => {
          delete this.session, c && Lt.postRender(() => c(d, f));
        }
      };
    }
    mount() {
      this.removePointerDownListener = al(this.node.current, "pointerdown", (i) => this.onPointerDown(i));
    }
    update() {
      this.session && this.session.updateHandlers(this.createPanHandlers());
    }
    unmount() {
      this.removePointerDownListener(), this.session && this.session.end();
    }
  }
  let pf = false;
  class SD extends w.Component {
    componentDidMount() {
      const { visualElement: i, layoutGroup: l, switchLayoutGroup: o, layoutId: c } = this.props, { projection: d } = i;
      d && (l.group && l.group.add(d), o && o.register && c && o.register(d), pf && d.root.didUpdate(), d.addEventListener("animationComplete", () => {
        this.safeToRemove();
      }), d.setOptions({
        ...d.options,
        layoutDependency: this.props.layoutDependency,
        onExitComplete: () => this.safeToRemove()
      })), $o.hasEverUpdated = true;
    }
    getSnapshotBeforeUpdate(i) {
      const { layoutDependency: l, visualElement: o, drag: c, isPresent: d } = this.props, { projection: f } = o;
      return f && (f.isPresent = d, i.layoutDependency !== l && f.setOptions({
        ...f.options,
        layoutDependency: l
      }), pf = true, c || i.layoutDependency !== l || l === void 0 || i.isPresent !== d ? f.willUpdate() : this.safeToRemove(), i.isPresent !== d && (d ? f.promote() : f.relegate() || Lt.postRender(() => {
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
      const { visualElement: i, layoutGroup: l, switchLayoutGroup: o } = this.props, { projection: c } = i;
      pf = true, c && (c.scheduleCheckAfterUnmount(), l && l.group && l.group.remove(c), o && o.deregister && o.deregister(c));
    }
    safeToRemove() {
      const { safeToRemove: i } = this.props;
      i && i();
    }
    render() {
      return null;
    }
  }
  function Vx(n) {
    const [i, l] = wx(), o = w.useContext(gd);
    return S.jsx(SD, {
      ...n,
      layoutGroup: o,
      switchLayoutGroup: w.useContext(Ox),
      isPresent: i,
      safeToRemove: l
    });
  }
  const TD = {
    pan: {
      Feature: xD
    },
    drag: {
      Feature: bD,
      ProjectionNode: Tx,
      MeasureLayout: Vx
    }
  };
  function Hv(n, i, l) {
    const { props: o } = n;
    n.animationState && o.whileHover && n.animationState.setActive("whileHover", l === "Start");
    const c = "onHover" + l, d = o[c];
    d && Lt.postRender(() => d(i, pl(i)));
  }
  class wD extends Ai {
    mount() {
      const { current: i } = this.node;
      i && (this.unmount = ZC(i, (l, o) => (Hv(this.node, o, "Start"), (c) => Hv(this.node, c, "End"))));
    }
    unmount() {
    }
  }
  class AD extends Ai {
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
      this.unmount = dl(ul(this.node.current, "focus", () => this.onFocus()), ul(this.node.current, "blur", () => this.onBlur()));
    }
    unmount() {
    }
  }
  function Gv(n, i, l) {
    const { props: o } = n;
    if (n.current instanceof HTMLButtonElement && n.current.disabled) return;
    n.animationState && o.whileTap && n.animationState.setActive("whileTap", l === "Start");
    const c = "onTap" + (l === "End" ? "" : l), d = o[c];
    d && Lt.postRender(() => d(i, pl(i)));
  }
  class ED extends Ai {
    mount() {
      const { current: i } = this.node;
      if (!i) return;
      const { globalTapTarget: l, propagate: o } = this.node.props;
      this.unmount = IC(i, (c, d) => (Gv(this.node, d, "Start"), (f, { success: h }) => Gv(this.node, f, h ? "End" : "Cancel")), {
        useGlobalTarget: l,
        stopPropagation: (o == null ? void 0 : o.tap) === false
      });
    }
    unmount() {
    }
  }
  const Jf = /* @__PURE__ */ new WeakMap(), yf = /* @__PURE__ */ new WeakMap(), CD = (n) => {
    const i = Jf.get(n.target);
    i && i(n);
  }, MD = (n) => {
    n.forEach(CD);
  };
  function RD({ root: n, ...i }) {
    const l = n || document;
    yf.has(l) || yf.set(l, {});
    const o = yf.get(l), c = JSON.stringify(i);
    return o[c] || (o[c] = new IntersectionObserver(MD, {
      root: n,
      ...i
    })), o[c];
  }
  function DD(n, i, l) {
    const o = RD(i);
    return Jf.set(n, l), o.observe(n), () => {
      Jf.delete(n), o.unobserve(n);
    };
  }
  const OD = {
    some: 0,
    all: 1
  };
  class ND extends Ai {
    constructor() {
      super(...arguments), this.hasEnteredView = false, this.isInView = false;
    }
    startObserver() {
      this.unmount();
      const { viewport: i = {} } = this.node.getProps(), { root: l, margin: o, amount: c = "some", once: d } = i, f = {
        root: l ? l.current : void 0,
        rootMargin: o,
        threshold: typeof c == "number" ? c : OD[c]
      }, h = (m) => {
        const { isIntersecting: p } = m;
        if (this.isInView === p || (this.isInView = p, d && !p && this.hasEnteredView)) return;
        p && (this.hasEnteredView = true), this.node.animationState && this.node.animationState.setActive("whileInView", p);
        const { onViewportEnter: y, onViewportLeave: v } = this.node.getProps(), b = p ? y : v;
        b && b(m);
      };
      return DD(this.node.current, f, h);
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
      ].some(jD(i, l)) && this.startObserver();
    }
    unmount() {
    }
  }
  function jD({ viewport: n = {} }, { viewport: i = {} } = {}) {
    return (l) => n[l] !== i[l];
  }
  const zD = {
    inView: {
      Feature: ND
    },
    tap: {
      Feature: ED
    },
    focus: {
      Feature: AD
    },
    hover: {
      Feature: wD
    }
  }, _D = {
    layout: {
      ProjectionNode: Tx,
      MeasureLayout: Vx
    }
  }, VD = {
    ...aD,
    ...zD,
    ...TD,
    ..._D
  }, rn = IR(VD, tD), kD = "modulepreload", LD = function(n) {
    return "/" + n;
  }, Yv = {}, BD = function(i, l, o) {
    let c = Promise.resolve();
    if (l && l.length > 0) {
      let f = function(p) {
        return Promise.all(p.map((y) => Promise.resolve(y).then((v) => ({
          status: "fulfilled",
          value: v
        }), (v) => ({
          status: "rejected",
          reason: v
        }))));
      };
      document.getElementsByTagName("link");
      const h = document.querySelector("meta[property=csp-nonce]"), m = (h == null ? void 0 : h.nonce) || (h == null ? void 0 : h.getAttribute("nonce"));
      c = f(l.map((p) => {
        if (p = LD(p), p in Yv) return;
        Yv[p] = true;
        const y = p.endsWith(".css"), v = y ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${p}"]${v}`)) return;
        const b = document.createElement("link");
        if (b.rel = y ? "stylesheet" : kD, y || (b.as = "script"), b.crossOrigin = "", b.href = p, m && b.setAttribute("nonce", m), document.head.appendChild(b), y) return new Promise((T, A) => {
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
    return c.then((f) => {
      for (const h of f || []) h.status === "rejected" && d(h.reason);
      return i().catch(d);
    });
  };
  function UD(n) {
    const i = w.useRef(null), l = w.useRef(false), o = w.useRef(null), [c, d] = w.useState({
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
      const k = N.history_labels().split("|").map(($, P) => {
        const E = $.indexOf(":");
        return {
          type: $.slice(0, E),
          label: $.slice(E + 1),
          index: P
        };
      });
      d({
        ready: true,
        hasSource: N.has_source(),
        sourcePos: o.current,
        undoCount: N.undo_count(),
        redoCount: N.redo_count(),
        history: k,
        zoom: N.get_zoom(),
        width: N.width(),
        height: N.height()
      });
    }, []), h = w.useCallback(() => {
      const N = i.current, k = n.current;
      if (!N || !k) return;
      (k.width !== N.width() || k.height !== N.height()) && (k.width = N.width(), k.height = N.height()), k.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(N.get_image_data()), N.width(), N.height()), 0, 0);
    }, [
      n
    ]), m = w.useCallback((N) => {
      const k = n.current;
      if (!k) return {
        x: 0,
        y: 0
      };
      const $ = k.getBoundingClientRect();
      return {
        x: Math.floor((N.clientX - $.left) * k.width / $.width),
        y: Math.floor((N.clientY - $.top) * k.height / $.height)
      };
    }, [
      n
    ]), p = w.useCallback(async (N) => {
      const { default: k, CloneStampTool: $ } = await BD(async () => {
        const { default: B, CloneStampTool: I } = await import("./stamp_tool-CrTC4tOM.js");
        return {
          default: B,
          CloneStampTool: I
        };
      }, []);
      await k();
      const P = URL.createObjectURL(N), E = new Image();
      E.onload = () => {
        const B = n.current;
        if (!B) return;
        B.width = E.width, B.height = E.height;
        const I = B.getContext("2d");
        I.drawImage(E, 0, 0);
        const et = I.getImageData(0, 0, E.width, E.height), it = new $(E.width, E.height);
        it.load_image(new Uint8Array(et.data)), i.current = it, o.current = null, URL.revokeObjectURL(P), f();
      }, E.src = P;
    }, [
      n,
      f
    ]), y = w.useCallback((N) => {
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
      ((_a = i.current) == null ? void 0 : _a.redo()) && (h(), f());
    }, [
      h,
      f
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
      const k = N.export_png(), $ = new Blob([
        new Uint8Array(k)
      ], {
        type: "image/png"
      }), P = URL.createObjectURL($), E = document.createElement("a");
      E.href = P, E.download = "stamp-result.png", E.click(), URL.revokeObjectURL(P);
    }, []), _ = w.useCallback((N, k = 0.92) => {
      if (N === "png") {
        z();
        return;
      }
      const $ = n.current;
      if (!$) return;
      const P = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif"
      }, E = {
        jpeg: ".jpg",
        webp: ".webp",
        avif: ".avif"
      };
      $.toBlob((B) => {
        if (!B) return;
        const I = URL.createObjectURL(B), et = document.createElement("a");
        et.href = I, et.download = `stamp-result${E[N]}`, et.click(), URL.revokeObjectURL(I);
      }, P[N], k);
    }, [
      n,
      z
    ]), K = w.useCallback((N) => {
      const k = i.current;
      if (!k) return;
      const { x: $, y: P } = m(N);
      if (N.altKey) {
        k.set_source($, P), o.current = {
          x: $,
          y: P
        }, f();
        return;
      }
      k.has_source() && (l.current = true, k.begin_stroke($, P), h());
    }, [
      m,
      h,
      f
    ]), J = w.useCallback((N) => {
      if (!l.current) return;
      const k = i.current;
      if (!k) return;
      const { x: $, y: P } = m(N);
      k.continue_stroke($, P), h();
    }, [
      m,
      h
    ]), Z = w.useCallback(() => {
      var _a;
      l.current && (l.current = false, (_a = i.current) == null ? void 0 : _a.end_stroke(), f());
    }, [
      f
    ]);
    w.useEffect(() => {
      const N = n.current, k = (N == null ? void 0 : N.parentElement) ?? N;
      if (!k) return;
      const $ = (P) => {
        !P.altKey || !i.current || (P.preventDefault(), i.current.adjust_zoom(P.deltaY < 0 ? 1 : -1), f());
      };
      return k.addEventListener("wheel", $, {
        passive: false
      }), () => k.removeEventListener("wheel", $);
    }, [
      n,
      f
    ]), w.useEffect(() => {
      const N = (k) => {
        (k.metaKey || k.ctrlKey) && k.key === "z" && (k.shiftKey ? C() : A());
      };
      return window.addEventListener("keydown", N), () => window.removeEventListener("keydown", N);
    }, [
      A,
      C
    ]);
    const Y = w.useCallback((N) => {
      const k = i.current;
      if (!k) return null;
      const $ = k.thumbnail_width(N), P = k.thumbnail_height(N), E = k.thumbnail_data(N);
      return {
        data: new Uint8ClampedArray(E),
        width: $,
        height: P
      };
    }, []), tt = w.useCallback((N) => new Promise((k) => {
      const $ = Y(N);
      if (!$) return k(null);
      const P = new OffscreenCanvas($.width, $.height);
      P.getContext("2d").putImageData(new ImageData($.data, $.width, $.height), 0, 0), P.convertToBlob({
        type: "image/jpeg",
        quality: 0.82
      }).then((B) => {
        k(URL.createObjectURL(B));
      });
    }), [
      Y
    ]), W = w.useCallback((N, k, $, P) => {
      const E = i.current;
      return E ? new Uint8ClampedArray(E.copy_region(N, k, $, P)) : null;
    }, []), nt = w.useCallback((N, k, $, P, E) => {
      const B = i.current;
      B && (B.paste_region(new Uint8Array(N.buffer), k, $, P, E), h(), f());
    }, [
      h,
      f
    ]), at = w.useCallback(() => {
      const N = i.current;
      N && (N.flip_horizontal(), o.current && (o.current = {
        x: N.width() - 1 - o.current.x,
        y: o.current.y
      }), h(), f());
    }, [
      h,
      f
    ]), pt = w.useCallback(() => {
      const N = i.current;
      N && (N.flip_vertical(), o.current && (o.current = {
        x: o.current.x,
        y: N.height() - 1 - o.current.y
      }), h(), f());
    }, [
      h,
      f
    ]), dt = w.useCallback(() => {
      const N = i.current;
      N && (N.rotate_90_cw(), o.current = null, h(), f());
    }, [
      h,
      f
    ]), ht = w.useCallback((N) => {
      const k = i.current;
      k && (k.adjust_brightness(N), h(), f());
    }, [
      h,
      f
    ]), V = w.useCallback((N) => {
      const k = i.current;
      k && (k.adjust_contrast(N), h(), f());
    }, [
      h,
      f
    ]);
    return {
      state: c,
      toolRef: i,
      loadImage: p,
      setBrushSize: y,
      setHardness: v,
      setOpacity: b,
      setSpacing: T,
      undo: A,
      redo: C,
      jumpToHistory: R,
      deleteHistoryEntry: O,
      clearHistory: L,
      exportPng: z,
      exportAs: _,
      onMouseDown: K,
      onMouseMove: J,
      onMouseUp: Z,
      generateThumbnail: Y,
      generateThumbnailUrl: tt,
      copyRegion: W,
      pasteRegion: nt,
      flipHorizontal: at,
      flipVertical: pt,
      rotate90Cw: dt,
      adjustBrightness: ht,
      adjustContrast: V
    };
  }
  function HD(n, i, l) {
    const [o, c] = w.useState({
      x: -999,
      y: -999
    }), [d, f] = w.useState(false), h = w.useRef(null);
    w.useEffect(() => {
      const T = (A) => {
        c({
          x: A.clientX,
          y: A.clientY
        });
      };
      return window.addEventListener("mousemove", T), () => window.removeEventListener("mousemove", T);
    }, []);
    const m = w.useCallback((T) => {
      h.current = T, f(true);
    }, []), p = w.useCallback(() => f(false), []);
    let y = n * 2;
    const v = l.current, b = h.current;
    if (v && b && v.width > 0) {
      const T = b.width / v.width;
      y = n * 2 * T;
    }
    return {
      pos: o,
      visible: d,
      diameter: y,
      onCanvasEnter: m,
      onCanvasLeave: p
    };
  }
  const ns = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
  }, Qd = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
  }, GD = {
    hidden: {
      x: "-100%",
      opacity: 0
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: ns
    },
    exit: {
      x: "-100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, YD = {
    hidden: {
      x: "100%",
      opacity: 0
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: ns
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
      transition: ns
    },
    exit: {
      y: "-100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, PD = {
    hidden: {
      y: "100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: ns
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, kx = {
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
  const Lx = (...n) => n.filter((i, l, o) => !!i && i.trim() !== "" && o.indexOf(i) === l).join(" ").trim();
  const XD = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const KD = (n) => n.replace(/^([A-Z])|[\s-_]+(\w)/g, (i, l, o) => o ? o.toUpperCase() : l.toLowerCase());
  const qv = (n) => {
    const i = KD(n);
    return i.charAt(0).toUpperCase() + i.slice(1);
  };
  var ZD = {
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
  const QD = (n) => {
    for (const i in n) if (i.startsWith("aria-") || i === "role" || i === "title") return true;
    return false;
  };
  const FD = w.forwardRef(({ color: n = "currentColor", size: i = 24, strokeWidth: l = 2, absoluteStrokeWidth: o, className: c = "", children: d, iconNode: f, ...h }, m) => w.createElement("svg", {
    ref: m,
    ...ZD,
    width: i,
    height: i,
    stroke: n,
    strokeWidth: o ? Number(l) * 24 / Number(i) : l,
    className: Lx("lucide", c),
    ...!d && !QD(h) && {
      "aria-hidden": "true"
    },
    ...h
  }, [
    ...f.map(([p, y]) => w.createElement(p, y)),
    ...Array.isArray(d) ? d : [
      d
    ]
  ]));
  const Ot = (n, i) => {
    const l = w.forwardRef(({ className: o, ...c }, d) => w.createElement(FD, {
      ref: d,
      iconNode: i,
      className: Lx(`lucide-${XD(qv(n))}`, `lucide-${n}`, o),
      ...c
    }));
    return l.displayName = qv(n), l;
  };
  const JD = [
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
  ], $D = Ot("arrow-up-right", JD);
  const WD = [
    [
      "path",
      {
        d: "m6 9 6 6 6-6",
        key: "qrunsl"
      }
    ]
  ], ID = Ot("chevron-down", WD);
  const t3 = [
    [
      "path",
      {
        d: "m15 18-6-6 6-6",
        key: "1wnfg3"
      }
    ]
  ], e3 = Ot("chevron-left", t3);
  const n3 = [
    [
      "path",
      {
        d: "m9 18 6-6-6-6",
        key: "mthhwq"
      }
    ]
  ], i3 = Ot("chevron-right", n3);
  const a3 = [
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
  ], s3 = Ot("contrast", a3);
  const l3 = [
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
  ], Bx = Ot("crop", l3);
  const o3 = [
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
  ], Ux = Ot("download", o3);
  const r3 = [
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
  ], c3 = Ot("droplets", r3);
  const u3 = [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
        key: "usdka0"
      }
    ]
  ], f3 = Ot("folder-open", u3);
  const d3 = [
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
  ], h3 = Ot("history", d3);
  const m3 = [
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
  ], Hx = Ot("image", m3);
  const p3 = [
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
  ], y3 = Ot("keyboard", p3);
  const g3 = [
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
  ], v3 = Ot("paintbrush", g3);
  const b3 = [
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
  ], x3 = Ot("redo", b3);
  const S3 = [
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
  ], T3 = Ot("rotate-ccw", S3);
  const w3 = [
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
  ], A3 = Ot("rotate-cw", w3);
  const E3 = [
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
  ], C3 = Ot("shapes", E3);
  const M3 = [
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
  ], R3 = Ot("shrink", M3);
  const D3 = [
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
  ], O3 = Ot("sparkles", D3);
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
  ], j3 = Ot("square-centerline-dashed-horizontal", N3);
  const z3 = [
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
  ], _3 = Ot("square-centerline-dashed-vertical", z3);
  const V3 = [
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
  ], k3 = Ot("stamp", V3);
  const L3 = [
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
  ], B3 = Ot("sun", L3);
  const U3 = [
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
  ], H3 = Ot("trash-2", U3);
  const G3 = [
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
  ], Y3 = Ot("type", G3);
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
  ], P3 = Ot("undo", q3);
  const X3 = [
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
  ], $f = Ot("upload", X3);
  const K3 = [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
        key: "1ngwbx"
      }
    ]
  ], Gx = Ot("wrench", K3);
  const Z3 = [
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
  ], Er = Ot("x", Z3);
  const Q3 = [
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
  ], F3 = Ot("zoom-in", Q3);
  const J3 = [
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
  ], $3 = Ot("zoom-out", J3), gf = {
    png: "PNG",
    jpeg: "JPEG",
    webp: "WebP",
    avif: "AVIF"
  };
  function W3({ zoom: n, onZoomIn: i, onZoomOut: l, showUpload: o, showTools: c, showGallery: d, showHistory: f, showKbdHints: h, onToggleUpload: m, onToggleTools: p, onToggleGallery: y, onToggleHistory: v, imageCount: b, exportFormat: T, onExportFormatChange: A, onExport: C, hasSelectedImage: R, onDeleteAll: O }) {
    const [L, z] = w.useState(false), _ = w.useRef(null);
    w.useEffect(() => {
      if (!L) return;
      const J = (Z) => {
        _.current && !_.current.contains(Z.target) && z(false);
      };
      return document.addEventListener("mousedown", J), () => document.removeEventListener("mousedown", J);
    }, [
      L
    ]);
    const K = [
      {
        key: "U",
        icon: $f,
        label: "Upload",
        state: o,
        toggle: m,
        shortcut: "Alt U"
      },
      {
        key: "S",
        icon: Gx,
        label: "Tools",
        state: c,
        toggle: p,
        shortcut: "Alt S"
      },
      {
        key: "I",
        icon: Hx,
        label: "Gallery",
        state: d,
        toggle: y,
        shortcut: "Alt G"
      },
      {
        key: "H",
        icon: h3,
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
          paddingLeft: c ? 320 : 12,
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
                    children: S.jsx($3, {
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
                    children: S.jsx(F3, {
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
                  children: K.map(({ key: J, icon: Z, label: Y, state: tt, toggle: W, shortcut: nt }) => S.jsxs("button", {
                    onClick: W,
                    className: `flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${tt ? "bg-accent text-text-primary shadow-md" : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"}`,
                    children: [
                      S.jsx(Z, {
                        className: "h-3.5 w-3.5"
                      }),
                      S.jsx("span", {
                        className: "hidden sm:inline",
                        children: Y
                      }),
                      h && S.jsx("kbd", {
                        className: "hidden sm:inline text-[9px] px-1 ml-0.5 opacity-70",
                        children: nt
                      })
                    ]
                  }, J))
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
                    ref: _,
                    children: [
                      S.jsxs("div", {
                        className: "relative",
                        children: [
                          S.jsxs("button", {
                            onClick: () => z((J) => !J),
                            className: "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold font-mono text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all",
                            children: [
                              gf[T],
                              S.jsx(ID, {
                                className: "h-3 w-3 opacity-50"
                              })
                            ]
                          }),
                          L && S.jsx("div", {
                            className: "absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[80px]",
                            children: Object.keys(gf).map((J) => S.jsx("button", {
                              onClick: () => {
                                A(J), z(false);
                              },
                              className: `w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${J === T ? "bg-accent text-text-primary" : "text-text-secondary hover:bg-bg-elevated"}`,
                              children: gf[J]
                            }, J))
                          })
                        ]
                      }),
                      S.jsxs("button", {
                        onClick: C,
                        disabled: !R,
                        className: "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono bg-accent text-text-primary shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                        children: [
                          S.jsx(Ux, {
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
                      S.jsx(H3, {
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
  function I3({ state: n, imageCount: i, showKbdHints: l }) {
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
  const tO = [
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
  function eO({ open: n, onClose: i }) {
    return S.jsx(Xa, {
      children: n && S.jsx(rn.div, {
        variants: kx,
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
          transition: ns,
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
                  children: S.jsx(Er, {
                    className: "shortcut-modal-close-icon"
                  })
                })
              ]
            }),
            S.jsx("div", {
              className: "shortcut-modal-body",
              children: tO.map((l) => S.jsxs("div", {
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
                          children: o.keys.map((c, d) => S.jsxs("span", {
                            children: [
                              d > 0 && S.jsx("span", {
                                className: "shortcut-plus",
                                children: "+"
                              }),
                              S.jsx("kbd", {
                                className: "shortcut-kbd",
                                children: c
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
  const nO = [
    {
      id: "compress",
      label: "Resize",
      description: "Resize & optimize images",
      icon: R3,
      gradient: "from-orange-500 to-red-500"
    },
    {
      id: "crop",
      label: "Crop",
      description: "Crop & trim images",
      icon: Bx,
      gradient: "from-cyan-500 to-blue-500"
    },
    {
      id: "brush",
      label: "Paint",
      description: "Freehand drawing",
      icon: v3,
      gradient: "from-blue-500 to-indigo-500"
    },
    {
      id: "text",
      label: "Text",
      description: "Add text annotations",
      icon: Y3,
      gradient: "from-amber-400 to-orange-500"
    },
    {
      id: "arrow",
      label: "Arrows",
      description: "Point & highlight areas",
      icon: $D,
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      id: "ai",
      label: "AI",
      description: "AI-powered tools",
      icon: O3,
      gradient: "from-violet-500 to-purple-600"
    },
    {
      id: "shapes",
      label: "Shapes",
      description: "Add geometric shapes",
      icon: C3,
      gradient: "from-pink-500 to-rose-500"
    },
    {
      id: "blur",
      label: "Blur",
      description: "Blur sensitive areas",
      icon: c3,
      gradient: "from-slate-400 to-slate-600"
    },
    {
      id: "stamp",
      label: "Clone Stamp",
      description: "WASM-powered clone stamp",
      icon: k3,
      gradient: "from-rose-500 to-red-600"
    }
  ];
  function iO({ tool: n, active: i, onClick: l }) {
    const o = n.icon;
    return S.jsx("button", {
      onClick: l,
      className: `relative p-0.5 rounded-xl transition-all ${i ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-secondary" : ""}`,
      children: S.jsx("span", {
        className: `flex h-12 w-full aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${n.gradient} shadow-lg transition-transform hover:scale-105 ${i ? "scale-105" : ""}`,
        children: S.jsx(o, {
          className: "h-6 w-6 text-white"
        })
      })
    });
  }
  function aO({ activeTool: n, onToolChange: i }) {
    return S.jsx("div", {
      className: "grid grid-cols-4 gap-2 justify-items-center",
      children: nO.map((l) => S.jsxs(BA, {
        children: [
          S.jsx(UA, {
            asChild: true,
            children: S.jsx("div", {
              children: S.jsx(iO, {
                tool: l,
                active: l.id === n,
                onClick: () => i(l.id)
              })
            })
          }),
          S.jsxs(J0, {
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
  const sO = [
    4,
    8,
    16,
    32
  ];
  function vf({ value: n, min: i, max: l, onChange: o, label: c, display: d }) {
    const f = (n - i) / (l - i) * 100;
    return S.jsxs("div", {
      className: "space-y-3",
      children: [
        c && S.jsx("h3", {
          className: "text-sm font-medium",
          style: {
            color: "var(--text-primary)"
          },
          children: c
        }),
        S.jsxs("div", {
          className: "relative h-5 w-full flex items-center",
          children: [
            S.jsx("div", {
              className: "absolute inset-x-0 h-2 rounded-full top-1/2 -translate-y-1/2",
              style: {
                background: "var(--bg-elevated)"
              },
              children: S.jsx("div", {
                className: "absolute h-full rounded-full pointer-events-none",
                style: {
                  width: `${f}%`,
                  background: "linear-gradient(to right, var(--accent), #8a7a6e)"
                }
              })
            }),
            S.jsx("input", {
              type: "range",
              min: i,
              max: l,
              value: n,
              onChange: (h) => o(Number(h.target.value)),
              className: "slider-overlay absolute inset-0 w-full cursor-pointer appearance-none"
            })
          ]
        }),
        S.jsx("div", {
          className: "text-xs",
          style: {
            color: "var(--text-muted)"
          },
          children: d
        })
      ]
    });
  }
  function lO({ settings: n, onChange: i, hasSource: l }) {
    return S.jsxs("div", {
      className: "space-y-6",
      children: [
        S.jsx("h3", {
          className: "text-sm font-medium",
          style: {
            color: "var(--text-primary)"
          },
          children: "Brush & Stamp"
        }),
        S.jsxs("div", {
          className: "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          style: {
            background: l ? "var(--accent-dim)" : "var(--bg-elevated)",
            color: l ? "var(--accent)" : "var(--text-muted)"
          },
          children: [
            S.jsx("span", {
              className: "w-2 h-2 rounded-full flex-shrink-0",
              style: {
                background: l ? "var(--accent)" : "var(--text-muted)",
                boxShadow: l ? "0 0 6px var(--accent-dim)" : "none"
              }
            }),
            l ? "Source set \u2014 click to paint" : "Alt+Click to set source"
          ]
        }),
        S.jsxs("div", {
          className: "space-y-3",
          children: [
            S.jsx("h3", {
              className: "text-sm font-medium",
              style: {
                color: "var(--text-primary)"
              },
              children: "Brush Size"
            }),
            S.jsx("div", {
              className: "flex items-center justify-between",
              children: sO.map((o) => {
                const c = n.brushSize === o;
                return S.jsx("button", {
                  onClick: () => i({
                    ...n,
                    brushSize: o
                  }),
                  className: "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  style: {
                    boxShadow: c ? "0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--accent)" : void 0,
                    background: c ? "transparent" : void 0
                  },
                  "aria-label": `Brush size ${o}`,
                  children: S.jsx("span", {
                    className: "rounded-full",
                    style: {
                      width: o / 2,
                      height: o / 2,
                      background: "var(--text-primary)"
                    }
                  })
                }, o);
              })
            }),
            S.jsx(vf, {
              value: n.brushSize,
              min: 2,
              max: 200,
              onChange: (o) => i({
                ...n,
                brushSize: o
              }),
              display: `${n.brushSize}px`
            })
          ]
        }),
        S.jsx(vf, {
          label: "Hardness",
          value: Math.round(n.hardness * 100),
          min: 0,
          max: 100,
          onChange: (o) => i({
            ...n,
            hardness: o / 100
          }),
          display: `${Math.round(n.hardness * 100)}%`
        }),
        S.jsx(vf, {
          label: "Opacity",
          value: Math.round(n.opacity * 100),
          min: 0,
          max: 100,
          onChange: (o) => i({
            ...n,
            opacity: o / 100
          }),
          display: `${Math.round(n.opacity * 100)}%`
        })
      ]
    });
  }
  var oO = Symbol.for("react.lazy"), fr = id[" use ".trim().toString()];
  function rO(n) {
    return typeof n == "object" && n !== null && "then" in n;
  }
  function Yx(n) {
    return n != null && typeof n == "object" && "$$typeof" in n && n.$$typeof === oO && "_payload" in n && rO(n._payload);
  }
  function cO(n) {
    const i = fO(n), l = w.forwardRef((o, c) => {
      let { children: d, ...f } = o;
      Yx(d) && typeof fr == "function" && (d = fr(d._payload));
      const h = w.Children.toArray(d), m = h.find(hO);
      if (m) {
        const p = m.props.children, y = h.map((v) => v === m ? w.Children.count(p) > 1 ? w.Children.only(null) : w.isValidElement(p) ? p.props.children : null : v);
        return S.jsx(i, {
          ...f,
          ref: c,
          children: w.isValidElement(p) ? w.cloneElement(p, void 0, y) : null
        });
      }
      return S.jsx(i, {
        ...f,
        ref: c,
        children: d
      });
    });
    return l.displayName = `${n}.Slot`, l;
  }
  var uO = cO("Slot");
  function fO(n) {
    const i = w.forwardRef((l, o) => {
      let { children: c, ...d } = l;
      if (Yx(c) && typeof fr == "function" && (c = fr(c._payload)), w.isValidElement(c)) {
        const f = pO(c), h = mO(d, c.props);
        return c.type !== w.Fragment && (h.ref = o ? ad(o, f) : f), w.cloneElement(c, h);
      }
      return w.Children.count(c) > 1 ? w.Children.only(null) : null;
    });
    return i.displayName = `${n}.SlotClone`, i;
  }
  var dO = Symbol("radix.slottable");
  function hO(n) {
    return w.isValidElement(n) && typeof n.type == "function" && "__radixId" in n.type && n.type.__radixId === dO;
  }
  function mO(n, i) {
    const l = {
      ...i
    };
    for (const o in i) {
      const c = n[o], d = i[o];
      /^on[A-Z]/.test(o) ? c && d ? l[o] = (...h) => {
        const m = d(...h);
        return c(...h), m;
      } : c && (l[o] = c) : o === "style" ? l[o] = {
        ...c,
        ...d
      } : o === "className" && (l[o] = [
        c,
        d
      ].filter(Boolean).join(" "));
    }
    return {
      ...n,
      ...l
    };
  }
  function pO(n) {
    var _a, _b2;
    let i = (_a = Object.getOwnPropertyDescriptor(n.props, "ref")) == null ? void 0 : _a.get, l = i && "isReactWarning" in i && i.isReactWarning;
    return l ? n.ref : (i = (_b2 = Object.getOwnPropertyDescriptor(n, "ref")) == null ? void 0 : _b2.get, l = i && "isReactWarning" in i && i.isReactWarning, l ? n.props.ref : n.props.ref || n.ref);
  }
  const Pv = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Xv = V0, yO = (n, i) => (l) => {
    var o;
    if ((i == null ? void 0 : i.variants) == null) return Xv(n, l == null ? void 0 : l.class, l == null ? void 0 : l.className);
    const { variants: c, defaultVariants: d } = i, f = Object.keys(c).map((p) => {
      const y = l == null ? void 0 : l[p], v = d == null ? void 0 : d[p];
      if (y === null) return null;
      const b = Pv(y) || Pv(v);
      return c[p][b];
    }), h = l && Object.entries(l).reduce((p, y) => {
      let [v, b] = y;
      return b === void 0 || (p[v] = b), p;
    }, {}), m = i == null || (o = i.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((p, y) => {
      let { class: v, className: b, ...T } = y;
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
    return Xv(n, f, m, l == null ? void 0 : l.class, l == null ? void 0 : l.className);
  }, gO = yO("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
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
  }), Ua = w.forwardRef(({ className: n, variant: i, size: l, asChild: o = false, ...c }, d) => {
    const f = o ? uO : "button";
    return S.jsx(f, {
      className: yd(gO({
        variant: i,
        size: l,
        className: n
      })),
      ref: d,
      ...c
    });
  });
  Ua.displayName = "Button";
  function qx(n, [i, l]) {
    return Math.min(l, Math.max(i, n));
  }
  var vO = w.createContext(void 0);
  function bO(n) {
    const i = w.useContext(vO);
    return n || i || "ltr";
  }
  function xO(n) {
    const i = w.useRef({
      value: n,
      previous: n
    });
    return w.useMemo(() => (i.current.value !== n && (i.current.previous = i.current.value, i.current.value = n), i.current.previous), [
      n
    ]);
  }
  function SO(n) {
    const i = n + "CollectionProvider", [l, o] = dr(i), [c, d] = l(i, {
      collectionRef: {
        current: null
      },
      itemMap: /* @__PURE__ */ new Map()
    }), f = (C) => {
      const { scope: R, children: O } = C, L = yn.useRef(null), z = yn.useRef(/* @__PURE__ */ new Map()).current;
      return S.jsx(c, {
        scope: R,
        itemMap: z,
        collectionRef: L,
        children: O
      });
    };
    f.displayName = i;
    const h = n + "CollectionSlot", m = bf(h), p = yn.forwardRef((C, R) => {
      const { scope: O, children: L } = C, z = d(h, O), _ = ye(R, z.collectionRef);
      return S.jsx(m, {
        ref: _,
        children: L
      });
    });
    p.displayName = h;
    const y = n + "CollectionItemSlot", v = "data-radix-collection-item", b = bf(y), T = yn.forwardRef((C, R) => {
      const { scope: O, children: L, ...z } = C, _ = yn.useRef(null), K = ye(R, _), J = d(y, O);
      return yn.useEffect(() => (J.itemMap.set(_, {
        ref: _,
        ...z
      }), () => void J.itemMap.delete(_))), S.jsx(b, {
        [v]: "",
        ref: K,
        children: L
      });
    });
    T.displayName = y;
    function A(C) {
      const R = d(n + "CollectionConsumer", C);
      return yn.useCallback(() => {
        const L = R.collectionRef.current;
        if (!L) return [];
        const z = Array.from(L.querySelectorAll(`[${v}]`));
        return Array.from(R.itemMap.values()).sort((J, Z) => z.indexOf(J.ref.current) - z.indexOf(Z.ref.current));
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
  var Px = [
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
  }, is = "Slider", [Wf, TO, wO] = SO(is), [Zx] = dr(is, [
    wO
  ]), [AO, Cr] = Zx(is), Qx = w.forwardRef((n, i) => {
    const { name: l, min: o = 0, max: c = 100, step: d = 1, orientation: f = "horizontal", disabled: h = false, minStepsBetweenThumbs: m = 0, defaultValue: p = [
      o
    ], value: y, onValueChange: v = () => {
    }, onValueCommit: b = () => {
    }, inverted: T = false, form: A, ...C } = n, R = w.useRef(/* @__PURE__ */ new Set()), O = w.useRef(0), z = f === "horizontal" ? EO : CO, [_ = [], K] = A0({
      prop: y,
      defaultProp: p,
      onChange: (nt) => {
        var _a;
        (_a = [
          ...R.current
        ][O.current]) == null ? void 0 : _a.focus(), v(nt);
      }
    }), J = w.useRef(_);
    function Z(nt) {
      const at = NO(_, nt);
      W(nt, at);
    }
    function Y(nt) {
      W(nt, O.current);
    }
    function tt() {
      const nt = J.current[O.current];
      _[O.current] !== nt && b(_);
    }
    function W(nt, at, { commit: pt } = {
      commit: false
    }) {
      const dt = VO(d), ht = kO(Math.round((nt - o) / d) * d + o, dt), V = qx(ht, [
        o,
        c
      ]);
      K((N = []) => {
        const k = DO(N, V, at);
        if (_O(k, m * d)) {
          O.current = k.indexOf(V);
          const $ = String(k) !== String(N);
          return $ && pt && b(k), $ ? k : N;
        } else return N;
      });
    }
    return S.jsx(AO, {
      scope: n.__scopeSlider,
      name: l,
      disabled: h,
      min: o,
      max: c,
      valueIndexToChangeRef: O,
      thumbs: R.current,
      values: _,
      orientation: f,
      form: A,
      children: S.jsx(Wf.Provider, {
        scope: n.__scopeSlider,
        children: S.jsx(Wf.Slot, {
          scope: n.__scopeSlider,
          children: S.jsx(z, {
            "aria-disabled": h,
            "data-disabled": h ? "" : void 0,
            ...C,
            ref: i,
            onPointerDown: he(C.onPointerDown, () => {
              h || (J.current = _);
            }),
            min: o,
            max: c,
            inverted: T,
            onSlideStart: h ? void 0 : Z,
            onSlideMove: h ? void 0 : Y,
            onSlideEnd: h ? void 0 : tt,
            onHomeKeyDown: () => !h && W(o, 0, {
              commit: true
            }),
            onEndKeyDown: () => !h && W(c, _.length - 1, {
              commit: true
            }),
            onStepKeyDown: ({ event: nt, direction: at }) => {
              if (!h) {
                const ht = Px.includes(nt.key) || nt.shiftKey && Xx.includes(nt.key) ? 10 : 1, V = O.current, N = _[V], k = d * ht * at;
                W(N + k, V, {
                  commit: true
                });
              }
            }
          })
        })
      })
    });
  });
  Qx.displayName = is;
  var [Fx, Jx] = Zx(is, {
    startEdge: "left",
    endEdge: "right",
    size: "width",
    direction: 1
  }), EO = w.forwardRef((n, i) => {
    const { min: l, max: o, dir: c, inverted: d, onSlideStart: f, onSlideMove: h, onSlideEnd: m, onStepKeyDown: p, ...y } = n, [v, b] = w.useState(null), T = ye(i, (z) => b(z)), A = w.useRef(void 0), C = bO(c), R = C === "ltr", O = R && !d || !R && d;
    function L(z) {
      const _ = A.current || v.getBoundingClientRect(), K = [
        0,
        _.width
      ], Z = Fd(K, O ? [
        l,
        o
      ] : [
        o,
        l
      ]);
      return A.current = _, Z(z - _.left);
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
        ...y,
        ref: T,
        style: {
          ...y.style,
          "--radix-slider-thumb-transform": "translateX(-50%)"
        },
        onSlideStart: (z) => {
          const _ = L(z.clientX);
          f == null ? void 0 : f(_);
        },
        onSlideMove: (z) => {
          const _ = L(z.clientX);
          h == null ? void 0 : h(_);
        },
        onSlideEnd: () => {
          A.current = void 0, m == null ? void 0 : m();
        },
        onStepKeyDown: (z) => {
          const K = Kx[O ? "from-left" : "from-right"].includes(z.key);
          p == null ? void 0 : p({
            event: z,
            direction: K ? -1 : 1
          });
        }
      })
    });
  }), CO = w.forwardRef((n, i) => {
    const { min: l, max: o, inverted: c, onSlideStart: d, onSlideMove: f, onSlideEnd: h, onStepKeyDown: m, ...p } = n, y = w.useRef(null), v = ye(i, y), b = w.useRef(void 0), T = !c;
    function A(C) {
      const R = b.current || y.current.getBoundingClientRect(), O = [
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
    const { __scopeSlider: l, onSlideStart: o, onSlideMove: c, onSlideEnd: d, onHomeKeyDown: f, onEndKeyDown: h, onStepKeyDown: m, ...p } = n, y = Cr(is, l);
    return S.jsx(Je.span, {
      ...p,
      ref: i,
      onKeyDown: he(n.onKeyDown, (v) => {
        v.key === "Home" ? (f(v), v.preventDefault()) : v.key === "End" ? (h(v), v.preventDefault()) : Px.concat(Xx).includes(v.key) && (m(v), v.preventDefault());
      }),
      onPointerDown: he(n.onPointerDown, (v) => {
        const b = v.target;
        b.setPointerCapture(v.pointerId), v.preventDefault(), y.thumbs.has(b) ? b.focus() : o(v);
      }),
      onPointerMove: he(n.onPointerMove, (v) => {
        v.target.hasPointerCapture(v.pointerId) && c(v);
      }),
      onPointerUp: he(n.onPointerUp, (v) => {
        const b = v.target;
        b.hasPointerCapture(v.pointerId) && (b.releasePointerCapture(v.pointerId), d(v));
      })
    });
  }), Wx = "SliderTrack", Ix = w.forwardRef((n, i) => {
    const { __scopeSlider: l, ...o } = n, c = Cr(Wx, l);
    return S.jsx(Je.span, {
      "data-disabled": c.disabled ? "" : void 0,
      "data-orientation": c.orientation,
      ...o,
      ref: i
    });
  });
  Ix.displayName = Wx;
  var If = "SliderRange", t1 = w.forwardRef((n, i) => {
    const { __scopeSlider: l, ...o } = n, c = Cr(If, l), d = Jx(If, l), f = w.useRef(null), h = ye(i, f), m = c.values.length, p = c.values.map((b) => i1(b, c.min, c.max)), y = m > 1 ? Math.min(...p) : 0, v = 100 - Math.max(...p);
    return S.jsx(Je.span, {
      "data-orientation": c.orientation,
      "data-disabled": c.disabled ? "" : void 0,
      ...o,
      ref: h,
      style: {
        ...n.style,
        [d.startEdge]: y + "%",
        [d.endEdge]: v + "%"
      }
    });
  });
  t1.displayName = If;
  var td = "SliderThumb", e1 = w.forwardRef((n, i) => {
    const l = TO(n.__scopeSlider), [o, c] = w.useState(null), d = ye(i, (h) => c(h)), f = w.useMemo(() => o ? l().findIndex((h) => h.ref.current === o) : -1, [
      l,
      o
    ]);
    return S.jsx(MO, {
      ...n,
      ref: d,
      index: f
    });
  }), MO = w.forwardRef((n, i) => {
    const { __scopeSlider: l, index: o, name: c, ...d } = n, f = Cr(td, l), h = Jx(td, l), [m, p] = w.useState(null), y = ye(i, (L) => p(L)), v = m ? f.form || !!m.closest("form") : true, b = d0(m), T = f.values[o], A = T === void 0 ? 0 : i1(T, f.min, f.max), C = OO(o, f.values.length), R = b == null ? void 0 : b[h.size], O = R ? jO(R, A, h.direction) : 0;
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
        S.jsx(Wf.ItemSlot, {
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
            ref: y,
            style: T === void 0 ? {
              display: "none"
            } : n.style,
            onFocus: he(n.onFocus, () => {
              f.valueIndexToChangeRef.current = o;
            })
          })
        }),
        v && S.jsx(n1, {
          name: c ?? (f.name ? f.name + (f.values.length > 1 ? "[]" : "") : void 0),
          form: f.form,
          value: T
        }, o)
      ]
    });
  });
  e1.displayName = td;
  var RO = "RadioBubbleInput", n1 = w.forwardRef(({ __scopeSlider: n, value: i, ...l }, o) => {
    const c = w.useRef(null), d = ye(c, o), f = xO(i);
    return w.useEffect(() => {
      const h = c.current;
      if (!h) return;
      const m = window.HTMLInputElement.prototype, y = Object.getOwnPropertyDescriptor(m, "value").set;
      if (f !== i && y) {
        const v = new Event("input", {
          bubbles: true
        });
        y.call(h, i), h.dispatchEvent(v);
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
  n1.displayName = RO;
  function DO(n = [], i, l) {
    const o = [
      ...n
    ];
    return o[l] = i, o.sort((c, d) => c - d);
  }
  function i1(n, i, l) {
    const d = 100 / (l - i) * (n - i);
    return qx(d, [
      0,
      100
    ]);
  }
  function OO(n, i) {
    return i > 2 ? `Value ${n + 1} of ${i}` : i === 2 ? [
      "Minimum",
      "Maximum"
    ][n] : void 0;
  }
  function NO(n, i) {
    if (n.length === 1) return 0;
    const l = n.map((c) => Math.abs(c - i)), o = Math.min(...l);
    return l.indexOf(o);
  }
  function jO(n, i, l) {
    const o = n / 2, d = Fd([
      0,
      50
    ], [
      0,
      o
    ]);
    return (o - d(i) * l) * l;
  }
  function zO(n) {
    return n.slice(0, -1).map((i, l) => n[l + 1] - i);
  }
  function _O(n, i) {
    if (i > 0) {
      const l = zO(n);
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
  function VO(n) {
    return (String(n).split(".")[1] || "").length;
  }
  function kO(n, i) {
    const l = Math.pow(10, i);
    return Math.round(n * l) / l;
  }
  var a1 = Qx, LO = Ix, BO = t1, UO = e1;
  const ed = w.forwardRef(({ className: n, ...i }, l) => S.jsxs(a1, {
    ref: l,
    className: yd("relative flex w-full touch-none select-none items-center", n),
    ...i,
    children: [
      S.jsx(LO, {
        className: "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary",
        children: S.jsx(BO, {
          className: "absolute h-full bg-primary"
        })
      }),
      S.jsx(UO, {
        className: "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      })
    ]
  }));
  ed.displayName = a1.displayName;
  function Kv({ disabled: n, onFlipH: i, onFlipV: l, onRotate90Cw: o, onBrightness: c, onContrast: d, onApplyCrop: f }) {
    const [h, m] = w.useState(0), [p, y] = w.useState(100);
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
                    S.jsx(j3, {
                      className: "h-4 w-4"
                    }),
                    "Flip H"
                  ]
                }),
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: l,
                  children: [
                    S.jsx(_3, {
                      className: "h-4 w-4"
                    }),
                    "Flip V"
                  ]
                }),
                S.jsxs(Ua, {
                  variant: "secondary",
                  size: "sm",
                  className: "gap-2",
                  disabled: n,
                  onClick: o,
                  children: [
                    S.jsx(A3, {
                      className: "h-4 w-4"
                    }),
                    "Rotate 90\xB0"
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
                    S.jsx(T3, {
                      className: "h-4 w-4"
                    }),
                    "Rotate \u221290\xB0"
                  ]
                })
              ]
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2",
          children: [
            S.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                S.jsx(B3, {
                  className: "h-3.5 w-3.5 text-theme-muted-foreground"
                }),
                S.jsx("span", {
                  className: "text-xs font-medium text-theme-foreground flex-1",
                  children: "Brightness"
                }),
                S.jsx("span", {
                  className: "text-xs font-mono text-theme-muted-foreground min-w-[3.5ch] text-right tabular-nums",
                  children: h > 0 ? `+${h}` : h
                })
              ]
            }),
            S.jsx(ed, {
              value: [
                h
              ],
              onValueChange: ([v]) => m(v),
              onValueCommit: ([v]) => {
                v !== 0 && (c(v / 100), m(0));
              },
              min: -100,
              max: 100,
              step: 1,
              disabled: n
            })
          ]
        }),
        S.jsxs("div", {
          className: "space-y-2",
          children: [
            S.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                S.jsx(s3, {
                  className: "h-3.5 w-3.5 text-theme-muted-foreground"
                }),
                S.jsx("span", {
                  className: "text-xs font-medium text-theme-foreground flex-1",
                  children: "Contrast"
                }),
                S.jsxs("span", {
                  className: "text-xs font-mono text-theme-muted-foreground min-w-[3.5ch] text-right tabular-nums",
                  children: [
                    p,
                    "%"
                  ]
                })
              ]
            }),
            S.jsx(ed, {
              value: [
                p
              ],
              onValueChange: ([v]) => y(v),
              onValueCommit: ([v]) => {
                v !== 100 && (d(v / 100), y(100));
              },
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
                S.jsx(Bx, {
                  className: "h-4 w-4"
                }),
                "Apply Crop"
              ]
            })
          ]
        })
      ]
    });
  }
  function HO({ onClose: n, activeTool: i, onToolChange: l, stampSettings: o, onStampSettingsChange: c, hasSource: d, onUndo: f, onRedo: h, canUndo: m, canRedo: p, onExport: y, canExport: v, onFlipH: b, onFlipV: T, onRotate90Cw: A, onBrightness: C, onContrast: R, imageReady: O, onApplyCrop: L }) {
    return S.jsxs(rn.div, {
      variants: GD,
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
                S.jsx(Gx, {
                  className: "h-4 w-4 text-accent"
                }),
                "Tools"
              ]
            }),
            S.jsx("button", {
              onClick: n,
              className: "p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary",
              "aria-label": "Close tools",
              children: S.jsx(Er, {
                className: "h-4 w-4"
              })
            })
          ]
        }),
        S.jsx("div", {
          className: "p-4 border-b border-border",
          children: S.jsx(aO, {
            activeTool: i,
            onToolChange: l
          })
        }),
        S.jsxs("div", {
          className: "flex-1 overflow-y-auto p-4 space-y-4",
          children: [
            i === "stamp" && S.jsx(lO, {
              settings: o,
              onChange: c,
              hasSource: d
            }),
            i === "transform" && S.jsx(Kv, {
              disabled: !O,
              onFlipH: b,
              onFlipV: T,
              onRotate90Cw: A,
              onBrightness: C,
              onContrast: R
            }),
            i === "crop" && S.jsx(Kv, {
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
            onClick: y,
            disabled: !v,
            className: `
            w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
            text-sm font-semibold
            bg-accent text-text-primary
            hover:brightness-110 transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
          `,
            children: [
              S.jsx(Ux, {
                className: "h-4 w-4"
              }),
              "Export PNG"
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
                S.jsx(P3, {
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
                S.jsx(x3, {
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
  const GO = yn.forwardRef(({ hookResult: n, brushDiameter: i, cursorPos: l, cursorVisible: o, onCanvasEnter: c, onCanvasLeave: d }, f) => {
    const { onMouseDown: h, onMouseMove: m, onMouseUp: p, state: y } = n, v = f;
    let b = null;
    if (y.sourcePos && v.current) {
      const A = v.current, C = A.getBoundingClientRect(), R = C.width / A.width, O = C.height / A.height;
      b = {
        left: C.left + y.sourcePos.x * R,
        top: C.top + y.sourcePos.y * O
      };
    }
    const T = y.zoom;
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
            c(A.currentTarget.getBoundingClientRect());
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
        !y.ready && S.jsxs("div", {
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
  function YO({ history: n, onJump: i, onDelete: l, onClear: o, onClose: c }) {
    return S.jsxs(rn.aside, {
      variants: YD,
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
              onClick: c,
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
  function qO({ photos: n, activeId: i, onSelect: l, onRemove: o, onClose: c, showTools: d, showHistory: f }) {
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
      variants: PD,
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
                    S.jsx(Hx, {
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
                  onClick: c,
                  className: "p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors",
                  children: S.jsx(Er, {
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
                  children: S.jsx(e3, {
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
                  children: S.jsx(i3, {
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
  function PO({ open: n, onClose: i, onFiles: l }) {
    const o = w.useRef(null), [c, d] = w.useState(false), f = (m) => {
      m.preventDefault(), d(false);
      const p = Array.from(m.dataTransfer.files).filter((y) => y.type.startsWith("image/"));
      p.length && (l(p), i());
    }, h = (m) => {
      const p = Array.from(m.target.files ?? []).filter((y) => y.type.startsWith("image/"));
      p.length && (l(p), i()), m.target.value = "";
    };
    return S.jsx(Xa, {
      children: n && S.jsx(rn.div, {
        variants: kx,
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
          transition: ns,
          className: "relative w-full max-w-lg mx-4 bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden",
          onClick: (m) => m.stopPropagation(),
          children: [
            S.jsxs("div", {
              className: "flex items-center justify-between px-6 pt-5 pb-3",
              children: [
                S.jsxs("h2", {
                  className: "flex items-center gap-2 text-base font-semibold text-text-primary font-mono",
                  children: [
                    S.jsx($f, {
                      className: "h-5 w-5 text-accent"
                    }),
                    "Open Images"
                  ]
                }),
                S.jsx("button", {
                  onClick: i,
                  className: "p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors",
                  children: S.jsx(Er, {
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
                  ${c ? "border-accent bg-accent-dim" : "border-border bg-bg-tertiary"}
                `,
                children: [
                  S.jsxs("div", {
                    className: "flex flex-col items-center gap-4",
                    children: [
                      S.jsx("div", {
                        className: "w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center",
                        children: S.jsx($f, {
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
                          S.jsx(f3, {
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
  function XO({ onUndo: n, onRedo: i, onExport: l, onDeleteAll: o, onBrushSizeChange: c, setBrushSizeOnTool: d, setShowUpload: f, setShowTools: h, setShowGallery: m, setShowHistory: p, setShowKbdHints: y }) {
    w.useEffect(() => {
      const v = (b) => {
        if (!(b.target instanceof HTMLInputElement || b.target instanceof HTMLTextAreaElement)) {
          if ((b.metaKey || b.ctrlKey) && b.key === "z") {
            b.preventDefault(), b.shiftKey ? i() : n();
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
              b.preventDefault(), y((T) => !T);
              break;
            case "BracketLeft":
              b.preventDefault(), c((T) => {
                const A = Math.max(2, T.brushSize - 5);
                return d(A), {
                  ...T,
                  brushSize: A
                };
              });
              break;
            case "BracketRight":
              b.preventDefault(), c((T) => {
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
      c,
      d,
      f,
      h,
      m,
      p,
      y
    ]);
  }
  function KO() {
    const n = w.useRef(null), i = UD(n), [l, o] = w.useState({
      brushSize: 20,
      hardness: 0.8,
      opacity: 1
    }), c = w.useCallback((B) => {
      o(B), i.setBrushSize(B.brushSize), i.setHardness(B.hardness), i.setOpacity(B.opacity);
    }, [
      i
    ]), [d, f] = w.useState([]), [h, m] = w.useState(null), p = w.useCallback((B) => {
      const I = B.map((it) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(it),
        name: it.name.replace(/\.[^.]+$/, ""),
        file: it
      }));
      f((it) => [
        ...it,
        ...I
      ]);
      const et = I[0];
      et && (i.loadImage(et.file), m(et.id));
    }, [
      i
    ]), y = w.useCallback((B) => {
      i.loadImage(B.file), m(B.id);
    }, [
      i
    ]), v = w.useCallback((B) => {
      f((I) => {
        const et = I.findIndex((yt) => yt.id === B), it = I.filter((yt) => yt.id !== B), ut = I[et];
        if (ut && URL.revokeObjectURL(ut.url), B === h && it.length > 0) {
          const yt = it[Math.min(et, it.length - 1)];
          i.loadImage(yt.file), m(yt.id);
        } else it.length === 0 && m(null);
        return it;
      });
    }, [
      h,
      i
    ]), { pos: b, visible: T, diameter: A, onCanvasEnter: C, onCanvasLeave: R } = HD(l.brushSize, i.state.zoom, n), [O, L] = w.useState(true), [z, _] = w.useState(false), [K, J] = w.useState(false), [Z, Y] = w.useState(false), [tt, W] = w.useState(false), [nt, at] = w.useState(false), [pt, dt] = w.useState("stamp"), [ht, V] = w.useState("png"), N = w.useRef(0);
    w.useEffect(() => {
      const B = N.current, I = d.length;
      if (B === 0 && I > 0) {
        L(false);
        const et = setTimeout(() => _(true), 150), it = setTimeout(() => J(true), 500), ut = setTimeout(() => Y(true), 850);
        return N.current = I, () => {
          clearTimeout(et), clearTimeout(it), clearTimeout(ut);
        };
      }
      I === 0 && (L(true), _(false), J(false), Y(false), W(false)), N.current = I;
    }, [
      d.length
    ]);
    const k = w.useCallback(() => {
      i.exportAs(ht);
    }, [
      i,
      ht
    ]), $ = w.useCallback(() => {
      d.forEach((B) => URL.revokeObjectURL(B.url)), f([]), m(null);
    }, [
      d
    ]);
    XO({
      onUndo: i.undo,
      onRedo: i.redo,
      onExport: k,
      onDeleteAll: $,
      onBrushSizeChange: o,
      setBrushSizeOnTool: i.setBrushSize,
      setShowUpload: L,
      setShowTools: J,
      setShowGallery: Y,
      setShowHistory: W,
      setShowKbdHints: at
    });
    const P = w.useCallback(() => {
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
        S.jsx(PO, {
          open: O,
          onClose: () => L(false),
          onFiles: p
        }),
        S.jsx(Xa, {
          children: z && S.jsx(W3, {
            zoom: i.state.zoom,
            onZoomIn: P,
            onZoomOut: E,
            showUpload: O,
            showTools: K,
            showGallery: Z,
            showHistory: tt,
            showKbdHints: nt,
            onToggleUpload: () => L((B) => !B),
            onToggleTools: () => J((B) => !B),
            onToggleGallery: () => Y((B) => !B),
            onToggleHistory: () => W((B) => !B),
            imageCount: d.length,
            exportFormat: ht,
            onExportFormatChange: V,
            onExport: k,
            hasSelectedImage: i.state.ready,
            onDeleteAll: $
          })
        }),
        S.jsx(Xa, {
          children: K && S.jsx(HO, {
            onClose: () => J(false),
            activeTool: pt,
            onToolChange: dt,
            stampSettings: l,
            onStampSettingsChange: c,
            hasSource: i.state.hasSource,
            imageReady: i.state.ready,
            onFlipH: i.flipHorizontal,
            onFlipV: i.flipVertical,
            onRotate90Cw: i.rotate90Cw,
            onBrightness: i.adjustBrightness,
            onContrast: i.adjustContrast,
            onUndo: i.undo,
            onRedo: i.redo,
            canUndo: i.state.undoCount > 0,
            canRedo: i.state.redoCount > 0,
            onExport: k,
            canExport: i.state.ready
          })
        }),
        S.jsx(rn.main, {
          animate: {
            marginLeft: K ? 320 : 0,
            marginRight: tt ? 244 : 0
          },
          transition: Qd,
          className: "main-content",
          children: S.jsx(GO, {
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
          children: tt && S.jsx(YO, {
            history: i.state.history,
            onJump: i.jumpToHistory,
            onDelete: i.deleteHistoryEntry,
            onClear: i.clearHistory,
            onClose: () => W(false)
          })
        }),
        S.jsx(Xa, {
          children: Z && S.jsx(qO, {
            photos: d,
            activeId: h,
            onSelect: y,
            onRemove: v,
            onClose: () => Y(false),
            showTools: K,
            showHistory: tt
          })
        }),
        S.jsx(I3, {
          state: i.state,
          imageCount: d.length,
          showKbdHints: nt
        }),
        S.jsx(eO, {
          open: nt,
          onClose: () => at(false)
        })
      ]
    });
  }
  function ZO() {
    return S.jsx(LA, {
      children: S.jsx(KO, {})
    });
  }
  BT.createRoot(document.getElementById("root")).render(S.jsx(yn.StrictMode, {
    children: S.jsx(ZO, {})
  }));
})();
