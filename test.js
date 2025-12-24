/**
 * MSESessionObserver - 智能拦截网页视频媒体流
 * 
 * 功能：
 * - 自动拦截和监控 Media Source Extensions (MSE) 视频流
 * - 区分不同视频会话
 * - 保存和拼接视频数据块
 * - 生成可下载的 URL
 * - 提供预览功能
 * 
 * 使用示例：
 * 
 * // 1. 创建观察器实例
 * const observer = new MSESessionObserver({
 *   debug: true,           // 启用调试日志
 *   saveChunks: true,      // 保存数据块（默认 true）
 *   silenceMs: 3000,       // 3秒无数据视为静默
 *   tickMs: 250,           // 每250ms检查一次
 *   finishWaitMs: 2000,    // 会话完成后的额外等待时间（确保数据完整）
 *   downloadWaitTimeout: 30000, // 下载前等待会话完成的最大时间
 * });
 * 
 * // 2. 启动观察
 * observer.start();
 * 
 * // 3. 监听事件
 * observer.on('sessionStart', (data) => {
 *   console.log('新会话开始:', data);
 * });
 * 
 * observer.on('sessionEndPending', (data) => {
 *   console.log('会话即将结束（等待确认）:', data);
 * });
 * 
 * observer.on('sessionEnd', (data) => {
 *   console.log('会话已确认结束:', data);
 *   // 自动下载视频（会自动等待完成）
 *   observer.downloadSession(data.id, `video_${data.id}`);
 * });
 * 
 * observer.on('append', (data) => {
 *   console.log('数据追加:', data.byteLength, 'bytes');
 * });
 * 
 * // 4. 获取所有会话
 * const sessions = observer.getSessions();
 * console.log('所有会话:', sessions);
 * 
 * // 5. 生成下载 URL
 * const url = observer.generateDownloadUrl(sessionId, 'video/mp4');
 * console.log('下载 URL:', url);
 * 
 * // 6. 生成预览
 * await observer.generatePreview(sessionId, '#preview-video', 'video/mp4');
 * 
 * // 7. 手动下载（会自动等待会话完成，如果数据分散会自动合并）
 * await observer.downloadSession(sessionId, 'my-video', 'video/mp4');
 * 
 * // 或者手动等待会话完成后再下载
 * const completed = await observer.waitForSessionComplete(sessionId);
 * if (completed) {
 *   observer.downloadSession(sessionId, 'my-video', 'video/mp4', false);
 * }
 * 
 * // 8. 如果数据分散到多个会话，可以手动合并下载
 * const relatedSessions = observer.findRelatedSessions(sessionId);
 * const sessionIds = [sessionId, ...relatedSessions.map(r => r.sessionId)];
 * await observer.downloadMergedSessions(sessionIds, 'merged-video', 'video/mp4');
 * 
 * // 9. 诊断会话数据完整性
 * const diagnosis = observer.diagnoseSession(sessionId);
 * console.log('诊断信息:', diagnosis);
 * 
 * // 8. 停止观察
 * observer.stop();
 * 
 * // 9. 清理内存（释放数据块）
 * observer.clearAllChunks();
 */
class MSESessionObserver {
    constructor(options = {}) {
      this.opts = {
        // 多久没有 appendBuffer 视为"静默"
        silenceMs: options.silenceMs ?? 3000,
        // bufferedEnd 距 duration 多近视为"缓冲完成"
        bufferedEpsilon: options.bufferedEpsilon ?? 0.5,
        // 轮询检查间隔
        tickMs: options.tickMs ?? 250,
        // 如何选"当前 video"
        pickVideo: options.pickVideo ?? (() => document.querySelector("video")),
        // 是否打印调试
        debug: !!options.debug,
        // 是否保存实际数据块（用于拼接和下载）
        saveChunks: options.saveChunks !== false, // 默认 true
        // 最大保存的会话数量（防止内存泄漏）
        maxSessions: options.maxSessions ?? 50,
        // 会话完成后的额外等待时间（确保数据完整，毫秒）
        finishWaitMs: options.finishWaitMs ?? 2000,
        // 下载前等待会话完成的最大时间（毫秒）
        downloadWaitTimeout: options.downloadWaitTimeout ?? 30000,
      };
  
      this._listeners = new Map();
      this._installed = false;
  
      this._raw = {
        appendBuffer: null,
        addSourceBuffer: null,
        endOfStream: null,
        createObjectURL: null,
      };
  
      this._timer = null;
  
      // session state
      this._sessionId = 0;
      this._sessions = new Map(); // id -> session
      this._currentVideo = null;
      this._lastVideoSrc = null;
      this._videoFingerprint = null; // 用于区分不同视频
  
      // weak maps to tag objects without leaking memory
      this._msInfo = new WeakMap(); // MediaSource -> {id, createdAt, blobUrl?}
      this._sbInfo = new WeakMap(); // SourceBuffer -> {msId, mime, createdAt, sessionId}
      this._objUrlToMs = new Map(); // blobUrl -> MediaSource (best-effort)
      
      // 静态引用（用于 hook 中访问实例）
      MSESessionObserver._instances = MSESessionObserver._instances || new WeakSet();
      MSESessionObserver._instances.add(this);
    }
  
    on(event, fn) {
      if (!this._listeners.has(event)) this._listeners.set(event, new Set());
      this._listeners.get(event).add(fn);
      return () => this.off(event, fn);
    }
  
    off(event, fn) {
      const set = this._listeners.get(event);
      if (set) set.delete(fn);
    }
  
    emit(event, payload) {
      const set = this._listeners.get(event);
      if (!set) return;
      for (const fn of set) {
        try { fn(payload); } catch (e) { /* ignore */ }
      }
    }
  
    log(...args) {
      if (this.opts.debug) console.log("[MSEObserver]", ...args);
    }
  
    start() {
      if (this._installed) return;
      this._installed = true;
  
      this._installHooks();
      this._startTicker();
  
      this.log("started");
    }
  
    stop() {
      if (!this._installed) return;
      this._installed = false;
  
      this._uninstallHooks();
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
  
      this.log("stopped");
    }
  
    // ============ Core: Session management ============
  
    _ensureVideoBinding() {
      const video = this.opts.pickVideo?.();
      if (!video) return;
  
      const curSrc = video.currentSrc || video.src || null;
      const curFingerprint = this._generateVideoFingerprint(video, curSrc);
  
      // video element changed
      if (video !== this._currentVideo) {
        this._bindVideo(video);
        this._bumpSession("video-element-changed");
        return;
      }
  
      // 使用指纹来更准确地检测视频变化
      if (curFingerprint && curFingerprint !== this._videoFingerprint) {
        this._videoFingerprint = curFingerprint;
        this._lastVideoSrc = curSrc;
        this._bumpSession("video-fingerprint-changed");
        return;
      }
  
      // src changed (blob:... or direct)
      if (curSrc && curSrc !== this._lastVideoSrc) {
        this._lastVideoSrc = curSrc;
        this._videoFingerprint = curFingerprint;
        this._bumpSession("video-src-changed");
      }
    }
  
