"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/tslib/tslib.es6.mjs
  var tslib_es6_exports = {};
  __export(tslib_es6_exports, {
    __addDisposableResource: () => __addDisposableResource,
    __assign: () => __assign,
    __asyncDelegator: () => __asyncDelegator,
    __asyncGenerator: () => __asyncGenerator,
    __asyncValues: () => __asyncValues,
    __await: () => __await,
    __awaiter: () => __awaiter,
    __classPrivateFieldGet: () => __classPrivateFieldGet,
    __classPrivateFieldIn: () => __classPrivateFieldIn,
    __classPrivateFieldSet: () => __classPrivateFieldSet,
    __createBinding: () => __createBinding,
    __decorate: () => __decorate,
    __disposeResources: () => __disposeResources,
    __esDecorate: () => __esDecorate,
    __exportStar: () => __exportStar,
    __extends: () => __extends,
    __generator: () => __generator,
    __importDefault: () => __importDefault,
    __importStar: () => __importStar,
    __makeTemplateObject: () => __makeTemplateObject,
    __metadata: () => __metadata,
    __param: () => __param,
    __propKey: () => __propKey,
    __read: () => __read,
    __rest: () => __rest,
    __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
    __runInitializers: () => __runInitializers,
    __setFunctionName: () => __setFunctionName,
    __spread: () => __spread,
    __spreadArray: () => __spreadArray,
    __spreadArrays: () => __spreadArrays,
    __values: () => __values,
    default: () => tslib_es6_default
  });
  function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }
  function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
      t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
          t[p[i]] = s[p[i]];
      }
    return t;
  }
  function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  }
  function __param(paramIndex, decorator) {
    return function(target, key) {
      decorator(target, key, paramIndex);
    };
  }
  function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) {
      if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
      return f;
    }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
      var context = {};
      for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
      for (var p in contextIn.access) context.access[p] = contextIn.access[p];
      context.addInitializer = function(f) {
        if (done) throw new TypeError("Cannot add initializers after decoration has completed");
        extraInitializers.push(accept(f || null));
      };
      var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
      if (kind === "accessor") {
        if (result === void 0) continue;
        if (result === null || typeof result !== "object") throw new TypeError("Object expected");
        if (_ = accept(result.get)) descriptor.get = _;
        if (_ = accept(result.set)) descriptor.set = _;
        if (_ = accept(result.init)) initializers.unshift(_);
      } else if (_ = accept(result)) {
        if (kind === "field") initializers.unshift(_);
        else descriptor[key] = _;
      }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
  }
  function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
      value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
  }
  function __propKey(x) {
    return typeof x === "symbol" ? x : "".concat(x);
  }
  function __setFunctionName(f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
  }
  function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
  }
  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1) throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (g && (g = 0, op[0] && (_ = 0)), _) try {
        if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
        if (y = 0, t) op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _.label++;
            return { value: op[1], done: false };
          case 5:
            _.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _.ops.pop();
            _.trys.pop();
            continue;
          default:
            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _ = 0;
              continue;
            }
            if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
              _.label = op[1];
              break;
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1];
              t = op;
              break;
            }
            if (t && _.label < t[2]) {
              _.label = t[2];
              _.ops.push(op);
              break;
            }
            if (t[2]) _.ops.pop();
            _.trys.pop();
            continue;
        }
        op = body.call(thisArg, _);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  }
  function __exportStar(m, o) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
  }
  function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
      next: function() {
        if (o && i >= o.length) o = void 0;
        return { value: o && o[i++], done: !o };
      }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  }
  function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
      ar = ar.concat(__read(arguments[i]));
    return ar;
  }
  function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
      for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
        r[k] = a[j];
    return r;
  }
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }
  function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
  }
  function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
      return this;
    }, i;
    function awaitReturn(f) {
      return function(v) {
        return Promise.resolve(v).then(f, reject);
      };
    }
    function verb(n, f) {
      if (g[n]) {
        i[n] = function(v) {
          return new Promise(function(a, b) {
            q.push([n, v, a, b]) > 1 || resume(n, v);
          });
        };
        if (f) i[n] = f(i[n]);
      }
    }
    function resume(n, v) {
      try {
        step(g[n](v));
      } catch (e) {
        settle(q[0][3], e);
      }
    }
    function step(r) {
      r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
    }
    function fulfill(value) {
      resume("next", value);
    }
    function reject(value) {
      resume("throw", value);
    }
    function settle(f, v) {
      if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
    }
  }
  function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function(e) {
      throw e;
    }), verb("return"), i[Symbol.iterator] = function() {
      return this;
    }, i;
    function verb(n, f) {
      i[n] = o[n] ? function(v) {
        return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
      } : f;
    }
  }
  function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
      return this;
    }, i);
    function verb(n) {
      i[n] = o[n] && function(v) {
        return new Promise(function(resolve, reject) {
          v = o[n](v), settle(resolve, reject, v.done, v.value);
        });
      };
    }
    function settle(resolve, reject, d, v) {
      Promise.resolve(v).then(function(v2) {
        resolve({ value: v2, done: d });
      }, reject);
    }
  }
  function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) {
      Object.defineProperty(cooked, "raw", { value: raw });
    } else {
      cooked.raw = raw;
    }
    return cooked;
  }
  function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
      for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
    }
    __setModuleDefault(result, mod);
    return result;
  }
  function __importDefault(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  }
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  function __classPrivateFieldIn(state, receiver) {
    if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
    return typeof state === "function" ? receiver === state : state.has(receiver);
  }
  function __addDisposableResource(env, value, async) {
    if (value !== null && value !== void 0) {
      if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
      var dispose, inner;
      if (async) {
        if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
        dispose = value[Symbol.asyncDispose];
      }
      if (dispose === void 0) {
        if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
        dispose = value[Symbol.dispose];
        if (async) inner = dispose;
      }
      if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
      if (inner) dispose = function() {
        try {
          inner.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
      env.stack.push({ value, dispose, async });
    } else if (async) {
      env.stack.push({ async: true });
    }
    return value;
  }
  function __disposeResources(env) {
    function fail(e) {
      env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
      env.hasError = true;
    }
    var r, s = 0;
    function next() {
      while (r = env.stack.pop()) {
        try {
          if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
          if (r.dispose) {
            var result = r.dispose.call(r.value);
            if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
              fail(e);
              return next();
            });
          } else s |= 1;
        } catch (e) {
          fail(e);
        }
      }
      if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
      if (env.hasError) throw env.error;
    }
    return next();
  }
  function __rewriteRelativeImportExtension(path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
      return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
        return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
      });
    }
    return path;
  }
  var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
  var init_tslib_es6 = __esm({
    "node_modules/tslib/tslib.es6.mjs"() {
      extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      __assign = function() {
        __assign = Object.assign || function __assign2(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      });
      __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      };
      ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      tslib_es6_default = {
        __extends,
        __assign,
        __rest,
        __decorate,
        __param,
        __esDecorate,
        __runInitializers,
        __propKey,
        __setFunctionName,
        __metadata,
        __awaiter,
        __generator,
        __createBinding,
        __exportStar,
        __values,
        __read,
        __spread,
        __spreadArrays,
        __spreadArray,
        __await,
        __asyncGenerator,
        __asyncDelegator,
        __asyncValues,
        __makeTemplateObject,
        __importStar,
        __importDefault,
        __classPrivateFieldGet,
        __classPrivateFieldSet,
        __classPrivateFieldIn,
        __addDisposableResource,
        __disposeResources,
        __rewriteRelativeImportExtension
      };
    }
  });

  // node_modules/@forge/jira-bridge/out/bridge.js
  var require_bridge = __commonJS({
    "node_modules/@forge/jira-bridge/out/bridge.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getCallBridge = void 0;
      var getCallBridge = () => {
        return globalThis.__bridge.callBridge;
      };
      exports.getCallBridge = getCallBridge;
    }
  });

  // node_modules/@forge/jira-bridge/out/errors.js
  var require_errors = __commonJS({
    "node_modules/@forge/jira-bridge/out/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ERROR_TYPES = exports.ON_FIELD_DATA_CHANGE_ERROR = exports.ON_ERROR_ERROR = exports.GET_API_ERROR = exports.SUBSCRIBE_TO_CHANGES_ERROR = exports.ON_INIT_ERROR = exports.AppExecutionError = exports.BridgeAPIError = void 0;
      var BridgeAPIError = class extends Error {
      };
      exports.BridgeAPIError = BridgeAPIError;
      var AppExecutionError = class extends Error {
      };
      exports.AppExecutionError = AppExecutionError;
      exports.ON_INIT_ERROR = "onInitError";
      exports.SUBSCRIBE_TO_CHANGES_ERROR = "subscribeToChangesError";
      exports.GET_API_ERROR = "getApiError";
      exports.ON_ERROR_ERROR = "onErrorError";
      exports.ON_FIELD_DATA_CHANGE_ERROR = "onFieldDataChangeError";
      exports.ERROR_TYPES = [exports.ON_INIT_ERROR, exports.SUBSCRIBE_TO_CHANGES_ERROR, exports.GET_API_ERROR, exports.ON_ERROR_ERROR];
    }
  });

  // node_modules/@forge/jira-bridge/out/modal/issue-view.js
  var require_issue_view = __commonJS({
    "node_modules/@forge/jira-bridge/out/modal/issue-view.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ViewIssueModal = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var noop = () => {
      };
      var callBridge = (0, bridge_1.getCallBridge)();
      var ViewIssueModal = class {
        constructor(opts) {
          const { context, onClose = noop } = opts || {};
          if (!context || !context.issueKey) {
            throw new errors_1.BridgeAPIError("issueKey is missing in the context");
          }
          this.onClose = onClose;
          this.context = context;
        }
        async open() {
          try {
            const success = await callBridge("openIssueViewModal", {
              data: {
                onClose: this.onClose,
                context: this.context
              }
            });
            if (success === false) {
              throw new errors_1.BridgeAPIError("Unable to open issue view modal.");
            }
          } catch (err) {
            throw new errors_1.BridgeAPIError("Unable to open issue view modal.");
          }
        }
      };
      exports.ViewIssueModal = ViewIssueModal;
    }
  });

  // node_modules/@forge/jira-bridge/out/modal/issue-create.js
  var require_issue_create = __commonJS({
    "node_modules/@forge/jira-bridge/out/modal/issue-create.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.CreateIssueModal = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var noop = () => {
      };
      var callBridge = (0, bridge_1.getCallBridge)();
      var CreateIssueModal = class {
        constructor(opts) {
          this.onClose = (opts === null || opts === void 0 ? void 0 : opts.onClose) || noop;
          this.context = (opts === null || opts === void 0 ? void 0 : opts.context) || {};
        }
        async open() {
          try {
            const success = await callBridge("openIssueCreateModal", {
              data: {
                onClose: this.onClose,
                context: this.context
              }
            });
            if (success === false) {
              throw new errors_1.BridgeAPIError("Unable to open issue create modal.");
            }
          } catch (err) {
            throw new errors_1.BridgeAPIError("Unable to open issue create modal.");
          }
        }
      };
      exports.CreateIssueModal = CreateIssueModal;
    }
  });

  // node_modules/@forge/jira-bridge/out/modal/index.js
  var require_modal = __commonJS({
    "node_modules/@forge/jira-bridge/out/modal/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_issue_view(), exports);
      tslib_1.__exportStar(require_issue_create(), exports);
    }
  });

  // node_modules/@forge/jira-bridge/out/workflow/onConfigure.js
  var require_onConfigure = __commonJS({
    "node_modules/@forge/jira-bridge/out/workflow/onConfigure.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.onConfigure = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      async function onConfigure(onConfigureFn2) {
        try {
          const success = await callBridge("setWorkflowRuleConfigurationCallback", {
            data: {
              onConfigure: onConfigureFn2
            }
          });
          if (success === false) {
            throw new errors_1.BridgeAPIError("Unable to add workflow rule configuration callback.");
          }
        } catch (err) {
          throw new errors_1.BridgeAPIError("Unable to add workflow rule configuration callback.");
        }
      }
      exports.onConfigure = onConfigure;
    }
  });

  // node_modules/@forge/jira-bridge/out/workflow/index.js
  var require_workflow = __commonJS({
    "node_modules/@forge/jira-bridge/out/workflow/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.workflowRules = void 0;
      var onConfigure_1 = require_onConfigure();
      exports.workflowRules = {
        onConfigure: onConfigure_1.onConfigure
      };
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/changesBuffer.js
  var require_changesBuffer = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/changesBuffer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ChangesBuffer = void 0;
      var ChangesBuffer = class {
        constructor() {
          this.formBuffer = {};
          this.screenTabsBuffer = [];
        }
        getFormChanges() {
          return this.formBuffer;
        }
        getScreenTabsChanges() {
          return this.screenTabsBuffer;
        }
        updateFieldProperty(fieldId, property, value) {
          this.formBuffer[fieldId] = {
            ...this.formBuffer[fieldId],
            [property]: value
          };
        }
        updateScreenTabProperty(screenTabsData, tabId, property, value) {
          const currentChanges = this.screenTabsBuffer.find((tab) => tab.id === tabId);
          if (currentChanges) {
            currentChanges[property] = value;
          } else {
            const currentTab = screenTabsData.find((tab) => tab.id === tabId);
            if (currentTab) {
              this.screenTabsBuffer.push({
                id: tabId,
                isVisible: currentTab.isVisible,
                isActive: currentTab.isActive,
                [property]: value
              });
            }
          }
        }
        bulkUpdateScreenTabProperty(screenTabsData, predicate, property, value) {
          screenTabsData.filter((tab) => predicate(tab.id)).forEach((tabToChange) => {
            this.updateScreenTabProperty(screenTabsData, tabToChange.id, property, value);
          });
        }
      };
      exports.ChangesBuffer = ChangesBuffer;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/apiBuilder.js
  var require_apiBuilder = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/apiBuilder.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ApiBuilder = void 0;
      var changesBuffer_1 = require_changesBuffer();
      var ApiBuilder = class {
        constructor(formData, screenTabsData) {
          this.formData = formData;
          this.screenTabsData = screenTabsData;
          this.buffer = new changesBuffer_1.ChangesBuffer();
        }
        getBuffer() {
          return this.buffer;
        }
        build() {
          const fieldApi = {
            getFieldById: (fieldId) => {
              return this.buildField(fieldId, this.formData, this.buffer);
            },
            getFields: () => {
              return Object.values(this.formData).map((field) => {
                return this.buildField(field.fieldId, this.formData, this.buffer);
              });
            }
          };
          return {
            ...fieldApi,
            getScreenTabById: (screenTabId) => {
              const screenTab = this.screenTabsData.find((tab) => tab.id === screenTabId);
              if (screenTab) {
                return this.buildScreenTab(screenTab, this.screenTabsData, this.buffer);
              }
            },
            getScreenTabs: () => {
              return this.screenTabsData.map((tab) => this.buildScreenTab(tab, this.screenTabsData, this.buffer));
            }
          };
        }
        buildField(fieldId, formData, buffer) {
          if (!Object.prototype.hasOwnProperty.call(formData, fieldId)) {
            return void 0;
          }
          const field = formData[fieldId];
          if (!field) {
            return void 0;
          }
          const fieldApi = {
            getId: () => field.fieldId,
            getType: () => field.fieldType,
            setName: (name) => {
              buffer.updateFieldProperty(fieldId, "fieldName", name);
              return fieldApi;
            },
            getName: () => {
              return field.fieldName;
            },
            setDescription: (description) => {
              buffer.updateFieldProperty(fieldId, "description", description);
              return fieldApi;
            },
            getDescription: () => {
              return field.description;
            },
            isVisible: () => field.isVisible,
            setVisible: (isVisible) => {
              buffer.updateFieldProperty(fieldId, "isVisible", isVisible);
              return fieldApi;
            },
            setValue: (value) => {
              buffer.updateFieldProperty(fieldId, "value", value);
              return fieldApi;
            },
            getValue: () => {
              return field.value;
            },
            isReadOnly: () => {
              return field.isReadOnly;
            },
            setReadOnly: (isReadOnly) => {
              buffer.updateFieldProperty(fieldId, "isReadOnly", isReadOnly);
              return fieldApi;
            },
            isRequired: () => field.isRequired,
            setRequired: (isRequired) => {
              buffer.updateFieldProperty(fieldId, "isRequired", isRequired);
              return fieldApi;
            },
            setOptionsVisibility: (options, isVisible) => {
              buffer.updateFieldProperty(fieldId, "optionsVisibility", { options, isVisible });
              return fieldApi;
            },
            getOptionsVisibility: () => {
              return field.optionsVisibility;
            }
          };
          return fieldApi;
        }
        buildScreenTab(screenTab, screenTabsData, buffer) {
          const screenTabApi = {
            getId: () => screenTab.id,
            isVisible: () => screenTab.isVisible,
            setVisible: (isVisible) => {
              buffer.updateScreenTabProperty(screenTabsData, screenTab.id, "isVisible", isVisible);
              return screenTabApi;
            },
            focus: () => {
              buffer.bulkUpdateScreenTabProperty(screenTabsData, (tabId) => tabId !== screenTab.id, "isActive", false);
              buffer.updateScreenTabProperty(screenTabsData, screenTab.id, "isActive", true);
              return screenTabApi;
            }
          };
          return screenTabApi;
        }
      };
      exports.ApiBuilder = ApiBuilder;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/getInternalAPI.js
  var require_getInternalAPI = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/getInternalAPI.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getInternalAPI = void 0;
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      async function getInternalAPI() {
        let logError;
        try {
          const internalAPI = await callBridge("getUiModificationsInternalAPI");
          const { actions: { getOnInitData, submit, registerFields, subscribeToChanges, onBridgeError }, data: { uiModifications, onInitChangeId } } = internalAPI;
          logError = onBridgeError;
          if (!getOnInitData || !submit || !registerFields || !uiModifications || !onInitChangeId) {
            throw new Error("onInit could not be started");
          }
          if (!subscribeToChanges) {
            throw new Error("onChange could not be started");
          }
          return internalAPI;
        } catch (err) {
          if (logError)
            logError({ error: errors_1.GET_API_ERROR, cause: err });
          throw new errors_1.BridgeAPIError("Unable to initialize UI modifications module: " + err.message);
        }
      }
      exports.getInternalAPI = getInternalAPI;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/onInit.js
  var require_onInit = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/onInit.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.onInit = void 0;
      var apiBuilder_1 = require_apiBuilder();
      var getInternalAPI_1 = require_getInternalAPI();
      var errors_1 = require_errors();
      async function onInit(onInitCallback, registerOnInitFieldsCallback) {
        const { actions: { getOnInitData, submit, registerFields, onBridgeError }, data: { onInitChangeId: changeId, uiModifications } } = await (0, getInternalAPI_1.getInternalAPI)();
        try {
          let fieldsDeclared;
          const payload = {
            fieldsChanges: {},
            screenTabsChanges: [],
            changeId
          };
          try {
            fieldsDeclared = registerOnInitFieldsCallback({ uiModifications });
          } catch (error) {
            void submit({
              fieldsChanges: {},
              screenTabsChanges: [],
              changeId
            });
            throw new errors_1.AppExecutionError(error);
          }
          void registerFields({ fields: fieldsDeclared, changeId });
          const { currentFormState, currentScreenTabsState = [] } = await getOnInitData();
          const builder = new apiBuilder_1.ApiBuilder(currentFormState, currentScreenTabsState);
          try {
            await onInitCallback({ api: builder.build(), uiModifications });
          } catch (error) {
            void submit(payload);
            throw new errors_1.AppExecutionError(error);
          }
          const buffer = builder.getBuffer();
          return submit({
            fieldsChanges: buffer.getFormChanges(),
            screenTabsChanges: buffer.getScreenTabsChanges(),
            changeId
          });
        } catch (error) {
          if (onBridgeError && !(error instanceof errors_1.AppExecutionError)) {
            onBridgeError({ error: errors_1.ON_INIT_ERROR, changeId, cause: error });
          }
          throw error;
        }
      }
      exports.onInit = onInit;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/onChange.js
  var require_onChange = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/onChange.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.onChange = void 0;
      var apiBuilder_1 = require_apiBuilder();
      var getInternalAPI_1 = require_getInternalAPI();
      var errors_1 = require_errors();
      async function onChange(onChangeCallback, registerOnChangeFieldsCallback) {
        const { actions: { submit, registerFields, subscribeToChanges, onBridgeError } } = await (0, getInternalAPI_1.getInternalAPI)();
        return subscribeToChanges(async ({ changedFieldId, changeId, currentFormState, currentScreenTabsState = [], uiModifications }) => {
          try {
            const builder = new apiBuilder_1.ApiBuilder(currentFormState, currentScreenTabsState);
            const api = builder.build();
            const fieldChange = {
              current: api.getFieldById(changedFieldId)
            };
            let fieldsDeclared;
            const payload = {
              fieldsChanges: {},
              screenTabsChanges: [],
              changeId
            };
            try {
              fieldsDeclared = registerOnChangeFieldsCallback({ uiModifications, change: fieldChange });
            } catch (error) {
              void submit(payload);
              throw new errors_1.AppExecutionError(error);
            }
            void registerFields({ fields: fieldsDeclared, changeId });
            try {
              await onChangeCallback({ uiModifications, change: fieldChange, api });
            } catch (error) {
              void submit(payload);
              throw new errors_1.AppExecutionError(error);
            }
            const buffer = builder.getBuffer();
            return submit({
              fieldsChanges: buffer.getFormChanges(),
              screenTabsChanges: buffer.getScreenTabsChanges(),
              changeId
            });
          } catch (error) {
            if (onBridgeError && !(error instanceof errors_1.AppExecutionError)) {
              onBridgeError({ error: errors_1.SUBSCRIBE_TO_CHANGES_ERROR, changeId, cause: error });
            }
            throw error;
          }
        });
      }
      exports.onChange = onChange;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/onError.js
  var require_onError = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/onError.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.onError = void 0;
      var getInternalAPI_1 = require_getInternalAPI();
      var errors_1 = require_errors();
      async function onError(errorCallback) {
        const { actions: { subscribeToErrors, onBridgeError } } = await (0, getInternalAPI_1.getInternalAPI)();
        try {
          if (!subscribeToErrors)
            return;
          if (!errorCallback) {
            throw new errors_1.AppExecutionError("errorCallback is required");
          }
          if (typeof errorCallback !== "function") {
            throw new errors_1.AppExecutionError("errorCallback should be a function");
          }
          return subscribeToErrors(({ errors }) => {
            if (errors === null || errors === void 0 ? void 0 : errors.length) {
              try {
                errorCallback({ errors });
              } catch (error) {
                throw new errors_1.AppExecutionError(error);
              }
            }
          });
        } catch (error) {
          if (onBridgeError && !(error instanceof errors_1.AppExecutionError)) {
            onBridgeError({ error: errors_1.ON_ERROR_ERROR, cause: error });
          }
          throw error;
        }
      }
      exports.onError = onError;
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/types/field-api.js
  var require_field_api = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/types/field-api.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.REQUEST_TYPE_CF_TYPE = exports.PROJECT_CF_TYPE = exports.CASCADING_SELECT_CF_TYPE = exports.NUMBER_CF_TYPE = exports.RADIO_BUTTONS_CF_TYPE = exports.DATETIME_CF_TYPE = exports.TARGET_END_CF_TYPE = exports.TARGET_START_CF_TYPE = exports.DATE_PICKER_CF_TYPE = exports.PEOPLE_CF_TYPE = exports.CHECKBOXES_CF_TYPE = exports.MULTI_USER_CF_TYPE = exports.USER_CF_TYPE = exports.URL_CF_TYPE = exports.TEXTFIELD_CF_TYPE = exports.PARAGRAPH_CF_TYPE = exports.MULTISELECT_CF_TYPE = exports.SELECT_CF_TYPE = void 0;
      exports.SELECT_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:select";
      exports.MULTISELECT_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:multiselect";
      exports.PARAGRAPH_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:textarea";
      exports.TEXTFIELD_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:textfield";
      exports.URL_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:url";
      exports.USER_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:userpicker";
      exports.MULTI_USER_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker";
      exports.CHECKBOXES_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes";
      exports.PEOPLE_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:people";
      exports.DATE_PICKER_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:datepicker";
      exports.TARGET_START_CF_TYPE = "com.atlassian.jpo:jpo-custom-field-baseline-start";
      exports.TARGET_END_CF_TYPE = "com.atlassian.jpo:jpo-custom-field-baseline-end";
      exports.DATETIME_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:datetime";
      exports.RADIO_BUTTONS_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons";
      exports.NUMBER_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:float";
      exports.CASCADING_SELECT_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect";
      exports.PROJECT_CF_TYPE = "com.atlassian.jira.plugin.system.customfieldtypes:project";
      exports.REQUEST_TYPE_CF_TYPE = "com.atlassian.servicedesk:vp-origin";
    }
  });

  // node_modules/@forge/jira-bridge/out/ui-modifications/index.js
  var require_ui_modifications = __commonJS({
    "node_modules/@forge/jira-bridge/out/ui-modifications/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.uiModificationsApi = exports.REQUEST_TYPE_CF_TYPE = void 0;
      var onInit_1 = require_onInit();
      var onChange_1 = require_onChange();
      var onError_1 = require_onError();
      var field_api_1 = require_field_api();
      Object.defineProperty(exports, "REQUEST_TYPE_CF_TYPE", { enumerable: true, get: function() {
        return field_api_1.REQUEST_TYPE_CF_TYPE;
      } });
      exports.uiModificationsApi = {
        onInit: onInit_1.onInit,
        onChange: onChange_1.onChange,
        onError: onError_1.onError
      };
    }
  });

  // node_modules/@forge/jira-bridge/out/custom-field/getCustomFieldInternalAPI.js
  var require_getCustomFieldInternalAPI = __commonJS({
    "node_modules/@forge/jira-bridge/out/custom-field/getCustomFieldInternalAPI.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getCustomFieldInternalAPI = void 0;
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      async function getCustomFieldInternalAPI() {
        var _a, _b;
        let internalAPI;
        try {
          internalAPI = await callBridge("getCustomFieldInternalAPI");
          return internalAPI;
        } catch (err) {
          (_b = (_a = internalAPI === null || internalAPI === void 0 ? void 0 : internalAPI.actions) === null || _a === void 0 ? void 0 : _a.onBridgeError) === null || _b === void 0 ? void 0 : _b.call(_a, { error: errors_1.GET_API_ERROR, cause: err });
          const message = err instanceof Error ? err.message : String(err);
          throw new errors_1.BridgeAPIError("Unable to initialize custom field module: " + message);
        }
      }
      exports.getCustomFieldInternalAPI = getCustomFieldInternalAPI;
    }
  });

  // node_modules/@forge/jira-bridge/out/custom-field/getFieldData.js
  var require_getFieldData = __commonJS({
    "node_modules/@forge/jira-bridge/out/custom-field/getFieldData.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getFieldData = void 0;
      var errors_1 = require_errors();
      var getCustomFieldInternalAPI_1 = require_getCustomFieldInternalAPI();
      async function getFieldData(callback) {
        const { actions: { onFieldDataChange, onBridgeError } } = await (0, getCustomFieldInternalAPI_1.getCustomFieldInternalAPI)();
        try {
          if (!callback || typeof callback !== "function") {
            throw new Error("getFieldData requires a callback method");
          }
          return Promise.resolve(onFieldDataChange((fieldData) => {
            try {
              callback(fieldData);
            } catch (error) {
              throw new errors_1.AppExecutionError(error);
            }
          }));
        } catch (error) {
          if (onBridgeError && !(error instanceof errors_1.AppExecutionError)) {
            onBridgeError({ error: errors_1.ON_FIELD_DATA_CHANGE_ERROR, cause: error });
          }
          throw error;
        }
      }
      exports.getFieldData = getFieldData;
    }
  });

  // node_modules/@forge/jira-bridge/out/custom-field/index.js
  var require_custom_field = __commonJS({
    "node_modules/@forge/jira-bridge/out/custom-field/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.customFieldApi = void 0;
      var getFieldData_1 = require_getFieldData();
      exports.customFieldApi = {
        getFieldData: getFieldData_1.getFieldData
      };
    }
  });

  // node_modules/@forge/jira-bridge/out/index.js
  var require_out = __commonJS({
    "node_modules/@forge/jira-bridge/out/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_modal(), exports);
      tslib_1.__exportStar(require_workflow(), exports);
      tslib_1.__exportStar(require_ui_modifications(), exports);
      tslib_1.__exportStar(require_custom_field(), exports);
    }
  });

  // static/workflow-postfunction/src/index.js
  var import_jira_bridge = __toESM(require_out());
  var onConfigureFn = async () => JSON.stringify({ version: 1 });
  import_jira_bridge.workflowRules.onConfigure(onConfigureFn).catch((error) => {
    console.error("[workflow-postfunction] onConfigure \uB4F1\uB85D \uC2E4\uD328", error);
  });
})();
