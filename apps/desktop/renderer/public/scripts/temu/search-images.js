function pressEnter(el) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  }));
  el.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,   
    which: 13,
    bubbles: true,
    cancelable: true
  }));
}


function detectSection(el) {
  let node = el;
  while (node) {
    const cls = node.className || "";
    if (cls.includes("sku")) return "sku";
    if (cls.includes("basic")) return "basic";
    if (cls.includes("variant")) return "variant";
    node = node.parentElement;
  }
  return "root";
}


function getFiberPath(fiber) {
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
}

function getReactFiber(el) {
  return Object.keys(el)
    .map(k => el[k])
    .find(v => v && v.memoizedProps);
}


function findFormControlFiber(el) {
  let f = getReactFiber(el);
  while (f) {
    const p = f.memoizedProps;
    if (!p) {
      f = f.return;
      continue;
    }

    const writable =
      typeof p.onChange === "function" ||
      typeof p.onSelect === "function";

    const hasValueLike =
      "value" in p ||
      "checked" in p ||
      "selected" in p ||
      Array.isArray(p.options);

    if (writable && hasValueLike) {
      return { fiber: f, props: p };
    }

    f = f.return;
  }
  return null;
}

function buildPrimaryKey({ section, fiberPath, type }) {
  const clean = normalizeFiberPath(fiberPath);
  return `${section}/${type}@${stableHash(clean)}`;
}

function normalizeFiberPath(path) {
  return path
    .split(">")
    .filter(p =>
      !p.includes("Provider") &&
      !/^[a-zA-Z]$/.test(p) && // 去掉 m n t 这种
      !p.includes("$")
    )
    .join(">");
}

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}

function extractSemantic(el, props) {
  return {
    placeholder: el.placeholder || null,
    testId: el.dataset?.testid || null,
    maxLength: props.maxLength || null,
    labelText: el
      .closest("label")
      ?.innerText?.trim()
      ?.slice(0, 20) || null
  };
}

function extractBehavior(props) {
  return {
    hasOnChange: typeof props.onChange === "function",
    hasOnSelect: typeof props.onSelect === "function",
    isSelectLike: Array.isArray(props.options),
  };
}

function buildDomHint(el) {
  return {
    tag: el.tagName,
    path: getDomPath(el).slice(-120), // 只保留尾部
  };
}

function getDomPath(el) {
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
}