    _bindVideo(video) {
      this._currentVideo = video;
      this._lastVideoSrc = video.currentSrc || video.src || null;
      this._videoFingerprint = this._generateVideoFingerprint(video, this._lastVideoSrc);
  
      // Important: events that often indicate a new playback pipeline
      const bump = (reason) => {
        // 检查是否真的需要切换会话（避免同一视频播放过程中的频繁切换）
        const currentSession = this._getSession(false);
        if (currentSession && !currentSession.finished) {
          // 如果当前会话还在进行中，且视频指纹相同，不切换会话
          const newFingerprint = this._generateVideoFingerprint(video, video.currentSrc || video.src);
          if (newFingerprint === currentSession.fingerprint) {
            this.log(`跳过会话切换 (${reason}): 视频指纹相同`);
            return;
          }
        }
        this._bumpSession(reason);
      };
  
      video.addEventListener("loadstart", () => bump("loadstart"), true);
      video.addEventListener("loadedmetadata", () => {
        // 更新指纹（视频尺寸可能在此时确定）
        const newFingerprint = this._generateVideoFingerprint(video, video.currentSrc || video.src);
        // 只有在指纹真正改变时才切换会话
        if (newFingerprint !== this._videoFingerprint) {
          this._videoFingerprint = newFingerprint;
          bump("loadedmetadata");
        }
      }, true);
  
      // "ended" is strong finish signal
      video.addEventListener("ended", () => {
        const s = this._getSession();
        this._finishSession(s, "video-ended");
      }, true);
  
      // Some sites call video.load() / emptied when switching
      video.addEventListener("emptied", () => bump("emptied"), true);
    }
  
    _bumpSession(reason) {
      // finish previous if any
      const prev = this._sessions.get(this._sessionId);
      if (prev && !prev.finished) {
        this._finishSession(prev, `session-bump:${reason}`);
      }

      const oldSessionId = this._sessionId;
      this._sessionId++;
      const s = this._getSession(true);
      
      // 更新所有 SourceBuffer 的会话关联（如果它们关联到旧会话）
      // 注意：这只是一个提示，实际的关联会在 appendBuffer 时动态更新
      this.log(`会话切换: ${oldSessionId} -> ${s.id} (原因: ${reason})`);
      
      this.emit("sessionStart", { ...this._publicSession(s), reason });
      this.log("sessionStart", s.id, reason);
    }
  
    _getSession(createIfMissing = true) {
      if (!this._sessions.has(this._sessionId) && createIfMissing) {
        const v = this._currentVideo;
        const src = v ? (v.currentSrc || v.src || null) : null;
        
        // 生成视频指纹用于区分不同视频
        const fingerprint = this._generateVideoFingerprint(v, src);
  
        this._sessions.set(this._sessionId, {
          id: this._sessionId,
          createdAt: performance.now(),
          video: v || null,
          videoSrc: src,
          fingerprint: fingerprint,
          appends: 0,
          appendedBytes: 0,
          lastAppendAt: 0,
          tracks: new Map(), // key=mime -> {mime, appends, bytes, chunks: ArrayBuffer[]}
          finished: false,
          finishReason: null,
          finishConfirmed: false, // 是否经过延迟确认
          finishConfirmedAt: 0, // 确认完成的时间
          // 存储实际数据块（如果启用）
          chunks: this.opts.saveChunks ? new Map() : null, // key=mime -> ArrayBuffer[]
        });
        
        // 清理旧会话以防止内存泄漏
        this._cleanupOldSessions();
      }
      return this._sessions.get(this._sessionId);
    }
    
    _generateVideoFingerprint(video, src) {
      if (!video) return `unknown_${Date.now()}`;
      
      // 组合多个特征来区分视频
      const features = [
        src || 'no-src',
        video.videoWidth || 0,
        video.videoHeight || 0,
        video.getAttribute?.('id') || '',
        video.getAttribute?.('class') || '',
      ];
      
      return features.join('|');
    }
    
    _cleanupOldSessions() {
      if (this._sessions.size <= this.opts.maxSessions) return;
      
      // 按创建时间排序，删除最旧的已完成会话
      const sorted = Array.from(this._sessions.entries())
        .filter(([_, s]) => s.finished)
        .sort(([_, a], [__, b]) => a.createdAt - b.createdAt);
      
      const toDelete = sorted.slice(0, sorted.length - this.opts.maxSessions + this._sessions.size);
      for (const [id] of toDelete) {
        const session = this._sessions.get(id);
        // 清理数据块以释放内存
        if (session.chunks) {
          session.chunks.clear();
        }
        if (session.tracks) {
          for (const track of session.tracks.values()) {
            if (track.chunks) track.chunks = null;
          }
        }
        this._sessions.delete(id);
      }
      
      this.log(`清理了 ${toDelete.length} 个旧会话`);
    }
  
    _finishSession(session, reason) {
      if (!session || session.finished) return;
      
      // 记录完成时的状态
      const finishStartTime = performance.now();
      const finishStartAppends = session.appends;
      const finishStartBytes = session.appendedBytes;
      const finishStartLastAppend = session.lastAppendAt;
      
      // 标记为完成，但需要延迟确认
      session.finished = true;
      session.finishReason = reason;
      session.finishConfirmed = false;
      
      // 立即发出临时完成事件（用于早期通知）
      this.emit("sessionEndPending", { ...this._publicSession(session), reason, confirmed: false });
      this.log("sessionEnd (pending)", session.id, reason);
      
      // 延迟确认，确保没有更多数据到达
      setTimeout(() => {
        if (!session) return;
        
        // 检查会话是否仍然存在且处于完成状态
        if (!this._sessions.has(session.id) || !session.finished) {
          return;
        }
        
        // 检查是否有新的数据追加（通过比较完成前后的状态）
        const hasNewData = 
          session.appends > finishStartAppends ||
          session.appendedBytes > finishStartBytes ||
          session.lastAppendAt > finishStartLastAppend;
        
        if (hasNewData) {
          // 有新的数据，取消完成状态
          session.finished = false;
          session.finishReason = null;
          session.finishConfirmed = false;
          this.log("sessionEnd cancelled - new data arrived", session.id, {
            appends: `${finishStartAppends} -> ${session.appends}`,
            bytes: `${finishStartBytes} -> ${session.appendedBytes}`
          });
          return;
        }
        
        // 再次检查静默时间
        const timeSinceLastAppend = performance.now() - session.lastAppendAt;
        if (timeSinceLastAppend >= this.opts.finishWaitMs) {
          session.finishConfirmed = true;
          session.finishConfirmedAt = performance.now();
          this.emit("sessionEnd", { ...this._publicSession(session), reason });
          this.log("sessionEnd (confirmed)", session.id, reason, {
            waitTime: `${timeSinceLastAppend.toFixed(0)}ms`,
            totalBytes: `${(session.appendedBytes / 1024 / 1024).toFixed(2)} MB`,
            totalChunks: session.appends
          });
        } else {
          // 静默时间不够，继续等待
          session.finished = false;
          session.finishReason = null;
          this.log("sessionEnd cancelled - not silent enough", session.id, `还需要 ${(this.opts.finishWaitMs - timeSinceLastAppend).toFixed(0)}ms`);
        }
      }, this.opts.finishWaitMs);
    }
  
