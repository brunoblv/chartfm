/* @ds-bundle: {"namespace":"ChartFM","components":[{"name":"ChartFMLogo","sourcePath":"components/general/ChartFMLogo/ChartFMLogo.jsx"},{"name":"Cover","sourcePath":"components/general/Cover/Cover.jsx"},{"name":"MovementBadge","sourcePath":"components/general/MovementBadge/MovementBadge.jsx"},{"name":"PositionNumber","sourcePath":"components/general/PositionNumber/PositionNumber.jsx"},{"name":"VideoClipCover","sourcePath":"components/general/VideoClipCover/VideoClipCover.jsx"}],"sourceHashes":{"components/general/ChartFMLogo/ChartFMLogo.jsx":"dfa166d142d5","components/general/ChartFMLogo/ChartFMLogo.d.ts":"f72fb4437eab","components/general/ChartFMLogo/ChartFMLogo.prompt.md":"764001bf11cf","components/general/Cover/Cover.jsx":"d5d3e35633b4","components/general/Cover/Cover.d.ts":"16159bd8c3a7","components/general/Cover/Cover.prompt.md":"a4d24fa5ccc8","components/general/MovementBadge/MovementBadge.jsx":"5cda6739acdc","components/general/MovementBadge/MovementBadge.d.ts":"c44352d267a8","components/general/MovementBadge/MovementBadge.prompt.md":"041d325edd04","components/general/PositionNumber/PositionNumber.jsx":"9d1d88f42b41","components/general/PositionNumber/PositionNumber.d.ts":"cdcef732f177","components/general/PositionNumber/PositionNumber.prompt.md":"79e38f8625c2","components/general/VideoClipCover/VideoClipCover.jsx":"266041181f7a","components/general/VideoClipCover/VideoClipCover.d.ts":"83a6862f8a20","components/general/VideoClipCover/VideoClipCover.prompt.md":"f002373332b9"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
"use strict";
var ChartFM = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
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

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx6(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs5(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx6;
      module.exports.jsxs = jsxs5;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs5 : jsx6)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/ui-entry.tsx
  var ui_entry_exports = {};
  __export(ui_entry_exports, {
    ChartFMLogo: () => ChartFMLogo,
    Cover: () => Cover,
    MovementBadge: () => MovementBadge,
    PositionNumber: () => PositionNumber,
    VideoClipCover: () => VideoClipCover
  });
  init_define_import_meta_env();

  // components/ui/ChartFMLogo.tsx
  init_define_import_meta_env();
  var import_jsx_runtime = __toESM(require_react_shim());
  function ChartFMLogo({
    size = 32,
    style
  }) {
    const gradId = "chartfm-logo-grad";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 88 88",
        fill: "none",
        style: { display: "block", flexShrink: 0, ...style },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { width: "88", height: "88", rx: "20", fill: `url(#${gradId})` }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "22", y: "50", width: "10", height: "20", rx: "3", fill: "white", opacity: "0.85" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "39", y: "36", width: "10", height: "34", rx: "3", fill: "white", opacity: "0.92" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "56", y: "20", width: "10", height: "50", rx: "3", fill: "white" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "88", y2: "88", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { stopColor: "#FA243C" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "#FF5858" })
          ] }) })
        ]
      }
    );
  }

  // components/ui/MovementBadge.tsx
  init_define_import_meta_env();
  var import_jsx_runtime2 = __toESM(require_react_shim());
  function MovementBadge({ status, delta, compact = false }) {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontSize: compact ? 10 : 11,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      padding: compact ? "1px 5px" : "2px 7px",
      borderRadius: 6,
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
      flexShrink: 0
    };
    const sz = compact ? 9 : 10;
    if (status === "new") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...base, background: "#000", color: "#fff" }, "aria-label": "nova entrada", children: "NOVA" });
    }
    if (status === "return") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...base, background: "#111827", color: "#FFFFFF" }, "aria-label": "retorno", children: "RETORNO" });
    }
    if (status === "same") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...base, background: "#F2F2F7", color: "#6B6B70" }, "aria-label": "est\xE1vel", children: "\u2015" });
    }
    if (status === "up") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { ...base, background: "#E8F8EE", color: "#1B873F" }, "aria-label": `subiu ${delta} posi\xE7\xF5es`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: sz, height: sz, viewBox: "0 0 10 10", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 1 L9 8 L1 8 Z", fill: "currentColor" }) }),
        delta
      ] });
    }
    if (status === "down") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { ...base, background: "#FDECEC", color: "#C5291C" }, "aria-label": `caiu ${Math.abs(delta ?? 0)} posi\xE7\xF5es`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: sz, height: sz, viewBox: "0 0 10 10", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 9 L1 2 L9 2 Z", fill: "currentColor" }) }),
        Math.abs(delta ?? 0)
      ] });
    }
    return null;
  }

  // components/ui/PositionNumber.tsx
  init_define_import_meta_env();
  var import_jsx_runtime3 = __toESM(require_react_shim());
  function PositionNumber({ n, size = 22 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          fontSize: size,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          minWidth: size * 1.6,
          textAlign: "right"
        },
        children: n
      }
    );
  }

  // components/ui/VideoClipCover.tsx
  init_define_import_meta_env();
  var import_jsx_runtime4 = (
    // eslint-disable-next-line @next/next/no-img-element
    __toESM(require_react_shim())
  );
  function VideoClipCover({
    imageUrl,
    paletteA = "#FA243C",
    paletteB = "#FFE66D",
    seed = 0,
    width: widthProp = 320,
    height: heightProp,
    matchSiblingHeight = false,
    className,
    style: extraStyle
  }) {
    const fixedWidth = heightProp != null ? Math.round(heightProp * (16 / 9)) : widthProp;
    const fixedHeight = heightProp ?? Math.round(widthProp * (9 / 16));
    const angle = seed % 360;
    const iconSize = matchSiblingHeight ? 24 : fixedWidth * 0.18;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        className,
        style: {
          width: matchSiblingHeight ? "auto" : fixedWidth,
          height: matchSiblingHeight ? "100%" : fixedHeight,
          aspectRatio: matchSiblingHeight ? "16 / 9" : void 0,
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: "0 1px 4px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(0,0,0,0.06)",
          ...extraStyle
        },
        children: imageUrl ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "img",
          {
            src: imageUrl,
            alt: "Captura do clipe",
            style: {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${angle}deg, ${paletteA} 0%, ${paletteB} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "svg",
              {
                width: iconSize,
                height: iconSize,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "rgba(255,255,255,0.6)",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("polygon", { points: "23 7 16 12 23 17 23 7" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: "1", y: "5", width: "15", height: "14", rx: "2", ry: "2" })
                ]
              }
            )
          }
        )
      }
    );
  }

  // components/ui/Cover.tsx
  init_define_import_meta_env();
  var import_jsx_runtime5 = (
    // eslint-disable-next-line @next/next/no-img-element
    __toESM(require_react_shim())
  );
  function Cover({ cover, song, size = 56, rounded = 10, className, style: extraStyle }) {
    const direct = cover.imageUrl || song?.imageUrl || null;
    const imageUrl = direct;
    const [a, b] = cover.palette;
    const seed = cover.seed;
    const variant = seed % 5;
    const angle = seed % 360;
    const alt = song ? `Capa de ${song.title} \u2014 ${song.artist}` : "Capa do \xE1lbum";
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        className,
        style: {
          width: size || "100%",
          height: size || "100%",
          borderRadius: rounded,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.06)",
          ...extraStyle
        },
        children: imageUrl ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "img",
          {
            src: imageUrl,
            alt,
            style: {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`
              }
            }
          ),
          variant === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at ${30 + seed % 40}% ${20 + seed % 50}%, rgba(255,255,255,0.35), transparent 55%)`
              }
            }
          ),
          variant === 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size * 0.6,
                height: size * 0.6,
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)"
              }
            }
          ),
          variant === 2 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: `linear-gradient(${angle + 90}deg, transparent 40%, rgba(0,0,0,0.15) 60%, transparent 80%)`
              }
            }
          ),
          variant === 3 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                background: "linear-gradient(0deg, rgba(0,0,0,0.25), transparent)"
              }
            }
          ),
          variant === 4 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                inset: "15%",
                borderRadius: "50%",
                border: `${Math.max(1, size * 0.04)}px solid rgba(255,255,255,0.3)`
              }
            }
          )
        ] })
      }
    );
  }
  return __toCommonJS(ui_entry_exports);
})();
window.ChartFM=ChartFM.__dsMainNs?Object.assign({},ChartFM,ChartFM.__dsMainNs,{__dsMainNs:undefined}):ChartFM;
