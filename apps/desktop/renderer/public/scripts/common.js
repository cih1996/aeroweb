
  
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
  window.__polyAppsCommon.findFormControlFiber = function(el) {
    let f = window.__polyAppsCommon.getReactFiber(el);
    // 优先循环 f.return 查找function
    while (f) {
      const p = f.memoizedProps;
      if (!p) { f = f.return; continue;}
      const hasWritable = typeof p.onChange === "function" || typeof p.onSelect === "function";
      const hasValueLike = "value" in p || "checked" in p || "selected" in p || Array.isArray(p.options);
      if (hasWritable && hasValueLike) {
        return { fiber: f, props: p };
      }
      f = f.return;
    }
    // 如果没找到 function，回到最初的 object
    f = window.__polyAppsCommon.getReactFiber(el);
    if (f && typeof f.memoizedProps === "object" && f.memoizedProps !== null) {
      return { fiber: f, props: f.memoizedProps };
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
    if(!parentEl){
      parentEl = document;
    }
    parentEl.querySelectorAll(selectStr).forEach(el => {
      const found = window.__polyAppsCommon.findFormControlFiber(el);
      if (!found) return;
      
      const { props } = found;
      const section = window.__polyAppsCommon.detectSection(el);
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
  

/**
 * 一次性拦截指定 URL 的 Response.json，支持 await，同步返回结果，支持多个URL（数组模糊匹配）。
 * @param {string|RegExp|Array<string|RegExp>} matchUrl - 要匹配拦截的 URL（字符串、正则或其数组）
 * @param {number} timeout - 超时时间（毫秒），默认 5000
 * @returns {Promise<Array<{ match: string|RegExp, url: string, data: any }>>} - 拦截到的响应数据数组，包含匹配配置与响应
 *
 * 用法示例:
 *   await window.__polyAppsCommon.interceptResponseOnce(['/api/one', /api\/two/], 5000);
 *
 * 注意：超时只 resolve 已拦截到的数据数组（未全部命中也不报错，不 reject）。
 */
window.__polyAppsCommon.interceptResponseOnce = async function(matchUrl, timeout = 5000) {
  return new Promise((resolve) => {
    let timer = null;
    let matchFns = [];
    let urlKeys = [];
    let isArrayMode = Array.isArray(matchUrl);

    // 参数归一化
    if (isArrayMode) {
      if (matchUrl.length === 0) {
        resolve([]);
        return;
      }
      matchUrl.forEach((item) => {
        if (typeof item === 'string') {
          matchFns.push(url => url.includes(item));
          urlKeys.push(item);
        } else if (item instanceof RegExp) {
          matchFns.push(url => item.test(url));
          urlKeys.push(item);
        } else {
          resolve([]);
          return;
        }
      });
    } else if (typeof matchUrl === 'string') {
      matchFns = [url => url.includes(matchUrl)];
      urlKeys = [matchUrl];
      isArrayMode = false;
    } else if (matchUrl instanceof RegExp) {
      matchFns = [url => matchUrl.test(url)];
      urlKeys = [matchUrl];
      isArrayMode = false;
    } else {
      resolve([]);
      return;
    }

    // 标记，避免重复 hook
    const responseProto = Response.prototype;
    if (!responseProto.__polyAppsOriginJson) {
      responseProto.__polyAppsOriginJson = responseProto.json;
    }
    if (!window.__polyAppsResponseInterceptorActiveCount) {
      window.__polyAppsResponseInterceptorActiveCount = 0;
    }
    window.__polyAppsResponseInterceptorActiveCount++;

    if (!window.__polyAppsResponseInterceptorInjected) {
      responseProto.json = function() {
        return responseProto.__polyAppsOriginJson.apply(this, arguments).then(data => {
          try {
            const url = this.url || '';
            if (window.__polyAppsInterceptResponseOnceHandlers && window.__polyAppsInterceptResponseOnceHandlers.length > 0) {
              window.__polyAppsInterceptResponseOnceHandlers.forEach(handler => handler(url, data));
            }
          } catch (e) {
            console.error('[NetworkInterceptor] 处理响应数据时出错:', e);
          }
          return data;
        });
      };
      window.__polyAppsResponseInterceptorInjected = true;
      window.__polyAppsInterceptResponseOnceHandlers = [];
    }

    // 收集所有已命中的数据
    let capturedResults = [];
    let capturedIndexSet = new Set();

    // handler
    const handler = (url, data) => {
      for (let i = 0; i < matchFns.length; i++) {
        if (!capturedIndexSet.has(i) && matchFns[i](url)) {
          capturedResults.push({
            match: urlKeys[i],
            url,
            data
          });
          capturedIndexSet.add(i);
        }
      }
      // 如果全部都捕获到，直接返回
      if (capturedIndexSet.size === matchFns.length) {
        cleanup();
        resolve(capturedResults);
      }
    };
    window.__polyAppsInterceptResponseOnceHandlers.push(handler);

    // 超时保护
    timer = setTimeout(() => {
      cleanup();
      // 只返回已拦截到的数据（顺序不保证）
      resolve(capturedResults);
    }, timeout);

    // 恢复和清理 hook
    function cleanup() {
      clearTimeout(timer);
      const idx = window.__polyAppsInterceptResponseOnceHandlers.indexOf(handler);
      if (idx > -1) {
        window.__polyAppsInterceptResponseOnceHandlers.splice(idx, 1);
      }
      window.__polyAppsResponseInterceptorActiveCount--;
      if (window.__polyAppsResponseInterceptorActiveCount <= 0) {
        if (responseProto.__polyAppsOriginJson) {
          responseProto.json = responseProto.__polyAppsOriginJson;
        }
        window.__polyAppsInterceptResponseOnceHandlers = [];
        window.__polyAppsResponseInterceptorInjected = false;
        window.__polyAppsResponseInterceptorActiveCount = 0;
      }
    }
  });
}