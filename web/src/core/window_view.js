// A view of one window of one stream for the envs a caller cares about:
// `arrs[env]` is the decoded `[n, K]` array, or null while it is not decoded.
// The player refreshes a view only when the window, the set of envs or the
// store's contents changed, so a frame reads plain array slots and never
// touches the cache (and its recency bookkeeping) per env.

/** Window `w` of one stream for the envs a caller cares about, as `arrs[env]` (null: not decoded). */
export class WindowView {
  constructor(nEnvs) {
    this.w = -1;
    this.epoch = -1;
    this.ver = -1;
    this.arrs = new Array(nEnvs).fill(null);
    this.complete = false;
  }

  refresh(store, stream, w, envs, ver) {
    if (this.w === w && this.epoch === store.epoch && this.ver === ver) return;
    if (this.w !== w || this.ver !== ver) this.arrs.fill(null);
    let all = true;
    for (let i = 0; i < envs.length; i++) {
      const a = store.get(stream, w, envs[i]) || null;
      this.arrs[envs[i]] = a;
      if (!a) all = false;
    }
    this.w = w;
    this.epoch = store.epoch;
    this.ver = ver;
    this.complete = all;
  }
}
