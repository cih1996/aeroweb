
  
  // 初始化全局命名空间
  if (!window.__polyAppsCommon) {
    window.__polyAppsCommon = {};
  }
  
  // detectSection 函数
  window.__polyAppsCommon.detectSection = function(el) {
    let node = el;
    while (node) {
      const cls = node.className || "";
      if (cls.includes("sku")) return "sku";
      if (cls.includes("basic")) return "basic";
      if (cls.includes("variant")) return "variant";
      node = node.parentElement;
    }
    return "root";
  };
  
  // getFiberPath 函数
  window.__polyAppsCommon.getFiberPath = function(fiber) {
    const names = [];
    let f = fiber;
    while (f) {
      const t = f.elementType;
      if (t && typeof t === "function" && t.name) {
        names.unshift(t.name);
      }
      f = f.return;
    }
    return names.join(">");
  };
  
  // getReactFiber 函数
  window.__polyAppsCommon.getReactFiber = function(el) {
    return Object.keys(el)
      .map(k => el[k])
      .find(v => v && v.memoizedProps);
  };
  
  // hasValueLike 函数
  window.__polyAppsCommon.hasValueLike = function(p) {
    return Object.keys(p).some(k =>
      /value|checked|click|selected|current|model|state/i.test(k)
    );
  };
  
  // hasWritableBehavior 函数
  window.__polyAppsCommon.hasWritableBehavior = function(p) {
    return Object.entries(p).some(([k, v]) => {
      if (typeof v !== "function") return false;
  
      // 常见写状态语义
      return (
        /change|input|click|update|set|select|commit|submit/i.test(k)
      );
    });
  };
  
  // findFormControlFiber 函数
  window.__polyAppsCommon.findFormControlFiber = function(el, maxDepth = 25) {
    let f = window.__polyAppsCommon.getReactFiber(el);
    let depth = 0;
  
    while (f && depth++ < maxDepth) {
      const p = f.memoizedProps;
  
      if (p && typeof p === "object") {
        const writable = window.__polyAppsCommon.hasWritableBehavior(p);
        const valueLike = window.__polyAppsCommon.hasValueLike(p);
  
        if (writable || valueLike) {
          return {
            fiber: f,
            props: p,
            depth
          };
        }
      }
      f = f.return;
    }
    return null;
  };
  
  // buildStablePrimaryKey 函数
  window.__polyAppsCommon.buildStablePrimaryKey = function({ section, type, semantic }) {
    const base = [
      section,
      type,
      semantic.testId || "",
      semantic.placeholder || "",
      semantic.labelText || "",
    ].join("|");
    return `${section}/${type}@${window.__polyAppsCommon.stableHash(base)}`;
  };
  
  // stableHash 函数
  window.__polyAppsCommon.stableHash = function(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(36);
  };
  
  // extractSemantic 函数
  window.__polyAppsCommon.extractSemantic = function(el, props) {
    return {
      placeholder: el.placeholder || null,
      testId: el.dataset?.testid || null,
      maxLength: props.maxLength || null,
      labelText: el
        .closest("label")
        ?.innerText?.trim()
        ?.slice(0, 20) || null
    };
  };
  
  // extractBehavior 函数
  window.__polyAppsCommon.extractBehavior = function(props) {
    return {
      hasOnChange: typeof props.onChange === "function",
      hasOnSelect: typeof props.onSelect === "function",
      isSelectLike: Array.isArray(props.options),
    };
  };
  
  // buildDomHint 函数
  window.__polyAppsCommon.buildDomHint = function(el) {
    return {
      tag: el.tagName,
      path: window.__polyAppsCommon.getDomPath(el).slice(-120), // 只保留尾部
    };
  };
  
  // getDomPath 函数
  window.__polyAppsCommon.getDomPath = function(el) {
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      }
      const siblings = Array.from(el.parentNode.children)
        .filter(e => e.tagName === el.tagName);
      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(el) + 1})`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(" > ");
  };
  
  // indexFieldInstances 函数
  window.__polyAppsCommon.indexFieldInstances = function(fields) {
    const groups = {};
    fields.forEach(f => {
      if (!groups[f.primaryKey]) {
        groups[f.primaryKey] = [];
      }
      groups[f.primaryKey].push(f);
    });
  
    // 给每个实例一个 instanceIndex
    Object.values(groups).forEach(list => {
      list.forEach((f, idx) => {
        f.instanceIndex = idx; // 0-based
      });
    });
  
    return fields;
  };
  
  // getFieldByInstance 函数
  window.__polyAppsCommon.getFieldByInstance = function(fields, primaryKey, instanceIndex) {
    return fields.find(
      f =>
        f.primaryKey === primaryKey &&
        f.instanceIndex === instanceIndex
    );
  };
  
  // scanStableFields 函数
  window.__polyAppsCommon.scanStableFields = function(selectStr,parentEl) {
    const fields = [];
  
    parentEl.querySelectorAll(selectStr).forEach(el => {
      const found = window.__polyAppsCommon.findFormControlFiber(el);
      if (!found) return;
      
      const { fiber, props } = found;
      const section = window.__polyAppsCommon.detectSection(el);
      const fiberPath = window.__polyAppsCommon.getFiberPath(fiber);
      const type = props.options ? "select" : "input";
  
      const fingerprint = {
        primaryKey: window.__polyAppsCommon.buildStablePrimaryKey({
                        section,
                        type,
                        semantic: window.__polyAppsCommon.extractSemantic(el, props)
                  }),
        section,
        type,
        semantic: window.__polyAppsCommon.extractSemantic(el, props),
        behavior: window.__polyAppsCommon.extractBehavior(props),
        domHint: window.__polyAppsCommon.buildDomHint(el),
        el,
        set(value) {
          try {
            props.onChange({ target: { value } });
          } catch {
            props.onChange(value);
          }
        }
      };
  
      fields.push(fingerprint);
    });
  
    return window.__polyAppsCommon.indexFieldInstances(fields);
  };
  
  // defaultCommitOption 函数
  window.__polyAppsCommon.defaultCommitOption = function(el) {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  
