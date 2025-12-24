// 获取活动视频页面
function douyin_getActivity(){
	let parents = document.querySelectorAll("div[data-e2e='feed-active-video']");
	let max_size = 0;
	let activity_el;
	for (let el of parents){
		current_size = el.clientWidth * el.clientHeight;
		if(current_size > max_size){
			max_size = current_size
			activity_el = el;
		}
	}
	return activity_el;
}

// 获取当前视频信息
function douyin_getVideoInfo(){
    let parentEl = douyin_getActivity();
    if(!parentEl){
        return {"success":false,"msg":"当前不在视频播放页面,可能在直播画面,请尝试继续切换下一条,如多次无效请检查当前URL"}
    }
    let info = {};
    let keys = ["video-desc","feed-video-nickname","video-player-digg","feed-comment-icon","video-player-collect","video-player-share"]
    let fileds = __polyAppsCommon.scanStableFields("div[data-e2e]",parentEl)
    for (let fl of fileds) {
       let e2e = fl.el.getAttribute("data-e2e")
       for (let key of keys){
           if(e2e == key){
               info[key] = fl.el.textContent
           }
       }
    }
	
	
	info["time-current"] = parentEl.querySelector(".time-current").textContent
	info["time-duration"] = parentEl.querySelector(".time-duration").textContent
	info["video-create-time"] = parentEl.querySelector(".video-create-time").textContent
	
    return info
}

// 获取评论区信息 (pageCount=翻页次数,0则不翻页,提供参数后会先翻页在一次性获取多条评论)
async function douyin_getComments(pageCout = 0){
	function findChildByText(parent, text) {
	  let res = null;
	  const children = parent.children;
	  for (let i = 0; i < children.length; i++) {
		const el = children[i];
		if (el.textContent.trim().includes(text)) {
		  res = el;
		  break;
		}
	  }
	  return res;
	}
	
	let parentEl = douyin_getActivity();
    if(!parentEl){
        return {"success":false,"msg":"当前不在视频播放页面,可能在直播画面,请尝试继续切换下一条,如多次无效请检查当前URL"}
    }
	
	// 检查评论区是否已经打开
	if(!douyin_getActivity().querySelector("div[data-e2e='comment-list']")){
		let parentEl = douyin_getActivity();
		let fileds = __polyAppsCommon.scanStableFields("div[data-e2e]",parentEl)
		for (let fl of fileds) {
		   let e2e = fl.el.getAttribute("data-e2e")
		   if(e2e == "feed-comment-icon"){
			   //打开评论,并延迟1秒在获取评论数据
				__polyAppsCommon.defaultCommitOption(fl.el)
				await new Promise(r => setTimeout(r, 1000));
		   }
		}
	}
	
	if(pageCout > 0){
		for(let i = 0; i < pageCout; i++){
			douyin_getActivity().querySelector("div[data-e2e='comment-list']").scrollTop += 5000
			await new Promise(r => setTimeout(r, 1500));
		}
	}

	let commentEls = douyin_getActivity().querySelector("div[data-e2e='comment-list']").querySelectorAll("div[data-e2e='comment-item']")
	let comments = []
	let index = 0;
	for (let comment of commentEls) {
		let reply = comment.querySelector(".comment-reply-expand-btn");
		let infowrap = comment.querySelector(".comment-item-info-wrap")
        let replyCount = "0";
		if(reply){
            replyCount = reply.textContent.replace("展开","").replace("条回复","");
		}
		
		if(infowrap){
			let nickname = comment.querySelector(".comment-item-info-wrap").textContent.replace("...","")
            let digg = comment.querySelector(".comment-item-stats-container").textContent.replace("分享回复","");
			let replyBtn = findChildByText(comment.querySelector(".comment-item-stats-container"),"回复").children[0];
			let commentStr = comment.querySelector(".comment-item-info-wrap").nextElementSibling.textContent
			let timeZone = comment.querySelector(".comment-item-info-wrap").nextElementSibling.nextElementSibling.textContent
			 if(commentStr){
				item = {
					"index":index,
					"comment":commentStr,
					"nickname":nickname,
                    "digg":digg,
                    "replyCount":replyCount,
					"timeZone":timeZone,
					"replyBtn":replyBtn
				}
				index++;
				comments.push(item)
			}
		}
	}
	window.__douyin_comments = comments;
	return comments
}

// 发送评论 (index=指定回复索引)
async function pasteIntoDraft(text,index = -1) {

	if(index != -1){
		if(index >= window.__douyin_comments.length){
			return {"success":false,"msg":"指定索引超出评论范围"}
		}
		window.__douyin_comments[index].replyBtn.click();
		await new Promise(r => setTimeout(r, 500));
	}
	
	document.querySelector('.comment-input-inner-container').click()
	await new Promise(r => setTimeout(r, 500));
	const editor = document.querySelector('.public-DraftEditor-content[contenteditable="true"]');
  editor.focus();
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const pasteEvent = new ClipboardEvent("paste", {
    clipboardData,
    bubbles: true,
    cancelable: true
  });
  editor.dispatchEvent(pasteEvent);
  setTimeout(() => {document.querySelector('.comment-input-inner-container').childNodes[1].childNodes[0].childNodes[4].click()},500)
  return {"success":true,"msg":"评论发送成功"}
}

// 点赞当前视频
function douyin_digg(){
	let parentEl = douyin_getActivity();
    if(!parentEl){
		return {"success":false,"msg":"当前不在视频播放页面,可能在直播画面,请尝试继续切换下一条,如多次无效请检查当前URL"}
    }
	let fileds = __polyAppsCommon.scanStableFields("div[data-e2e='video-player-digg']",parentEl)
	if(fileds.length>0){
		if(fileds[0].el.getAttribute("data-e2e-state") == "video-player-no-digged"){
            fileds[0].el.click()
        }
	}
	return {"success":true,"msg":"点赞成功"}
}

// 下一条视频
async function douyin_next() {
  const downEvent = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true
  });

  const upEvent = new KeyboardEvent("keyup", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true
  });

  document.dispatchEvent(downEvent);
  document.dispatchEvent(upEvent);
  await new Promise(r => setTimeout(r, 800));
  let info = douyin_getVideoInfo()
  return info
}

// 前往视频精选区
function douyin_toJingXuan(){
	if(document.URL.indexOf("https://www.douyin.com/?recommend=1") !== -1){
		document.location.href = "https://www.douyin.com/?recommend=1"
	}
	return {"success":true,"msg":"前往视频精选区成功"}
}

// 个人资料
function douyin_getCurrentInfo(){
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
      if (p && p.uInfo) {
        return p.uInfo;
      }
    }) || null;
}