    _publicSession(session) {
      return {
        id: session.id,
        createdAt: session.createdAt,
        videoSrc: session.videoSrc,
        fingerprint: session.fingerprint,
        appends: session.appends,
        appendedBytes: session.appendedBytes,
        lastAppendAt: session.lastAppendAt,
        tracks: [...session.tracks.values()].map(t => ({
          mime: t.mime,
          appends: t.appends,
          bytes: t.bytes,
          chunkCount: t.chunks ? t.chunks.length : 0,
        })),
        finished: session.finished,
        finishConfirmed: session.finishConfirmed || false,
        finishReason: session.finishReason,
        hasChunks: session.chunks ? session.chunks.size > 0 : false,
      };
    }
  
    // ============ Hooks: MSE pipeline observation ============
  
    _installHooks() {
      // Hook URL.createObjectURL to map blob: to MediaSource
      this._raw.createObjectURL = URL.createObjectURL;
      URL.createObjectURL = (obj) => {
        const url = this._raw.createObjectURL.call(URL, obj);
        try {
          if (obj && typeof obj === "object" && obj.constructor && obj.constructor.name === "MediaSource") {
            this._msInfo.set(obj, { id: this._genId("ms"), createdAt: performance.now(), blobUrl: url });
            this._objUrlToMs.set(url, obj);
            this.log("MediaSource blob url", url);
          }
        } catch {}
        return url;
      };
  
      // Hook MediaSource.addSourceBuffer to learn mime types
      this._raw.addSourceBuffer = MediaSource.prototype.addSourceBuffer;
      const self = this;
      
      MediaSource.prototype.addSourceBuffer = function (mime) {
        // 调用原始方法
        const sb = self._raw.addSourceBuffer.call(this, mime);
        
        try {
          // 获取或创建 MediaSource 信息
          const info = self._msInfo.get(this) || { 
            id: self._genId("ms"), 
            createdAt: performance.now() 
          };
          self._msInfo.set(this, info);
          
          // 获取当前会话
          self._ensureVideoBinding();
          const session = self._getSession();
          
          // 保存 SourceBuffer 信息
          self._sbInfo.set(sb, { 
            msId: info.id, 
            mime, 
            createdAt: performance.now(),
            sessionId: session.id
          });
  
          // 监听 MediaSource 结束信号
          this.addEventListener?.("sourceended", () => {
            const s = self._getSession();
            if (s && s.id === session.id) {
              self._finishSession(s, "mediasource-sourceended");
            }
          }, { once: true });
          
          this.addEventListener?.("sourceclose", () => {
            const s = self._getSession();
            if (s && s.id === session.id) {
              self._finishSession(s, "mediasource-sourceclose");
            }
          }, { once: true });
        } catch (e) {
          self.emit("error", { where: "addSourceBuffer", error: e });
        }
        
        return sb;
      };
  
      // Hook MediaSource.endOfStream (another strong finish hint)
      this._raw.endOfStream = MediaSource.prototype.endOfStream;
      MediaSource.prototype.endOfStream = function (...args) {
        try {
          const s = self._getSession();
          self._finishSession(s, "mediasource-endofstream");
        } catch (e) {
          self.emit("error", { where: "endOfStream", error: e });
        }
        return self._raw.endOfStream.apply(this, args);
      };
  
      // Hook SourceBuffer.appendBuffer (记录元数据并保存数据块)
      this._raw.appendBuffer = SourceBuffer.prototype.appendBuffer;
      SourceBuffer.prototype.appendBuffer = function (buf) {
        try {
          self._ensureVideoBinding();
          
          const sbMeta = self._sbInfo.get(this);
          const mime = sbMeta?.mime || "unknown";
          
          // 优先使用 SourceBuffer 关联的会话 ID
          let targetSessionId = sbMeta?.sessionId;
          let s = targetSessionId ? self._sessions.get(targetSessionId) : null;
          
          // 如果 SourceBuffer 没有关联会话，或者关联的会话不存在，使用当前会话
          if (!s) {
            s = self._getSession();
            // 更新 SourceBuffer 的会话关联
            if (sbMeta) {
              sbMeta.sessionId = s.id;
              self.log(`SourceBuffer 关联到会话: ${s.id} (${mime})`);
            }
          } else {
            // SourceBuffer 已有关联会话，检查是否需要切换
            const currentS = self._getSession(false);
            
            // 如果关联的会话已确认完成，且当前有新的活动会话，才考虑切换
            if (s.finished && s.finishConfirmed && currentS && currentS.id !== s.id && !currentS.finished) {
              // 检查是否是同一个视频（通过指纹）
              if (currentS.fingerprint === s.fingerprint) {
                // 同一个视频，切换到新会话
                s = currentS;
                if (sbMeta) {
                  sbMeta.sessionId = s.id;
                }
                self.log(`SourceBuffer 切换到新会话: ${s.id} (原会话 ${targetSessionId} 已结束, 相同视频)`);
              } else {
                // 不同视频，保持原会话（可能是旧视频的延迟数据）
                self.log(`SourceBuffer 保持原会话: ${targetSessionId} (新会话 ${currentS.id} 是不同视频)`);
              }
            }
          }

          const size = buf?.byteLength ?? 0;
          if (size === 0) {
            return self._raw.appendBuffer.call(this, buf);
          }

          // 如果有新数据到达且会话已标记为完成但未确认，取消完成状态
          if (s.finished && !s.finishConfirmed) {
            s.finished = false;
            s.finishReason = null;
            self.log("取消会话完成状态 - 检测到新数据", s.id);
          }

          s.appends += 1;
          s.appendedBytes += size;
          s.lastAppendAt = performance.now();
          
          // 更新轨道统计
          const t = s.tracks.get(mime) || { 
            mime, 
            appends: 0, 
            bytes: 0,
            chunks: self.opts.saveChunks ? [] : null
          };
          t.appends += 1;
          t.bytes += size;
          
          // 保存数据块副本（如果启用）
          if (self.opts.saveChunks && buf) {
            let chunkCopy;
            // 处理不同类型的缓冲区
            if (buf instanceof ArrayBuffer) {
              chunkCopy = buf.slice(0);
            } else if (buf.buffer instanceof ArrayBuffer) {
              // TypedArray (Uint8Array, etc.)
              chunkCopy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            } else {
              // 其他类型，尝试转换为 ArrayBuffer
              try {
                chunkCopy = new Uint8Array(buf).buffer.slice(0);
              } catch (e) {
                self.log("无法保存数据块:", e);
                chunkCopy = null;
              }
            }
            
            if (chunkCopy) {
              // 验证数据块大小
              if (chunkCopy.byteLength !== size) {
                self.log(`警告: 数据块大小不匹配! 期望: ${size}, 实际: ${chunkCopy.byteLength}`, s.id, mime);
              }
              
              t.chunks.push(chunkCopy);
              
              // 同时保存到会话级别的 chunks Map
              if (!s.chunks.has(mime)) {
                s.chunks.set(mime, []);
              }
              s.chunks.get(mime).push(chunkCopy);
              
              // 定期输出保存进度（每 10MB 或每 100 个块）
              if (s.appends % 100 === 0 || s.appendedBytes % (10 * 1024 * 1024) === 0) {
                const totalChunks = s.chunks.get(mime)?.length || 0;
                const totalBytes = s.chunks.get(mime)?.reduce((sum, c) => sum + c.byteLength, 0) || 0;
                self.log(`会话 ${s.id} 数据保存进度: ${totalChunks} 块, ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${mime})`);
              }
            } else {
              self.log(`警告: 无法保存数据块 (会话 ${s.id}, ${mime}, ${size} 字节)`);
            }
          }
          
          s.tracks.set(mime, t);
  
          self.emit("append", {
            sessionId: s.id,
            mime,
            byteLength: size,
            at: s.lastAppendAt,
            videoSrc: s.videoSrc,
            fingerprint: s.fingerprint,
            totalAppends: s.appends,
            totalBytes: s.appendedBytes,
          });
        } catch (e) {
          self.emit("error", { where: "appendBuffer", error: e });
        }
  
        return self._raw.appendBuffer.call(this, buf);
      };
    }
  
