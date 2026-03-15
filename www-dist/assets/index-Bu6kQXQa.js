(async () => {
  (function() {
    const l = document.createElement("link").relList;
    if (l && l.supports && l.supports("modulepreload")) return;
    for (const c of document.querySelectorAll('link[rel="modulepreload"]')) o(c);
    new MutationObserver((c) => {
      for (const d of c) if (d.type === "childList") for (const f of d.addedNodes) f.tagName === "LINK" && f.rel === "modulepreload" && o(f);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function u(c) {
      const d = {};
      return c.integrity && (d.integrity = c.integrity), c.referrerPolicy && (d.referrerPolicy = c.referrerPolicy), c.crossOrigin === "use-credentials" ? d.credentials = "include" : c.crossOrigin === "anonymous" ? d.credentials = "omit" : d.credentials = "same-origin", d;
    }
    function o(c) {
      if (c.ep) return;
      c.ep = true;
      const d = u(c);
      fetch(c.href, d);
    }
  })();
  function Uy(a) {
    return a && a.__esModule && Object.prototype.hasOwnProperty.call(a, "default") ? a.default : a;
  }
  var wr = {
    exports: {}
  }, rl = {};
  var op;
  function J1() {
    if (op) return rl;
    op = 1;
    var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
    function u(o, c, d) {
      var f = null;
      if (d !== void 0 && (f = "" + d), c.key !== void 0 && (f = "" + c.key), "key" in c) {
        d = {};
        for (var m in c) m !== "key" && (d[m] = c[m]);
      } else d = c;
      return c = d.ref, {
        $$typeof: a,
        type: o,
        key: f,
        ref: c !== void 0 ? c : null,
        props: d
      };
    }
    return rl.Fragment = l, rl.jsx = u, rl.jsxs = u, rl;
  }
  var rp;
  function F1() {
    return rp || (rp = 1, wr.exports = J1()), wr.exports;
  }
  var E = F1(), Vr = {
    exports: {}
  }, ut = {};
  var cp;
  function P1() {
    if (cp) return ut;
    cp = 1;
    var a = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), u = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), f = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), y = Symbol.for("react.suspense"), p = Symbol.for("react.memo"), v = Symbol.for("react.lazy"), b = Symbol.for("react.activity"), S = Symbol.iterator;
    function D(A) {
      return A === null || typeof A != "object" ? null : (A = S && A[S] || A["@@iterator"], typeof A == "function" ? A : null);
    }
    var N = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    }, q = Object.assign, Y = {};
    function G(A, B, Q) {
      this.props = A, this.context = B, this.refs = Y, this.updater = Q || N;
    }
    G.prototype.isReactComponent = {}, G.prototype.setState = function(A, B) {
      if (typeof A != "object" && typeof A != "function" && A != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, A, B, "setState");
    }, G.prototype.forceUpdate = function(A) {
      this.updater.enqueueForceUpdate(this, A, "forceUpdate");
    };
    function K() {
    }
    K.prototype = G.prototype;
    function X(A, B, Q) {
      this.props = A, this.context = B, this.refs = Y, this.updater = Q || N;
    }
    var Z = X.prototype = new K();
    Z.constructor = X, q(Z, G.prototype), Z.isPureReactComponent = true;
    var $ = Array.isArray;
    function st() {
    }
    var et = {
      H: null,
      A: null,
      T: null,
      S: null
    }, J = Object.prototype.hasOwnProperty;
    function it(A, B, Q) {
      var P = Q.ref;
      return {
        $$typeof: a,
        type: A,
        key: B,
        ref: P !== void 0 ? P : null,
        props: Q
      };
    }
    function tt(A, B) {
      return it(A.type, B, A.props);
    }
    function ft(A) {
      return typeof A == "object" && A !== null && A.$$typeof === a;
    }
    function pt(A) {
      var B = {
        "=": "=0",
        ":": "=2"
      };
      return "$" + A.replace(/[=:]/g, function(Q) {
        return B[Q];
      });
    }
    var Ut = /\/+/g;
    function _t(A, B) {
      return typeof A == "object" && A !== null && A.key != null ? pt("" + A.key) : B.toString(36);
    }
    function jt(A) {
      switch (A.status) {
        case "fulfilled":
          return A.value;
        case "rejected":
          throw A.reason;
        default:
          switch (typeof A.status == "string" ? A.then(st, st) : (A.status = "pending", A.then(function(B) {
            A.status === "pending" && (A.status = "fulfilled", A.value = B);
          }, function(B) {
            A.status === "pending" && (A.status = "rejected", A.reason = B);
          })), A.status) {
            case "fulfilled":
              return A.value;
            case "rejected":
              throw A.reason;
          }
      }
      throw A;
    }
    function x(A, B, Q, P, ot) {
      var ht = typeof A;
      (ht === "undefined" || ht === "boolean") && (A = null);
      var Tt = false;
      if (A === null) Tt = true;
      else switch (ht) {
        case "bigint":
        case "string":
        case "number":
          Tt = true;
          break;
        case "object":
          switch (A.$$typeof) {
            case a:
            case l:
              Tt = true;
              break;
            case v:
              return Tt = A._init, x(Tt(A._payload), B, Q, P, ot);
          }
      }
      if (Tt) return ot = ot(A), Tt = P === "" ? "." + _t(A, 0) : P, $(ot) ? (Q = "", Tt != null && (Q = Tt.replace(Ut, "$&/") + "/"), x(ot, B, Q, "", function(yi) {
        return yi;
      })) : ot != null && (ft(ot) && (ot = tt(ot, Q + (ot.key == null || A && A.key === ot.key ? "" : ("" + ot.key).replace(Ut, "$&/") + "/") + Tt)), B.push(ot)), 1;
      Tt = 0;
      var ue = P === "" ? "." : P + ":";
      if ($(A)) for (var Yt = 0; Yt < A.length; Yt++) P = A[Yt], ht = ue + _t(P, Yt), Tt += x(P, B, Q, ht, ot);
      else if (Yt = D(A), typeof Yt == "function") for (A = Yt.call(A), Yt = 0; !(P = A.next()).done; ) P = P.value, ht = ue + _t(P, Yt++), Tt += x(P, B, Q, ht, ot);
      else if (ht === "object") {
        if (typeof A.then == "function") return x(jt(A), B, Q, P, ot);
        throw B = String(A), Error("Objects are not valid as a React child (found: " + (B === "[object Object]" ? "object with keys {" + Object.keys(A).join(", ") + "}" : B) + "). If you meant to render a collection of children, use an array instead.");
      }
      return Tt;
    }
    function O(A, B, Q) {
      if (A == null) return A;
      var P = [], ot = 0;
      return x(A, P, "", "", function(ht) {
        return B.call(Q, ht, ot++);
      }), P;
    }
    function L(A) {
      if (A._status === -1) {
        var B = A._result;
        B = B(), B.then(function(Q) {
          (A._status === 0 || A._status === -1) && (A._status = 1, A._result = Q);
        }, function(Q) {
          (A._status === 0 || A._status === -1) && (A._status = 2, A._result = Q);
        }), A._status === -1 && (A._status = 0, A._result = B);
      }
      if (A._status === 1) return A._result.default;
      throw A._result;
    }
    var k = typeof reportError == "function" ? reportError : function(A) {
      if (typeof window == "object" && typeof window.ErrorEvent == "function") {
        var B = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof A == "object" && A !== null && typeof A.message == "string" ? String(A.message) : String(A),
          error: A
        });
        if (!window.dispatchEvent(B)) return;
      } else if (typeof process == "object" && typeof process.emit == "function") {
        process.emit("uncaughtException", A);
        return;
      }
      console.error(A);
    }, F = {
      map: O,
      forEach: function(A, B, Q) {
        O(A, function() {
          B.apply(this, arguments);
        }, Q);
      },
      count: function(A) {
        var B = 0;
        return O(A, function() {
          B++;
        }), B;
      },
      toArray: function(A) {
        return O(A, function(B) {
          return B;
        }) || [];
      },
      only: function(A) {
        if (!ft(A)) throw Error("React.Children.only expected to receive a single React element child.");
        return A;
      }
    };
    return ut.Activity = b, ut.Children = F, ut.Component = G, ut.Fragment = u, ut.Profiler = c, ut.PureComponent = X, ut.StrictMode = o, ut.Suspense = y, ut.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = et, ut.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(A) {
        return et.H.useMemoCache(A);
      }
    }, ut.cache = function(A) {
      return function() {
        return A.apply(null, arguments);
      };
    }, ut.cacheSignal = function() {
      return null;
    }, ut.cloneElement = function(A, B, Q) {
      if (A == null) throw Error("The argument must be a React element, but you passed " + A + ".");
      var P = q({}, A.props), ot = A.key;
      if (B != null) for (ht in B.key !== void 0 && (ot = "" + B.key), B) !J.call(B, ht) || ht === "key" || ht === "__self" || ht === "__source" || ht === "ref" && B.ref === void 0 || (P[ht] = B[ht]);
      var ht = arguments.length - 2;
      if (ht === 1) P.children = Q;
      else if (1 < ht) {
        for (var Tt = Array(ht), ue = 0; ue < ht; ue++) Tt[ue] = arguments[ue + 2];
        P.children = Tt;
      }
      return it(A.type, ot, P);
    }, ut.createContext = function(A) {
      return A = {
        $$typeof: f,
        _currentValue: A,
        _currentValue2: A,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      }, A.Provider = A, A.Consumer = {
        $$typeof: d,
        _context: A
      }, A;
    }, ut.createElement = function(A, B, Q) {
      var P, ot = {}, ht = null;
      if (B != null) for (P in B.key !== void 0 && (ht = "" + B.key), B) J.call(B, P) && P !== "key" && P !== "__self" && P !== "__source" && (ot[P] = B[P]);
      var Tt = arguments.length - 2;
      if (Tt === 1) ot.children = Q;
      else if (1 < Tt) {
        for (var ue = Array(Tt), Yt = 0; Yt < Tt; Yt++) ue[Yt] = arguments[Yt + 2];
        ot.children = ue;
      }
      if (A && A.defaultProps) for (P in Tt = A.defaultProps, Tt) ot[P] === void 0 && (ot[P] = Tt[P]);
      return it(A, ht, ot);
    }, ut.createRef = function() {
      return {
        current: null
      };
    }, ut.forwardRef = function(A) {
      return {
        $$typeof: m,
        render: A
      };
    }, ut.isValidElement = ft, ut.lazy = function(A) {
      return {
        $$typeof: v,
        _payload: {
          _status: -1,
          _result: A
        },
        _init: L
      };
    }, ut.memo = function(A, B) {
      return {
        $$typeof: p,
        type: A,
        compare: B === void 0 ? null : B
      };
    }, ut.startTransition = function(A) {
      var B = et.T, Q = {};
      et.T = Q;
      try {
        var P = A(), ot = et.S;
        ot !== null && ot(Q, P), typeof P == "object" && P !== null && typeof P.then == "function" && P.then(st, k);
      } catch (ht) {
        k(ht);
      } finally {
        B !== null && Q.types !== null && (B.types = Q.types), et.T = B;
      }
    }, ut.unstable_useCacheRefresh = function() {
      return et.H.useCacheRefresh();
    }, ut.use = function(A) {
      return et.H.use(A);
    }, ut.useActionState = function(A, B, Q) {
      return et.H.useActionState(A, B, Q);
    }, ut.useCallback = function(A, B) {
      return et.H.useCallback(A, B);
    }, ut.useContext = function(A) {
      return et.H.useContext(A);
    }, ut.useDebugValue = function() {
    }, ut.useDeferredValue = function(A, B) {
      return et.H.useDeferredValue(A, B);
    }, ut.useEffect = function(A, B) {
      return et.H.useEffect(A, B);
    }, ut.useEffectEvent = function(A) {
      return et.H.useEffectEvent(A);
    }, ut.useId = function() {
      return et.H.useId();
    }, ut.useImperativeHandle = function(A, B, Q) {
      return et.H.useImperativeHandle(A, B, Q);
    }, ut.useInsertionEffect = function(A, B) {
      return et.H.useInsertionEffect(A, B);
    }, ut.useLayoutEffect = function(A, B) {
      return et.H.useLayoutEffect(A, B);
    }, ut.useMemo = function(A, B) {
      return et.H.useMemo(A, B);
    }, ut.useOptimistic = function(A, B) {
      return et.H.useOptimistic(A, B);
    }, ut.useReducer = function(A, B, Q) {
      return et.H.useReducer(A, B, Q);
    }, ut.useRef = function(A) {
      return et.H.useRef(A);
    }, ut.useState = function(A) {
      return et.H.useState(A);
    }, ut.useSyncExternalStore = function(A, B, Q) {
      return et.H.useSyncExternalStore(A, B, Q);
    }, ut.useTransition = function() {
      return et.H.useTransition();
    }, ut.version = "19.2.4", ut;
  }
  var fp;
  function Dc() {
    return fp || (fp = 1, Vr.exports = P1()), Vr.exports;
  }
  var w = Dc();
  const By = Uy(w);
  var Ur = {
    exports: {}
  }, cl = {}, Br = {
    exports: {}
  }, Lr = {};
  var hp;
  function W1() {
    return hp || (hp = 1, (function(a) {
      function l(x, O) {
        var L = x.length;
        x.push(O);
        t: for (; 0 < L; ) {
          var k = L - 1 >>> 1, F = x[k];
          if (0 < c(F, O)) x[k] = O, x[L] = F, L = k;
          else break t;
        }
      }
      function u(x) {
        return x.length === 0 ? null : x[0];
      }
      function o(x) {
        if (x.length === 0) return null;
        var O = x[0], L = x.pop();
        if (L !== O) {
          x[0] = L;
          t: for (var k = 0, F = x.length, A = F >>> 1; k < A; ) {
            var B = 2 * (k + 1) - 1, Q = x[B], P = B + 1, ot = x[P];
            if (0 > c(Q, L)) P < F && 0 > c(ot, Q) ? (x[k] = ot, x[P] = L, k = P) : (x[k] = Q, x[B] = L, k = B);
            else if (P < F && 0 > c(ot, L)) x[k] = ot, x[P] = L, k = P;
            else break t;
          }
        }
        return O;
      }
      function c(x, O) {
        var L = x.sortIndex - O.sortIndex;
        return L !== 0 ? L : x.id - O.id;
      }
      if (a.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
        var d = performance;
        a.unstable_now = function() {
          return d.now();
        };
      } else {
        var f = Date, m = f.now();
        a.unstable_now = function() {
          return f.now() - m;
        };
      }
      var y = [], p = [], v = 1, b = null, S = 3, D = false, N = false, q = false, Y = false, G = typeof setTimeout == "function" ? setTimeout : null, K = typeof clearTimeout == "function" ? clearTimeout : null, X = typeof setImmediate < "u" ? setImmediate : null;
      function Z(x) {
        for (var O = u(p); O !== null; ) {
          if (O.callback === null) o(p);
          else if (O.startTime <= x) o(p), O.sortIndex = O.expirationTime, l(y, O);
          else break;
          O = u(p);
        }
      }
      function $(x) {
        if (q = false, Z(x), !N) if (u(y) !== null) N = true, st || (st = true, pt());
        else {
          var O = u(p);
          O !== null && jt($, O.startTime - x);
        }
      }
      var st = false, et = -1, J = 5, it = -1;
      function tt() {
        return Y ? true : !(a.unstable_now() - it < J);
      }
      function ft() {
        if (Y = false, st) {
          var x = a.unstable_now();
          it = x;
          var O = true;
          try {
            t: {
              N = false, q && (q = false, K(et), et = -1), D = true;
              var L = S;
              try {
                e: {
                  for (Z(x), b = u(y); b !== null && !(b.expirationTime > x && tt()); ) {
                    var k = b.callback;
                    if (typeof k == "function") {
                      b.callback = null, S = b.priorityLevel;
                      var F = k(b.expirationTime <= x);
                      if (x = a.unstable_now(), typeof F == "function") {
                        b.callback = F, Z(x), O = true;
                        break e;
                      }
                      b === u(y) && o(y), Z(x);
                    } else o(y);
                    b = u(y);
                  }
                  if (b !== null) O = true;
                  else {
                    var A = u(p);
                    A !== null && jt($, A.startTime - x), O = false;
                  }
                }
                break t;
              } finally {
                b = null, S = L, D = false;
              }
              O = void 0;
            }
          } finally {
            O ? pt() : st = false;
          }
        }
      }
      var pt;
      if (typeof X == "function") pt = function() {
        X(ft);
      };
      else if (typeof MessageChannel < "u") {
        var Ut = new MessageChannel(), _t = Ut.port2;
        Ut.port1.onmessage = ft, pt = function() {
          _t.postMessage(null);
        };
      } else pt = function() {
        G(ft, 0);
      };
      function jt(x, O) {
        et = G(function() {
          x(a.unstable_now());
        }, O);
      }
      a.unstable_IdlePriority = 5, a.unstable_ImmediatePriority = 1, a.unstable_LowPriority = 4, a.unstable_NormalPriority = 3, a.unstable_Profiling = null, a.unstable_UserBlockingPriority = 2, a.unstable_cancelCallback = function(x) {
        x.callback = null;
      }, a.unstable_forceFrameRate = function(x) {
        0 > x || 125 < x ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : J = 0 < x ? Math.floor(1e3 / x) : 5;
      }, a.unstable_getCurrentPriorityLevel = function() {
        return S;
      }, a.unstable_next = function(x) {
        switch (S) {
          case 1:
          case 2:
          case 3:
            var O = 3;
            break;
          default:
            O = S;
        }
        var L = S;
        S = O;
        try {
          return x();
        } finally {
          S = L;
        }
      }, a.unstable_requestPaint = function() {
        Y = true;
      }, a.unstable_runWithPriority = function(x, O) {
        switch (x) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            x = 3;
        }
        var L = S;
        S = x;
        try {
          return O();
        } finally {
          S = L;
        }
      }, a.unstable_scheduleCallback = function(x, O, L) {
        var k = a.unstable_now();
        switch (typeof L == "object" && L !== null ? (L = L.delay, L = typeof L == "number" && 0 < L ? k + L : k) : L = k, x) {
          case 1:
            var F = -1;
            break;
          case 2:
            F = 250;
            break;
          case 5:
            F = 1073741823;
            break;
          case 4:
            F = 1e4;
            break;
          default:
            F = 5e3;
        }
        return F = L + F, x = {
          id: v++,
          callback: O,
          priorityLevel: x,
          startTime: L,
          expirationTime: F,
          sortIndex: -1
        }, L > k ? (x.sortIndex = L, l(p, x), u(y) === null && x === u(p) && (q ? (K(et), et = -1) : q = true, jt($, L - k))) : (x.sortIndex = F, l(y, x), N || D || (N = true, st || (st = true, pt()))), x;
      }, a.unstable_shouldYield = tt, a.unstable_wrapCallback = function(x) {
        var O = S;
        return function() {
          var L = S;
          S = O;
          try {
            return x.apply(this, arguments);
          } finally {
            S = L;
          }
        };
      };
    })(Lr)), Lr;
  }
  var dp;
  function $1() {
    return dp || (dp = 1, Br.exports = W1()), Br.exports;
  }
  var Hr = {
    exports: {}
  }, se = {};
  var mp;
  function I1() {
    if (mp) return se;
    mp = 1;
    var a = Dc();
    function l(y) {
      var p = "https://react.dev/errors/" + y;
      if (1 < arguments.length) {
        p += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var v = 2; v < arguments.length; v++) p += "&args[]=" + encodeURIComponent(arguments[v]);
      }
      return "Minified React error #" + y + "; visit " + p + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function u() {
    }
    var o = {
      d: {
        f: u,
        r: function() {
          throw Error(l(522));
        },
        D: u,
        C: u,
        L: u,
        m: u,
        X: u,
        S: u,
        M: u
      },
      p: 0,
      findDOMNode: null
    }, c = Symbol.for("react.portal");
    function d(y, p, v) {
      var b = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
      return {
        $$typeof: c,
        key: b == null ? null : "" + b,
        children: y,
        containerInfo: p,
        implementation: v
      };
    }
    var f = a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function m(y, p) {
      if (y === "font") return "";
      if (typeof p == "string") return p === "use-credentials" ? p : "";
    }
    return se.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = o, se.createPortal = function(y, p) {
      var v = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11) throw Error(l(299));
      return d(y, p, null, v);
    }, se.flushSync = function(y) {
      var p = f.T, v = o.p;
      try {
        if (f.T = null, o.p = 2, y) return y();
      } finally {
        f.T = p, o.p = v, o.d.f();
      }
    }, se.preconnect = function(y, p) {
      typeof y == "string" && (p ? (p = p.crossOrigin, p = typeof p == "string" ? p === "use-credentials" ? p : "" : void 0) : p = null, o.d.C(y, p));
    }, se.prefetchDNS = function(y) {
      typeof y == "string" && o.d.D(y);
    }, se.preinit = function(y, p) {
      if (typeof y == "string" && p && typeof p.as == "string") {
        var v = p.as, b = m(v, p.crossOrigin), S = typeof p.integrity == "string" ? p.integrity : void 0, D = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        v === "style" ? o.d.S(y, typeof p.precedence == "string" ? p.precedence : void 0, {
          crossOrigin: b,
          integrity: S,
          fetchPriority: D
        }) : v === "script" && o.d.X(y, {
          crossOrigin: b,
          integrity: S,
          fetchPriority: D,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0
        });
      }
    }, se.preinitModule = function(y, p) {
      if (typeof y == "string") if (typeof p == "object" && p !== null) {
        if (p.as == null || p.as === "script") {
          var v = m(p.as, p.crossOrigin);
          o.d.M(y, {
            crossOrigin: v,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
            nonce: typeof p.nonce == "string" ? p.nonce : void 0
          });
        }
      } else p == null && o.d.M(y);
    }, se.preload = function(y, p) {
      if (typeof y == "string" && typeof p == "object" && p !== null && typeof p.as == "string") {
        var v = p.as, b = m(v, p.crossOrigin);
        o.d.L(y, v, {
          crossOrigin: b,
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
    }, se.preloadModule = function(y, p) {
      if (typeof y == "string") if (p) {
        var v = m(p.as, p.crossOrigin);
        o.d.m(y, {
          as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
          crossOrigin: v,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0
        });
      } else o.d.m(y);
    }, se.requestFormReset = function(y) {
      o.d.r(y);
    }, se.unstable_batchedUpdates = function(y, p) {
      return y(p);
    }, se.useFormState = function(y, p, v) {
      return f.H.useFormState(y, p, v);
    }, se.useFormStatus = function() {
      return f.H.useHostTransitionStatus();
    }, se.version = "19.2.4", se;
  }
  var pp;
  function tb() {
    if (pp) return Hr.exports;
    pp = 1;
    function a() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(a);
      } catch (l) {
        console.error(l);
      }
    }
    return a(), Hr.exports = I1(), Hr.exports;
  }
  var yp;
  function eb() {
    if (yp) return cl;
    yp = 1;
    var a = $1(), l = Dc(), u = tb();
    function o(t) {
      var e = "https://react.dev/errors/" + t;
      if (1 < arguments.length) {
        e += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var n = 2; n < arguments.length; n++) e += "&args[]=" + encodeURIComponent(arguments[n]);
      }
      return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function c(t) {
      return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
    }
    function d(t) {
      var e = t, n = t;
      if (t.alternate) for (; e.return; ) e = e.return;
      else {
        t = e;
        do
          e = t, (e.flags & 4098) !== 0 && (n = e.return), t = e.return;
        while (t);
      }
      return e.tag === 3 ? n : null;
    }
    function f(t) {
      if (t.tag === 13) {
        var e = t.memoizedState;
        if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
      }
      return null;
    }
    function m(t) {
      if (t.tag === 31) {
        var e = t.memoizedState;
        if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
      }
      return null;
    }
    function y(t) {
      if (d(t) !== t) throw Error(o(188));
    }
    function p(t) {
      var e = t.alternate;
      if (!e) {
        if (e = d(t), e === null) throw Error(o(188));
        return e !== t ? null : t;
      }
      for (var n = t, i = e; ; ) {
        var s = n.return;
        if (s === null) break;
        var r = s.alternate;
        if (r === null) {
          if (i = s.return, i !== null) {
            n = i;
            continue;
          }
          break;
        }
        if (s.child === r.child) {
          for (r = s.child; r; ) {
            if (r === n) return y(s), t;
            if (r === i) return y(s), e;
            r = r.sibling;
          }
          throw Error(o(188));
        }
        if (n.return !== i.return) n = s, i = r;
        else {
          for (var h = false, g = s.child; g; ) {
            if (g === n) {
              h = true, n = s, i = r;
              break;
            }
            if (g === i) {
              h = true, i = s, n = r;
              break;
            }
            g = g.sibling;
          }
          if (!h) {
            for (g = r.child; g; ) {
              if (g === n) {
                h = true, n = r, i = s;
                break;
              }
              if (g === i) {
                h = true, i = r, n = s;
                break;
              }
              g = g.sibling;
            }
            if (!h) throw Error(o(189));
          }
        }
        if (n.alternate !== i) throw Error(o(190));
      }
      if (n.tag !== 3) throw Error(o(188));
      return n.stateNode.current === n ? t : e;
    }
    function v(t) {
      var e = t.tag;
      if (e === 5 || e === 26 || e === 27 || e === 6) return t;
      for (t = t.child; t !== null; ) {
        if (e = v(t), e !== null) return e;
        t = t.sibling;
      }
      return null;
    }
    var b = Object.assign, S = Symbol.for("react.element"), D = Symbol.for("react.transitional.element"), N = Symbol.for("react.portal"), q = Symbol.for("react.fragment"), Y = Symbol.for("react.strict_mode"), G = Symbol.for("react.profiler"), K = Symbol.for("react.consumer"), X = Symbol.for("react.context"), Z = Symbol.for("react.forward_ref"), $ = Symbol.for("react.suspense"), st = Symbol.for("react.suspense_list"), et = Symbol.for("react.memo"), J = Symbol.for("react.lazy"), it = Symbol.for("react.activity"), tt = Symbol.for("react.memo_cache_sentinel"), ft = Symbol.iterator;
    function pt(t) {
      return t === null || typeof t != "object" ? null : (t = ft && t[ft] || t["@@iterator"], typeof t == "function" ? t : null);
    }
    var Ut = Symbol.for("react.client.reference");
    function _t(t) {
      if (t == null) return null;
      if (typeof t == "function") return t.$$typeof === Ut ? null : t.displayName || t.name || null;
      if (typeof t == "string") return t;
      switch (t) {
        case q:
          return "Fragment";
        case G:
          return "Profiler";
        case Y:
          return "StrictMode";
        case $:
          return "Suspense";
        case st:
          return "SuspenseList";
        case it:
          return "Activity";
      }
      if (typeof t == "object") switch (t.$$typeof) {
        case N:
          return "Portal";
        case X:
          return t.displayName || "Context";
        case K:
          return (t._context.displayName || "Context") + ".Consumer";
        case Z:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case et:
          return e = t.displayName || null, e !== null ? e : _t(t.type) || "Memo";
        case J:
          e = t._payload, t = t._init;
          try {
            return _t(t(e));
          } catch {
          }
      }
      return null;
    }
    var jt = Array.isArray, x = l.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, O = u.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, L = {
      pending: false,
      data: null,
      method: null,
      action: null
    }, k = [], F = -1;
    function A(t) {
      return {
        current: t
      };
    }
    function B(t) {
      0 > F || (t.current = k[F], k[F] = null, F--);
    }
    function Q(t, e) {
      F++, k[F] = t.current, t.current = e;
    }
    var P = A(null), ot = A(null), ht = A(null), Tt = A(null);
    function ue(t, e) {
      switch (Q(ht, e), Q(ot, t), Q(P, null), e.nodeType) {
        case 9:
        case 11:
          t = (t = e.documentElement) && (t = t.namespaceURI) ? Om(t) : 0;
          break;
        default:
          if (t = e.tagName, e = e.namespaceURI) e = Om(e), t = Nm(e, t);
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
      B(P), Q(P, t);
    }
    function Yt() {
      B(P), B(ot), B(ht);
    }
    function yi(t) {
      t.memoizedState !== null && Q(Tt, t);
      var e = P.current, n = Nm(e, t.type);
      e !== n && (Q(ot, t), Q(P, n));
    }
    function Cl(t) {
      ot.current === t && (B(P), B(ot)), Tt.current === t && (B(Tt), ll._currentValue = L);
    }
    var pu, uf;
    function Pn(t) {
      if (pu === void 0) try {
        throw Error();
      } catch (n) {
        var e = n.stack.trim().match(/\n( *(at )?)/);
        pu = e && e[1] || "", uf = -1 < n.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < n.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
      return `
` + pu + t + uf;
    }
    var yu = false;
    function gu(t, e) {
      if (!t || yu) return "";
      yu = true;
      var n = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        var i = {
          DetermineComponentFrameRoot: function() {
            try {
              if (e) {
                var H = function() {
                  throw Error();
                };
                if (Object.defineProperty(H.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                }), typeof Reflect == "object" && Reflect.construct) {
                  try {
                    Reflect.construct(H, []);
                  } catch (_) {
                    var j = _;
                  }
                  Reflect.construct(t, [], H);
                } else {
                  try {
                    H.call();
                  } catch (_) {
                    j = _;
                  }
                  t.call(H.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (_) {
                  j = _;
                }
                (H = t()) && typeof H.catch == "function" && H.catch(function() {
                });
              }
            } catch (_) {
              if (_ && j && typeof _.stack == "string") return [
                _.stack,
                j.stack
              ];
            }
            return [
              null,
              null
            ];
          }
        };
        i.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
        var s = Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot, "name");
        s && s.configurable && Object.defineProperty(i.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot"
        });
        var r = i.DetermineComponentFrameRoot(), h = r[0], g = r[1];
        if (h && g) {
          var T = h.split(`
`), R = g.split(`
`);
          for (s = i = 0; i < T.length && !T[i].includes("DetermineComponentFrameRoot"); ) i++;
          for (; s < R.length && !R[s].includes("DetermineComponentFrameRoot"); ) s++;
          if (i === T.length || s === R.length) for (i = T.length - 1, s = R.length - 1; 1 <= i && 0 <= s && T[i] !== R[s]; ) s--;
          for (; 1 <= i && 0 <= s; i--, s--) if (T[i] !== R[s]) {
            if (i !== 1 || s !== 1) do
              if (i--, s--, 0 > s || T[i] !== R[s]) {
                var V = `
` + T[i].replace(" at new ", " at ");
                return t.displayName && V.includes("<anonymous>") && (V = V.replace("<anonymous>", t.displayName)), V;
              }
            while (1 <= i && 0 <= s);
            break;
          }
        }
      } finally {
        yu = false, Error.prepareStackTrace = n;
      }
      return (n = t ? t.displayName || t.name : "") ? Pn(n) : "";
    }
    function Mg(t, e) {
      switch (t.tag) {
        case 26:
        case 27:
        case 5:
          return Pn(t.type);
        case 16:
          return Pn("Lazy");
        case 13:
          return t.child !== e && e !== null ? Pn("Suspense Fallback") : Pn("Suspense");
        case 19:
          return Pn("SuspenseList");
        case 0:
        case 15:
          return gu(t.type, false);
        case 11:
          return gu(t.type.render, false);
        case 1:
          return gu(t.type, true);
        case 31:
          return Pn("Activity");
        default:
          return "";
      }
    }
    function of(t) {
      try {
        var e = "", n = null;
        do
          e += Mg(t, n), n = t, t = t.return;
        while (t);
        return e;
      } catch (i) {
        return `
Error generating stack: ` + i.message + `
` + i.stack;
      }
    }
    var vu = Object.prototype.hasOwnProperty, bu = a.unstable_scheduleCallback, Su = a.unstable_cancelCallback, Cg = a.unstable_shouldYield, Dg = a.unstable_requestPaint, ve = a.unstable_now, zg = a.unstable_getCurrentPriorityLevel, rf = a.unstable_ImmediatePriority, cf = a.unstable_UserBlockingPriority, Dl = a.unstable_NormalPriority, Rg = a.unstable_LowPriority, ff = a.unstable_IdlePriority, jg = a.log, Og = a.unstable_setDisableYieldValue, gi = null, be = null;
    function bn(t) {
      if (typeof jg == "function" && Og(t), be && typeof be.setStrictMode == "function") try {
        be.setStrictMode(gi, t);
      } catch {
      }
    }
    var Se = Math.clz32 ? Math.clz32 : wg, Ng = Math.log, _g = Math.LN2;
    function wg(t) {
      return t >>>= 0, t === 0 ? 32 : 31 - (Ng(t) / _g | 0) | 0;
    }
    var zl = 256, Rl = 262144, jl = 4194304;
    function Wn(t) {
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
    function Ol(t, e, n) {
      var i = t.pendingLanes;
      if (i === 0) return 0;
      var s = 0, r = t.suspendedLanes, h = t.pingedLanes;
      t = t.warmLanes;
      var g = i & 134217727;
      return g !== 0 ? (i = g & ~r, i !== 0 ? s = Wn(i) : (h &= g, h !== 0 ? s = Wn(h) : n || (n = g & ~t, n !== 0 && (s = Wn(n))))) : (g = i & ~r, g !== 0 ? s = Wn(g) : h !== 0 ? s = Wn(h) : n || (n = i & ~t, n !== 0 && (s = Wn(n)))), s === 0 ? 0 : e !== 0 && e !== s && (e & r) === 0 && (r = s & -s, n = e & -e, r >= n || r === 32 && (n & 4194048) !== 0) ? e : s;
    }
    function vi(t, e) {
      return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
    }
    function Vg(t, e) {
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
    function hf() {
      var t = jl;
      return jl <<= 1, (jl & 62914560) === 0 && (jl = 4194304), t;
    }
    function xu(t) {
      for (var e = [], n = 0; 31 > n; n++) e.push(t);
      return e;
    }
    function bi(t, e) {
      t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
    }
    function Ug(t, e, n, i, s, r) {
      var h = t.pendingLanes;
      t.pendingLanes = n, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= n, t.entangledLanes &= n, t.errorRecoveryDisabledLanes &= n, t.shellSuspendCounter = 0;
      var g = t.entanglements, T = t.expirationTimes, R = t.hiddenUpdates;
      for (n = h & ~n; 0 < n; ) {
        var V = 31 - Se(n), H = 1 << V;
        g[V] = 0, T[V] = -1;
        var j = R[V];
        if (j !== null) for (R[V] = null, V = 0; V < j.length; V++) {
          var _ = j[V];
          _ !== null && (_.lane &= -536870913);
        }
        n &= ~H;
      }
      i !== 0 && df(t, i, 0), r !== 0 && s === 0 && t.tag !== 0 && (t.suspendedLanes |= r & ~(h & ~e));
    }
    function df(t, e, n) {
      t.pendingLanes |= e, t.suspendedLanes &= ~e;
      var i = 31 - Se(e);
      t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | n & 261930;
    }
    function mf(t, e) {
      var n = t.entangledLanes |= e;
      for (t = t.entanglements; n; ) {
        var i = 31 - Se(n), s = 1 << i;
        s & e | t[i] & e && (t[i] |= e), n &= ~s;
      }
    }
    function pf(t, e) {
      var n = e & -e;
      return n = (n & 42) !== 0 ? 1 : Tu(n), (n & (t.suspendedLanes | e)) !== 0 ? 0 : n;
    }
    function Tu(t) {
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
    function Au(t) {
      return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
    }
    function yf() {
      var t = O.p;
      return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : ep(t.type));
    }
    function gf(t, e) {
      var n = O.p;
      try {
        return O.p = t, e();
      } finally {
        O.p = n;
      }
    }
    var Sn = Math.random().toString(36).slice(2), It = "__reactFiber$" + Sn, fe = "__reactProps$" + Sn, xa = "__reactContainer$" + Sn, Eu = "__reactEvents$" + Sn, Bg = "__reactListeners$" + Sn, Lg = "__reactHandles$" + Sn, vf = "__reactResources$" + Sn, Si = "__reactMarker$" + Sn;
    function Mu(t) {
      delete t[It], delete t[fe], delete t[Eu], delete t[Bg], delete t[Lg];
    }
    function Ta(t) {
      var e = t[It];
      if (e) return e;
      for (var n = t.parentNode; n; ) {
        if (e = n[xa] || n[It]) {
          if (n = e.alternate, e.child !== null || n !== null && n.child !== null) for (t = Hm(t); t !== null; ) {
            if (n = t[It]) return n;
            t = Hm(t);
          }
          return e;
        }
        t = n, n = t.parentNode;
      }
      return null;
    }
    function Aa(t) {
      if (t = t[It] || t[xa]) {
        var e = t.tag;
        if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3) return t;
      }
      return null;
    }
    function xi(t) {
      var e = t.tag;
      if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
      throw Error(o(33));
    }
    function Ea(t) {
      var e = t[vf];
      return e || (e = t[vf] = {
        hoistableStyles: /* @__PURE__ */ new Map(),
        hoistableScripts: /* @__PURE__ */ new Map()
      }), e;
    }
    function Wt(t) {
      t[Si] = true;
    }
    var bf = /* @__PURE__ */ new Set(), Sf = {};
    function $n(t, e) {
      Ma(t, e), Ma(t + "Capture", e);
    }
    function Ma(t, e) {
      for (Sf[t] = e, t = 0; t < e.length; t++) bf.add(e[t]);
    }
    var Hg = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), xf = {}, Tf = {};
    function qg(t) {
      return vu.call(Tf, t) ? true : vu.call(xf, t) ? false : Hg.test(t) ? Tf[t] = true : (xf[t] = true, false);
    }
    function Nl(t, e, n) {
      if (qg(e)) if (n === null) t.removeAttribute(e);
      else {
        switch (typeof n) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var i = e.toLowerCase().slice(0, 5);
            if (i !== "data-" && i !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, "" + n);
      }
    }
    function _l(t, e, n) {
      if (n === null) t.removeAttribute(e);
      else {
        switch (typeof n) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            t.removeAttribute(e);
            return;
        }
        t.setAttribute(e, "" + n);
      }
    }
    function tn(t, e, n, i) {
      if (i === null) t.removeAttribute(n);
      else {
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            t.removeAttribute(n);
            return;
        }
        t.setAttributeNS(e, n, "" + i);
      }
    }
    function Re(t) {
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
    function Af(t) {
      var e = t.type;
      return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
    }
    function Yg(t, e, n) {
      var i = Object.getOwnPropertyDescriptor(t.constructor.prototype, e);
      if (!t.hasOwnProperty(e) && typeof i < "u" && typeof i.get == "function" && typeof i.set == "function") {
        var s = i.get, r = i.set;
        return Object.defineProperty(t, e, {
          configurable: true,
          get: function() {
            return s.call(this);
          },
          set: function(h) {
            n = "" + h, r.call(this, h);
          }
        }), Object.defineProperty(t, e, {
          enumerable: i.enumerable
        }), {
          getValue: function() {
            return n;
          },
          setValue: function(h) {
            n = "" + h;
          },
          stopTracking: function() {
            t._valueTracker = null, delete t[e];
          }
        };
      }
    }
    function Cu(t) {
      if (!t._valueTracker) {
        var e = Af(t) ? "checked" : "value";
        t._valueTracker = Yg(t, e, "" + t[e]);
      }
    }
    function Ef(t) {
      if (!t) return false;
      var e = t._valueTracker;
      if (!e) return true;
      var n = e.getValue(), i = "";
      return t && (i = Af(t) ? t.checked ? "true" : "false" : t.value), t = i, t !== n ? (e.setValue(t), true) : false;
    }
    function wl(t) {
      if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
      try {
        return t.activeElement || t.body;
      } catch {
        return t.body;
      }
    }
    var Gg = /[\n"\\]/g;
    function je(t) {
      return t.replace(Gg, function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      });
    }
    function Du(t, e, n, i, s, r, h, g) {
      t.name = "", h != null && typeof h != "function" && typeof h != "symbol" && typeof h != "boolean" ? t.type = h : t.removeAttribute("type"), e != null ? h === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + Re(e)) : t.value !== "" + Re(e) && (t.value = "" + Re(e)) : h !== "submit" && h !== "reset" || t.removeAttribute("value"), e != null ? zu(t, h, Re(e)) : n != null ? zu(t, h, Re(n)) : i != null && t.removeAttribute("value"), s == null && r != null && (t.defaultChecked = !!r), s != null && (t.checked = s && typeof s != "function" && typeof s != "symbol"), g != null && typeof g != "function" && typeof g != "symbol" && typeof g != "boolean" ? t.name = "" + Re(g) : t.removeAttribute("name");
    }
    function Mf(t, e, n, i, s, r, h, g) {
      if (r != null && typeof r != "function" && typeof r != "symbol" && typeof r != "boolean" && (t.type = r), e != null || n != null) {
        if (!(r !== "submit" && r !== "reset" || e != null)) {
          Cu(t);
          return;
        }
        n = n != null ? "" + Re(n) : "", e = e != null ? "" + Re(e) : n, g || e === t.value || (t.value = e), t.defaultValue = e;
      }
      i = i ?? s, i = typeof i != "function" && typeof i != "symbol" && !!i, t.checked = g ? t.checked : !!i, t.defaultChecked = !!i, h != null && typeof h != "function" && typeof h != "symbol" && typeof h != "boolean" && (t.name = h), Cu(t);
    }
    function zu(t, e, n) {
      e === "number" && wl(t.ownerDocument) === t || t.defaultValue === "" + n || (t.defaultValue = "" + n);
    }
    function Ca(t, e, n, i) {
      if (t = t.options, e) {
        e = {};
        for (var s = 0; s < n.length; s++) e["$" + n[s]] = true;
        for (n = 0; n < t.length; n++) s = e.hasOwnProperty("$" + t[n].value), t[n].selected !== s && (t[n].selected = s), s && i && (t[n].defaultSelected = true);
      } else {
        for (n = "" + Re(n), e = null, s = 0; s < t.length; s++) {
          if (t[s].value === n) {
            t[s].selected = true, i && (t[s].defaultSelected = true);
            return;
          }
          e !== null || t[s].disabled || (e = t[s]);
        }
        e !== null && (e.selected = true);
      }
    }
    function Cf(t, e, n) {
      if (e != null && (e = "" + Re(e), e !== t.value && (t.value = e), n == null)) {
        t.defaultValue !== e && (t.defaultValue = e);
        return;
      }
      t.defaultValue = n != null ? "" + Re(n) : "";
    }
    function Df(t, e, n, i) {
      if (e == null) {
        if (i != null) {
          if (n != null) throw Error(o(92));
          if (jt(i)) {
            if (1 < i.length) throw Error(o(93));
            i = i[0];
          }
          n = i;
        }
        n == null && (n = ""), e = n;
      }
      n = Re(e), t.defaultValue = n, i = t.textContent, i === n && i !== "" && i !== null && (t.value = i), Cu(t);
    }
    function Da(t, e) {
      if (e) {
        var n = t.firstChild;
        if (n && n === t.lastChild && n.nodeType === 3) {
          n.nodeValue = e;
          return;
        }
      }
      t.textContent = e;
    }
    var Xg = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
    function zf(t, e, n) {
      var i = e.indexOf("--") === 0;
      n == null || typeof n == "boolean" || n === "" ? i ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : i ? t.setProperty(e, n) : typeof n != "number" || n === 0 || Xg.has(e) ? e === "float" ? t.cssFloat = n : t[e] = ("" + n).trim() : t[e] = n + "px";
    }
    function Rf(t, e, n) {
      if (e != null && typeof e != "object") throw Error(o(62));
      if (t = t.style, n != null) {
        for (var i in n) !n.hasOwnProperty(i) || e != null && e.hasOwnProperty(i) || (i.indexOf("--") === 0 ? t.setProperty(i, "") : i === "float" ? t.cssFloat = "" : t[i] = "");
        for (var s in e) i = e[s], e.hasOwnProperty(s) && n[s] !== i && zf(t, s, i);
      } else for (var r in e) e.hasOwnProperty(r) && zf(t, r, e[r]);
    }
    function Ru(t) {
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
    var kg = /* @__PURE__ */ new Map([
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
    ]), Zg = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    function Vl(t) {
      return Zg.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
    }
    function en() {
    }
    var ju = null;
    function Ou(t) {
      return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
    }
    var za = null, Ra = null;
    function jf(t) {
      var e = Aa(t);
      if (e && (t = e.stateNode)) {
        var n = t[fe] || null;
        t: switch (t = e.stateNode, e.type) {
          case "input":
            if (Du(t, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), e = n.name, n.type === "radio" && e != null) {
              for (n = t; n.parentNode; ) n = n.parentNode;
              for (n = n.querySelectorAll('input[name="' + je("" + e) + '"][type="radio"]'), e = 0; e < n.length; e++) {
                var i = n[e];
                if (i !== t && i.form === t.form) {
                  var s = i[fe] || null;
                  if (!s) throw Error(o(90));
                  Du(i, s.value, s.defaultValue, s.defaultValue, s.checked, s.defaultChecked, s.type, s.name);
                }
              }
              for (e = 0; e < n.length; e++) i = n[e], i.form === t.form && Ef(i);
            }
            break t;
          case "textarea":
            Cf(t, n.value, n.defaultValue);
            break t;
          case "select":
            e = n.value, e != null && Ca(t, !!n.multiple, e, false);
        }
      }
    }
    var Nu = false;
    function Of(t, e, n) {
      if (Nu) return t(e, n);
      Nu = true;
      try {
        var i = t(e);
        return i;
      } finally {
        if (Nu = false, (za !== null || Ra !== null) && (Ts(), za && (e = za, t = Ra, Ra = za = null, jf(e), t))) for (e = 0; e < t.length; e++) jf(t[e]);
      }
    }
    function Ti(t, e) {
      var n = t.stateNode;
      if (n === null) return null;
      var i = n[fe] || null;
      if (i === null) return null;
      n = i[e];
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
          (i = !i.disabled) || (t = t.type, i = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !i;
          break t;
        default:
          t = false;
      }
      if (t) return null;
      if (n && typeof n != "function") throw Error(o(231, e, typeof n));
      return n;
    }
    var nn = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), _u = false;
    if (nn) try {
      var Ai = {};
      Object.defineProperty(Ai, "passive", {
        get: function() {
          _u = true;
        }
      }), window.addEventListener("test", Ai, Ai), window.removeEventListener("test", Ai, Ai);
    } catch {
      _u = false;
    }
    var xn = null, wu = null, Ul = null;
    function Nf() {
      if (Ul) return Ul;
      var t, e = wu, n = e.length, i, s = "value" in xn ? xn.value : xn.textContent, r = s.length;
      for (t = 0; t < n && e[t] === s[t]; t++) ;
      var h = n - t;
      for (i = 1; i <= h && e[n - i] === s[r - i]; i++) ;
      return Ul = s.slice(t, 1 < i ? 1 - i : void 0);
    }
    function Bl(t) {
      var e = t.keyCode;
      return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
    }
    function Ll() {
      return true;
    }
    function _f() {
      return false;
    }
    function he(t) {
      function e(n, i, s, r, h) {
        this._reactName = n, this._targetInst = s, this.type = i, this.nativeEvent = r, this.target = h, this.currentTarget = null;
        for (var g in t) t.hasOwnProperty(g) && (n = t[g], this[g] = n ? n(r) : r[g]);
        return this.isDefaultPrevented = (r.defaultPrevented != null ? r.defaultPrevented : r.returnValue === false) ? Ll : _f, this.isPropagationStopped = _f, this;
      }
      return b(e.prototype, {
        preventDefault: function() {
          this.defaultPrevented = true;
          var n = this.nativeEvent;
          n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = false), this.isDefaultPrevented = Ll);
        },
        stopPropagation: function() {
          var n = this.nativeEvent;
          n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = true), this.isPropagationStopped = Ll);
        },
        persist: function() {
        },
        isPersistent: Ll
      }), e;
    }
    var In = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function(t) {
        return t.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0
    }, Hl = he(In), Ei = b({}, In, {
      view: 0,
      detail: 0
    }), Kg = he(Ei), Vu, Uu, Mi, ql = b({}, Ei, {
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
      getModifierState: Lu,
      button: 0,
      buttons: 0,
      relatedTarget: function(t) {
        return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
      },
      movementX: function(t) {
        return "movementX" in t ? t.movementX : (t !== Mi && (Mi && t.type === "mousemove" ? (Vu = t.screenX - Mi.screenX, Uu = t.screenY - Mi.screenY) : Uu = Vu = 0, Mi = t), Vu);
      },
      movementY: function(t) {
        return "movementY" in t ? t.movementY : Uu;
      }
    }), wf = he(ql), Qg = b({}, ql, {
      dataTransfer: 0
    }), Jg = he(Qg), Fg = b({}, Ei, {
      relatedTarget: 0
    }), Bu = he(Fg), Pg = b({}, In, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), Wg = he(Pg), $g = b({}, In, {
      clipboardData: function(t) {
        return "clipboardData" in t ? t.clipboardData : window.clipboardData;
      }
    }), Ig = he($g), tv = b({}, In, {
      data: 0
    }), Vf = he(tv), ev = {
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
    }, nv = {
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
    }, av = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey"
    };
    function iv(t) {
      var e = this.nativeEvent;
      return e.getModifierState ? e.getModifierState(t) : (t = av[t]) ? !!e[t] : false;
    }
    function Lu() {
      return iv;
    }
    var lv = b({}, Ei, {
      key: function(t) {
        if (t.key) {
          var e = ev[t.key] || t.key;
          if (e !== "Unidentified") return e;
        }
        return t.type === "keypress" ? (t = Bl(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? nv[t.keyCode] || "Unidentified" : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Lu,
      charCode: function(t) {
        return t.type === "keypress" ? Bl(t) : 0;
      },
      keyCode: function(t) {
        return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      },
      which: function(t) {
        return t.type === "keypress" ? Bl(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
      }
    }), sv = he(lv), uv = b({}, ql, {
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
    }), Uf = he(uv), ov = b({}, Ei, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Lu
    }), rv = he(ov), cv = b({}, In, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    }), fv = he(cv), hv = b({}, ql, {
      deltaX: function(t) {
        return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
      },
      deltaY: function(t) {
        return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    }), dv = he(hv), mv = b({}, In, {
      newState: 0,
      oldState: 0
    }), pv = he(mv), yv = [
      9,
      13,
      27,
      32
    ], Hu = nn && "CompositionEvent" in window, Ci = null;
    nn && "documentMode" in document && (Ci = document.documentMode);
    var gv = nn && "TextEvent" in window && !Ci, Bf = nn && (!Hu || Ci && 8 < Ci && 11 >= Ci), Lf = " ", Hf = false;
    function qf(t, e) {
      switch (t) {
        case "keyup":
          return yv.indexOf(e.keyCode) !== -1;
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
    function Yf(t) {
      return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
    }
    var ja = false;
    function vv(t, e) {
      switch (t) {
        case "compositionend":
          return Yf(e);
        case "keypress":
          return e.which !== 32 ? null : (Hf = true, Lf);
        case "textInput":
          return t = e.data, t === Lf && Hf ? null : t;
        default:
          return null;
      }
    }
    function bv(t, e) {
      if (ja) return t === "compositionend" || !Hu && qf(t, e) ? (t = Nf(), Ul = wu = xn = null, ja = false, t) : null;
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
          return Bf && e.locale !== "ko" ? null : e.data;
        default:
          return null;
      }
    }
    var Sv = {
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
    function Gf(t) {
      var e = t && t.nodeName && t.nodeName.toLowerCase();
      return e === "input" ? !!Sv[t.type] : e === "textarea";
    }
    function Xf(t, e, n, i) {
      za ? Ra ? Ra.push(i) : Ra = [
        i
      ] : za = i, e = Rs(e, "onChange"), 0 < e.length && (n = new Hl("onChange", "change", null, n, i), t.push({
        event: n,
        listeners: e
      }));
    }
    var Di = null, zi = null;
    function xv(t) {
      Mm(t, 0);
    }
    function Yl(t) {
      var e = xi(t);
      if (Ef(e)) return t;
    }
    function kf(t, e) {
      if (t === "change") return e;
    }
    var Zf = false;
    if (nn) {
      var qu;
      if (nn) {
        var Yu = "oninput" in document;
        if (!Yu) {
          var Kf = document.createElement("div");
          Kf.setAttribute("oninput", "return;"), Yu = typeof Kf.oninput == "function";
        }
        qu = Yu;
      } else qu = false;
      Zf = qu && (!document.documentMode || 9 < document.documentMode);
    }
    function Qf() {
      Di && (Di.detachEvent("onpropertychange", Jf), zi = Di = null);
    }
    function Jf(t) {
      if (t.propertyName === "value" && Yl(zi)) {
        var e = [];
        Xf(e, zi, t, Ou(t)), Of(xv, e);
      }
    }
    function Tv(t, e, n) {
      t === "focusin" ? (Qf(), Di = e, zi = n, Di.attachEvent("onpropertychange", Jf)) : t === "focusout" && Qf();
    }
    function Av(t) {
      if (t === "selectionchange" || t === "keyup" || t === "keydown") return Yl(zi);
    }
    function Ev(t, e) {
      if (t === "click") return Yl(e);
    }
    function Mv(t, e) {
      if (t === "input" || t === "change") return Yl(e);
    }
    function Cv(t, e) {
      return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
    }
    var xe = typeof Object.is == "function" ? Object.is : Cv;
    function Ri(t, e) {
      if (xe(t, e)) return true;
      if (typeof t != "object" || t === null || typeof e != "object" || e === null) return false;
      var n = Object.keys(t), i = Object.keys(e);
      if (n.length !== i.length) return false;
      for (i = 0; i < n.length; i++) {
        var s = n[i];
        if (!vu.call(e, s) || !xe(t[s], e[s])) return false;
      }
      return true;
    }
    function Ff(t) {
      for (; t && t.firstChild; ) t = t.firstChild;
      return t;
    }
    function Pf(t, e) {
      var n = Ff(t);
      t = 0;
      for (var i; n; ) {
        if (n.nodeType === 3) {
          if (i = t + n.textContent.length, t <= e && i >= e) return {
            node: n,
            offset: e - t
          };
          t = i;
        }
        t: {
          for (; n; ) {
            if (n.nextSibling) {
              n = n.nextSibling;
              break t;
            }
            n = n.parentNode;
          }
          n = void 0;
        }
        n = Ff(n);
      }
    }
    function Wf(t, e) {
      return t && e ? t === e ? true : t && t.nodeType === 3 ? false : e && e.nodeType === 3 ? Wf(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : false : false;
    }
    function $f(t) {
      t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
      for (var e = wl(t.document); e instanceof t.HTMLIFrameElement; ) {
        try {
          var n = typeof e.contentWindow.location.href == "string";
        } catch {
          n = false;
        }
        if (n) t = e.contentWindow;
        else break;
        e = wl(t.document);
      }
      return e;
    }
    function Gu(t) {
      var e = t && t.nodeName && t.nodeName.toLowerCase();
      return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
    }
    var Dv = nn && "documentMode" in document && 11 >= document.documentMode, Oa = null, Xu = null, ji = null, ku = false;
    function If(t, e, n) {
      var i = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
      ku || Oa == null || Oa !== wl(i) || (i = Oa, "selectionStart" in i && Gu(i) ? i = {
        start: i.selectionStart,
        end: i.selectionEnd
      } : (i = (i.ownerDocument && i.ownerDocument.defaultView || window).getSelection(), i = {
        anchorNode: i.anchorNode,
        anchorOffset: i.anchorOffset,
        focusNode: i.focusNode,
        focusOffset: i.focusOffset
      }), ji && Ri(ji, i) || (ji = i, i = Rs(Xu, "onSelect"), 0 < i.length && (e = new Hl("onSelect", "select", null, e, n), t.push({
        event: e,
        listeners: i
      }), e.target = Oa)));
    }
    function ta(t, e) {
      var n = {};
      return n[t.toLowerCase()] = e.toLowerCase(), n["Webkit" + t] = "webkit" + e, n["Moz" + t] = "moz" + e, n;
    }
    var Na = {
      animationend: ta("Animation", "AnimationEnd"),
      animationiteration: ta("Animation", "AnimationIteration"),
      animationstart: ta("Animation", "AnimationStart"),
      transitionrun: ta("Transition", "TransitionRun"),
      transitionstart: ta("Transition", "TransitionStart"),
      transitioncancel: ta("Transition", "TransitionCancel"),
      transitionend: ta("Transition", "TransitionEnd")
    }, Zu = {}, th = {};
    nn && (th = document.createElement("div").style, "AnimationEvent" in window || (delete Na.animationend.animation, delete Na.animationiteration.animation, delete Na.animationstart.animation), "TransitionEvent" in window || delete Na.transitionend.transition);
    function ea(t) {
      if (Zu[t]) return Zu[t];
      if (!Na[t]) return t;
      var e = Na[t], n;
      for (n in e) if (e.hasOwnProperty(n) && n in th) return Zu[t] = e[n];
      return t;
    }
    var eh = ea("animationend"), nh = ea("animationiteration"), ah = ea("animationstart"), zv = ea("transitionrun"), Rv = ea("transitionstart"), jv = ea("transitioncancel"), ih = ea("transitionend"), lh = /* @__PURE__ */ new Map(), Ku = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
    Ku.push("scrollEnd");
    function Ye(t, e) {
      lh.set(t, e), $n(e, [
        t
      ]);
    }
    var Gl = typeof reportError == "function" ? reportError : function(t) {
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
    }, Oe = [], _a = 0, Qu = 0;
    function Xl() {
      for (var t = _a, e = Qu = _a = 0; e < t; ) {
        var n = Oe[e];
        Oe[e++] = null;
        var i = Oe[e];
        Oe[e++] = null;
        var s = Oe[e];
        Oe[e++] = null;
        var r = Oe[e];
        if (Oe[e++] = null, i !== null && s !== null) {
          var h = i.pending;
          h === null ? s.next = s : (s.next = h.next, h.next = s), i.pending = s;
        }
        r !== 0 && sh(n, s, r);
      }
    }
    function kl(t, e, n, i) {
      Oe[_a++] = t, Oe[_a++] = e, Oe[_a++] = n, Oe[_a++] = i, Qu |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
    }
    function Ju(t, e, n, i) {
      return kl(t, e, n, i), Zl(t);
    }
    function na(t, e) {
      return kl(t, null, null, e), Zl(t);
    }
    function sh(t, e, n) {
      t.lanes |= n;
      var i = t.alternate;
      i !== null && (i.lanes |= n);
      for (var s = false, r = t.return; r !== null; ) r.childLanes |= n, i = r.alternate, i !== null && (i.childLanes |= n), r.tag === 22 && (t = r.stateNode, t === null || t._visibility & 1 || (s = true)), t = r, r = r.return;
      return t.tag === 3 ? (r = t.stateNode, s && e !== null && (s = 31 - Se(n), t = r.hiddenUpdates, i = t[s], i === null ? t[s] = [
        e
      ] : i.push(e), e.lane = n | 536870912), r) : null;
    }
    function Zl(t) {
      if (50 < $i) throw $i = 0, ir = null, Error(o(185));
      for (var e = t.return; e !== null; ) t = e, e = t.return;
      return t.tag === 3 ? t.stateNode : null;
    }
    var wa = {};
    function Ov(t, e, n, i) {
      this.tag = t, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
    }
    function Te(t, e, n, i) {
      return new Ov(t, e, n, i);
    }
    function Fu(t) {
      return t = t.prototype, !(!t || !t.isReactComponent);
    }
    function an(t, e) {
      var n = t.alternate;
      return n === null ? (n = Te(t.tag, e, t.key, t.mode), n.elementType = t.elementType, n.type = t.type, n.stateNode = t.stateNode, n.alternate = t, t.alternate = n) : (n.pendingProps = e, n.type = t.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = t.flags & 65011712, n.childLanes = t.childLanes, n.lanes = t.lanes, n.child = t.child, n.memoizedProps = t.memoizedProps, n.memoizedState = t.memoizedState, n.updateQueue = t.updateQueue, e = t.dependencies, n.dependencies = e === null ? null : {
        lanes: e.lanes,
        firstContext: e.firstContext
      }, n.sibling = t.sibling, n.index = t.index, n.ref = t.ref, n.refCleanup = t.refCleanup, n;
    }
    function uh(t, e) {
      t.flags &= 65011714;
      var n = t.alternate;
      return n === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = n.childLanes, t.lanes = n.lanes, t.child = n.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = n.memoizedProps, t.memoizedState = n.memoizedState, t.updateQueue = n.updateQueue, t.type = n.type, e = n.dependencies, t.dependencies = e === null ? null : {
        lanes: e.lanes,
        firstContext: e.firstContext
      }), t;
    }
    function Kl(t, e, n, i, s, r) {
      var h = 0;
      if (i = t, typeof t == "function") Fu(t) && (h = 1);
      else if (typeof t == "string") h = U1(t, n, P.current) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
      else t: switch (t) {
        case it:
          return t = Te(31, n, e, s), t.elementType = it, t.lanes = r, t;
        case q:
          return aa(n.children, s, r, e);
        case Y:
          h = 8, s |= 24;
          break;
        case G:
          return t = Te(12, n, e, s | 2), t.elementType = G, t.lanes = r, t;
        case $:
          return t = Te(13, n, e, s), t.elementType = $, t.lanes = r, t;
        case st:
          return t = Te(19, n, e, s), t.elementType = st, t.lanes = r, t;
        default:
          if (typeof t == "object" && t !== null) switch (t.$$typeof) {
            case X:
              h = 10;
              break t;
            case K:
              h = 9;
              break t;
            case Z:
              h = 11;
              break t;
            case et:
              h = 14;
              break t;
            case J:
              h = 16, i = null;
              break t;
          }
          h = 29, n = Error(o(130, t === null ? "null" : typeof t, "")), i = null;
      }
      return e = Te(h, n, e, s), e.elementType = t, e.type = i, e.lanes = r, e;
    }
    function aa(t, e, n, i) {
      return t = Te(7, t, i, e), t.lanes = n, t;
    }
    function Pu(t, e, n) {
      return t = Te(6, t, null, e), t.lanes = n, t;
    }
    function oh(t) {
      var e = Te(18, null, null, 0);
      return e.stateNode = t, e;
    }
    function Wu(t, e, n) {
      return e = Te(4, t.children !== null ? t.children : [], t.key, e), e.lanes = n, e.stateNode = {
        containerInfo: t.containerInfo,
        pendingChildren: null,
        implementation: t.implementation
      }, e;
    }
    var rh = /* @__PURE__ */ new WeakMap();
    function Ne(t, e) {
      if (typeof t == "object" && t !== null) {
        var n = rh.get(t);
        return n !== void 0 ? n : (e = {
          value: t,
          source: e,
          stack: of(e)
        }, rh.set(t, e), e);
      }
      return {
        value: t,
        source: e,
        stack: of(e)
      };
    }
    var Va = [], Ua = 0, Ql = null, Oi = 0, _e = [], we = 0, Tn = null, Qe = 1, Je = "";
    function ln(t, e) {
      Va[Ua++] = Oi, Va[Ua++] = Ql, Ql = t, Oi = e;
    }
    function ch(t, e, n) {
      _e[we++] = Qe, _e[we++] = Je, _e[we++] = Tn, Tn = t;
      var i = Qe;
      t = Je;
      var s = 32 - Se(i) - 1;
      i &= ~(1 << s), n += 1;
      var r = 32 - Se(e) + s;
      if (30 < r) {
        var h = s - s % 5;
        r = (i & (1 << h) - 1).toString(32), i >>= h, s -= h, Qe = 1 << 32 - Se(e) + s | n << s | i, Je = r + t;
      } else Qe = 1 << r | n << s | i, Je = t;
    }
    function $u(t) {
      t.return !== null && (ln(t, 1), ch(t, 1, 0));
    }
    function Iu(t) {
      for (; t === Ql; ) Ql = Va[--Ua], Va[Ua] = null, Oi = Va[--Ua], Va[Ua] = null;
      for (; t === Tn; ) Tn = _e[--we], _e[we] = null, Je = _e[--we], _e[we] = null, Qe = _e[--we], _e[we] = null;
    }
    function fh(t, e) {
      _e[we++] = Qe, _e[we++] = Je, _e[we++] = Tn, Qe = e.id, Je = e.overflow, Tn = t;
    }
    var te = null, Ot = null, vt = false, An = null, Ve = false, to = Error(o(519));
    function En(t) {
      var e = Error(o(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", ""));
      throw Ni(Ne(e, t)), to;
    }
    function hh(t) {
      var e = t.stateNode, n = t.type, i = t.memoizedProps;
      switch (e[It] = t, e[fe] = i, n) {
        case "dialog":
          mt("cancel", e), mt("close", e);
          break;
        case "iframe":
        case "object":
        case "embed":
          mt("load", e);
          break;
        case "video":
        case "audio":
          for (n = 0; n < tl.length; n++) mt(tl[n], e);
          break;
        case "source":
          mt("error", e);
          break;
        case "img":
        case "image":
        case "link":
          mt("error", e), mt("load", e);
          break;
        case "details":
          mt("toggle", e);
          break;
        case "input":
          mt("invalid", e), Mf(e, i.value, i.defaultValue, i.checked, i.defaultChecked, i.type, i.name, true);
          break;
        case "select":
          mt("invalid", e);
          break;
        case "textarea":
          mt("invalid", e), Df(e, i.value, i.defaultValue, i.children);
      }
      n = i.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || e.textContent === "" + n || i.suppressHydrationWarning === true || Rm(e.textContent, n) ? (i.popover != null && (mt("beforetoggle", e), mt("toggle", e)), i.onScroll != null && mt("scroll", e), i.onScrollEnd != null && mt("scrollend", e), i.onClick != null && (e.onclick = en), e = true) : e = false, e || En(t, true);
    }
    function dh(t) {
      for (te = t.return; te; ) switch (te.tag) {
        case 5:
        case 31:
        case 13:
          Ve = false;
          return;
        case 27:
        case 3:
          Ve = true;
          return;
        default:
          te = te.return;
      }
    }
    function Ba(t) {
      if (t !== te) return false;
      if (!vt) return dh(t), vt = true, false;
      var e = t.tag, n;
      if ((n = e !== 3 && e !== 27) && ((n = e === 5) && (n = t.type, n = !(n !== "form" && n !== "button") || br(t.type, t.memoizedProps)), n = !n), n && Ot && En(t), dh(t), e === 13) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Ot = Lm(t);
      } else if (e === 31) {
        if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
        Ot = Lm(t);
      } else e === 27 ? (e = Ot, Ln(t.type) ? (t = Er, Er = null, Ot = t) : Ot = e) : Ot = te ? Be(t.stateNode.nextSibling) : null;
      return true;
    }
    function ia() {
      Ot = te = null, vt = false;
    }
    function eo() {
      var t = An;
      return t !== null && (ye === null ? ye = t : ye.push.apply(ye, t), An = null), t;
    }
    function Ni(t) {
      An === null ? An = [
        t
      ] : An.push(t);
    }
    var no = A(null), la = null, sn = null;
    function Mn(t, e, n) {
      Q(no, e._currentValue), e._currentValue = n;
    }
    function un(t) {
      t._currentValue = no.current, B(no);
    }
    function ao(t, e, n) {
      for (; t !== null; ) {
        var i = t.alternate;
        if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === n) break;
        t = t.return;
      }
    }
    function io(t, e, n, i) {
      var s = t.child;
      for (s !== null && (s.return = t); s !== null; ) {
        var r = s.dependencies;
        if (r !== null) {
          var h = s.child;
          r = r.firstContext;
          t: for (; r !== null; ) {
            var g = r;
            r = s;
            for (var T = 0; T < e.length; T++) if (g.context === e[T]) {
              r.lanes |= n, g = r.alternate, g !== null && (g.lanes |= n), ao(r.return, n, t), i || (h = null);
              break t;
            }
            r = g.next;
          }
        } else if (s.tag === 18) {
          if (h = s.return, h === null) throw Error(o(341));
          h.lanes |= n, r = h.alternate, r !== null && (r.lanes |= n), ao(h, n, t), h = null;
        } else h = s.child;
        if (h !== null) h.return = s;
        else for (h = s; h !== null; ) {
          if (h === t) {
            h = null;
            break;
          }
          if (s = h.sibling, s !== null) {
            s.return = h.return, h = s;
            break;
          }
          h = h.return;
        }
        s = h;
      }
    }
    function La(t, e, n, i) {
      t = null;
      for (var s = e, r = false; s !== null; ) {
        if (!r) {
          if ((s.flags & 524288) !== 0) r = true;
          else if ((s.flags & 262144) !== 0) break;
        }
        if (s.tag === 10) {
          var h = s.alternate;
          if (h === null) throw Error(o(387));
          if (h = h.memoizedProps, h !== null) {
            var g = s.type;
            xe(s.pendingProps.value, h.value) || (t !== null ? t.push(g) : t = [
              g
            ]);
          }
        } else if (s === Tt.current) {
          if (h = s.alternate, h === null) throw Error(o(387));
          h.memoizedState.memoizedState !== s.memoizedState.memoizedState && (t !== null ? t.push(ll) : t = [
            ll
          ]);
        }
        s = s.return;
      }
      t !== null && io(e, t, n, i), e.flags |= 262144;
    }
    function Jl(t) {
      for (t = t.firstContext; t !== null; ) {
        if (!xe(t.context._currentValue, t.memoizedValue)) return true;
        t = t.next;
      }
      return false;
    }
    function sa(t) {
      la = t, sn = null, t = t.dependencies, t !== null && (t.firstContext = null);
    }
    function ee(t) {
      return mh(la, t);
    }
    function Fl(t, e) {
      return la === null && sa(t), mh(t, e);
    }
    function mh(t, e) {
      var n = e._currentValue;
      if (e = {
        context: e,
        memoizedValue: n,
        next: null
      }, sn === null) {
        if (t === null) throw Error(o(308));
        sn = e, t.dependencies = {
          lanes: 0,
          firstContext: e
        }, t.flags |= 524288;
      } else sn = sn.next = e;
      return n;
    }
    var Nv = typeof AbortController < "u" ? AbortController : function() {
      var t = [], e = this.signal = {
        aborted: false,
        addEventListener: function(n, i) {
          t.push(i);
        }
      };
      this.abort = function() {
        e.aborted = true, t.forEach(function(n) {
          return n();
        });
      };
    }, _v = a.unstable_scheduleCallback, wv = a.unstable_NormalPriority, kt = {
      $$typeof: X,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0
    };
    function lo() {
      return {
        controller: new Nv(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function _i(t) {
      t.refCount--, t.refCount === 0 && _v(wv, function() {
        t.controller.abort();
      });
    }
    var wi = null, so = 0, Ha = 0, qa = null;
    function Vv(t, e) {
      if (wi === null) {
        var n = wi = [];
        so = 0, Ha = cr(), qa = {
          status: "pending",
          value: void 0,
          then: function(i) {
            n.push(i);
          }
        };
      }
      return so++, e.then(ph, ph), e;
    }
    function ph() {
      if (--so === 0 && wi !== null) {
        qa !== null && (qa.status = "fulfilled");
        var t = wi;
        wi = null, Ha = 0, qa = null;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
    }
    function Uv(t, e) {
      var n = [], i = {
        status: "pending",
        value: null,
        reason: null,
        then: function(s) {
          n.push(s);
        }
      };
      return t.then(function() {
        i.status = "fulfilled", i.value = e;
        for (var s = 0; s < n.length; s++) (0, n[s])(e);
      }, function(s) {
        for (i.status = "rejected", i.reason = s, s = 0; s < n.length; s++) (0, n[s])(void 0);
      }), i;
    }
    var yh = x.S;
    x.S = function(t, e) {
      Id = ve(), typeof e == "object" && e !== null && typeof e.then == "function" && Vv(t, e), yh !== null && yh(t, e);
    };
    var ua = A(null);
    function uo() {
      var t = ua.current;
      return t !== null ? t : zt.pooledCache;
    }
    function Pl(t, e) {
      e === null ? Q(ua, ua.current) : Q(ua, e.pool);
    }
    function gh() {
      var t = uo();
      return t === null ? null : {
        parent: kt._currentValue,
        pool: t
      };
    }
    var Ya = Error(o(460)), oo = Error(o(474)), Wl = Error(o(542)), $l = {
      then: function() {
      }
    };
    function vh(t) {
      return t = t.status, t === "fulfilled" || t === "rejected";
    }
    function bh(t, e, n) {
      switch (n = t[n], n === void 0 ? t.push(e) : n !== e && (e.then(en, en), e = n), e.status) {
        case "fulfilled":
          return e.value;
        case "rejected":
          throw t = e.reason, xh(t), t;
        default:
          if (typeof e.status == "string") e.then(en, en);
          else {
            if (t = zt, t !== null && 100 < t.shellSuspendCounter) throw Error(o(482));
            t = e, t.status = "pending", t.then(function(i) {
              if (e.status === "pending") {
                var s = e;
                s.status = "fulfilled", s.value = i;
              }
            }, function(i) {
              if (e.status === "pending") {
                var s = e;
                s.status = "rejected", s.reason = i;
              }
            });
          }
          switch (e.status) {
            case "fulfilled":
              return e.value;
            case "rejected":
              throw t = e.reason, xh(t), t;
          }
          throw ra = e, Ya;
      }
    }
    function oa(t) {
      try {
        var e = t._init;
        return e(t._payload);
      } catch (n) {
        throw n !== null && typeof n == "object" && typeof n.then == "function" ? (ra = n, Ya) : n;
      }
    }
    var ra = null;
    function Sh() {
      if (ra === null) throw Error(o(459));
      var t = ra;
      return ra = null, t;
    }
    function xh(t) {
      if (t === Ya || t === Wl) throw Error(o(483));
    }
    var Ga = null, Vi = 0;
    function Il(t) {
      var e = Vi;
      return Vi += 1, Ga === null && (Ga = []), bh(Ga, t, e);
    }
    function Ui(t, e) {
      e = e.props.ref, t.ref = e !== void 0 ? e : null;
    }
    function ts(t, e) {
      throw e.$$typeof === S ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(o(31, t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t)));
    }
    function Th(t) {
      function e(C, M) {
        if (t) {
          var z = C.deletions;
          z === null ? (C.deletions = [
            M
          ], C.flags |= 16) : z.push(M);
        }
      }
      function n(C, M) {
        if (!t) return null;
        for (; M !== null; ) e(C, M), M = M.sibling;
        return null;
      }
      function i(C) {
        for (var M = /* @__PURE__ */ new Map(); C !== null; ) C.key !== null ? M.set(C.key, C) : M.set(C.index, C), C = C.sibling;
        return M;
      }
      function s(C, M) {
        return C = an(C, M), C.index = 0, C.sibling = null, C;
      }
      function r(C, M, z) {
        return C.index = z, t ? (z = C.alternate, z !== null ? (z = z.index, z < M ? (C.flags |= 67108866, M) : z) : (C.flags |= 67108866, M)) : (C.flags |= 1048576, M);
      }
      function h(C) {
        return t && C.alternate === null && (C.flags |= 67108866), C;
      }
      function g(C, M, z, U) {
        return M === null || M.tag !== 6 ? (M = Pu(z, C.mode, U), M.return = C, M) : (M = s(M, z), M.return = C, M);
      }
      function T(C, M, z, U) {
        var at = z.type;
        return at === q ? V(C, M, z.props.children, U, z.key) : M !== null && (M.elementType === at || typeof at == "object" && at !== null && at.$$typeof === J && oa(at) === M.type) ? (M = s(M, z.props), Ui(M, z), M.return = C, M) : (M = Kl(z.type, z.key, z.props, null, C.mode, U), Ui(M, z), M.return = C, M);
      }
      function R(C, M, z, U) {
        return M === null || M.tag !== 4 || M.stateNode.containerInfo !== z.containerInfo || M.stateNode.implementation !== z.implementation ? (M = Wu(z, C.mode, U), M.return = C, M) : (M = s(M, z.children || []), M.return = C, M);
      }
      function V(C, M, z, U, at) {
        return M === null || M.tag !== 7 ? (M = aa(z, C.mode, U, at), M.return = C, M) : (M = s(M, z), M.return = C, M);
      }
      function H(C, M, z) {
        if (typeof M == "string" && M !== "" || typeof M == "number" || typeof M == "bigint") return M = Pu("" + M, C.mode, z), M.return = C, M;
        if (typeof M == "object" && M !== null) {
          switch (M.$$typeof) {
            case D:
              return z = Kl(M.type, M.key, M.props, null, C.mode, z), Ui(z, M), z.return = C, z;
            case N:
              return M = Wu(M, C.mode, z), M.return = C, M;
            case J:
              return M = oa(M), H(C, M, z);
          }
          if (jt(M) || pt(M)) return M = aa(M, C.mode, z, null), M.return = C, M;
          if (typeof M.then == "function") return H(C, Il(M), z);
          if (M.$$typeof === X) return H(C, Fl(C, M), z);
          ts(C, M);
        }
        return null;
      }
      function j(C, M, z, U) {
        var at = M !== null ? M.key : null;
        if (typeof z == "string" && z !== "" || typeof z == "number" || typeof z == "bigint") return at !== null ? null : g(C, M, "" + z, U);
        if (typeof z == "object" && z !== null) {
          switch (z.$$typeof) {
            case D:
              return z.key === at ? T(C, M, z, U) : null;
            case N:
              return z.key === at ? R(C, M, z, U) : null;
            case J:
              return z = oa(z), j(C, M, z, U);
          }
          if (jt(z) || pt(z)) return at !== null ? null : V(C, M, z, U, null);
          if (typeof z.then == "function") return j(C, M, Il(z), U);
          if (z.$$typeof === X) return j(C, M, Fl(C, z), U);
          ts(C, z);
        }
        return null;
      }
      function _(C, M, z, U, at) {
        if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint") return C = C.get(z) || null, g(M, C, "" + U, at);
        if (typeof U == "object" && U !== null) {
          switch (U.$$typeof) {
            case D:
              return C = C.get(U.key === null ? z : U.key) || null, T(M, C, U, at);
            case N:
              return C = C.get(U.key === null ? z : U.key) || null, R(M, C, U, at);
            case J:
              return U = oa(U), _(C, M, z, U, at);
          }
          if (jt(U) || pt(U)) return C = C.get(z) || null, V(M, C, U, at, null);
          if (typeof U.then == "function") return _(C, M, z, Il(U), at);
          if (U.$$typeof === X) return _(C, M, z, Fl(M, U), at);
          ts(M, U);
        }
        return null;
      }
      function W(C, M, z, U) {
        for (var at = null, bt = null, nt = M, ct = M = 0, gt = null; nt !== null && ct < z.length; ct++) {
          nt.index > ct ? (gt = nt, nt = null) : gt = nt.sibling;
          var St = j(C, nt, z[ct], U);
          if (St === null) {
            nt === null && (nt = gt);
            break;
          }
          t && nt && St.alternate === null && e(C, nt), M = r(St, M, ct), bt === null ? at = St : bt.sibling = St, bt = St, nt = gt;
        }
        if (ct === z.length) return n(C, nt), vt && ln(C, ct), at;
        if (nt === null) {
          for (; ct < z.length; ct++) nt = H(C, z[ct], U), nt !== null && (M = r(nt, M, ct), bt === null ? at = nt : bt.sibling = nt, bt = nt);
          return vt && ln(C, ct), at;
        }
        for (nt = i(nt); ct < z.length; ct++) gt = _(nt, C, ct, z[ct], U), gt !== null && (t && gt.alternate !== null && nt.delete(gt.key === null ? ct : gt.key), M = r(gt, M, ct), bt === null ? at = gt : bt.sibling = gt, bt = gt);
        return t && nt.forEach(function(Xn) {
          return e(C, Xn);
        }), vt && ln(C, ct), at;
      }
      function lt(C, M, z, U) {
        if (z == null) throw Error(o(151));
        for (var at = null, bt = null, nt = M, ct = M = 0, gt = null, St = z.next(); nt !== null && !St.done; ct++, St = z.next()) {
          nt.index > ct ? (gt = nt, nt = null) : gt = nt.sibling;
          var Xn = j(C, nt, St.value, U);
          if (Xn === null) {
            nt === null && (nt = gt);
            break;
          }
          t && nt && Xn.alternate === null && e(C, nt), M = r(Xn, M, ct), bt === null ? at = Xn : bt.sibling = Xn, bt = Xn, nt = gt;
        }
        if (St.done) return n(C, nt), vt && ln(C, ct), at;
        if (nt === null) {
          for (; !St.done; ct++, St = z.next()) St = H(C, St.value, U), St !== null && (M = r(St, M, ct), bt === null ? at = St : bt.sibling = St, bt = St);
          return vt && ln(C, ct), at;
        }
        for (nt = i(nt); !St.done; ct++, St = z.next()) St = _(nt, C, ct, St.value, U), St !== null && (t && St.alternate !== null && nt.delete(St.key === null ? ct : St.key), M = r(St, M, ct), bt === null ? at = St : bt.sibling = St, bt = St);
        return t && nt.forEach(function(Q1) {
          return e(C, Q1);
        }), vt && ln(C, ct), at;
      }
      function Dt(C, M, z, U) {
        if (typeof z == "object" && z !== null && z.type === q && z.key === null && (z = z.props.children), typeof z == "object" && z !== null) {
          switch (z.$$typeof) {
            case D:
              t: {
                for (var at = z.key; M !== null; ) {
                  if (M.key === at) {
                    if (at = z.type, at === q) {
                      if (M.tag === 7) {
                        n(C, M.sibling), U = s(M, z.props.children), U.return = C, C = U;
                        break t;
                      }
                    } else if (M.elementType === at || typeof at == "object" && at !== null && at.$$typeof === J && oa(at) === M.type) {
                      n(C, M.sibling), U = s(M, z.props), Ui(U, z), U.return = C, C = U;
                      break t;
                    }
                    n(C, M);
                    break;
                  } else e(C, M);
                  M = M.sibling;
                }
                z.type === q ? (U = aa(z.props.children, C.mode, U, z.key), U.return = C, C = U) : (U = Kl(z.type, z.key, z.props, null, C.mode, U), Ui(U, z), U.return = C, C = U);
              }
              return h(C);
            case N:
              t: {
                for (at = z.key; M !== null; ) {
                  if (M.key === at) if (M.tag === 4 && M.stateNode.containerInfo === z.containerInfo && M.stateNode.implementation === z.implementation) {
                    n(C, M.sibling), U = s(M, z.children || []), U.return = C, C = U;
                    break t;
                  } else {
                    n(C, M);
                    break;
                  }
                  else e(C, M);
                  M = M.sibling;
                }
                U = Wu(z, C.mode, U), U.return = C, C = U;
              }
              return h(C);
            case J:
              return z = oa(z), Dt(C, M, z, U);
          }
          if (jt(z)) return W(C, M, z, U);
          if (pt(z)) {
            if (at = pt(z), typeof at != "function") throw Error(o(150));
            return z = at.call(z), lt(C, M, z, U);
          }
          if (typeof z.then == "function") return Dt(C, M, Il(z), U);
          if (z.$$typeof === X) return Dt(C, M, Fl(C, z), U);
          ts(C, z);
        }
        return typeof z == "string" && z !== "" || typeof z == "number" || typeof z == "bigint" ? (z = "" + z, M !== null && M.tag === 6 ? (n(C, M.sibling), U = s(M, z), U.return = C, C = U) : (n(C, M), U = Pu(z, C.mode, U), U.return = C, C = U), h(C)) : n(C, M);
      }
      return function(C, M, z, U) {
        try {
          Vi = 0;
          var at = Dt(C, M, z, U);
          return Ga = null, at;
        } catch (nt) {
          if (nt === Ya || nt === Wl) throw nt;
          var bt = Te(29, nt, null, C.mode);
          return bt.lanes = U, bt.return = C, bt;
        } finally {
        }
      };
    }
    var ca = Th(true), Ah = Th(false), Cn = false;
    function ro(t) {
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
    function co(t, e) {
      t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
        baseState: t.baseState,
        firstBaseUpdate: t.firstBaseUpdate,
        lastBaseUpdate: t.lastBaseUpdate,
        shared: t.shared,
        callbacks: null
      });
    }
    function Dn(t) {
      return {
        lane: t,
        tag: 0,
        payload: null,
        callback: null,
        next: null
      };
    }
    function zn(t, e, n) {
      var i = t.updateQueue;
      if (i === null) return null;
      if (i = i.shared, (xt & 2) !== 0) {
        var s = i.pending;
        return s === null ? e.next = e : (e.next = s.next, s.next = e), i.pending = e, e = Zl(t), sh(t, null, n), e;
      }
      return kl(t, i, e, n), Zl(t);
    }
    function Bi(t, e, n) {
      if (e = e.updateQueue, e !== null && (e = e.shared, (n & 4194048) !== 0)) {
        var i = e.lanes;
        i &= t.pendingLanes, n |= i, e.lanes = n, mf(t, n);
      }
    }
    function fo(t, e) {
      var n = t.updateQueue, i = t.alternate;
      if (i !== null && (i = i.updateQueue, n === i)) {
        var s = null, r = null;
        if (n = n.firstBaseUpdate, n !== null) {
          do {
            var h = {
              lane: n.lane,
              tag: n.tag,
              payload: n.payload,
              callback: null,
              next: null
            };
            r === null ? s = r = h : r = r.next = h, n = n.next;
          } while (n !== null);
          r === null ? s = r = e : r = r.next = e;
        } else s = r = e;
        n = {
          baseState: i.baseState,
          firstBaseUpdate: s,
          lastBaseUpdate: r,
          shared: i.shared,
          callbacks: i.callbacks
        }, t.updateQueue = n;
        return;
      }
      t = n.lastBaseUpdate, t === null ? n.firstBaseUpdate = e : t.next = e, n.lastBaseUpdate = e;
    }
    var ho = false;
    function Li() {
      if (ho) {
        var t = qa;
        if (t !== null) throw t;
      }
    }
    function Hi(t, e, n, i) {
      ho = false;
      var s = t.updateQueue;
      Cn = false;
      var r = s.firstBaseUpdate, h = s.lastBaseUpdate, g = s.shared.pending;
      if (g !== null) {
        s.shared.pending = null;
        var T = g, R = T.next;
        T.next = null, h === null ? r = R : h.next = R, h = T;
        var V = t.alternate;
        V !== null && (V = V.updateQueue, g = V.lastBaseUpdate, g !== h && (g === null ? V.firstBaseUpdate = R : g.next = R, V.lastBaseUpdate = T));
      }
      if (r !== null) {
        var H = s.baseState;
        h = 0, V = R = T = null, g = r;
        do {
          var j = g.lane & -536870913, _ = j !== g.lane;
          if (_ ? (yt & j) === j : (i & j) === j) {
            j !== 0 && j === Ha && (ho = true), V !== null && (V = V.next = {
              lane: 0,
              tag: g.tag,
              payload: g.payload,
              callback: null,
              next: null
            });
            t: {
              var W = t, lt = g;
              j = e;
              var Dt = n;
              switch (lt.tag) {
                case 1:
                  if (W = lt.payload, typeof W == "function") {
                    H = W.call(Dt, H, j);
                    break t;
                  }
                  H = W;
                  break t;
                case 3:
                  W.flags = W.flags & -65537 | 128;
                case 0:
                  if (W = lt.payload, j = typeof W == "function" ? W.call(Dt, H, j) : W, j == null) break t;
                  H = b({}, H, j);
                  break t;
                case 2:
                  Cn = true;
              }
            }
            j = g.callback, j !== null && (t.flags |= 64, _ && (t.flags |= 8192), _ = s.callbacks, _ === null ? s.callbacks = [
              j
            ] : _.push(j));
          } else _ = {
            lane: j,
            tag: g.tag,
            payload: g.payload,
            callback: g.callback,
            next: null
          }, V === null ? (R = V = _, T = H) : V = V.next = _, h |= j;
          if (g = g.next, g === null) {
            if (g = s.shared.pending, g === null) break;
            _ = g, g = _.next, _.next = null, s.lastBaseUpdate = _, s.shared.pending = null;
          }
        } while (true);
        V === null && (T = H), s.baseState = T, s.firstBaseUpdate = R, s.lastBaseUpdate = V, r === null && (s.shared.lanes = 0), _n |= h, t.lanes = h, t.memoizedState = H;
      }
    }
    function Eh(t, e) {
      if (typeof t != "function") throw Error(o(191, t));
      t.call(e);
    }
    function Mh(t, e) {
      var n = t.callbacks;
      if (n !== null) for (t.callbacks = null, t = 0; t < n.length; t++) Eh(n[t], e);
    }
    var Xa = A(null), es = A(0);
    function Ch(t, e) {
      t = yn, Q(es, t), Q(Xa, e), yn = t | e.baseLanes;
    }
    function mo() {
      Q(es, yn), Q(Xa, Xa.current);
    }
    function po() {
      yn = es.current, B(Xa), B(es);
    }
    var Ae = A(null), Ue = null;
    function Rn(t) {
      var e = t.alternate;
      Q(Gt, Gt.current & 1), Q(Ae, t), Ue === null && (e === null || Xa.current !== null || e.memoizedState !== null) && (Ue = t);
    }
    function yo(t) {
      Q(Gt, Gt.current), Q(Ae, t), Ue === null && (Ue = t);
    }
    function Dh(t) {
      t.tag === 22 ? (Q(Gt, Gt.current), Q(Ae, t), Ue === null && (Ue = t)) : jn();
    }
    function jn() {
      Q(Gt, Gt.current), Q(Ae, Ae.current);
    }
    function Ee(t) {
      B(Ae), Ue === t && (Ue = null), B(Gt);
    }
    var Gt = A(0);
    function ns(t) {
      for (var e = t; e !== null; ) {
        if (e.tag === 13) {
          var n = e.memoizedState;
          if (n !== null && (n = n.dehydrated, n === null || Tr(n) || Ar(n))) return e;
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
    var on = 0, rt = null, Mt = null, Zt = null, as = false, ka = false, fa = false, is = 0, qi = 0, Za = null, Bv = 0;
    function Lt() {
      throw Error(o(321));
    }
    function go(t, e) {
      if (e === null) return false;
      for (var n = 0; n < e.length && n < t.length; n++) if (!xe(t[n], e[n])) return false;
      return true;
    }
    function vo(t, e, n, i, s, r) {
      return on = r, rt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, x.H = t === null || t.memoizedState === null ? cd : _o, fa = false, r = n(i, s), fa = false, ka && (r = Rh(e, n, i, s)), zh(t), r;
    }
    function zh(t) {
      x.H = Xi;
      var e = Mt !== null && Mt.next !== null;
      if (on = 0, Zt = Mt = rt = null, as = false, qi = 0, Za = null, e) throw Error(o(300));
      t === null || Kt || (t = t.dependencies, t !== null && Jl(t) && (Kt = true));
    }
    function Rh(t, e, n, i) {
      rt = t;
      var s = 0;
      do {
        if (ka && (Za = null), qi = 0, ka = false, 25 <= s) throw Error(o(301));
        if (s += 1, Zt = Mt = null, t.updateQueue != null) {
          var r = t.updateQueue;
          r.lastEffect = null, r.events = null, r.stores = null, r.memoCache != null && (r.memoCache.index = 0);
        }
        x.H = fd, r = e(n, i);
      } while (ka);
      return r;
    }
    function Lv() {
      var t = x.H, e = t.useState()[0];
      return e = typeof e.then == "function" ? Yi(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (rt.flags |= 1024), e;
    }
    function bo() {
      var t = is !== 0;
      return is = 0, t;
    }
    function So(t, e, n) {
      e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~n;
    }
    function xo(t) {
      if (as) {
        for (t = t.memoizedState; t !== null; ) {
          var e = t.queue;
          e !== null && (e.pending = null), t = t.next;
        }
        as = false;
      }
      on = 0, Zt = Mt = rt = null, ka = false, qi = is = 0, Za = null;
    }
    function oe() {
      var t = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
      };
      return Zt === null ? rt.memoizedState = Zt = t : Zt = Zt.next = t, Zt;
    }
    function Xt() {
      if (Mt === null) {
        var t = rt.alternate;
        t = t !== null ? t.memoizedState : null;
      } else t = Mt.next;
      var e = Zt === null ? rt.memoizedState : Zt.next;
      if (e !== null) Zt = e, Mt = t;
      else {
        if (t === null) throw rt.alternate === null ? Error(o(467)) : Error(o(310));
        Mt = t, t = {
          memoizedState: Mt.memoizedState,
          baseState: Mt.baseState,
          baseQueue: Mt.baseQueue,
          queue: Mt.queue,
          next: null
        }, Zt === null ? rt.memoizedState = Zt = t : Zt = Zt.next = t;
      }
      return Zt;
    }
    function ls() {
      return {
        lastEffect: null,
        events: null,
        stores: null,
        memoCache: null
      };
    }
    function Yi(t) {
      var e = qi;
      return qi += 1, Za === null && (Za = []), t = bh(Za, t, e), e = rt, (Zt === null ? e.memoizedState : Zt.next) === null && (e = e.alternate, x.H = e === null || e.memoizedState === null ? cd : _o), t;
    }
    function ss(t) {
      if (t !== null && typeof t == "object") {
        if (typeof t.then == "function") return Yi(t);
        if (t.$$typeof === X) return ee(t);
      }
      throw Error(o(438, String(t)));
    }
    function To(t) {
      var e = null, n = rt.updateQueue;
      if (n !== null && (e = n.memoCache), e == null) {
        var i = rt.alternate;
        i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
          data: i.data.map(function(s) {
            return s.slice();
          }),
          index: 0
        })));
      }
      if (e == null && (e = {
        data: [],
        index: 0
      }), n === null && (n = ls(), rt.updateQueue = n), n.memoCache = e, n = e.data[e.index], n === void 0) for (n = e.data[e.index] = Array(t), i = 0; i < t; i++) n[i] = tt;
      return e.index++, n;
    }
    function rn(t, e) {
      return typeof e == "function" ? e(t) : e;
    }
    function us(t) {
      var e = Xt();
      return Ao(e, Mt, t);
    }
    function Ao(t, e, n) {
      var i = t.queue;
      if (i === null) throw Error(o(311));
      i.lastRenderedReducer = n;
      var s = t.baseQueue, r = i.pending;
      if (r !== null) {
        if (s !== null) {
          var h = s.next;
          s.next = r.next, r.next = h;
        }
        e.baseQueue = s = r, i.pending = null;
      }
      if (r = t.baseState, s === null) t.memoizedState = r;
      else {
        e = s.next;
        var g = h = null, T = null, R = e, V = false;
        do {
          var H = R.lane & -536870913;
          if (H !== R.lane ? (yt & H) === H : (on & H) === H) {
            var j = R.revertLane;
            if (j === 0) T !== null && (T = T.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: R.action,
              hasEagerState: R.hasEagerState,
              eagerState: R.eagerState,
              next: null
            }), H === Ha && (V = true);
            else if ((on & j) === j) {
              R = R.next, j === Ha && (V = true);
              continue;
            } else H = {
              lane: 0,
              revertLane: R.revertLane,
              gesture: null,
              action: R.action,
              hasEagerState: R.hasEagerState,
              eagerState: R.eagerState,
              next: null
            }, T === null ? (g = T = H, h = r) : T = T.next = H, rt.lanes |= j, _n |= j;
            H = R.action, fa && n(r, H), r = R.hasEagerState ? R.eagerState : n(r, H);
          } else j = {
            lane: H,
            revertLane: R.revertLane,
            gesture: R.gesture,
            action: R.action,
            hasEagerState: R.hasEagerState,
            eagerState: R.eagerState,
            next: null
          }, T === null ? (g = T = j, h = r) : T = T.next = j, rt.lanes |= H, _n |= H;
          R = R.next;
        } while (R !== null && R !== e);
        if (T === null ? h = r : T.next = g, !xe(r, t.memoizedState) && (Kt = true, V && (n = qa, n !== null))) throw n;
        t.memoizedState = r, t.baseState = h, t.baseQueue = T, i.lastRenderedState = r;
      }
      return s === null && (i.lanes = 0), [
        t.memoizedState,
        i.dispatch
      ];
    }
    function Eo(t) {
      var e = Xt(), n = e.queue;
      if (n === null) throw Error(o(311));
      n.lastRenderedReducer = t;
      var i = n.dispatch, s = n.pending, r = e.memoizedState;
      if (s !== null) {
        n.pending = null;
        var h = s = s.next;
        do
          r = t(r, h.action), h = h.next;
        while (h !== s);
        xe(r, e.memoizedState) || (Kt = true), e.memoizedState = r, e.baseQueue === null && (e.baseState = r), n.lastRenderedState = r;
      }
      return [
        r,
        i
      ];
    }
    function jh(t, e, n) {
      var i = rt, s = Xt(), r = vt;
      if (r) {
        if (n === void 0) throw Error(o(407));
        n = n();
      } else n = e();
      var h = !xe((Mt || s).memoizedState, n);
      if (h && (s.memoizedState = n, Kt = true), s = s.queue, Do(_h.bind(null, i, s, t), [
        t
      ]), s.getSnapshot !== e || h || Zt !== null && Zt.memoizedState.tag & 1) {
        if (i.flags |= 2048, Ka(9, {
          destroy: void 0
        }, Nh.bind(null, i, s, n, e), null), zt === null) throw Error(o(349));
        r || (on & 127) !== 0 || Oh(i, e, n);
      }
      return n;
    }
    function Oh(t, e, n) {
      t.flags |= 16384, t = {
        getSnapshot: e,
        value: n
      }, e = rt.updateQueue, e === null ? (e = ls(), rt.updateQueue = e, e.stores = [
        t
      ]) : (n = e.stores, n === null ? e.stores = [
        t
      ] : n.push(t));
    }
    function Nh(t, e, n, i) {
      e.value = n, e.getSnapshot = i, wh(e) && Vh(t);
    }
    function _h(t, e, n) {
      return n(function() {
        wh(e) && Vh(t);
      });
    }
    function wh(t) {
      var e = t.getSnapshot;
      t = t.value;
      try {
        var n = e();
        return !xe(t, n);
      } catch {
        return true;
      }
    }
    function Vh(t) {
      var e = na(t, 2);
      e !== null && ge(e, t, 2);
    }
    function Mo(t) {
      var e = oe();
      if (typeof t == "function") {
        var n = t;
        if (t = n(), fa) {
          bn(true);
          try {
            n();
          } finally {
            bn(false);
          }
        }
      }
      return e.memoizedState = e.baseState = t, e.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: rn,
        lastRenderedState: t
      }, e;
    }
    function Uh(t, e, n, i) {
      return t.baseState = n, Ao(t, Mt, typeof i == "function" ? i : rn);
    }
    function Hv(t, e, n, i, s) {
      if (cs(t)) throw Error(o(485));
      if (t = e.action, t !== null) {
        var r = {
          payload: s,
          action: t,
          next: null,
          isTransition: true,
          status: "pending",
          value: null,
          reason: null,
          listeners: [],
          then: function(h) {
            r.listeners.push(h);
          }
        };
        x.T !== null ? n(true) : r.isTransition = false, i(r), n = e.pending, n === null ? (r.next = e.pending = r, Bh(e, r)) : (r.next = n.next, e.pending = n.next = r);
      }
    }
    function Bh(t, e) {
      var n = e.action, i = e.payload, s = t.state;
      if (e.isTransition) {
        var r = x.T, h = {};
        x.T = h;
        try {
          var g = n(s, i), T = x.S;
          T !== null && T(h, g), Lh(t, e, g);
        } catch (R) {
          Co(t, e, R);
        } finally {
          r !== null && h.types !== null && (r.types = h.types), x.T = r;
        }
      } else try {
        r = n(s, i), Lh(t, e, r);
      } catch (R) {
        Co(t, e, R);
      }
    }
    function Lh(t, e, n) {
      n !== null && typeof n == "object" && typeof n.then == "function" ? n.then(function(i) {
        Hh(t, e, i);
      }, function(i) {
        return Co(t, e, i);
      }) : Hh(t, e, n);
    }
    function Hh(t, e, n) {
      e.status = "fulfilled", e.value = n, qh(e), t.state = n, e = t.pending, e !== null && (n = e.next, n === e ? t.pending = null : (n = n.next, e.next = n, Bh(t, n)));
    }
    function Co(t, e, n) {
      var i = t.pending;
      if (t.pending = null, i !== null) {
        i = i.next;
        do
          e.status = "rejected", e.reason = n, qh(e), e = e.next;
        while (e !== i);
      }
      t.action = null;
    }
    function qh(t) {
      t = t.listeners;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
    function Yh(t, e) {
      return e;
    }
    function Gh(t, e) {
      if (vt) {
        var n = zt.formState;
        if (n !== null) {
          t: {
            var i = rt;
            if (vt) {
              if (Ot) {
                e: {
                  for (var s = Ot, r = Ve; s.nodeType !== 8; ) {
                    if (!r) {
                      s = null;
                      break e;
                    }
                    if (s = Be(s.nextSibling), s === null) {
                      s = null;
                      break e;
                    }
                  }
                  r = s.data, s = r === "F!" || r === "F" ? s : null;
                }
                if (s) {
                  Ot = Be(s.nextSibling), i = s.data === "F!";
                  break t;
                }
              }
              En(i);
            }
            i = false;
          }
          i && (e = n[0]);
        }
      }
      return n = oe(), n.memoizedState = n.baseState = e, i = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Yh,
        lastRenderedState: e
      }, n.queue = i, n = ud.bind(null, rt, i), i.dispatch = n, i = Mo(false), r = No.bind(null, rt, false, i.queue), i = oe(), s = {
        state: e,
        dispatch: null,
        action: t,
        pending: null
      }, i.queue = s, n = Hv.bind(null, rt, s, r, n), s.dispatch = n, i.memoizedState = t, [
        e,
        n,
        false
      ];
    }
    function Xh(t) {
      var e = Xt();
      return kh(e, Mt, t);
    }
    function kh(t, e, n) {
      if (e = Ao(t, e, Yh)[0], t = us(rn)[0], typeof e == "object" && e !== null && typeof e.then == "function") try {
        var i = Yi(e);
      } catch (h) {
        throw h === Ya ? Wl : h;
      }
      else i = e;
      e = Xt();
      var s = e.queue, r = s.dispatch;
      return n !== e.memoizedState && (rt.flags |= 2048, Ka(9, {
        destroy: void 0
      }, qv.bind(null, s, n), null)), [
        i,
        r,
        t
      ];
    }
    function qv(t, e) {
      t.action = e;
    }
    function Zh(t) {
      var e = Xt(), n = Mt;
      if (n !== null) return kh(e, n, t);
      Xt(), e = e.memoizedState, n = Xt();
      var i = n.queue.dispatch;
      return n.memoizedState = t, [
        e,
        i,
        false
      ];
    }
    function Ka(t, e, n, i) {
      return t = {
        tag: t,
        create: n,
        deps: i,
        inst: e,
        next: null
      }, e = rt.updateQueue, e === null && (e = ls(), rt.updateQueue = e), n = e.lastEffect, n === null ? e.lastEffect = t.next = t : (i = n.next, n.next = t, t.next = i, e.lastEffect = t), t;
    }
    function Kh() {
      return Xt().memoizedState;
    }
    function os(t, e, n, i) {
      var s = oe();
      rt.flags |= t, s.memoizedState = Ka(1 | e, {
        destroy: void 0
      }, n, i === void 0 ? null : i);
    }
    function rs(t, e, n, i) {
      var s = Xt();
      i = i === void 0 ? null : i;
      var r = s.memoizedState.inst;
      Mt !== null && i !== null && go(i, Mt.memoizedState.deps) ? s.memoizedState = Ka(e, r, n, i) : (rt.flags |= t, s.memoizedState = Ka(1 | e, r, n, i));
    }
    function Qh(t, e) {
      os(8390656, 8, t, e);
    }
    function Do(t, e) {
      rs(2048, 8, t, e);
    }
    function Yv(t) {
      rt.flags |= 4;
      var e = rt.updateQueue;
      if (e === null) e = ls(), rt.updateQueue = e, e.events = [
        t
      ];
      else {
        var n = e.events;
        n === null ? e.events = [
          t
        ] : n.push(t);
      }
    }
    function Jh(t) {
      var e = Xt().memoizedState;
      return Yv({
        ref: e,
        nextImpl: t
      }), function() {
        if ((xt & 2) !== 0) throw Error(o(440));
        return e.impl.apply(void 0, arguments);
      };
    }
    function Fh(t, e) {
      return rs(4, 2, t, e);
    }
    function Ph(t, e) {
      return rs(4, 4, t, e);
    }
    function Wh(t, e) {
      if (typeof e == "function") {
        t = t();
        var n = e(t);
        return function() {
          typeof n == "function" ? n() : e(null);
        };
      }
      if (e != null) return t = t(), e.current = t, function() {
        e.current = null;
      };
    }
    function $h(t, e, n) {
      n = n != null ? n.concat([
        t
      ]) : null, rs(4, 4, Wh.bind(null, e, t), n);
    }
    function zo() {
    }
    function Ih(t, e) {
      var n = Xt();
      e = e === void 0 ? null : e;
      var i = n.memoizedState;
      return e !== null && go(e, i[1]) ? i[0] : (n.memoizedState = [
        t,
        e
      ], t);
    }
    function td(t, e) {
      var n = Xt();
      e = e === void 0 ? null : e;
      var i = n.memoizedState;
      if (e !== null && go(e, i[1])) return i[0];
      if (i = t(), fa) {
        bn(true);
        try {
          t();
        } finally {
          bn(false);
        }
      }
      return n.memoizedState = [
        i,
        e
      ], i;
    }
    function Ro(t, e, n) {
      return n === void 0 || (on & 1073741824) !== 0 && (yt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = n, t = em(), rt.lanes |= t, _n |= t, n);
    }
    function ed(t, e, n, i) {
      return xe(n, e) ? n : Xa.current !== null ? (t = Ro(t, n, i), xe(t, e) || (Kt = true), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (yt & 261930) === 0 ? (Kt = true, t.memoizedState = n) : (t = em(), rt.lanes |= t, _n |= t, e);
    }
    function nd(t, e, n, i, s) {
      var r = O.p;
      O.p = r !== 0 && 8 > r ? r : 8;
      var h = x.T, g = {};
      x.T = g, No(t, false, e, n);
      try {
        var T = s(), R = x.S;
        if (R !== null && R(g, T), T !== null && typeof T == "object" && typeof T.then == "function") {
          var V = Uv(T, i);
          Gi(t, e, V, De(t));
        } else Gi(t, e, i, De(t));
      } catch (H) {
        Gi(t, e, {
          then: function() {
          },
          status: "rejected",
          reason: H
        }, De());
      } finally {
        O.p = r, h !== null && g.types !== null && (h.types = g.types), x.T = h;
      }
    }
    function Gv() {
    }
    function jo(t, e, n, i) {
      if (t.tag !== 5) throw Error(o(476));
      var s = ad(t).queue;
      nd(t, s, e, L, n === null ? Gv : function() {
        return id(t), n(i);
      });
    }
    function ad(t) {
      var e = t.memoizedState;
      if (e !== null) return e;
      e = {
        memoizedState: L,
        baseState: L,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: rn,
          lastRenderedState: L
        },
        next: null
      };
      var n = {};
      return e.next = {
        memoizedState: n,
        baseState: n,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: rn,
          lastRenderedState: n
        },
        next: null
      }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
    }
    function id(t) {
      var e = ad(t);
      e.next === null && (e = t.alternate.memoizedState), Gi(t, e.next.queue, {}, De());
    }
    function Oo() {
      return ee(ll);
    }
    function ld() {
      return Xt().memoizedState;
    }
    function sd() {
      return Xt().memoizedState;
    }
    function Xv(t) {
      for (var e = t.return; e !== null; ) {
        switch (e.tag) {
          case 24:
          case 3:
            var n = De();
            t = Dn(n);
            var i = zn(e, t, n);
            i !== null && (ge(i, e, n), Bi(i, e, n)), e = {
              cache: lo()
            }, t.payload = e;
            return;
        }
        e = e.return;
      }
    }
    function kv(t, e, n) {
      var i = De();
      n = {
        lane: i,
        revertLane: 0,
        gesture: null,
        action: n,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, cs(t) ? od(e, n) : (n = Ju(t, e, n, i), n !== null && (ge(n, t, i), rd(n, e, i)));
    }
    function ud(t, e, n) {
      var i = De();
      Gi(t, e, n, i);
    }
    function Gi(t, e, n, i) {
      var s = {
        lane: i,
        revertLane: 0,
        gesture: null,
        action: n,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (cs(t)) od(e, s);
      else {
        var r = t.alternate;
        if (t.lanes === 0 && (r === null || r.lanes === 0) && (r = e.lastRenderedReducer, r !== null)) try {
          var h = e.lastRenderedState, g = r(h, n);
          if (s.hasEagerState = true, s.eagerState = g, xe(g, h)) return kl(t, e, s, 0), zt === null && Xl(), false;
        } catch {
        } finally {
        }
        if (n = Ju(t, e, s, i), n !== null) return ge(n, t, i), rd(n, e, i), true;
      }
      return false;
    }
    function No(t, e, n, i) {
      if (i = {
        lane: 2,
        revertLane: cr(),
        gesture: null,
        action: i,
        hasEagerState: false,
        eagerState: null,
        next: null
      }, cs(t)) {
        if (e) throw Error(o(479));
      } else e = Ju(t, n, i, 2), e !== null && ge(e, t, 2);
    }
    function cs(t) {
      var e = t.alternate;
      return t === rt || e !== null && e === rt;
    }
    function od(t, e) {
      ka = as = true;
      var n = t.pending;
      n === null ? e.next = e : (e.next = n.next, n.next = e), t.pending = e;
    }
    function rd(t, e, n) {
      if ((n & 4194048) !== 0) {
        var i = e.lanes;
        i &= t.pendingLanes, n |= i, e.lanes = n, mf(t, n);
      }
    }
    var Xi = {
      readContext: ee,
      use: ss,
      useCallback: Lt,
      useContext: Lt,
      useEffect: Lt,
      useImperativeHandle: Lt,
      useLayoutEffect: Lt,
      useInsertionEffect: Lt,
      useMemo: Lt,
      useReducer: Lt,
      useRef: Lt,
      useState: Lt,
      useDebugValue: Lt,
      useDeferredValue: Lt,
      useTransition: Lt,
      useSyncExternalStore: Lt,
      useId: Lt,
      useHostTransitionStatus: Lt,
      useFormState: Lt,
      useActionState: Lt,
      useOptimistic: Lt,
      useMemoCache: Lt,
      useCacheRefresh: Lt
    };
    Xi.useEffectEvent = Lt;
    var cd = {
      readContext: ee,
      use: ss,
      useCallback: function(t, e) {
        return oe().memoizedState = [
          t,
          e === void 0 ? null : e
        ], t;
      },
      useContext: ee,
      useEffect: Qh,
      useImperativeHandle: function(t, e, n) {
        n = n != null ? n.concat([
          t
        ]) : null, os(4194308, 4, Wh.bind(null, e, t), n);
      },
      useLayoutEffect: function(t, e) {
        return os(4194308, 4, t, e);
      },
      useInsertionEffect: function(t, e) {
        os(4, 2, t, e);
      },
      useMemo: function(t, e) {
        var n = oe();
        e = e === void 0 ? null : e;
        var i = t();
        if (fa) {
          bn(true);
          try {
            t();
          } finally {
            bn(false);
          }
        }
        return n.memoizedState = [
          i,
          e
        ], i;
      },
      useReducer: function(t, e, n) {
        var i = oe();
        if (n !== void 0) {
          var s = n(e);
          if (fa) {
            bn(true);
            try {
              n(e);
            } finally {
              bn(false);
            }
          }
        } else s = e;
        return i.memoizedState = i.baseState = s, t = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: t,
          lastRenderedState: s
        }, i.queue = t, t = t.dispatch = kv.bind(null, rt, t), [
          i.memoizedState,
          t
        ];
      },
      useRef: function(t) {
        var e = oe();
        return t = {
          current: t
        }, e.memoizedState = t;
      },
      useState: function(t) {
        t = Mo(t);
        var e = t.queue, n = ud.bind(null, rt, e);
        return e.dispatch = n, [
          t.memoizedState,
          n
        ];
      },
      useDebugValue: zo,
      useDeferredValue: function(t, e) {
        var n = oe();
        return Ro(n, t, e);
      },
      useTransition: function() {
        var t = Mo(false);
        return t = nd.bind(null, rt, t.queue, true, false), oe().memoizedState = t, [
          false,
          t
        ];
      },
      useSyncExternalStore: function(t, e, n) {
        var i = rt, s = oe();
        if (vt) {
          if (n === void 0) throw Error(o(407));
          n = n();
        } else {
          if (n = e(), zt === null) throw Error(o(349));
          (yt & 127) !== 0 || Oh(i, e, n);
        }
        s.memoizedState = n;
        var r = {
          value: n,
          getSnapshot: e
        };
        return s.queue = r, Qh(_h.bind(null, i, r, t), [
          t
        ]), i.flags |= 2048, Ka(9, {
          destroy: void 0
        }, Nh.bind(null, i, r, n, e), null), n;
      },
      useId: function() {
        var t = oe(), e = zt.identifierPrefix;
        if (vt) {
          var n = Je, i = Qe;
          n = (i & ~(1 << 32 - Se(i) - 1)).toString(32) + n, e = "_" + e + "R_" + n, n = is++, 0 < n && (e += "H" + n.toString(32)), e += "_";
        } else n = Bv++, e = "_" + e + "r_" + n.toString(32) + "_";
        return t.memoizedState = e;
      },
      useHostTransitionStatus: Oo,
      useFormState: Gh,
      useActionState: Gh,
      useOptimistic: function(t) {
        var e = oe();
        e.memoizedState = e.baseState = t;
        var n = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null
        };
        return e.queue = n, e = No.bind(null, rt, true, n), n.dispatch = e, [
          t,
          e
        ];
      },
      useMemoCache: To,
      useCacheRefresh: function() {
        return oe().memoizedState = Xv.bind(null, rt);
      },
      useEffectEvent: function(t) {
        var e = oe(), n = {
          impl: t
        };
        return e.memoizedState = n, function() {
          if ((xt & 2) !== 0) throw Error(o(440));
          return n.impl.apply(void 0, arguments);
        };
      }
    }, _o = {
      readContext: ee,
      use: ss,
      useCallback: Ih,
      useContext: ee,
      useEffect: Do,
      useImperativeHandle: $h,
      useInsertionEffect: Fh,
      useLayoutEffect: Ph,
      useMemo: td,
      useReducer: us,
      useRef: Kh,
      useState: function() {
        return us(rn);
      },
      useDebugValue: zo,
      useDeferredValue: function(t, e) {
        var n = Xt();
        return ed(n, Mt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = us(rn)[0], e = Xt().memoizedState;
        return [
          typeof t == "boolean" ? t : Yi(t),
          e
        ];
      },
      useSyncExternalStore: jh,
      useId: ld,
      useHostTransitionStatus: Oo,
      useFormState: Xh,
      useActionState: Xh,
      useOptimistic: function(t, e) {
        var n = Xt();
        return Uh(n, Mt, t, e);
      },
      useMemoCache: To,
      useCacheRefresh: sd
    };
    _o.useEffectEvent = Jh;
    var fd = {
      readContext: ee,
      use: ss,
      useCallback: Ih,
      useContext: ee,
      useEffect: Do,
      useImperativeHandle: $h,
      useInsertionEffect: Fh,
      useLayoutEffect: Ph,
      useMemo: td,
      useReducer: Eo,
      useRef: Kh,
      useState: function() {
        return Eo(rn);
      },
      useDebugValue: zo,
      useDeferredValue: function(t, e) {
        var n = Xt();
        return Mt === null ? Ro(n, t, e) : ed(n, Mt.memoizedState, t, e);
      },
      useTransition: function() {
        var t = Eo(rn)[0], e = Xt().memoizedState;
        return [
          typeof t == "boolean" ? t : Yi(t),
          e
        ];
      },
      useSyncExternalStore: jh,
      useId: ld,
      useHostTransitionStatus: Oo,
      useFormState: Zh,
      useActionState: Zh,
      useOptimistic: function(t, e) {
        var n = Xt();
        return Mt !== null ? Uh(n, Mt, t, e) : (n.baseState = t, [
          t,
          n.queue.dispatch
        ]);
      },
      useMemoCache: To,
      useCacheRefresh: sd
    };
    fd.useEffectEvent = Jh;
    function wo(t, e, n, i) {
      e = t.memoizedState, n = n(i, e), n = n == null ? e : b({}, e, n), t.memoizedState = n, t.lanes === 0 && (t.updateQueue.baseState = n);
    }
    var Vo = {
      enqueueSetState: function(t, e, n) {
        t = t._reactInternals;
        var i = De(), s = Dn(i);
        s.payload = e, n != null && (s.callback = n), e = zn(t, s, i), e !== null && (ge(e, t, i), Bi(e, t, i));
      },
      enqueueReplaceState: function(t, e, n) {
        t = t._reactInternals;
        var i = De(), s = Dn(i);
        s.tag = 1, s.payload = e, n != null && (s.callback = n), e = zn(t, s, i), e !== null && (ge(e, t, i), Bi(e, t, i));
      },
      enqueueForceUpdate: function(t, e) {
        t = t._reactInternals;
        var n = De(), i = Dn(n);
        i.tag = 2, e != null && (i.callback = e), e = zn(t, i, n), e !== null && (ge(e, t, n), Bi(e, t, n));
      }
    };
    function hd(t, e, n, i, s, r, h) {
      return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, r, h) : e.prototype && e.prototype.isPureReactComponent ? !Ri(n, i) || !Ri(s, r) : true;
    }
    function dd(t, e, n, i) {
      t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(n, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(n, i), e.state !== t && Vo.enqueueReplaceState(e, e.state, null);
    }
    function ha(t, e) {
      var n = e;
      if ("ref" in e) {
        n = {};
        for (var i in e) i !== "ref" && (n[i] = e[i]);
      }
      if (t = t.defaultProps) {
        n === e && (n = b({}, n));
        for (var s in t) n[s] === void 0 && (n[s] = t[s]);
      }
      return n;
    }
    function md(t) {
      Gl(t);
    }
    function pd(t) {
      console.error(t);
    }
    function yd(t) {
      Gl(t);
    }
    function fs(t, e) {
      try {
        var n = t.onUncaughtError;
        n(e.value, {
          componentStack: e.stack
        });
      } catch (i) {
        setTimeout(function() {
          throw i;
        });
      }
    }
    function gd(t, e, n) {
      try {
        var i = t.onCaughtError;
        i(n.value, {
          componentStack: n.stack,
          errorBoundary: e.tag === 1 ? e.stateNode : null
        });
      } catch (s) {
        setTimeout(function() {
          throw s;
        });
      }
    }
    function Uo(t, e, n) {
      return n = Dn(n), n.tag = 3, n.payload = {
        element: null
      }, n.callback = function() {
        fs(t, e);
      }, n;
    }
    function vd(t) {
      return t = Dn(t), t.tag = 3, t;
    }
    function bd(t, e, n, i) {
      var s = n.type.getDerivedStateFromError;
      if (typeof s == "function") {
        var r = i.value;
        t.payload = function() {
          return s(r);
        }, t.callback = function() {
          gd(e, n, i);
        };
      }
      var h = n.stateNode;
      h !== null && typeof h.componentDidCatch == "function" && (t.callback = function() {
        gd(e, n, i), typeof s != "function" && (wn === null ? wn = /* @__PURE__ */ new Set([
          this
        ]) : wn.add(this));
        var g = i.stack;
        this.componentDidCatch(i.value, {
          componentStack: g !== null ? g : ""
        });
      });
    }
    function Zv(t, e, n, i, s) {
      if (n.flags |= 32768, i !== null && typeof i == "object" && typeof i.then == "function") {
        if (e = n.alternate, e !== null && La(e, n, s, true), n = Ae.current, n !== null) {
          switch (n.tag) {
            case 31:
            case 13:
              return Ue === null ? As() : n.alternate === null && Ht === 0 && (Ht = 3), n.flags &= -257, n.flags |= 65536, n.lanes = s, i === $l ? n.flags |= 16384 : (e = n.updateQueue, e === null ? n.updateQueue = /* @__PURE__ */ new Set([
                i
              ]) : e.add(i), ur(t, i, s)), false;
            case 22:
              return n.flags |= 65536, i === $l ? n.flags |= 16384 : (e = n.updateQueue, e === null ? (e = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([
                  i
                ])
              }, n.updateQueue = e) : (n = e.retryQueue, n === null ? e.retryQueue = /* @__PURE__ */ new Set([
                i
              ]) : n.add(i)), ur(t, i, s)), false;
          }
          throw Error(o(435, n.tag));
        }
        return ur(t, i, s), As(), false;
      }
      if (vt) return e = Ae.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = s, i !== to && (t = Error(o(422), {
        cause: i
      }), Ni(Ne(t, n)))) : (i !== to && (e = Error(o(423), {
        cause: i
      }), Ni(Ne(e, n))), t = t.current.alternate, t.flags |= 65536, s &= -s, t.lanes |= s, i = Ne(i, n), s = Uo(t.stateNode, i, s), fo(t, s), Ht !== 4 && (Ht = 2)), false;
      var r = Error(o(520), {
        cause: i
      });
      if (r = Ne(r, n), Wi === null ? Wi = [
        r
      ] : Wi.push(r), Ht !== 4 && (Ht = 2), e === null) return true;
      i = Ne(i, n), n = e;
      do {
        switch (n.tag) {
          case 3:
            return n.flags |= 65536, t = s & -s, n.lanes |= t, t = Uo(n.stateNode, i, t), fo(n, t), false;
          case 1:
            if (e = n.type, r = n.stateNode, (n.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || r !== null && typeof r.componentDidCatch == "function" && (wn === null || !wn.has(r)))) return n.flags |= 65536, s &= -s, n.lanes |= s, s = vd(s), bd(s, t, n, i), fo(n, s), false;
        }
        n = n.return;
      } while (n !== null);
      return false;
    }
    var Bo = Error(o(461)), Kt = false;
    function ne(t, e, n, i) {
      e.child = t === null ? Ah(e, null, n, i) : ca(e, t.child, n, i);
    }
    function Sd(t, e, n, i, s) {
      n = n.render;
      var r = e.ref;
      if ("ref" in i) {
        var h = {};
        for (var g in i) g !== "ref" && (h[g] = i[g]);
      } else h = i;
      return sa(e), i = vo(t, e, n, h, r, s), g = bo(), t !== null && !Kt ? (So(t, e, s), cn(t, e, s)) : (vt && g && $u(e), e.flags |= 1, ne(t, e, i, s), e.child);
    }
    function xd(t, e, n, i, s) {
      if (t === null) {
        var r = n.type;
        return typeof r == "function" && !Fu(r) && r.defaultProps === void 0 && n.compare === null ? (e.tag = 15, e.type = r, Td(t, e, r, i, s)) : (t = Kl(n.type, null, i, e, e.mode, s), t.ref = e.ref, t.return = e, e.child = t);
      }
      if (r = t.child, !Zo(t, s)) {
        var h = r.memoizedProps;
        if (n = n.compare, n = n !== null ? n : Ri, n(h, i) && t.ref === e.ref) return cn(t, e, s);
      }
      return e.flags |= 1, t = an(r, i), t.ref = e.ref, t.return = e, e.child = t;
    }
    function Td(t, e, n, i, s) {
      if (t !== null) {
        var r = t.memoizedProps;
        if (Ri(r, i) && t.ref === e.ref) if (Kt = false, e.pendingProps = i = r, Zo(t, s)) (t.flags & 131072) !== 0 && (Kt = true);
        else return e.lanes = t.lanes, cn(t, e, s);
      }
      return Lo(t, e, n, i, s);
    }
    function Ad(t, e, n, i) {
      var s = i.children, r = t !== null ? t.memoizedState : null;
      if (t === null && e.stateNode === null && (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), i.mode === "hidden") {
        if ((e.flags & 128) !== 0) {
          if (r = r !== null ? r.baseLanes | n : n, t !== null) {
            for (i = e.child = t.child, s = 0; i !== null; ) s = s | i.lanes | i.childLanes, i = i.sibling;
            i = s & ~r;
          } else i = 0, e.child = null;
          return Ed(t, e, r, n, i);
        }
        if ((n & 536870912) !== 0) e.memoizedState = {
          baseLanes: 0,
          cachePool: null
        }, t !== null && Pl(e, r !== null ? r.cachePool : null), r !== null ? Ch(e, r) : mo(), Dh(e);
        else return i = e.lanes = 536870912, Ed(t, e, r !== null ? r.baseLanes | n : n, n, i);
      } else r !== null ? (Pl(e, r.cachePool), Ch(e, r), jn(), e.memoizedState = null) : (t !== null && Pl(e, null), mo(), jn());
      return ne(t, e, s, n), e.child;
    }
    function ki(t, e) {
      return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      }), e.sibling;
    }
    function Ed(t, e, n, i, s) {
      var r = uo();
      return r = r === null ? null : {
        parent: kt._currentValue,
        pool: r
      }, e.memoizedState = {
        baseLanes: n,
        cachePool: r
      }, t !== null && Pl(e, null), mo(), Dh(e), t !== null && La(t, e, i, true), e.childLanes = s, null;
    }
    function hs(t, e) {
      return e = ms({
        mode: e.mode,
        children: e.children
      }, t.mode), e.ref = t.ref, t.child = e, e.return = t, e;
    }
    function Md(t, e, n) {
      return ca(e, t.child, null, n), t = hs(e, e.pendingProps), t.flags |= 2, Ee(e), e.memoizedState = null, t;
    }
    function Kv(t, e, n) {
      var i = e.pendingProps, s = (e.flags & 128) !== 0;
      if (e.flags &= -129, t === null) {
        if (vt) {
          if (i.mode === "hidden") return t = hs(e, i), e.lanes = 536870912, ki(null, t);
          if (yo(e), (t = Ot) ? (t = Bm(t, Ve), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
            dehydrated: t,
            treeContext: Tn !== null ? {
              id: Qe,
              overflow: Je
            } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, n = oh(t), n.return = e, e.child = n, te = e, Ot = null)) : t = null, t === null) throw En(e);
          return e.lanes = 536870912, null;
        }
        return hs(e, i);
      }
      var r = t.memoizedState;
      if (r !== null) {
        var h = r.dehydrated;
        if (yo(e), s) if (e.flags & 256) e.flags &= -257, e = Md(t, e, n);
        else if (e.memoizedState !== null) e.child = t.child, e.flags |= 128, e = null;
        else throw Error(o(558));
        else if (Kt || La(t, e, n, false), s = (n & t.childLanes) !== 0, Kt || s) {
          if (i = zt, i !== null && (h = pf(i, n), h !== 0 && h !== r.retryLane)) throw r.retryLane = h, na(t, h), ge(i, t, h), Bo;
          As(), e = Md(t, e, n);
        } else t = r.treeContext, Ot = Be(h.nextSibling), te = e, vt = true, An = null, Ve = false, t !== null && fh(e, t), e = hs(e, i), e.flags |= 4096;
        return e;
      }
      return t = an(t.child, {
        mode: i.mode,
        children: i.children
      }), t.ref = e.ref, e.child = t, t.return = e, t;
    }
    function ds(t, e) {
      var n = e.ref;
      if (n === null) t !== null && t.ref !== null && (e.flags |= 4194816);
      else {
        if (typeof n != "function" && typeof n != "object") throw Error(o(284));
        (t === null || t.ref !== n) && (e.flags |= 4194816);
      }
    }
    function Lo(t, e, n, i, s) {
      return sa(e), n = vo(t, e, n, i, void 0, s), i = bo(), t !== null && !Kt ? (So(t, e, s), cn(t, e, s)) : (vt && i && $u(e), e.flags |= 1, ne(t, e, n, s), e.child);
    }
    function Cd(t, e, n, i, s, r) {
      return sa(e), e.updateQueue = null, n = Rh(e, i, n, s), zh(t), i = bo(), t !== null && !Kt ? (So(t, e, r), cn(t, e, r)) : (vt && i && $u(e), e.flags |= 1, ne(t, e, n, r), e.child);
    }
    function Dd(t, e, n, i, s) {
      if (sa(e), e.stateNode === null) {
        var r = wa, h = n.contextType;
        typeof h == "object" && h !== null && (r = ee(h)), r = new n(i, r), e.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null, r.updater = Vo, e.stateNode = r, r._reactInternals = e, r = e.stateNode, r.props = i, r.state = e.memoizedState, r.refs = {}, ro(e), h = n.contextType, r.context = typeof h == "object" && h !== null ? ee(h) : wa, r.state = e.memoizedState, h = n.getDerivedStateFromProps, typeof h == "function" && (wo(e, n, h, i), r.state = e.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof r.getSnapshotBeforeUpdate == "function" || typeof r.UNSAFE_componentWillMount != "function" && typeof r.componentWillMount != "function" || (h = r.state, typeof r.componentWillMount == "function" && r.componentWillMount(), typeof r.UNSAFE_componentWillMount == "function" && r.UNSAFE_componentWillMount(), h !== r.state && Vo.enqueueReplaceState(r, r.state, null), Hi(e, i, r, s), Li(), r.state = e.memoizedState), typeof r.componentDidMount == "function" && (e.flags |= 4194308), i = true;
      } else if (t === null) {
        r = e.stateNode;
        var g = e.memoizedProps, T = ha(n, g);
        r.props = T;
        var R = r.context, V = n.contextType;
        h = wa, typeof V == "object" && V !== null && (h = ee(V));
        var H = n.getDerivedStateFromProps;
        V = typeof H == "function" || typeof r.getSnapshotBeforeUpdate == "function", g = e.pendingProps !== g, V || typeof r.UNSAFE_componentWillReceiveProps != "function" && typeof r.componentWillReceiveProps != "function" || (g || R !== h) && dd(e, r, i, h), Cn = false;
        var j = e.memoizedState;
        r.state = j, Hi(e, i, r, s), Li(), R = e.memoizedState, g || j !== R || Cn ? (typeof H == "function" && (wo(e, n, H, i), R = e.memoizedState), (T = Cn || hd(e, n, T, i, j, R, h)) ? (V || typeof r.UNSAFE_componentWillMount != "function" && typeof r.componentWillMount != "function" || (typeof r.componentWillMount == "function" && r.componentWillMount(), typeof r.UNSAFE_componentWillMount == "function" && r.UNSAFE_componentWillMount()), typeof r.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof r.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = R), r.props = i, r.state = R, r.context = h, i = T) : (typeof r.componentDidMount == "function" && (e.flags |= 4194308), i = false);
      } else {
        r = e.stateNode, co(t, e), h = e.memoizedProps, V = ha(n, h), r.props = V, H = e.pendingProps, j = r.context, R = n.contextType, T = wa, typeof R == "object" && R !== null && (T = ee(R)), g = n.getDerivedStateFromProps, (R = typeof g == "function" || typeof r.getSnapshotBeforeUpdate == "function") || typeof r.UNSAFE_componentWillReceiveProps != "function" && typeof r.componentWillReceiveProps != "function" || (h !== H || j !== T) && dd(e, r, i, T), Cn = false, j = e.memoizedState, r.state = j, Hi(e, i, r, s), Li();
        var _ = e.memoizedState;
        h !== H || j !== _ || Cn || t !== null && t.dependencies !== null && Jl(t.dependencies) ? (typeof g == "function" && (wo(e, n, g, i), _ = e.memoizedState), (V = Cn || hd(e, n, V, i, j, _, T) || t !== null && t.dependencies !== null && Jl(t.dependencies)) ? (R || typeof r.UNSAFE_componentWillUpdate != "function" && typeof r.componentWillUpdate != "function" || (typeof r.componentWillUpdate == "function" && r.componentWillUpdate(i, _, T), typeof r.UNSAFE_componentWillUpdate == "function" && r.UNSAFE_componentWillUpdate(i, _, T)), typeof r.componentDidUpdate == "function" && (e.flags |= 4), typeof r.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof r.componentDidUpdate != "function" || h === t.memoizedProps && j === t.memoizedState || (e.flags |= 4), typeof r.getSnapshotBeforeUpdate != "function" || h === t.memoizedProps && j === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = _), r.props = i, r.state = _, r.context = T, i = V) : (typeof r.componentDidUpdate != "function" || h === t.memoizedProps && j === t.memoizedState || (e.flags |= 4), typeof r.getSnapshotBeforeUpdate != "function" || h === t.memoizedProps && j === t.memoizedState || (e.flags |= 1024), i = false);
      }
      return r = i, ds(t, e), i = (e.flags & 128) !== 0, r || i ? (r = e.stateNode, n = i && typeof n.getDerivedStateFromError != "function" ? null : r.render(), e.flags |= 1, t !== null && i ? (e.child = ca(e, t.child, null, s), e.child = ca(e, null, n, s)) : ne(t, e, n, s), e.memoizedState = r.state, t = e.child) : t = cn(t, e, s), t;
    }
    function zd(t, e, n, i) {
      return ia(), e.flags |= 256, ne(t, e, n, i), e.child;
    }
    var Ho = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    };
    function qo(t) {
      return {
        baseLanes: t,
        cachePool: gh()
      };
    }
    function Yo(t, e, n) {
      return t = t !== null ? t.childLanes & ~n : 0, e && (t |= Ce), t;
    }
    function Rd(t, e, n) {
      var i = e.pendingProps, s = false, r = (e.flags & 128) !== 0, h;
      if ((h = r) || (h = t !== null && t.memoizedState === null ? false : (Gt.current & 2) !== 0), h && (s = true, e.flags &= -129), h = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
        if (vt) {
          if (s ? Rn(e) : jn(), (t = Ot) ? (t = Bm(t, Ve), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
            dehydrated: t,
            treeContext: Tn !== null ? {
              id: Qe,
              overflow: Je
            } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, n = oh(t), n.return = e, e.child = n, te = e, Ot = null)) : t = null, t === null) throw En(e);
          return Ar(t) ? e.lanes = 32 : e.lanes = 536870912, null;
        }
        var g = i.children;
        return i = i.fallback, s ? (jn(), s = e.mode, g = ms({
          mode: "hidden",
          children: g
        }, s), i = aa(i, s, n, null), g.return = e, i.return = e, g.sibling = i, e.child = g, i = e.child, i.memoizedState = qo(n), i.childLanes = Yo(t, h, n), e.memoizedState = Ho, ki(null, i)) : (Rn(e), Go(e, g));
      }
      var T = t.memoizedState;
      if (T !== null && (g = T.dehydrated, g !== null)) {
        if (r) e.flags & 256 ? (Rn(e), e.flags &= -257, e = Xo(t, e, n)) : e.memoizedState !== null ? (jn(), e.child = t.child, e.flags |= 128, e = null) : (jn(), g = i.fallback, s = e.mode, i = ms({
          mode: "visible",
          children: i.children
        }, s), g = aa(g, s, n, null), g.flags |= 2, i.return = e, g.return = e, i.sibling = g, e.child = i, ca(e, t.child, null, n), i = e.child, i.memoizedState = qo(n), i.childLanes = Yo(t, h, n), e.memoizedState = Ho, e = ki(null, i));
        else if (Rn(e), Ar(g)) {
          if (h = g.nextSibling && g.nextSibling.dataset, h) var R = h.dgst;
          h = R, i = Error(o(419)), i.stack = "", i.digest = h, Ni({
            value: i,
            source: null,
            stack: null
          }), e = Xo(t, e, n);
        } else if (Kt || La(t, e, n, false), h = (n & t.childLanes) !== 0, Kt || h) {
          if (h = zt, h !== null && (i = pf(h, n), i !== 0 && i !== T.retryLane)) throw T.retryLane = i, na(t, i), ge(h, t, i), Bo;
          Tr(g) || As(), e = Xo(t, e, n);
        } else Tr(g) ? (e.flags |= 192, e.child = t.child, e = null) : (t = T.treeContext, Ot = Be(g.nextSibling), te = e, vt = true, An = null, Ve = false, t !== null && fh(e, t), e = Go(e, i.children), e.flags |= 4096);
        return e;
      }
      return s ? (jn(), g = i.fallback, s = e.mode, T = t.child, R = T.sibling, i = an(T, {
        mode: "hidden",
        children: i.children
      }), i.subtreeFlags = T.subtreeFlags & 65011712, R !== null ? g = an(R, g) : (g = aa(g, s, n, null), g.flags |= 2), g.return = e, i.return = e, i.sibling = g, e.child = i, ki(null, i), i = e.child, g = t.child.memoizedState, g === null ? g = qo(n) : (s = g.cachePool, s !== null ? (T = kt._currentValue, s = s.parent !== T ? {
        parent: T,
        pool: T
      } : s) : s = gh(), g = {
        baseLanes: g.baseLanes | n,
        cachePool: s
      }), i.memoizedState = g, i.childLanes = Yo(t, h, n), e.memoizedState = Ho, ki(t.child, i)) : (Rn(e), n = t.child, t = n.sibling, n = an(n, {
        mode: "visible",
        children: i.children
      }), n.return = e, n.sibling = null, t !== null && (h = e.deletions, h === null ? (e.deletions = [
        t
      ], e.flags |= 16) : h.push(t)), e.child = n, e.memoizedState = null, n);
    }
    function Go(t, e) {
      return e = ms({
        mode: "visible",
        children: e
      }, t.mode), e.return = t, t.child = e;
    }
    function ms(t, e) {
      return t = Te(22, t, null, e), t.lanes = 0, t;
    }
    function Xo(t, e, n) {
      return ca(e, t.child, null, n), t = Go(e, e.pendingProps.children), t.flags |= 2, e.memoizedState = null, t;
    }
    function jd(t, e, n) {
      t.lanes |= e;
      var i = t.alternate;
      i !== null && (i.lanes |= e), ao(t.return, e, n);
    }
    function ko(t, e, n, i, s, r) {
      var h = t.memoizedState;
      h === null ? t.memoizedState = {
        isBackwards: e,
        rendering: null,
        renderingStartTime: 0,
        last: i,
        tail: n,
        tailMode: s,
        treeForkCount: r
      } : (h.isBackwards = e, h.rendering = null, h.renderingStartTime = 0, h.last = i, h.tail = n, h.tailMode = s, h.treeForkCount = r);
    }
    function Od(t, e, n) {
      var i = e.pendingProps, s = i.revealOrder, r = i.tail;
      i = i.children;
      var h = Gt.current, g = (h & 2) !== 0;
      if (g ? (h = h & 1 | 2, e.flags |= 128) : h &= 1, Q(Gt, h), ne(t, e, i, n), i = vt ? Oi : 0, !g && t !== null && (t.flags & 128) !== 0) t: for (t = e.child; t !== null; ) {
        if (t.tag === 13) t.memoizedState !== null && jd(t, n, e);
        else if (t.tag === 19) jd(t, n, e);
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
      switch (s) {
        case "forwards":
          for (n = e.child, s = null; n !== null; ) t = n.alternate, t !== null && ns(t) === null && (s = n), n = n.sibling;
          n = s, n === null ? (s = e.child, e.child = null) : (s = n.sibling, n.sibling = null), ko(e, false, s, n, r, i);
          break;
        case "backwards":
        case "unstable_legacy-backwards":
          for (n = null, s = e.child, e.child = null; s !== null; ) {
            if (t = s.alternate, t !== null && ns(t) === null) {
              e.child = s;
              break;
            }
            t = s.sibling, s.sibling = n, n = s, s = t;
          }
          ko(e, true, n, null, r, i);
          break;
        case "together":
          ko(e, false, null, null, void 0, i);
          break;
        default:
          e.memoizedState = null;
      }
      return e.child;
    }
    function cn(t, e, n) {
      if (t !== null && (e.dependencies = t.dependencies), _n |= e.lanes, (n & e.childLanes) === 0) if (t !== null) {
        if (La(t, e, n, false), (n & e.childLanes) === 0) return null;
      } else return null;
      if (t !== null && e.child !== t.child) throw Error(o(153));
      if (e.child !== null) {
        for (t = e.child, n = an(t, t.pendingProps), e.child = n, n.return = e; t.sibling !== null; ) t = t.sibling, n = n.sibling = an(t, t.pendingProps), n.return = e;
        n.sibling = null;
      }
      return e.child;
    }
    function Zo(t, e) {
      return (t.lanes & e) !== 0 ? true : (t = t.dependencies, !!(t !== null && Jl(t)));
    }
    function Qv(t, e, n) {
      switch (e.tag) {
        case 3:
          ue(e, e.stateNode.containerInfo), Mn(e, kt, t.memoizedState.cache), ia();
          break;
        case 27:
        case 5:
          yi(e);
          break;
        case 4:
          ue(e, e.stateNode.containerInfo);
          break;
        case 10:
          Mn(e, e.type, e.memoizedProps.value);
          break;
        case 31:
          if (e.memoizedState !== null) return e.flags |= 128, yo(e), null;
          break;
        case 13:
          var i = e.memoizedState;
          if (i !== null) return i.dehydrated !== null ? (Rn(e), e.flags |= 128, null) : (n & e.child.childLanes) !== 0 ? Rd(t, e, n) : (Rn(e), t = cn(t, e, n), t !== null ? t.sibling : null);
          Rn(e);
          break;
        case 19:
          var s = (t.flags & 128) !== 0;
          if (i = (n & e.childLanes) !== 0, i || (La(t, e, n, false), i = (n & e.childLanes) !== 0), s) {
            if (i) return Od(t, e, n);
            e.flags |= 128;
          }
          if (s = e.memoizedState, s !== null && (s.rendering = null, s.tail = null, s.lastEffect = null), Q(Gt, Gt.current), i) break;
          return null;
        case 22:
          return e.lanes = 0, Ad(t, e, n, e.pendingProps);
        case 24:
          Mn(e, kt, t.memoizedState.cache);
      }
      return cn(t, e, n);
    }
    function Nd(t, e, n) {
      if (t !== null) if (t.memoizedProps !== e.pendingProps) Kt = true;
      else {
        if (!Zo(t, n) && (e.flags & 128) === 0) return Kt = false, Qv(t, e, n);
        Kt = (t.flags & 131072) !== 0;
      }
      else Kt = false, vt && (e.flags & 1048576) !== 0 && ch(e, Oi, e.index);
      switch (e.lanes = 0, e.tag) {
        case 16:
          t: {
            var i = e.pendingProps;
            if (t = oa(e.elementType), e.type = t, typeof t == "function") Fu(t) ? (i = ha(t, i), e.tag = 1, e = Dd(null, e, t, i, n)) : (e.tag = 0, e = Lo(null, e, t, i, n));
            else {
              if (t != null) {
                var s = t.$$typeof;
                if (s === Z) {
                  e.tag = 11, e = Sd(null, e, t, i, n);
                  break t;
                } else if (s === et) {
                  e.tag = 14, e = xd(null, e, t, i, n);
                  break t;
                }
              }
              throw e = _t(t) || t, Error(o(306, e, ""));
            }
          }
          return e;
        case 0:
          return Lo(t, e, e.type, e.pendingProps, n);
        case 1:
          return i = e.type, s = ha(i, e.pendingProps), Dd(t, e, i, s, n);
        case 3:
          t: {
            if (ue(e, e.stateNode.containerInfo), t === null) throw Error(o(387));
            i = e.pendingProps;
            var r = e.memoizedState;
            s = r.element, co(t, e), Hi(e, i, null, n);
            var h = e.memoizedState;
            if (i = h.cache, Mn(e, kt, i), i !== r.cache && io(e, [
              kt
            ], n, true), Li(), i = h.element, r.isDehydrated) if (r = {
              element: i,
              isDehydrated: false,
              cache: h.cache
            }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
              e = zd(t, e, i, n);
              break t;
            } else if (i !== s) {
              s = Ne(Error(o(424)), e), Ni(s), e = zd(t, e, i, n);
              break t;
            } else {
              switch (t = e.stateNode.containerInfo, t.nodeType) {
                case 9:
                  t = t.body;
                  break;
                default:
                  t = t.nodeName === "HTML" ? t.ownerDocument.body : t;
              }
              for (Ot = Be(t.firstChild), te = e, vt = true, An = null, Ve = true, n = Ah(e, null, i, n), e.child = n; n; ) n.flags = n.flags & -3 | 4096, n = n.sibling;
            }
            else {
              if (ia(), i === s) {
                e = cn(t, e, n);
                break t;
              }
              ne(t, e, i, n);
            }
            e = e.child;
          }
          return e;
        case 26:
          return ds(t, e), t === null ? (n = Xm(e.type, null, e.pendingProps, null)) ? e.memoizedState = n : vt || (n = e.type, t = e.pendingProps, i = js(ht.current).createElement(n), i[It] = e, i[fe] = t, ae(i, n, t), Wt(i), e.stateNode = i) : e.memoizedState = Xm(e.type, t.memoizedProps, e.pendingProps, t.memoizedState), null;
        case 27:
          return yi(e), t === null && vt && (i = e.stateNode = qm(e.type, e.pendingProps, ht.current), te = e, Ve = true, s = Ot, Ln(e.type) ? (Er = s, Ot = Be(i.firstChild)) : Ot = s), ne(t, e, e.pendingProps.children, n), ds(t, e), t === null && (e.flags |= 4194304), e.child;
        case 5:
          return t === null && vt && ((s = i = Ot) && (i = A1(i, e.type, e.pendingProps, Ve), i !== null ? (e.stateNode = i, te = e, Ot = Be(i.firstChild), Ve = false, s = true) : s = false), s || En(e)), yi(e), s = e.type, r = e.pendingProps, h = t !== null ? t.memoizedProps : null, i = r.children, br(s, r) ? i = null : h !== null && br(s, h) && (e.flags |= 32), e.memoizedState !== null && (s = vo(t, e, Lv, null, null, n), ll._currentValue = s), ds(t, e), ne(t, e, i, n), e.child;
        case 6:
          return t === null && vt && ((t = n = Ot) && (n = E1(n, e.pendingProps, Ve), n !== null ? (e.stateNode = n, te = e, Ot = null, t = true) : t = false), t || En(e)), null;
        case 13:
          return Rd(t, e, n);
        case 4:
          return ue(e, e.stateNode.containerInfo), i = e.pendingProps, t === null ? e.child = ca(e, null, i, n) : ne(t, e, i, n), e.child;
        case 11:
          return Sd(t, e, e.type, e.pendingProps, n);
        case 7:
          return ne(t, e, e.pendingProps, n), e.child;
        case 8:
          return ne(t, e, e.pendingProps.children, n), e.child;
        case 12:
          return ne(t, e, e.pendingProps.children, n), e.child;
        case 10:
          return i = e.pendingProps, Mn(e, e.type, i.value), ne(t, e, i.children, n), e.child;
        case 9:
          return s = e.type._context, i = e.pendingProps.children, sa(e), s = ee(s), i = i(s), e.flags |= 1, ne(t, e, i, n), e.child;
        case 14:
          return xd(t, e, e.type, e.pendingProps, n);
        case 15:
          return Td(t, e, e.type, e.pendingProps, n);
        case 19:
          return Od(t, e, n);
        case 31:
          return Kv(t, e, n);
        case 22:
          return Ad(t, e, n, e.pendingProps);
        case 24:
          return sa(e), i = ee(kt), t === null ? (s = uo(), s === null && (s = zt, r = lo(), s.pooledCache = r, r.refCount++, r !== null && (s.pooledCacheLanes |= n), s = r), e.memoizedState = {
            parent: i,
            cache: s
          }, ro(e), Mn(e, kt, s)) : ((t.lanes & n) !== 0 && (co(t, e), Hi(e, null, null, n), Li()), s = t.memoizedState, r = e.memoizedState, s.parent !== i ? (s = {
            parent: i,
            cache: i
          }, e.memoizedState = s, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = s), Mn(e, kt, i)) : (i = r.cache, Mn(e, kt, i), i !== s.cache && io(e, [
            kt
          ], n, true))), ne(t, e, e.pendingProps.children, n), e.child;
        case 29:
          throw e.pendingProps;
      }
      throw Error(o(156, e.tag));
    }
    function fn(t) {
      t.flags |= 4;
    }
    function Ko(t, e, n, i, s) {
      if ((e = (t.mode & 32) !== 0) && (e = false), e) {
        if (t.flags |= 16777216, (s & 335544128) === s) if (t.stateNode.complete) t.flags |= 8192;
        else if (lm()) t.flags |= 8192;
        else throw ra = $l, oo;
      } else t.flags &= -16777217;
    }
    function _d(t, e) {
      if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0) t.flags &= -16777217;
      else if (t.flags |= 16777216, !Jm(e)) if (lm()) t.flags |= 8192;
      else throw ra = $l, oo;
    }
    function ps(t, e) {
      e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? hf() : 536870912, t.lanes |= e, Pa |= e);
    }
    function Zi(t, e) {
      if (!vt) switch (t.tailMode) {
        case "hidden":
          e = t.tail;
          for (var n = null; e !== null; ) e.alternate !== null && (n = e), e = e.sibling;
          n === null ? t.tail = null : n.sibling = null;
          break;
        case "collapsed":
          n = t.tail;
          for (var i = null; n !== null; ) n.alternate !== null && (i = n), n = n.sibling;
          i === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : i.sibling = null;
      }
    }
    function Nt(t) {
      var e = t.alternate !== null && t.alternate.child === t.child, n = 0, i = 0;
      if (e) for (var s = t.child; s !== null; ) n |= s.lanes | s.childLanes, i |= s.subtreeFlags & 65011712, i |= s.flags & 65011712, s.return = t, s = s.sibling;
      else for (s = t.child; s !== null; ) n |= s.lanes | s.childLanes, i |= s.subtreeFlags, i |= s.flags, s.return = t, s = s.sibling;
      return t.subtreeFlags |= i, t.childLanes = n, e;
    }
    function Jv(t, e, n) {
      var i = e.pendingProps;
      switch (Iu(e), e.tag) {
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return Nt(e), null;
        case 1:
          return Nt(e), null;
        case 3:
          return n = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), un(kt), Yt(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (t === null || t.child === null) && (Ba(e) ? fn(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, eo())), Nt(e), null;
        case 26:
          var s = e.type, r = e.memoizedState;
          return t === null ? (fn(e), r !== null ? (Nt(e), _d(e, r)) : (Nt(e), Ko(e, s, null, i, n))) : r ? r !== t.memoizedState ? (fn(e), Nt(e), _d(e, r)) : (Nt(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== i && fn(e), Nt(e), Ko(e, s, t, i, n)), null;
        case 27:
          if (Cl(e), n = ht.current, s = e.type, t !== null && e.stateNode != null) t.memoizedProps !== i && fn(e);
          else {
            if (!i) {
              if (e.stateNode === null) throw Error(o(166));
              return Nt(e), null;
            }
            t = P.current, Ba(e) ? hh(e) : (t = qm(s, i, n), e.stateNode = t, fn(e));
          }
          return Nt(e), null;
        case 5:
          if (Cl(e), s = e.type, t !== null && e.stateNode != null) t.memoizedProps !== i && fn(e);
          else {
            if (!i) {
              if (e.stateNode === null) throw Error(o(166));
              return Nt(e), null;
            }
            if (r = P.current, Ba(e)) hh(e);
            else {
              var h = js(ht.current);
              switch (r) {
                case 1:
                  r = h.createElementNS("http://www.w3.org/2000/svg", s);
                  break;
                case 2:
                  r = h.createElementNS("http://www.w3.org/1998/Math/MathML", s);
                  break;
                default:
                  switch (s) {
                    case "svg":
                      r = h.createElementNS("http://www.w3.org/2000/svg", s);
                      break;
                    case "math":
                      r = h.createElementNS("http://www.w3.org/1998/Math/MathML", s);
                      break;
                    case "script":
                      r = h.createElement("div"), r.innerHTML = "<script><\/script>", r = r.removeChild(r.firstChild);
                      break;
                    case "select":
                      r = typeof i.is == "string" ? h.createElement("select", {
                        is: i.is
                      }) : h.createElement("select"), i.multiple ? r.multiple = true : i.size && (r.size = i.size);
                      break;
                    default:
                      r = typeof i.is == "string" ? h.createElement(s, {
                        is: i.is
                      }) : h.createElement(s);
                  }
              }
              r[It] = e, r[fe] = i;
              t: for (h = e.child; h !== null; ) {
                if (h.tag === 5 || h.tag === 6) r.appendChild(h.stateNode);
                else if (h.tag !== 4 && h.tag !== 27 && h.child !== null) {
                  h.child.return = h, h = h.child;
                  continue;
                }
                if (h === e) break t;
                for (; h.sibling === null; ) {
                  if (h.return === null || h.return === e) break t;
                  h = h.return;
                }
                h.sibling.return = h.return, h = h.sibling;
              }
              e.stateNode = r;
              t: switch (ae(r, s, i), s) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  i = !!i.autoFocus;
                  break t;
                case "img":
                  i = true;
                  break t;
                default:
                  i = false;
              }
              i && fn(e);
            }
          }
          return Nt(e), Ko(e, e.type, t === null ? null : t.memoizedProps, e.pendingProps, n), null;
        case 6:
          if (t && e.stateNode != null) t.memoizedProps !== i && fn(e);
          else {
            if (typeof i != "string" && e.stateNode === null) throw Error(o(166));
            if (t = ht.current, Ba(e)) {
              if (t = e.stateNode, n = e.memoizedProps, i = null, s = te, s !== null) switch (s.tag) {
                case 27:
                case 5:
                  i = s.memoizedProps;
              }
              t[It] = e, t = !!(t.nodeValue === n || i !== null && i.suppressHydrationWarning === true || Rm(t.nodeValue, n)), t || En(e, true);
            } else t = js(t).createTextNode(i), t[It] = e, e.stateNode = t;
          }
          return Nt(e), null;
        case 31:
          if (n = e.memoizedState, t === null || t.memoizedState !== null) {
            if (i = Ba(e), n !== null) {
              if (t === null) {
                if (!i) throw Error(o(318));
                if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                t[It] = e;
              } else ia(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Nt(e), t = false;
            } else n = eo(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), t = true;
            if (!t) return e.flags & 256 ? (Ee(e), e) : (Ee(e), null);
            if ((e.flags & 128) !== 0) throw Error(o(558));
          }
          return Nt(e), null;
        case 13:
          if (i = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
            if (s = Ba(e), i !== null && i.dehydrated !== null) {
              if (t === null) {
                if (!s) throw Error(o(318));
                if (s = e.memoizedState, s = s !== null ? s.dehydrated : null, !s) throw Error(o(317));
                s[It] = e;
              } else ia(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
              Nt(e), s = false;
            } else s = eo(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = s), s = true;
            if (!s) return e.flags & 256 ? (Ee(e), e) : (Ee(e), null);
          }
          return Ee(e), (e.flags & 128) !== 0 ? (e.lanes = n, e) : (n = i !== null, t = t !== null && t.memoizedState !== null, n && (i = e.child, s = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (s = i.alternate.memoizedState.cachePool.pool), r = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (r = i.memoizedState.cachePool.pool), r !== s && (i.flags |= 2048)), n !== t && n && (e.child.flags |= 8192), ps(e, e.updateQueue), Nt(e), null);
        case 4:
          return Yt(), t === null && mr(e.stateNode.containerInfo), Nt(e), null;
        case 10:
          return un(e.type), Nt(e), null;
        case 19:
          if (B(Gt), i = e.memoizedState, i === null) return Nt(e), null;
          if (s = (e.flags & 128) !== 0, r = i.rendering, r === null) if (s) Zi(i, false);
          else {
            if (Ht !== 0 || t !== null && (t.flags & 128) !== 0) for (t = e.child; t !== null; ) {
              if (r = ns(t), r !== null) {
                for (e.flags |= 128, Zi(i, false), t = r.updateQueue, e.updateQueue = t, ps(e, t), e.subtreeFlags = 0, t = n, n = e.child; n !== null; ) uh(n, t), n = n.sibling;
                return Q(Gt, Gt.current & 1 | 2), vt && ln(e, i.treeForkCount), e.child;
              }
              t = t.sibling;
            }
            i.tail !== null && ve() > Ss && (e.flags |= 128, s = true, Zi(i, false), e.lanes = 4194304);
          }
          else {
            if (!s) if (t = ns(r), t !== null) {
              if (e.flags |= 128, s = true, t = t.updateQueue, e.updateQueue = t, ps(e, t), Zi(i, true), i.tail === null && i.tailMode === "hidden" && !r.alternate && !vt) return Nt(e), null;
            } else 2 * ve() - i.renderingStartTime > Ss && n !== 536870912 && (e.flags |= 128, s = true, Zi(i, false), e.lanes = 4194304);
            i.isBackwards ? (r.sibling = e.child, e.child = r) : (t = i.last, t !== null ? t.sibling = r : e.child = r, i.last = r);
          }
          return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = ve(), t.sibling = null, n = Gt.current, Q(Gt, s ? n & 1 | 2 : n & 1), vt && ln(e, i.treeForkCount), t) : (Nt(e), null);
        case 22:
        case 23:
          return Ee(e), po(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (n & 536870912) !== 0 && (e.flags & 128) === 0 && (Nt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Nt(e), n = e.updateQueue, n !== null && ps(e, n.retryQueue), n = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== n && (e.flags |= 2048), t !== null && B(ua), null;
        case 24:
          return n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), un(kt), Nt(e), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(o(156, e.tag));
    }
    function Fv(t, e) {
      switch (Iu(e), e.tag) {
        case 1:
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 3:
          return un(kt), Yt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
        case 26:
        case 27:
        case 5:
          return Cl(e), null;
        case 31:
          if (e.memoizedState !== null) {
            if (Ee(e), e.alternate === null) throw Error(o(340));
            ia();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 13:
          if (Ee(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
            if (e.alternate === null) throw Error(o(340));
            ia();
          }
          return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 19:
          return B(Gt), null;
        case 4:
          return Yt(), null;
        case 10:
          return un(e.type), null;
        case 22:
        case 23:
          return Ee(e), po(), t !== null && B(ua), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
        case 24:
          return un(kt), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function wd(t, e) {
      switch (Iu(e), e.tag) {
        case 3:
          un(kt), Yt();
          break;
        case 26:
        case 27:
        case 5:
          Cl(e);
          break;
        case 4:
          Yt();
          break;
        case 31:
          e.memoizedState !== null && Ee(e);
          break;
        case 13:
          Ee(e);
          break;
        case 19:
          B(Gt);
          break;
        case 10:
          un(e.type);
          break;
        case 22:
        case 23:
          Ee(e), po(), t !== null && B(ua);
          break;
        case 24:
          un(kt);
      }
    }
    function Ki(t, e) {
      try {
        var n = e.updateQueue, i = n !== null ? n.lastEffect : null;
        if (i !== null) {
          var s = i.next;
          n = s;
          do {
            if ((n.tag & t) === t) {
              i = void 0;
              var r = n.create, h = n.inst;
              i = r(), h.destroy = i;
            }
            n = n.next;
          } while (n !== s);
        }
      } catch (g) {
        Et(e, e.return, g);
      }
    }
    function On(t, e, n) {
      try {
        var i = e.updateQueue, s = i !== null ? i.lastEffect : null;
        if (s !== null) {
          var r = s.next;
          i = r;
          do {
            if ((i.tag & t) === t) {
              var h = i.inst, g = h.destroy;
              if (g !== void 0) {
                h.destroy = void 0, s = e;
                var T = n, R = g;
                try {
                  R();
                } catch (V) {
                  Et(s, T, V);
                }
              }
            }
            i = i.next;
          } while (i !== r);
        }
      } catch (V) {
        Et(e, e.return, V);
      }
    }
    function Vd(t) {
      var e = t.updateQueue;
      if (e !== null) {
        var n = t.stateNode;
        try {
          Mh(e, n);
        } catch (i) {
          Et(t, t.return, i);
        }
      }
    }
    function Ud(t, e, n) {
      n.props = ha(t.type, t.memoizedProps), n.state = t.memoizedState;
      try {
        n.componentWillUnmount();
      } catch (i) {
        Et(t, e, i);
      }
    }
    function Qi(t, e) {
      try {
        var n = t.ref;
        if (n !== null) {
          switch (t.tag) {
            case 26:
            case 27:
            case 5:
              var i = t.stateNode;
              break;
            case 30:
              i = t.stateNode;
              break;
            default:
              i = t.stateNode;
          }
          typeof n == "function" ? t.refCleanup = n(i) : n.current = i;
        }
      } catch (s) {
        Et(t, e, s);
      }
    }
    function Fe(t, e) {
      var n = t.ref, i = t.refCleanup;
      if (n !== null) if (typeof i == "function") try {
        i();
      } catch (s) {
        Et(t, e, s);
      } finally {
        t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
      }
      else if (typeof n == "function") try {
        n(null);
      } catch (s) {
        Et(t, e, s);
      }
      else n.current = null;
    }
    function Bd(t) {
      var e = t.type, n = t.memoizedProps, i = t.stateNode;
      try {
        t: switch (e) {
          case "button":
          case "input":
          case "select":
          case "textarea":
            n.autoFocus && i.focus();
            break t;
          case "img":
            n.src ? i.src = n.src : n.srcSet && (i.srcset = n.srcSet);
        }
      } catch (s) {
        Et(t, t.return, s);
      }
    }
    function Qo(t, e, n) {
      try {
        var i = t.stateNode;
        g1(i, t.type, n, e), i[fe] = e;
      } catch (s) {
        Et(t, t.return, s);
      }
    }
    function Ld(t) {
      return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && Ln(t.type) || t.tag === 4;
    }
    function Jo(t) {
      t: for (; ; ) {
        for (; t.sibling === null; ) {
          if (t.return === null || Ld(t.return)) return null;
          t = t.return;
        }
        for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
          if (t.tag === 27 && Ln(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
          t.child.return = t, t = t.child;
        }
        if (!(t.flags & 2)) return t.stateNode;
      }
    }
    function Fo(t, e, n) {
      var i = t.tag;
      if (i === 5 || i === 6) t = t.stateNode, e ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(t, e) : (e = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, e.appendChild(t), n = n._reactRootContainer, n != null || e.onclick !== null || (e.onclick = en));
      else if (i !== 4 && (i === 27 && Ln(t.type) && (n = t.stateNode, e = null), t = t.child, t !== null)) for (Fo(t, e, n), t = t.sibling; t !== null; ) Fo(t, e, n), t = t.sibling;
    }
    function ys(t, e, n) {
      var i = t.tag;
      if (i === 5 || i === 6) t = t.stateNode, e ? n.insertBefore(t, e) : n.appendChild(t);
      else if (i !== 4 && (i === 27 && Ln(t.type) && (n = t.stateNode), t = t.child, t !== null)) for (ys(t, e, n), t = t.sibling; t !== null; ) ys(t, e, n), t = t.sibling;
    }
    function Hd(t) {
      var e = t.stateNode, n = t.memoizedProps;
      try {
        for (var i = t.type, s = e.attributes; s.length; ) e.removeAttributeNode(s[0]);
        ae(e, i, n), e[It] = t, e[fe] = n;
      } catch (r) {
        Et(t, t.return, r);
      }
    }
    var hn = false, Qt = false, Po = false, qd = typeof WeakSet == "function" ? WeakSet : Set, $t = null;
    function Pv(t, e) {
      if (t = t.containerInfo, gr = Bs, t = $f(t), Gu(t)) {
        if ("selectionStart" in t) var n = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
        else t: {
          n = (n = t.ownerDocument) && n.defaultView || window;
          var i = n.getSelection && n.getSelection();
          if (i && i.rangeCount !== 0) {
            n = i.anchorNode;
            var s = i.anchorOffset, r = i.focusNode;
            i = i.focusOffset;
            try {
              n.nodeType, r.nodeType;
            } catch {
              n = null;
              break t;
            }
            var h = 0, g = -1, T = -1, R = 0, V = 0, H = t, j = null;
            e: for (; ; ) {
              for (var _; H !== n || s !== 0 && H.nodeType !== 3 || (g = h + s), H !== r || i !== 0 && H.nodeType !== 3 || (T = h + i), H.nodeType === 3 && (h += H.nodeValue.length), (_ = H.firstChild) !== null; ) j = H, H = _;
              for (; ; ) {
                if (H === t) break e;
                if (j === n && ++R === s && (g = h), j === r && ++V === i && (T = h), (_ = H.nextSibling) !== null) break;
                H = j, j = H.parentNode;
              }
              H = _;
            }
            n = g === -1 || T === -1 ? null : {
              start: g,
              end: T
            };
          } else n = null;
        }
        n = n || {
          start: 0,
          end: 0
        };
      } else n = null;
      for (vr = {
        focusedElem: t,
        selectionRange: n
      }, Bs = false, $t = e; $t !== null; ) if (e = $t, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null) t.return = e, $t = t;
      else for (; $t !== null; ) {
        switch (e = $t, r = e.alternate, t = e.flags, e.tag) {
          case 0:
            if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null)) for (n = 0; n < t.length; n++) s = t[n], s.ref.impl = s.nextImpl;
            break;
          case 11:
          case 15:
            break;
          case 1:
            if ((t & 1024) !== 0 && r !== null) {
              t = void 0, n = e, s = r.memoizedProps, r = r.memoizedState, i = n.stateNode;
              try {
                var W = ha(n.type, s);
                t = i.getSnapshotBeforeUpdate(W, r), i.__reactInternalSnapshotBeforeUpdate = t;
              } catch (lt) {
                Et(n, n.return, lt);
              }
            }
            break;
          case 3:
            if ((t & 1024) !== 0) {
              if (t = e.stateNode.containerInfo, n = t.nodeType, n === 9) xr(t);
              else if (n === 1) switch (t.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  xr(t);
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
          t.return = e.return, $t = t;
          break;
        }
        $t = e.return;
      }
    }
    function Yd(t, e, n) {
      var i = n.flags;
      switch (n.tag) {
        case 0:
        case 11:
        case 15:
          mn(t, n), i & 4 && Ki(5, n);
          break;
        case 1:
          if (mn(t, n), i & 4) if (t = n.stateNode, e === null) try {
            t.componentDidMount();
          } catch (h) {
            Et(n, n.return, h);
          }
          else {
            var s = ha(n.type, e.memoizedProps);
            e = e.memoizedState;
            try {
              t.componentDidUpdate(s, e, t.__reactInternalSnapshotBeforeUpdate);
            } catch (h) {
              Et(n, n.return, h);
            }
          }
          i & 64 && Vd(n), i & 512 && Qi(n, n.return);
          break;
        case 3:
          if (mn(t, n), i & 64 && (t = n.updateQueue, t !== null)) {
            if (e = null, n.child !== null) switch (n.child.tag) {
              case 27:
              case 5:
                e = n.child.stateNode;
                break;
              case 1:
                e = n.child.stateNode;
            }
            try {
              Mh(t, e);
            } catch (h) {
              Et(n, n.return, h);
            }
          }
          break;
        case 27:
          e === null && i & 4 && Hd(n);
        case 26:
        case 5:
          mn(t, n), e === null && i & 4 && Bd(n), i & 512 && Qi(n, n.return);
          break;
        case 12:
          mn(t, n);
          break;
        case 31:
          mn(t, n), i & 4 && kd(t, n);
          break;
        case 13:
          mn(t, n), i & 4 && Zd(t, n), i & 64 && (t = n.memoizedState, t !== null && (t = t.dehydrated, t !== null && (n = l1.bind(null, n), M1(t, n))));
          break;
        case 22:
          if (i = n.memoizedState !== null || hn, !i) {
            e = e !== null && e.memoizedState !== null || Qt, s = hn;
            var r = Qt;
            hn = i, (Qt = e) && !r ? pn(t, n, (n.subtreeFlags & 8772) !== 0) : mn(t, n), hn = s, Qt = r;
          }
          break;
        case 30:
          break;
        default:
          mn(t, n);
      }
    }
    function Gd(t) {
      var e = t.alternate;
      e !== null && (t.alternate = null, Gd(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Mu(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
    }
    var wt = null, de = false;
    function dn(t, e, n) {
      for (n = n.child; n !== null; ) Xd(t, e, n), n = n.sibling;
    }
    function Xd(t, e, n) {
      if (be && typeof be.onCommitFiberUnmount == "function") try {
        be.onCommitFiberUnmount(gi, n);
      } catch {
      }
      switch (n.tag) {
        case 26:
          Qt || Fe(n, e), dn(t, e, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && (n = n.stateNode, n.parentNode.removeChild(n));
          break;
        case 27:
          Qt || Fe(n, e);
          var i = wt, s = de;
          Ln(n.type) && (wt = n.stateNode, de = false), dn(t, e, n), nl(n.stateNode), wt = i, de = s;
          break;
        case 5:
          Qt || Fe(n, e);
        case 6:
          if (i = wt, s = de, wt = null, dn(t, e, n), wt = i, de = s, wt !== null) if (de) try {
            (wt.nodeType === 9 ? wt.body : wt.nodeName === "HTML" ? wt.ownerDocument.body : wt).removeChild(n.stateNode);
          } catch (r) {
            Et(n, e, r);
          }
          else try {
            wt.removeChild(n.stateNode);
          } catch (r) {
            Et(n, e, r);
          }
          break;
        case 18:
          wt !== null && (de ? (t = wt, Vm(t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t, n.stateNode), ii(t)) : Vm(wt, n.stateNode));
          break;
        case 4:
          i = wt, s = de, wt = n.stateNode.containerInfo, de = true, dn(t, e, n), wt = i, de = s;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          On(2, n, e), Qt || On(4, n, e), dn(t, e, n);
          break;
        case 1:
          Qt || (Fe(n, e), i = n.stateNode, typeof i.componentWillUnmount == "function" && Ud(n, e, i)), dn(t, e, n);
          break;
        case 21:
          dn(t, e, n);
          break;
        case 22:
          Qt = (i = Qt) || n.memoizedState !== null, dn(t, e, n), Qt = i;
          break;
        default:
          dn(t, e, n);
      }
    }
    function kd(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
        t = t.dehydrated;
        try {
          ii(t);
        } catch (n) {
          Et(e, e.return, n);
        }
      }
    }
    function Zd(t, e) {
      if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null)))) try {
        ii(t);
      } catch (n) {
        Et(e, e.return, n);
      }
    }
    function Wv(t) {
      switch (t.tag) {
        case 31:
        case 13:
        case 19:
          var e = t.stateNode;
          return e === null && (e = t.stateNode = new qd()), e;
        case 22:
          return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new qd()), e;
        default:
          throw Error(o(435, t.tag));
      }
    }
    function gs(t, e) {
      var n = Wv(t);
      e.forEach(function(i) {
        if (!n.has(i)) {
          n.add(i);
          var s = s1.bind(null, t, i);
          i.then(s, s);
        }
      });
    }
    function me(t, e) {
      var n = e.deletions;
      if (n !== null) for (var i = 0; i < n.length; i++) {
        var s = n[i], r = t, h = e, g = h;
        t: for (; g !== null; ) {
          switch (g.tag) {
            case 27:
              if (Ln(g.type)) {
                wt = g.stateNode, de = false;
                break t;
              }
              break;
            case 5:
              wt = g.stateNode, de = false;
              break t;
            case 3:
            case 4:
              wt = g.stateNode.containerInfo, de = true;
              break t;
          }
          g = g.return;
        }
        if (wt === null) throw Error(o(160));
        Xd(r, h, s), wt = null, de = false, r = s.alternate, r !== null && (r.return = null), s.return = null;
      }
      if (e.subtreeFlags & 13886) for (e = e.child; e !== null; ) Kd(e, t), e = e.sibling;
    }
    var Ge = null;
    function Kd(t, e) {
      var n = t.alternate, i = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          me(e, t), pe(t), i & 4 && (On(3, t, t.return), Ki(3, t), On(5, t, t.return));
          break;
        case 1:
          me(e, t), pe(t), i & 512 && (Qt || n === null || Fe(n, n.return)), i & 64 && hn && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (n = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = n === null ? i : n.concat(i))));
          break;
        case 26:
          var s = Ge;
          if (me(e, t), pe(t), i & 512 && (Qt || n === null || Fe(n, n.return)), i & 4) {
            var r = n !== null ? n.memoizedState : null;
            if (i = t.memoizedState, n === null) if (i === null) if (t.stateNode === null) {
              t: {
                i = t.type, n = t.memoizedProps, s = s.ownerDocument || s;
                e: switch (i) {
                  case "title":
                    r = s.getElementsByTagName("title")[0], (!r || r[Si] || r[It] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = s.createElement(i), s.head.insertBefore(r, s.querySelector("head > title"))), ae(r, i, n), r[It] = t, Wt(r), i = r;
                    break t;
                  case "link":
                    var h = Km("link", "href", s).get(i + (n.href || ""));
                    if (h) {
                      for (var g = 0; g < h.length; g++) if (r = h[g], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
                        h.splice(g, 1);
                        break e;
                      }
                    }
                    r = s.createElement(i), ae(r, i, n), s.head.appendChild(r);
                    break;
                  case "meta":
                    if (h = Km("meta", "content", s).get(i + (n.content || ""))) {
                      for (g = 0; g < h.length; g++) if (r = h[g], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
                        h.splice(g, 1);
                        break e;
                      }
                    }
                    r = s.createElement(i), ae(r, i, n), s.head.appendChild(r);
                    break;
                  default:
                    throw Error(o(468, i));
                }
                r[It] = t, Wt(r), i = r;
              }
              t.stateNode = i;
            } else Qm(s, t.type, t.stateNode);
            else t.stateNode = Zm(s, i, t.memoizedProps);
            else r !== i ? (r === null ? n.stateNode !== null && (n = n.stateNode, n.parentNode.removeChild(n)) : r.count--, i === null ? Qm(s, t.type, t.stateNode) : Zm(s, i, t.memoizedProps)) : i === null && t.stateNode !== null && Qo(t, t.memoizedProps, n.memoizedProps);
          }
          break;
        case 27:
          me(e, t), pe(t), i & 512 && (Qt || n === null || Fe(n, n.return)), n !== null && i & 4 && Qo(t, t.memoizedProps, n.memoizedProps);
          break;
        case 5:
          if (me(e, t), pe(t), i & 512 && (Qt || n === null || Fe(n, n.return)), t.flags & 32) {
            s = t.stateNode;
            try {
              Da(s, "");
            } catch (W) {
              Et(t, t.return, W);
            }
          }
          i & 4 && t.stateNode != null && (s = t.memoizedProps, Qo(t, s, n !== null ? n.memoizedProps : s)), i & 1024 && (Po = true);
          break;
        case 6:
          if (me(e, t), pe(t), i & 4) {
            if (t.stateNode === null) throw Error(o(162));
            i = t.memoizedProps, n = t.stateNode;
            try {
              n.nodeValue = i;
            } catch (W) {
              Et(t, t.return, W);
            }
          }
          break;
        case 3:
          if (_s = null, s = Ge, Ge = Os(e.containerInfo), me(e, t), Ge = s, pe(t), i & 4 && n !== null && n.memoizedState.isDehydrated) try {
            ii(e.containerInfo);
          } catch (W) {
            Et(t, t.return, W);
          }
          Po && (Po = false, Qd(t));
          break;
        case 4:
          i = Ge, Ge = Os(t.stateNode.containerInfo), me(e, t), pe(t), Ge = i;
          break;
        case 12:
          me(e, t), pe(t);
          break;
        case 31:
          me(e, t), pe(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, gs(t, i)));
          break;
        case 13:
          me(e, t), pe(t), t.child.flags & 8192 && t.memoizedState !== null != (n !== null && n.memoizedState !== null) && (bs = ve()), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, gs(t, i)));
          break;
        case 22:
          s = t.memoizedState !== null;
          var T = n !== null && n.memoizedState !== null, R = hn, V = Qt;
          if (hn = R || s, Qt = V || T, me(e, t), Qt = V, hn = R, pe(t), i & 8192) t: for (e = t.stateNode, e._visibility = s ? e._visibility & -2 : e._visibility | 1, s && (n === null || T || hn || Qt || da(t)), n = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (n === null) {
                T = n = e;
                try {
                  if (r = T.stateNode, s) h = r.style, typeof h.setProperty == "function" ? h.setProperty("display", "none", "important") : h.display = "none";
                  else {
                    g = T.stateNode;
                    var H = T.memoizedProps.style, j = H != null && H.hasOwnProperty("display") ? H.display : null;
                    g.style.display = j == null || typeof j == "boolean" ? "" : ("" + j).trim();
                  }
                } catch (W) {
                  Et(T, T.return, W);
                }
              }
            } else if (e.tag === 6) {
              if (n === null) {
                T = e;
                try {
                  T.stateNode.nodeValue = s ? "" : T.memoizedProps;
                } catch (W) {
                  Et(T, T.return, W);
                }
              }
            } else if (e.tag === 18) {
              if (n === null) {
                T = e;
                try {
                  var _ = T.stateNode;
                  s ? Um(_, true) : Um(T.stateNode, false);
                } catch (W) {
                  Et(T, T.return, W);
                }
              }
            } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break t;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) break t;
              n === e && (n = null), e = e.return;
            }
            n === e && (n = null), e.sibling.return = e.return, e = e.sibling;
          }
          i & 4 && (i = t.updateQueue, i !== null && (n = i.retryQueue, n !== null && (i.retryQueue = null, gs(t, n))));
          break;
        case 19:
          me(e, t), pe(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, gs(t, i)));
          break;
        case 30:
          break;
        case 21:
          break;
        default:
          me(e, t), pe(t);
      }
    }
    function pe(t) {
      var e = t.flags;
      if (e & 2) {
        try {
          for (var n, i = t.return; i !== null; ) {
            if (Ld(i)) {
              n = i;
              break;
            }
            i = i.return;
          }
          if (n == null) throw Error(o(160));
          switch (n.tag) {
            case 27:
              var s = n.stateNode, r = Jo(t);
              ys(t, r, s);
              break;
            case 5:
              var h = n.stateNode;
              n.flags & 32 && (Da(h, ""), n.flags &= -33);
              var g = Jo(t);
              ys(t, g, h);
              break;
            case 3:
            case 4:
              var T = n.stateNode.containerInfo, R = Jo(t);
              Fo(t, R, T);
              break;
            default:
              throw Error(o(161));
          }
        } catch (V) {
          Et(t, t.return, V);
        }
        t.flags &= -3;
      }
      e & 4096 && (t.flags &= -4097);
    }
    function Qd(t) {
      if (t.subtreeFlags & 1024) for (t = t.child; t !== null; ) {
        var e = t;
        Qd(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
    }
    function mn(t, e) {
      if (e.subtreeFlags & 8772) for (e = e.child; e !== null; ) Yd(t, e.alternate, e), e = e.sibling;
    }
    function da(t) {
      for (t = t.child; t !== null; ) {
        var e = t;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            On(4, e, e.return), da(e);
            break;
          case 1:
            Fe(e, e.return);
            var n = e.stateNode;
            typeof n.componentWillUnmount == "function" && Ud(e, e.return, n), da(e);
            break;
          case 27:
            nl(e.stateNode);
          case 26:
          case 5:
            Fe(e, e.return), da(e);
            break;
          case 22:
            e.memoizedState === null && da(e);
            break;
          case 30:
            da(e);
            break;
          default:
            da(e);
        }
        t = t.sibling;
      }
    }
    function pn(t, e, n) {
      for (n = n && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
        var i = e.alternate, s = t, r = e, h = r.flags;
        switch (r.tag) {
          case 0:
          case 11:
          case 15:
            pn(s, r, n), Ki(4, r);
            break;
          case 1:
            if (pn(s, r, n), i = r, s = i.stateNode, typeof s.componentDidMount == "function") try {
              s.componentDidMount();
            } catch (R) {
              Et(i, i.return, R);
            }
            if (i = r, s = i.updateQueue, s !== null) {
              var g = i.stateNode;
              try {
                var T = s.shared.hiddenCallbacks;
                if (T !== null) for (s.shared.hiddenCallbacks = null, s = 0; s < T.length; s++) Eh(T[s], g);
              } catch (R) {
                Et(i, i.return, R);
              }
            }
            n && h & 64 && Vd(r), Qi(r, r.return);
            break;
          case 27:
            Hd(r);
          case 26:
          case 5:
            pn(s, r, n), n && i === null && h & 4 && Bd(r), Qi(r, r.return);
            break;
          case 12:
            pn(s, r, n);
            break;
          case 31:
            pn(s, r, n), n && h & 4 && kd(s, r);
            break;
          case 13:
            pn(s, r, n), n && h & 4 && Zd(s, r);
            break;
          case 22:
            r.memoizedState === null && pn(s, r, n), Qi(r, r.return);
            break;
          case 30:
            break;
          default:
            pn(s, r, n);
        }
        e = e.sibling;
      }
    }
    function Wo(t, e) {
      var n = null;
      t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (n = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== n && (t != null && t.refCount++, n != null && _i(n));
    }
    function $o(t, e) {
      t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && _i(t));
    }
    function Xe(t, e, n, i) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) Jd(t, e, n, i), e = e.sibling;
    }
    function Jd(t, e, n, i) {
      var s = e.flags;
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          Xe(t, e, n, i), s & 2048 && Ki(9, e);
          break;
        case 1:
          Xe(t, e, n, i);
          break;
        case 3:
          Xe(t, e, n, i), s & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && _i(t)));
          break;
        case 12:
          if (s & 2048) {
            Xe(t, e, n, i), t = e.stateNode;
            try {
              var r = e.memoizedProps, h = r.id, g = r.onPostCommit;
              typeof g == "function" && g(h, e.alternate === null ? "mount" : "update", t.passiveEffectDuration, -0);
            } catch (T) {
              Et(e, e.return, T);
            }
          } else Xe(t, e, n, i);
          break;
        case 31:
          Xe(t, e, n, i);
          break;
        case 13:
          Xe(t, e, n, i);
          break;
        case 23:
          break;
        case 22:
          r = e.stateNode, h = e.alternate, e.memoizedState !== null ? r._visibility & 2 ? Xe(t, e, n, i) : Ji(t, e) : r._visibility & 2 ? Xe(t, e, n, i) : (r._visibility |= 2, Qa(t, e, n, i, (e.subtreeFlags & 10256) !== 0 || false)), s & 2048 && Wo(h, e);
          break;
        case 24:
          Xe(t, e, n, i), s & 2048 && $o(e.alternate, e);
          break;
        default:
          Xe(t, e, n, i);
      }
    }
    function Qa(t, e, n, i, s) {
      for (s = s && ((e.subtreeFlags & 10256) !== 0 || false), e = e.child; e !== null; ) {
        var r = t, h = e, g = n, T = i, R = h.flags;
        switch (h.tag) {
          case 0:
          case 11:
          case 15:
            Qa(r, h, g, T, s), Ki(8, h);
            break;
          case 23:
            break;
          case 22:
            var V = h.stateNode;
            h.memoizedState !== null ? V._visibility & 2 ? Qa(r, h, g, T, s) : Ji(r, h) : (V._visibility |= 2, Qa(r, h, g, T, s)), s && R & 2048 && Wo(h.alternate, h);
            break;
          case 24:
            Qa(r, h, g, T, s), s && R & 2048 && $o(h.alternate, h);
            break;
          default:
            Qa(r, h, g, T, s);
        }
        e = e.sibling;
      }
    }
    function Ji(t, e) {
      if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) {
        var n = t, i = e, s = i.flags;
        switch (i.tag) {
          case 22:
            Ji(n, i), s & 2048 && Wo(i.alternate, i);
            break;
          case 24:
            Ji(n, i), s & 2048 && $o(i.alternate, i);
            break;
          default:
            Ji(n, i);
        }
        e = e.sibling;
      }
    }
    var Fi = 8192;
    function Ja(t, e, n) {
      if (t.subtreeFlags & Fi) for (t = t.child; t !== null; ) Fd(t, e, n), t = t.sibling;
    }
    function Fd(t, e, n) {
      switch (t.tag) {
        case 26:
          Ja(t, e, n), t.flags & Fi && t.memoizedState !== null && B1(n, Ge, t.memoizedState, t.memoizedProps);
          break;
        case 5:
          Ja(t, e, n);
          break;
        case 3:
        case 4:
          var i = Ge;
          Ge = Os(t.stateNode.containerInfo), Ja(t, e, n), Ge = i;
          break;
        case 22:
          t.memoizedState === null && (i = t.alternate, i !== null && i.memoizedState !== null ? (i = Fi, Fi = 16777216, Ja(t, e, n), Fi = i) : Ja(t, e, n));
          break;
        default:
          Ja(t, e, n);
      }
    }
    function Pd(t) {
      var e = t.alternate;
      if (e !== null && (t = e.child, t !== null)) {
        e.child = null;
        do
          e = t.sibling, t.sibling = null, t = e;
        while (t !== null);
      }
    }
    function Pi(t) {
      var e = t.deletions;
      if ((t.flags & 16) !== 0) {
        if (e !== null) for (var n = 0; n < e.length; n++) {
          var i = e[n];
          $t = i, $d(i, t);
        }
        Pd(t);
      }
      if (t.subtreeFlags & 10256) for (t = t.child; t !== null; ) Wd(t), t = t.sibling;
    }
    function Wd(t) {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          Pi(t), t.flags & 2048 && On(9, t, t.return);
          break;
        case 3:
          Pi(t);
          break;
        case 12:
          Pi(t);
          break;
        case 22:
          var e = t.stateNode;
          t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, vs(t)) : Pi(t);
          break;
        default:
          Pi(t);
      }
    }
    function vs(t) {
      var e = t.deletions;
      if ((t.flags & 16) !== 0) {
        if (e !== null) for (var n = 0; n < e.length; n++) {
          var i = e[n];
          $t = i, $d(i, t);
        }
        Pd(t);
      }
      for (t = t.child; t !== null; ) {
        switch (e = t, e.tag) {
          case 0:
          case 11:
          case 15:
            On(8, e, e.return), vs(e);
            break;
          case 22:
            n = e.stateNode, n._visibility & 2 && (n._visibility &= -3, vs(e));
            break;
          default:
            vs(e);
        }
        t = t.sibling;
      }
    }
    function $d(t, e) {
      for (; $t !== null; ) {
        var n = $t;
        switch (n.tag) {
          case 0:
          case 11:
          case 15:
            On(8, n, e);
            break;
          case 23:
          case 22:
            if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
              var i = n.memoizedState.cachePool.pool;
              i != null && i.refCount++;
            }
            break;
          case 24:
            _i(n.memoizedState.cache);
        }
        if (i = n.child, i !== null) i.return = n, $t = i;
        else t: for (n = t; $t !== null; ) {
          i = $t;
          var s = i.sibling, r = i.return;
          if (Gd(i), i === n) {
            $t = null;
            break t;
          }
          if (s !== null) {
            s.return = r, $t = s;
            break t;
          }
          $t = r;
        }
      }
    }
    var $v = {
      getCacheForType: function(t) {
        var e = ee(kt), n = e.data.get(t);
        return n === void 0 && (n = t(), e.data.set(t, n)), n;
      },
      cacheSignal: function() {
        return ee(kt).controller.signal;
      }
    }, Iv = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, zt = null, dt = null, yt = 0, At = 0, Me = null, Nn = false, Fa = false, Io = false, yn = 0, Ht = 0, _n = 0, ma = 0, tr = 0, Ce = 0, Pa = 0, Wi = null, ye = null, er = false, bs = 0, Id = 0, Ss = 1 / 0, xs = null, wn = null, Ft = 0, Vn = null, Wa = null, gn = 0, nr = 0, ar = null, tm = null, $i = 0, ir = null;
    function De() {
      return (xt & 2) !== 0 && yt !== 0 ? yt & -yt : x.T !== null ? cr() : yf();
    }
    function em() {
      if (Ce === 0) if ((yt & 536870912) === 0 || vt) {
        var t = Rl;
        Rl <<= 1, (Rl & 3932160) === 0 && (Rl = 262144), Ce = t;
      } else Ce = 536870912;
      return t = Ae.current, t !== null && (t.flags |= 32), Ce;
    }
    function ge(t, e, n) {
      (t === zt && (At === 2 || At === 9) || t.cancelPendingCommit !== null) && ($a(t, 0), Un(t, yt, Ce, false)), bi(t, n), ((xt & 2) === 0 || t !== zt) && (t === zt && ((xt & 2) === 0 && (ma |= n), Ht === 4 && Un(t, yt, Ce, false)), Pe(t));
    }
    function nm(t, e, n) {
      if ((xt & 6) !== 0) throw Error(o(327));
      var i = !n && (e & 127) === 0 && (e & t.expiredLanes) === 0 || vi(t, e), s = i ? n1(t, e) : sr(t, e, true), r = i;
      do {
        if (s === 0) {
          Fa && !i && Un(t, e, 0, false);
          break;
        } else {
          if (n = t.current.alternate, r && !t1(n)) {
            s = sr(t, e, false), r = false;
            continue;
          }
          if (s === 2) {
            if (r = e, t.errorRecoveryDisabledLanes & r) var h = 0;
            else h = t.pendingLanes & -536870913, h = h !== 0 ? h : h & 536870912 ? 536870912 : 0;
            if (h !== 0) {
              e = h;
              t: {
                var g = t;
                s = Wi;
                var T = g.current.memoizedState.isDehydrated;
                if (T && ($a(g, h).flags |= 256), h = sr(g, h, false), h !== 2) {
                  if (Io && !T) {
                    g.errorRecoveryDisabledLanes |= r, ma |= r, s = 4;
                    break t;
                  }
                  r = ye, ye = s, r !== null && (ye === null ? ye = r : ye.push.apply(ye, r));
                }
                s = h;
              }
              if (r = false, s !== 2) continue;
            }
          }
          if (s === 1) {
            $a(t, 0), Un(t, e, 0, true);
            break;
          }
          t: {
            switch (i = t, r = s, r) {
              case 0:
              case 1:
                throw Error(o(345));
              case 4:
                if ((e & 4194048) !== e) break;
              case 6:
                Un(i, e, Ce, !Nn);
                break t;
              case 2:
                ye = null;
                break;
              case 3:
              case 5:
                break;
              default:
                throw Error(o(329));
            }
            if ((e & 62914560) === e && (s = bs + 300 - ve(), 10 < s)) {
              if (Un(i, e, Ce, !Nn), Ol(i, 0, true) !== 0) break t;
              gn = e, i.timeoutHandle = _m(am.bind(null, i, n, ye, xs, er, e, Ce, ma, Pa, Nn, r, "Throttled", -0, 0), s);
              break t;
            }
            am(i, n, ye, xs, er, e, Ce, ma, Pa, Nn, r, null, -0, 0);
          }
        }
        break;
      } while (true);
      Pe(t);
    }
    function am(t, e, n, i, s, r, h, g, T, R, V, H, j, _) {
      if (t.timeoutHandle = -1, H = e.subtreeFlags, H & 8192 || (H & 16785408) === 16785408) {
        H = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: true,
          waitingForViewTransition: false,
          unsuspend: en
        }, Fd(e, r, H);
        var W = (r & 62914560) === r ? bs - ve() : (r & 4194048) === r ? Id - ve() : 0;
        if (W = L1(H, W), W !== null) {
          gn = r, t.cancelPendingCommit = W(fm.bind(null, t, e, r, n, i, s, h, g, T, V, H, null, j, _)), Un(t, r, h, !R);
          return;
        }
      }
      fm(t, e, r, n, i, s, h, g, T);
    }
    function t1(t) {
      for (var e = t; ; ) {
        var n = e.tag;
        if ((n === 0 || n === 11 || n === 15) && e.flags & 16384 && (n = e.updateQueue, n !== null && (n = n.stores, n !== null))) for (var i = 0; i < n.length; i++) {
          var s = n[i], r = s.getSnapshot;
          s = s.value;
          try {
            if (!xe(r(), s)) return false;
          } catch {
            return false;
          }
        }
        if (n = e.child, e.subtreeFlags & 16384 && n !== null) n.return = e, e = n;
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
    function Un(t, e, n, i) {
      e &= ~tr, e &= ~ma, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
      for (var s = e; 0 < s; ) {
        var r = 31 - Se(s), h = 1 << r;
        i[r] = -1, s &= ~h;
      }
      n !== 0 && df(t, n, e);
    }
    function Ts() {
      return (xt & 6) === 0 ? (Ii(0), false) : true;
    }
    function lr() {
      if (dt !== null) {
        if (At === 0) var t = dt.return;
        else t = dt, sn = la = null, xo(t), Ga = null, Vi = 0, t = dt;
        for (; t !== null; ) wd(t.alternate, t), t = t.return;
        dt = null;
      }
    }
    function $a(t, e) {
      var n = t.timeoutHandle;
      n !== -1 && (t.timeoutHandle = -1, S1(n)), n = t.cancelPendingCommit, n !== null && (t.cancelPendingCommit = null, n()), gn = 0, lr(), zt = t, dt = n = an(t.current, null), yt = e, At = 0, Me = null, Nn = false, Fa = vi(t, e), Io = false, Pa = Ce = tr = ma = _n = Ht = 0, ye = Wi = null, er = false, (e & 8) !== 0 && (e |= e & 32);
      var i = t.entangledLanes;
      if (i !== 0) for (t = t.entanglements, i &= e; 0 < i; ) {
        var s = 31 - Se(i), r = 1 << s;
        e |= t[s], i &= ~r;
      }
      return yn = e, Xl(), n;
    }
    function im(t, e) {
      rt = null, x.H = Xi, e === Ya || e === Wl ? (e = Sh(), At = 3) : e === oo ? (e = Sh(), At = 4) : At = e === Bo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Me = e, dt === null && (Ht = 1, fs(t, Ne(e, t.current)));
    }
    function lm() {
      var t = Ae.current;
      return t === null ? true : (yt & 4194048) === yt ? Ue === null : (yt & 62914560) === yt || (yt & 536870912) !== 0 ? t === Ue : false;
    }
    function sm() {
      var t = x.H;
      return x.H = Xi, t === null ? Xi : t;
    }
    function um() {
      var t = x.A;
      return x.A = $v, t;
    }
    function As() {
      Ht = 4, Nn || (yt & 4194048) !== yt && Ae.current !== null || (Fa = true), (_n & 134217727) === 0 && (ma & 134217727) === 0 || zt === null || Un(zt, yt, Ce, false);
    }
    function sr(t, e, n) {
      var i = xt;
      xt |= 2;
      var s = sm(), r = um();
      (zt !== t || yt !== e) && (xs = null, $a(t, e)), e = false;
      var h = Ht;
      t: do
        try {
          if (At !== 0 && dt !== null) {
            var g = dt, T = Me;
            switch (At) {
              case 8:
                lr(), h = 6;
                break t;
              case 3:
              case 2:
              case 9:
              case 6:
                Ae.current === null && (e = true);
                var R = At;
                if (At = 0, Me = null, Ia(t, g, T, R), n && Fa) {
                  h = 0;
                  break t;
                }
                break;
              default:
                R = At, At = 0, Me = null, Ia(t, g, T, R);
            }
          }
          e1(), h = Ht;
          break;
        } catch (V) {
          im(t, V);
        }
      while (true);
      return e && t.shellSuspendCounter++, sn = la = null, xt = i, x.H = s, x.A = r, dt === null && (zt = null, yt = 0, Xl()), h;
    }
    function e1() {
      for (; dt !== null; ) om(dt);
    }
    function n1(t, e) {
      var n = xt;
      xt |= 2;
      var i = sm(), s = um();
      zt !== t || yt !== e ? (xs = null, Ss = ve() + 500, $a(t, e)) : Fa = vi(t, e);
      t: do
        try {
          if (At !== 0 && dt !== null) {
            e = dt;
            var r = Me;
            e: switch (At) {
              case 1:
                At = 0, Me = null, Ia(t, e, r, 1);
                break;
              case 2:
              case 9:
                if (vh(r)) {
                  At = 0, Me = null, rm(e);
                  break;
                }
                e = function() {
                  At !== 2 && At !== 9 || zt !== t || (At = 7), Pe(t);
                }, r.then(e, e);
                break t;
              case 3:
                At = 7;
                break t;
              case 4:
                At = 5;
                break t;
              case 7:
                vh(r) ? (At = 0, Me = null, rm(e)) : (At = 0, Me = null, Ia(t, e, r, 7));
                break;
              case 5:
                var h = null;
                switch (dt.tag) {
                  case 26:
                    h = dt.memoizedState;
                  case 5:
                  case 27:
                    var g = dt;
                    if (h ? Jm(h) : g.stateNode.complete) {
                      At = 0, Me = null;
                      var T = g.sibling;
                      if (T !== null) dt = T;
                      else {
                        var R = g.return;
                        R !== null ? (dt = R, Es(R)) : dt = null;
                      }
                      break e;
                    }
                }
                At = 0, Me = null, Ia(t, e, r, 5);
                break;
              case 6:
                At = 0, Me = null, Ia(t, e, r, 6);
                break;
              case 8:
                lr(), Ht = 6;
                break t;
              default:
                throw Error(o(462));
            }
          }
          a1();
          break;
        } catch (V) {
          im(t, V);
        }
      while (true);
      return sn = la = null, x.H = i, x.A = s, xt = n, dt !== null ? 0 : (zt = null, yt = 0, Xl(), Ht);
    }
    function a1() {
      for (; dt !== null && !Cg(); ) om(dt);
    }
    function om(t) {
      var e = Nd(t.alternate, t, yn);
      t.memoizedProps = t.pendingProps, e === null ? Es(t) : dt = e;
    }
    function rm(t) {
      var e = t, n = e.alternate;
      switch (e.tag) {
        case 15:
        case 0:
          e = Cd(n, e, e.pendingProps, e.type, void 0, yt);
          break;
        case 11:
          e = Cd(n, e, e.pendingProps, e.type.render, e.ref, yt);
          break;
        case 5:
          xo(e);
        default:
          wd(n, e), e = dt = uh(e, yn), e = Nd(n, e, yn);
      }
      t.memoizedProps = t.pendingProps, e === null ? Es(t) : dt = e;
    }
    function Ia(t, e, n, i) {
      sn = la = null, xo(e), Ga = null, Vi = 0;
      var s = e.return;
      try {
        if (Zv(t, s, e, n, yt)) {
          Ht = 1, fs(t, Ne(n, t.current)), dt = null;
          return;
        }
      } catch (r) {
        if (s !== null) throw dt = s, r;
        Ht = 1, fs(t, Ne(n, t.current)), dt = null;
        return;
      }
      e.flags & 32768 ? (vt || i === 1 ? t = true : Fa || (yt & 536870912) !== 0 ? t = false : (Nn = t = true, (i === 2 || i === 9 || i === 3 || i === 6) && (i = Ae.current, i !== null && i.tag === 13 && (i.flags |= 16384))), cm(e, t)) : Es(e);
    }
    function Es(t) {
      var e = t;
      do {
        if ((e.flags & 32768) !== 0) {
          cm(e, Nn);
          return;
        }
        t = e.return;
        var n = Jv(e.alternate, e, yn);
        if (n !== null) {
          dt = n;
          return;
        }
        if (e = e.sibling, e !== null) {
          dt = e;
          return;
        }
        dt = e = t;
      } while (e !== null);
      Ht === 0 && (Ht = 5);
    }
    function cm(t, e) {
      do {
        var n = Fv(t.alternate, t);
        if (n !== null) {
          n.flags &= 32767, dt = n;
          return;
        }
        if (n = t.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !e && (t = t.sibling, t !== null)) {
          dt = t;
          return;
        }
        dt = t = n;
      } while (t !== null);
      Ht = 6, dt = null;
    }
    function fm(t, e, n, i, s, r, h, g, T) {
      t.cancelPendingCommit = null;
      do
        Ms();
      while (Ft !== 0);
      if ((xt & 6) !== 0) throw Error(o(327));
      if (e !== null) {
        if (e === t.current) throw Error(o(177));
        if (r = e.lanes | e.childLanes, r |= Qu, Ug(t, n, r, h, g, T), t === zt && (dt = zt = null, yt = 0), Wa = e, Vn = t, gn = n, nr = r, ar = s, tm = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, u1(Dl, function() {
          return ym(), null;
        })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
          i = x.T, x.T = null, s = O.p, O.p = 2, h = xt, xt |= 4;
          try {
            Pv(t, e, n);
          } finally {
            xt = h, O.p = s, x.T = i;
          }
        }
        Ft = 1, hm(), dm(), mm();
      }
    }
    function hm() {
      if (Ft === 1) {
        Ft = 0;
        var t = Vn, e = Wa, n = (e.flags & 13878) !== 0;
        if ((e.subtreeFlags & 13878) !== 0 || n) {
          n = x.T, x.T = null;
          var i = O.p;
          O.p = 2;
          var s = xt;
          xt |= 4;
          try {
            Kd(e, t);
            var r = vr, h = $f(t.containerInfo), g = r.focusedElem, T = r.selectionRange;
            if (h !== g && g && g.ownerDocument && Wf(g.ownerDocument.documentElement, g)) {
              if (T !== null && Gu(g)) {
                var R = T.start, V = T.end;
                if (V === void 0 && (V = R), "selectionStart" in g) g.selectionStart = R, g.selectionEnd = Math.min(V, g.value.length);
                else {
                  var H = g.ownerDocument || document, j = H && H.defaultView || window;
                  if (j.getSelection) {
                    var _ = j.getSelection(), W = g.textContent.length, lt = Math.min(T.start, W), Dt = T.end === void 0 ? lt : Math.min(T.end, W);
                    !_.extend && lt > Dt && (h = Dt, Dt = lt, lt = h);
                    var C = Pf(g, lt), M = Pf(g, Dt);
                    if (C && M && (_.rangeCount !== 1 || _.anchorNode !== C.node || _.anchorOffset !== C.offset || _.focusNode !== M.node || _.focusOffset !== M.offset)) {
                      var z = H.createRange();
                      z.setStart(C.node, C.offset), _.removeAllRanges(), lt > Dt ? (_.addRange(z), _.extend(M.node, M.offset)) : (z.setEnd(M.node, M.offset), _.addRange(z));
                    }
                  }
                }
              }
              for (H = [], _ = g; _ = _.parentNode; ) _.nodeType === 1 && H.push({
                element: _,
                left: _.scrollLeft,
                top: _.scrollTop
              });
              for (typeof g.focus == "function" && g.focus(), g = 0; g < H.length; g++) {
                var U = H[g];
                U.element.scrollLeft = U.left, U.element.scrollTop = U.top;
              }
            }
            Bs = !!gr, vr = gr = null;
          } finally {
            xt = s, O.p = i, x.T = n;
          }
        }
        t.current = e, Ft = 2;
      }
    }
    function dm() {
      if (Ft === 2) {
        Ft = 0;
        var t = Vn, e = Wa, n = (e.flags & 8772) !== 0;
        if ((e.subtreeFlags & 8772) !== 0 || n) {
          n = x.T, x.T = null;
          var i = O.p;
          O.p = 2;
          var s = xt;
          xt |= 4;
          try {
            Yd(t, e.alternate, e);
          } finally {
            xt = s, O.p = i, x.T = n;
          }
        }
        Ft = 3;
      }
    }
    function mm() {
      if (Ft === 4 || Ft === 3) {
        Ft = 0, Dg();
        var t = Vn, e = Wa, n = gn, i = tm;
        (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Ft = 5 : (Ft = 0, Wa = Vn = null, pm(t, t.pendingLanes));
        var s = t.pendingLanes;
        if (s === 0 && (wn = null), Au(n), e = e.stateNode, be && typeof be.onCommitFiberRoot == "function") try {
          be.onCommitFiberRoot(gi, e, void 0, (e.current.flags & 128) === 128);
        } catch {
        }
        if (i !== null) {
          e = x.T, s = O.p, O.p = 2, x.T = null;
          try {
            for (var r = t.onRecoverableError, h = 0; h < i.length; h++) {
              var g = i[h];
              r(g.value, {
                componentStack: g.stack
              });
            }
          } finally {
            x.T = e, O.p = s;
          }
        }
        (gn & 3) !== 0 && Ms(), Pe(t), s = t.pendingLanes, (n & 261930) !== 0 && (s & 42) !== 0 ? t === ir ? $i++ : ($i = 0, ir = t) : $i = 0, Ii(0);
      }
    }
    function pm(t, e) {
      (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, _i(e)));
    }
    function Ms() {
      return hm(), dm(), mm(), ym();
    }
    function ym() {
      if (Ft !== 5) return false;
      var t = Vn, e = nr;
      nr = 0;
      var n = Au(gn), i = x.T, s = O.p;
      try {
        O.p = 32 > n ? 32 : n, x.T = null, n = ar, ar = null;
        var r = Vn, h = gn;
        if (Ft = 0, Wa = Vn = null, gn = 0, (xt & 6) !== 0) throw Error(o(331));
        var g = xt;
        if (xt |= 4, Wd(r.current), Jd(r, r.current, h, n), xt = g, Ii(0, false), be && typeof be.onPostCommitFiberRoot == "function") try {
          be.onPostCommitFiberRoot(gi, r);
        } catch {
        }
        return true;
      } finally {
        O.p = s, x.T = i, pm(t, e);
      }
    }
    function gm(t, e, n) {
      e = Ne(n, e), e = Uo(t.stateNode, e, 2), t = zn(t, e, 2), t !== null && (bi(t, 2), Pe(t));
    }
    function Et(t, e, n) {
      if (t.tag === 3) gm(t, t, n);
      else for (; e !== null; ) {
        if (e.tag === 3) {
          gm(e, t, n);
          break;
        } else if (e.tag === 1) {
          var i = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (wn === null || !wn.has(i))) {
            t = Ne(n, t), n = vd(2), i = zn(e, n, 2), i !== null && (bd(n, i, e, t), bi(i, 2), Pe(i));
            break;
          }
        }
        e = e.return;
      }
    }
    function ur(t, e, n) {
      var i = t.pingCache;
      if (i === null) {
        i = t.pingCache = new Iv();
        var s = /* @__PURE__ */ new Set();
        i.set(e, s);
      } else s = i.get(e), s === void 0 && (s = /* @__PURE__ */ new Set(), i.set(e, s));
      s.has(n) || (Io = true, s.add(n), t = i1.bind(null, t, e, n), e.then(t, t));
    }
    function i1(t, e, n) {
      var i = t.pingCache;
      i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & n, t.warmLanes &= ~n, zt === t && (yt & n) === n && (Ht === 4 || Ht === 3 && (yt & 62914560) === yt && 300 > ve() - bs ? (xt & 2) === 0 && $a(t, 0) : tr |= n, Pa === yt && (Pa = 0)), Pe(t);
    }
    function vm(t, e) {
      e === 0 && (e = hf()), t = na(t, e), t !== null && (bi(t, e), Pe(t));
    }
    function l1(t) {
      var e = t.memoizedState, n = 0;
      e !== null && (n = e.retryLane), vm(t, n);
    }
    function s1(t, e) {
      var n = 0;
      switch (t.tag) {
        case 31:
        case 13:
          var i = t.stateNode, s = t.memoizedState;
          s !== null && (n = s.retryLane);
          break;
        case 19:
          i = t.stateNode;
          break;
        case 22:
          i = t.stateNode._retryCache;
          break;
        default:
          throw Error(o(314));
      }
      i !== null && i.delete(e), vm(t, n);
    }
    function u1(t, e) {
      return bu(t, e);
    }
    var Cs = null, ti = null, or = false, Ds = false, rr = false, Bn = 0;
    function Pe(t) {
      t !== ti && t.next === null && (ti === null ? Cs = ti = t : ti = ti.next = t), Ds = true, or || (or = true, r1());
    }
    function Ii(t, e) {
      if (!rr && Ds) {
        rr = true;
        do
          for (var n = false, i = Cs; i !== null; ) {
            if (t !== 0) {
              var s = i.pendingLanes;
              if (s === 0) var r = 0;
              else {
                var h = i.suspendedLanes, g = i.pingedLanes;
                r = (1 << 31 - Se(42 | t) + 1) - 1, r &= s & ~(h & ~g), r = r & 201326741 ? r & 201326741 | 1 : r ? r | 2 : 0;
              }
              r !== 0 && (n = true, Tm(i, r));
            } else r = yt, r = Ol(i, i === zt ? r : 0, i.cancelPendingCommit !== null || i.timeoutHandle !== -1), (r & 3) === 0 || vi(i, r) || (n = true, Tm(i, r));
            i = i.next;
          }
        while (n);
        rr = false;
      }
    }
    function o1() {
      bm();
    }
    function bm() {
      Ds = or = false;
      var t = 0;
      Bn !== 0 && b1() && (t = Bn);
      for (var e = ve(), n = null, i = Cs; i !== null; ) {
        var s = i.next, r = Sm(i, e);
        r === 0 ? (i.next = null, n === null ? Cs = s : n.next = s, s === null && (ti = n)) : (n = i, (t !== 0 || (r & 3) !== 0) && (Ds = true)), i = s;
      }
      Ft !== 0 && Ft !== 5 || Ii(t), Bn !== 0 && (Bn = 0);
    }
    function Sm(t, e) {
      for (var n = t.suspendedLanes, i = t.pingedLanes, s = t.expirationTimes, r = t.pendingLanes & -62914561; 0 < r; ) {
        var h = 31 - Se(r), g = 1 << h, T = s[h];
        T === -1 ? ((g & n) === 0 || (g & i) !== 0) && (s[h] = Vg(g, e)) : T <= e && (t.expiredLanes |= g), r &= ~g;
      }
      if (e = zt, n = yt, n = Ol(t, t === e ? n : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), i = t.callbackNode, n === 0 || t === e && (At === 2 || At === 9) || t.cancelPendingCommit !== null) return i !== null && i !== null && Su(i), t.callbackNode = null, t.callbackPriority = 0;
      if ((n & 3) === 0 || vi(t, n)) {
        if (e = n & -n, e === t.callbackPriority) return e;
        switch (i !== null && Su(i), Au(n)) {
          case 2:
          case 8:
            n = cf;
            break;
          case 32:
            n = Dl;
            break;
          case 268435456:
            n = ff;
            break;
          default:
            n = Dl;
        }
        return i = xm.bind(null, t), n = bu(n, i), t.callbackPriority = e, t.callbackNode = n, e;
      }
      return i !== null && i !== null && Su(i), t.callbackPriority = 2, t.callbackNode = null, 2;
    }
    function xm(t, e) {
      if (Ft !== 0 && Ft !== 5) return t.callbackNode = null, t.callbackPriority = 0, null;
      var n = t.callbackNode;
      if (Ms() && t.callbackNode !== n) return null;
      var i = yt;
      return i = Ol(t, t === zt ? i : 0, t.cancelPendingCommit !== null || t.timeoutHandle !== -1), i === 0 ? null : (nm(t, i, e), Sm(t, ve()), t.callbackNode != null && t.callbackNode === n ? xm.bind(null, t) : null);
    }
    function Tm(t, e) {
      if (Ms()) return null;
      nm(t, e, true);
    }
    function r1() {
      x1(function() {
        (xt & 6) !== 0 ? bu(rf, o1) : bm();
      });
    }
    function cr() {
      if (Bn === 0) {
        var t = Ha;
        t === 0 && (t = zl, zl <<= 1, (zl & 261888) === 0 && (zl = 256)), Bn = t;
      }
      return Bn;
    }
    function Am(t) {
      return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : Vl("" + t);
    }
    function Em(t, e) {
      var n = e.ownerDocument.createElement("input");
      return n.name = e.name, n.value = e.value, t.id && n.setAttribute("form", t.id), e.parentNode.insertBefore(n, e), t = new FormData(t), n.parentNode.removeChild(n), t;
    }
    function c1(t, e, n, i, s) {
      if (e === "submit" && n && n.stateNode === s) {
        var r = Am((s[fe] || null).action), h = i.submitter;
        h && (e = (e = h[fe] || null) ? Am(e.formAction) : h.getAttribute("formAction"), e !== null && (r = e, h = null));
        var g = new Hl("action", "action", null, i, s);
        t.push({
          event: g,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (i.defaultPrevented) {
                  if (Bn !== 0) {
                    var T = h ? Em(s, h) : new FormData(s);
                    jo(n, {
                      pending: true,
                      data: T,
                      method: s.method,
                      action: r
                    }, null, T);
                  }
                } else typeof r == "function" && (g.preventDefault(), T = h ? Em(s, h) : new FormData(s), jo(n, {
                  pending: true,
                  data: T,
                  method: s.method,
                  action: r
                }, r, T));
              },
              currentTarget: s
            }
          ]
        });
      }
    }
    for (var fr = 0; fr < Ku.length; fr++) {
      var hr = Ku[fr], f1 = hr.toLowerCase(), h1 = hr[0].toUpperCase() + hr.slice(1);
      Ye(f1, "on" + h1);
    }
    Ye(eh, "onAnimationEnd"), Ye(nh, "onAnimationIteration"), Ye(ah, "onAnimationStart"), Ye("dblclick", "onDoubleClick"), Ye("focusin", "onFocus"), Ye("focusout", "onBlur"), Ye(zv, "onTransitionRun"), Ye(Rv, "onTransitionStart"), Ye(jv, "onTransitionCancel"), Ye(ih, "onTransitionEnd"), Ma("onMouseEnter", [
      "mouseout",
      "mouseover"
    ]), Ma("onMouseLeave", [
      "mouseout",
      "mouseover"
    ]), Ma("onPointerEnter", [
      "pointerout",
      "pointerover"
    ]), Ma("onPointerLeave", [
      "pointerout",
      "pointerover"
    ]), $n("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), $n("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), $n("onBeforeInput", [
      "compositionend",
      "keypress",
      "textInput",
      "paste"
    ]), $n("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), $n("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), $n("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
    var tl = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), d1 = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(tl));
    function Mm(t, e) {
      e = (e & 4) !== 0;
      for (var n = 0; n < t.length; n++) {
        var i = t[n], s = i.event;
        i = i.listeners;
        t: {
          var r = void 0;
          if (e) for (var h = i.length - 1; 0 <= h; h--) {
            var g = i[h], T = g.instance, R = g.currentTarget;
            if (g = g.listener, T !== r && s.isPropagationStopped()) break t;
            r = g, s.currentTarget = R;
            try {
              r(s);
            } catch (V) {
              Gl(V);
            }
            s.currentTarget = null, r = T;
          }
          else for (h = 0; h < i.length; h++) {
            if (g = i[h], T = g.instance, R = g.currentTarget, g = g.listener, T !== r && s.isPropagationStopped()) break t;
            r = g, s.currentTarget = R;
            try {
              r(s);
            } catch (V) {
              Gl(V);
            }
            s.currentTarget = null, r = T;
          }
        }
      }
    }
    function mt(t, e) {
      var n = e[Eu];
      n === void 0 && (n = e[Eu] = /* @__PURE__ */ new Set());
      var i = t + "__bubble";
      n.has(i) || (Cm(e, t, 2, false), n.add(i));
    }
    function dr(t, e, n) {
      var i = 0;
      e && (i |= 4), Cm(n, t, i, e);
    }
    var zs = "_reactListening" + Math.random().toString(36).slice(2);
    function mr(t) {
      if (!t[zs]) {
        t[zs] = true, bf.forEach(function(n) {
          n !== "selectionchange" && (d1.has(n) || dr(n, false, t), dr(n, true, t));
        });
        var e = t.nodeType === 9 ? t : t.ownerDocument;
        e === null || e[zs] || (e[zs] = true, dr("selectionchange", false, e));
      }
    }
    function Cm(t, e, n, i) {
      switch (ep(e)) {
        case 2:
          var s = Y1;
          break;
        case 8:
          s = G1;
          break;
        default:
          s = Rr;
      }
      n = s.bind(null, e, n, t), s = void 0, !_u || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (s = true), i ? s !== void 0 ? t.addEventListener(e, n, {
        capture: true,
        passive: s
      }) : t.addEventListener(e, n, true) : s !== void 0 ? t.addEventListener(e, n, {
        passive: s
      }) : t.addEventListener(e, n, false);
    }
    function pr(t, e, n, i, s) {
      var r = i;
      if ((e & 1) === 0 && (e & 2) === 0 && i !== null) t: for (; ; ) {
        if (i === null) return;
        var h = i.tag;
        if (h === 3 || h === 4) {
          var g = i.stateNode.containerInfo;
          if (g === s) break;
          if (h === 4) for (h = i.return; h !== null; ) {
            var T = h.tag;
            if ((T === 3 || T === 4) && h.stateNode.containerInfo === s) return;
            h = h.return;
          }
          for (; g !== null; ) {
            if (h = Ta(g), h === null) return;
            if (T = h.tag, T === 5 || T === 6 || T === 26 || T === 27) {
              i = r = h;
              continue t;
            }
            g = g.parentNode;
          }
        }
        i = i.return;
      }
      Of(function() {
        var R = r, V = Ou(n), H = [];
        t: {
          var j = lh.get(t);
          if (j !== void 0) {
            var _ = Hl, W = t;
            switch (t) {
              case "keypress":
                if (Bl(n) === 0) break t;
              case "keydown":
              case "keyup":
                _ = sv;
                break;
              case "focusin":
                W = "focus", _ = Bu;
                break;
              case "focusout":
                W = "blur", _ = Bu;
                break;
              case "beforeblur":
              case "afterblur":
                _ = Bu;
                break;
              case "click":
                if (n.button === 2) break t;
              case "auxclick":
              case "dblclick":
              case "mousedown":
              case "mousemove":
              case "mouseup":
              case "mouseout":
              case "mouseover":
              case "contextmenu":
                _ = wf;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                _ = Jg;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                _ = rv;
                break;
              case eh:
              case nh:
              case ah:
                _ = Wg;
                break;
              case ih:
                _ = fv;
                break;
              case "scroll":
              case "scrollend":
                _ = Kg;
                break;
              case "wheel":
                _ = dv;
                break;
              case "copy":
              case "cut":
              case "paste":
                _ = Ig;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                _ = Uf;
                break;
              case "toggle":
              case "beforetoggle":
                _ = pv;
            }
            var lt = (e & 4) !== 0, Dt = !lt && (t === "scroll" || t === "scrollend"), C = lt ? j !== null ? j + "Capture" : null : j;
            lt = [];
            for (var M = R, z; M !== null; ) {
              var U = M;
              if (z = U.stateNode, U = U.tag, U !== 5 && U !== 26 && U !== 27 || z === null || C === null || (U = Ti(M, C), U != null && lt.push(el(M, U, z))), Dt) break;
              M = M.return;
            }
            0 < lt.length && (j = new _(j, W, null, n, V), H.push({
              event: j,
              listeners: lt
            }));
          }
        }
        if ((e & 7) === 0) {
          t: {
            if (j = t === "mouseover" || t === "pointerover", _ = t === "mouseout" || t === "pointerout", j && n !== ju && (W = n.relatedTarget || n.fromElement) && (Ta(W) || W[xa])) break t;
            if ((_ || j) && (j = V.window === V ? V : (j = V.ownerDocument) ? j.defaultView || j.parentWindow : window, _ ? (W = n.relatedTarget || n.toElement, _ = R, W = W ? Ta(W) : null, W !== null && (Dt = d(W), lt = W.tag, W !== Dt || lt !== 5 && lt !== 27 && lt !== 6) && (W = null)) : (_ = null, W = R), _ !== W)) {
              if (lt = wf, U = "onMouseLeave", C = "onMouseEnter", M = "mouse", (t === "pointerout" || t === "pointerover") && (lt = Uf, U = "onPointerLeave", C = "onPointerEnter", M = "pointer"), Dt = _ == null ? j : xi(_), z = W == null ? j : xi(W), j = new lt(U, M + "leave", _, n, V), j.target = Dt, j.relatedTarget = z, U = null, Ta(V) === R && (lt = new lt(C, M + "enter", W, n, V), lt.target = z, lt.relatedTarget = Dt, U = lt), Dt = U, _ && W) e: {
                for (lt = m1, C = _, M = W, z = 0, U = C; U; U = lt(U)) z++;
                U = 0;
                for (var at = M; at; at = lt(at)) U++;
                for (; 0 < z - U; ) C = lt(C), z--;
                for (; 0 < U - z; ) M = lt(M), U--;
                for (; z--; ) {
                  if (C === M || M !== null && C === M.alternate) {
                    lt = C;
                    break e;
                  }
                  C = lt(C), M = lt(M);
                }
                lt = null;
              }
              else lt = null;
              _ !== null && Dm(H, j, _, lt, false), W !== null && Dt !== null && Dm(H, Dt, W, lt, true);
            }
          }
          t: {
            if (j = R ? xi(R) : window, _ = j.nodeName && j.nodeName.toLowerCase(), _ === "select" || _ === "input" && j.type === "file") var bt = kf;
            else if (Gf(j)) if (Zf) bt = Mv;
            else {
              bt = Av;
              var nt = Tv;
            }
            else _ = j.nodeName, !_ || _.toLowerCase() !== "input" || j.type !== "checkbox" && j.type !== "radio" ? R && Ru(R.elementType) && (bt = kf) : bt = Ev;
            if (bt && (bt = bt(t, R))) {
              Xf(H, bt, n, V);
              break t;
            }
            nt && nt(t, j, R), t === "focusout" && R && j.type === "number" && R.memoizedProps.value != null && zu(j, "number", j.value);
          }
          switch (nt = R ? xi(R) : window, t) {
            case "focusin":
              (Gf(nt) || nt.contentEditable === "true") && (Oa = nt, Xu = R, ji = null);
              break;
            case "focusout":
              ji = Xu = Oa = null;
              break;
            case "mousedown":
              ku = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              ku = false, If(H, n, V);
              break;
            case "selectionchange":
              if (Dv) break;
            case "keydown":
            case "keyup":
              If(H, n, V);
          }
          var ct;
          if (Hu) t: {
            switch (t) {
              case "compositionstart":
                var gt = "onCompositionStart";
                break t;
              case "compositionend":
                gt = "onCompositionEnd";
                break t;
              case "compositionupdate":
                gt = "onCompositionUpdate";
                break t;
            }
            gt = void 0;
          }
          else ja ? qf(t, n) && (gt = "onCompositionEnd") : t === "keydown" && n.keyCode === 229 && (gt = "onCompositionStart");
          gt && (Bf && n.locale !== "ko" && (ja || gt !== "onCompositionStart" ? gt === "onCompositionEnd" && ja && (ct = Nf()) : (xn = V, wu = "value" in xn ? xn.value : xn.textContent, ja = true)), nt = Rs(R, gt), 0 < nt.length && (gt = new Vf(gt, t, null, n, V), H.push({
            event: gt,
            listeners: nt
          }), ct ? gt.data = ct : (ct = Yf(n), ct !== null && (gt.data = ct)))), (ct = gv ? vv(t, n) : bv(t, n)) && (gt = Rs(R, "onBeforeInput"), 0 < gt.length && (nt = new Vf("onBeforeInput", "beforeinput", null, n, V), H.push({
            event: nt,
            listeners: gt
          }), nt.data = ct)), c1(H, t, R, n, V);
        }
        Mm(H, e);
      });
    }
    function el(t, e, n) {
      return {
        instance: t,
        listener: e,
        currentTarget: n
      };
    }
    function Rs(t, e) {
      for (var n = e + "Capture", i = []; t !== null; ) {
        var s = t, r = s.stateNode;
        if (s = s.tag, s !== 5 && s !== 26 && s !== 27 || r === null || (s = Ti(t, n), s != null && i.unshift(el(t, s, r)), s = Ti(t, e), s != null && i.push(el(t, s, r))), t.tag === 3) return i;
        t = t.return;
      }
      return [];
    }
    function m1(t) {
      if (t === null) return null;
      do
        t = t.return;
      while (t && t.tag !== 5 && t.tag !== 27);
      return t || null;
    }
    function Dm(t, e, n, i, s) {
      for (var r = e._reactName, h = []; n !== null && n !== i; ) {
        var g = n, T = g.alternate, R = g.stateNode;
        if (g = g.tag, T !== null && T === i) break;
        g !== 5 && g !== 26 && g !== 27 || R === null || (T = R, s ? (R = Ti(n, r), R != null && h.unshift(el(n, R, T))) : s || (R = Ti(n, r), R != null && h.push(el(n, R, T)))), n = n.return;
      }
      h.length !== 0 && t.push({
        event: e,
        listeners: h
      });
    }
    var p1 = /\r\n?/g, y1 = /\u0000|\uFFFD/g;
    function zm(t) {
      return (typeof t == "string" ? t : "" + t).replace(p1, `
`).replace(y1, "");
    }
    function Rm(t, e) {
      return e = zm(e), zm(t) === e;
    }
    function Ct(t, e, n, i, s, r) {
      switch (n) {
        case "children":
          typeof i == "string" ? e === "body" || e === "textarea" && i === "" || Da(t, i) : (typeof i == "number" || typeof i == "bigint") && e !== "body" && Da(t, "" + i);
          break;
        case "className":
          _l(t, "class", i);
          break;
        case "tabIndex":
          _l(t, "tabindex", i);
          break;
        case "dir":
        case "role":
        case "viewBox":
        case "width":
        case "height":
          _l(t, n, i);
          break;
        case "style":
          Rf(t, i, r);
          break;
        case "data":
          if (e !== "object") {
            _l(t, "data", i);
            break;
          }
        case "src":
        case "href":
          if (i === "" && (e !== "a" || n !== "href")) {
            t.removeAttribute(n);
            break;
          }
          if (i == null || typeof i == "function" || typeof i == "symbol" || typeof i == "boolean") {
            t.removeAttribute(n);
            break;
          }
          i = Vl("" + i), t.setAttribute(n, i);
          break;
        case "action":
        case "formAction":
          if (typeof i == "function") {
            t.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
            break;
          } else typeof r == "function" && (n === "formAction" ? (e !== "input" && Ct(t, e, "name", s.name, s, null), Ct(t, e, "formEncType", s.formEncType, s, null), Ct(t, e, "formMethod", s.formMethod, s, null), Ct(t, e, "formTarget", s.formTarget, s, null)) : (Ct(t, e, "encType", s.encType, s, null), Ct(t, e, "method", s.method, s, null), Ct(t, e, "target", s.target, s, null)));
          if (i == null || typeof i == "symbol" || typeof i == "boolean") {
            t.removeAttribute(n);
            break;
          }
          i = Vl("" + i), t.setAttribute(n, i);
          break;
        case "onClick":
          i != null && (t.onclick = en);
          break;
        case "onScroll":
          i != null && mt("scroll", t);
          break;
        case "onScrollEnd":
          i != null && mt("scrollend", t);
          break;
        case "dangerouslySetInnerHTML":
          if (i != null) {
            if (typeof i != "object" || !("__html" in i)) throw Error(o(61));
            if (n = i.__html, n != null) {
              if (s.children != null) throw Error(o(60));
              t.innerHTML = n;
            }
          }
          break;
        case "multiple":
          t.multiple = i && typeof i != "function" && typeof i != "symbol";
          break;
        case "muted":
          t.muted = i && typeof i != "function" && typeof i != "symbol";
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
          if (i == null || typeof i == "function" || typeof i == "boolean" || typeof i == "symbol") {
            t.removeAttribute("xlink:href");
            break;
          }
          n = Vl("" + i), t.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
          break;
        case "contentEditable":
        case "spellCheck":
        case "draggable":
        case "value":
        case "autoReverse":
        case "externalResourcesRequired":
        case "focusable":
        case "preserveAlpha":
          i != null && typeof i != "function" && typeof i != "symbol" ? t.setAttribute(n, "" + i) : t.removeAttribute(n);
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
          i && typeof i != "function" && typeof i != "symbol" ? t.setAttribute(n, "") : t.removeAttribute(n);
          break;
        case "capture":
        case "download":
          i === true ? t.setAttribute(n, "") : i !== false && i != null && typeof i != "function" && typeof i != "symbol" ? t.setAttribute(n, i) : t.removeAttribute(n);
          break;
        case "cols":
        case "rows":
        case "size":
        case "span":
          i != null && typeof i != "function" && typeof i != "symbol" && !isNaN(i) && 1 <= i ? t.setAttribute(n, i) : t.removeAttribute(n);
          break;
        case "rowSpan":
        case "start":
          i == null || typeof i == "function" || typeof i == "symbol" || isNaN(i) ? t.removeAttribute(n) : t.setAttribute(n, i);
          break;
        case "popover":
          mt("beforetoggle", t), mt("toggle", t), Nl(t, "popover", i);
          break;
        case "xlinkActuate":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:actuate", i);
          break;
        case "xlinkArcrole":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:arcrole", i);
          break;
        case "xlinkRole":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:role", i);
          break;
        case "xlinkShow":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:show", i);
          break;
        case "xlinkTitle":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:title", i);
          break;
        case "xlinkType":
          tn(t, "http://www.w3.org/1999/xlink", "xlink:type", i);
          break;
        case "xmlBase":
          tn(t, "http://www.w3.org/XML/1998/namespace", "xml:base", i);
          break;
        case "xmlLang":
          tn(t, "http://www.w3.org/XML/1998/namespace", "xml:lang", i);
          break;
        case "xmlSpace":
          tn(t, "http://www.w3.org/XML/1998/namespace", "xml:space", i);
          break;
        case "is":
          Nl(t, "is", i);
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") && (n = kg.get(n) || n, Nl(t, n, i));
      }
    }
    function yr(t, e, n, i, s, r) {
      switch (n) {
        case "style":
          Rf(t, i, r);
          break;
        case "dangerouslySetInnerHTML":
          if (i != null) {
            if (typeof i != "object" || !("__html" in i)) throw Error(o(61));
            if (n = i.__html, n != null) {
              if (s.children != null) throw Error(o(60));
              t.innerHTML = n;
            }
          }
          break;
        case "children":
          typeof i == "string" ? Da(t, i) : (typeof i == "number" || typeof i == "bigint") && Da(t, "" + i);
          break;
        case "onScroll":
          i != null && mt("scroll", t);
          break;
        case "onScrollEnd":
          i != null && mt("scrollend", t);
          break;
        case "onClick":
          i != null && (t.onclick = en);
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
          if (!Sf.hasOwnProperty(n)) t: {
            if (n[0] === "o" && n[1] === "n" && (s = n.endsWith("Capture"), e = n.slice(2, s ? n.length - 7 : void 0), r = t[fe] || null, r = r != null ? r[n] : null, typeof r == "function" && t.removeEventListener(e, r, s), typeof i == "function")) {
              typeof r != "function" && r !== null && (n in t ? t[n] = null : t.hasAttribute(n) && t.removeAttribute(n)), t.addEventListener(e, i, s);
              break t;
            }
            n in t ? t[n] = i : i === true ? t.setAttribute(n, "") : Nl(t, n, i);
          }
      }
    }
    function ae(t, e, n) {
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
          mt("error", t), mt("load", t);
          var i = false, s = false, r;
          for (r in n) if (n.hasOwnProperty(r)) {
            var h = n[r];
            if (h != null) switch (r) {
              case "src":
                i = true;
                break;
              case "srcSet":
                s = true;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(o(137, e));
              default:
                Ct(t, e, r, h, n, null);
            }
          }
          s && Ct(t, e, "srcSet", n.srcSet, n, null), i && Ct(t, e, "src", n.src, n, null);
          return;
        case "input":
          mt("invalid", t);
          var g = r = h = s = null, T = null, R = null;
          for (i in n) if (n.hasOwnProperty(i)) {
            var V = n[i];
            if (V != null) switch (i) {
              case "name":
                s = V;
                break;
              case "type":
                h = V;
                break;
              case "checked":
                T = V;
                break;
              case "defaultChecked":
                R = V;
                break;
              case "value":
                r = V;
                break;
              case "defaultValue":
                g = V;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (V != null) throw Error(o(137, e));
                break;
              default:
                Ct(t, e, i, V, n, null);
            }
          }
          Mf(t, r, g, T, R, h, s, false);
          return;
        case "select":
          mt("invalid", t), i = h = r = null;
          for (s in n) if (n.hasOwnProperty(s) && (g = n[s], g != null)) switch (s) {
            case "value":
              r = g;
              break;
            case "defaultValue":
              h = g;
              break;
            case "multiple":
              i = g;
            default:
              Ct(t, e, s, g, n, null);
          }
          e = r, n = h, t.multiple = !!i, e != null ? Ca(t, !!i, e, false) : n != null && Ca(t, !!i, n, true);
          return;
        case "textarea":
          mt("invalid", t), r = s = i = null;
          for (h in n) if (n.hasOwnProperty(h) && (g = n[h], g != null)) switch (h) {
            case "value":
              i = g;
              break;
            case "defaultValue":
              s = g;
              break;
            case "children":
              r = g;
              break;
            case "dangerouslySetInnerHTML":
              if (g != null) throw Error(o(91));
              break;
            default:
              Ct(t, e, h, g, n, null);
          }
          Df(t, i, s, r);
          return;
        case "option":
          for (T in n) if (n.hasOwnProperty(T) && (i = n[T], i != null)) switch (T) {
            case "selected":
              t.selected = i && typeof i != "function" && typeof i != "symbol";
              break;
            default:
              Ct(t, e, T, i, n, null);
          }
          return;
        case "dialog":
          mt("beforetoggle", t), mt("toggle", t), mt("cancel", t), mt("close", t);
          break;
        case "iframe":
        case "object":
          mt("load", t);
          break;
        case "video":
        case "audio":
          for (i = 0; i < tl.length; i++) mt(tl[i], t);
          break;
        case "image":
          mt("error", t), mt("load", t);
          break;
        case "details":
          mt("toggle", t);
          break;
        case "embed":
        case "source":
        case "link":
          mt("error", t), mt("load", t);
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
          for (R in n) if (n.hasOwnProperty(R) && (i = n[R], i != null)) switch (R) {
            case "children":
            case "dangerouslySetInnerHTML":
              throw Error(o(137, e));
            default:
              Ct(t, e, R, i, n, null);
          }
          return;
        default:
          if (Ru(e)) {
            for (V in n) n.hasOwnProperty(V) && (i = n[V], i !== void 0 && yr(t, e, V, i, n, void 0));
            return;
          }
      }
      for (g in n) n.hasOwnProperty(g) && (i = n[g], i != null && Ct(t, e, g, i, n, null));
    }
    function g1(t, e, n, i) {
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
          var s = null, r = null, h = null, g = null, T = null, R = null, V = null;
          for (_ in n) {
            var H = n[_];
            if (n.hasOwnProperty(_) && H != null) switch (_) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                T = H;
              default:
                i.hasOwnProperty(_) || Ct(t, e, _, null, i, H);
            }
          }
          for (var j in i) {
            var _ = i[j];
            if (H = n[j], i.hasOwnProperty(j) && (_ != null || H != null)) switch (j) {
              case "type":
                r = _;
                break;
              case "name":
                s = _;
                break;
              case "checked":
                R = _;
                break;
              case "defaultChecked":
                V = _;
                break;
              case "value":
                h = _;
                break;
              case "defaultValue":
                g = _;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (_ != null) throw Error(o(137, e));
                break;
              default:
                _ !== H && Ct(t, e, j, _, i, H);
            }
          }
          Du(t, h, g, T, R, V, r, s);
          return;
        case "select":
          _ = h = g = j = null;
          for (r in n) if (T = n[r], n.hasOwnProperty(r) && T != null) switch (r) {
            case "value":
              break;
            case "multiple":
              _ = T;
            default:
              i.hasOwnProperty(r) || Ct(t, e, r, null, i, T);
          }
          for (s in i) if (r = i[s], T = n[s], i.hasOwnProperty(s) && (r != null || T != null)) switch (s) {
            case "value":
              j = r;
              break;
            case "defaultValue":
              g = r;
              break;
            case "multiple":
              h = r;
            default:
              r !== T && Ct(t, e, s, r, i, T);
          }
          e = g, n = h, i = _, j != null ? Ca(t, !!n, j, false) : !!i != !!n && (e != null ? Ca(t, !!n, e, true) : Ca(t, !!n, n ? [] : "", false));
          return;
        case "textarea":
          _ = j = null;
          for (g in n) if (s = n[g], n.hasOwnProperty(g) && s != null && !i.hasOwnProperty(g)) switch (g) {
            case "value":
              break;
            case "children":
              break;
            default:
              Ct(t, e, g, null, i, s);
          }
          for (h in i) if (s = i[h], r = n[h], i.hasOwnProperty(h) && (s != null || r != null)) switch (h) {
            case "value":
              j = s;
              break;
            case "defaultValue":
              _ = s;
              break;
            case "children":
              break;
            case "dangerouslySetInnerHTML":
              if (s != null) throw Error(o(91));
              break;
            default:
              s !== r && Ct(t, e, h, s, i, r);
          }
          Cf(t, j, _);
          return;
        case "option":
          for (var W in n) if (j = n[W], n.hasOwnProperty(W) && j != null && !i.hasOwnProperty(W)) switch (W) {
            case "selected":
              t.selected = false;
              break;
            default:
              Ct(t, e, W, null, i, j);
          }
          for (T in i) if (j = i[T], _ = n[T], i.hasOwnProperty(T) && j !== _ && (j != null || _ != null)) switch (T) {
            case "selected":
              t.selected = j && typeof j != "function" && typeof j != "symbol";
              break;
            default:
              Ct(t, e, T, j, i, _);
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
          for (var lt in n) j = n[lt], n.hasOwnProperty(lt) && j != null && !i.hasOwnProperty(lt) && Ct(t, e, lt, null, i, j);
          for (R in i) if (j = i[R], _ = n[R], i.hasOwnProperty(R) && j !== _ && (j != null || _ != null)) switch (R) {
            case "children":
            case "dangerouslySetInnerHTML":
              if (j != null) throw Error(o(137, e));
              break;
            default:
              Ct(t, e, R, j, i, _);
          }
          return;
        default:
          if (Ru(e)) {
            for (var Dt in n) j = n[Dt], n.hasOwnProperty(Dt) && j !== void 0 && !i.hasOwnProperty(Dt) && yr(t, e, Dt, void 0, i, j);
            for (V in i) j = i[V], _ = n[V], !i.hasOwnProperty(V) || j === _ || j === void 0 && _ === void 0 || yr(t, e, V, j, i, _);
            return;
          }
      }
      for (var C in n) j = n[C], n.hasOwnProperty(C) && j != null && !i.hasOwnProperty(C) && Ct(t, e, C, null, i, j);
      for (H in i) j = i[H], _ = n[H], !i.hasOwnProperty(H) || j === _ || j == null && _ == null || Ct(t, e, H, j, i, _);
    }
    function jm(t) {
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
    function v1() {
      if (typeof performance.getEntriesByType == "function") {
        for (var t = 0, e = 0, n = performance.getEntriesByType("resource"), i = 0; i < n.length; i++) {
          var s = n[i], r = s.transferSize, h = s.initiatorType, g = s.duration;
          if (r && g && jm(h)) {
            for (h = 0, g = s.responseEnd, i += 1; i < n.length; i++) {
              var T = n[i], R = T.startTime;
              if (R > g) break;
              var V = T.transferSize, H = T.initiatorType;
              V && jm(H) && (T = T.responseEnd, h += V * (T < g ? 1 : (g - R) / (T - R)));
            }
            if (--i, e += 8 * (r + h) / (s.duration / 1e3), t++, 10 < t) break;
          }
        }
        if (0 < t) return e / t / 1e6;
      }
      return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
    }
    var gr = null, vr = null;
    function js(t) {
      return t.nodeType === 9 ? t : t.ownerDocument;
    }
    function Om(t) {
      switch (t) {
        case "http://www.w3.org/2000/svg":
          return 1;
        case "http://www.w3.org/1998/Math/MathML":
          return 2;
        default:
          return 0;
      }
    }
    function Nm(t, e) {
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
    function br(t, e) {
      return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
    }
    var Sr = null;
    function b1() {
      var t = window.event;
      return t && t.type === "popstate" ? t === Sr ? false : (Sr = t, true) : (Sr = null, false);
    }
    var _m = typeof setTimeout == "function" ? setTimeout : void 0, S1 = typeof clearTimeout == "function" ? clearTimeout : void 0, wm = typeof Promise == "function" ? Promise : void 0, x1 = typeof queueMicrotask == "function" ? queueMicrotask : typeof wm < "u" ? function(t) {
      return wm.resolve(null).then(t).catch(T1);
    } : _m;
    function T1(t) {
      setTimeout(function() {
        throw t;
      });
    }
    function Ln(t) {
      return t === "head";
    }
    function Vm(t, e) {
      var n = e, i = 0;
      do {
        var s = n.nextSibling;
        if (t.removeChild(n), s && s.nodeType === 8) if (n = s.data, n === "/$" || n === "/&") {
          if (i === 0) {
            t.removeChild(s), ii(e);
            return;
          }
          i--;
        } else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") i++;
        else if (n === "html") nl(t.ownerDocument.documentElement);
        else if (n === "head") {
          n = t.ownerDocument.head, nl(n);
          for (var r = n.firstChild; r; ) {
            var h = r.nextSibling, g = r.nodeName;
            r[Si] || g === "SCRIPT" || g === "STYLE" || g === "LINK" && r.rel.toLowerCase() === "stylesheet" || n.removeChild(r), r = h;
          }
        } else n === "body" && nl(t.ownerDocument.body);
        n = s;
      } while (n);
      ii(e);
    }
    function Um(t, e) {
      var n = t;
      t = 0;
      do {
        var i = n.nextSibling;
        if (n.nodeType === 1 ? e ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (e ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), i && i.nodeType === 8) if (n = i.data, n === "/$") {
          if (t === 0) break;
          t--;
        } else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || t++;
        n = i;
      } while (n);
    }
    function xr(t) {
      var e = t.firstChild;
      for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
        var n = e;
        switch (e = e.nextSibling, n.nodeName) {
          case "HTML":
          case "HEAD":
          case "BODY":
            xr(n), Mu(n);
            continue;
          case "SCRIPT":
          case "STYLE":
            continue;
          case "LINK":
            if (n.rel.toLowerCase() === "stylesheet") continue;
        }
        t.removeChild(n);
      }
    }
    function A1(t, e, n, i) {
      for (; t.nodeType === 1; ) {
        var s = n;
        if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
          if (!i && (t.nodeName !== "INPUT" || t.type !== "hidden")) break;
        } else if (i) {
          if (!t[Si]) switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (r = t.getAttribute("rel"), r === "stylesheet" && t.hasAttribute("data-precedence")) break;
              if (r !== s.rel || t.getAttribute("href") !== (s.href == null || s.href === "" ? null : s.href) || t.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin) || t.getAttribute("title") !== (s.title == null ? null : s.title)) break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (r = t.getAttribute("src"), (r !== (s.src == null ? null : s.src) || t.getAttribute("type") !== (s.type == null ? null : s.type) || t.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin)) && r && t.hasAttribute("async") && !t.hasAttribute("itemprop")) break;
              return t;
            default:
              return t;
          }
        } else if (e === "input" && t.type === "hidden") {
          var r = s.name == null ? null : "" + s.name;
          if (s.type === "hidden" && t.getAttribute("name") === r) return t;
        } else return t;
        if (t = Be(t.nextSibling), t === null) break;
      }
      return null;
    }
    function E1(t, e, n) {
      if (e === "") return null;
      for (; t.nodeType !== 3; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !n || (t = Be(t.nextSibling), t === null)) return null;
      return t;
    }
    function Bm(t, e) {
      for (; t.nodeType !== 8; ) if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = Be(t.nextSibling), t === null)) return null;
      return t;
    }
    function Tr(t) {
      return t.data === "$?" || t.data === "$~";
    }
    function Ar(t) {
      return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
    }
    function M1(t, e) {
      var n = t.ownerDocument;
      if (t.data === "$~") t._reactRetry = e;
      else if (t.data !== "$?" || n.readyState !== "loading") e();
      else {
        var i = function() {
          e(), n.removeEventListener("DOMContentLoaded", i);
        };
        n.addEventListener("DOMContentLoaded", i), t._reactRetry = i;
      }
    }
    function Be(t) {
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
    var Er = null;
    function Lm(t) {
      t = t.nextSibling;
      for (var e = 0; t; ) {
        if (t.nodeType === 8) {
          var n = t.data;
          if (n === "/$" || n === "/&") {
            if (e === 0) return Be(t.nextSibling);
            e--;
          } else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || e++;
        }
        t = t.nextSibling;
      }
      return null;
    }
    function Hm(t) {
      t = t.previousSibling;
      for (var e = 0; t; ) {
        if (t.nodeType === 8) {
          var n = t.data;
          if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
            if (e === 0) return t;
            e--;
          } else n !== "/$" && n !== "/&" || e++;
        }
        t = t.previousSibling;
      }
      return null;
    }
    function qm(t, e, n) {
      switch (e = js(n), t) {
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
    function nl(t) {
      for (var e = t.attributes; e.length; ) t.removeAttributeNode(e[0]);
      Mu(t);
    }
    var Le = /* @__PURE__ */ new Map(), Ym = /* @__PURE__ */ new Set();
    function Os(t) {
      return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
    }
    var vn = O.d;
    O.d = {
      f: C1,
      r: D1,
      D: z1,
      C: R1,
      L: j1,
      m: O1,
      X: _1,
      S: N1,
      M: w1
    };
    function C1() {
      var t = vn.f(), e = Ts();
      return t || e;
    }
    function D1(t) {
      var e = Aa(t);
      e !== null && e.tag === 5 && e.type === "form" ? id(e) : vn.r(t);
    }
    var ei = typeof document > "u" ? null : document;
    function Gm(t, e, n) {
      var i = ei;
      if (i && typeof e == "string" && e) {
        var s = je(e);
        s = 'link[rel="' + t + '"][href="' + s + '"]', typeof n == "string" && (s += '[crossorigin="' + n + '"]'), Ym.has(s) || (Ym.add(s), t = {
          rel: t,
          crossOrigin: n,
          href: e
        }, i.querySelector(s) === null && (e = i.createElement("link"), ae(e, "link", t), Wt(e), i.head.appendChild(e)));
      }
    }
    function z1(t) {
      vn.D(t), Gm("dns-prefetch", t, null);
    }
    function R1(t, e) {
      vn.C(t, e), Gm("preconnect", t, e);
    }
    function j1(t, e, n) {
      vn.L(t, e, n);
      var i = ei;
      if (i && t && e) {
        var s = 'link[rel="preload"][as="' + je(e) + '"]';
        e === "image" && n && n.imageSrcSet ? (s += '[imagesrcset="' + je(n.imageSrcSet) + '"]', typeof n.imageSizes == "string" && (s += '[imagesizes="' + je(n.imageSizes) + '"]')) : s += '[href="' + je(t) + '"]';
        var r = s;
        switch (e) {
          case "style":
            r = ni(t);
            break;
          case "script":
            r = ai(t);
        }
        Le.has(r) || (t = b({
          rel: "preload",
          href: e === "image" && n && n.imageSrcSet ? void 0 : t,
          as: e
        }, n), Le.set(r, t), i.querySelector(s) !== null || e === "style" && i.querySelector(al(r)) || e === "script" && i.querySelector(il(r)) || (e = i.createElement("link"), ae(e, "link", t), Wt(e), i.head.appendChild(e)));
      }
    }
    function O1(t, e) {
      vn.m(t, e);
      var n = ei;
      if (n && t) {
        var i = e && typeof e.as == "string" ? e.as : "script", s = 'link[rel="modulepreload"][as="' + je(i) + '"][href="' + je(t) + '"]', r = s;
        switch (i) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            r = ai(t);
        }
        if (!Le.has(r) && (t = b({
          rel: "modulepreload",
          href: t
        }, e), Le.set(r, t), n.querySelector(s) === null)) {
          switch (i) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              if (n.querySelector(il(r))) return;
          }
          i = n.createElement("link"), ae(i, "link", t), Wt(i), n.head.appendChild(i);
        }
      }
    }
    function N1(t, e, n) {
      vn.S(t, e, n);
      var i = ei;
      if (i && t) {
        var s = Ea(i).hoistableStyles, r = ni(t);
        e = e || "default";
        var h = s.get(r);
        if (!h) {
          var g = {
            loading: 0,
            preload: null
          };
          if (h = i.querySelector(al(r))) g.loading = 5;
          else {
            t = b({
              rel: "stylesheet",
              href: t,
              "data-precedence": e
            }, n), (n = Le.get(r)) && Mr(t, n);
            var T = h = i.createElement("link");
            Wt(T), ae(T, "link", t), T._p = new Promise(function(R, V) {
              T.onload = R, T.onerror = V;
            }), T.addEventListener("load", function() {
              g.loading |= 1;
            }), T.addEventListener("error", function() {
              g.loading |= 2;
            }), g.loading |= 4, Ns(h, e, i);
          }
          h = {
            type: "stylesheet",
            instance: h,
            count: 1,
            state: g
          }, s.set(r, h);
        }
      }
    }
    function _1(t, e) {
      vn.X(t, e);
      var n = ei;
      if (n && t) {
        var i = Ea(n).hoistableScripts, s = ai(t), r = i.get(s);
        r || (r = n.querySelector(il(s)), r || (t = b({
          src: t,
          async: true
        }, e), (e = Le.get(s)) && Cr(t, e), r = n.createElement("script"), Wt(r), ae(r, "link", t), n.head.appendChild(r)), r = {
          type: "script",
          instance: r,
          count: 1,
          state: null
        }, i.set(s, r));
      }
    }
    function w1(t, e) {
      vn.M(t, e);
      var n = ei;
      if (n && t) {
        var i = Ea(n).hoistableScripts, s = ai(t), r = i.get(s);
        r || (r = n.querySelector(il(s)), r || (t = b({
          src: t,
          async: true,
          type: "module"
        }, e), (e = Le.get(s)) && Cr(t, e), r = n.createElement("script"), Wt(r), ae(r, "link", t), n.head.appendChild(r)), r = {
          type: "script",
          instance: r,
          count: 1,
          state: null
        }, i.set(s, r));
      }
    }
    function Xm(t, e, n, i) {
      var s = (s = ht.current) ? Os(s) : null;
      if (!s) throw Error(o(446));
      switch (t) {
        case "meta":
        case "title":
          return null;
        case "style":
          return typeof n.precedence == "string" && typeof n.href == "string" ? (e = ni(n.href), n = Ea(s).hoistableStyles, i = n.get(e), i || (i = {
            type: "style",
            instance: null,
            count: 0,
            state: null
          }, n.set(e, i)), i) : {
            type: "void",
            instance: null,
            count: 0,
            state: null
          };
        case "link":
          if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
            t = ni(n.href);
            var r = Ea(s).hoistableStyles, h = r.get(t);
            if (h || (s = s.ownerDocument || s, h = {
              type: "stylesheet",
              instance: null,
              count: 0,
              state: {
                loading: 0,
                preload: null
              }
            }, r.set(t, h), (r = s.querySelector(al(t))) && !r._p && (h.instance = r, h.state.loading = 5), Le.has(t) || (n = {
              rel: "preload",
              as: "style",
              href: n.href,
              crossOrigin: n.crossOrigin,
              integrity: n.integrity,
              media: n.media,
              hrefLang: n.hrefLang,
              referrerPolicy: n.referrerPolicy
            }, Le.set(t, n), r || V1(s, t, n, h.state))), e && i === null) throw Error(o(528, ""));
            return h;
          }
          if (e && i !== null) throw Error(o(529, ""));
          return null;
        case "script":
          return e = n.async, n = n.src, typeof n == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = ai(n), n = Ea(s).hoistableScripts, i = n.get(e), i || (i = {
            type: "script",
            instance: null,
            count: 0,
            state: null
          }, n.set(e, i)), i) : {
            type: "void",
            instance: null,
            count: 0,
            state: null
          };
        default:
          throw Error(o(444, t));
      }
    }
    function ni(t) {
      return 'href="' + je(t) + '"';
    }
    function al(t) {
      return 'link[rel="stylesheet"][' + t + "]";
    }
    function km(t) {
      return b({}, t, {
        "data-precedence": t.precedence,
        precedence: null
      });
    }
    function V1(t, e, n, i) {
      t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? i.loading = 1 : (e = t.createElement("link"), i.preload = e, e.addEventListener("load", function() {
        return i.loading |= 1;
      }), e.addEventListener("error", function() {
        return i.loading |= 2;
      }), ae(e, "link", n), Wt(e), t.head.appendChild(e));
    }
    function ai(t) {
      return '[src="' + je(t) + '"]';
    }
    function il(t) {
      return "script[async]" + t;
    }
    function Zm(t, e, n) {
      if (e.count++, e.instance === null) switch (e.type) {
        case "style":
          var i = t.querySelector('style[data-href~="' + je(n.href) + '"]');
          if (i) return e.instance = i, Wt(i), i;
          var s = b({}, n, {
            "data-href": n.href,
            "data-precedence": n.precedence,
            href: null,
            precedence: null
          });
          return i = (t.ownerDocument || t).createElement("style"), Wt(i), ae(i, "style", s), Ns(i, n.precedence, t), e.instance = i;
        case "stylesheet":
          s = ni(n.href);
          var r = t.querySelector(al(s));
          if (r) return e.state.loading |= 4, e.instance = r, Wt(r), r;
          i = km(n), (s = Le.get(s)) && Mr(i, s), r = (t.ownerDocument || t).createElement("link"), Wt(r);
          var h = r;
          return h._p = new Promise(function(g, T) {
            h.onload = g, h.onerror = T;
          }), ae(r, "link", i), e.state.loading |= 4, Ns(r, n.precedence, t), e.instance = r;
        case "script":
          return r = ai(n.src), (s = t.querySelector(il(r))) ? (e.instance = s, Wt(s), s) : (i = n, (s = Le.get(r)) && (i = b({}, n), Cr(i, s)), t = t.ownerDocument || t, s = t.createElement("script"), Wt(s), ae(s, "link", i), t.head.appendChild(s), e.instance = s);
        case "void":
          return null;
        default:
          throw Error(o(443, e.type));
      }
      else e.type === "stylesheet" && (e.state.loading & 4) === 0 && (i = e.instance, e.state.loading |= 4, Ns(i, n.precedence, t));
      return e.instance;
    }
    function Ns(t, e, n) {
      for (var i = n.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'), s = i.length ? i[i.length - 1] : null, r = s, h = 0; h < i.length; h++) {
        var g = i[h];
        if (g.dataset.precedence === e) r = g;
        else if (r !== s) break;
      }
      r ? r.parentNode.insertBefore(t, r.nextSibling) : (e = n.nodeType === 9 ? n.head : n, e.insertBefore(t, e.firstChild));
    }
    function Mr(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
    }
    function Cr(t, e) {
      t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
    }
    var _s = null;
    function Km(t, e, n) {
      if (_s === null) {
        var i = /* @__PURE__ */ new Map(), s = _s = /* @__PURE__ */ new Map();
        s.set(n, i);
      } else s = _s, i = s.get(n), i || (i = /* @__PURE__ */ new Map(), s.set(n, i));
      if (i.has(t)) return i;
      for (i.set(t, null), n = n.getElementsByTagName(t), s = 0; s < n.length; s++) {
        var r = n[s];
        if (!(r[Si] || r[It] || t === "link" && r.getAttribute("rel") === "stylesheet") && r.namespaceURI !== "http://www.w3.org/2000/svg") {
          var h = r.getAttribute(e) || "";
          h = t + h;
          var g = i.get(h);
          g ? g.push(r) : i.set(h, [
            r
          ]);
        }
      }
      return i;
    }
    function Qm(t, e, n) {
      t = t.ownerDocument || t, t.head.insertBefore(n, e === "title" ? t.querySelector("head > title") : null);
    }
    function U1(t, e, n) {
      if (n === 1 || e.itemProp != null) return false;
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
    function Jm(t) {
      return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
    }
    function B1(t, e, n, i) {
      if (n.type === "stylesheet" && (typeof i.media != "string" || matchMedia(i.media).matches !== false) && (n.state.loading & 4) === 0) {
        if (n.instance === null) {
          var s = ni(i.href), r = e.querySelector(al(s));
          if (r) {
            e = r._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = ws.bind(t), e.then(t, t)), n.state.loading |= 4, n.instance = r, Wt(r);
            return;
          }
          r = e.ownerDocument || e, i = km(i), (s = Le.get(s)) && Mr(i, s), r = r.createElement("link"), Wt(r);
          var h = r;
          h._p = new Promise(function(g, T) {
            h.onload = g, h.onerror = T;
          }), ae(r, "link", i), n.instance = r;
        }
        t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(n, e), (e = n.state.preload) && (n.state.loading & 3) === 0 && (t.count++, n = ws.bind(t), e.addEventListener("load", n), e.addEventListener("error", n));
      }
    }
    var Dr = 0;
    function L1(t, e) {
      return t.stylesheets && t.count === 0 && Us(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(n) {
        var i = setTimeout(function() {
          if (t.stylesheets && Us(t, t.stylesheets), t.unsuspend) {
            var r = t.unsuspend;
            t.unsuspend = null, r();
          }
        }, 6e4 + e);
        0 < t.imgBytes && Dr === 0 && (Dr = 62500 * v1());
        var s = setTimeout(function() {
          if (t.waitingForImages = false, t.count === 0 && (t.stylesheets && Us(t, t.stylesheets), t.unsuspend)) {
            var r = t.unsuspend;
            t.unsuspend = null, r();
          }
        }, (t.imgBytes > Dr ? 50 : 800) + e);
        return t.unsuspend = n, function() {
          t.unsuspend = null, clearTimeout(i), clearTimeout(s);
        };
      } : null;
    }
    function ws() {
      if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
        if (this.stylesheets) Us(this, this.stylesheets);
        else if (this.unsuspend) {
          var t = this.unsuspend;
          this.unsuspend = null, t();
        }
      }
    }
    var Vs = null;
    function Us(t, e) {
      t.stylesheets = null, t.unsuspend !== null && (t.count++, Vs = /* @__PURE__ */ new Map(), e.forEach(H1, t), Vs = null, ws.call(t));
    }
    function H1(t, e) {
      if (!(e.state.loading & 4)) {
        var n = Vs.get(t);
        if (n) var i = n.get(null);
        else {
          n = /* @__PURE__ */ new Map(), Vs.set(t, n);
          for (var s = t.querySelectorAll("link[data-precedence],style[data-precedence]"), r = 0; r < s.length; r++) {
            var h = s[r];
            (h.nodeName === "LINK" || h.getAttribute("media") !== "not all") && (n.set(h.dataset.precedence, h), i = h);
          }
          i && n.set(null, i);
        }
        s = e.instance, h = s.getAttribute("data-precedence"), r = n.get(h) || i, r === i && n.set(null, s), n.set(h, s), this.count++, i = ws.bind(this), s.addEventListener("load", i), s.addEventListener("error", i), r ? r.parentNode.insertBefore(s, r.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(s, t.firstChild)), e.state.loading |= 4;
      }
    }
    var ll = {
      $$typeof: X,
      Provider: null,
      Consumer: null,
      _currentValue: L,
      _currentValue2: L,
      _threadCount: 0
    };
    function q1(t, e, n, i, s, r, h, g, T) {
      this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = xu(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = xu(0), this.hiddenUpdates = xu(null), this.identifierPrefix = i, this.onUncaughtError = s, this.onCaughtError = r, this.onRecoverableError = h, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = T, this.incompleteTransitions = /* @__PURE__ */ new Map();
    }
    function Fm(t, e, n, i, s, r, h, g, T, R, V, H) {
      return t = new q1(t, e, n, h, T, R, V, H, g), e = 1, r === true && (e |= 24), r = Te(3, null, null, e), t.current = r, r.stateNode = t, e = lo(), e.refCount++, t.pooledCache = e, e.refCount++, r.memoizedState = {
        element: i,
        isDehydrated: n,
        cache: e
      }, ro(r), t;
    }
    function Pm(t) {
      return t ? (t = wa, t) : wa;
    }
    function Wm(t, e, n, i, s, r) {
      s = Pm(s), i.context === null ? i.context = s : i.pendingContext = s, i = Dn(e), i.payload = {
        element: n
      }, r = r === void 0 ? null : r, r !== null && (i.callback = r), n = zn(t, i, e), n !== null && (ge(n, t, e), Bi(n, t, e));
    }
    function $m(t, e) {
      if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
        var n = t.retryLane;
        t.retryLane = n !== 0 && n < e ? n : e;
      }
    }
    function zr(t, e) {
      $m(t, e), (t = t.alternate) && $m(t, e);
    }
    function Im(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = na(t, 67108864);
        e !== null && ge(e, t, 67108864), zr(t, 67108864);
      }
    }
    function tp(t) {
      if (t.tag === 13 || t.tag === 31) {
        var e = De();
        e = Tu(e);
        var n = na(t, e);
        n !== null && ge(n, t, e), zr(t, e);
      }
    }
    var Bs = true;
    function Y1(t, e, n, i) {
      var s = x.T;
      x.T = null;
      var r = O.p;
      try {
        O.p = 2, Rr(t, e, n, i);
      } finally {
        O.p = r, x.T = s;
      }
    }
    function G1(t, e, n, i) {
      var s = x.T;
      x.T = null;
      var r = O.p;
      try {
        O.p = 8, Rr(t, e, n, i);
      } finally {
        O.p = r, x.T = s;
      }
    }
    function Rr(t, e, n, i) {
      if (Bs) {
        var s = jr(i);
        if (s === null) pr(t, e, i, Ls, n), np(t, i);
        else if (k1(s, t, e, n, i)) i.stopPropagation();
        else if (np(t, i), e & 4 && -1 < X1.indexOf(t)) {
          for (; s !== null; ) {
            var r = Aa(s);
            if (r !== null) switch (r.tag) {
              case 3:
                if (r = r.stateNode, r.current.memoizedState.isDehydrated) {
                  var h = Wn(r.pendingLanes);
                  if (h !== 0) {
                    var g = r;
                    for (g.pendingLanes |= 2, g.entangledLanes |= 2; h; ) {
                      var T = 1 << 31 - Se(h);
                      g.entanglements[1] |= T, h &= ~T;
                    }
                    Pe(r), (xt & 6) === 0 && (Ss = ve() + 500, Ii(0));
                  }
                }
                break;
              case 31:
              case 13:
                g = na(r, 2), g !== null && ge(g, r, 2), Ts(), zr(r, 2);
            }
            if (r = jr(i), r === null && pr(t, e, i, Ls, n), r === s) break;
            s = r;
          }
          s !== null && i.stopPropagation();
        } else pr(t, e, i, null, n);
      }
    }
    function jr(t) {
      return t = Ou(t), Or(t);
    }
    var Ls = null;
    function Or(t) {
      if (Ls = null, t = Ta(t), t !== null) {
        var e = d(t);
        if (e === null) t = null;
        else {
          var n = e.tag;
          if (n === 13) {
            if (t = f(e), t !== null) return t;
            t = null;
          } else if (n === 31) {
            if (t = m(e), t !== null) return t;
            t = null;
          } else if (n === 3) {
            if (e.stateNode.current.memoizedState.isDehydrated) return e.tag === 3 ? e.stateNode.containerInfo : null;
            t = null;
          } else e !== t && (t = null);
        }
      }
      return Ls = t, null;
    }
    function ep(t) {
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
          switch (zg()) {
            case rf:
              return 2;
            case cf:
              return 8;
            case Dl:
            case Rg:
              return 32;
            case ff:
              return 268435456;
            default:
              return 32;
          }
        default:
          return 32;
      }
    }
    var Nr = false, Hn = null, qn = null, Yn = null, sl = /* @__PURE__ */ new Map(), ul = /* @__PURE__ */ new Map(), Gn = [], X1 = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
    function np(t, e) {
      switch (t) {
        case "focusin":
        case "focusout":
          Hn = null;
          break;
        case "dragenter":
        case "dragleave":
          qn = null;
          break;
        case "mouseover":
        case "mouseout":
          Yn = null;
          break;
        case "pointerover":
        case "pointerout":
          sl.delete(e.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          ul.delete(e.pointerId);
      }
    }
    function ol(t, e, n, i, s, r) {
      return t === null || t.nativeEvent !== r ? (t = {
        blockedOn: e,
        domEventName: n,
        eventSystemFlags: i,
        nativeEvent: r,
        targetContainers: [
          s
        ]
      }, e !== null && (e = Aa(e), e !== null && Im(e)), t) : (t.eventSystemFlags |= i, e = t.targetContainers, s !== null && e.indexOf(s) === -1 && e.push(s), t);
    }
    function k1(t, e, n, i, s) {
      switch (e) {
        case "focusin":
          return Hn = ol(Hn, t, e, n, i, s), true;
        case "dragenter":
          return qn = ol(qn, t, e, n, i, s), true;
        case "mouseover":
          return Yn = ol(Yn, t, e, n, i, s), true;
        case "pointerover":
          var r = s.pointerId;
          return sl.set(r, ol(sl.get(r) || null, t, e, n, i, s)), true;
        case "gotpointercapture":
          return r = s.pointerId, ul.set(r, ol(ul.get(r) || null, t, e, n, i, s)), true;
      }
      return false;
    }
    function ap(t) {
      var e = Ta(t.target);
      if (e !== null) {
        var n = d(e);
        if (n !== null) {
          if (e = n.tag, e === 13) {
            if (e = f(n), e !== null) {
              t.blockedOn = e, gf(t.priority, function() {
                tp(n);
              });
              return;
            }
          } else if (e === 31) {
            if (e = m(n), e !== null) {
              t.blockedOn = e, gf(t.priority, function() {
                tp(n);
              });
              return;
            }
          } else if (e === 3 && n.stateNode.current.memoizedState.isDehydrated) {
            t.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
            return;
          }
        }
      }
      t.blockedOn = null;
    }
    function Hs(t) {
      if (t.blockedOn !== null) return false;
      for (var e = t.targetContainers; 0 < e.length; ) {
        var n = jr(t.nativeEvent);
        if (n === null) {
          n = t.nativeEvent;
          var i = new n.constructor(n.type, n);
          ju = i, n.target.dispatchEvent(i), ju = null;
        } else return e = Aa(n), e !== null && Im(e), t.blockedOn = n, false;
        e.shift();
      }
      return true;
    }
    function ip(t, e, n) {
      Hs(t) && n.delete(e);
    }
    function Z1() {
      Nr = false, Hn !== null && Hs(Hn) && (Hn = null), qn !== null && Hs(qn) && (qn = null), Yn !== null && Hs(Yn) && (Yn = null), sl.forEach(ip), ul.forEach(ip);
    }
    function qs(t, e) {
      t.blockedOn === e && (t.blockedOn = null, Nr || (Nr = true, a.unstable_scheduleCallback(a.unstable_NormalPriority, Z1)));
    }
    var Ys = null;
    function lp(t) {
      Ys !== t && (Ys = t, a.unstable_scheduleCallback(a.unstable_NormalPriority, function() {
        Ys === t && (Ys = null);
        for (var e = 0; e < t.length; e += 3) {
          var n = t[e], i = t[e + 1], s = t[e + 2];
          if (typeof i != "function") {
            if (Or(i || n) === null) continue;
            break;
          }
          var r = Aa(n);
          r !== null && (t.splice(e, 3), e -= 3, jo(r, {
            pending: true,
            data: s,
            method: n.method,
            action: i
          }, i, s));
        }
      }));
    }
    function ii(t) {
      function e(T) {
        return qs(T, t);
      }
      Hn !== null && qs(Hn, t), qn !== null && qs(qn, t), Yn !== null && qs(Yn, t), sl.forEach(e), ul.forEach(e);
      for (var n = 0; n < Gn.length; n++) {
        var i = Gn[n];
        i.blockedOn === t && (i.blockedOn = null);
      }
      for (; 0 < Gn.length && (n = Gn[0], n.blockedOn === null); ) ap(n), n.blockedOn === null && Gn.shift();
      if (n = (t.ownerDocument || t).$$reactFormReplay, n != null) for (i = 0; i < n.length; i += 3) {
        var s = n[i], r = n[i + 1], h = s[fe] || null;
        if (typeof r == "function") h || lp(n);
        else if (h) {
          var g = null;
          if (r && r.hasAttribute("formAction")) {
            if (s = r, h = r[fe] || null) g = h.formAction;
            else if (Or(s) !== null) continue;
          } else g = h.action;
          typeof g == "function" ? n[i + 1] = g : (n.splice(i, 3), i -= 3), lp(n);
        }
      }
    }
    function sp() {
      function t(r) {
        r.canIntercept && r.info === "react-transition" && r.intercept({
          handler: function() {
            return new Promise(function(h) {
              return s = h;
            });
          },
          focusReset: "manual",
          scroll: "manual"
        });
      }
      function e() {
        s !== null && (s(), s = null), i || setTimeout(n, 20);
      }
      function n() {
        if (!i && !navigation.transition) {
          var r = navigation.currentEntry;
          r && r.url != null && navigation.navigate(r.url, {
            state: r.getState(),
            info: "react-transition",
            history: "replace"
          });
        }
      }
      if (typeof navigation == "object") {
        var i = false, s = null;
        return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(n, 100), function() {
          i = true, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), s !== null && (s(), s = null);
        };
      }
    }
    function _r(t) {
      this._internalRoot = t;
    }
    Gs.prototype.render = _r.prototype.render = function(t) {
      var e = this._internalRoot;
      if (e === null) throw Error(o(409));
      var n = e.current, i = De();
      Wm(n, i, t, e, null, null);
    }, Gs.prototype.unmount = _r.prototype.unmount = function() {
      var t = this._internalRoot;
      if (t !== null) {
        this._internalRoot = null;
        var e = t.containerInfo;
        Wm(t.current, 2, null, t, null, null), Ts(), e[xa] = null;
      }
    };
    function Gs(t) {
      this._internalRoot = t;
    }
    Gs.prototype.unstable_scheduleHydration = function(t) {
      if (t) {
        var e = yf();
        t = {
          blockedOn: null,
          target: t,
          priority: e
        };
        for (var n = 0; n < Gn.length && e !== 0 && e < Gn[n].priority; n++) ;
        Gn.splice(n, 0, t), n === 0 && ap(t);
      }
    };
    var up = l.version;
    if (up !== "19.2.4") throw Error(o(527, up, "19.2.4"));
    O.findDOMNode = function(t) {
      var e = t._reactInternals;
      if (e === void 0) throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
      return t = p(e), t = t !== null ? v(t) : null, t = t === null ? null : t.stateNode, t;
    };
    var K1 = {
      bundleType: 0,
      version: "19.2.4",
      rendererPackageName: "react-dom",
      currentDispatcherRef: x,
      reconcilerVersion: "19.2.4"
    };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
      var Xs = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!Xs.isDisabled && Xs.supportsFiber) try {
        gi = Xs.inject(K1), be = Xs;
      } catch {
      }
    }
    return cl.createRoot = function(t, e) {
      if (!c(t)) throw Error(o(299));
      var n = false, i = "", s = md, r = pd, h = yd;
      return e != null && (e.unstable_strictMode === true && (n = true), e.identifierPrefix !== void 0 && (i = e.identifierPrefix), e.onUncaughtError !== void 0 && (s = e.onUncaughtError), e.onCaughtError !== void 0 && (r = e.onCaughtError), e.onRecoverableError !== void 0 && (h = e.onRecoverableError)), e = Fm(t, 1, false, null, null, n, i, null, s, r, h, sp), t[xa] = e.current, mr(t), new _r(e);
    }, cl.hydrateRoot = function(t, e, n) {
      if (!c(t)) throw Error(o(299));
      var i = false, s = "", r = md, h = pd, g = yd, T = null;
      return n != null && (n.unstable_strictMode === true && (i = true), n.identifierPrefix !== void 0 && (s = n.identifierPrefix), n.onUncaughtError !== void 0 && (r = n.onUncaughtError), n.onCaughtError !== void 0 && (h = n.onCaughtError), n.onRecoverableError !== void 0 && (g = n.onRecoverableError), n.formState !== void 0 && (T = n.formState)), e = Fm(t, 1, true, e, n ?? null, i, s, T, r, h, g, sp), e.context = Pm(null), n = e.current, i = De(), i = Tu(i), s = Dn(i), s.callback = null, zn(n, s, i), n = i, e.current.lanes = n, bi(e, n), Pe(e), t[xa] = e.current, mr(t), new Gs(e);
    }, cl.version = "19.2.4", cl;
  }
  var gp;
  function nb() {
    if (gp) return Ur.exports;
    gp = 1;
    function a() {
      if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(a);
      } catch (l) {
        console.error(l);
      }
    }
    return a(), Ur.exports = eb(), Ur.exports;
  }
  var ab = nb();
  const ib = Uy(ab), zc = w.createContext({});
  function Rc(a) {
    const l = w.useRef(null);
    return l.current === null && (l.current = a()), l.current;
  }
  const lb = typeof window < "u", Ly = lb ? w.useLayoutEffect : w.useEffect, fu = w.createContext(null);
  function jc(a, l) {
    a.indexOf(l) === -1 && a.push(l);
  }
  function au(a, l) {
    const u = a.indexOf(l);
    u > -1 && a.splice(u, 1);
  }
  const Ie = (a, l, u) => u > l ? l : u < a ? a : u;
  let Oc = () => {
  };
  const Kn = {}, Hy = (a) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(a);
  function qy(a) {
    return typeof a == "object" && a !== null;
  }
  const Yy = (a) => /^0[^.\s]+$/u.test(a);
  function Gy(a) {
    let l;
    return () => (l === void 0 && (l = a()), l);
  }
  const qe = (a) => a, sb = (a, l) => (u) => l(a(u)), Tl = (...a) => a.reduce(sb), vl = (a, l, u) => {
    const o = l - a;
    return o === 0 ? 1 : (u - a) / o;
  };
  class Nc {
    constructor() {
      this.subscriptions = [];
    }
    add(l) {
      return jc(this.subscriptions, l), () => au(this.subscriptions, l);
    }
    notify(l, u, o) {
      const c = this.subscriptions.length;
      if (c) if (c === 1) this.subscriptions[0](l, u, o);
      else for (let d = 0; d < c; d++) {
        const f = this.subscriptions[d];
        f && f(l, u, o);
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  }
  const ze = (a) => a * 1e3, He = (a) => a / 1e3;
  function Xy(a, l) {
    return l ? a * (1e3 / l) : 0;
  }
  const ky = (a, l, u) => (((1 - 3 * u + 3 * l) * a + (3 * u - 6 * l)) * a + 3 * l) * a, ub = 1e-7, ob = 12;
  function rb(a, l, u, o, c) {
    let d, f, m = 0;
    do
      f = l + (u - l) / 2, d = ky(f, o, c) - a, d > 0 ? u = f : l = f;
    while (Math.abs(d) > ub && ++m < ob);
    return f;
  }
  function Al(a, l, u, o) {
    if (a === l && u === o) return qe;
    const c = (d) => rb(d, 0, 1, a, u);
    return (d) => d === 0 || d === 1 ? d : ky(c(d), l, o);
  }
  const Zy = (a) => (l) => l <= 0.5 ? a(2 * l) / 2 : (2 - a(2 * (1 - l))) / 2, Ky = (a) => (l) => 1 - a(1 - l), Qy = Al(0.33, 1.53, 0.69, 0.99), _c = Ky(Qy), Jy = Zy(_c), Fy = (a) => a >= 1 ? 1 : (a *= 2) < 1 ? 0.5 * _c(a) : 0.5 * (2 - Math.pow(2, -10 * (a - 1))), wc = (a) => 1 - Math.sin(Math.acos(a)), Py = Ky(wc), Wy = Zy(wc), cb = Al(0.42, 0, 1, 1), fb = Al(0, 0, 0.58, 1), $y = Al(0.42, 0, 0.58, 1), hb = (a) => Array.isArray(a) && typeof a[0] != "number", Iy = (a) => Array.isArray(a) && typeof a[0] == "number", db = {
    linear: qe,
    easeIn: cb,
    easeInOut: $y,
    easeOut: fb,
    circIn: wc,
    circInOut: Wy,
    circOut: Py,
    backIn: _c,
    backInOut: Jy,
    backOut: Qy,
    anticipate: Fy
  }, mb = (a) => typeof a == "string", vp = (a) => {
    if (Iy(a)) {
      Oc(a.length === 4);
      const [l, u, o, c] = a;
      return Al(l, u, o, c);
    } else if (mb(a)) return db[a];
    return a;
  }, ks = [
    "setup",
    "read",
    "resolveKeyframes",
    "preUpdate",
    "update",
    "preRender",
    "render",
    "postRender"
  ];
  function pb(a, l) {
    let u = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = false, d = false;
    const f = /* @__PURE__ */ new WeakSet();
    let m = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function y(v) {
      f.has(v) && (p.schedule(v), a()), v(m);
    }
    const p = {
      schedule: (v, b = false, S = false) => {
        const N = S && c ? u : o;
        return b && f.add(v), N.add(v), v;
      },
      cancel: (v) => {
        o.delete(v), f.delete(v);
      },
      process: (v) => {
        if (m = v, c) {
          d = true;
          return;
        }
        c = true;
        const b = u;
        u = o, o = b, u.forEach(y), u.clear(), c = false, d && (d = false, p.process(v));
      }
    };
    return p;
  }
  const yb = 40;
  function t0(a, l) {
    let u = false, o = true;
    const c = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    }, d = () => u = true, f = ks.reduce((X, Z) => (X[Z] = pb(d), X), {}), { setup: m, read: y, resolveKeyframes: p, preUpdate: v, update: b, preRender: S, render: D, postRender: N } = f, q = () => {
      const X = Kn.useManualTiming, Z = X ? c.timestamp : performance.now();
      u = false, X || (c.delta = o ? 1e3 / 60 : Math.max(Math.min(Z - c.timestamp, yb), 1)), c.timestamp = Z, c.isProcessing = true, m.process(c), y.process(c), p.process(c), v.process(c), b.process(c), S.process(c), D.process(c), N.process(c), c.isProcessing = false, u && l && (o = false, a(q));
    }, Y = () => {
      u = true, o = true, c.isProcessing || a(q);
    };
    return {
      schedule: ks.reduce((X, Z) => {
        const $ = f[Z];
        return X[Z] = (st, et = false, J = false) => (u || Y(), $.schedule(st, et, J)), X;
      }, {}),
      cancel: (X) => {
        for (let Z = 0; Z < ks.length; Z++) f[ks[Z]].cancel(X);
      },
      state: c,
      steps: f
    };
  }
  const { schedule: Rt, cancel: Qn, state: ie, steps: qr } = t0(typeof requestAnimationFrame < "u" ? requestAnimationFrame : qe, true);
  let Fs;
  function gb() {
    Fs = void 0;
  }
  const re = {
    now: () => (Fs === void 0 && re.set(ie.isProcessing || Kn.useManualTiming ? ie.timestamp : performance.now()), Fs),
    set: (a) => {
      Fs = a, queueMicrotask(gb);
    }
  }, e0 = (a) => (l) => typeof l == "string" && l.startsWith(a), n0 = e0("--"), vb = e0("var(--"), Vc = (a) => vb(a) ? bb.test(a.split("/*")[0].trim()) : false, bb = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
  function bp(a) {
    return typeof a != "string" ? false : a.split("/*")[0].includes("var(--");
  }
  const di = {
    test: (a) => typeof a == "number",
    parse: parseFloat,
    transform: (a) => a
  }, bl = {
    ...di,
    transform: (a) => Ie(0, 1, a)
  }, Zs = {
    ...di,
    default: 1
  }, ml = (a) => Math.round(a * 1e5) / 1e5, Uc = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
  function Sb(a) {
    return a == null;
  }
  const xb = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu, Bc = (a, l) => (u) => !!(typeof u == "string" && xb.test(u) && u.startsWith(a) || l && !Sb(u) && Object.prototype.hasOwnProperty.call(u, l)), a0 = (a, l, u) => (o) => {
    if (typeof o != "string") return o;
    const [c, d, f, m] = o.match(Uc);
    return {
      [a]: parseFloat(c),
      [l]: parseFloat(d),
      [u]: parseFloat(f),
      alpha: m !== void 0 ? parseFloat(m) : 1
    };
  }, Tb = (a) => Ie(0, 255, a), Yr = {
    ...di,
    transform: (a) => Math.round(Tb(a))
  }, ga = {
    test: Bc("rgb", "red"),
    parse: a0("red", "green", "blue"),
    transform: ({ red: a, green: l, blue: u, alpha: o = 1 }) => "rgba(" + Yr.transform(a) + ", " + Yr.transform(l) + ", " + Yr.transform(u) + ", " + ml(bl.transform(o)) + ")"
  };
  function Ab(a) {
    let l = "", u = "", o = "", c = "";
    return a.length > 5 ? (l = a.substring(1, 3), u = a.substring(3, 5), o = a.substring(5, 7), c = a.substring(7, 9)) : (l = a.substring(1, 2), u = a.substring(2, 3), o = a.substring(3, 4), c = a.substring(4, 5), l += l, u += u, o += o, c += c), {
      red: parseInt(l, 16),
      green: parseInt(u, 16),
      blue: parseInt(o, 16),
      alpha: c ? parseInt(c, 16) / 255 : 1
    };
  }
  const nc = {
    test: Bc("#"),
    parse: Ab,
    transform: ga.transform
  }, El = (a) => ({
    test: (l) => typeof l == "string" && l.endsWith(a) && l.split(" ").length === 1,
    parse: parseFloat,
    transform: (l) => `${l}${a}`
  }), kn = El("deg"), $e = El("%"), I = El("px"), Eb = El("vh"), Mb = El("vw"), Sp = {
    ...$e,
    parse: (a) => $e.parse(a) / 100,
    transform: (a) => $e.transform(a * 100)
  }, si = {
    test: Bc("hsl", "hue"),
    parse: a0("hue", "saturation", "lightness"),
    transform: ({ hue: a, saturation: l, lightness: u, alpha: o = 1 }) => "hsla(" + Math.round(a) + ", " + $e.transform(ml(l)) + ", " + $e.transform(ml(u)) + ", " + ml(bl.transform(o)) + ")"
  }, Jt = {
    test: (a) => ga.test(a) || nc.test(a) || si.test(a),
    parse: (a) => ga.test(a) ? ga.parse(a) : si.test(a) ? si.parse(a) : nc.parse(a),
    transform: (a) => typeof a == "string" ? a : a.hasOwnProperty("red") ? ga.transform(a) : si.transform(a),
    getAnimatableNone: (a) => {
      const l = Jt.parse(a);
      return l.alpha = 0, Jt.transform(l);
    }
  }, Cb = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
  function Db(a) {
    var _a, _b2;
    return isNaN(a) && typeof a == "string" && (((_a = a.match(Uc)) == null ? void 0 : _a.length) || 0) + (((_b2 = a.match(Cb)) == null ? void 0 : _b2.length) || 0) > 0;
  }
  const i0 = "number", l0 = "color", zb = "var", Rb = "var(", xp = "${}", jb = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function fi(a) {
    const l = a.toString(), u = [], o = {
      color: [],
      number: [],
      var: []
    }, c = [];
    let d = 0;
    const m = l.replace(jb, (y) => (Jt.test(y) ? (o.color.push(d), c.push(l0), u.push(Jt.parse(y))) : y.startsWith(Rb) ? (o.var.push(d), c.push(zb), u.push(y)) : (o.number.push(d), c.push(i0), u.push(parseFloat(y))), ++d, xp)).split(xp);
    return {
      values: u,
      split: m,
      indexes: o,
      types: c
    };
  }
  function Ob(a) {
    return fi(a).values;
  }
  function s0({ split: a, types: l }) {
    const u = a.length;
    return (o) => {
      let c = "";
      for (let d = 0; d < u; d++) if (c += a[d], o[d] !== void 0) {
        const f = l[d];
        f === i0 ? c += ml(o[d]) : f === l0 ? c += Jt.transform(o[d]) : c += o[d];
      }
      return c;
    };
  }
  function Nb(a) {
    return s0(fi(a));
  }
  const _b = (a) => typeof a == "number" ? 0 : Jt.test(a) ? Jt.getAnimatableNone(a) : a, wb = (a, l) => typeof a == "number" ? (l == null ? void 0 : l.trim().endsWith("/")) ? a : 0 : _b(a);
  function Vb(a) {
    const l = fi(a);
    return s0(l)(l.values.map((o, c) => wb(o, l.split[c])));
  }
  const Ke = {
    test: Db,
    parse: Ob,
    createTransformer: Nb,
    getAnimatableNone: Vb
  };
  function Gr(a, l, u) {
    return u < 0 && (u += 1), u > 1 && (u -= 1), u < 1 / 6 ? a + (l - a) * 6 * u : u < 1 / 2 ? l : u < 2 / 3 ? a + (l - a) * (2 / 3 - u) * 6 : a;
  }
  function Ub({ hue: a, saturation: l, lightness: u, alpha: o }) {
    a /= 360, l /= 100, u /= 100;
    let c = 0, d = 0, f = 0;
    if (!l) c = d = f = u;
    else {
      const m = u < 0.5 ? u * (1 + l) : u + l - u * l, y = 2 * u - m;
      c = Gr(y, m, a + 1 / 3), d = Gr(y, m, a), f = Gr(y, m, a - 1 / 3);
    }
    return {
      red: Math.round(c * 255),
      green: Math.round(d * 255),
      blue: Math.round(f * 255),
      alpha: o
    };
  }
  function iu(a, l) {
    return (u) => u > 0 ? l : a;
  }
  const Bt = (a, l, u) => a + (l - a) * u, Xr = (a, l, u) => {
    const o = a * a, c = u * (l * l - o) + o;
    return c < 0 ? 0 : Math.sqrt(c);
  }, Bb = [
    nc,
    ga,
    si
  ], Lb = (a) => Bb.find((l) => l.test(a));
  function Tp(a) {
    const l = Lb(a);
    if (!l) return false;
    let u = l.parse(a);
    return l === si && (u = Ub(u)), u;
  }
  const Ap = (a, l) => {
    const u = Tp(a), o = Tp(l);
    if (!u || !o) return iu(a, l);
    const c = {
      ...u
    };
    return (d) => (c.red = Xr(u.red, o.red, d), c.green = Xr(u.green, o.green, d), c.blue = Xr(u.blue, o.blue, d), c.alpha = Bt(u.alpha, o.alpha, d), ga.transform(c));
  }, ac = /* @__PURE__ */ new Set([
    "none",
    "hidden"
  ]);
  function Hb(a, l) {
    return ac.has(a) ? (u) => u <= 0 ? a : l : (u) => u >= 1 ? l : a;
  }
  function qb(a, l) {
    return (u) => Bt(a, l, u);
  }
  function Lc(a) {
    return typeof a == "number" ? qb : typeof a == "string" ? Vc(a) ? iu : Jt.test(a) ? Ap : Xb : Array.isArray(a) ? u0 : typeof a == "object" ? Jt.test(a) ? Ap : Yb : iu;
  }
  function u0(a, l) {
    const u = [
      ...a
    ], o = u.length, c = a.map((d, f) => Lc(d)(d, l[f]));
    return (d) => {
      for (let f = 0; f < o; f++) u[f] = c[f](d);
      return u;
    };
  }
  function Yb(a, l) {
    const u = {
      ...a,
      ...l
    }, o = {};
    for (const c in u) a[c] !== void 0 && l[c] !== void 0 && (o[c] = Lc(a[c])(a[c], l[c]));
    return (c) => {
      for (const d in o) u[d] = o[d](c);
      return u;
    };
  }
  function Gb(a, l) {
    const u = [], o = {
      color: 0,
      var: 0,
      number: 0
    };
    for (let c = 0; c < l.values.length; c++) {
      const d = l.types[c], f = a.indexes[d][o[d]], m = a.values[f] ?? 0;
      u[c] = m, o[d]++;
    }
    return u;
  }
  const Xb = (a, l) => {
    const u = Ke.createTransformer(l), o = fi(a), c = fi(l);
    return o.indexes.var.length === c.indexes.var.length && o.indexes.color.length === c.indexes.color.length && o.indexes.number.length >= c.indexes.number.length ? ac.has(a) && !c.values.length || ac.has(l) && !o.values.length ? Hb(a, l) : Tl(u0(Gb(o, c), c.values), u) : iu(a, l);
  };
  function o0(a, l, u) {
    return typeof a == "number" && typeof l == "number" && typeof u == "number" ? Bt(a, l, u) : Lc(a)(a, l);
  }
  const kb = (a) => {
    const l = ({ timestamp: u }) => a(u);
    return {
      start: (u = true) => Rt.update(l, u),
      stop: () => Qn(l),
      now: () => ie.isProcessing ? ie.timestamp : re.now()
    };
  }, r0 = (a, l, u = 10) => {
    let o = "";
    const c = Math.max(Math.round(l / u), 2);
    for (let d = 0; d < c; d++) o += Math.round(a(d / (c - 1)) * 1e4) / 1e4 + ", ";
    return `linear(${o.substring(0, o.length - 2)})`;
  }, lu = 2e4;
  function Hc(a) {
    let l = 0;
    const u = 50;
    let o = a.next(l);
    for (; !o.done && l < lu; ) l += u, o = a.next(l);
    return l >= lu ? 1 / 0 : l;
  }
  function Zb(a, l = 100, u) {
    const o = u({
      ...a,
      keyframes: [
        0,
        l
      ]
    }), c = Math.min(Hc(o), lu);
    return {
      type: "keyframes",
      ease: (d) => o.next(c * d).value / l,
      duration: He(c)
    };
  }
  const qt = {
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
  function ic(a, l) {
    return a * Math.sqrt(1 - l * l);
  }
  const Kb = 12;
  function Qb(a, l, u) {
    let o = u;
    for (let c = 1; c < Kb; c++) o = o - a(o) / l(o);
    return o;
  }
  const kr = 1e-3;
  function Jb({ duration: a = qt.duration, bounce: l = qt.bounce, velocity: u = qt.velocity, mass: o = qt.mass }) {
    let c, d, f = 1 - l;
    f = Ie(qt.minDamping, qt.maxDamping, f), a = Ie(qt.minDuration, qt.maxDuration, He(a)), f < 1 ? (c = (p) => {
      const v = p * f, b = v * a, S = v - u, D = ic(p, f), N = Math.exp(-b);
      return kr - S / D * N;
    }, d = (p) => {
      const b = p * f * a, S = b * u + u, D = Math.pow(f, 2) * Math.pow(p, 2) * a, N = Math.exp(-b), q = ic(Math.pow(p, 2), f);
      return (-c(p) + kr > 0 ? -1 : 1) * ((S - D) * N) / q;
    }) : (c = (p) => {
      const v = Math.exp(-p * a), b = (p - u) * a + 1;
      return -kr + v * b;
    }, d = (p) => {
      const v = Math.exp(-p * a), b = (u - p) * (a * a);
      return v * b;
    });
    const m = 5 / a, y = Qb(c, d, m);
    if (a = ze(a), isNaN(y)) return {
      stiffness: qt.stiffness,
      damping: qt.damping,
      duration: a
    };
    {
      const p = Math.pow(y, 2) * o;
      return {
        stiffness: p,
        damping: f * 2 * Math.sqrt(o * p),
        duration: a
      };
    }
  }
  const Fb = [
    "duration",
    "bounce"
  ], Pb = [
    "stiffness",
    "damping",
    "mass"
  ];
  function Ep(a, l) {
    return l.some((u) => a[u] !== void 0);
  }
  function Wb(a) {
    let l = {
      velocity: qt.velocity,
      stiffness: qt.stiffness,
      damping: qt.damping,
      mass: qt.mass,
      isResolvedFromDuration: false,
      ...a
    };
    if (!Ep(a, Pb) && Ep(a, Fb)) if (l.velocity = 0, a.visualDuration) {
      const u = a.visualDuration, o = 2 * Math.PI / (u * 1.2), c = o * o, d = 2 * Ie(0.05, 1, 1 - (a.bounce || 0)) * Math.sqrt(c);
      l = {
        ...l,
        mass: qt.mass,
        stiffness: c,
        damping: d
      };
    } else {
      const u = Jb({
        ...a,
        velocity: 0
      });
      l = {
        ...l,
        ...u,
        mass: qt.mass
      }, l.isResolvedFromDuration = true;
    }
    return l;
  }
  function su(a = qt.visualDuration, l = qt.bounce) {
    const u = typeof a != "object" ? {
      visualDuration: a,
      keyframes: [
        0,
        1
      ],
      bounce: l
    } : a;
    let { restSpeed: o, restDelta: c } = u;
    const d = u.keyframes[0], f = u.keyframes[u.keyframes.length - 1], m = {
      done: false,
      value: d
    }, { stiffness: y, damping: p, mass: v, duration: b, velocity: S, isResolvedFromDuration: D } = Wb({
      ...u,
      velocity: -He(u.velocity || 0)
    }), N = S || 0, q = p / (2 * Math.sqrt(y * v)), Y = f - d, G = He(Math.sqrt(y / v)), K = Math.abs(Y) < 5;
    o || (o = K ? qt.restSpeed.granular : qt.restSpeed.default), c || (c = K ? qt.restDelta.granular : qt.restDelta.default);
    let X, Z, $, st, et, J;
    if (q < 1) $ = ic(G, q), st = (N + q * G * Y) / $, X = (tt) => {
      const ft = Math.exp(-q * G * tt);
      return f - ft * (st * Math.sin($ * tt) + Y * Math.cos($ * tt));
    }, et = q * G * st + Y * $, J = q * G * Y - st * $, Z = (tt) => Math.exp(-q * G * tt) * (et * Math.sin($ * tt) + J * Math.cos($ * tt));
    else if (q === 1) {
      X = (ft) => f - Math.exp(-G * ft) * (Y + (N + G * Y) * ft);
      const tt = N + G * Y;
      Z = (ft) => Math.exp(-G * ft) * (G * tt * ft - N);
    } else {
      const tt = G * Math.sqrt(q * q - 1);
      X = (_t) => {
        const jt = Math.exp(-q * G * _t), x = Math.min(tt * _t, 300);
        return f - jt * ((N + q * G * Y) * Math.sinh(x) + tt * Y * Math.cosh(x)) / tt;
      };
      const ft = (N + q * G * Y) / tt, pt = q * G * ft - Y * tt, Ut = q * G * Y - ft * tt;
      Z = (_t) => {
        const jt = Math.exp(-q * G * _t), x = Math.min(tt * _t, 300);
        return jt * (pt * Math.sinh(x) + Ut * Math.cosh(x));
      };
    }
    const it = {
      calculatedDuration: D && b || null,
      velocity: (tt) => ze(Z(tt)),
      next: (tt) => {
        if (!D && q < 1) {
          const pt = Math.exp(-q * G * tt), Ut = Math.sin($ * tt), _t = Math.cos($ * tt), jt = f - pt * (st * Ut + Y * _t), x = ze(pt * (et * Ut + J * _t));
          return m.done = Math.abs(x) <= o && Math.abs(f - jt) <= c, m.value = m.done ? f : jt, m;
        }
        const ft = X(tt);
        if (D) m.done = tt >= b;
        else {
          const pt = ze(Z(tt));
          m.done = Math.abs(pt) <= o && Math.abs(f - ft) <= c;
        }
        return m.value = m.done ? f : ft, m;
      },
      toString: () => {
        const tt = Math.min(Hc(it), lu), ft = r0((pt) => it.next(tt * pt).value, tt, 30);
        return tt + "ms " + ft;
      },
      toTransition: () => {
      }
    };
    return it;
  }
  su.applyToOptions = (a) => {
    const l = Zb(a, 100, su);
    return a.ease = l.ease, a.duration = ze(l.duration), a.type = "keyframes", a;
  };
  const $b = 5;
  function c0(a, l, u) {
    const o = Math.max(l - $b, 0);
    return Xy(u - a(o), l - o);
  }
  function lc({ keyframes: a, velocity: l = 0, power: u = 0.8, timeConstant: o = 325, bounceDamping: c = 10, bounceStiffness: d = 500, modifyTarget: f, min: m, max: y, restDelta: p = 0.5, restSpeed: v }) {
    const b = a[0], S = {
      done: false,
      value: b
    }, D = (J) => m !== void 0 && J < m || y !== void 0 && J > y, N = (J) => m === void 0 ? y : y === void 0 || Math.abs(m - J) < Math.abs(y - J) ? m : y;
    let q = u * l;
    const Y = b + q, G = f === void 0 ? Y : f(Y);
    G !== Y && (q = G - b);
    const K = (J) => -q * Math.exp(-J / o), X = (J) => G + K(J), Z = (J) => {
      const it = K(J), tt = X(J);
      S.done = Math.abs(it) <= p, S.value = S.done ? G : tt;
    };
    let $, st;
    const et = (J) => {
      D(S.value) && ($ = J, st = su({
        keyframes: [
          S.value,
          N(S.value)
        ],
        velocity: c0(X, J, S.value),
        damping: c,
        stiffness: d,
        restDelta: p,
        restSpeed: v
      }));
    };
    return et(0), {
      calculatedDuration: null,
      next: (J) => {
        let it = false;
        return !st && $ === void 0 && (it = true, Z(J), et(J)), $ !== void 0 && J >= $ ? st.next(J - $) : (!it && Z(J), S);
      }
    };
  }
  function Ib(a, l, u) {
    const o = [], c = u || Kn.mix || o0, d = a.length - 1;
    for (let f = 0; f < d; f++) {
      let m = c(a[f], a[f + 1]);
      if (l) {
        const y = Array.isArray(l) ? l[f] || qe : l;
        m = Tl(y, m);
      }
      o.push(m);
    }
    return o;
  }
  function tS(a, l, { clamp: u = true, ease: o, mixer: c } = {}) {
    const d = a.length;
    if (Oc(d === l.length), d === 1) return () => l[0];
    if (d === 2 && l[0] === l[1]) return () => l[1];
    const f = a[0] === a[1];
    a[0] > a[d - 1] && (a = [
      ...a
    ].reverse(), l = [
      ...l
    ].reverse());
    const m = Ib(l, o, c), y = m.length, p = (v) => {
      if (f && v < a[0]) return l[0];
      let b = 0;
      if (y > 1) for (; b < a.length - 2 && !(v < a[b + 1]); b++) ;
      const S = vl(a[b], a[b + 1], v);
      return m[b](S);
    };
    return u ? (v) => p(Ie(a[0], a[d - 1], v)) : p;
  }
  function eS(a, l) {
    const u = a[a.length - 1];
    for (let o = 1; o <= l; o++) {
      const c = vl(0, l, o);
      a.push(Bt(u, 1, c));
    }
  }
  function nS(a) {
    const l = [
      0
    ];
    return eS(l, a.length - 1), l;
  }
  function aS(a, l) {
    return a.map((u) => u * l);
  }
  function iS(a, l) {
    return a.map(() => l || $y).splice(0, a.length - 1);
  }
  function pl({ duration: a = 300, keyframes: l, times: u, ease: o = "easeInOut" }) {
    const c = hb(o) ? o.map(vp) : vp(o), d = {
      done: false,
      value: l[0]
    }, f = aS(u && u.length === l.length ? u : nS(l), a), m = tS(f, l, {
      ease: Array.isArray(c) ? c : iS(l, c)
    });
    return {
      calculatedDuration: a,
      next: (y) => (d.value = m(y), d.done = y >= a, d)
    };
  }
  const lS = (a) => a !== null;
  function qc(a, { repeat: l, repeatType: u = "loop" }, o, c = 1) {
    const d = a.filter(lS), m = c < 0 || l && u !== "loop" && l % 2 === 1 ? 0 : d.length - 1;
    return !m || o === void 0 ? d[m] : o;
  }
  const sS = {
    decay: lc,
    inertia: lc,
    tween: pl,
    keyframes: pl,
    spring: su
  };
  function f0(a) {
    typeof a.type == "string" && (a.type = sS[a.type]);
  }
  class Yc {
    constructor() {
      this.updateFinished();
    }
    get finished() {
      return this._finished;
    }
    updateFinished() {
      this._finished = new Promise((l) => {
        this.resolve = l;
      });
    }
    notifyFinished() {
      this.resolve();
    }
    then(l, u) {
      return this.finished.then(l, u);
    }
  }
  const uS = (a) => a / 100;
  class Gc extends Yc {
    constructor(l) {
      super(), this.state = "idle", this.startTime = null, this.isStopped = false, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.stop = () => {
        var _a, _b2;
        const { motionValue: u } = this.options;
        u && u.updatedAt !== re.now() && this.tick(re.now()), this.isStopped = true, this.state !== "idle" && (this.teardown(), (_b2 = (_a = this.options).onStop) == null ? void 0 : _b2.call(_a));
      }, this.options = l, this.initAnimation(), this.play(), l.autoplay === false && this.pause();
    }
    initAnimation() {
      const { options: l } = this;
      f0(l);
      const { type: u = pl, repeat: o = 0, repeatDelay: c = 0, repeatType: d, velocity: f = 0 } = l;
      let { keyframes: m } = l;
      const y = u || pl;
      y !== pl && typeof m[0] != "number" && (this.mixKeyframes = Tl(uS, o0(m[0], m[1])), m = [
        0,
        100
      ]);
      const p = y({
        ...l,
        keyframes: m
      });
      d === "mirror" && (this.mirroredGenerator = y({
        ...l,
        keyframes: [
          ...m
        ].reverse(),
        velocity: -f
      })), p.calculatedDuration === null && (p.calculatedDuration = Hc(p));
      const { calculatedDuration: v } = p;
      this.calculatedDuration = v, this.resolvedDuration = v + c, this.totalDuration = this.resolvedDuration * (o + 1) - c, this.generator = p;
    }
    updateTime(l) {
      const u = Math.round(l - this.startTime) * this.playbackSpeed;
      this.holdTime !== null ? this.currentTime = this.holdTime : this.currentTime = u;
    }
    tick(l, u = false) {
      const { generator: o, totalDuration: c, mixKeyframes: d, mirroredGenerator: f, resolvedDuration: m, calculatedDuration: y } = this;
      if (this.startTime === null) return o.next(0);
      const { delay: p = 0, keyframes: v, repeat: b, repeatType: S, repeatDelay: D, type: N, onUpdate: q, finalKeyframe: Y } = this.options;
      this.speed > 0 ? this.startTime = Math.min(this.startTime, l) : this.speed < 0 && (this.startTime = Math.min(l - c / this.speed, this.startTime)), u ? this.currentTime = l : this.updateTime(l);
      const G = this.currentTime - p * (this.playbackSpeed >= 0 ? 1 : -1), K = this.playbackSpeed >= 0 ? G < 0 : G > c;
      this.currentTime = Math.max(G, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = c);
      let X = this.currentTime, Z = o;
      if (b) {
        const J = Math.min(this.currentTime, c) / m;
        let it = Math.floor(J), tt = J % 1;
        !tt && J >= 1 && (tt = 1), tt === 1 && it--, it = Math.min(it, b + 1), !!(it % 2) && (S === "reverse" ? (tt = 1 - tt, D && (tt -= D / m)) : S === "mirror" && (Z = f)), X = Ie(0, 1, tt) * m;
      }
      const $ = K ? {
        done: false,
        value: v[0]
      } : Z.next(X);
      d && !K && ($.value = d($.value));
      let { done: st } = $;
      !K && y !== null && (st = this.playbackSpeed >= 0 ? this.currentTime >= c : this.currentTime <= 0);
      const et = this.holdTime === null && (this.state === "finished" || this.state === "running" && st);
      return et && N !== lc && ($.value = qc(v, this.options, Y, this.speed)), q && q($.value), et && this.finish(), $;
    }
    then(l, u) {
      return this.finished.then(l, u);
    }
    get duration() {
      return He(this.calculatedDuration);
    }
    get iterationDuration() {
      const { delay: l = 0 } = this.options || {};
      return this.duration + He(l);
    }
    get time() {
      return He(this.currentTime);
    }
    set time(l) {
      l = ze(l), this.currentTime = l, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = l : this.driver && (this.startTime = this.driver.now() - l / this.playbackSpeed), this.driver ? this.driver.start(false) : (this.startTime = 0, this.state = "paused", this.holdTime = l, this.tick(l));
    }
    getGeneratorVelocity() {
      const l = this.currentTime;
      if (l <= 0) return this.options.velocity || 0;
      if (this.generator.velocity) return this.generator.velocity(l);
      const u = this.generator.next(l).value;
      return c0((o) => this.generator.next(o).value, l, u);
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(l) {
      const u = this.playbackSpeed !== l;
      u && this.driver && this.updateTime(re.now()), this.playbackSpeed = l, u && this.driver && (this.time = He(this.currentTime));
    }
    play() {
      var _a, _b2;
      if (this.isStopped) return;
      const { driver: l = kb, startTime: u } = this.options;
      this.driver || (this.driver = l((c) => this.tick(c))), (_b2 = (_a = this.options).onPlay) == null ? void 0 : _b2.call(_a);
      const o = this.driver.now();
      this.state === "finished" ? (this.updateFinished(), this.startTime = o) : this.holdTime !== null ? this.startTime = o - this.holdTime : this.startTime || (this.startTime = u ?? o), this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
    }
    pause() {
      this.state = "paused", this.updateTime(re.now()), this.holdTime = this.currentTime;
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
    sample(l) {
      return this.startTime = 0, this.tick(l, true);
    }
    attachTimeline(l) {
      var _a;
      return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), (_a = this.driver) == null ? void 0 : _a.stop(), l.observe(this);
    }
  }
  function oS(a) {
    for (let l = 1; l < a.length; l++) a[l] ?? (a[l] = a[l - 1]);
  }
  const va = (a) => a * 180 / Math.PI, sc = (a) => {
    const l = va(Math.atan2(a[1], a[0]));
    return uc(l);
  }, rS = {
    x: 4,
    y: 5,
    translateX: 4,
    translateY: 5,
    scaleX: 0,
    scaleY: 3,
    scale: (a) => (Math.abs(a[0]) + Math.abs(a[3])) / 2,
    rotate: sc,
    rotateZ: sc,
    skewX: (a) => va(Math.atan(a[1])),
    skewY: (a) => va(Math.atan(a[2])),
    skew: (a) => (Math.abs(a[1]) + Math.abs(a[2])) / 2
  }, uc = (a) => (a = a % 360, a < 0 && (a += 360), a), Mp = sc, Cp = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1]), Dp = (a) => Math.sqrt(a[4] * a[4] + a[5] * a[5]), cS = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX: Cp,
    scaleY: Dp,
    scale: (a) => (Cp(a) + Dp(a)) / 2,
    rotateX: (a) => uc(va(Math.atan2(a[6], a[5]))),
    rotateY: (a) => uc(va(Math.atan2(-a[2], a[0]))),
    rotateZ: Mp,
    rotate: Mp,
    skewX: (a) => va(Math.atan(a[4])),
    skewY: (a) => va(Math.atan(a[1])),
    skew: (a) => (Math.abs(a[1]) + Math.abs(a[4])) / 2
  };
  function oc(a) {
    return a.includes("scale") ? 1 : 0;
  }
  function rc(a, l) {
    if (!a || a === "none") return oc(l);
    const u = a.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
    let o, c;
    if (u) o = cS, c = u;
    else {
      const m = a.match(/^matrix\(([-\d.e\s,]+)\)$/u);
      o = rS, c = m;
    }
    if (!c) return oc(l);
    const d = o[l], f = c[1].split(",").map(hS);
    return typeof d == "function" ? d(f) : f[d];
  }
  const fS = (a, l) => {
    const { transform: u = "none" } = getComputedStyle(a);
    return rc(u, l);
  };
  function hS(a) {
    return parseFloat(a.trim());
  }
  const mi = [
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
  ], pi = new Set(mi), zp = (a) => a === di || a === I, dS = /* @__PURE__ */ new Set([
    "x",
    "y",
    "z"
  ]), mS = mi.filter((a) => !dS.has(a));
  function pS(a) {
    const l = [];
    return mS.forEach((u) => {
      const o = a.getValue(u);
      o !== void 0 && (l.push([
        u,
        o.get()
      ]), o.set(u.startsWith("scale") ? 1 : 0));
    }), l;
  }
  const Zn = {
    width: ({ x: a }, { paddingLeft: l = "0", paddingRight: u = "0", boxSizing: o }) => {
      const c = a.max - a.min;
      return o === "border-box" ? c : c - parseFloat(l) - parseFloat(u);
    },
    height: ({ y: a }, { paddingTop: l = "0", paddingBottom: u = "0", boxSizing: o }) => {
      const c = a.max - a.min;
      return o === "border-box" ? c : c - parseFloat(l) - parseFloat(u);
    },
    top: (a, { top: l }) => parseFloat(l),
    left: (a, { left: l }) => parseFloat(l),
    bottom: ({ y: a }, { top: l }) => parseFloat(l) + (a.max - a.min),
    right: ({ x: a }, { left: l }) => parseFloat(l) + (a.max - a.min),
    x: (a, { transform: l }) => rc(l, "x"),
    y: (a, { transform: l }) => rc(l, "y")
  };
  Zn.translateX = Zn.x;
  Zn.translateY = Zn.y;
  const ba = /* @__PURE__ */ new Set();
  let cc = false, fc = false, hc = false;
  function h0() {
    if (fc) {
      const a = Array.from(ba).filter((o) => o.needsMeasurement), l = new Set(a.map((o) => o.element)), u = /* @__PURE__ */ new Map();
      l.forEach((o) => {
        const c = pS(o);
        c.length && (u.set(o, c), o.render());
      }), a.forEach((o) => o.measureInitialState()), l.forEach((o) => {
        o.render();
        const c = u.get(o);
        c && c.forEach(([d, f]) => {
          var _a;
          (_a = o.getValue(d)) == null ? void 0 : _a.set(f);
        });
      }), a.forEach((o) => o.measureEndState()), a.forEach((o) => {
        o.suspendedScrollY !== void 0 && window.scrollTo(0, o.suspendedScrollY);
      });
    }
    fc = false, cc = false, ba.forEach((a) => a.complete(hc)), ba.clear();
  }
  function d0() {
    ba.forEach((a) => {
      a.readKeyframes(), a.needsMeasurement && (fc = true);
    });
  }
  function yS() {
    hc = true, d0(), h0(), hc = false;
  }
  class Xc {
    constructor(l, u, o, c, d, f = false) {
      this.state = "pending", this.isAsync = false, this.needsMeasurement = false, this.unresolvedKeyframes = [
        ...l
      ], this.onComplete = u, this.name = o, this.motionValue = c, this.element = d, this.isAsync = f;
    }
    scheduleResolve() {
      this.state = "scheduled", this.isAsync ? (ba.add(this), cc || (cc = true, Rt.read(d0), Rt.resolveKeyframes(h0))) : (this.readKeyframes(), this.complete());
    }
    readKeyframes() {
      const { unresolvedKeyframes: l, name: u, element: o, motionValue: c } = this;
      if (l[0] === null) {
        const d = c == null ? void 0 : c.get(), f = l[l.length - 1];
        if (d !== void 0) l[0] = d;
        else if (o && u) {
          const m = o.readValue(u, f);
          m != null && (l[0] = m);
        }
        l[0] === void 0 && (l[0] = f), c && d === void 0 && c.set(l[0]);
      }
      oS(l);
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete(l = false) {
      this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, l), ba.delete(this);
    }
    cancel() {
      this.state === "scheduled" && (ba.delete(this), this.state = "pending");
    }
    resume() {
      this.state === "pending" && this.scheduleResolve();
    }
  }
  const gS = (a) => a.startsWith("--");
  function m0(a, l, u) {
    gS(l) ? a.style.setProperty(l, u) : a.style[l] = u;
  }
  const vS = {};
  function p0(a, l) {
    const u = Gy(a);
    return () => vS[l] ?? u();
  }
  const bS = p0(() => window.ScrollTimeline !== void 0, "scrollTimeline"), y0 = p0(() => {
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
  }, "linearEasing"), hl = ([a, l, u, o]) => `cubic-bezier(${a}, ${l}, ${u}, ${o})`, Rp = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: hl([
      0,
      0.65,
      0.55,
      1
    ]),
    circOut: hl([
      0.55,
      0,
      1,
      0.45
    ]),
    backIn: hl([
      0.31,
      0.01,
      0.66,
      -0.59
    ]),
    backOut: hl([
      0.33,
      1.53,
      0.69,
      0.99
    ])
  };
  function g0(a, l) {
    if (a) return typeof a == "function" ? y0() ? r0(a, l) : "ease-out" : Iy(a) ? hl(a) : Array.isArray(a) ? a.map((u) => g0(u, l) || Rp.easeOut) : Rp[a];
  }
  function SS(a, l, u, { delay: o = 0, duration: c = 300, repeat: d = 0, repeatType: f = "loop", ease: m = "easeOut", times: y } = {}, p = void 0) {
    const v = {
      [l]: u
    };
    y && (v.offset = y);
    const b = g0(m, c);
    Array.isArray(b) && (v.easing = b);
    const S = {
      delay: o,
      duration: c,
      easing: Array.isArray(b) ? "linear" : b,
      fill: "both",
      iterations: d + 1,
      direction: f === "reverse" ? "alternate" : "normal"
    };
    return p && (S.pseudoElement = p), a.animate(v, S);
  }
  function v0(a) {
    return typeof a == "function" && "applyToOptions" in a;
  }
  function xS({ type: a, ...l }) {
    return v0(a) && y0() ? a.applyToOptions(l) : (l.duration ?? (l.duration = 300), l.ease ?? (l.ease = "easeOut"), l);
  }
  class b0 extends Yc {
    constructor(l) {
      if (super(), this.finishedTime = null, this.isStopped = false, this.manualStartTime = null, !l) return;
      const { element: u, name: o, keyframes: c, pseudoElement: d, allowFlatten: f = false, finalKeyframe: m, onComplete: y } = l;
      this.isPseudoElement = !!d, this.allowFlatten = f, this.options = l, Oc(typeof l.type != "string");
      const p = xS(l);
      this.animation = SS(u, o, c, p, d), p.autoplay === false && this.animation.pause(), this.animation.onfinish = () => {
        if (this.finishedTime = this.time, !d) {
          const v = qc(c, this.options, m, this.speed);
          this.updateMotionValue && this.updateMotionValue(v), m0(u, o, v), this.animation.cancel();
        }
        y == null ? void 0 : y(), this.notifyFinished();
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
      const { state: l } = this;
      l === "idle" || l === "finished" || (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
    }
    commitStyles() {
      var _a, _b2, _c2;
      const l = (_a = this.options) == null ? void 0 : _a.element;
      !this.isPseudoElement && (l == null ? void 0 : l.isConnected) && ((_c2 = (_b2 = this.animation).commitStyles) == null ? void 0 : _c2.call(_b2));
    }
    get duration() {
      var _a, _b2;
      const l = ((_b2 = (_a = this.animation.effect) == null ? void 0 : _a.getComputedTiming) == null ? void 0 : _b2.call(_a).duration) || 0;
      return He(Number(l));
    }
    get iterationDuration() {
      const { delay: l = 0 } = this.options || {};
      return this.duration + He(l);
    }
    get time() {
      return He(Number(this.animation.currentTime) || 0);
    }
    set time(l) {
      const u = this.finishedTime !== null;
      this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = ze(l), u && this.animation.pause();
    }
    get speed() {
      return this.animation.playbackRate;
    }
    set speed(l) {
      l < 0 && (this.finishedTime = null), this.animation.playbackRate = l;
    }
    get state() {
      return this.finishedTime !== null ? "finished" : this.animation.playState;
    }
    get startTime() {
      return this.manualStartTime ?? Number(this.animation.startTime);
    }
    set startTime(l) {
      this.manualStartTime = this.animation.startTime = l;
    }
    attachTimeline({ timeline: l, rangeStart: u, rangeEnd: o, observe: c }) {
      var _a;
      return this.allowFlatten && ((_a = this.animation.effect) == null ? void 0 : _a.updateTiming({
        easing: "linear"
      })), this.animation.onfinish = null, l && bS() ? (this.animation.timeline = l, u && (this.animation.rangeStart = u), o && (this.animation.rangeEnd = o), qe) : c(this);
    }
  }
  const S0 = {
    anticipate: Fy,
    backInOut: Jy,
    circInOut: Wy
  };
  function TS(a) {
    return a in S0;
  }
  function AS(a) {
    typeof a.ease == "string" && TS(a.ease) && (a.ease = S0[a.ease]);
  }
  const Zr = 10;
  class ES extends b0 {
    constructor(l) {
      AS(l), f0(l), super(l), l.startTime !== void 0 && l.autoplay !== false && (this.startTime = l.startTime), this.options = l;
    }
    updateMotionValue(l) {
      const { motionValue: u, onUpdate: o, onComplete: c, element: d, ...f } = this.options;
      if (!u) return;
      if (l !== void 0) {
        u.set(l);
        return;
      }
      const m = new Gc({
        ...f,
        autoplay: false
      }), y = Math.max(Zr, re.now() - this.startTime), p = Ie(0, Zr, y - Zr), v = m.sample(y).value, { name: b } = this.options;
      d && b && m0(d, b, v), u.setWithVelocity(m.sample(Math.max(0, y - p)).value, v, p), m.stop();
    }
  }
  const jp = (a, l) => l === "zIndex" ? false : !!(typeof a == "number" || Array.isArray(a) || typeof a == "string" && (Ke.test(a) || a === "0") && !a.startsWith("url("));
  function MS(a) {
    const l = a[0];
    if (a.length === 1) return true;
    for (let u = 0; u < a.length; u++) if (a[u] !== l) return true;
  }
  function CS(a, l, u, o) {
    const c = a[0];
    if (c === null) return false;
    if (l === "display" || l === "visibility") return true;
    const d = a[a.length - 1], f = jp(c, l), m = jp(d, l);
    return !f || !m ? false : MS(a) || (u === "spring" || v0(u)) && o;
  }
  function dc(a) {
    a.duration = 0, a.type = "keyframes";
  }
  const DS = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]), zS = Gy(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
  function RS(a) {
    var _a;
    const { motionValue: l, name: u, repeatDelay: o, repeatType: c, damping: d, type: f } = a;
    if (!(((_a = l == null ? void 0 : l.owner) == null ? void 0 : _a.current) instanceof HTMLElement)) return false;
    const { onUpdate: y, transformTemplate: p } = l.owner.getProps();
    return zS() && u && DS.has(u) && (u !== "transform" || !p) && !y && !o && c !== "mirror" && d !== 0 && f !== "inertia";
  }
  const jS = 40;
  class OS extends Yc {
    constructor({ autoplay: l = true, delay: u = 0, type: o = "keyframes", repeat: c = 0, repeatDelay: d = 0, repeatType: f = "loop", keyframes: m, name: y, motionValue: p, element: v, ...b }) {
      var _a;
      super(), this.stop = () => {
        var _a2, _b2;
        this._animation && (this._animation.stop(), (_a2 = this.stopTimeline) == null ? void 0 : _a2.call(this)), (_b2 = this.keyframeResolver) == null ? void 0 : _b2.cancel();
      }, this.createdAt = re.now();
      const S = {
        autoplay: l,
        delay: u,
        type: o,
        repeat: c,
        repeatDelay: d,
        repeatType: f,
        name: y,
        motionValue: p,
        element: v,
        ...b
      }, D = (v == null ? void 0 : v.KeyframeResolver) || Xc;
      this.keyframeResolver = new D(m, (N, q, Y) => this.onKeyframesResolved(N, q, S, !Y), y, p, v), (_a = this.keyframeResolver) == null ? void 0 : _a.scheduleResolve();
    }
    onKeyframesResolved(l, u, o, c) {
      var _a, _b2;
      this.keyframeResolver = void 0;
      const { name: d, type: f, velocity: m, delay: y, isHandoff: p, onUpdate: v } = o;
      this.resolvedAt = re.now();
      let b = true;
      CS(l, d, f, m) || (b = false, (Kn.instantAnimations || !y) && (v == null ? void 0 : v(qc(l, o, u))), l[0] = l[l.length - 1], dc(o), o.repeat = 0);
      const D = {
        startTime: c ? this.resolvedAt ? this.resolvedAt - this.createdAt > jS ? this.resolvedAt : this.createdAt : this.createdAt : void 0,
        finalKeyframe: u,
        ...o,
        keyframes: l
      }, N = b && !p && RS(D), q = (_b2 = (_a = D.motionValue) == null ? void 0 : _a.owner) == null ? void 0 : _b2.current, Y = N ? new ES({
        ...D,
        element: q
      }) : new Gc(D);
      Y.finished.then(() => {
        this.notifyFinished();
      }).catch(qe), this.pendingTimeline && (this.stopTimeline = Y.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = Y;
    }
    get finished() {
      return this._animation ? this.animation.finished : this._finished;
    }
    then(l, u) {
      return this.finished.finally(l).then(() => {
      });
    }
    get animation() {
      var _a;
      return this._animation || ((_a = this.keyframeResolver) == null ? void 0 : _a.resume(), yS()), this._animation;
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
    set time(l) {
      this.animation.time = l;
    }
    get speed() {
      return this.animation.speed;
    }
    get state() {
      return this.animation.state;
    }
    set speed(l) {
      this.animation.speed = l;
    }
    get startTime() {
      return this.animation.startTime;
    }
    attachTimeline(l) {
      return this._animation ? this.stopTimeline = this.animation.attachTimeline(l) : this.pendingTimeline = l, () => this.stop();
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
  function x0(a, l, u, o = 0, c = 1) {
    const d = Array.from(a).sort((p, v) => p.sortNodePosition(v)).indexOf(l), f = a.size, m = (f - 1) * o;
    return typeof u == "function" ? u(d, f) : c === 1 ? d * o : m - d * o;
  }
  const NS = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
  function _S(a) {
    const l = NS.exec(a);
    if (!l) return [
      ,
    ];
    const [, u, o, c] = l;
    return [
      `--${u ?? o}`,
      c
    ];
  }
  function T0(a, l, u = 1) {
    const [o, c] = _S(a);
    if (!o) return;
    const d = window.getComputedStyle(l).getPropertyValue(o);
    if (d) {
      const f = d.trim();
      return Hy(f) ? parseFloat(f) : f;
    }
    return Vc(c) ? T0(c, l, u + 1) : c;
  }
  const wS = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  }, VS = (a) => ({
    type: "spring",
    stiffness: 550,
    damping: a === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  }), US = {
    type: "keyframes",
    duration: 0.8
  }, BS = {
    type: "keyframes",
    ease: [
      0.25,
      0.1,
      0.35,
      1
    ],
    duration: 0.3
  }, LS = (a, { keyframes: l }) => l.length > 2 ? US : pi.has(a) ? a.startsWith("scale") ? VS(l[1]) : wS : BS, HS = (a) => a !== null;
  function qS(a, { repeat: l, repeatType: u = "loop" }, o) {
    const c = a.filter(HS), d = l && u !== "loop" && l % 2 === 1 ? 0 : c.length - 1;
    return c[d];
  }
  function A0(a, l) {
    if ((a == null ? void 0 : a.inherit) && l) {
      const { inherit: u, ...o } = a;
      return {
        ...l,
        ...o
      };
    }
    return a;
  }
  function kc(a, l) {
    const u = (a == null ? void 0 : a[l]) ?? (a == null ? void 0 : a.default) ?? a;
    return u !== a ? A0(u, a) : u;
  }
  function YS({ when: a, delay: l, delayChildren: u, staggerChildren: o, staggerDirection: c, repeat: d, repeatType: f, repeatDelay: m, from: y, elapsed: p, ...v }) {
    return !!Object.keys(v).length;
  }
  const Zc = (a, l, u, o = {}, c, d) => (f) => {
    const m = kc(o, a) || {}, y = m.delay || o.delay || 0;
    let { elapsed: p = 0 } = o;
    p = p - ze(y);
    const v = {
      keyframes: Array.isArray(u) ? u : [
        null,
        u
      ],
      ease: "easeOut",
      velocity: l.getVelocity(),
      ...m,
      delay: -p,
      onUpdate: (S) => {
        l.set(S), m.onUpdate && m.onUpdate(S);
      },
      onComplete: () => {
        f(), m.onComplete && m.onComplete();
      },
      name: a,
      motionValue: l,
      element: d ? void 0 : c
    };
    YS(m) || Object.assign(v, LS(a, v)), v.duration && (v.duration = ze(v.duration)), v.repeatDelay && (v.repeatDelay = ze(v.repeatDelay)), v.from !== void 0 && (v.keyframes[0] = v.from);
    let b = false;
    if ((v.type === false || v.duration === 0 && !v.repeatDelay) && (dc(v), v.delay === 0 && (b = true)), (Kn.instantAnimations || Kn.skipAnimations || (c == null ? void 0 : c.shouldSkipAnimations)) && (b = true, dc(v), v.delay = 0), v.allowFlatten = !m.type && !m.ease, b && !d && l.get() !== void 0) {
      const S = qS(v.keyframes, m);
      if (S !== void 0) {
        Rt.update(() => {
          v.onUpdate(S), v.onComplete();
        });
        return;
      }
    }
    return m.isSync ? new Gc(v) : new OS(v);
  };
  function Op(a) {
    const l = [
      {},
      {}
    ];
    return a == null ? void 0 : a.values.forEach((u, o) => {
      l[0][o] = u.get(), l[1][o] = u.getVelocity();
    }), l;
  }
  function Kc(a, l, u, o) {
    if (typeof l == "function") {
      const [c, d] = Op(o);
      l = l(u !== void 0 ? u : a.custom, c, d);
    }
    if (typeof l == "string" && (l = a.variants && a.variants[l]), typeof l == "function") {
      const [c, d] = Op(o);
      l = l(u !== void 0 ? u : a.custom, c, d);
    }
    return l;
  }
  function Sa(a, l, u) {
    const o = a.getProps();
    return Kc(o, l, u !== void 0 ? u : o.custom, a);
  }
  const E0 = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...mi
  ]), Np = 30, GS = (a) => !isNaN(parseFloat(a));
  class XS {
    constructor(l, u = {}) {
      this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (o) => {
        var _a;
        const c = re.now();
        if (this.updatedAt !== c && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(o), this.current !== this.prev && ((_a = this.events.change) == null ? void 0 : _a.notify(this.current), this.dependents)) for (const d of this.dependents) d.dirty();
      }, this.hasAnimated = false, this.setCurrent(l), this.owner = u.owner;
    }
    setCurrent(l) {
      this.current = l, this.updatedAt = re.now(), this.canTrackVelocity === null && l !== void 0 && (this.canTrackVelocity = GS(this.current));
    }
    setPrevFrameValue(l = this.current) {
      this.prevFrameValue = l, this.prevUpdatedAt = this.updatedAt;
    }
    onChange(l) {
      return this.on("change", l);
    }
    on(l, u) {
      this.events[l] || (this.events[l] = new Nc());
      const o = this.events[l].add(u);
      return l === "change" ? () => {
        o(), Rt.read(() => {
          this.events.change.getSize() || this.stop();
        });
      } : o;
    }
    clearListeners() {
      for (const l in this.events) this.events[l].clear();
    }
    attach(l, u) {
      this.passiveEffect = l, this.stopPassiveEffect = u;
    }
    set(l) {
      this.passiveEffect ? this.passiveEffect(l, this.updateAndNotify) : this.updateAndNotify(l);
    }
    setWithVelocity(l, u, o) {
      this.set(u), this.prev = void 0, this.prevFrameValue = l, this.prevUpdatedAt = this.updatedAt - o;
    }
    jump(l, u = true) {
      this.updateAndNotify(l), this.prev = l, this.prevUpdatedAt = this.prevFrameValue = void 0, u && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
    }
    dirty() {
      var _a;
      (_a = this.events.change) == null ? void 0 : _a.notify(this.current);
    }
    addDependent(l) {
      this.dependents || (this.dependents = /* @__PURE__ */ new Set()), this.dependents.add(l);
    }
    removeDependent(l) {
      this.dependents && this.dependents.delete(l);
    }
    get() {
      return this.current;
    }
    getPrevious() {
      return this.prev;
    }
    getVelocity() {
      const l = re.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || l - this.updatedAt > Np) return 0;
      const u = Math.min(this.updatedAt - this.prevUpdatedAt, Np);
      return Xy(parseFloat(this.current) - parseFloat(this.prevFrameValue), u);
    }
    start(l) {
      return this.stop(), new Promise((u) => {
        this.hasAnimated = true, this.animation = l(u), this.events.animationStart && this.events.animationStart.notify();
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
  function hi(a, l) {
    return new XS(a, l);
  }
  const mc = (a) => Array.isArray(a);
  function kS(a, l, u) {
    a.hasValue(l) ? a.getValue(l).set(u) : a.addValue(l, hi(u));
  }
  function ZS(a) {
    return mc(a) ? a[a.length - 1] || 0 : a;
  }
  function KS(a, l) {
    const u = Sa(a, l);
    let { transitionEnd: o = {}, transition: c = {}, ...d } = u || {};
    d = {
      ...d,
      ...o
    };
    for (const f in d) {
      const m = ZS(d[f]);
      kS(a, f, m);
    }
  }
  const le = (a) => !!(a && a.getVelocity);
  function QS(a) {
    return !!(le(a) && a.add);
  }
  function pc(a, l) {
    const u = a.getValue("willChange");
    if (QS(u)) return u.add(l);
    if (!u && Kn.WillChange) {
      const o = new Kn.WillChange("auto");
      a.addValue("willChange", o), o.add(l);
    }
  }
  function Qc(a) {
    return a.replace(/([A-Z])/g, (l) => `-${l.toLowerCase()}`);
  }
  const JS = "framerAppearId", M0 = "data-" + Qc(JS);
  function C0(a) {
    return a.props[M0];
  }
  function FS({ protectedKeys: a, needsAnimating: l }, u) {
    const o = a.hasOwnProperty(u) && l[u] !== true;
    return l[u] = false, o;
  }
  function D0(a, l, { delay: u = 0, transitionOverride: o, type: c } = {}) {
    let { transition: d, transitionEnd: f, ...m } = l;
    const y = a.getDefaultTransition();
    d = d ? A0(d, y) : y;
    const p = d == null ? void 0 : d.reduceMotion;
    o && (d = o);
    const v = [], b = c && a.animationState && a.animationState.getState()[c];
    for (const S in m) {
      const D = a.getValue(S, a.latestValues[S] ?? null), N = m[S];
      if (N === void 0 || b && FS(b, S)) continue;
      const q = {
        delay: u,
        ...kc(d || {}, S)
      }, Y = D.get();
      if (Y !== void 0 && !D.isAnimating && !Array.isArray(N) && N === Y && !q.velocity) continue;
      let G = false;
      if (window.MotionHandoffAnimation) {
        const Z = C0(a);
        if (Z) {
          const $ = window.MotionHandoffAnimation(Z, S, Rt);
          $ !== null && (q.startTime = $, G = true);
        }
      }
      pc(a, S);
      const K = p ?? a.shouldReduceMotion;
      D.start(Zc(S, D, N, K && E0.has(S) ? {
        type: false
      } : q, a, G));
      const X = D.animation;
      X && v.push(X);
    }
    if (f) {
      const S = () => Rt.update(() => {
        f && KS(a, f);
      });
      v.length ? Promise.all(v).then(S) : S();
    }
    return v;
  }
  function yc(a, l, u = {}) {
    var _a;
    const o = Sa(a, l, u.type === "exit" ? (_a = a.presenceContext) == null ? void 0 : _a.custom : void 0);
    let { transition: c = a.getDefaultTransition() || {} } = o || {};
    u.transitionOverride && (c = u.transitionOverride);
    const d = o ? () => Promise.all(D0(a, o, u)) : () => Promise.resolve(), f = a.variantChildren && a.variantChildren.size ? (y = 0) => {
      const { delayChildren: p = 0, staggerChildren: v, staggerDirection: b } = c;
      return PS(a, l, y, p, v, b, u);
    } : () => Promise.resolve(), { when: m } = c;
    if (m) {
      const [y, p] = m === "beforeChildren" ? [
        d,
        f
      ] : [
        f,
        d
      ];
      return y().then(() => p());
    } else return Promise.all([
      d(),
      f(u.delay)
    ]);
  }
  function PS(a, l, u = 0, o = 0, c = 0, d = 1, f) {
    const m = [];
    for (const y of a.variantChildren) y.notify("AnimationStart", l), m.push(yc(y, l, {
      ...f,
      delay: u + (typeof o == "function" ? 0 : o) + x0(a.variantChildren, y, o, c, d)
    }).then(() => y.notify("AnimationComplete", l)));
    return Promise.all(m);
  }
  function WS(a, l, u = {}) {
    a.notify("AnimationStart", l);
    let o;
    if (Array.isArray(l)) {
      const c = l.map((d) => yc(a, d, u));
      o = Promise.all(c);
    } else if (typeof l == "string") o = yc(a, l, u);
    else {
      const c = typeof l == "function" ? Sa(a, l, u.custom) : l;
      o = Promise.all(D0(a, c, u));
    }
    return o.then(() => {
      a.notify("AnimationComplete", l);
    });
  }
  const $S = {
    test: (a) => a === "auto",
    parse: (a) => a
  }, z0 = (a) => (l) => l.test(a), R0 = [
    di,
    I,
    $e,
    kn,
    Mb,
    Eb,
    $S
  ], _p = (a) => R0.find(z0(a));
  function IS(a) {
    return typeof a == "number" ? a === 0 : a !== null ? a === "none" || a === "0" || Yy(a) : true;
  }
  const tx = /* @__PURE__ */ new Set([
    "brightness",
    "contrast",
    "saturate",
    "opacity"
  ]);
  function ex(a) {
    const [l, u] = a.slice(0, -1).split("(");
    if (l === "drop-shadow") return a;
    const [o] = u.match(Uc) || [];
    if (!o) return a;
    const c = u.replace(o, "");
    let d = tx.has(l) ? 1 : 0;
    return o !== u && (d *= 100), l + "(" + d + c + ")";
  }
  const nx = /\b([a-z-]*)\(.*?\)/gu, gc = {
    ...Ke,
    getAnimatableNone: (a) => {
      const l = a.match(nx);
      return l ? l.map(ex).join(" ") : a;
    }
  }, vc = {
    ...Ke,
    getAnimatableNone: (a) => {
      const l = Ke.parse(a);
      return Ke.createTransformer(a)(l.map((o) => typeof o == "number" ? 0 : typeof o == "object" ? {
        ...o,
        alpha: 1
      } : o));
    }
  }, wp = {
    ...di,
    transform: Math.round
  }, ax = {
    rotate: kn,
    rotateX: kn,
    rotateY: kn,
    rotateZ: kn,
    scale: Zs,
    scaleX: Zs,
    scaleY: Zs,
    scaleZ: Zs,
    skew: kn,
    skewX: kn,
    skewY: kn,
    distance: I,
    translateX: I,
    translateY: I,
    translateZ: I,
    x: I,
    y: I,
    z: I,
    perspective: I,
    transformPerspective: I,
    opacity: bl,
    originX: Sp,
    originY: Sp,
    originZ: I
  }, Jc = {
    borderWidth: I,
    borderTopWidth: I,
    borderRightWidth: I,
    borderBottomWidth: I,
    borderLeftWidth: I,
    borderRadius: I,
    borderTopLeftRadius: I,
    borderTopRightRadius: I,
    borderBottomRightRadius: I,
    borderBottomLeftRadius: I,
    width: I,
    maxWidth: I,
    height: I,
    maxHeight: I,
    top: I,
    right: I,
    bottom: I,
    left: I,
    inset: I,
    insetBlock: I,
    insetBlockStart: I,
    insetBlockEnd: I,
    insetInline: I,
    insetInlineStart: I,
    insetInlineEnd: I,
    padding: I,
    paddingTop: I,
    paddingRight: I,
    paddingBottom: I,
    paddingLeft: I,
    paddingBlock: I,
    paddingBlockStart: I,
    paddingBlockEnd: I,
    paddingInline: I,
    paddingInlineStart: I,
    paddingInlineEnd: I,
    margin: I,
    marginTop: I,
    marginRight: I,
    marginBottom: I,
    marginLeft: I,
    marginBlock: I,
    marginBlockStart: I,
    marginBlockEnd: I,
    marginInline: I,
    marginInlineStart: I,
    marginInlineEnd: I,
    fontSize: I,
    backgroundPositionX: I,
    backgroundPositionY: I,
    ...ax,
    zIndex: wp,
    fillOpacity: bl,
    strokeOpacity: bl,
    numOctaves: wp
  }, ix = {
    ...Jc,
    color: Jt,
    backgroundColor: Jt,
    outlineColor: Jt,
    fill: Jt,
    stroke: Jt,
    borderColor: Jt,
    borderTopColor: Jt,
    borderRightColor: Jt,
    borderBottomColor: Jt,
    borderLeftColor: Jt,
    filter: gc,
    WebkitFilter: gc,
    mask: vc,
    WebkitMask: vc
  }, j0 = (a) => ix[a], lx = /* @__PURE__ */ new Set([
    gc,
    vc
  ]);
  function O0(a, l) {
    let u = j0(a);
    return lx.has(u) || (u = Ke), u.getAnimatableNone ? u.getAnimatableNone(l) : void 0;
  }
  const sx = /* @__PURE__ */ new Set([
    "auto",
    "none",
    "0"
  ]);
  function ux(a, l, u) {
    let o = 0, c;
    for (; o < a.length && !c; ) {
      const d = a[o];
      typeof d == "string" && !sx.has(d) && fi(d).values.length && (c = a[o]), o++;
    }
    if (c && u) for (const d of l) a[d] = O0(u, c);
  }
  class ox extends Xc {
    constructor(l, u, o, c, d) {
      super(l, u, o, c, d, true);
    }
    readKeyframes() {
      const { unresolvedKeyframes: l, element: u, name: o } = this;
      if (!u || !u.current) return;
      super.readKeyframes();
      for (let v = 0; v < l.length; v++) {
        let b = l[v];
        if (typeof b == "string" && (b = b.trim(), Vc(b))) {
          const S = T0(b, u.current);
          S !== void 0 && (l[v] = S), v === l.length - 1 && (this.finalKeyframe = b);
        }
      }
      if (this.resolveNoneKeyframes(), !E0.has(o) || l.length !== 2) return;
      const [c, d] = l, f = _p(c), m = _p(d), y = bp(c), p = bp(d);
      if (y !== p && Zn[o]) {
        this.needsMeasurement = true;
        return;
      }
      if (f !== m) if (zp(f) && zp(m)) for (let v = 0; v < l.length; v++) {
        const b = l[v];
        typeof b == "string" && (l[v] = parseFloat(b));
      }
      else Zn[o] && (this.needsMeasurement = true);
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes: l, name: u } = this, o = [];
      for (let c = 0; c < l.length; c++) (l[c] === null || IS(l[c])) && o.push(c);
      o.length && ux(l, o, u);
    }
    measureInitialState() {
      const { element: l, unresolvedKeyframes: u, name: o } = this;
      if (!l || !l.current) return;
      o === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = Zn[o](l.measureViewportBox(), window.getComputedStyle(l.current)), u[0] = this.measuredOrigin;
      const c = u[u.length - 1];
      c !== void 0 && l.getValue(o, c).jump(c, false);
    }
    measureEndState() {
      var _a;
      const { element: l, name: u, unresolvedKeyframes: o } = this;
      if (!l || !l.current) return;
      const c = l.getValue(u);
      c && c.jump(this.measuredOrigin, false);
      const d = o.length - 1, f = o[d];
      o[d] = Zn[u](l.measureViewportBox(), window.getComputedStyle(l.current)), f !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = f), ((_a = this.removedTransforms) == null ? void 0 : _a.length) && this.removedTransforms.forEach(([m, y]) => {
        l.getValue(m).set(y);
      }), this.resolveNoneKeyframes();
    }
  }
  const rx = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
  ]);
  function N0(a, l, u) {
    if (a == null) return [];
    if (a instanceof EventTarget) return [
      a
    ];
    if (typeof a == "string") {
      let o = document;
      const c = (u == null ? void 0 : u[a]) ?? o.querySelectorAll(a);
      return c ? Array.from(c) : [];
    }
    return Array.from(a).filter((o) => o != null);
  }
  const _0 = (a, l) => l && typeof a == "number" ? l.transform(a) : a;
  function Ps(a) {
    return qy(a) && "offsetHeight" in a && !("ownerSVGElement" in a);
  }
  const { schedule: Fc } = t0(queueMicrotask, false), Ze = {
    x: false,
    y: false
  };
  function w0() {
    return Ze.x || Ze.y;
  }
  function cx(a) {
    return a === "x" || a === "y" ? Ze[a] ? null : (Ze[a] = true, () => {
      Ze[a] = false;
    }) : Ze.x || Ze.y ? null : (Ze.x = Ze.y = true, () => {
      Ze.x = Ze.y = false;
    });
  }
  function V0(a, l) {
    const u = N0(a), o = new AbortController(), c = {
      passive: true,
      ...l,
      signal: o.signal
    };
    return [
      u,
      c,
      () => o.abort()
    ];
  }
  function fx(a) {
    return !(a.pointerType === "touch" || w0());
  }
  function hx(a, l, u = {}) {
    const [o, c, d] = V0(a, u);
    return o.forEach((f) => {
      let m = false, y = false, p;
      const v = () => {
        f.removeEventListener("pointerleave", N);
      }, b = (Y) => {
        p && (p(Y), p = void 0), v();
      }, S = (Y) => {
        m = false, window.removeEventListener("pointerup", S), window.removeEventListener("pointercancel", S), y && (y = false, b(Y));
      }, D = () => {
        m = true, window.addEventListener("pointerup", S, c), window.addEventListener("pointercancel", S, c);
      }, N = (Y) => {
        if (Y.pointerType !== "touch") {
          if (m) {
            y = true;
            return;
          }
          b(Y);
        }
      }, q = (Y) => {
        if (!fx(Y)) return;
        y = false;
        const G = l(f, Y);
        typeof G == "function" && (p = G, f.addEventListener("pointerleave", N, c));
      };
      f.addEventListener("pointerenter", q, c), f.addEventListener("pointerdown", D, c);
    }), d;
  }
  const U0 = (a, l) => l ? a === l ? true : U0(a, l.parentElement) : false, Pc = (a) => a.pointerType === "mouse" ? typeof a.button != "number" || a.button <= 0 : a.isPrimary !== false, dx = /* @__PURE__ */ new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A"
  ]);
  function mx(a) {
    return dx.has(a.tagName) || a.isContentEditable === true;
  }
  const px = /* @__PURE__ */ new Set([
    "INPUT",
    "SELECT",
    "TEXTAREA"
  ]);
  function yx(a) {
    return px.has(a.tagName) || a.isContentEditable === true;
  }
  const Ws = /* @__PURE__ */ new WeakSet();
  function Vp(a) {
    return (l) => {
      l.key === "Enter" && a(l);
    };
  }
  function Kr(a, l) {
    a.dispatchEvent(new PointerEvent("pointer" + l, {
      isPrimary: true,
      bubbles: true
    }));
  }
  const gx = (a, l) => {
    const u = a.currentTarget;
    if (!u) return;
    const o = Vp(() => {
      if (Ws.has(u)) return;
      Kr(u, "down");
      const c = Vp(() => {
        Kr(u, "up");
      }), d = () => Kr(u, "cancel");
      u.addEventListener("keyup", c, l), u.addEventListener("blur", d, l);
    });
    u.addEventListener("keydown", o, l), u.addEventListener("blur", () => u.removeEventListener("keydown", o), l);
  };
  function Up(a) {
    return Pc(a) && !w0();
  }
  const Bp = /* @__PURE__ */ new WeakSet();
  function vx(a, l, u = {}) {
    const [o, c, d] = V0(a, u), f = (m) => {
      const y = m.currentTarget;
      if (!Up(m) || Bp.has(m)) return;
      Ws.add(y), u.stopPropagation && Bp.add(m);
      const p = l(y, m), v = (D, N) => {
        window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", S), Ws.has(y) && Ws.delete(y), Up(D) && typeof p == "function" && p(D, {
          success: N
        });
      }, b = (D) => {
        v(D, y === window || y === document || u.useGlobalTarget || U0(y, D.target));
      }, S = (D) => {
        v(D, false);
      };
      window.addEventListener("pointerup", b, c), window.addEventListener("pointercancel", S, c);
    };
    return o.forEach((m) => {
      (u.useGlobalTarget ? window : m).addEventListener("pointerdown", f, c), Ps(m) && (m.addEventListener("focus", (p) => gx(p, c)), !mx(m) && !m.hasAttribute("tabindex") && (m.tabIndex = 0));
    }), d;
  }
  function Wc(a) {
    return qy(a) && "ownerSVGElement" in a;
  }
  const $s = /* @__PURE__ */ new WeakMap();
  let Is;
  const B0 = (a, l, u) => (o, c) => c && c[0] ? c[0][a + "Size"] : Wc(o) && "getBBox" in o ? o.getBBox()[l] : o[u], bx = B0("inline", "width", "offsetWidth"), Sx = B0("block", "height", "offsetHeight");
  function xx({ target: a, borderBoxSize: l }) {
    var _a;
    (_a = $s.get(a)) == null ? void 0 : _a.forEach((u) => {
      u(a, {
        get width() {
          return bx(a, l);
        },
        get height() {
          return Sx(a, l);
        }
      });
    });
  }
  function Tx(a) {
    a.forEach(xx);
  }
  function Ax() {
    typeof ResizeObserver > "u" || (Is = new ResizeObserver(Tx));
  }
  function Ex(a, l) {
    Is || Ax();
    const u = N0(a);
    return u.forEach((o) => {
      let c = $s.get(o);
      c || (c = /* @__PURE__ */ new Set(), $s.set(o, c)), c.add(l), Is == null ? void 0 : Is.observe(o);
    }), () => {
      u.forEach((o) => {
        const c = $s.get(o);
        c == null ? void 0 : c.delete(l), (c == null ? void 0 : c.size) || (Is == null ? void 0 : Is.unobserve(o));
      });
    };
  }
  const tu = /* @__PURE__ */ new Set();
  let ui;
  function Mx() {
    ui = () => {
      const a = {
        get width() {
          return window.innerWidth;
        },
        get height() {
          return window.innerHeight;
        }
      };
      tu.forEach((l) => l(a));
    }, window.addEventListener("resize", ui);
  }
  function Cx(a) {
    return tu.add(a), ui || Mx(), () => {
      tu.delete(a), !tu.size && typeof ui == "function" && (window.removeEventListener("resize", ui), ui = void 0);
    };
  }
  function Lp(a, l) {
    return typeof a == "function" ? Cx(a) : Ex(a, l);
  }
  function Dx(a) {
    return Wc(a) && a.tagName === "svg";
  }
  const zx = [
    ...R0,
    Jt,
    Ke
  ], Rx = (a) => zx.find(z0(a)), Hp = () => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0
  }), oi = () => ({
    x: Hp(),
    y: Hp()
  }), qp = () => ({
    min: 0,
    max: 0
  }), Pt = () => ({
    x: qp(),
    y: qp()
  }), jx = /* @__PURE__ */ new WeakMap();
  function hu(a) {
    return a !== null && typeof a == "object" && typeof a.start == "function";
  }
  function Sl(a) {
    return typeof a == "string" || Array.isArray(a);
  }
  const $c = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit"
  ], Ic = [
    "initial",
    ...$c
  ];
  function du(a) {
    return hu(a.animate) || Ic.some((l) => Sl(a[l]));
  }
  function L0(a) {
    return !!(du(a) || a.variants);
  }
  function Ox(a, l, u) {
    for (const o in l) {
      const c = l[o], d = u[o];
      if (le(c)) a.addValue(o, c);
      else if (le(d)) a.addValue(o, hi(c, {
        owner: a
      }));
      else if (d !== c) if (a.hasValue(o)) {
        const f = a.getValue(o);
        f.liveStyle === true ? f.jump(c) : f.hasAnimated || f.set(c);
      } else {
        const f = a.getStaticValue(o);
        a.addValue(o, hi(f !== void 0 ? f : c, {
          owner: a
        }));
      }
    }
    for (const o in u) l[o] === void 0 && a.removeValue(o);
    return l;
  }
  const bc = {
    current: null
  }, H0 = {
    current: false
  }, Nx = typeof window < "u";
  function _x() {
    if (H0.current = true, !!Nx) if (window.matchMedia) {
      const a = window.matchMedia("(prefers-reduced-motion)"), l = () => bc.current = a.matches;
      a.addEventListener("change", l), l();
    } else bc.current = false;
  }
  const Yp = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete"
  ];
  let uu = {};
  function q0(a) {
    uu = a;
  }
  function wx() {
    return uu;
  }
  class Vx {
    scrapeMotionValuesFromProps(l, u, o) {
      return {};
    }
    constructor({ parent: l, props: u, presenceContext: o, reducedMotionConfig: c, skipAnimations: d, blockInitialAnimation: f, visualState: m }, y = {}) {
      this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = false, this.isControllingVariants = false, this.shouldReduceMotion = null, this.shouldSkipAnimations = false, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = Xc, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = false, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
        this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
      }, this.renderScheduledAt = 0, this.scheduleRender = () => {
        const D = re.now();
        this.renderScheduledAt < D && (this.renderScheduledAt = D, Rt.render(this.render, false, true));
      };
      const { latestValues: p, renderState: v } = m;
      this.latestValues = p, this.baseTarget = {
        ...p
      }, this.initialValues = u.initial ? {
        ...p
      } : {}, this.renderState = v, this.parent = l, this.props = u, this.presenceContext = o, this.depth = l ? l.depth + 1 : 0, this.reducedMotionConfig = c, this.skipAnimationsConfig = d, this.options = y, this.blockInitialAnimation = !!f, this.isControllingVariants = du(u), this.isVariantNode = L0(u), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(l && l.current);
      const { willChange: b, ...S } = this.scrapeMotionValuesFromProps(u, {}, this);
      for (const D in S) {
        const N = S[D];
        p[D] !== void 0 && le(N) && N.set(p[D]);
      }
    }
    mount(l) {
      var _a, _b2;
      if (this.hasBeenMounted) for (const u in this.initialValues) (_a = this.values.get(u)) == null ? void 0 : _a.jump(this.initialValues[u]), this.latestValues[u] = this.initialValues[u];
      this.current = l, jx.set(l, this), this.projection && !this.projection.instance && this.projection.mount(l), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((u, o) => this.bindToMotionValue(o, u)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = false : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = true : (H0.current || _x(), this.shouldReduceMotion = bc.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? false, (_b2 = this.parent) == null ? void 0 : _b2.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = true;
    }
    unmount() {
      var _a;
      this.projection && this.projection.unmount(), Qn(this.notifyUpdate), Qn(this.render), this.valueSubscriptions.forEach((l) => l()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), (_a = this.parent) == null ? void 0 : _a.removeChild(this);
      for (const l in this.events) this.events[l].clear();
      for (const l in this.features) {
        const u = this.features[l];
        u && (u.unmount(), u.isMounted = false);
      }
      this.current = null;
    }
    addChild(l) {
      this.children.add(l), this.enteringChildren ?? (this.enteringChildren = /* @__PURE__ */ new Set()), this.enteringChildren.add(l);
    }
    removeChild(l) {
      this.children.delete(l), this.enteringChildren && this.enteringChildren.delete(l);
    }
    bindToMotionValue(l, u) {
      if (this.valueSubscriptions.has(l) && this.valueSubscriptions.get(l)(), u.accelerate && rx.has(l) && this.current instanceof HTMLElement) {
        const { factory: f, keyframes: m, times: y, ease: p, duration: v } = u.accelerate, b = new b0({
          element: this.current,
          name: l,
          keyframes: m,
          times: y,
          ease: p,
          duration: ze(v)
        }), S = f(b);
        this.valueSubscriptions.set(l, () => {
          S(), b.cancel();
        });
        return;
      }
      const o = pi.has(l);
      o && this.onBindTransform && this.onBindTransform();
      const c = u.on("change", (f) => {
        this.latestValues[l] = f, this.props.onUpdate && Rt.preRender(this.notifyUpdate), o && this.projection && (this.projection.isTransformDirty = true), this.scheduleRender();
      });
      let d;
      typeof window < "u" && window.MotionCheckAppearSync && (d = window.MotionCheckAppearSync(this, l, u)), this.valueSubscriptions.set(l, () => {
        c(), d && d(), u.owner && u.stop();
      });
    }
    sortNodePosition(l) {
      return !this.current || !this.sortInstanceNodePosition || this.type !== l.type ? 0 : this.sortInstanceNodePosition(this.current, l.current);
    }
    updateFeatures() {
      let l = "animation";
      for (l in uu) {
        const u = uu[l];
        if (!u) continue;
        const { isEnabled: o, Feature: c } = u;
        if (!this.features[l] && c && o(this.props) && (this.features[l] = new c(this)), this.features[l]) {
          const d = this.features[l];
          d.isMounted ? d.update() : (d.mount(), d.isMounted = true);
        }
      }
    }
    triggerBuild() {
      this.build(this.renderState, this.latestValues, this.props);
    }
    measureViewportBox() {
      return this.current ? this.measureInstanceViewportBox(this.current, this.props) : Pt();
    }
    getStaticValue(l) {
      return this.latestValues[l];
    }
    setStaticValue(l, u) {
      this.latestValues[l] = u;
    }
    update(l, u) {
      (l.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = l, this.prevPresenceContext = this.presenceContext, this.presenceContext = u;
      for (let o = 0; o < Yp.length; o++) {
        const c = Yp[o];
        this.propEventSubscriptions[c] && (this.propEventSubscriptions[c](), delete this.propEventSubscriptions[c]);
        const d = "on" + c, f = l[d];
        f && (this.propEventSubscriptions[c] = this.on(c, f));
      }
      this.prevMotionValues = Ox(this, this.scrapeMotionValuesFromProps(l, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
    }
    getProps() {
      return this.props;
    }
    getVariant(l) {
      return this.props.variants ? this.props.variants[l] : void 0;
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
    addVariantChild(l) {
      const u = this.getClosestVariantNode();
      if (u) return u.variantChildren && u.variantChildren.add(l), () => u.variantChildren.delete(l);
    }
    addValue(l, u) {
      const o = this.values.get(l);
      u !== o && (o && this.removeValue(l), this.bindToMotionValue(l, u), this.values.set(l, u), this.latestValues[l] = u.get());
    }
    removeValue(l) {
      this.values.delete(l);
      const u = this.valueSubscriptions.get(l);
      u && (u(), this.valueSubscriptions.delete(l)), delete this.latestValues[l], this.removeValueFromRenderState(l, this.renderState);
    }
    hasValue(l) {
      return this.values.has(l);
    }
    getValue(l, u) {
      if (this.props.values && this.props.values[l]) return this.props.values[l];
      let o = this.values.get(l);
      return o === void 0 && u !== void 0 && (o = hi(u === null ? void 0 : u, {
        owner: this
      }), this.addValue(l, o)), o;
    }
    readValue(l, u) {
      let o = this.latestValues[l] !== void 0 || !this.current ? this.latestValues[l] : this.getBaseTargetFromProps(this.props, l) ?? this.readValueFromInstance(this.current, l, this.options);
      return o != null && (typeof o == "string" && (Hy(o) || Yy(o)) ? o = parseFloat(o) : !Rx(o) && Ke.test(u) && (o = O0(l, u)), this.setBaseTarget(l, le(o) ? o.get() : o)), le(o) ? o.get() : o;
    }
    setBaseTarget(l, u) {
      this.baseTarget[l] = u;
    }
    getBaseTarget(l) {
      var _a;
      const { initial: u } = this.props;
      let o;
      if (typeof u == "string" || typeof u == "object") {
        const d = Kc(this.props, u, (_a = this.presenceContext) == null ? void 0 : _a.custom);
        d && (o = d[l]);
      }
      if (u && o !== void 0) return o;
      const c = this.getBaseTargetFromProps(this.props, l);
      return c !== void 0 && !le(c) ? c : this.initialValues[l] !== void 0 && o === void 0 ? void 0 : this.baseTarget[l];
    }
    on(l, u) {
      return this.events[l] || (this.events[l] = new Nc()), this.events[l].add(u);
    }
    notify(l, ...u) {
      this.events[l] && this.events[l].notify(...u);
    }
    scheduleRenderMicrotask() {
      Fc.render(this.render);
    }
  }
  class Y0 extends Vx {
    constructor() {
      super(...arguments), this.KeyframeResolver = ox;
    }
    sortInstanceNodePosition(l, u) {
      return l.compareDocumentPosition(u) & 2 ? 1 : -1;
    }
    getBaseTargetFromProps(l, u) {
      const o = l.style;
      return o ? o[u] : void 0;
    }
    removeValueFromRenderState(l, { vars: u, style: o }) {
      delete u[l], delete o[l];
    }
    handleChildMotionValue() {
      this.childSubscription && (this.childSubscription(), delete this.childSubscription);
      const { children: l } = this.props;
      le(l) && (this.childSubscription = l.on("change", (u) => {
        this.current && (this.current.textContent = `${u}`);
      }));
    }
  }
  class Fn {
    constructor(l) {
      this.isMounted = false, this.node = l;
    }
    update() {
    }
  }
  function G0({ top: a, left: l, right: u, bottom: o }) {
    return {
      x: {
        min: l,
        max: u
      },
      y: {
        min: a,
        max: o
      }
    };
  }
  function Ux({ x: a, y: l }) {
    return {
      top: l.min,
      right: a.max,
      bottom: l.max,
      left: a.min
    };
  }
  function Bx(a, l) {
    if (!l) return a;
    const u = l({
      x: a.left,
      y: a.top
    }), o = l({
      x: a.right,
      y: a.bottom
    });
    return {
      top: u.y,
      left: u.x,
      bottom: o.y,
      right: o.x
    };
  }
  function Qr(a) {
    return a === void 0 || a === 1;
  }
  function Sc({ scale: a, scaleX: l, scaleY: u }) {
    return !Qr(a) || !Qr(l) || !Qr(u);
  }
  function ya(a) {
    return Sc(a) || X0(a) || a.z || a.rotate || a.rotateX || a.rotateY || a.skewX || a.skewY;
  }
  function X0(a) {
    return Gp(a.x) || Gp(a.y);
  }
  function Gp(a) {
    return a && a !== "0%";
  }
  function ou(a, l, u) {
    const o = a - u, c = l * o;
    return u + c;
  }
  function Xp(a, l, u, o, c) {
    return c !== void 0 && (a = ou(a, c, o)), ou(a, u, o) + l;
  }
  function xc(a, l = 0, u = 1, o, c) {
    a.min = Xp(a.min, l, u, o, c), a.max = Xp(a.max, l, u, o, c);
  }
  function k0(a, { x: l, y: u }) {
    xc(a.x, l.translate, l.scale, l.originPoint), xc(a.y, u.translate, u.scale, u.originPoint);
  }
  const kp = 0.999999999999, Zp = 1.0000000000001;
  function Lx(a, l, u, o = false) {
    var _a;
    const c = u.length;
    if (!c) return;
    l.x = l.y = 1;
    let d, f;
    for (let m = 0; m < c; m++) {
      d = u[m], f = d.projectionDelta;
      const { visualElement: y } = d.options;
      y && y.props.style && y.props.style.display === "contents" || (o && d.options.layoutScroll && d.scroll && d !== d.root && ci(a, {
        x: -d.scroll.offset.x,
        y: -d.scroll.offset.y
      }), f && (l.x *= f.x.scale, l.y *= f.y.scale, k0(a, f)), o && ya(d.latestValues) && ci(a, d.latestValues, (_a = d.layout) == null ? void 0 : _a.layoutBox));
    }
    l.x < Zp && l.x > kp && (l.x = 1), l.y < Zp && l.y > kp && (l.y = 1);
  }
  function ri(a, l) {
    a.min = a.min + l, a.max = a.max + l;
  }
  function Kp(a, l, u, o, c = 0.5) {
    const d = Bt(a.min, a.max, c);
    xc(a, l, u, d, o);
  }
  function Qp(a, l) {
    return typeof a == "string" ? parseFloat(a) / 100 * (l.max - l.min) : a;
  }
  function ci(a, l, u) {
    const o = u ?? a;
    Kp(a.x, Qp(l.x, o.x), l.scaleX, l.scale, l.originX), Kp(a.y, Qp(l.y, o.y), l.scaleY, l.scale, l.originY);
  }
  function Z0(a, l) {
    return G0(Bx(a.getBoundingClientRect(), l));
  }
  function Hx(a, l, u) {
    const o = Z0(a, u), { scroll: c } = l;
    return c && (ri(o.x, c.offset.x), ri(o.y, c.offset.y)), o;
  }
  const qx = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  }, Yx = mi.length;
  function Gx(a, l, u) {
    let o = "", c = true;
    for (let d = 0; d < Yx; d++) {
      const f = mi[d], m = a[f];
      if (m === void 0) continue;
      let y = true;
      if (typeof m == "number") y = m === (f.startsWith("scale") ? 1 : 0);
      else {
        const p = parseFloat(m);
        y = f.startsWith("scale") ? p === 1 : p === 0;
      }
      if (!y || u) {
        const p = _0(m, Jc[f]);
        if (!y) {
          c = false;
          const v = qx[f] || f;
          o += `${v}(${p}) `;
        }
        u && (l[f] = p);
      }
    }
    return o = o.trim(), u ? o = u(l, c ? "" : o) : c && (o = "none"), o;
  }
  function tf(a, l, u) {
    const { style: o, vars: c, transformOrigin: d } = a;
    let f = false, m = false;
    for (const y in l) {
      const p = l[y];
      if (pi.has(y)) {
        f = true;
        continue;
      } else if (n0(y)) {
        c[y] = p;
        continue;
      } else {
        const v = _0(p, Jc[y]);
        y.startsWith("origin") ? (m = true, d[y] = v) : o[y] = v;
      }
    }
    if (l.transform || (f || u ? o.transform = Gx(l, a.transform, u) : o.transform && (o.transform = "none")), m) {
      const { originX: y = "50%", originY: p = "50%", originZ: v = 0 } = d;
      o.transformOrigin = `${y} ${p} ${v}`;
    }
  }
  function K0(a, { style: l, vars: u }, o, c) {
    const d = a.style;
    let f;
    for (f in l) d[f] = l[f];
    c == null ? void 0 : c.applyProjectionStyles(d, o);
    for (f in u) d.setProperty(f, u[f]);
  }
  function Jp(a, l) {
    return l.max === l.min ? 0 : a / (l.max - l.min) * 100;
  }
  const fl = {
    correct: (a, l) => {
      if (!l.target) return a;
      if (typeof a == "string") if (I.test(a)) a = parseFloat(a);
      else return a;
      const u = Jp(a, l.target.x), o = Jp(a, l.target.y);
      return `${u}% ${o}%`;
    }
  }, Xx = {
    correct: (a, { treeScale: l, projectionDelta: u }) => {
      const o = a, c = Ke.parse(a);
      if (c.length > 5) return o;
      const d = Ke.createTransformer(a), f = typeof c[0] != "number" ? 1 : 0, m = u.x.scale * l.x, y = u.y.scale * l.y;
      c[0 + f] /= m, c[1 + f] /= y;
      const p = Bt(m, y, 0.5);
      return typeof c[2 + f] == "number" && (c[2 + f] /= p), typeof c[3 + f] == "number" && (c[3 + f] /= p), d(c);
    }
  }, Tc = {
    borderRadius: {
      ...fl,
      applyTo: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius"
      ]
    },
    borderTopLeftRadius: fl,
    borderTopRightRadius: fl,
    borderBottomLeftRadius: fl,
    borderBottomRightRadius: fl,
    boxShadow: Xx
  };
  function Q0(a, { layout: l, layoutId: u }) {
    return pi.has(a) || a.startsWith("origin") || (l || u !== void 0) && (!!Tc[a] || a === "opacity");
  }
  function ef(a, l, u) {
    var _a;
    const o = a.style, c = l == null ? void 0 : l.style, d = {};
    if (!o) return d;
    for (const f in o) (le(o[f]) || c && le(c[f]) || Q0(f, a) || ((_a = u == null ? void 0 : u.getValue(f)) == null ? void 0 : _a.liveStyle) !== void 0) && (d[f] = o[f]);
    return d;
  }
  function kx(a) {
    return window.getComputedStyle(a);
  }
  class Zx extends Y0 {
    constructor() {
      super(...arguments), this.type = "html", this.renderInstance = K0;
    }
    readValueFromInstance(l, u) {
      var _a;
      if (pi.has(u)) return ((_a = this.projection) == null ? void 0 : _a.isProjecting) ? oc(u) : fS(l, u);
      {
        const o = kx(l), c = (n0(u) ? o.getPropertyValue(u) : o[u]) || 0;
        return typeof c == "string" ? c.trim() : c;
      }
    }
    measureInstanceViewportBox(l, { transformPagePoint: u }) {
      return Z0(l, u);
    }
    build(l, u, o) {
      tf(l, u, o.transformTemplate);
    }
    scrapeMotionValuesFromProps(l, u, o) {
      return ef(l, u, o);
    }
  }
  const Kx = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  }, Qx = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  };
  function Jx(a, l, u = 1, o = 0, c = true) {
    a.pathLength = 1;
    const d = c ? Kx : Qx;
    a[d.offset] = `${-o}`, a[d.array] = `${l} ${u}`;
  }
  const Fx = [
    "offsetDistance",
    "offsetPath",
    "offsetRotate",
    "offsetAnchor"
  ];
  function J0(a, { attrX: l, attrY: u, attrScale: o, pathLength: c, pathSpacing: d = 1, pathOffset: f = 0, ...m }, y, p, v) {
    if (tf(a, m, p), y) {
      a.style.viewBox && (a.attrs.viewBox = a.style.viewBox);
      return;
    }
    a.attrs = a.style, a.style = {};
    const { attrs: b, style: S } = a;
    b.transform && (S.transform = b.transform, delete b.transform), (S.transform || b.transformOrigin) && (S.transformOrigin = b.transformOrigin ?? "50% 50%", delete b.transformOrigin), S.transform && (S.transformBox = (v == null ? void 0 : v.transformBox) ?? "fill-box", delete b.transformBox);
    for (const D of Fx) b[D] !== void 0 && (S[D] = b[D], delete b[D]);
    l !== void 0 && (b.x = l), u !== void 0 && (b.y = u), o !== void 0 && (b.scale = o), c !== void 0 && Jx(b, c, d, f, false);
  }
  const F0 = /* @__PURE__ */ new Set([
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
  ]), P0 = (a) => typeof a == "string" && a.toLowerCase() === "svg";
  function Px(a, l, u, o) {
    K0(a, l, void 0, o);
    for (const c in l.attrs) a.setAttribute(F0.has(c) ? c : Qc(c), l.attrs[c]);
  }
  function W0(a, l, u) {
    const o = ef(a, l, u);
    for (const c in a) if (le(a[c]) || le(l[c])) {
      const d = mi.indexOf(c) !== -1 ? "attr" + c.charAt(0).toUpperCase() + c.substring(1) : c;
      o[d] = a[c];
    }
    return o;
  }
  class Wx extends Y0 {
    constructor() {
      super(...arguments), this.type = "svg", this.isSVGTag = false, this.measureInstanceViewportBox = Pt;
    }
    getBaseTargetFromProps(l, u) {
      return l[u];
    }
    readValueFromInstance(l, u) {
      if (pi.has(u)) {
        const o = j0(u);
        return o && o.default || 0;
      }
      return u = F0.has(u) ? u : Qc(u), l.getAttribute(u);
    }
    scrapeMotionValuesFromProps(l, u, o) {
      return W0(l, u, o);
    }
    build(l, u, o) {
      J0(l, u, this.isSVGTag, o.transformTemplate, o.style);
    }
    renderInstance(l, u, o, c) {
      Px(l, u, o, c);
    }
    mount(l) {
      this.isSVGTag = P0(l.tagName), super.mount(l);
    }
  }
  const $x = Ic.length;
  function $0(a) {
    if (!a) return;
    if (!a.isControllingVariants) {
      const u = a.parent ? $0(a.parent) || {} : {};
      return a.props.initial !== void 0 && (u.initial = a.props.initial), u;
    }
    const l = {};
    for (let u = 0; u < $x; u++) {
      const o = Ic[u], c = a.props[o];
      (Sl(c) || c === false) && (l[o] = c);
    }
    return l;
  }
  function I0(a, l) {
    if (!Array.isArray(l)) return false;
    const u = l.length;
    if (u !== a.length) return false;
    for (let o = 0; o < u; o++) if (l[o] !== a[o]) return false;
    return true;
  }
  const Ix = [
    ...$c
  ].reverse(), t2 = $c.length;
  function e2(a) {
    return (l) => Promise.all(l.map(({ animation: u, options: o }) => WS(a, u, o)));
  }
  function n2(a) {
    let l = e2(a), u = Fp(), o = true, c = false;
    const d = (p) => (v, b) => {
      var _a;
      const S = Sa(a, b, p === "exit" ? (_a = a.presenceContext) == null ? void 0 : _a.custom : void 0);
      if (S) {
        const { transition: D, transitionEnd: N, ...q } = S;
        v = {
          ...v,
          ...q,
          ...N
        };
      }
      return v;
    };
    function f(p) {
      l = p(a);
    }
    function m(p) {
      const { props: v } = a, b = $0(a.parent) || {}, S = [], D = /* @__PURE__ */ new Set();
      let N = {}, q = 1 / 0;
      for (let G = 0; G < t2; G++) {
        const K = Ix[G], X = u[K], Z = v[K] !== void 0 ? v[K] : b[K], $ = Sl(Z), st = K === p ? X.isActive : null;
        st === false && (q = G);
        let et = Z === b[K] && Z !== v[K] && $;
        if (et && (o || c) && a.manuallyAnimateOnMount && (et = false), X.protectedKeys = {
          ...N
        }, !X.isActive && st === null || !Z && !X.prevProp || hu(Z) || typeof Z == "boolean") continue;
        if (K === "exit" && X.isActive && st !== true) {
          X.prevResolvedValues && (N = {
            ...N,
            ...X.prevResolvedValues
          });
          continue;
        }
        const J = a2(X.prevProp, Z);
        let it = J || K === p && X.isActive && !et && $ || G > q && $, tt = false;
        const ft = Array.isArray(Z) ? Z : [
          Z
        ];
        let pt = ft.reduce(d(K), {});
        st === false && (pt = {});
        const { prevResolvedValues: Ut = {} } = X, _t = {
          ...Ut,
          ...pt
        }, jt = (L) => {
          it = true, D.has(L) && (tt = true, D.delete(L)), X.needsAnimating[L] = true;
          const k = a.getValue(L);
          k && (k.liveStyle = false);
        };
        for (const L in _t) {
          const k = pt[L], F = Ut[L];
          if (N.hasOwnProperty(L)) continue;
          let A = false;
          mc(k) && mc(F) ? A = !I0(k, F) : A = k !== F, A ? k != null ? jt(L) : D.add(L) : k !== void 0 && D.has(L) ? jt(L) : X.protectedKeys[L] = true;
        }
        X.prevProp = Z, X.prevResolvedValues = pt, X.isActive && (N = {
          ...N,
          ...pt
        }), (o || c) && a.blockInitialAnimation && (it = false);
        const x = et && J;
        it && (!x || tt) && S.push(...ft.map((L) => {
          const k = {
            type: K
          };
          if (typeof L == "string" && (o || c) && !x && a.manuallyAnimateOnMount && a.parent) {
            const { parent: F } = a, A = Sa(F, L);
            if (F.enteringChildren && A) {
              const { delayChildren: B } = A.transition || {};
              k.delay = x0(F.enteringChildren, a, B);
            }
          }
          return {
            animation: L,
            options: k
          };
        }));
      }
      if (D.size) {
        const G = {};
        if (typeof v.initial != "boolean") {
          const K = Sa(a, Array.isArray(v.initial) ? v.initial[0] : v.initial);
          K && K.transition && (G.transition = K.transition);
        }
        D.forEach((K) => {
          const X = a.getBaseTarget(K), Z = a.getValue(K);
          Z && (Z.liveStyle = true), G[K] = X ?? null;
        }), S.push({
          animation: G
        });
      }
      let Y = !!S.length;
      return o && (v.initial === false || v.initial === v.animate) && !a.manuallyAnimateOnMount && (Y = false), o = false, c = false, Y ? l(S) : Promise.resolve();
    }
    function y(p, v) {
      var _a;
      if (u[p].isActive === v) return Promise.resolve();
      (_a = a.variantChildren) == null ? void 0 : _a.forEach((S) => {
        var _a2;
        return (_a2 = S.animationState) == null ? void 0 : _a2.setActive(p, v);
      }), u[p].isActive = v;
      const b = m(p);
      for (const S in u) u[S].protectedKeys = {};
      return b;
    }
    return {
      animateChanges: m,
      setActive: y,
      setAnimateFunction: f,
      getState: () => u,
      reset: () => {
        u = Fp(), c = true;
      }
    };
  }
  function a2(a, l) {
    return typeof l == "string" ? l !== a : Array.isArray(l) ? !I0(l, a) : false;
  }
  function pa(a = false) {
    return {
      isActive: a,
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {}
    };
  }
  function Fp() {
    return {
      animate: pa(true),
      whileInView: pa(),
      whileHover: pa(),
      whileTap: pa(),
      whileDrag: pa(),
      whileFocus: pa(),
      exit: pa()
    };
  }
  function Ac(a, l) {
    a.min = l.min, a.max = l.max;
  }
  function ke(a, l) {
    Ac(a.x, l.x), Ac(a.y, l.y);
  }
  function Pp(a, l) {
    a.translate = l.translate, a.scale = l.scale, a.originPoint = l.originPoint, a.origin = l.origin;
  }
  const tg = 1e-4, i2 = 1 - tg, l2 = 1 + tg, eg = 0.01, s2 = 0 - eg, u2 = 0 + eg;
  function ce(a) {
    return a.max - a.min;
  }
  function o2(a, l, u) {
    return Math.abs(a - l) <= u;
  }
  function Wp(a, l, u, o = 0.5) {
    a.origin = o, a.originPoint = Bt(l.min, l.max, a.origin), a.scale = ce(u) / ce(l), a.translate = Bt(u.min, u.max, a.origin) - a.originPoint, (a.scale >= i2 && a.scale <= l2 || isNaN(a.scale)) && (a.scale = 1), (a.translate >= s2 && a.translate <= u2 || isNaN(a.translate)) && (a.translate = 0);
  }
  function yl(a, l, u, o) {
    Wp(a.x, l.x, u.x, o ? o.originX : void 0), Wp(a.y, l.y, u.y, o ? o.originY : void 0);
  }
  function $p(a, l, u) {
    a.min = u.min + l.min, a.max = a.min + ce(l);
  }
  function r2(a, l, u) {
    $p(a.x, l.x, u.x), $p(a.y, l.y, u.y);
  }
  function Ip(a, l, u) {
    a.min = l.min - u.min, a.max = a.min + ce(l);
  }
  function ru(a, l, u) {
    Ip(a.x, l.x, u.x), Ip(a.y, l.y, u.y);
  }
  function ty(a, l, u, o, c) {
    return a -= l, a = ou(a, 1 / u, o), c !== void 0 && (a = ou(a, 1 / c, o)), a;
  }
  function c2(a, l = 0, u = 1, o = 0.5, c, d = a, f = a) {
    if ($e.test(l) && (l = parseFloat(l), l = Bt(f.min, f.max, l / 100) - f.min), typeof l != "number") return;
    let m = Bt(d.min, d.max, o);
    a === d && (m -= l), a.min = ty(a.min, l, u, m, c), a.max = ty(a.max, l, u, m, c);
  }
  function ey(a, l, [u, o, c], d, f) {
    c2(a, l[u], l[o], l[c], l.scale, d, f);
  }
  const f2 = [
    "x",
    "scaleX",
    "originX"
  ], h2 = [
    "y",
    "scaleY",
    "originY"
  ];
  function ny(a, l, u, o) {
    ey(a.x, l, f2, u ? u.x : void 0, o ? o.x : void 0), ey(a.y, l, h2, u ? u.y : void 0, o ? o.y : void 0);
  }
  function ay(a) {
    return a.translate === 0 && a.scale === 1;
  }
  function ng(a) {
    return ay(a.x) && ay(a.y);
  }
  function iy(a, l) {
    return a.min === l.min && a.max === l.max;
  }
  function d2(a, l) {
    return iy(a.x, l.x) && iy(a.y, l.y);
  }
  function ly(a, l) {
    return Math.round(a.min) === Math.round(l.min) && Math.round(a.max) === Math.round(l.max);
  }
  function ag(a, l) {
    return ly(a.x, l.x) && ly(a.y, l.y);
  }
  function sy(a) {
    return ce(a.x) / ce(a.y);
  }
  function uy(a, l) {
    return a.translate === l.translate && a.scale === l.scale && a.originPoint === l.originPoint;
  }
  function We(a) {
    return [
      a("x"),
      a("y")
    ];
  }
  function m2(a, l, u) {
    let o = "";
    const c = a.x.translate / l.x, d = a.y.translate / l.y, f = (u == null ? void 0 : u.z) || 0;
    if ((c || d || f) && (o = `translate3d(${c}px, ${d}px, ${f}px) `), (l.x !== 1 || l.y !== 1) && (o += `scale(${1 / l.x}, ${1 / l.y}) `), u) {
      const { transformPerspective: p, rotate: v, rotateX: b, rotateY: S, skewX: D, skewY: N } = u;
      p && (o = `perspective(${p}px) ${o}`), v && (o += `rotate(${v}deg) `), b && (o += `rotateX(${b}deg) `), S && (o += `rotateY(${S}deg) `), D && (o += `skewX(${D}deg) `), N && (o += `skewY(${N}deg) `);
    }
    const m = a.x.scale * l.x, y = a.y.scale * l.y;
    return (m !== 1 || y !== 1) && (o += `scale(${m}, ${y})`), o || "none";
  }
  const ig = [
    "TopLeft",
    "TopRight",
    "BottomLeft",
    "BottomRight"
  ], p2 = ig.length, oy = (a) => typeof a == "string" ? parseFloat(a) : a, ry = (a) => typeof a == "number" || I.test(a);
  function y2(a, l, u, o, c, d) {
    c ? (a.opacity = Bt(0, u.opacity ?? 1, g2(o)), a.opacityExit = Bt(l.opacity ?? 1, 0, v2(o))) : d && (a.opacity = Bt(l.opacity ?? 1, u.opacity ?? 1, o));
    for (let f = 0; f < p2; f++) {
      const m = `border${ig[f]}Radius`;
      let y = cy(l, m), p = cy(u, m);
      if (y === void 0 && p === void 0) continue;
      y || (y = 0), p || (p = 0), y === 0 || p === 0 || ry(y) === ry(p) ? (a[m] = Math.max(Bt(oy(y), oy(p), o), 0), ($e.test(p) || $e.test(y)) && (a[m] += "%")) : a[m] = p;
    }
    (l.rotate || u.rotate) && (a.rotate = Bt(l.rotate || 0, u.rotate || 0, o));
  }
  function cy(a, l) {
    return a[l] !== void 0 ? a[l] : a.borderRadius;
  }
  const g2 = lg(0, 0.5, Py), v2 = lg(0.5, 0.95, qe);
  function lg(a, l, u) {
    return (o) => o < a ? 0 : o > l ? 1 : u(vl(a, l, o));
  }
  function b2(a, l, u) {
    const o = le(a) ? a : hi(a);
    return o.start(Zc("", o, l, u)), o.animation;
  }
  function xl(a, l, u, o = {
    passive: true
  }) {
    return a.addEventListener(l, u, o), () => a.removeEventListener(l, u);
  }
  const S2 = (a, l) => a.depth - l.depth;
  class x2 {
    constructor() {
      this.children = [], this.isDirty = false;
    }
    add(l) {
      jc(this.children, l), this.isDirty = true;
    }
    remove(l) {
      au(this.children, l), this.isDirty = true;
    }
    forEach(l) {
      this.isDirty && this.children.sort(S2), this.isDirty = false, this.children.forEach(l);
    }
  }
  function T2(a, l) {
    const u = re.now(), o = ({ timestamp: c }) => {
      const d = c - u;
      d >= l && (Qn(o), a(d - l));
    };
    return Rt.setup(o, true), () => Qn(o);
  }
  function eu(a) {
    return le(a) ? a.get() : a;
  }
  class A2 {
    constructor() {
      this.members = [];
    }
    add(l) {
      jc(this.members, l);
      for (let u = this.members.length - 1; u >= 0; u--) {
        const o = this.members[u];
        if (o === l || o === this.lead || o === this.prevLead) continue;
        const c = o.instance;
        (!c || c.isConnected === false) && !o.snapshot && (au(this.members, o), o.unmount());
      }
      l.scheduleRender();
    }
    remove(l) {
      if (au(this.members, l), l === this.prevLead && (this.prevLead = void 0), l === this.lead) {
        const u = this.members[this.members.length - 1];
        u && this.promote(u);
      }
    }
    relegate(l) {
      var _a;
      for (let u = this.members.indexOf(l) - 1; u >= 0; u--) {
        const o = this.members[u];
        if (o.isPresent !== false && ((_a = o.instance) == null ? void 0 : _a.isConnected) !== false) return this.promote(o), true;
      }
      return false;
    }
    promote(l, u) {
      var _a;
      const o = this.lead;
      if (l !== o && (this.prevLead = o, this.lead = l, l.show(), o)) {
        o.updateSnapshot(), l.scheduleRender();
        const { layoutDependency: c } = o.options, { layoutDependency: d } = l.options;
        (c === void 0 || c !== d) && (l.resumeFrom = o, u && (o.preserveOpacity = true), o.snapshot && (l.snapshot = o.snapshot, l.snapshot.latestValues = o.animationValues || o.latestValues), ((_a = l.root) == null ? void 0 : _a.isUpdating) && (l.isLayoutDirty = true)), l.options.crossfade === false && o.hide();
      }
    }
    exitAnimationComplete() {
      this.members.forEach((l) => {
        var _a, _b2, _c2, _d, _e;
        (_b2 = (_a = l.options).onExitComplete) == null ? void 0 : _b2.call(_a), (_e = (_c2 = l.resumingFrom) == null ? void 0 : (_d = _c2.options).onExitComplete) == null ? void 0 : _e.call(_d);
      });
    }
    scheduleRender() {
      this.members.forEach((l) => l.instance && l.scheduleRender(false));
    }
    removeLeadSnapshot() {
      var _a;
      ((_a = this.lead) == null ? void 0 : _a.snapshot) && (this.lead.snapshot = void 0);
    }
  }
  const nu = {
    hasAnimatedSinceResize: true,
    hasEverUpdated: false
  }, Jr = [
    "",
    "X",
    "Y",
    "Z"
  ], E2 = 1e3;
  let M2 = 0;
  function Fr(a, l, u, o) {
    const { latestValues: c } = l;
    c[a] && (u[a] = c[a], l.setStaticValue(a, 0), o && (o[a] = 0));
  }
  function sg(a) {
    if (a.hasCheckedOptimisedAppear = true, a.root === a) return;
    const { visualElement: l } = a.options;
    if (!l) return;
    const u = C0(l);
    if (window.MotionHasOptimisedAnimation(u, "transform")) {
      const { layout: c, layoutId: d } = a.options;
      window.MotionCancelOptimisedAnimation(u, "transform", Rt, !(c || d));
    }
    const { parent: o } = a;
    o && !o.hasCheckedOptimisedAppear && sg(o);
  }
  function ug({ attachResizeListener: a, defaultParent: l, measureScroll: u, checkIsScrollRoot: o, resetTransform: c }) {
    return class {
      constructor(f = {}, m = l == null ? void 0 : l()) {
        this.id = M2++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = false, this.isAnimationBlocked = false, this.isLayoutDirty = false, this.isProjectionDirty = false, this.isSharedProjectionDirty = false, this.isTransformDirty = false, this.updateManuallyBlocked = false, this.updateBlockedByResize = false, this.isUpdating = false, this.isSVG = false, this.needsReset = false, this.shouldResetTransform = false, this.hasCheckedOptimisedAppear = false, this.treeScale = {
          x: 1,
          y: 1
        }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = false, this.layoutVersion = 0, this.updateScheduled = false, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = false, this.checkUpdateFailed = () => {
          this.isUpdating && (this.isUpdating = false, this.clearAllSnapshots());
        }, this.updateProjection = () => {
          this.projectionUpdateScheduled = false, this.nodes.forEach(z2), this.nodes.forEach(N2), this.nodes.forEach(_2), this.nodes.forEach(R2);
        }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = false, this.isVisible = true, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = f, this.root = m ? m.root || m : this, this.path = m ? [
          ...m.path,
          m
        ] : [], this.parent = m, this.depth = m ? m.depth + 1 : 0;
        for (let y = 0; y < this.path.length; y++) this.path[y].shouldResetTransform = true;
        this.root === this && (this.nodes = new x2());
      }
      addEventListener(f, m) {
        return this.eventHandlers.has(f) || this.eventHandlers.set(f, new Nc()), this.eventHandlers.get(f).add(m);
      }
      notifyListeners(f, ...m) {
        const y = this.eventHandlers.get(f);
        y && y.notify(...m);
      }
      hasListeners(f) {
        return this.eventHandlers.has(f);
      }
      mount(f) {
        if (this.instance) return;
        this.isSVG = Wc(f) && !Dx(f), this.instance = f;
        const { layoutId: m, layout: y, visualElement: p } = this.options;
        if (p && !p.current && p.mount(f), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (y || m) && (this.isLayoutDirty = true), a) {
          let v, b = 0;
          const S = () => this.root.updateBlockedByResize = false;
          Rt.read(() => {
            b = window.innerWidth;
          }), a(f, () => {
            const D = window.innerWidth;
            D !== b && (b = D, this.root.updateBlockedByResize = true, v && v(), v = T2(S, 250), nu.hasAnimatedSinceResize && (nu.hasAnimatedSinceResize = false, this.nodes.forEach(dy)));
          });
        }
        m && this.root.registerSharedNode(m, this), this.options.animate !== false && p && (m || y) && this.addEventListener("didUpdate", ({ delta: v, hasLayoutChanged: b, hasRelativeLayoutChanged: S, layout: D }) => {
          if (this.isTreeAnimationBlocked()) {
            this.target = void 0, this.relativeTarget = void 0;
            return;
          }
          const N = this.options.transition || p.getDefaultTransition() || L2, { onLayoutAnimationStart: q, onLayoutAnimationComplete: Y } = p.getProps(), G = !this.targetLayout || !ag(this.targetLayout, D), K = !b && S;
          if (this.options.layoutRoot || this.resumeFrom || K || b && (G || !this.currentAnimation)) {
            this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
            const X = {
              ...kc(N, "layout"),
              onPlay: q,
              onComplete: Y
            };
            (p.shouldReduceMotion || this.options.layoutRoot) && (X.delay = 0, X.type = false), this.startAnimation(X), this.setAnimationOrigin(v, K);
          } else b || dy(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
          this.targetLayout = D;
        });
      }
      unmount() {
        this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
        const f = this.getStack();
        f && f.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), Qn(this.updateProjection);
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
        this.isUpdateBlocked() || (this.isUpdating = true, this.nodes && this.nodes.forEach(w2), this.animationId++);
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
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && sg(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
        this.isLayoutDirty = true;
        for (let v = 0; v < this.path.length; v++) {
          const b = this.path[v];
          b.shouldResetTransform = true, (typeof b.latestValues.x == "string" || typeof b.latestValues.y == "string") && (b.isLayoutDirty = true), b.updateScroll("snapshot"), b.options.layoutRoot && b.willUpdate(false);
        }
        const { layoutId: m, layout: y } = this.options;
        if (m === void 0 && !y) return;
        const p = this.getTransformTemplate();
        this.prevTransformTemplateValue = p ? p(this.latestValues, "") : void 0, this.updateSnapshot(), f && this.notifyListeners("willUpdate");
      }
      update() {
        if (this.updateScheduled = false, this.isUpdateBlocked()) {
          this.unblockUpdate(), this.clearAllSnapshots(), this.nodes.forEach(fy);
          return;
        }
        if (this.animationId <= this.animationCommitId) {
          this.nodes.forEach(hy);
          return;
        }
        this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = false, this.nodes.forEach(O2), this.nodes.forEach(C2), this.nodes.forEach(D2)) : this.nodes.forEach(hy), this.clearAllSnapshots();
        const m = re.now();
        ie.delta = Ie(0, 1e3 / 60, m - ie.timestamp), ie.timestamp = m, ie.isProcessing = true, qr.update.process(ie), qr.preRender.process(ie), qr.render.process(ie), ie.isProcessing = false;
      }
      didUpdate() {
        this.updateScheduled || (this.updateScheduled = true, Fc.read(this.scheduleUpdate));
      }
      clearAllSnapshots() {
        this.nodes.forEach(j2), this.sharedNodes.forEach(V2);
      }
      scheduleUpdateProjection() {
        this.projectionUpdateScheduled || (this.projectionUpdateScheduled = true, Rt.preRender(this.updateProjection, false, true));
      }
      scheduleCheckAfterUnmount() {
        Rt.postRender(() => {
          this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
        });
      }
      updateSnapshot() {
        this.snapshot || !this.instance || (this.snapshot = this.measure(), this.snapshot && !ce(this.snapshot.measuredBox.x) && !ce(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
      }
      updateLayout() {
        if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
        if (this.resumeFrom && !this.resumeFrom.instance) for (let y = 0; y < this.path.length; y++) this.path[y].updateScroll();
        const f = this.layout;
        this.layout = this.measure(false), this.layoutVersion++, this.layoutCorrected = Pt(), this.isLayoutDirty = false, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
        const { visualElement: m } = this.options;
        m && m.notify("LayoutMeasure", this.layout.layoutBox, f ? f.layoutBox : void 0);
      }
      updateScroll(f = "measure") {
        let m = !!(this.options.layoutScroll && this.instance);
        if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === f && (m = false), m && this.instance) {
          const y = o(this.instance);
          this.scroll = {
            animationId: this.root.animationId,
            phase: f,
            isRoot: y,
            offset: u(this.instance),
            wasRoot: this.scroll ? this.scroll.isRoot : y
          };
        }
      }
      resetTransform() {
        if (!c) return;
        const f = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, m = this.projectionDelta && !ng(this.projectionDelta), y = this.getTransformTemplate(), p = y ? y(this.latestValues, "") : void 0, v = p !== this.prevTransformTemplateValue;
        f && this.instance && (m || ya(this.latestValues) || v) && (c(this.instance, p), this.shouldResetTransform = false, this.scheduleRender());
      }
      measure(f = true) {
        const m = this.measurePageBox();
        let y = this.removeElementScroll(m);
        return f && (y = this.removeTransform(y)), H2(y), {
          animationId: this.root.animationId,
          measuredBox: m,
          layoutBox: y,
          latestValues: {},
          source: this.id
        };
      }
      measurePageBox() {
        var _a;
        const { visualElement: f } = this.options;
        if (!f) return Pt();
        const m = f.measureViewportBox();
        if (!(((_a = this.scroll) == null ? void 0 : _a.wasRoot) || this.path.some(q2))) {
          const { scroll: p } = this.root;
          p && (ri(m.x, p.offset.x), ri(m.y, p.offset.y));
        }
        return m;
      }
      removeElementScroll(f) {
        var _a;
        const m = Pt();
        if (ke(m, f), (_a = this.scroll) == null ? void 0 : _a.wasRoot) return m;
        for (let y = 0; y < this.path.length; y++) {
          const p = this.path[y], { scroll: v, options: b } = p;
          p !== this.root && v && b.layoutScroll && (v.wasRoot && ke(m, f), ri(m.x, v.offset.x), ri(m.y, v.offset.y));
        }
        return m;
      }
      applyTransform(f, m = false) {
        var _a, _b2;
        const y = Pt();
        ke(y, f);
        for (let p = 0; p < this.path.length; p++) {
          const v = this.path[p];
          !m && v.options.layoutScroll && v.scroll && v !== v.root && ci(y, {
            x: -v.scroll.offset.x,
            y: -v.scroll.offset.y
          }), ya(v.latestValues) && ci(y, v.latestValues, (_a = v.layout) == null ? void 0 : _a.layoutBox);
        }
        return ya(this.latestValues) && ci(y, this.latestValues, (_b2 = this.layout) == null ? void 0 : _b2.layoutBox), y;
      }
      removeTransform(f) {
        var _a;
        const m = Pt();
        ke(m, f);
        for (let y = 0; y < this.path.length; y++) {
          const p = this.path[y];
          if (!ya(p.latestValues)) continue;
          let v;
          p.instance && (Sc(p.latestValues) && p.updateSnapshot(), v = Pt(), ke(v, p.measurePageBox())), ny(m, p.latestValues, (_a = p.snapshot) == null ? void 0 : _a.layoutBox, v);
        }
        return ya(this.latestValues) && ny(m, this.latestValues), m;
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
        this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== ie.timestamp && this.relativeParent.resolveTargetDelta(true);
      }
      resolveTargetDelta(f = false) {
        var _a;
        const m = this.getLead();
        this.isProjectionDirty || (this.isProjectionDirty = m.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = m.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = m.isSharedProjectionDirty);
        const y = !!this.resumingFrom || this !== m;
        if (!(f || y && this.isSharedProjectionDirty || this.isProjectionDirty || ((_a = this.parent) == null ? void 0 : _a.isProjectionDirty) || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
        const { layout: v, layoutId: b } = this.options;
        if (!this.layout || !(v || b)) return;
        this.resolvedRelativeTargetAt = ie.timestamp;
        const S = this.getClosestProjectingParent();
        S && this.linkedParentVersion !== S.layoutVersion && !S.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (S && S.layout ? this.createRelativeTarget(S, this.layout.layoutBox, S.layout.layoutBox) : this.removeRelativeTarget()), !(!this.relativeTarget && !this.targetDelta) && (this.target || (this.target = Pt(), this.targetWithTransforms = Pt()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), r2(this.target, this.relativeTarget, this.relativeParent.target)) : this.targetDelta ? (this.resumingFrom ? this.target = this.applyTransform(this.layout.layoutBox) : ke(this.target, this.layout.layoutBox), k0(this.target, this.targetDelta)) : ke(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = false, S && !!S.resumingFrom == !!this.resumingFrom && !S.options.layoutScroll && S.target && this.animationProgress !== 1 ? this.createRelativeTarget(S, this.target, S.target) : this.relativeParent = this.relativeTarget = void 0));
      }
      getClosestProjectingParent() {
        if (!(!this.parent || Sc(this.parent.latestValues) || X0(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
      }
      isProjecting() {
        return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      createRelativeTarget(f, m, y) {
        this.relativeParent = f, this.linkedParentVersion = f.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = Pt(), this.relativeTargetOrigin = Pt(), ru(this.relativeTargetOrigin, m, y), ke(this.relativeTarget, this.relativeTargetOrigin);
      }
      removeRelativeTarget() {
        this.relativeParent = this.relativeTarget = void 0;
      }
      calcProjection() {
        var _a;
        const f = this.getLead(), m = !!this.resumingFrom || this !== f;
        let y = true;
        if ((this.isProjectionDirty || ((_a = this.parent) == null ? void 0 : _a.isProjectionDirty)) && (y = false), m && (this.isSharedProjectionDirty || this.isTransformDirty) && (y = false), this.resolvedRelativeTargetAt === ie.timestamp && (y = false), y) return;
        const { layout: p, layoutId: v } = this.options;
        if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(p || v)) return;
        ke(this.layoutCorrected, this.layout.layoutBox);
        const b = this.treeScale.x, S = this.treeScale.y;
        Lx(this.layoutCorrected, this.treeScale, this.path, m), f.layout && !f.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (f.target = f.layout.layoutBox, f.targetWithTransforms = Pt());
        const { target: D } = f;
        if (!D) {
          this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
          return;
        }
        !this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (Pp(this.prevProjectionDelta.x, this.projectionDelta.x), Pp(this.prevProjectionDelta.y, this.projectionDelta.y)), yl(this.projectionDelta, this.layoutCorrected, D, this.latestValues), (this.treeScale.x !== b || this.treeScale.y !== S || !uy(this.projectionDelta.x, this.prevProjectionDelta.x) || !uy(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = true, this.scheduleRender(), this.notifyListeners("projectionUpdate", D));
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
          const m = this.getStack();
          m && m.scheduleRender();
        }
        this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
      }
      createProjectionDeltas() {
        this.prevProjectionDelta = oi(), this.projectionDelta = oi(), this.projectionDeltaWithTransform = oi();
      }
      setAnimationOrigin(f, m = false) {
        const y = this.snapshot, p = y ? y.latestValues : {}, v = {
          ...this.latestValues
        }, b = oi();
        (!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !m;
        const S = Pt(), D = y ? y.source : void 0, N = this.layout ? this.layout.source : void 0, q = D !== N, Y = this.getStack(), G = !Y || Y.members.length <= 1, K = !!(q && !G && this.options.crossfade === true && !this.path.some(B2));
        this.animationProgress = 0;
        let X;
        this.mixTargetDelta = (Z) => {
          const $ = Z / 1e3;
          my(b.x, f.x, $), my(b.y, f.y, $), this.setTargetDelta(b), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && (ru(S, this.layout.layoutBox, this.relativeParent.layout.layoutBox), U2(this.relativeTarget, this.relativeTargetOrigin, S, $), X && d2(this.relativeTarget, X) && (this.isProjectionDirty = false), X || (X = Pt()), ke(X, this.relativeTarget)), q && (this.animationValues = v, y2(v, p, this.latestValues, $, K, G)), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = $;
        }, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(f) {
        var _a, _b2, _c2;
        this.notifyListeners("animationStart"), (_a = this.currentAnimation) == null ? void 0 : _a.stop(), (_c2 = (_b2 = this.resumingFrom) == null ? void 0 : _b2.currentAnimation) == null ? void 0 : _c2.stop(), this.pendingAnimation && (Qn(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = Rt.update(() => {
          nu.hasAnimatedSinceResize = true, this.motionValue || (this.motionValue = hi(0)), this.motionValue.jump(0, false), this.currentAnimation = b2(this.motionValue, [
            0,
            1e3
          ], {
            ...f,
            velocity: 0,
            isSync: true,
            onUpdate: (m) => {
              this.mixTargetDelta(m), f.onUpdate && f.onUpdate(m);
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
        this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(E2), this.currentAnimation.stop()), this.completeAnimation();
      }
      applyTransformsToTarget() {
        const f = this.getLead();
        let { targetWithTransforms: m, target: y, layout: p, latestValues: v } = f;
        if (!(!m || !y || !p)) {
          if (this !== f && this.layout && p && og(this.options.animationType, this.layout.layoutBox, p.layoutBox)) {
            y = this.target || Pt();
            const b = ce(this.layout.layoutBox.x);
            y.x.min = f.target.x.min, y.x.max = y.x.min + b;
            const S = ce(this.layout.layoutBox.y);
            y.y.min = f.target.y.min, y.y.max = y.y.min + S;
          }
          ke(m, y), ci(m, v), yl(this.projectionDeltaWithTransform, this.layoutCorrected, m, v);
        }
      }
      registerSharedNode(f, m) {
        this.sharedNodes.has(f) || this.sharedNodes.set(f, new A2()), this.sharedNodes.get(f).add(m);
        const p = m.options.initialPromotionConfig;
        m.promote({
          transition: p ? p.transition : void 0,
          preserveFollowOpacity: p && p.shouldPreserveFollowOpacity ? p.shouldPreserveFollowOpacity(m) : void 0
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
      promote({ needsReset: f, transition: m, preserveFollowOpacity: y } = {}) {
        const p = this.getStack();
        p && p.promote(this, y), f && (this.projectionDelta = void 0, this.needsReset = true), m && this.setOptions({
          transition: m
        });
      }
      relegate() {
        const f = this.getStack();
        return f ? f.relegate(this) : false;
      }
      resetSkewAndRotation() {
        const { visualElement: f } = this.options;
        if (!f) return;
        let m = false;
        const { latestValues: y } = f;
        if ((y.z || y.rotate || y.rotateX || y.rotateY || y.rotateZ || y.skewX || y.skewY) && (m = true), !m) return;
        const p = {};
        y.z && Fr("z", f, p, this.animationValues);
        for (let v = 0; v < Jr.length; v++) Fr(`rotate${Jr[v]}`, f, p, this.animationValues), Fr(`skew${Jr[v]}`, f, p, this.animationValues);
        f.render();
        for (const v in p) f.setStaticValue(v, p[v]), this.animationValues && (this.animationValues[v] = p[v]);
        f.scheduleRender();
      }
      applyProjectionStyles(f, m) {
        if (!this.instance || this.isSVG) return;
        if (!this.isVisible) {
          f.visibility = "hidden";
          return;
        }
        const y = this.getTransformTemplate();
        if (this.needsReset) {
          this.needsReset = false, f.visibility = "", f.opacity = "", f.pointerEvents = eu(m == null ? void 0 : m.pointerEvents) || "", f.transform = y ? y(this.latestValues, "") : "none";
          return;
        }
        const p = this.getLead();
        if (!this.projectionDelta || !this.layout || !p.target) {
          this.options.layoutId && (f.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1, f.pointerEvents = eu(m == null ? void 0 : m.pointerEvents) || ""), this.hasProjected && !ya(this.latestValues) && (f.transform = y ? y({}, "") : "none", this.hasProjected = false);
          return;
        }
        f.visibility = "";
        const v = p.animationValues || p.latestValues;
        this.applyTransformsToTarget();
        let b = m2(this.projectionDeltaWithTransform, this.treeScale, v);
        y && (b = y(v, b)), f.transform = b;
        const { x: S, y: D } = this.projectionDelta;
        f.transformOrigin = `${S.origin * 100}% ${D.origin * 100}% 0`, p.animationValues ? f.opacity = p === this ? v.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : v.opacityExit : f.opacity = p === this ? v.opacity !== void 0 ? v.opacity : "" : v.opacityExit !== void 0 ? v.opacityExit : 0;
        for (const N in Tc) {
          if (v[N] === void 0) continue;
          const { correct: q, applyTo: Y, isCSSVariable: G } = Tc[N], K = b === "none" ? v[N] : q(v[N], p);
          if (Y) {
            const X = Y.length;
            for (let Z = 0; Z < X; Z++) f[Y[Z]] = K;
          } else G ? this.options.visualElement.renderState.vars[N] = K : f[N] = K;
        }
        this.options.layoutId && (f.pointerEvents = p === this ? eu(m == null ? void 0 : m.pointerEvents) || "" : "none");
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      resetTree() {
        this.root.nodes.forEach((f) => {
          var _a;
          return (_a = f.currentAnimation) == null ? void 0 : _a.stop();
        }), this.root.nodes.forEach(fy), this.root.sharedNodes.clear();
      }
    };
  }
  function C2(a) {
    a.updateLayout();
  }
  function D2(a) {
    var _a;
    const l = ((_a = a.resumeFrom) == null ? void 0 : _a.snapshot) || a.snapshot;
    if (a.isLead() && a.layout && l && a.hasListeners("didUpdate")) {
      const { layoutBox: u, measuredBox: o } = a.layout, { animationType: c } = a.options, d = l.source !== a.layout.source;
      if (c === "size") We((v) => {
        const b = d ? l.measuredBox[v] : l.layoutBox[v], S = ce(b);
        b.min = u[v].min, b.max = b.min + S;
      });
      else if (c === "x" || c === "y") {
        const v = c === "x" ? "y" : "x";
        Ac(d ? l.measuredBox[v] : l.layoutBox[v], u[v]);
      } else og(c, l.layoutBox, u) && We((v) => {
        const b = d ? l.measuredBox[v] : l.layoutBox[v], S = ce(u[v]);
        b.max = b.min + S, a.relativeTarget && !a.currentAnimation && (a.isProjectionDirty = true, a.relativeTarget[v].max = a.relativeTarget[v].min + S);
      });
      const f = oi();
      yl(f, u, l.layoutBox);
      const m = oi();
      d ? yl(m, a.applyTransform(o, true), l.measuredBox) : yl(m, u, l.layoutBox);
      const y = !ng(f);
      let p = false;
      if (!a.resumeFrom) {
        const v = a.getClosestProjectingParent();
        if (v && !v.resumeFrom) {
          const { snapshot: b, layout: S } = v;
          if (b && S) {
            const D = Pt();
            ru(D, l.layoutBox, b.layoutBox);
            const N = Pt();
            ru(N, u, S.layoutBox), ag(D, N) || (p = true), v.options.layoutRoot && (a.relativeTarget = N, a.relativeTargetOrigin = D, a.relativeParent = v);
          }
        }
      }
      a.notifyListeners("didUpdate", {
        layout: u,
        snapshot: l,
        delta: m,
        layoutDelta: f,
        hasLayoutChanged: y,
        hasRelativeLayoutChanged: p
      });
    } else if (a.isLead()) {
      const { onExitComplete: u } = a.options;
      u && u();
    }
    a.options.transition = void 0;
  }
  function z2(a) {
    a.parent && (a.isProjecting() || (a.isProjectionDirty = a.parent.isProjectionDirty), a.isSharedProjectionDirty || (a.isSharedProjectionDirty = !!(a.isProjectionDirty || a.parent.isProjectionDirty || a.parent.isSharedProjectionDirty)), a.isTransformDirty || (a.isTransformDirty = a.parent.isTransformDirty));
  }
  function R2(a) {
    a.isProjectionDirty = a.isSharedProjectionDirty = a.isTransformDirty = false;
  }
  function j2(a) {
    a.clearSnapshot();
  }
  function fy(a) {
    a.clearMeasurements();
  }
  function hy(a) {
    a.isLayoutDirty = false;
  }
  function O2(a) {
    const { visualElement: l } = a.options;
    l && l.getProps().onBeforeLayoutMeasure && l.notify("BeforeLayoutMeasure"), a.resetTransform();
  }
  function dy(a) {
    a.finishAnimation(), a.targetDelta = a.relativeTarget = a.target = void 0, a.isProjectionDirty = true;
  }
  function N2(a) {
    a.resolveTargetDelta();
  }
  function _2(a) {
    a.calcProjection();
  }
  function w2(a) {
    a.resetSkewAndRotation();
  }
  function V2(a) {
    a.removeLeadSnapshot();
  }
  function my(a, l, u) {
    a.translate = Bt(l.translate, 0, u), a.scale = Bt(l.scale, 1, u), a.origin = l.origin, a.originPoint = l.originPoint;
  }
  function py(a, l, u, o) {
    a.min = Bt(l.min, u.min, o), a.max = Bt(l.max, u.max, o);
  }
  function U2(a, l, u, o) {
    py(a.x, l.x, u.x, o), py(a.y, l.y, u.y, o);
  }
  function B2(a) {
    return a.animationValues && a.animationValues.opacityExit !== void 0;
  }
  const L2 = {
    duration: 0.45,
    ease: [
      0.4,
      0,
      0.1,
      1
    ]
  }, yy = (a) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(a), gy = yy("applewebkit/") && !yy("chrome/") ? Math.round : qe;
  function vy(a) {
    a.min = gy(a.min), a.max = gy(a.max);
  }
  function H2(a) {
    vy(a.x), vy(a.y);
  }
  function og(a, l, u) {
    return a === "position" || a === "preserve-aspect" && !o2(sy(l), sy(u), 0.2);
  }
  function q2(a) {
    var _a;
    return a !== a.root && ((_a = a.scroll) == null ? void 0 : _a.wasRoot);
  }
  const Y2 = ug({
    attachResizeListener: (a, l) => xl(a, "resize", l),
    measureScroll: () => {
      var _a, _b2;
      return {
        x: document.documentElement.scrollLeft || ((_a = document.body) == null ? void 0 : _a.scrollLeft) || 0,
        y: document.documentElement.scrollTop || ((_b2 = document.body) == null ? void 0 : _b2.scrollTop) || 0
      };
    },
    checkIsScrollRoot: () => true
  }), Pr = {
    current: void 0
  }, rg = ug({
    measureScroll: (a) => ({
      x: a.scrollLeft,
      y: a.scrollTop
    }),
    defaultParent: () => {
      if (!Pr.current) {
        const a = new Y2({});
        a.mount(window), a.setOptions({
          layoutScroll: true
        }), Pr.current = a;
      }
      return Pr.current;
    },
    resetTransform: (a, l) => {
      a.style.transform = l !== void 0 ? l : "none";
    },
    checkIsScrollRoot: (a) => window.getComputedStyle(a).position === "fixed"
  }), nf = w.createContext({
    transformPagePoint: (a) => a,
    isStatic: false,
    reducedMotion: "never"
  });
  function by(a, l) {
    if (typeof a == "function") return a(l);
    a != null && (a.current = l);
  }
  function G2(...a) {
    return (l) => {
      let u = false;
      const o = a.map((c) => {
        const d = by(c, l);
        return !u && typeof d == "function" && (u = true), d;
      });
      if (u) return () => {
        for (let c = 0; c < o.length; c++) {
          const d = o[c];
          typeof d == "function" ? d() : by(a[c], null);
        }
      };
    };
  }
  function X2(...a) {
    return w.useCallback(G2(...a), a);
  }
  class k2 extends w.Component {
    getSnapshotBeforeUpdate(l) {
      const u = this.props.childRef.current;
      if (Ps(u) && l.isPresent && !this.props.isPresent && this.props.pop !== false) {
        const o = u.offsetParent, c = Ps(o) && o.offsetWidth || 0, d = Ps(o) && o.offsetHeight || 0, f = getComputedStyle(u), m = this.props.sizeRef.current;
        m.height = parseFloat(f.height), m.width = parseFloat(f.width), m.top = u.offsetTop, m.left = u.offsetLeft, m.right = c - m.width - m.left, m.bottom = d - m.height - m.top;
      }
      return null;
    }
    componentDidUpdate() {
    }
    render() {
      return this.props.children;
    }
  }
  function Z2({ children: a, isPresent: l, anchorX: u, anchorY: o, root: c, pop: d }) {
    var _a;
    const f = w.useId(), m = w.useRef(null), y = w.useRef({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }), { nonce: p } = w.useContext(nf), v = ((_a = a.props) == null ? void 0 : _a.ref) ?? (a == null ? void 0 : a.ref), b = X2(m, v);
    return w.useInsertionEffect(() => {
      const { width: S, height: D, top: N, left: q, right: Y, bottom: G } = y.current;
      if (l || d === false || !m.current || !S || !D) return;
      const K = u === "left" ? `left: ${q}` : `right: ${Y}`, X = o === "bottom" ? `bottom: ${G}` : `top: ${N}`;
      m.current.dataset.motionPopId = f;
      const Z = document.createElement("style");
      p && (Z.nonce = p);
      const $ = c ?? document.head;
      return $.appendChild(Z), Z.sheet && Z.sheet.insertRule(`
          [data-motion-pop-id="${f}"] {
            position: absolute !important;
            width: ${S}px !important;
            height: ${D}px !important;
            ${K}px !important;
            ${X}px !important;
          }
        `), () => {
        var _a2;
        (_a2 = m.current) == null ? void 0 : _a2.removeAttribute("data-motion-pop-id"), $.contains(Z) && $.removeChild(Z);
      };
    }, [
      l
    ]), E.jsx(k2, {
      isPresent: l,
      childRef: m,
      sizeRef: y,
      pop: d,
      children: d === false ? a : w.cloneElement(a, {
        ref: b
      })
    });
  }
  const K2 = ({ children: a, initial: l, isPresent: u, onExitComplete: o, custom: c, presenceAffectsLayout: d, mode: f, anchorX: m, anchorY: y, root: p }) => {
    const v = Rc(Q2), b = w.useId();
    let S = true, D = w.useMemo(() => (S = false, {
      id: b,
      initial: l,
      isPresent: u,
      custom: c,
      onExitComplete: (N) => {
        v.set(N, true);
        for (const q of v.values()) if (!q) return;
        o && o();
      },
      register: (N) => (v.set(N, false), () => v.delete(N))
    }), [
      u,
      v,
      o
    ]);
    return d && S && (D = {
      ...D
    }), w.useMemo(() => {
      v.forEach((N, q) => v.set(q, false));
    }, [
      u
    ]), w.useEffect(() => {
      !u && !v.size && o && o();
    }, [
      u
    ]), a = E.jsx(Z2, {
      pop: f === "popLayout",
      isPresent: u,
      anchorX: m,
      anchorY: y,
      root: p,
      children: a
    }), E.jsx(fu.Provider, {
      value: D,
      children: a
    });
  };
  function Q2() {
    return /* @__PURE__ */ new Map();
  }
  function cg(a = true) {
    const l = w.useContext(fu);
    if (l === null) return [
      true,
      null
    ];
    const { isPresent: u, onExitComplete: o, register: c } = l, d = w.useId();
    w.useEffect(() => {
      if (a) return c(d);
    }, [
      a
    ]);
    const f = w.useCallback(() => a && o && o(d), [
      d,
      o,
      a
    ]);
    return !u && o ? [
      false,
      f
    ] : [
      true
    ];
  }
  const Ks = (a) => a.key || "";
  function Sy(a) {
    const l = [];
    return w.Children.forEach(a, (u) => {
      w.isValidElement(u) && l.push(u);
    }), l;
  }
  const dl = ({ children: a, custom: l, initial: u = true, onExitComplete: o, presenceAffectsLayout: c = true, mode: d = "sync", propagate: f = false, anchorX: m = "left", anchorY: y = "top", root: p }) => {
    const [v, b] = cg(f), S = w.useMemo(() => Sy(a), [
      a
    ]), D = f && !v ? [] : S.map(Ks), N = w.useRef(true), q = w.useRef(S), Y = Rc(() => /* @__PURE__ */ new Map()), G = w.useRef(/* @__PURE__ */ new Set()), [K, X] = w.useState(S), [Z, $] = w.useState(S);
    Ly(() => {
      N.current = false, q.current = S;
      for (let J = 0; J < Z.length; J++) {
        const it = Ks(Z[J]);
        D.includes(it) ? (Y.delete(it), G.current.delete(it)) : Y.get(it) !== true && Y.set(it, false);
      }
    }, [
      Z,
      D.length,
      D.join("-")
    ]);
    const st = [];
    if (S !== K) {
      let J = [
        ...S
      ];
      for (let it = 0; it < Z.length; it++) {
        const tt = Z[it], ft = Ks(tt);
        D.includes(ft) || (J.splice(it, 0, tt), st.push(tt));
      }
      return d === "wait" && st.length && (J = st), $(Sy(J)), X(S), null;
    }
    const { forceRender: et } = w.useContext(zc);
    return E.jsx(E.Fragment, {
      children: Z.map((J) => {
        const it = Ks(J), tt = f && !v ? false : S === Z || D.includes(it), ft = () => {
          if (G.current.has(it)) return;
          if (Y.has(it)) G.current.add(it), Y.set(it, true);
          else return;
          let pt = true;
          Y.forEach((Ut) => {
            Ut || (pt = false);
          }), pt && (et == null ? void 0 : et(), $(q.current), f && (b == null ? void 0 : b()), o && o());
        };
        return E.jsx(K2, {
          isPresent: tt,
          initial: !N.current || u ? void 0 : false,
          custom: l,
          presenceAffectsLayout: c,
          mode: d,
          root: p,
          onExitComplete: tt ? void 0 : ft,
          anchorX: m,
          anchorY: y,
          children: J
        }, it);
      })
    });
  }, fg = w.createContext({
    strict: false
  }), xy = {
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
  let Ty = false;
  function J2() {
    if (Ty) return;
    const a = {};
    for (const l in xy) a[l] = {
      isEnabled: (u) => xy[l].some((o) => !!u[o])
    };
    q0(a), Ty = true;
  }
  function hg() {
    return J2(), wx();
  }
  function F2(a) {
    const l = hg();
    for (const u in a) l[u] = {
      ...l[u],
      ...a[u]
    };
    q0(l);
  }
  const P2 = /* @__PURE__ */ new Set([
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
  function cu(a) {
    return a.startsWith("while") || a.startsWith("drag") && a !== "draggable" || a.startsWith("layout") || a.startsWith("onTap") || a.startsWith("onPan") || a.startsWith("onLayout") || P2.has(a);
  }
  let dg = (a) => !cu(a);
  function W2(a) {
    typeof a == "function" && (dg = (l) => l.startsWith("on") ? !cu(l) : a(l));
  }
  try {
    W2(require("@emotion/is-prop-valid").default);
  } catch {
  }
  function $2(a, l, u) {
    const o = {};
    for (const c in a) c === "values" && typeof a.values == "object" || le(a[c]) || (dg(c) || u === true && cu(c) || !l && !cu(c) || a.draggable && c.startsWith("onDrag")) && (o[c] = a[c]);
    return o;
  }
  const mu = w.createContext({});
  function I2(a, l) {
    if (du(a)) {
      const { initial: u, animate: o } = a;
      return {
        initial: u === false || Sl(u) ? u : void 0,
        animate: Sl(o) ? o : void 0
      };
    }
    return a.inherit !== false ? l : {};
  }
  function tT(a) {
    const { initial: l, animate: u } = I2(a, w.useContext(mu));
    return w.useMemo(() => ({
      initial: l,
      animate: u
    }), [
      Ay(l),
      Ay(u)
    ]);
  }
  function Ay(a) {
    return Array.isArray(a) ? a.join(" ") : a;
  }
  const af = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {}
  });
  function mg(a, l, u) {
    for (const o in l) !le(l[o]) && !Q0(o, u) && (a[o] = l[o]);
  }
  function eT({ transformTemplate: a }, l) {
    return w.useMemo(() => {
      const u = af();
      return tf(u, l, a), Object.assign({}, u.vars, u.style);
    }, [
      l
    ]);
  }
  function nT(a, l) {
    const u = a.style || {}, o = {};
    return mg(o, u, a), Object.assign(o, eT(a, l)), o;
  }
  function aT(a, l) {
    const u = {}, o = nT(a, l);
    return a.drag && a.dragListener !== false && (u.draggable = false, o.userSelect = o.WebkitUserSelect = o.WebkitTouchCallout = "none", o.touchAction = a.drag === true ? "none" : `pan-${a.drag === "x" ? "y" : "x"}`), a.tabIndex === void 0 && (a.onTap || a.onTapStart || a.whileTap) && (u.tabIndex = 0), u.style = o, u;
  }
  const pg = () => ({
    ...af(),
    attrs: {}
  });
  function iT(a, l, u, o) {
    const c = w.useMemo(() => {
      const d = pg();
      return J0(d, l, P0(o), a.transformTemplate, a.style), {
        ...d.attrs,
        style: {
          ...d.style
        }
      };
    }, [
      l
    ]);
    if (a.style) {
      const d = {};
      mg(d, a.style, a), c.style = {
        ...d,
        ...c.style
      };
    }
    return c;
  }
  const lT = [
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
  function lf(a) {
    return typeof a != "string" || a.includes("-") ? false : !!(lT.indexOf(a) > -1 || /[A-Z]/u.test(a));
  }
  function sT(a, l, u, { latestValues: o }, c, d = false, f) {
    const y = (f ?? lf(a) ? iT : aT)(l, o, c, a), p = $2(l, typeof a == "string", d), v = a !== w.Fragment ? {
      ...p,
      ...y,
      ref: u
    } : {}, { children: b } = l, S = w.useMemo(() => le(b) ? b.get() : b, [
      b
    ]);
    return w.createElement(a, {
      ...v,
      children: S
    });
  }
  function uT({ scrapeMotionValuesFromProps: a, createRenderState: l }, u, o, c) {
    return {
      latestValues: oT(u, o, c, a),
      renderState: l()
    };
  }
  function oT(a, l, u, o) {
    const c = {}, d = o(a, {});
    for (const S in d) c[S] = eu(d[S]);
    let { initial: f, animate: m } = a;
    const y = du(a), p = L0(a);
    l && p && !y && a.inherit !== false && (f === void 0 && (f = l.initial), m === void 0 && (m = l.animate));
    let v = u ? u.initial === false : false;
    v = v || f === false;
    const b = v ? m : f;
    if (b && typeof b != "boolean" && !hu(b)) {
      const S = Array.isArray(b) ? b : [
        b
      ];
      for (let D = 0; D < S.length; D++) {
        const N = Kc(a, S[D]);
        if (N) {
          const { transitionEnd: q, transition: Y, ...G } = N;
          for (const K in G) {
            let X = G[K];
            if (Array.isArray(X)) {
              const Z = v ? X.length - 1 : 0;
              X = X[Z];
            }
            X !== null && (c[K] = X);
          }
          for (const K in q) c[K] = q[K];
        }
      }
    }
    return c;
  }
  const yg = (a) => (l, u) => {
    const o = w.useContext(mu), c = w.useContext(fu), d = () => uT(a, l, o, c);
    return u ? d() : Rc(d);
  }, rT = yg({
    scrapeMotionValuesFromProps: ef,
    createRenderState: af
  }), cT = yg({
    scrapeMotionValuesFromProps: W0,
    createRenderState: pg
  }), fT = Symbol.for("motionComponentSymbol");
  function hT(a, l, u) {
    const o = w.useRef(u);
    w.useInsertionEffect(() => {
      o.current = u;
    });
    const c = w.useRef(null);
    return w.useCallback((d) => {
      var _a;
      d && ((_a = a.onMount) == null ? void 0 : _a.call(a, d));
      const f = o.current;
      if (typeof f == "function") if (d) {
        const m = f(d);
        typeof m == "function" && (c.current = m);
      } else c.current ? (c.current(), c.current = null) : f(d);
      else f && (f.current = d);
      l && (d ? l.mount(d) : l.unmount());
    }, [
      l
    ]);
  }
  const gg = w.createContext({});
  function li(a) {
    return a && typeof a == "object" && Object.prototype.hasOwnProperty.call(a, "current");
  }
  function dT(a, l, u, o, c, d) {
    var _a, _b2;
    const { visualElement: f } = w.useContext(mu), m = w.useContext(fg), y = w.useContext(fu), p = w.useContext(nf), v = p.reducedMotion, b = p.skipAnimations, S = w.useRef(null), D = w.useRef(false);
    o = o || m.renderer, !S.current && o && (S.current = o(a, {
      visualState: l,
      parent: f,
      props: u,
      presenceContext: y,
      blockInitialAnimation: y ? y.initial === false : false,
      reducedMotionConfig: v,
      skipAnimations: b,
      isSVG: d
    }), D.current && S.current && (S.current.manuallyAnimateOnMount = true));
    const N = S.current, q = w.useContext(gg);
    N && !N.projection && c && (N.type === "html" || N.type === "svg") && mT(S.current, u, c, q);
    const Y = w.useRef(false);
    w.useInsertionEffect(() => {
      N && Y.current && N.update(u, y);
    });
    const G = u[M0], K = w.useRef(!!G && typeof window < "u" && !((_a = window.MotionHandoffIsComplete) == null ? void 0 : _a.call(window, G)) && ((_b2 = window.MotionHasOptimisedAnimation) == null ? void 0 : _b2.call(window, G)));
    return Ly(() => {
      D.current = true, N && (Y.current = true, window.MotionIsMounted = true, N.updateFeatures(), N.scheduleRenderMicrotask(), K.current && N.animationState && N.animationState.animateChanges());
    }), w.useEffect(() => {
      N && (!K.current && N.animationState && N.animationState.animateChanges(), K.current && (queueMicrotask(() => {
        var _a2;
        (_a2 = window.MotionHandoffMarkAsComplete) == null ? void 0 : _a2.call(window, G);
      }), K.current = false), N.enteringChildren = void 0);
    }), N;
  }
  function mT(a, l, u, o) {
    const { layoutId: c, layout: d, drag: f, dragConstraints: m, layoutScroll: y, layoutRoot: p, layoutCrossfade: v } = l;
    a.projection = new u(a.latestValues, l["data-framer-portal-id"] ? void 0 : vg(a.parent)), a.projection.setOptions({
      layoutId: c,
      layout: d,
      alwaysMeasureLayout: !!f || m && li(m),
      visualElement: a,
      animationType: typeof d == "string" ? d : "both",
      initialPromotionConfig: o,
      crossfade: v,
      layoutScroll: y,
      layoutRoot: p
    });
  }
  function vg(a) {
    if (a) return a.options.allowProjection !== false ? a.projection : vg(a.parent);
  }
  function Wr(a, { forwardMotionProps: l = false, type: u } = {}, o, c) {
    o && F2(o);
    const d = u ? u === "svg" : lf(a), f = d ? cT : rT;
    function m(p, v) {
      let b;
      const S = {
        ...w.useContext(nf),
        ...p,
        layoutId: pT(p)
      }, { isStatic: D } = S, N = tT(p), q = f(p, D);
      if (!D && typeof window < "u") {
        yT();
        const Y = gT(S);
        b = Y.MeasureLayout, N.visualElement = dT(a, q, S, c, Y.ProjectionNode, d);
      }
      return E.jsxs(mu.Provider, {
        value: N,
        children: [
          b && N.visualElement ? E.jsx(b, {
            visualElement: N.visualElement,
            ...S
          }) : null,
          sT(a, p, hT(q, N.visualElement, v), q, D, l, d)
        ]
      });
    }
    m.displayName = `motion.${typeof a == "string" ? a : `create(${a.displayName ?? a.name ?? ""})`}`;
    const y = w.forwardRef(m);
    return y[fT] = a, y;
  }
  function pT({ layoutId: a }) {
    const l = w.useContext(zc).id;
    return l && a !== void 0 ? l + "-" + a : a;
  }
  function yT(a, l) {
    w.useContext(fg).strict;
  }
  function gT(a) {
    const l = hg(), { drag: u, layout: o } = l;
    if (!u && !o) return {};
    const c = {
      ...u,
      ...o
    };
    return {
      MeasureLayout: (u == null ? void 0 : u.isEnabled(a)) || (o == null ? void 0 : o.isEnabled(a)) ? c.MeasureLayout : void 0,
      ProjectionNode: c.ProjectionNode
    };
  }
  function vT(a, l) {
    if (typeof Proxy > "u") return Wr;
    const u = /* @__PURE__ */ new Map(), o = (d, f) => Wr(d, f, a, l), c = (d, f) => o(d, f);
    return new Proxy(c, {
      get: (d, f) => f === "create" ? o : (u.has(f) || u.set(f, Wr(f, void 0, a, l)), u.get(f))
    });
  }
  const bT = (a, l) => l.isSVG ?? lf(a) ? new Wx(l) : new Zx(l, {
    allowProjection: a !== w.Fragment
  });
  class ST extends Fn {
    constructor(l) {
      super(l), l.animationState || (l.animationState = n2(l));
    }
    updateAnimationControlsSubscription() {
      const { animate: l } = this.node.getProps();
      hu(l) && (this.unmountControls = l.subscribe(this.node));
    }
    mount() {
      this.updateAnimationControlsSubscription();
    }
    update() {
      const { animate: l } = this.node.getProps(), { animate: u } = this.node.prevProps || {};
      l !== u && this.updateAnimationControlsSubscription();
    }
    unmount() {
      var _a;
      this.node.animationState.reset(), (_a = this.unmountControls) == null ? void 0 : _a.call(this);
    }
  }
  let xT = 0;
  class TT extends Fn {
    constructor() {
      super(...arguments), this.id = xT++, this.isExitComplete = false;
    }
    update() {
      var _a;
      if (!this.node.presenceContext) return;
      const { isPresent: l, onExitComplete: u } = this.node.presenceContext, { isPresent: o } = this.node.prevPresenceContext || {};
      if (!this.node.animationState || l === o) return;
      if (l && o === false) {
        if (this.isExitComplete) {
          const { initial: d, custom: f } = this.node.getProps();
          if (typeof d == "string") {
            const m = Sa(this.node, d, f);
            if (m) {
              const { transition: y, transitionEnd: p, ...v } = m;
              for (const b in v) (_a = this.node.getValue(b)) == null ? void 0 : _a.jump(v[b]);
            }
          }
          this.node.animationState.reset(), this.node.animationState.animateChanges();
        } else this.node.animationState.setActive("exit", false);
        this.isExitComplete = false;
        return;
      }
      const c = this.node.animationState.setActive("exit", !l);
      u && !l && c.then(() => {
        this.isExitComplete = true, u(this.id);
      });
    }
    mount() {
      const { register: l, onExitComplete: u } = this.node.presenceContext || {};
      u && u(this.id), l && (this.unmount = l(this.id));
    }
    unmount() {
    }
  }
  const AT = {
    animation: {
      Feature: ST
    },
    exit: {
      Feature: TT
    }
  };
  function Ml(a) {
    return {
      point: {
        x: a.pageX,
        y: a.pageY
      }
    };
  }
  const ET = (a) => (l) => Pc(l) && a(l, Ml(l));
  function gl(a, l, u, o) {
    return xl(a, l, ET(u), o);
  }
  const bg = ({ current: a }) => a ? a.ownerDocument.defaultView : null, Ey = (a, l) => Math.abs(a - l);
  function MT(a, l) {
    const u = Ey(a.x, l.x), o = Ey(a.y, l.y);
    return Math.sqrt(u ** 2 + o ** 2);
  }
  const My = /* @__PURE__ */ new Set([
    "auto",
    "scroll"
  ]);
  class Sg {
    constructor(l, u, { transformPagePoint: o, contextWindow: c = window, dragSnapToOrigin: d = false, distanceThreshold: f = 3, element: m } = {}) {
      if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (D) => {
        this.handleScroll(D.target);
      }, this.onWindowScroll = () => {
        this.handleScroll(window);
      }, this.updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        this.lastRawMoveEventInfo && (this.lastMoveEventInfo = Qs(this.lastRawMoveEventInfo, this.transformPagePoint));
        const D = $r(this.lastMoveEventInfo, this.history), N = this.startEvent !== null, q = MT(D.offset, {
          x: 0,
          y: 0
        }) >= this.distanceThreshold;
        if (!N && !q) return;
        const { point: Y } = D, { timestamp: G } = ie;
        this.history.push({
          ...Y,
          timestamp: G
        });
        const { onStart: K, onMove: X } = this.handlers;
        N || (K && K(this.lastMoveEvent, D), this.startEvent = this.lastMoveEvent), X && X(this.lastMoveEvent, D);
      }, this.handlePointerMove = (D, N) => {
        this.lastMoveEvent = D, this.lastRawMoveEventInfo = N, this.lastMoveEventInfo = Qs(N, this.transformPagePoint), Rt.update(this.updatePoint, true);
      }, this.handlePointerUp = (D, N) => {
        this.end();
        const { onEnd: q, onSessionEnd: Y, resumeAnimation: G } = this.handlers;
        if ((this.dragSnapToOrigin || !this.startEvent) && G && G(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
        const K = $r(D.type === "pointercancel" ? this.lastMoveEventInfo : Qs(N, this.transformPagePoint), this.history);
        this.startEvent && q && q(D, K), Y && Y(D, K);
      }, !Pc(l)) return;
      this.dragSnapToOrigin = d, this.handlers = u, this.transformPagePoint = o, this.distanceThreshold = f, this.contextWindow = c || window;
      const y = Ml(l), p = Qs(y, this.transformPagePoint), { point: v } = p, { timestamp: b } = ie;
      this.history = [
        {
          ...v,
          timestamp: b
        }
      ];
      const { onSessionStart: S } = u;
      S && S(l, $r(p, this.history)), this.removeListeners = Tl(gl(this.contextWindow, "pointermove", this.handlePointerMove), gl(this.contextWindow, "pointerup", this.handlePointerUp), gl(this.contextWindow, "pointercancel", this.handlePointerUp)), m && this.startScrollTracking(m);
    }
    startScrollTracking(l) {
      let u = l.parentElement;
      for (; u; ) {
        const o = getComputedStyle(u);
        (My.has(o.overflowX) || My.has(o.overflowY)) && this.scrollPositions.set(u, {
          x: u.scrollLeft,
          y: u.scrollTop
        }), u = u.parentElement;
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
    handleScroll(l) {
      const u = this.scrollPositions.get(l);
      if (!u) return;
      const o = l === window, c = o ? {
        x: window.scrollX,
        y: window.scrollY
      } : {
        x: l.scrollLeft,
        y: l.scrollTop
      }, d = {
        x: c.x - u.x,
        y: c.y - u.y
      };
      d.x === 0 && d.y === 0 || (o ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += d.x, this.lastMoveEventInfo.point.y += d.y) : this.history.length > 0 && (this.history[0].x -= d.x, this.history[0].y -= d.y), this.scrollPositions.set(l, c), Rt.update(this.updatePoint, true));
    }
    updateHandlers(l) {
      this.handlers = l;
    }
    end() {
      this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), Qn(this.updatePoint);
    }
  }
  function Qs(a, l) {
    return l ? {
      point: l(a.point)
    } : a;
  }
  function Cy(a, l) {
    return {
      x: a.x - l.x,
      y: a.y - l.y
    };
  }
  function $r({ point: a }, l) {
    return {
      point: a,
      delta: Cy(a, xg(l)),
      offset: Cy(a, CT(l)),
      velocity: DT(l, 0.1)
    };
  }
  function CT(a) {
    return a[0];
  }
  function xg(a) {
    return a[a.length - 1];
  }
  function DT(a, l) {
    if (a.length < 2) return {
      x: 0,
      y: 0
    };
    let u = a.length - 1, o = null;
    const c = xg(a);
    for (; u >= 0 && (o = a[u], !(c.timestamp - o.timestamp > ze(l))); ) u--;
    if (!o) return {
      x: 0,
      y: 0
    };
    o === a[0] && a.length > 2 && c.timestamp - o.timestamp > ze(l) * 2 && (o = a[1]);
    const d = He(c.timestamp - o.timestamp);
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
  function zT(a, { min: l, max: u }, o) {
    return l !== void 0 && a < l ? a = o ? Bt(l, a, o.min) : Math.max(a, l) : u !== void 0 && a > u && (a = o ? Bt(u, a, o.max) : Math.min(a, u)), a;
  }
  function Dy(a, l, u) {
    return {
      min: l !== void 0 ? a.min + l : void 0,
      max: u !== void 0 ? a.max + u - (a.max - a.min) : void 0
    };
  }
  function RT(a, { top: l, left: u, bottom: o, right: c }) {
    return {
      x: Dy(a.x, u, c),
      y: Dy(a.y, l, o)
    };
  }
  function zy(a, l) {
    let u = l.min - a.min, o = l.max - a.max;
    return l.max - l.min < a.max - a.min && ([u, o] = [
      o,
      u
    ]), {
      min: u,
      max: o
    };
  }
  function jT(a, l) {
    return {
      x: zy(a.x, l.x),
      y: zy(a.y, l.y)
    };
  }
  function OT(a, l) {
    let u = 0.5;
    const o = ce(a), c = ce(l);
    return c > o ? u = vl(l.min, l.max - o, a.min) : o > c && (u = vl(a.min, a.max - c, l.min)), Ie(0, 1, u);
  }
  function NT(a, l) {
    const u = {};
    return l.min !== void 0 && (u.min = l.min - a.min), l.max !== void 0 && (u.max = l.max - a.min), u;
  }
  const Ec = 0.35;
  function _T(a = Ec) {
    return a === false ? a = 0 : a === true && (a = Ec), {
      x: Ry(a, "left", "right"),
      y: Ry(a, "top", "bottom")
    };
  }
  function Ry(a, l, u) {
    return {
      min: jy(a, l),
      max: jy(a, u)
    };
  }
  function jy(a, l) {
    return typeof a == "number" ? a : a[l] || 0;
  }
  const wT = /* @__PURE__ */ new WeakMap();
  class VT {
    constructor(l) {
      this.openDragLock = null, this.isDragging = false, this.currentDirection = null, this.originPoint = {
        x: 0,
        y: 0
      }, this.constraints = false, this.hasMutatedConstraints = false, this.elastic = Pt(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = l;
    }
    start(l, { snapToCursor: u = false, distanceThreshold: o } = {}) {
      const { presenceContext: c } = this.visualElement;
      if (c && c.isPresent === false) return;
      const d = (b) => {
        u && this.snapToCursor(Ml(b).point), this.stopAnimation();
      }, f = (b, S) => {
        const { drag: D, dragPropagation: N, onDragStart: q } = this.getProps();
        if (D && !N && (this.openDragLock && this.openDragLock(), this.openDragLock = cx(D), !this.openDragLock)) return;
        this.latestPointerEvent = b, this.latestPanInfo = S, this.isDragging = true, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = true, this.visualElement.projection.target = void 0), We((G) => {
          let K = this.getAxisMotionValue(G).get() || 0;
          if ($e.test(K)) {
            const { projection: X } = this.visualElement;
            if (X && X.layout) {
              const Z = X.layout.layoutBox[G];
              Z && (K = ce(Z) * (parseFloat(K) / 100));
            }
          }
          this.originPoint[G] = K;
        }), q && Rt.update(() => q(b, S), false, true), pc(this.visualElement, "transform");
        const { animationState: Y } = this.visualElement;
        Y && Y.setActive("whileDrag", true);
      }, m = (b, S) => {
        this.latestPointerEvent = b, this.latestPanInfo = S;
        const { dragPropagation: D, dragDirectionLock: N, onDirectionLock: q, onDrag: Y } = this.getProps();
        if (!D && !this.openDragLock) return;
        const { offset: G } = S;
        if (N && this.currentDirection === null) {
          this.currentDirection = BT(G), this.currentDirection !== null && q && q(this.currentDirection);
          return;
        }
        this.updateAxis("x", S.point, G), this.updateAxis("y", S.point, G), this.visualElement.render(), Y && Rt.update(() => Y(b, S), false, true);
      }, y = (b, S) => {
        this.latestPointerEvent = b, this.latestPanInfo = S, this.stop(b, S), this.latestPointerEvent = null, this.latestPanInfo = null;
      }, p = () => {
        const { dragSnapToOrigin: b } = this.getProps();
        (b || this.constraints) && this.startAnimation({
          x: 0,
          y: 0
        });
      }, { dragSnapToOrigin: v } = this.getProps();
      this.panSession = new Sg(l, {
        onSessionStart: d,
        onStart: f,
        onMove: m,
        onSessionEnd: y,
        resumeAnimation: p
      }, {
        transformPagePoint: this.visualElement.getTransformPagePoint(),
        dragSnapToOrigin: v,
        distanceThreshold: o,
        contextWindow: bg(this.visualElement),
        element: this.visualElement.current
      });
    }
    stop(l, u) {
      const o = l || this.latestPointerEvent, c = u || this.latestPanInfo, d = this.isDragging;
      if (this.cancel(), !d || !c || !o) return;
      const { velocity: f } = c;
      this.startAnimation(f);
      const { onDragEnd: m } = this.getProps();
      m && Rt.postRender(() => m(o, c));
    }
    cancel() {
      this.isDragging = false;
      const { projection: l, animationState: u } = this.visualElement;
      l && (l.isAnimationBlocked = false), this.endPanSession();
      const { dragPropagation: o } = this.getProps();
      !o && this.openDragLock && (this.openDragLock(), this.openDragLock = null), u && u.setActive("whileDrag", false);
    }
    endPanSession() {
      this.panSession && this.panSession.end(), this.panSession = void 0;
    }
    updateAxis(l, u, o) {
      const { drag: c } = this.getProps();
      if (!o || !Js(l, c, this.currentDirection)) return;
      const d = this.getAxisMotionValue(l);
      let f = this.originPoint[l] + o[l];
      this.constraints && this.constraints[l] && (f = zT(f, this.constraints[l], this.elastic[l])), d.set(f);
    }
    resolveConstraints() {
      var _a;
      const { dragConstraints: l, dragElastic: u } = this.getProps(), o = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : (_a = this.visualElement.projection) == null ? void 0 : _a.layout, c = this.constraints;
      l && li(l) ? this.constraints || (this.constraints = this.resolveRefConstraints()) : l && o ? this.constraints = RT(o.layoutBox, l) : this.constraints = false, this.elastic = _T(u), c !== this.constraints && !li(l) && o && this.constraints && !this.hasMutatedConstraints && We((d) => {
        this.constraints !== false && this.getAxisMotionValue(d) && (this.constraints[d] = NT(o.layoutBox[d], this.constraints[d]));
      });
    }
    resolveRefConstraints() {
      const { dragConstraints: l, onMeasureDragConstraints: u } = this.getProps();
      if (!l || !li(l)) return false;
      const o = l.current, { projection: c } = this.visualElement;
      if (!c || !c.layout) return false;
      const d = Hx(o, c.root, this.visualElement.getTransformPagePoint());
      let f = jT(c.layout.layoutBox, d);
      if (u) {
        const m = u(Ux(f));
        this.hasMutatedConstraints = !!m, m && (f = G0(m));
      }
      return f;
    }
    startAnimation(l) {
      const { drag: u, dragMomentum: o, dragElastic: c, dragTransition: d, dragSnapToOrigin: f, onDragTransitionEnd: m } = this.getProps(), y = this.constraints || {}, p = We((v) => {
        if (!Js(v, u, this.currentDirection)) return;
        let b = y && y[v] || {};
        (f === true || f === v) && (b = {
          min: 0,
          max: 0
        });
        const S = c ? 200 : 1e6, D = c ? 40 : 1e7, N = {
          type: "inertia",
          velocity: o ? l[v] : 0,
          bounceStiffness: S,
          bounceDamping: D,
          timeConstant: 750,
          restDelta: 1,
          restSpeed: 10,
          ...d,
          ...b
        };
        return this.startAxisValueAnimation(v, N);
      });
      return Promise.all(p).then(m);
    }
    startAxisValueAnimation(l, u) {
      const o = this.getAxisMotionValue(l);
      return pc(this.visualElement, l), o.start(Zc(l, o, 0, u, this.visualElement, false));
    }
    stopAnimation() {
      We((l) => this.getAxisMotionValue(l).stop());
    }
    getAxisMotionValue(l) {
      const u = `_drag${l.toUpperCase()}`, o = this.visualElement.getProps(), c = o[u];
      return c || this.visualElement.getValue(l, (o.initial ? o.initial[l] : void 0) || 0);
    }
    snapToCursor(l) {
      We((u) => {
        const { drag: o } = this.getProps();
        if (!Js(u, o, this.currentDirection)) return;
        const { projection: c } = this.visualElement, d = this.getAxisMotionValue(u);
        if (c && c.layout) {
          const { min: f, max: m } = c.layout.layoutBox[u], y = d.get() || 0;
          d.set(l[u] - Bt(f, m, 0.5) + y);
        }
      });
    }
    scalePositionWithinConstraints() {
      if (!this.visualElement.current) return;
      const { drag: l, dragConstraints: u } = this.getProps(), { projection: o } = this.visualElement;
      if (!li(u) || !o || !this.constraints) return;
      this.stopAnimation();
      const c = {
        x: 0,
        y: 0
      };
      We((f) => {
        const m = this.getAxisMotionValue(f);
        if (m && this.constraints !== false) {
          const y = m.get();
          c[f] = OT({
            min: y,
            max: y
          }, this.constraints[f]);
        }
      });
      const { transformTemplate: d } = this.visualElement.getProps();
      this.visualElement.current.style.transform = d ? d({}, "") : "none", o.root && o.root.updateScroll(), o.updateLayout(), this.constraints = false, this.resolveConstraints(), We((f) => {
        if (!Js(f, l, null)) return;
        const m = this.getAxisMotionValue(f), { min: y, max: p } = this.constraints[f];
        m.set(Bt(y, p, c[f]));
      }), this.visualElement.render();
    }
    addListeners() {
      if (!this.visualElement.current) return;
      wT.set(this.visualElement, this);
      const l = this.visualElement.current, u = gl(l, "pointerdown", (p) => {
        const { drag: v, dragListener: b = true } = this.getProps(), S = p.target, D = S !== l && yx(S);
        v && b && !D && this.start(p);
      });
      let o;
      const c = () => {
        const { dragConstraints: p } = this.getProps();
        li(p) && p.current && (this.constraints = this.resolveRefConstraints(), o || (o = UT(l, p.current, () => this.scalePositionWithinConstraints())));
      }, { projection: d } = this.visualElement, f = d.addEventListener("measure", c);
      d && !d.layout && (d.root && d.root.updateScroll(), d.updateLayout()), Rt.read(c);
      const m = xl(window, "resize", () => this.scalePositionWithinConstraints()), y = d.addEventListener("didUpdate", (({ delta: p, hasLayoutChanged: v }) => {
        this.isDragging && v && (We((b) => {
          const S = this.getAxisMotionValue(b);
          S && (this.originPoint[b] += p[b].translate, S.set(S.get() + p[b].translate));
        }), this.visualElement.render());
      }));
      return () => {
        m(), u(), f(), y && y(), o && o();
      };
    }
    getProps() {
      const l = this.visualElement.getProps(), { drag: u = false, dragDirectionLock: o = false, dragPropagation: c = false, dragConstraints: d = false, dragElastic: f = Ec, dragMomentum: m = true } = l;
      return {
        ...l,
        drag: u,
        dragDirectionLock: o,
        dragPropagation: c,
        dragConstraints: d,
        dragElastic: f,
        dragMomentum: m
      };
    }
  }
  function Oy(a) {
    let l = true;
    return () => {
      if (l) {
        l = false;
        return;
      }
      a();
    };
  }
  function UT(a, l, u) {
    const o = Lp(a, Oy(u)), c = Lp(l, Oy(u));
    return () => {
      o(), c();
    };
  }
  function Js(a, l, u) {
    return (l === true || l === a) && (u === null || u === a);
  }
  function BT(a, l = 10) {
    let u = null;
    return Math.abs(a.y) > l ? u = "y" : Math.abs(a.x) > l && (u = "x"), u;
  }
  class LT extends Fn {
    constructor(l) {
      super(l), this.removeGroupControls = qe, this.removeListeners = qe, this.controls = new VT(l);
    }
    mount() {
      const { dragControls: l } = this.node.getProps();
      l && (this.removeGroupControls = l.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || qe;
    }
    update() {
      const { dragControls: l } = this.node.getProps(), { dragControls: u } = this.node.prevProps || {};
      l !== u && (this.removeGroupControls(), l && (this.removeGroupControls = l.subscribe(this.controls)));
    }
    unmount() {
      this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
    }
  }
  const Ir = (a) => (l, u) => {
    a && Rt.update(() => a(l, u), false, true);
  };
  class HT extends Fn {
    constructor() {
      super(...arguments), this.removePointerDownListener = qe;
    }
    onPointerDown(l) {
      this.session = new Sg(l, this.createPanHandlers(), {
        transformPagePoint: this.node.getTransformPagePoint(),
        contextWindow: bg(this.node)
      });
    }
    createPanHandlers() {
      const { onPanSessionStart: l, onPanStart: u, onPan: o, onPanEnd: c } = this.node.getProps();
      return {
        onSessionStart: Ir(l),
        onStart: Ir(u),
        onMove: Ir(o),
        onEnd: (d, f) => {
          delete this.session, c && Rt.postRender(() => c(d, f));
        }
      };
    }
    mount() {
      this.removePointerDownListener = gl(this.node.current, "pointerdown", (l) => this.onPointerDown(l));
    }
    update() {
      this.session && this.session.updateHandlers(this.createPanHandlers());
    }
    unmount() {
      this.removePointerDownListener(), this.session && this.session.end();
    }
  }
  let tc = false;
  class qT extends w.Component {
    componentDidMount() {
      const { visualElement: l, layoutGroup: u, switchLayoutGroup: o, layoutId: c } = this.props, { projection: d } = l;
      d && (u.group && u.group.add(d), o && o.register && c && o.register(d), tc && d.root.didUpdate(), d.addEventListener("animationComplete", () => {
        this.safeToRemove();
      }), d.setOptions({
        ...d.options,
        layoutDependency: this.props.layoutDependency,
        onExitComplete: () => this.safeToRemove()
      })), nu.hasEverUpdated = true;
    }
    getSnapshotBeforeUpdate(l) {
      const { layoutDependency: u, visualElement: o, drag: c, isPresent: d } = this.props, { projection: f } = o;
      return f && (f.isPresent = d, l.layoutDependency !== u && f.setOptions({
        ...f.options,
        layoutDependency: u
      }), tc = true, c || l.layoutDependency !== u || u === void 0 || l.isPresent !== d ? f.willUpdate() : this.safeToRemove(), l.isPresent !== d && (d ? f.promote() : f.relegate() || Rt.postRender(() => {
        const m = f.getStack();
        (!m || !m.members.length) && this.safeToRemove();
      }))), null;
    }
    componentDidUpdate() {
      const { projection: l } = this.props.visualElement;
      l && (l.root.didUpdate(), Fc.postRender(() => {
        !l.currentAnimation && l.isLead() && this.safeToRemove();
      }));
    }
    componentWillUnmount() {
      const { visualElement: l, layoutGroup: u, switchLayoutGroup: o } = this.props, { projection: c } = l;
      tc = true, c && (c.scheduleCheckAfterUnmount(), u && u.group && u.group.remove(c), o && o.deregister && o.deregister(c));
    }
    safeToRemove() {
      const { safeToRemove: l } = this.props;
      l && l();
    }
    render() {
      return null;
    }
  }
  function Tg(a) {
    const [l, u] = cg(), o = w.useContext(zc);
    return E.jsx(qT, {
      ...a,
      layoutGroup: o,
      switchLayoutGroup: w.useContext(gg),
      isPresent: l,
      safeToRemove: u
    });
  }
  const YT = {
    pan: {
      Feature: HT
    },
    drag: {
      Feature: LT,
      ProjectionNode: rg,
      MeasureLayout: Tg
    }
  };
  function Ny(a, l, u) {
    const { props: o } = a;
    a.animationState && o.whileHover && a.animationState.setActive("whileHover", u === "Start");
    const c = "onHover" + u, d = o[c];
    d && Rt.postRender(() => d(l, Ml(l)));
  }
  class GT extends Fn {
    mount() {
      const { current: l } = this.node;
      l && (this.unmount = hx(l, (u, o) => (Ny(this.node, o, "Start"), (c) => Ny(this.node, c, "End"))));
    }
    unmount() {
    }
  }
  class XT extends Fn {
    constructor() {
      super(...arguments), this.isActive = false;
    }
    onFocus() {
      let l = false;
      try {
        l = this.node.current.matches(":focus-visible");
      } catch {
        l = true;
      }
      !l || !this.node.animationState || (this.node.animationState.setActive("whileFocus", true), this.isActive = true);
    }
    onBlur() {
      !this.isActive || !this.node.animationState || (this.node.animationState.setActive("whileFocus", false), this.isActive = false);
    }
    mount() {
      this.unmount = Tl(xl(this.node.current, "focus", () => this.onFocus()), xl(this.node.current, "blur", () => this.onBlur()));
    }
    unmount() {
    }
  }
  function _y(a, l, u) {
    const { props: o } = a;
    if (a.current instanceof HTMLButtonElement && a.current.disabled) return;
    a.animationState && o.whileTap && a.animationState.setActive("whileTap", u === "Start");
    const c = "onTap" + (u === "End" ? "" : u), d = o[c];
    d && Rt.postRender(() => d(l, Ml(l)));
  }
  class kT extends Fn {
    mount() {
      const { current: l } = this.node;
      if (!l) return;
      const { globalTapTarget: u, propagate: o } = this.node.props;
      this.unmount = vx(l, (c, d) => (_y(this.node, d, "Start"), (f, { success: m }) => _y(this.node, f, m ? "End" : "Cancel")), {
        useGlobalTarget: u,
        stopPropagation: (o == null ? void 0 : o.tap) === false
      });
    }
    unmount() {
    }
  }
  const Mc = /* @__PURE__ */ new WeakMap(), ec = /* @__PURE__ */ new WeakMap(), ZT = (a) => {
    const l = Mc.get(a.target);
    l && l(a);
  }, KT = (a) => {
    a.forEach(ZT);
  };
  function QT({ root: a, ...l }) {
    const u = a || document;
    ec.has(u) || ec.set(u, {});
    const o = ec.get(u), c = JSON.stringify(l);
    return o[c] || (o[c] = new IntersectionObserver(KT, {
      root: a,
      ...l
    })), o[c];
  }
  function JT(a, l, u) {
    const o = QT(l);
    return Mc.set(a, u), o.observe(a), () => {
      Mc.delete(a), o.unobserve(a);
    };
  }
  const FT = {
    some: 0,
    all: 1
  };
  class PT extends Fn {
    constructor() {
      super(...arguments), this.hasEnteredView = false, this.isInView = false;
    }
    startObserver() {
      this.unmount();
      const { viewport: l = {} } = this.node.getProps(), { root: u, margin: o, amount: c = "some", once: d } = l, f = {
        root: u ? u.current : void 0,
        rootMargin: o,
        threshold: typeof c == "number" ? c : FT[c]
      }, m = (y) => {
        const { isIntersecting: p } = y;
        if (this.isInView === p || (this.isInView = p, d && !p && this.hasEnteredView)) return;
        p && (this.hasEnteredView = true), this.node.animationState && this.node.animationState.setActive("whileInView", p);
        const { onViewportEnter: v, onViewportLeave: b } = this.node.getProps(), S = p ? v : b;
        S && S(y);
      };
      return JT(this.node.current, f, m);
    }
    mount() {
      this.startObserver();
    }
    update() {
      if (typeof IntersectionObserver > "u") return;
      const { props: l, prevProps: u } = this.node;
      [
        "amount",
        "margin",
        "root"
      ].some(WT(l, u)) && this.startObserver();
    }
    unmount() {
    }
  }
  function WT({ viewport: a = {} }, { viewport: l = {} } = {}) {
    return (u) => a[u] !== l[u];
  }
  const $T = {
    inView: {
      Feature: PT
    },
    tap: {
      Feature: kT
    },
    focus: {
      Feature: XT
    },
    hover: {
      Feature: GT
    }
  }, IT = {
    layout: {
      ProjectionNode: rg,
      MeasureLayout: Tg
    }
  }, tA = {
    ...AT,
    ...$T,
    ...YT,
    ...IT
  }, Jn = vT(tA, bT), eA = "modulepreload", nA = function(a) {
    return "/" + a;
  }, wy = {}, aA = function(l, u, o) {
    let c = Promise.resolve();
    if (u && u.length > 0) {
      let f = function(p) {
        return Promise.all(p.map((v) => Promise.resolve(v).then((b) => ({
          status: "fulfilled",
          value: b
        }), (b) => ({
          status: "rejected",
          reason: b
        }))));
      };
      document.getElementsByTagName("link");
      const m = document.querySelector("meta[property=csp-nonce]"), y = (m == null ? void 0 : m.nonce) || (m == null ? void 0 : m.getAttribute("nonce"));
      c = f(u.map((p) => {
        if (p = nA(p), p in wy) return;
        wy[p] = true;
        const v = p.endsWith(".css"), b = v ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${p}"]${b}`)) return;
        const S = document.createElement("link");
        if (S.rel = v ? "stylesheet" : eA, v || (S.as = "script"), S.crossOrigin = "", S.href = p, y && S.setAttribute("nonce", y), document.head.appendChild(S), v) return new Promise((D, N) => {
          S.addEventListener("load", D), S.addEventListener("error", () => N(new Error(`Unable to preload CSS for ${p}`)));
        });
      }));
    }
    function d(f) {
      const m = new Event("vite:preloadError", {
        cancelable: true
      });
      if (m.payload = f, window.dispatchEvent(m), !m.defaultPrevented) throw f;
    }
    return c.then((f) => {
      for (const m of f || []) m.status === "rejected" && d(m.reason);
      return l().catch(d);
    });
  };
  function iA(a) {
    const l = w.useRef(null), u = w.useRef(false), o = w.useRef(null), [c, d] = w.useState({
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
      const x = l.current;
      if (!x) return;
      const O = x.history_labels().split("|").map((L, k) => {
        const F = L.indexOf(":");
        return {
          type: L.slice(0, F),
          label: L.slice(F + 1),
          index: k
        };
      });
      d({
        ready: true,
        hasSource: x.has_source(),
        sourcePos: o.current,
        undoCount: x.undo_count(),
        redoCount: x.redo_count(),
        history: O,
        zoom: x.get_zoom(),
        width: x.width(),
        height: x.height()
      });
    }, []), m = w.useCallback(() => {
      const x = l.current, O = a.current;
      if (!x || !O) return;
      (O.width !== x.width() || O.height !== x.height()) && (O.width = x.width(), O.height = x.height()), O.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(x.get_image_data()), x.width(), x.height()), 0, 0);
    }, [
      a
    ]), y = w.useCallback((x) => {
      const O = a.current;
      if (!O) return {
        x: 0,
        y: 0
      };
      const L = O.getBoundingClientRect();
      return {
        x: Math.floor((x.clientX - L.left) * O.width / L.width),
        y: Math.floor((x.clientY - L.top) * O.height / L.height)
      };
    }, [
      a
    ]), p = w.useCallback(async (x) => {
      const { default: O, CloneStampTool: L } = await aA(async () => {
        const { default: A, CloneStampTool: B } = await import("./stamp_tool-C7ZbhIfs.js");
        return {
          default: A,
          CloneStampTool: B
        };
      }, []);
      await O();
      const k = URL.createObjectURL(x), F = new Image();
      F.onload = () => {
        const A = a.current;
        if (!A) return;
        A.width = F.width, A.height = F.height;
        const B = A.getContext("2d");
        B.drawImage(F, 0, 0);
        const Q = B.getImageData(0, 0, F.width, F.height), P = new L(F.width, F.height);
        P.load_image(new Uint8Array(Q.data)), l.current = P, o.current = null, URL.revokeObjectURL(k), f();
      }, F.src = k;
    }, [
      a,
      f
    ]), v = w.useCallback((x) => {
      var _a;
      (_a = l.current) == null ? void 0 : _a.set_brush_size(x);
    }, []), b = w.useCallback((x) => {
      var _a;
      (_a = l.current) == null ? void 0 : _a.set_hardness(x);
    }, []), S = w.useCallback((x) => {
      var _a;
      (_a = l.current) == null ? void 0 : _a.set_opacity(x);
    }, []), D = w.useCallback((x) => {
      var _a;
      (_a = l.current) == null ? void 0 : _a.set_spacing(x);
    }, []), N = w.useCallback(() => {
      var _a;
      ((_a = l.current) == null ? void 0 : _a.undo()) && (m(), f());
    }, [
      m,
      f
    ]), q = w.useCallback(() => {
      var _a;
      ((_a = l.current) == null ? void 0 : _a.redo()) && (m(), f());
    }, [
      m,
      f
    ]), Y = w.useCallback((x) => {
      var _a;
      ((_a = l.current) == null ? void 0 : _a.jump_to_history(x)) && (m(), f());
    }, [
      m,
      f
    ]), G = w.useCallback((x) => {
      var _a;
      ((_a = l.current) == null ? void 0 : _a.delete_history_entry(x)) && (m(), f());
    }, [
      m,
      f
    ]), K = w.useCallback(() => {
      var _a;
      (_a = l.current) == null ? void 0 : _a.clear_history(), f();
    }, [
      f
    ]), X = w.useCallback(() => {
      const x = l.current;
      if (!x) return;
      const O = x.export_png(), L = new Blob([
        new Uint8Array(O)
      ], {
        type: "image/png"
      }), k = URL.createObjectURL(L), F = document.createElement("a");
      F.href = k, F.download = "stamp-result.png", F.click(), URL.revokeObjectURL(k);
    }, []), Z = w.useCallback((x) => {
      const O = l.current;
      if (!O) return;
      const { x: L, y: k } = y(x);
      if (x.altKey) {
        O.set_source(L, k), o.current = {
          x: L,
          y: k
        }, f();
        return;
      }
      O.has_source() && (u.current = true, O.begin_stroke(L, k), m());
    }, [
      y,
      m,
      f
    ]), $ = w.useCallback((x) => {
      if (!u.current) return;
      const O = l.current;
      if (!O) return;
      const { x: L, y: k } = y(x);
      O.continue_stroke(L, k), m();
    }, [
      y,
      m
    ]), st = w.useCallback(() => {
      var _a;
      u.current && (u.current = false, (_a = l.current) == null ? void 0 : _a.end_stroke(), f());
    }, [
      f
    ]);
    w.useEffect(() => {
      const x = a.current, O = (x == null ? void 0 : x.parentElement) ?? x;
      if (!O) return;
      const L = (k) => {
        !k.altKey || !l.current || (k.preventDefault(), l.current.adjust_zoom(k.deltaY < 0 ? 1 : -1), f());
      };
      return O.addEventListener("wheel", L, {
        passive: false
      }), () => O.removeEventListener("wheel", L);
    }, [
      a,
      f
    ]), w.useEffect(() => {
      const x = (O) => {
        (O.metaKey || O.ctrlKey) && O.key === "z" && (O.shiftKey ? q() : N());
      };
      return window.addEventListener("keydown", x), () => window.removeEventListener("keydown", x);
    }, [
      N,
      q
    ]);
    const et = w.useCallback((x) => {
      const O = l.current;
      if (!O) return null;
      const L = O.thumbnail_width(x), k = O.thumbnail_height(x), F = O.thumbnail_data(x);
      return {
        data: new Uint8ClampedArray(F),
        width: L,
        height: k
      };
    }, []), J = w.useCallback((x) => new Promise((O) => {
      const L = et(x);
      if (!L) return O(null);
      const k = new OffscreenCanvas(L.width, L.height);
      k.getContext("2d").putImageData(new ImageData(L.data, L.width, L.height), 0, 0), k.convertToBlob({
        type: "image/jpeg",
        quality: 0.82
      }).then((A) => {
        O(URL.createObjectURL(A));
      });
    }), [
      et
    ]), it = w.useCallback((x, O, L, k) => {
      const F = l.current;
      return F ? new Uint8ClampedArray(F.copy_region(x, O, L, k)) : null;
    }, []), tt = w.useCallback((x, O, L, k, F) => {
      const A = l.current;
      A && (A.paste_region(new Uint8Array(x.buffer), O, L, k, F), m(), f());
    }, [
      m,
      f
    ]), ft = w.useCallback(() => {
      const x = l.current;
      x && (x.flip_horizontal(), o.current && (o.current = {
        x: x.width() - 1 - o.current.x,
        y: o.current.y
      }), m(), f());
    }, [
      m,
      f
    ]), pt = w.useCallback(() => {
      const x = l.current;
      x && (x.flip_vertical(), o.current && (o.current = {
        x: o.current.x,
        y: x.height() - 1 - o.current.y
      }), m(), f());
    }, [
      m,
      f
    ]), Ut = w.useCallback(() => {
      const x = l.current;
      x && (x.rotate_90_cw(), o.current = null, m(), f());
    }, [
      m,
      f
    ]), _t = w.useCallback((x) => {
      const O = l.current;
      O && (O.adjust_brightness(x), m(), f());
    }, [
      m,
      f
    ]), jt = w.useCallback((x) => {
      const O = l.current;
      O && (O.adjust_contrast(x), m(), f());
    }, [
      m,
      f
    ]);
    return {
      state: c,
      toolRef: l,
      loadImage: p,
      setBrushSize: v,
      setHardness: b,
      setOpacity: S,
      setSpacing: D,
      undo: N,
      redo: q,
      jumpToHistory: Y,
      deleteHistoryEntry: G,
      clearHistory: K,
      exportPng: X,
      onMouseDown: Z,
      onMouseMove: $,
      onMouseUp: st,
      generateThumbnail: et,
      generateThumbnailUrl: J,
      copyRegion: it,
      pasteRegion: tt,
      flipHorizontal: ft,
      flipVertical: pt,
      rotate90Cw: Ut,
      adjustBrightness: _t,
      adjustContrast: jt
    };
  }
  function lA(a, l, u) {
    const [o, c] = w.useState({
      x: -999,
      y: -999
    }), [d, f] = w.useState(false), m = w.useRef(null);
    w.useEffect(() => {
      const D = (N) => {
        c({
          x: N.clientX,
          y: N.clientY
        });
      };
      return window.addEventListener("mousemove", D), () => window.removeEventListener("mousemove", D);
    }, []);
    const y = w.useCallback((D) => {
      m.current = D, f(true);
    }, []), p = w.useCallback(() => f(false), []);
    let v = a * 2;
    const b = u.current, S = m.current;
    if (b && S && b.width > 0) {
      const D = S.width / b.width;
      v = a * 2 * D;
    }
    return {
      pos: o,
      visible: d,
      diameter: v,
      onCanvasEnter: y,
      onCanvasLeave: p
    };
  }
  const sA = {
    hidden: {
      x: "-100%",
      opacity: 0
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200
      }
    },
    exit: {
      x: "-100%",
      opacity: 0,
      transition: {
        duration: 0.2
      }
    }
  }, uA = {
    hidden: {
      y: "-100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200
      }
    },
    exit: {
      y: "-100%",
      opacity: 0,
      transition: {
        duration: 0.2
      }
    }
  }, oA = {
    hidden: {
      y: "100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 400
      }
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  }, rA = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.15
      }
    }
  };
  const Ag = (...a) => a.filter((l, u, o) => !!l && l.trim() !== "" && o.indexOf(l) === u).join(" ").trim();
  const cA = (a) => a.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const fA = (a) => a.replace(/^([A-Z])|[\s-_]+(\w)/g, (l, u, o) => o ? o.toUpperCase() : u.toLowerCase());
  const Vy = (a) => {
    const l = fA(a);
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  var hA = {
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
  const dA = (a) => {
    for (const l in a) if (l.startsWith("aria-") || l === "role" || l === "title") return true;
    return false;
  };
  const mA = w.forwardRef(({ color: a = "currentColor", size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: o, className: c = "", children: d, iconNode: f, ...m }, y) => w.createElement("svg", {
    ref: y,
    ...hA,
    width: l,
    height: l,
    stroke: a,
    strokeWidth: o ? Number(u) * 24 / Number(l) : u,
    className: Ag("lucide", c),
    ...!d && !dA(m) && {
      "aria-hidden": "true"
    },
    ...m
  }, [
    ...f.map(([p, v]) => w.createElement(p, v)),
    ...Array.isArray(d) ? d : [
      d
    ]
  ]));
  const Vt = (a, l) => {
    const u = w.forwardRef(({ className: o, ...c }, d) => w.createElement(mA, {
      ref: d,
      iconNode: l,
      className: Ag(`lucide-${cA(Vy(a))}`, `lucide-${a}`, o),
      ...c
    }));
    return u.displayName = Vy(a), u;
  };
  const pA = [
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
  ], yA = Vt("arrow-up-right", pA);
  const gA = [
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
  ], vA = Vt("contrast", gA);
  const bA = [
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
  ], SA = Vt("crop", bA);
  const xA = [
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
  ], TA = Vt("download", xA);
  const AA = [
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
  ], EA = Vt("droplets", AA);
  const MA = [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
        key: "usdka0"
      }
    ]
  ], CA = Vt("folder-open", MA);
  const DA = [
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
  ], zA = Vt("history", DA);
  const RA = [
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
  ], jA = Vt("image", RA);
  const OA = [
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
  ], NA = Vt("paintbrush", OA);
  const _A = [
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
  ], wA = Vt("redo", _A);
  const VA = [
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
  ], UA = Vt("rotate-cw", VA);
  const BA = [
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
  ], LA = Vt("shapes", BA);
  const HA = [
    [
      "path",
      {
        d: "M10 5H3",
        key: "1qgfaw"
      }
    ],
    [
      "path",
      {
        d: "M12 19H3",
        key: "yhmn1j"
      }
    ],
    [
      "path",
      {
        d: "M14 3v4",
        key: "1sua03"
      }
    ],
    [
      "path",
      {
        d: "M16 17v4",
        key: "1q0r14"
      }
    ],
    [
      "path",
      {
        d: "M21 12h-9",
        key: "1o4lsq"
      }
    ],
    [
      "path",
      {
        d: "M21 19h-5",
        key: "1rlt1p"
      }
    ],
    [
      "path",
      {
        d: "M21 5h-7",
        key: "1oszz2"
      }
    ],
    [
      "path",
      {
        d: "M8 10v4",
        key: "tgpxqk"
      }
    ],
    [
      "path",
      {
        d: "M8 12H3",
        key: "a7s4jb"
      }
    ]
  ], qA = Vt("sliders-horizontal", HA);
  const YA = [
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
  ], GA = Vt("square-centerline-dashed-horizontal", YA);
  const XA = [
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
  ], kA = Vt("square-centerline-dashed-vertical", XA);
  const ZA = [
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
  ], KA = Vt("stamp", ZA);
  const QA = [
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
  ], JA = Vt("sun", QA);
  const FA = [
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
  ], PA = Vt("type", FA);
  const WA = [
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
  ], $A = Vt("undo", WA);
  const IA = [
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
  ], Cc = Vt("upload", IA);
  const tE = [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
        key: "1ngwbx"
      }
    ]
  ], Eg = Vt("wrench", tE);
  const eE = [
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
  ], sf = Vt("x", eE);
  const nE = [
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
  ], aE = Vt("zoom-in", nE);
  const iE = [
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
  ], lE = Vt("zoom-out", iE);
  function sE({ zoom: a, onZoomIn: l, onZoomOut: u, showTools: o, showGallery: c, showHistory: d, onToggleTools: f, onToggleGallery: m, onToggleHistory: y, onOpenUpload: p, imageCount: v }) {
    const b = [
      {
        key: "S",
        icon: Eg,
        label: "Tools",
        state: o,
        toggle: f
      },
      {
        key: "I",
        icon: jA,
        label: "Gallery",
        state: c,
        toggle: m
      },
      {
        key: "H",
        icon: zA,
        label: "History",
        state: d,
        toggle: y
      }
    ];
    return E.jsx(Jn.div, {
      variants: uA,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: "fixed top-3 left-0 right-0 z-30 pointer-events-none",
      children: E.jsx(Jn.div, {
        animate: {
          paddingLeft: o ? 312 : 12,
          paddingRight: 12
        },
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 30
        },
        children: E.jsx("div", {
          className: "pointer-events-auto",
          children: E.jsxs("div", {
            className: "grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-xl border border-[var(--border)]",
            children: [
              E.jsxs("div", {
                className: "flex items-center gap-2 justify-self-start",
                children: [
                  E.jsx("button", {
                    onClick: u,
                    disabled: a <= 25,
                    className: "p-1.5 rounded-md hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]",
                    children: E.jsx(lE, {
                      className: "h-4 w-4"
                    })
                  }),
                  E.jsxs("span", {
                    className: "text-sm font-semibold font-mono w-12 text-center tabular-nums text-[var(--text-primary)]",
                    children: [
                      Math.round(a * 100),
                      "%"
                    ]
                  }),
                  E.jsx("button", {
                    onClick: l,
                    disabled: a >= 4,
                    className: "p-1.5 rounded-md hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[var(--text-secondary)]",
                    children: E.jsx(aE, {
                      className: "h-4 w-4"
                    })
                  })
                ]
              }),
              E.jsx("div", {
                className: "flex gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] justify-self-center",
                children: b.map(({ key: S, icon: D, label: N, state: q, toggle: Y }) => E.jsxs("button", {
                  onClick: Y,
                  className: `flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${q ? "bg-[var(--accent)] text-white shadow-md" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`,
                  children: [
                    E.jsx(D, {
                      className: "h-3.5 w-3.5"
                    }),
                    E.jsx("span", {
                      className: "hidden sm:inline",
                      children: N
                    })
                  ]
                }, S))
              }),
              E.jsxs("div", {
                className: "flex items-center gap-3 justify-self-end",
                children: [
                  E.jsxs("span", {
                    className: "text-[10px] font-mono text-[var(--text-muted)]",
                    children: [
                      v,
                      " image",
                      v !== 1 ? "s" : ""
                    ]
                  }),
                  E.jsxs("button", {
                    onClick: p,
                    className: "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:brightness-110 transition-all",
                    children: [
                      E.jsx(Cc, {
                        className: "h-3.5 w-3.5"
                      }),
                      E.jsx("span", {
                        className: "hidden sm:inline",
                        children: "Open"
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
  function uE({ state: a, imageCount: l }) {
    return E.jsxs("footer", {
      className: "status-bar",
      children: [
        E.jsx("div", {
          className: "status-section",
          children: E.jsxs("span", {
            className: `source-status ${a.hasSource ? "has-source" : ""}`,
            children: [
              E.jsx("span", {
                className: "status-dot"
              }),
              a.hasSource ? "Source set \u2014 click to paint" : "Alt+Click to set source"
            ]
          })
        }),
        E.jsxs("div", {
          className: "status-section status-center",
          children: [
            E.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                E.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                E.jsx("kbd", {
                  children: "Click"
                }),
                " source"
              ]
            }),
            E.jsx("span", {
              className: "status-divider"
            }),
            E.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                E.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                E.jsx("kbd", {
                  children: "Scroll"
                }),
                " zoom"
              ]
            }),
            E.jsx("span", {
              className: "status-divider"
            }),
            E.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                E.jsx("kbd", {
                  children: "Ctrl"
                }),
                "+",
                E.jsx("kbd", {
                  children: "Z"
                }),
                " undo"
              ]
            }),
            E.jsx("span", {
              className: "status-divider"
            }),
            E.jsxs("span", {
              className: "status-shortcut-hint",
              children: [
                E.jsx("kbd", {
                  children: "Alt"
                }),
                "+",
                E.jsx("kbd", {
                  children: "["
                }),
                E.jsx("kbd", {
                  children: "]"
                }),
                " brush"
              ]
            })
          ]
        }),
        E.jsxs("div", {
          className: "status-section status-right",
          children: [
            E.jsxs("span", {
              className: "status-zoom-label",
              children: [
                l,
                " img",
                l !== 1 ? "s" : ""
              ]
            }),
            E.jsx("span", {
              className: "status-divider"
            }),
            E.jsx("span", {
              className: "status-zoom",
              children: a.width && a.height ? `${a.width}\xD7${a.height}` : "\u2014"
            }),
            E.jsx("span", {
              className: "status-divider"
            }),
            E.jsxs("span", {
              className: "status-zoom",
              children: [
                Math.round(a.zoom * 100),
                "%"
              ]
            })
          ]
        })
      ]
    });
  }
  const oE = [
    {
      id: "stamp",
      label: "Clone Stamp",
      description: "WASM-powered clone stamp",
      icon: KA,
      gradient: "from-rose-500 to-red-600"
    },
    {
      id: "transform",
      label: "Transform",
      description: "Flip, rotate, brightness",
      icon: qA,
      gradient: "from-amber-500 to-orange-600"
    },
    {
      id: "crop",
      label: "Crop",
      description: "Crop & trim images",
      icon: SA,
      gradient: "from-cyan-500 to-blue-600"
    },
    {
      id: "brush",
      label: "Paint",
      description: "Freehand drawing",
      icon: NA,
      gradient: "from-blue-500 to-indigo-600"
    },
    {
      id: "text",
      label: "Text",
      description: "Add text annotations",
      icon: PA,
      gradient: "from-amber-400 to-orange-500"
    },
    {
      id: "arrow",
      label: "Arrows",
      description: "Point & highlight areas",
      icon: yA,
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      id: "shapes",
      label: "Shapes",
      description: "Add geometric shapes",
      icon: LA,
      gradient: "from-pink-500 to-rose-600"
    },
    {
      id: "blur",
      label: "Blur",
      description: "Blur sensitive areas",
      icon: EA,
      gradient: "from-slate-400 to-slate-600"
    }
  ];
  function rE({ tool: a, active: l, onClick: u }) {
    const o = a.icon;
    return E.jsx("button", {
      onClick: u,
      className: `relative p-0.5 rounded-xl transition-all ${l ? "ring-2 ring-accent/80 ring-offset-1 ring-offset-[var(--bg-secondary)]" : ""}`,
      children: E.jsx("span", {
        className: `flex h-12 w-full aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${a.gradient} shadow-lg transition-transform hover:scale-105 ${l ? "scale-105" : ""}`,
        children: E.jsx(o, {
          className: "h-6 w-6 text-white"
        })
      })
    });
  }
  function cE({ activeTool: a, onToolChange: l }) {
    return E.jsx("div", {
      className: "grid grid-cols-4 gap-3",
      children: oE.map((u) => E.jsx("div", {
        title: `${u.label} \u2014 ${u.description}`,
        children: E.jsx(rE, {
          tool: u,
          active: u.id === a,
          onClick: () => l(u.id)
        })
      }, u.id))
    });
  }
  function fE({ settings: a, onChange: l, hasSource: u }) {
    return E.jsxs("div", {
      className: "space-y-5",
      children: [
        E.jsx("h3", {
          className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
          children: "Clone Stamp"
        }),
        E.jsxs("div", {
          className: `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${u ? "bg-[var(--success-dim)] text-[var(--success)]" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`,
          children: [
            E.jsx("span", {
              className: `w-2 h-2 rounded-full ${u ? "bg-[var(--success)] shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-[var(--text-muted)]"}`
            }),
            u ? "Source set \u2014 click to paint" : "Alt+Click to set source"
          ]
        }),
        E.jsxs("div", {
          className: "space-y-2",
          children: [
            E.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                E.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
                  children: "Size"
                }),
                E.jsxs("span", {
                  className: "text-xs font-mono text-[var(--text-secondary)]",
                  children: [
                    a.brushSize,
                    "px"
                  ]
                })
              ]
            }),
            E.jsx("input", {
              type: "range",
              min: 2,
              max: 200,
              value: a.brushSize,
              onChange: (o) => l({
                ...a,
                brushSize: Number(o.target.value)
              }),
              className: "w-full"
            })
          ]
        }),
        E.jsxs("div", {
          className: "space-y-2",
          children: [
            E.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                E.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
                  children: "Hardness"
                }),
                E.jsxs("span", {
                  className: "text-xs font-mono text-[var(--text-secondary)]",
                  children: [
                    Math.round(a.hardness * 100),
                    "%"
                  ]
                })
              ]
            }),
            E.jsx("input", {
              type: "range",
              min: 0,
              max: 100,
              value: Math.round(a.hardness * 100),
              onChange: (o) => l({
                ...a,
                hardness: Number(o.target.value) / 100
              }),
              className: "w-full"
            })
          ]
        }),
        E.jsxs("div", {
          className: "space-y-2",
          children: [
            E.jsxs("div", {
              className: "flex items-center justify-between",
              children: [
                E.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
                  children: "Opacity"
                }),
                E.jsxs("span", {
                  className: "text-xs font-mono text-[var(--text-secondary)]",
                  children: [
                    Math.round(a.opacity * 100),
                    "%"
                  ]
                })
              ]
            }),
            E.jsx("input", {
              type: "range",
              min: 0,
              max: 100,
              value: Math.round(a.opacity * 100),
              onChange: (o) => l({
                ...a,
                opacity: Number(o.target.value) / 100
              }),
              className: "w-full"
            })
          ]
        })
      ]
    });
  }
  function hE({ disabled: a, onFlipH: l, onFlipV: u, onRotate90Cw: o, onBrightness: c, onContrast: d }) {
    const [f, m] = w.useState(0), [y, p] = w.useState(100), v = () => {
      f !== 0 && (c(f / 100), m(0));
    }, b = () => {
      y !== 100 && (d(y / 100), p(100));
    }, S = `flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all
    bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]
    hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
    disabled:opacity-30 disabled:cursor-not-allowed`;
    return E.jsxs("div", {
      className: "space-y-5",
      children: [
        E.jsx("h3", {
          className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
          children: "Transform"
        }),
        E.jsxs("div", {
          className: "grid grid-cols-3 gap-2",
          children: [
            E.jsx("button", {
              className: S,
              onClick: l,
              disabled: a,
              title: "Flip horizontal",
              children: E.jsx(GA, {
                className: "h-4 w-4"
              })
            }),
            E.jsx("button", {
              className: S,
              onClick: u,
              disabled: a,
              title: "Flip vertical",
              children: E.jsx(kA, {
                className: "h-4 w-4"
              })
            }),
            E.jsx("button", {
              className: S,
              onClick: o,
              disabled: a,
              title: "Rotate 90\xB0 CW",
              children: E.jsx(UA, {
                className: "h-4 w-4"
              })
            })
          ]
        }),
        E.jsxs("div", {
          className: "space-y-2",
          children: [
            E.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                E.jsx(JA, {
                  className: "h-3.5 w-3.5 text-[var(--text-muted)]"
                }),
                E.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono flex-1",
                  children: "Brightness"
                }),
                E.jsx("span", {
                  className: "text-xs font-mono text-[var(--text-secondary)] min-w-[3ch] text-right",
                  children: f > 0 ? `+${f}` : f
                })
              ]
            }),
            E.jsx("input", {
              type: "range",
              min: -100,
              max: 100,
              step: 1,
              value: f,
              disabled: a,
              onChange: (D) => m(Number(D.target.value)),
              onPointerUp: v,
              className: "w-full"
            })
          ]
        }),
        E.jsxs("div", {
          className: "space-y-2",
          children: [
            E.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                E.jsx(vA, {
                  className: "h-3.5 w-3.5 text-[var(--text-muted)]"
                }),
                E.jsx("label", {
                  className: "text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono flex-1",
                  children: "Contrast"
                }),
                E.jsxs("span", {
                  className: "text-xs font-mono text-[var(--text-secondary)] min-w-[3ch] text-right",
                  children: [
                    y,
                    "%"
                  ]
                })
              ]
            }),
            E.jsx("input", {
              type: "range",
              min: 0,
              max: 300,
              step: 1,
              value: y,
              disabled: a,
              onChange: (D) => p(Number(D.target.value)),
              onPointerUp: b,
              className: "w-full"
            })
          ]
        })
      ]
    });
  }
  function dE({ onClose: a, activeTool: l, onToolChange: u, stampSettings: o, onStampSettingsChange: c, hasSource: d, imageReady: f, onFlipH: m, onFlipV: y, onRotate90Cw: p, onBrightness: v, onContrast: b, onUndo: S, onRedo: D, canUndo: N, canRedo: q, onExport: Y, canExport: G }) {
    return E.jsxs(Jn.div, {
      variants: sA,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      className: `
        fixed left-3 top-3 bottom-10 z-40
        w-[296px] rounded-xl
        bg-[var(--bg-secondary)] border border-[var(--border)]
        flex flex-col overflow-hidden
        shadow-xl
      `,
      children: [
        E.jsxs("div", {
          className: "flex items-center justify-between px-4 py-3 border-b border-[var(--border)]",
          children: [
            E.jsxs("h2", {
              className: "flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] font-mono",
              children: [
                E.jsx(Eg, {
                  className: "h-4 w-4 text-[var(--accent)]"
                }),
                "Tools"
              ]
            }),
            E.jsx("button", {
              onClick: a,
              className: "p-1.5 rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "aria-label": "Close tools",
              children: E.jsx(sf, {
                className: "h-4 w-4"
              })
            })
          ]
        }),
        E.jsx("div", {
          className: "p-4 border-b border-[var(--border)]",
          children: E.jsx(cE, {
            activeTool: l,
            onToolChange: u
          })
        }),
        E.jsxs("div", {
          className: "flex-1 overflow-y-auto p-4 space-y-4",
          children: [
            l === "stamp" && E.jsx(fE, {
              settings: o,
              onChange: c,
              hasSource: d
            }),
            l === "transform" && E.jsx(hE, {
              disabled: !f,
              onFlipH: m,
              onFlipV: y,
              onRotate90Cw: p,
              onBrightness: v,
              onContrast: b
            }),
            ![
              "stamp",
              "transform"
            ].includes(l) && E.jsxs("div", {
              className: "flex flex-col items-center justify-center py-12 text-center",
              children: [
                E.jsx("span", {
                  className: "text-2xl mb-3",
                  children: "\u{1F6A7}"
                }),
                E.jsxs("p", {
                  className: "text-xs text-[var(--text-muted)] font-mono",
                  children: [
                    l.toUpperCase(),
                    " tool coming soon"
                  ]
                }),
                E.jsx("p", {
                  className: "text-[10px] text-[var(--text-muted)] mt-1 opacity-60",
                  children: "Powered by Rust / WASM"
                })
              ]
            })
          ]
        }),
        E.jsx("div", {
          className: "p-4 border-t border-[var(--border)]",
          children: E.jsxs("button", {
            onClick: Y,
            disabled: !G,
            className: `
            w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
            text-sm font-semibold
            bg-[var(--accent)] text-white
            hover:brightness-110 transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
          `,
            children: [
              E.jsx(TA, {
                className: "h-4 w-4"
              }),
              "Export PNG"
            ]
          })
        }),
        E.jsxs("div", {
          className: "px-4 pb-4 flex gap-2",
          children: [
            E.jsxs("button", {
              onClick: S,
              disabled: !N,
              className: `
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-[var(--bg-elevated)] border border-[var(--border)]
            text-[var(--text-secondary)]
            hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          `,
              children: [
                E.jsx($A, {
                  className: "h-3.5 w-3.5"
                }),
                "Undo"
              ]
            }),
            E.jsxs("button", {
              onClick: D,
              disabled: !q,
              className: `
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-[var(--bg-elevated)] border border-[var(--border)]
            text-[var(--text-secondary)]
            hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          `,
              children: [
                E.jsx(wA, {
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
  const mE = By.forwardRef(({ hookResult: a, brushDiameter: l, cursorPos: u, cursorVisible: o, onCanvasEnter: c, onCanvasLeave: d }, f) => {
    const { onMouseDown: m, onMouseMove: y, onMouseUp: p, state: v } = a, b = f;
    let S = null;
    if (v.sourcePos && b.current) {
      const N = b.current, q = N.getBoundingClientRect(), Y = q.width / N.width, G = q.height / N.height;
      S = {
        left: q.left + v.sourcePos.x * Y,
        top: q.top + v.sourcePos.y * G
      };
    }
    const D = v.zoom;
    return E.jsxs("div", {
      className: "canvas-wrapper",
      children: [
        E.jsx("canvas", {
          ref: f,
          className: "main-canvas",
          style: {
            transform: D !== 1 ? `scale(${D})` : void 0,
            transformOrigin: "center center"
          },
          onMouseDown: m,
          onMouseMove: y,
          onMouseUp: p,
          onMouseLeave: p,
          onMouseEnter: (N) => {
            c(N.currentTarget.getBoundingClientRect());
          },
          onMouseOut: d
        }),
        o && E.jsx("div", {
          className: "brush-cursor",
          style: {
            left: u.x,
            top: u.y,
            width: l,
            height: l
          }
        }),
        S && E.jsx("div", {
          className: "source-marker",
          style: S
        }),
        !v.ready && E.jsxs("div", {
          className: "canvas-empty-state",
          children: [
            E.jsx("div", {
              className: "canvas-empty-icon",
              children: E.jsxs("svg", {
                viewBox: "0 0 48 48",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: [
                  E.jsx("rect", {
                    x: "4",
                    y: "8",
                    width: "40",
                    height: "32",
                    rx: "4"
                  }),
                  E.jsx("circle", {
                    cx: "16",
                    cy: "20",
                    r: "4"
                  }),
                  E.jsx("path", {
                    d: "M4 32l10-8 8 8 8-12 14 12"
                  })
                ]
              })
            }),
            E.jsx("p", {
              className: "canvas-empty-title",
              children: "No image loaded"
            }),
            E.jsxs("p", {
              className: "canvas-empty-hint",
              children: [
                "Use ",
                E.jsx("kbd", {
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
  function pE({ history: a, onJump: l, onDelete: u, onClear: o, onClose: c }) {
    return E.jsxs(Jn.aside, {
      initial: {
        x: "100%",
        opacity: 0
      },
      animate: {
        x: 0,
        opacity: 1
      },
      exit: {
        x: "100%",
        opacity: 0
      },
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200
      },
      className: "history-panel",
      children: [
        E.jsxs("div", {
          className: "panel-header",
          children: [
            E.jsx("span", {
              className: "panel-title",
              children: "History"
            }),
            E.jsx("span", {
              className: "panel-count",
              children: a.length
            }),
            E.jsx("button", {
              className: "btn-icon",
              onClick: o,
              title: "Clear history",
              style: {
                marginLeft: "auto"
              },
              children: E.jsx("svg", {
                viewBox: "0 0 16 16",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: E.jsx("path", {
                  d: "M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                })
              })
            }),
            E.jsx("button", {
              className: "btn-icon",
              onClick: c,
              title: "Close history",
              children: E.jsx("svg", {
                viewBox: "0 0 16 16",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                children: E.jsx("path", {
                  d: "M4 4l8 8M12 4l-8 8"
                })
              })
            })
          ]
        }),
        E.jsx("ul", {
          className: "history-list",
          children: a.map((d) => E.jsxs("li", {
            className: `history-item type-${d.type}`,
            onClick: () => l(d.index),
            children: [
              E.jsx("span", {
                className: "history-dot"
              }),
              E.jsx("span", {
                className: "history-index",
                children: d.index
              }),
              E.jsx("span", {
                className: "history-label",
                children: d.label
              }),
              d.type === "undo" && E.jsx("button", {
                className: "history-delete",
                title: "Delete entry",
                onClick: (f) => {
                  f.stopPropagation(), u(d.index);
                },
                children: E.jsx("svg", {
                  viewBox: "0 0 12 12",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  children: E.jsx("path", {
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
  function yE({ photos: a, activeId: l, onSelect: u, onRemove: o, onClose: c, showTools: d }) {
    const f = w.useRef(null);
    return w.useEffect(() => {
      var _a;
      if (!l || !f.current) return;
      (_a = f.current.querySelector(`[data-id="${l}"]`)) == null ? void 0 : _a.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest"
      });
    }, [
      l,
      a.length
    ]), a.length === 0 ? null : E.jsx(Jn.div, {
      variants: oA,
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      style: {
        left: d ? 312 : 12,
        right: 12
      },
      className: "fixed bottom-10 z-40 bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-xl shadow-2xl border border-[var(--border)]",
      children: E.jsxs("div", {
        className: "flex items-center gap-2 px-3 py-2",
        children: [
          E.jsxs("div", {
            className: "flex items-center gap-2 pr-2 border-r border-[var(--border)]",
            children: [
              E.jsx("span", {
                className: "text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono",
                children: "Gallery"
              }),
              E.jsx("span", {
                className: "text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full",
                children: a.length
              })
            ]
          }),
          E.jsx("div", {
            ref: f,
            className: "flex gap-1.5 overflow-x-auto flex-1 py-1 scrollbar-thin",
            children: a.map((m) => E.jsxs("div", {
              "data-id": m.id,
              className: `photo-thumb ${m.id === l ? "active" : ""}`,
              onClick: () => u(m),
              title: m.name,
              children: [
                E.jsx("img", {
                  src: m.url,
                  alt: m.name,
                  draggable: false
                }),
                E.jsx("button", {
                  className: "photo-thumb-remove",
                  title: "Remove",
                  onClick: (y) => {
                    y.stopPropagation(), o(m.id);
                  },
                  children: E.jsx("svg", {
                    viewBox: "0 0 10 10",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "1.8",
                    children: E.jsx("path", {
                      d: "M1.5 1.5l7 7M8.5 1.5l-7 7"
                    })
                  })
                }),
                E.jsx("span", {
                  className: "photo-thumb-label",
                  children: m.name
                })
              ]
            }, m.id))
          }),
          E.jsx("button", {
            onClick: c,
            className: "p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0",
            children: E.jsx(sf, {
              className: "h-3.5 w-3.5"
            })
          })
        ]
      })
    });
  }
  function gE({ open: a, onClose: l, onFiles: u }) {
    const o = w.useRef(null), [c, d] = w.useState(false), f = (y) => {
      y.preventDefault(), d(false);
      const p = Array.from(y.dataTransfer.files).filter((v) => v.type.startsWith("image/"));
      p.length && (u(p), l());
    }, m = (y) => {
      const p = Array.from(y.target.files ?? []).filter((v) => v.type.startsWith("image/"));
      p.length && (u(p), l()), y.target.value = "";
    };
    return E.jsx(dl, {
      children: a && E.jsx(Jn.div, {
        variants: rA,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
        onClick: l,
        children: E.jsxs(Jn.div, {
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
          transition: {
            type: "spring",
            damping: 25,
            stiffness: 300
          },
          className: "relative w-full max-w-lg mx-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden",
          onClick: (y) => y.stopPropagation(),
          children: [
            E.jsxs("div", {
              className: "flex items-center justify-between px-6 pt-5 pb-3",
              children: [
                E.jsxs("h2", {
                  className: "flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] font-mono",
                  children: [
                    E.jsx(Cc, {
                      className: "h-5 w-5 text-[var(--accent)]"
                    }),
                    "Open Images"
                  ]
                }),
                E.jsx("button", {
                  onClick: l,
                  className: "p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                  children: E.jsx(sf, {
                    className: "h-4 w-4"
                  })
                })
              ]
            }),
            E.jsx("div", {
              className: "px-6 pb-6",
              onDrop: f,
              onDragOver: (y) => {
                y.preventDefault(), d(true);
              },
              onDragLeave: () => d(false),
              children: E.jsxs("div", {
                className: `
                  border-2 border-dashed rounded-xl p-12 text-center transition-all
                  ${c ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border)] bg-[var(--bg-tertiary)]"}
                `,
                children: [
                  E.jsxs("div", {
                    className: "flex flex-col items-center gap-4",
                    children: [
                      E.jsx("div", {
                        className: "w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center",
                        children: E.jsx(Cc, {
                          className: "h-8 w-8 text-[var(--text-muted)]"
                        })
                      }),
                      E.jsxs("button", {
                        onClick: () => {
                          var _a;
                          return (_a = o.current) == null ? void 0 : _a.click();
                        },
                        className: "flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-[var(--accent)] text-white hover:brightness-110 transition-all",
                        children: [
                          E.jsx(CA, {
                            className: "h-5 w-5"
                          }),
                          "Browse Files"
                        ]
                      }),
                      E.jsx("p", {
                        className: "text-sm text-[var(--text-muted)]",
                        children: "or drag and drop images here"
                      }),
                      E.jsx("p", {
                        className: "text-xs text-[var(--text-muted)] opacity-50",
                        children: "Supports PNG, JPG, GIF, WebP, AVIF"
                      })
                    ]
                  }),
                  E.jsx("input", {
                    ref: o,
                    type: "file",
                    multiple: true,
                    accept: "image/*",
                    hidden: true,
                    onChange: m
                  })
                ]
              })
            })
          ]
        })
      })
    });
  }
  function vE() {
    const a = w.useRef(null), l = iA(a), [u, o] = w.useState({
      brushSize: 20,
      hardness: 0.8,
      opacity: 1
    }), c = w.useCallback((x) => {
      o(x), l.setBrushSize(x.brushSize), l.setHardness(x.hardness), l.setOpacity(x.opacity);
    }, [
      l
    ]), [d, f] = w.useState([]), [m, y] = w.useState(null), p = w.useCallback((x) => {
      const O = x.map((k) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(k),
        name: k.name.replace(/\.[^.]+$/, ""),
        file: k
      }));
      f((k) => [
        ...k,
        ...O
      ]);
      const L = O[0];
      L && (l.loadImage(L.file), y(L.id));
    }, [
      l
    ]), v = w.useCallback((x) => {
      l.loadImage(x.file), y(x.id);
    }, [
      l
    ]), b = w.useCallback((x) => {
      f((O) => {
        const L = O.findIndex((A) => A.id === x), k = O.filter((A) => A.id !== x), F = O[L];
        if (F && URL.revokeObjectURL(F.url), x === m && k.length > 0) {
          const A = k[Math.min(L, k.length - 1)];
          l.loadImage(A.file), y(A.id);
        } else k.length === 0 && y(null);
        return k;
      });
    }, [
      m,
      l
    ]), { pos: S, visible: D, diameter: N, onCanvasEnter: q, onCanvasLeave: Y } = lA(u.brushSize, l.state.zoom, a), [G, K] = w.useState(true), [X, Z] = w.useState(false), [$, st] = w.useState(false), [et, J] = w.useState(false), [it, tt] = w.useState(false), [ft, pt] = w.useState("stamp"), Ut = w.useRef(0);
    w.useEffect(() => {
      const x = Ut.current, O = d.length;
      if (x === 0 && O > 0) {
        K(false);
        const L = setTimeout(() => Z(true), 150), k = setTimeout(() => st(true), 500), F = setTimeout(() => J(true), 850);
        return Ut.current = O, () => {
          clearTimeout(L), clearTimeout(k), clearTimeout(F);
        };
      }
      O === 0 && (K(true), Z(false), st(false), J(false), tt(false)), Ut.current = O;
    }, [
      d.length
    ]), w.useEffect(() => {
      const x = (O) => {
        if ((O.metaKey || O.ctrlKey) && O.key === "z") {
          O.preventDefault(), O.shiftKey ? l.redo() : l.undo();
          return;
        }
        O.altKey && (O.code === "BracketLeft" ? (O.preventDefault(), o((L) => {
          const k = Math.max(2, L.brushSize - 5);
          return l.setBrushSize(k), {
            ...L,
            brushSize: k
          };
        })) : O.code === "BracketRight" && (O.preventDefault(), o((L) => {
          const k = Math.min(200, L.brushSize + 5);
          return l.setBrushSize(k), {
            ...L,
            brushSize: k
          };
        })));
      };
      return window.addEventListener("keydown", x), () => window.removeEventListener("keydown", x);
    }, [
      l
    ]);
    const _t = w.useCallback(() => {
      var _a;
      (_a = l.toolRef.current) == null ? void 0 : _a.adjust_zoom(1);
    }, [
      l
    ]), jt = w.useCallback(() => {
      var _a;
      (_a = l.toolRef.current) == null ? void 0 : _a.adjust_zoom(-1);
    }, [
      l
    ]);
    return E.jsxs("div", {
      className: "app-shell",
      children: [
        E.jsx(gE, {
          open: G,
          onClose: () => K(false),
          onFiles: p
        }),
        E.jsx(dl, {
          children: X && E.jsx(sE, {
            zoom: l.state.zoom,
            onZoomIn: _t,
            onZoomOut: jt,
            showTools: $,
            showGallery: et,
            showHistory: it,
            onToggleTools: () => st((x) => !x),
            onToggleGallery: () => J((x) => !x),
            onToggleHistory: () => tt((x) => !x),
            onOpenUpload: () => K(true),
            imageCount: d.length
          })
        }),
        E.jsx(dl, {
          children: $ && E.jsx(dE, {
            onClose: () => st(false),
            activeTool: ft,
            onToolChange: pt,
            stampSettings: u,
            onStampSettingsChange: c,
            hasSource: l.state.hasSource,
            imageReady: l.state.ready,
            onFlipH: l.flipHorizontal,
            onFlipV: l.flipVertical,
            onRotate90Cw: l.rotate90Cw,
            onBrightness: l.adjustBrightness,
            onContrast: l.adjustContrast,
            onUndo: l.undo,
            onRedo: l.redo,
            canUndo: l.state.undoCount > 0,
            canRedo: l.state.redoCount > 0,
            onExport: l.exportPng,
            canExport: l.state.ready
          })
        }),
        E.jsx(Jn.main, {
          animate: {
            marginLeft: $ ? 308 : 0,
            marginRight: it ? 220 : 0
          },
          transition: {
            type: "spring",
            stiffness: 300,
            damping: 30
          },
          className: "main-content",
          children: E.jsx(mE, {
            ref: a,
            hookResult: l,
            brushDiameter: N,
            cursorPos: S,
            cursorVisible: D,
            onCanvasEnter: q,
            onCanvasLeave: Y
          })
        }),
        E.jsx(dl, {
          children: it && E.jsx(pE, {
            history: l.state.history,
            onJump: l.jumpToHistory,
            onDelete: l.deleteHistoryEntry,
            onClear: l.clearHistory,
            onClose: () => tt(false)
          })
        }),
        E.jsx(dl, {
          children: et && E.jsx(yE, {
            photos: d,
            activeId: m,
            onSelect: v,
            onRemove: b,
            onClose: () => J(false),
            showTools: $
          })
        }),
        E.jsx(uE, {
          state: l.state,
          imageCount: d.length
        })
      ]
    });
  }
  function bE() {
    return E.jsx(vE, {});
  }
  ib.createRoot(document.getElementById("root")).render(E.jsx(By.StrictMode, {
    children: E.jsx(bE, {})
  }));
})();