function scanStableFields() {
  const fields = [];

  document.querySelectorAll("input, textarea, select").forEach(el => {
    const found = findFormControlFiber(el);
    if (!found) return;

    const { fiber, props } = found;
    const section = detectSection(el);
    const fiberPath = getFiberPath(fiber);
    const type = props.options ? "select" : "input";

    const fingerprint = {
      primaryKey: buildPrimaryKey({ section, fiberPath, type }),
      section,
      type,
      semantic: extractSemantic(el, props),
      behavior: extractBehavior(props),
      domHint: buildDomHint(el),
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

  return indexFieldInstances(fields);
}


function indexFieldInstances(fields) {
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
}

function getFieldByInstance(fields, primaryKey, instanceIndex) {
  return fields.find(
    f =>
      f.primaryKey === primaryKey &&
      f.instanceIndex === instanceIndex
  );
}


// 针对特殊的select
async function selectCommitCore({
  inputEl,
  value,
  matchOption,
  commitOption
}) {
  const found = findFormControlFiber(inputEl);
  if (!found) throw new Error("未找到 input fiber");

  const { props } = found;

  // Step 1：输入态（打开下拉）
  props.onChange({
    target: { value }
  });

  // Step 2：等待下拉出现
  await new Promise(r => setTimeout(r, 0));

  // Step 3：找到 option
  const optionEl = matchOption();
  if (optionEl){ commitOption(optionEl); }

  
}

//通用提交策略
function defaultCommitOption(el) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

//针对temu站点例子
function beastOptionMatcher(labelOrValue) {
  const options = Array.from(
    document.querySelectorAll('ul[role="listbox"] li[role="option"]')
  ).filter(li => li.offsetParent !== null);

  return options.find(li => {
    const text = li.innerText.replace(/\s+/g, "");
    return text.includes(labelOrValue);
  });
}

//封装input
function inputCommit(inputEl, value) {
  const found = findFormControlFiber(inputEl);
  if (!found) throw new Error("未找到 input fiber");

  const { props } = found;

  // 写入值（核心）
  props.onChange({
    target: {
      value
    }
  });

  // 有些表单在 blur 时才 commit
  props.onBlur && props.onBlur({
    target: inputEl,
    currentTarget: inputEl
  });
}

//封装select
async function selectBeast(inputEl, value, labelOrValue) {
  await selectCommitCore({
    inputEl,
    value,
    matchOption: () => beastOptionMatcher(labelOrValue),
    commitOption: defaultCommitOption
  });
}


/**
 * 统一字段写入入口
 * @param {Object} options
 * @param {"select"|"input"} options.type - 字段类型（显式指定）
 * @param {HTMLElement} options.el - input DOM 元素
 * @param {string} options.value - 内部 value / 输入值
 * @param {string} [options.label] - select 显示用 label
 */
async function setFieldValue({ type, el, value, label }) {
  if (!el) throw new Error("el 不能为空");

  switch (type) {
    case "select":
      // label 必须提供（或 value 本身就是可见文本）
      await selectBeast(el, value, label || value);
      break;

    case "input":
      inputCommit(el, value);
      break;

    default:
      throw new Error("未知字段类型: " + type);
  }
}


async function runSearchImages(imageIdsString) {
  try {

    console.log('[SearchImages] 开始执行搜索任务，图片ID:', imageIdsString);

    var tasks = [
      { key: "root/input@19jga6x", type: "select", idx: 2, value: "素材ID", refresh: true },
      { key: "root/input@19jga6x", type: "input", idx: 3, value: imageIdsString }
    ];

    async function runTasksSequentially(tasks, delay = 100, refreshDelay = 1050) {
      let fields = scanStableFields();
      console.log('[SearchImages] 扫描到字段数量:', fields.length);

      for (const task of tasks) {
        console.log('[SearchImages] 处理任务:', task);
        const target = getFieldByInstance(fields, task.key, task.idx);
        if (target && target.el) {
          console.log('[SearchImages] 找到目标字段:', target);
          if (task.type == "select") {
            await setFieldValue({
              type: "select",
              el: target.el,
              value: task.value,
              label: task.label
            });
            console.log('[SearchImages] 已设置 select 字段');
          }
          if (task.type == "input") {
            await setFieldValue({
              type: "input",
              el: target.el,
              value: task.value
            });
            console.log('[SearchImages] 已设置 input 字段');
          }
        } else {
          console.warn('[SearchImages] 未找到目标字段:', task.key, task.idx);
        }
        await new Promise(r => setTimeout(r, delay));
        // 如果本次操作后需要刷新控件，则等待稍长时间并重新扫描
        if (task.refresh) {
          await new Promise(r => setTimeout(r, refreshDelay));
          fields = scanStableFields();
          console.log('[SearchImages] 刷新后扫描到字段数量:', fields.length);
        }
      }
    }

    // 调用此函数开始执行
    await runTasksSequentially(tasks);

    // 等待一下，然后触发搜索
    await new Promise(r => setTimeout(r, 200));
    
    var fields = scanStableFields();
    const target = getFieldByInstance(fields, "root/input@19jga6x", 3);
    if (target && target.el) {
      console.log('[SearchImages] 找到输入框，准备触发搜索');
      const found = findFormControlFiber(target.el);
      setTimeout(function() {
        pressEnter(target.el);
        console.log('[SearchImages] 已触发 Enter 键');
      }, 100);
    } else {
      console.warn('[SearchImages] 未找到输入框');
    }
    
    return { success: true, message: '搜索脚本已执行' };
  } catch (error) {
    console.error('[SearchImages] 搜索脚本执行失败:', error);
    return { success: false, error: String(error.message || error) };
  }
}

// 如果是在浏览器环境中直接执行，则立即运行
if (typeof window !== 'undefined' && window.TemuUtils) {
  // 可以通过 window.__searchImagesArgs 传递参数
  if (window.__searchImagesArgs) {
    runSearchImages(window.__searchImagesArgs).then(result => {
      window.__searchImagesResult = result;
    });
  }
}

