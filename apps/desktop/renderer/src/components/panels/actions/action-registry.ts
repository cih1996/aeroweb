/**
 * Action注册表
 * 用于动态注册和调用action方法，实现通用性
 */

import * as commonActions from './common-actions';
import * as douyinActions from './douyin-actions';
import * as temuActions from './temu-actions';

// Action注册表类型
type ActionModule = {
  [key: string]: (...args: any[]) => Promise<any>;
};

// 通用actions（所有应用都可用）
const commonActionRegistry: ActionModule = {
  delay: commonActions.delay,
  getBrowserInfo: commonActions.getBrowserInfo,
  waitForPageLoad: commonActions.waitForPageLoad,
  scrollPage: commonActions.scrollPage,
  getElementInfo: commonActions.getElementInfo,
};

// 应用特定的actions
const appActionRegistry: { [appId: string]: ActionModule } = {
  douyin: {
    getVideoInfo: douyinActions.getVideoInfo,
    digg: douyinActions.digg,
    next: douyinActions.next,
    toJingXuan: douyinActions.toJingXuan,
    getComments: douyinActions.getComments,
    sendComment: douyinActions.sendComment,
    getCurrentInfo: douyinActions.getCurrentInfo,
  },
  tiktok: {
    getVideoInfo: douyinActions.getVideoInfo,
    digg: douyinActions.digg,
    next: douyinActions.next,
    toJingXuan: douyinActions.toJingXuan,
    getComments: douyinActions.getComments,
    sendComment: douyinActions.sendComment,
    getCurrentInfo: douyinActions.getCurrentInfo,
  },
  temu: {
    searchImages: temuActions.searchImages,
    fillProduct: temuActions.fillProduct,
    clickUploadImage: temuActions.clickUploadImage,
  },
};

/**
 * 动态注册action（用于扩展）
 * @param appId 应用ID，如果为null则注册为通用action
 * @param actionName action名称
 * @param actionFn action函数
 */
export function registerAction(
  appId: string | null,
  actionName: string,
  actionFn: (...args: any[]) => Promise<any>
): void {
  if (appId) {
    if (!appActionRegistry[appId]) {
      appActionRegistry[appId] = {};
    }
    appActionRegistry[appId][actionName] = actionFn;
  } else {
    commonActionRegistry[actionName] = actionFn;
  }
}

/**
 * 获取action函数
 * @param appId 应用ID
 * @param actionName action名称
 * @returns action函数，如果不存在返回null
 */
export function getAction(
  appId: string | null,
  actionName: string
): ((...args: any[]) => Promise<any>) | null {
  // 先查找应用特定的action
  if (appId && appActionRegistry[appId] && appActionRegistry[appId][actionName]) {
    return appActionRegistry[appId][actionName];
  }
  
  // 再查找通用action
  if (commonActionRegistry[actionName]) {
    return commonActionRegistry[actionName];
  }
  
  return null;
}

/**
 * 获取所有可用的action列表
 * @param appId 应用ID
 * @returns action名称列表
 */
export function getAvailableActions(appId: string | null): string[] {
  const actions = new Set<string>();
  
  // 添加通用actions
  Object.keys(commonActionRegistry).forEach(action => actions.add(action));
  
  // 添加应用特定的actions
  if (appId && appActionRegistry[appId]) {
    Object.keys(appActionRegistry[appId]).forEach(action => actions.add(action));
  }
  
  return Array.from(actions);
}

