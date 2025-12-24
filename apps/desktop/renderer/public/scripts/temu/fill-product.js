
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


function buildStablePrimaryKey({ section, type, semantic }) {
  const base = [
    section,
    type,
    semantic.testId || "",
    semantic.placeholder || "",
    semantic.labelText || "",
  ].join("|");
  return `${section}/${type}@${stableHash(base)}`;
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

  document.querySelectorAll("input, textarea, select, div[class^=\"upload-trigge\"]").forEach(el => {
    const found = findFormControlFiber(el);
    if (!found) return;

    const { fiber, props } = found;
    const section = detectSection(el);
    const fiberPath = getFiberPath(fiber);
    const type = props.options ? "select" : "input";

    const fingerprint = {
      primaryKey: buildStablePrimaryKey({
					  section,
					  type,
					  semantic: extractSemantic(el, props)
				}),
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
  props.onChange({
    target: {
      value
    }
  });
  
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
      setTimeout(()=>{inputCommit(el, value);},1000);
      break;

    default:
      throw new Error("未知字段类型: " + type);
  }
}




  
  
async function runFillProduct(goodsTitle,imagesUrl) {

  

  try {
    var tasks = [
        { key: "root/input@yn6ngo", type: "input", idx: 0, value: "测试测试商品名称" },
        { key: "root/input@1ynbays", type: "select", idx: 0, value: "中国",refresh: true},
        { key: "root/input@1jocp1u", type: "select", idx: 0, value: "江西" },
        { key: "root/input@1ynbays", type: "select", idx: 1, value: "Polyester", label: "聚酯纤维(涤纶）" },
        { key: "root/input@1ynbays", type: "select", idx: 2, value: "Casual", label: "休闲" },
        { key: "root/input@1ynbays", type: "select", idx: 3, value: "machine washable, no dry clean", label: "数码印花类可机洗且不可干洗" },
        { key: "root/input@1ynbays", type: "select", idx: 4, value: "Summer", label: "夏" },
        { key: "root/input@1ynbays", type: "select", idx: 5, value: "Tops", label: "上衣" },
        { key: "root/input@1ynbays", type: "select", idx: 6, value: "Crew Neck", label: "圆领" },
        { key: "root/input@1ynbays", type: "select", idx: 7, value: "Slight Stretch", label: "微弹" },
        { key: "root/input@1ynbays", type: "select", idx: 8, value: "No", label: "否" },
        { key: "root/input@1ynbays", type: "select", idx: 9, value: "Random Print", label: "随机印花" },
        { key: "root/input@1ynbays", type: "select", idx: 10, value: "None", label: "无" },
        { key: "root/input@1ynbays", type: "select", idx: 11, value: "Polyester", label: "聚酯纤维(涤纶）" },
        { key: "root/input@z5aym7", type: "input", idx: 0, value: "100" },
      
        { key: "root/input@1ynbays", type: "select", idx: 12, value: "Regular", label: "常规" },
        { key: "root/input@1ynbays", type: "select", idx: 13, value: "Knit Fabric", label: "针织" },
        { key: "root/input@1ynbays", type: "select", idx: 14, value: "Smooth fabric", label: "光面", refresh: true },
        { key: "root/input@16o8ilq", type: "input", idx: 0, value: "140" },
        { key: "root/input@1ynbays", type: "select", idx: 15, value: "No Lining", label: "无里料" },
        { key: "root/input@1ynbays", type: "select", idx: 16, value: "Men", label: "男士" },
        { key: "root/input@1ynbays", type: "select", idx: 22, value: "Polyester", label: "聚酯纤维(涤纶）" },
        { key: "root/input@1ynbays", type: "select", idx: 18, value: "Pullovers", label: "套头衫" },
        { key: "root/input@1ynbays", type: "select", idx: 19, value: "Short Sleeve", label: "短袖" },
        { key: "root/input@1ynbays", type: "select", idx: 23, value: "heat transfer printing", label: "热转移印" },
        { key: "root/input@1ynbays", type: "select", idx: 25, value: "Smooth fabric", label: "光面", refresh: true },
        { key: "root/input@16o8ilq", type: "input", idx: 1, value: "140" },
        { key: "root/input@1ynbays", type: "select", idx: 26, value: "Stock", label: "现货款" },
      ];
      
      async function runTasksSequentially(tasks,imgs, delay = 100, refreshDelay = 1050) {
          let fields = scanStableFields();
          console.log('[FillProduct] 扫描到字段数量:', fields.length);
    
          for (const task of tasks) {
            console.log('[FillProduct] 处理任务:', task);
            const target = getFieldByInstance(fields, task.key, task.idx);
            if (target && target.el) {
              console.log('[FillProduct] 找到目标字段:', target);
              if (task.type == "select") {
                await setFieldValue({
                  type: "select",
                  el: target.el,
                  value: task.value,
                  label: task.label
                });
                console.log('[FillProduct] 已设置 select 字段');
              }
              if (task.type == "input") {
                await setFieldValue({
                  type: "input",
                  el: target.el,
                  value: task.value
                });
                console.log('[FillProduct] 已设置 input 字段');
              }
            } else {
              console.warn('[FillProduct] 未找到目标字段:', task.key, task.idx);
            }
            await new Promise(r => setTimeout(r, delay));
            // 如果本次操作后需要刷新控件，则等待稍长时间并重新扫描
            if (task.refresh) {
              await new Promise(r => setTimeout(r, refreshDelay));
              fields = scanStableFields();
            }
          }

                    
          // 根据传入的 imgs 数组拼接 goods，uid 从20开始递增
          let goods = (imgs || []).map((url, idx) => ({
            uid: `material-center-carousel-image-${20 + idx}`,
            url,
            status: "done",
            beautifyTag: 0,
            isTranslate: false
          }));

          const target = getFieldByInstance(fields, "root/input@1p7pdjj", 0);
          const found = findFormControlFiber(target.el);
          found.props.onChange(goods);

      }
  

      (function waitForFieldsAndRun() {
        const fields = scanStableFields();
        console.log('[FillProduct] 检测到字段数量:', fields.length);
        if (fields.length > 80) {
          setTimeout(()=>{runTasksSequentially(tasks,imagesUrl)}, 5000);
        } else {
          setTimeout(waitForFieldsAndRun, 1000);
        }
      })();
   
      return { success: true, message: '填充商品信息脚本已执行' };
    } catch (error) {
      console.error('[FillProduct] 填充商品信息脚本执行失败:', error);
      return { success: false, error: String(error.message || error) };
    }
}
  
  
  