    _uninstallHooks() {
      try { if (this._raw.appendBuffer) SourceBuffer.prototype.appendBuffer = this._raw.appendBuffer; } catch {}
      try { if (this._raw.addSourceBuffer) MediaSource.prototype.addSourceBuffer = this._raw.addSourceBuffer; } catch {}
      try { if (this._raw.endOfStream) MediaSource.prototype.endOfStream = this._raw.endOfStream; } catch {}
      try { if (this._raw.createObjectURL) URL.createObjectURL = this._raw.createObjectURL; } catch {}
    }
  
    _startTicker() {
      this._timer = setInterval(() => {
        try {
          this._ensureVideoBinding();

          const s = this._sessions.get(this._sessionId);
          const v = this._currentVideo;

          if (!s || s.finished || !v) return;

          // Finish rule: buffered complete + silence window
          // 更严格的检查：确保视频有足够的缓冲且静默时间足够长
          if (this._isBufferedComplete(v) && this._isSilent(s)) {
            // 额外检查：确保有足够的数据量
            if (s.appendedBytes > 0 && s.appends > 0) {
              this._finishSession(s, "buffered-complete+silent");
            }
          }

          // Also, if src changed, bump session is handled in _ensureVideoBinding
        } catch (e) {
          this.emit("error", { where: "ticker", error: e });
        }
      }, this.opts.tickMs);
    }
  
    _isSilent(session) {
      if (!session.lastAppendAt) return false;
      return (performance.now() - session.lastAppendAt) > this.opts.silenceMs;
    }
  
    _isBufferedComplete(video) {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return false;
      if (!video.buffered || video.buffered.length === 0) return false;
      const end = video.buffered.end(video.buffered.length - 1);
      return Math.abs(end - dur) <= this.opts.bufferedEpsilon;
    }
  
    _genId(prefix) {
      return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    }
  
    // ============ Public API: 获取会话和生成下载 URL ============
  
    /**
     * 获取所有会话
     * @returns {Array} 会话列表
     */
    getSessions() {
      return Array.from(this._sessions.values())
        .map(s => this._publicSession(s))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  
    /**
     * 获取指定会话
     * @param {number} sessionId 会话 ID
     * @returns {Object|null} 会话信息
     */
    getSession(sessionId) {
      const session = this._sessions.get(sessionId);
      return session ? this._publicSession(session) : null;
    }
  
    /**
     * 获取当前活动会话
     * @returns {Object|null} 当前会话信息
     */
    getCurrentSession() {
      const session = this._getSession(false);
      return session ? this._publicSession(session) : null;
    }
  
    /**
     * 合并指定会话的所有数据块
     * @param {number} sessionId 会话 ID
     * @param {string} mimeType 可选的 MIME 类型（如果不指定，返回所有轨道的合并结果）
     * @returns {Object} { [mimeType]: ArrayBuffer, ... } 或单个 ArrayBuffer
     */
    mergeChunks(sessionId, mimeType = null) {
      const session = this._sessions.get(sessionId);
      if (!session) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }
  
      if (!session.chunks || session.chunks.size === 0) {
        throw new Error(`会话 ${sessionId} 没有保存的数据块`);
      }
  
      if (mimeType) {
        // 合并指定 MIME 类型的数据块
        const chunks = session.chunks.get(mimeType);
        if (!chunks || chunks.length === 0) {
          throw new Error(`会话 ${sessionId} 没有 ${mimeType} 类型的数据块`);
        }
        return this._mergeArrayBuffers(chunks);
      } else {
        // 合并所有轨道的数据块
        const result = {};
        for (const [mime, chunks] of session.chunks.entries()) {
          if (chunks && chunks.length > 0) {
            result[mime] = this._mergeArrayBuffers(chunks);
          }
        }
        return result;
      }
    }
  
    /**
     * 合并多个 ArrayBuffer
     * @private
     */
    _mergeArrayBuffers(chunks) {
      if (chunks.length === 0) return new ArrayBuffer(0);
      if (chunks.length === 1) return chunks[0].slice(0);

      // 计算总长度
      const totalLength = chunks.reduce((sum, chunk) => {
        if (!chunk || !chunk.byteLength) {
          this.log("警告: 发现无效的数据块");
          return sum;
        }
        return sum + chunk.byteLength;
      }, 0);
      
      if (totalLength === 0) {
        this.log("警告: 所有数据块总长度为 0");
        return new ArrayBuffer(0);
      }
      
      // 创建新的 ArrayBuffer 并复制数据
      const merged = new ArrayBuffer(totalLength);
      const mergedView = new Uint8Array(merged);
      
      let offset = 0;
      let validChunks = 0;
      for (const chunk of chunks) {
        if (!chunk || !chunk.byteLength) {
          this.log("跳过无效数据块");
          continue;
        }
        try {
          mergedView.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
          validChunks++;
        } catch (e) {
          this.log("合并数据块时出错:", e, "offset:", offset, "chunk size:", chunk.byteLength);
        }
      }
      
      this.log(`合并完成: ${validChunks}/${chunks.length} 个有效数据块, 总大小: ${(totalLength / 1024 / 1024).toFixed(2)} MB`);
      
      return merged;
    }
    
