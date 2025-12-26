
// 填充商品信息
async function temu_fillProduct(goodsTitle,imagesUrl) {
  
	function defaultCommitOption(el) {
	  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
	  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
	  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	}
	  
	function beastOptionMatcher(labelOrValue) {
	  const options = Array.from(
		document.querySelectorAll('ul[role="listbox"] li[role="option"]')
	  ).filter(li => li.offsetParent !== null);

	  return options.find(li => {
		const text = li.innerText.replace(/\s+/g, "");
		return text.includes(labelOrValue);
	  });
	}

	async function selectCommitCore({inputEl,value, matchOption,commitOption}) {
	  const found = window.__polyAppsCommon.findFormControlFiber(inputEl);
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

	function inputCommit(inputEl, value) {
	  const found = window.__polyAppsCommon.findFormControlFiber(inputEl);
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

	async function selectBeast(inputEl, value, labelOrValue) {
	  await selectCommitCore({
		inputEl,
		value,
		matchOption: () => beastOptionMatcher(labelOrValue),
		commitOption: defaultCommitOption
	  });
	}

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


	try {
		var tasks = [
			{ key: "root/input@yn6ngo", type: "input", idx: 0, value: goodsTitle },
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
			{ key: "root/input@1ynbays", type: "select", idx: 17, value: "Polyester", label: "聚酯纤维(涤纶）" },
			{ key: "root/input@1ynbays", type: "select", idx: 22, value: "Polyester", label: "聚酯纤维(涤纶）" },
			{ key: "root/input@1ynbays", type: "select", idx: 18, value: "Pullovers", label: "套头衫" },
			{ key: "root/input@1ynbays", type: "select", idx: 19, value: "Short Sleeve", label: "短袖" },
			{ key: "root/input@1ynbays", type: "select", idx: 23, value: "heat transfer printing", label: "热转移印" },
			{ key: "root/input@1ynbays", type: "select", idx: 26, value: "Stock", label: "现货款" },
		];
		  
		async function runTasksSequentially(tasks,imgs, delay = 100, refreshDelay = 1050) {
			  let fields = window.__polyAppsCommon.scanStableFields("input, textarea, select, div[class^=\"upload-trigge\"]");
			  console.log('[FillProduct] 扫描到字段数量:', fields.length);

			  for (const task of tasks) {
				console.log('[FillProduct] 处理任务:', task);
				const target = window.__polyAppsCommon.getFieldByInstance(fields, task.key, task.idx);
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
				  fields = window.__polyAppsCommon.scanStableFields("input, textarea, select, div[class^=\"upload-trigge\"]");
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
			  console.log(goods,"待设置的主图轮播图数据")
			  const target = window.__polyAppsCommon.getFieldByInstance(fields, "root/input@1p7pdjj", 0);
			  const found = window.__polyAppsCommon.findFormControlFiber(target.el);
			  found.props.onChange(goods);
		}
	  

		(function waitForFieldsAndRun() {
			const fields = window.__polyAppsCommon.scanStableFields("input, textarea, select, div[class^=\"upload-trigge\"]");
			if (fields.length > 80) {
			  setTimeout(()=>{runTasksSequentially(tasks,imagesUrl)}, 3000);
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
  


function temu_getSearchResults(){
	const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
	const rootData = root[containerKey];

	function walkFiber(fiber, visit) {
	  if (!fiber) return;
	  const result = visit(fiber);
	  if (result !== undefined) return result;
	  if (fiber.child) {
		const childResult = walkFiber(fiber.child, visit);
		if (childResult !== undefined) return childResult;
	  }
	  if (fiber.sibling) {
		const siblingResult = walkFiber(fiber.sibling, visit);
		if (siblingResult !== undefined) return siblingResult;
	  }
	  return undefined;
	}

	return walkFiber(rootData.stateNode.current, fiber => {
		const p = fiber.memoizedProps;
		if (p?.dataSource && p?.border && p?.rowKey) {
      if(p.dataSource.length > 0){
          return p.dataSource.map(item => ({id: item.id,imgUrl: item.imgUrl, materialName: item.materialName}));
      }
		}
	}) || null;
}

// 搜索指定图片ID并拿到图片地址等信息
async function temu_searchImages(imageIdsString) {
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

    async function selectCommitCore({
      inputEl,
      value,
      matchOption,
      commitOption
    }) {
      const found = window.__polyAppsCommon.findFormControlFiber(inputEl);
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
    
    function defaultCommitOption(el) {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    
    function beastOptionMatcher(labelOrValue) {
      const options = Array.from(
        document.querySelectorAll('ul[role="listbox"] li[role="option"]')
      ).filter(li => li.offsetParent !== null);
    
      return options.find(li => {
        const text = li.innerText.replace(/\s+/g, "");
        return text.includes(labelOrValue);
      });
    }
    
    function inputCommit(inputEl, value) {
      const found = window.__polyAppsCommon.findFormControlFiber(inputEl);
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
    
    async function selectBeast(inputEl, value, labelOrValue) {
      await selectCommitCore({
        inputEl,
        value,
        matchOption: () => beastOptionMatcher(labelOrValue),
        commitOption: defaultCommitOption
      });
    }
    
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
    
  try {
    console.log('[SearchImages] 开始执行搜索任务，图片ID:', imageIdsString);
    let fields = window.__polyAppsCommon.scanStableFields("input, textarea, select");
    let target = window.__polyAppsCommon.getFieldByInstance(fields, "root/input@klzkzj", 1);
    await setFieldValue({type: "select", el: target.el,value: "素材ID",label: "素材ID"});
    await new Promise(r => setTimeout(r, 1000));
    fields = window.__polyAppsCommon.scanStableFields("input, textarea, select");
    target = window.__polyAppsCommon.getFieldByInstance(fields, "root/input@m4xuf3", 0);
    await setFieldValue({type: "input", el: target.el, value: imageIdsString });
    setTimeout(function() {
      pressEnter(target.el);
    }, 300);

	//等待搜索结果
	console.log('[SearchImages] 3秒后获取搜索结果');
    await new Promise(r => setTimeout(r, 3000));
	
    const searchResults = temu_getSearchResults();
    console.log('[SearchImages] 搜索结果:', searchResults);
    return { success: true, message: '搜索脚本已执行', data: searchResults };
  } catch (error) {
    console.error('[SearchImages] 搜索脚本执行失败:', error);
    return { success: false, error: String(error.message || error), data: null };
  }
}


// 模拟点击上传图片,使其触发内部的自动提交图片流程
// 提交的图片数量,用于内部检测是否触发上传逻辑
async function temu_clickUploadImage(count) {
	try {
		// 查找所有按钮
		const buttons = Array.from(document.querySelectorAll('button'));
		// 查找包含"上传素材"文本的按钮
		const uploadButton = buttons.find(btn => {
		  const span = btn.querySelector('span');
		  const text = span ? span.textContent : '';
		  const innerText = btn.innerText || btn.textContent || '';
		  return (text && text.includes('上传素材')) || (innerText && innerText.includes('上传素材'));
		});
		
		if (uploadButton) {
		  try {
			if (uploadButton.click) {
			  uploadButton.click();
			} else if (uploadButton.dispatchEvent) {
			  const clickEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window
			  });
			  uploadButton.dispatchEvent(clickEvent);
			}

			// 记录实际需要上传的图片数量
			let actualCount = 0;
			// 等待拿到图片ID组
			let imgIds = "";
			let result_network = await window.__polyAppsCommon.interceptResponseOnce(['phoenix-mms/material/queryByMd5','phoenix-mms/material/create'], 5000);
			for (let networkData of result_network){
				console.log("[TemuUploadPanel] 网络数据:", networkData);
				if (networkData.url && networkData.url.includes('phoenix-mms/material/create')) {
					if (networkData.data && networkData.data.result && Array.isArray(networkData.data.result.responseDetailList)) {
						actualCount = networkData.data.result.responseDetailList.length;
					}
				}
				let idStr = networkData.data.result.responseDetailList.map(x => x.id).join(' ');
				imgIds += idStr + " "
			}

			// 判断imgIds数量，如果和count一致则无需等待15秒；否则等
			console.log("[TemuUploadPanel] 当前上传图片数量:"+count+"，实际上传图片数量:"+ actualCount)
			if (actualCount > 0) {
				await window.__polyAppsCommon.interceptResponseOnce(['/phoenix-mms/material/edit'], 15000);
				console.log("[TemuUploadPanel] 图片上传完成或已超时");
			}

			let result = await temu_searchImages(imgIds);
			console.log("[TemuUploadPanel] 搜索结果:", result);
			return { success: true, data: result};
		  } catch (clickErr) {
			console.error('[TemuUploadPanel] 点击时出错:', clickErr);
			return { success: false, error: String(clickErr.message || clickErr) };
		  }
		}
		return { success: false, error: '未找到上传按钮'};
	  } catch (e) {
		return { success: false, error: String(e.message || e) };
	  }
}