    /**
     * 查找与指定会话相关的其他会话（基于视频指纹和时间）
     * @param {number} sessionId 会话 ID
     * @param {number} timeWindowMs 时间窗口（毫秒），默认 60 秒
     * @returns {Array} 相关会话列表
     */
    findRelatedSessions(sessionId, timeWindowMs = 60000) {
      const targetSession = this._sessions.get(sessionId);
      if (!targetSession) return [];
      
      const related = [];
      const targetTime = targetSession.createdAt;
      const targetFingerprint = targetSession.fingerprint;
      
      for (const [id, session] of this._sessions.entries()) {
        if (id === sessionId) continue;
        
        // 检查是否相关：相同的视频指纹，或者时间接近
        const timeDiff = Math.abs(session.createdAt - targetTime);
        const sameFingerprint = session.fingerprint === targetFingerprint;
        const timeClose = timeDiff < timeWindowMs;
        
        if (sameFingerprint || timeClose) {
          related.push({
            sessionId: id,
            session: this._publicSession(session),
            timeDiff: timeDiff,
            sameFingerprint: sameFingerprint,
            hasChunks: session.chunks && session.chunks.size > 0,
          });
        }
      }
      
      // 按时间排序
      related.sort((a, b) => a.session.createdAt - b.session.createdAt);
      
      return related;
    }
    
    /**
     * 合并多个会话的数据
     * @param {Array<number>} sessionIds 会话 ID 数组
     * @param {string} mimeType 可选的 MIME 类型
     * @returns {Object} 合并后的数据 { [mimeType]: ArrayBuffer, ... } 或单个 ArrayBuffer
     */
    mergeSessionsData(sessionIds, mimeType = null) {
      if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        throw new Error('需要至少一个会话 ID');
      }
      
      const sessions = sessionIds.map(id => {
        const s = this._sessions.get(id);
        if (!s) throw new Error(`会话 ${id} 不存在`);
        if (!s.chunks || s.chunks.size === 0) {
          this.log(`警告: 会话 ${id} 没有数据块`);
          return null;
        }
        return s;
      }).filter(Boolean);
      
      if (sessions.length === 0) {
        throw new Error('没有可用的会话数据');
      }
      
      if (mimeType) {
        // 合并指定 MIME 类型的数据
        const allChunks = [];
        for (const session of sessions) {
          const chunks = session.chunks.get(mimeType);
          if (chunks && chunks.length > 0) {
            allChunks.push(...chunks);
            this.log(`从会话 ${session.id} 添加 ${chunks.length} 个 ${mimeType} 数据块`);
          }
        }
        
        if (allChunks.length === 0) {
          throw new Error(`没有找到 ${mimeType} 类型的数据块`);
        }
        
        return this._mergeArrayBuffers(allChunks);
      } else {
        // 合并所有 MIME 类型的数据
        const result = {};
        const allMimes = new Set();
        
        for (const session of sessions) {
          for (const mime of session.chunks.keys()) {
            allMimes.add(mime);
          }
        }
        
        for (const mime of allMimes) {
          const allChunks = [];
          for (const session of sessions) {
            const chunks = session.chunks.get(mime);
            if (chunks && chunks.length > 0) {
              allChunks.push(...chunks);
            }
          }
          
          if (allChunks.length > 0) {
            result[mime] = this._mergeArrayBuffers(allChunks);
            const totalBytes = result[mime].byteLength;
            this.log(`合并 ${mime}: ${allChunks.length} 个数据块, 总计 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
          }
        }
        
        return result;
      }
    }
    
    /**
     * 诊断会话数据完整性
     * @param {number} sessionId 会话 ID
     * @returns {Object} 诊断信息
     */
    diagnoseSession(sessionId) {
      const session = this._sessions.get(sessionId);
      if (!session) {
        return { error: `会话 ${sessionId} 不存在` };
      }
      
      const diagnosis = {
        sessionId: session.id,
        finished: session.finished,
        finishConfirmed: session.finishConfirmed,
        recordedStats: {
          appends: session.appends,
          appendedBytes: session.appendedBytes,
          lastAppendAt: session.lastAppendAt,
        },
        tracks: {},
        issues: [],
      };
      
      // 检查每个轨道
      for (const [mime, track] of session.tracks.entries()) {
        const chunks = session.chunks?.get(mime) || [];
        const actualBytes = chunks.reduce((sum, c) => sum + (c?.byteLength || 0), 0);
        
        diagnosis.tracks[mime] = {
          recordedAppends: track.appends,
          recordedBytes: track.bytes,
          savedChunks: chunks.length,
          actualBytes: actualBytes,
          bytesMatch: Math.abs(actualBytes - track.bytes) < 1024, // 允许 1KB 误差
        };
        
        if (!diagnosis.tracks[mime].bytesMatch) {
          diagnosis.issues.push(`${mime}: 记录字节数 (${track.bytes}) 与实际保存字节数 (${actualBytes}) 不匹配`);
        }
        
        if (chunks.length !== track.appends) {
          diagnosis.issues.push(`${mime}: 保存的数据块数 (${chunks.length}) 与记录追加次数 (${track.appends}) 不匹配`);
        }
      }
      
      // 检查总体数据
      const totalActualBytes = Object.values(diagnosis.tracks).reduce((sum, t) => sum + t.actualBytes, 0);
      if (Math.abs(totalActualBytes - session.appendedBytes) > 1024 * 1024) {
        diagnosis.issues.push(`总体数据不匹配: 记录 ${session.appendedBytes} 字节, 实际保存 ${totalActualBytes} 字节`);
      }
      
      return diagnosis;
    }
  
    /**
     * 为指定会话生成可下载的 Blob URL
     * @param {number} sessionId 会话 ID
     * @param {string} mimeType 可选的 MIME 类型（如果不指定，返回所有轨道的 URL）
     * @returns {string|Object} Blob URL 或 { [mimeType]: blobUrl, ... }
     */
    generateDownloadUrl(sessionId, mimeType = null) {
      try {
        const merged = this.mergeChunks(sessionId, mimeType);
        const session = this._sessions.get(sessionId);
        
        if (mimeType) {
          // 单个 MIME 类型，返回单个 URL
          const blob = new Blob([merged], { type: mimeType });
          const url = URL.createObjectURL(blob);
          this.log(`生成下载 URL (${mimeType}):`, url);
          return url;
        } else {
          // 多个 MIME 类型，返回对象
          const urls = {};
          for (const [mime, data] of Object.entries(merged)) {
            const blob = new Blob([data], { type: mime });
            urls[mime] = URL.createObjectURL(blob);
            this.log(`生成下载 URL (${mime}):`, urls[mime]);
          }
          return urls;
        }
      } catch (e) {
        this.emit("error", { where: "generateDownloadUrl", sessionId, error: e });
        throw e;
      }
    }
  
    /**
     * 为指定会话生成预览（在 video 元素中播放）
     * @param {number} sessionId 会话 ID
     * @param {HTMLElement|string} target 目标 video 元素或选择器
     * @param {string} preferredMimeType 首选的 MIME 类型（如果不指定，使用第一个可用的）
     * @returns {Promise<HTMLVideoElement>} 预览 video 元素
     */
    async generatePreview(sessionId, target = null, preferredMimeType = null) {
      try {
        const session = this._sessions.get(sessionId);
        if (!session) {
          throw new Error(`会话 ${sessionId} 不存在`);
        }
  
        // 确定目标 video 元素
        let videoEl = target;
        if (typeof target === 'string') {
          videoEl = document.querySelector(target);
        }
        if (!videoEl) {
          // 创建新的 video 元素
          videoEl = document.createElement('video');
          videoEl.controls = true;
          videoEl.style.maxWidth = '100%';
          videoEl.style.maxHeight = '100%';
          document.body.appendChild(videoEl);
        }
        if (videoEl.tagName !== 'VIDEO') {
          throw new Error('目标元素必须是 video 元素');
        }
  
        // 确定要使用的 MIME 类型
        let mimeToUse = preferredMimeType;
        if (!mimeToUse && session.chunks) {
          const availableMimes = Array.from(session.chunks.keys());
          if (availableMimes.length > 0) {
            mimeToUse = availableMimes[0];
          }
        }
        if (!mimeToUse) {
          throw new Error(`会话 ${sessionId} 没有可用的数据块`);
        }
  
        // 合并数据块并创建 Blob URL
        const merged = this.mergeChunks(sessionId, mimeToUse);
        const blob = new Blob([merged], { type: mimeToUse });
        const url = URL.createObjectURL(blob);
  
        // 设置 video 源
        videoEl.src = url;
        
        // 清理 URL（当 video 加载完成后）
        videoEl.addEventListener('loadeddata', () => {
          this.log(`预览已加载 (会话 ${sessionId}, ${mimeToUse})`);
        }, { once: true });
  
        // 返回 video 元素
        return videoEl;
      } catch (e) {
        this.emit("error", { where: "generatePreview", sessionId, error: e });
        throw e;
      }
    }
  
    /**
     * 等待会话完成（如果还未完成）
     * @param {number} sessionId 会话 ID
     * @param {number} timeout 超时时间（毫秒）
     * @returns {Promise<boolean>} 是否成功完成
     */
    async waitForSessionComplete(sessionId, timeout = null) {
      const waitTimeout = timeout ?? this.opts.downloadWaitTimeout;
      const startTime = performance.now();
      
      return new Promise((resolve) => {
        const session = this._sessions.get(sessionId);
        if (!session) {
          resolve(false);
          return;
        }
        
        // 如果已经确认完成，直接返回
        if (session.finished && session.finishConfirmed) {
          resolve(true);
          return;
        }
        
        // 如果已经完成但未确认，等待确认
        if (session.finished && !session.finishConfirmed) {
          const checkConfirmed = setInterval(() => {
            if (session.finishConfirmed) {
              clearInterval(checkConfirmed);
              clearTimeout(timeoutId);
              resolve(true);
            } else if (performance.now() - startTime > waitTimeout) {
              clearInterval(checkConfirmed);
              clearTimeout(timeoutId);
              this.log(`等待会话 ${sessionId} 完成超时`);
              resolve(false);
            }
          }, 100);
          
          const timeoutId = setTimeout(() => {
            clearInterval(checkConfirmed);
            this.log(`等待会话 ${sessionId} 完成超时`);
            resolve(false);
          }, waitTimeout);
          
          return;
        }
        
        // 监听完成事件
        const onComplete = (data) => {
          if (data.id === sessionId && data.finished && data.finishConfirmed !== false) {
            cleanup();
            resolve(true);
          }
        };
        
        const onPending = (data) => {
          if (data.id === sessionId && data.finished) {
            // 等待确认
            const checkConfirmed = setInterval(() => {
              const s = this._sessions.get(sessionId);
              if (s && s.finishConfirmed) {
                clearInterval(checkConfirmed);
                clearTimeout(timeoutId);
                cleanup();
                resolve(true);
              } else if (performance.now() - startTime > waitTimeout) {
                clearInterval(checkConfirmed);
                clearTimeout(timeoutId);
                cleanup();
                this.log(`等待会话 ${sessionId} 确认完成超时`);
                resolve(false);
              }
            }, 100);
            
            const timeoutId = setTimeout(() => {
              clearInterval(checkConfirmed);
              cleanup();
              this.log(`等待会话 ${sessionId} 确认完成超时`);
              resolve(false);
            }, waitTimeout);
          }
        };
        
        const cleanup = () => {
          this.off('sessionEnd', onComplete);
          this.off('sessionEndPending', onPending);
        };
        
        this.on('sessionEnd', onComplete);
        this.on('sessionEndPending', onPending);
        
        // 超时处理
        setTimeout(() => {
          cleanup();
          this.log(`等待会话 ${sessionId} 完成超时`);
          resolve(false);
        }, waitTimeout);
      });
    }
    
    /**
     * 下载指定会话的视频
     * @param {number} sessionId 会话 ID
     * @param {string} filename 文件名（不含扩展名）
     * @param {string} preferredMimeType 首选的 MIME 类型
     * @param {boolean} waitForComplete 是否等待会话完成（默认 true）
     */
    async downloadSession(sessionId, filename = null, preferredMimeType = null, waitForComplete = true) {
      try {
        let session = this._sessions.get(sessionId);
        if (!session) {
          throw new Error(`会话 ${sessionId} 不存在`);
        }

        // 如果要求等待完成，先等待
        if (waitForComplete && (!session.finished || !session.finishConfirmed)) {
          this.log(`等待会话 ${sessionId} 完成...`);
          const completed = await this.waitForSessionComplete(sessionId);
          if (!completed) {
            this.log(`警告: 会话 ${sessionId} 可能尚未完全完成，但继续下载`);
          }
          // 重新获取会话（可能已更新）
          session = this._sessions.get(sessionId);
        }

        // 验证会话有数据
        if (!session.chunks || session.chunks.size === 0) {
          throw new Error(`会话 ${sessionId} 没有保存的数据块`);
        }

        // 验证数据量
        if (session.appendedBytes === 0 || session.appends === 0) {
          throw new Error(`会话 ${sessionId} 没有有效数据`);
        }

        // 确定文件名
        if (!filename) {
          const timestamp = new Date(session.createdAt).toISOString().replace(/[:.]/g, '-');
          filename = `video_${session.id}_${timestamp}`;
        }

        // 确定 MIME 类型
        let mimeToUse = preferredMimeType;
        if (!mimeToUse && session.chunks) {
          const availableMimes = Array.from(session.chunks.keys());
          // 优先选择 video MIME 类型
          mimeToUse = availableMimes.find(m => m.startsWith('video/')) || availableMimes[0];
        }
        if (!mimeToUse) {
          throw new Error(`会话 ${sessionId} 没有可用的数据块`);
        }

        // 验证该 MIME 类型有数据
        const chunks = session.chunks.get(mimeToUse);
        if (!chunks || chunks.length === 0) {
          throw new Error(`会话 ${sessionId} 的 ${mimeToUse} 类型没有数据块`);
        }

        // 验证数据完整性：计算实际保存的数据块总大小
        const actualTotalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const recordedBytes = session.tracks.get(mimeToUse)?.bytes || 0;
        
        // 计算所有轨道的总数据量
        let allTracksTotalBytes = 0;
        const trackInfo = [];
        for (const [mime, track] of session.tracks.entries()) {
          const trackChunks = session.chunks?.get(mime) || [];
          const trackBytes = trackChunks.reduce((sum, c) => sum + (c?.byteLength || 0), 0);
          allTracksTotalBytes += trackBytes;
          trackInfo.push({
            mime,
            chunks: trackChunks.length,
            bytes: trackBytes,
            recordedBytes: track.bytes,
          });
        }
        
        this.log(`准备下载会话 ${sessionId}:`, {
          mimeType: mimeToUse,
          chunkCount: chunks.length,
          actualBytes: `${(actualTotalBytes / 1024 / 1024).toFixed(2)} MB`,
          recordedBytes: `${(recordedBytes / 1024 / 1024).toFixed(2)} MB`,
          sessionTotalBytes: `${(session.appendedBytes / 1024 / 1024).toFixed(2)} MB`,
          allTracksTotal: `${(allTracksTotalBytes / 1024 / 1024).toFixed(2)} MB`,
          tracks: trackInfo.map(t => `${t.mime}: ${(t.bytes / 1024 / 1024).toFixed(2)} MB (${t.chunks} 块)`).join(', '),
        });

        // 如果实际保存的数据与记录的数据差异较大，发出警告
        if (Math.abs(actualTotalBytes - recordedBytes) > 1024 * 1024) { // 差异超过 1MB
          this.log(`警告: 会话 ${sessionId} 的数据大小不匹配! 实际: ${actualTotalBytes}, 记录: ${recordedBytes}`);
        }

        // 检查是否数据分散到多个轨道
        // 情况1: 单个轨道数据少，但所有轨道总数据接近记录值
        // 情况2: 单个轨道数据少，但其他轨道（特别是 unknown）数据很大
        const dataScattered = (
          (actualTotalBytes < session.appendedBytes * 0.5 && allTracksTotalBytes >= session.appendedBytes * 0.8) ||
          (actualTotalBytes < session.appendedBytes * 0.3 && allTracksTotalBytes > actualTotalBytes * 2)
        );
        
        if (dataScattered) {
          // 数据分散到多个轨道，尝试合并所有相关轨道
          this.log(`检测到数据分散到多个轨道，尝试合并所有相关轨道...`);
          
          // 优先尝试合并所有 video 轨道
          const videoMimes = Array.from(session.chunks.keys()).filter(m => 
            m.startsWith('video/') || m.includes('video')
          );
          
          // 如果 video 轨道数据很少，也考虑 unknown 轨道（可能包含视频数据）
          const unknownMime = session.chunks.has('unknown') ? 'unknown' : null;
          const unknownBytes = unknownMime ? 
            (session.chunks.get(unknownMime) || []).reduce((sum, c) => sum + (c?.byteLength || 0), 0) : 0;
          
          // 决定合并策略
          let mimesToMerge = [];
          
          if (videoMimes.length > 1) {
            // 有多个 video 轨道，合并它们
            mimesToMerge = videoMimes;
            this.log(`找到 ${videoMimes.length} 个 video 轨道: ${videoMimes.join(', ')}`);
          } else if (videoMimes.length === 1 && unknownBytes > actualTotalBytes * 2) {
            // 只有一个 video 轨道，但 unknown 轨道数据很大，可能是视频数据
            mimesToMerge = [...videoMimes, unknownMime].filter(Boolean);
            this.log(`合并 video 轨道和 unknown 轨道 (unknown 有 ${(unknownBytes / 1024 / 1024).toFixed(2)} MB)`);
          } else if (videoMimes.length === 0 && unknownBytes > 0) {
            // 没有 video 轨道，但 unknown 轨道有数据，尝试使用 unknown
            mimesToMerge = [unknownMime].filter(Boolean);
            this.log(`使用 unknown 轨道 (${(unknownBytes / 1024 / 1024).toFixed(2)} MB)`);
          }
          
          // 如果还没有找到要合并的轨道，且所有轨道总数据接近记录值，尝试合并所有非音频轨道
          if (mimesToMerge.length === 0 && allTracksTotalBytes >= session.appendedBytes * 0.8) {
            const nonAudioMimes = Array.from(session.chunks.keys()).filter(m => 
              !m.startsWith('audio/') && m !== 'audio'
            );
            if (nonAudioMimes.length > 0) {
              mimesToMerge = nonAudioMimes;
              this.log(`尝试合并所有非音频轨道: ${mimesToMerge.join(', ')}`);
            }
          }
          
          if (mimesToMerge.length > 0) {
            try {
              const allChunks = [];
              let totalMergedBytes = 0;
              for (const mime of mimesToMerge) {
                const mimeChunks = session.chunks.get(mime) || [];
                allChunks.push(...mimeChunks);
                const mimeBytes = mimeChunks.reduce((sum, c) => sum + (c?.byteLength || 0), 0);
                totalMergedBytes += mimeBytes;
                this.log(`从 ${mime} 添加 ${mimeChunks.length} 个数据块 (${(mimeBytes / 1024 / 1024).toFixed(2)} MB)`);
              }
              
              if (allChunks.length > 0) {
                this.log(`准备合并 ${allChunks.length} 个数据块，预计大小: ${(totalMergedBytes / 1024 / 1024).toFixed(2)} MB`);
                
                const merged = this._mergeArrayBuffers(allChunks);
                const mergedBytes = merged.byteLength;
                
                this.log(`合并轨道成功! 总大小: ${(mergedBytes / 1024 / 1024).toFixed(2)} MB (来自 ${mimesToMerge.length} 个轨道: ${mimesToMerge.join(', ')})`);
                
                // 使用合并后的数据，优先使用 video MIME 类型
                const finalMime = videoMimes.length > 0 ? videoMimes[0] : mimeToUse;
                const blob = new Blob([merged], { type: finalMime });
                const url = URL.createObjectURL(blob);
                
                const ext = this._getExtensionFromMime(finalMime);
                const fullFilename = filename + (ext ? `.${ext}` : '');
                
                const a = document.createElement('a');
                a.href = url;
                a.download = fullFilename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  this.log(`已下载合并后的视频: ${fullFilename} (${(mergedBytes / 1024 / 1024).toFixed(2)} MB)`);
                }, 5000);
                
                return; // 成功合并并下载
              }
            } catch (mergeError) {
              this.log("合并轨道失败:", mergeError);
            }
          }
        }

        // 如果实际保存的数据很小，但记录的数据很大，说明可能有问题
        if (actualTotalBytes < session.appendedBytes * 0.1 && session.appendedBytes > 1024 * 1024) {
          // 输出诊断信息
          const diagnosis = this.diagnoseSession(sessionId);
          this.log("数据不完整诊断信息:", diagnosis);
          
          // 查找相关会话
          const relatedSessions = this.findRelatedSessions(sessionId);
          const sessionsWithData = relatedSessions.filter(r => r.hasChunks);
          
          if (sessionsWithData.length > 0) {
            this.log(`发现 ${sessionsWithData.length} 个相关会话可能包含数据:`, sessionsWithData.map(r => ({
              id: r.sessionId,
              bytes: `${(r.session.appendedBytes / 1024 / 1024).toFixed(2)} MB`,
              tracks: r.session.tracks.map(t => `${t.mime} (${t.chunkCount} 块)`).join(', '),
              timeDiff: `${(r.timeDiff / 1000).toFixed(1)}s`,
              sameFingerprint: r.sameFingerprint
            })));
            
            // 尝试自动合并相关会话的数据
            try {
              const relatedIds = [sessionId, ...sessionsWithData.map(r => r.sessionId)];
              this.log(`尝试合并 ${relatedIds.length} 个会话的数据...`);
              
              const merged = this.mergeSessionsData(relatedIds, mimeToUse);
              const mergedBytes = merged.byteLength;
              
              this.log(`合并成功! 合并后大小: ${(mergedBytes / 1024 / 1024).toFixed(2)} MB`);
              
              // 使用合并后的数据生成下载 URL
              const blob = new Blob([merged], { type: mimeToUse });
              const url = URL.createObjectURL(blob);
              
              // 确定文件扩展名
              const ext = this._getExtensionFromMime(mimeToUse);
              const fullFilename = filename + (ext ? `.${ext}` : '');
              
              // 创建下载链接并触发下载
              const a = document.createElement('a');
              a.href = url;
              a.download = fullFilename;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              // 延迟清理 URL
              setTimeout(() => {
                URL.revokeObjectURL(url);
                this.log(`已下载合并后的视频: ${fullFilename} (${(mergedBytes / 1024 / 1024).toFixed(2)} MB)`);
              }, 5000);
              
              return; // 成功合并并下载，退出
            } catch (mergeError) {
              this.log("自动合并失败:", mergeError);
              // 继续抛出原始错误
            }
          }
          
          throw new Error(`会话 ${sessionId} 数据不完整! 实际保存: ${(actualTotalBytes / 1024 / 1024).toFixed(2)} MB, 但记录了 ${(session.appendedBytes / 1024 / 1024).toFixed(2)} MB。已找到 ${sessionsWithData.length} 个相关会话，但自动合并失败。请手动使用 mergeSessionsData([${sessionId}, ...其他会话ID], '${mimeToUse}') 合并数据。`);
        }

        // 生成下载 URL
        const url = this.generateDownloadUrl(sessionId, mimeToUse);
        
        // 确定文件扩展名
        const ext = this._getExtensionFromMime(mimeToUse);
        const fullFilename = filename + (ext ? `.${ext}` : '');

        // 创建下载链接并触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 延迟清理 URL（给下载时间，增加到 5 秒以确保大文件下载完成）
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.log(`已下载: ${fullFilename} (${(session.appendedBytes / 1024 / 1024).toFixed(2)} MB)`);
        }, 5000);
      } catch (e) {
        this.emit("error", { where: "downloadSession", sessionId, error: e });
        throw e;
      }
    }
  
    /**
     * 合并多个会话并下载
     * @param {Array<number>} sessionIds 会话 ID 数组
     * @param {string} filename 文件名（不含扩展名）
     * @param {string} preferredMimeType 首选的 MIME 类型
     */
    async downloadMergedSessions(sessionIds, filename = null, preferredMimeType = null) {
      try {
        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
          throw new Error('需要至少一个会话 ID');
        }
        
        // 获取第一个会话的信息用于文件名
        const firstSession = this._sessions.get(sessionIds[0]);
        if (!firstSession) {
          throw new Error(`会话 ${sessionIds[0]} 不存在`);
        }
        
        // 确定文件名
        if (!filename) {
          const timestamp = new Date(firstSession.createdAt).toISOString().replace(/[:.]/g, '-');
          filename = `video_merged_${sessionIds.join('_')}_${timestamp}`;
        }
        
        // 合并数据
        this.log(`开始合并 ${sessionIds.length} 个会话的数据...`);
        const merged = this.mergeSessionsData(sessionIds, preferredMimeType);
        
        // 确定 MIME 类型
        let mimeToUse = preferredMimeType;
        if (!mimeToUse) {
          if (merged instanceof ArrayBuffer) {
            // 单个数据，需要从会话中获取 MIME 类型
            const sessions = sessionIds.map(id => this._sessions.get(id)).filter(Boolean);
            const availableMimes = new Set();
            for (const s of sessions) {
              if (s.chunks) {
                for (const mime of s.chunks.keys()) {
                  availableMimes.add(mime);
                }
              }
            }
            mimeToUse = Array.from(availableMimes).find(m => m.startsWith('video/')) || Array.from(availableMimes)[0];
          } else {
            // 多个 MIME 类型，优先选择 video
            mimeToUse = Object.keys(merged).find(m => m.startsWith('video/')) || Object.keys(merged)[0];
          }
        }
        
        if (!mimeToUse) {
          throw new Error('无法确定 MIME 类型');
        }
        
        // 获取合并后的数据
        const data = merged instanceof ArrayBuffer ? merged : merged[mimeToUse];
        if (!data) {
          throw new Error(`合并后的数据中没有 ${mimeToUse} 类型`);
        }
        
        const totalBytes = data.byteLength;
        this.log(`合并完成! 总大小: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
        
        // 生成下载 URL
        const blob = new Blob([data], { type: mimeToUse });
        const url = URL.createObjectURL(blob);
        
        // 确定文件扩展名
        const ext = this._getExtensionFromMime(mimeToUse);
        const fullFilename = filename + (ext ? `.${ext}` : '');
        
        // 创建下载链接并触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 延迟清理 URL
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.log(`已下载合并后的视频: ${fullFilename} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
        }, 5000);
      } catch (e) {
        this.emit("error", { where: "downloadMergedSessions", sessionIds, error: e });
        throw e;
      }
    }
    
    /**
     * 从 MIME 类型获取文件扩展名
     * @private
     */
    _getExtensionFromMime(mimeType) {
      const mimeMap = {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/ogg': 'ogv',
        'video/quicktime': 'mov',
        'video/x-msvideo': 'avi',
        'audio/mp4': 'm4a',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
      };
      return mimeMap[mimeType] || mimeType.split('/')[1]?.split(';')[0] || 'bin';
    }
  
    /**
     * 清理指定会话的数据块（释放内存）
     * @param {number} sessionId 会话 ID
     */
    clearSessionChunks(sessionId) {
      const session = this._sessions.get(sessionId);
      if (session && session.chunks) {
        session.chunks.clear();
        for (const track of session.tracks.values()) {
          if (track.chunks) track.chunks = null;
        }
        this.log(`已清理会话 ${sessionId} 的数据块`);
      }
    }
  
    /**
     * 清理所有会话的数据块
     */
    clearAllChunks() {
      for (const [id, session] of this._sessions.entries()) {
        if (session.chunks) {
          session.chunks.clear();
        }
        if (session.tracks) {
          for (const track of session.tracks.values()) {
            if (track.chunks) track.chunks = null;
          }
        }
      }
      this.log('已清理所有会话的数据块');
    }
  
    static _call(ctx, fn, ...args) {
      return fn.apply(ctx, args);
    }
  }