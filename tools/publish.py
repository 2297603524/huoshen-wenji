#!/usr/bin/env python3
"""把 site/ 目录发布到 GitHub（Git Data API，不需要 git 客户端）。

与通用 gh_commit.py 的区别：支持**删除**远端多余文件（prune），
让仓库内容与本地 site/ 目录保持一致，而不是只做增量新增。

用法：
    python tools/publish.py --dry-run
    python tools/publish.py

环境变量：
    GH_OWNER / GH_REPO / GH_BRANCH / GH_SRC / GH_MSG / GH_TOKEN_FILE
"""
import base64
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

OWNER = os.environ.get("GH_OWNER", "2297603524")
REPO = os.environ.get("GH_REPO", "huoshen-wenji")
BRANCH = os.environ.get("GH_BRANCH", "main")
SRC = os.environ.get("GH_SRC", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MSG = os.environ.get("GH_MSG", "chore: sync site")
TOKEN_FILE = os.environ.get("GH_TOKEN_FILE", "D:/tmp/gh_token.txt")

# prune 时永不删除的路径（仓库里保留但不属于站点产物）
KEEP_FILES = ("README.md", ".gitignore", "LICENSE")
KEEP_DIRS = (".github/",)


def keep(path):
    """data/raw/<slug>/… 这种分人物的原始数据要保留；
    data/raw/xxx.json 这种历史遗留的扁平文件则允许删除。"""
    if path in KEEP_FILES or path.startswith(KEEP_DIRS):
        return True
    if path.startswith("data/raw/"):
        return "/" in path[len("data/raw/"):]
    return False
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "out", "__pycache__", ".venv",
             "site", ".verify", ".staging", ".idea", ".vscode"}

API = "https://api.github.com"
DRY = "--dry-run" in sys.argv


def _norm(p):
    if os.name == "nt" and p and len(p) >= 3 and p[0] == "/" and p[2] == "/" and p[1].isalpha():
        return p[1].upper() + ":" + p[2:]
    return p


SRC = _norm(SRC)
TOKEN_FILE = _norm(TOKEN_FILE)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


RETRY_CODES = (400, 408, 409, 429, 500, 502, 503, 504)


def api(method, path, body=None, tries=5):
    """带重试的调用：本机走中间人代理时，连续大请求偶发 400/5xx，重试即可。"""
    payload = json.dumps(body).encode() if body is not None else None
    last = ""
    for attempt in range(tries):
        req = urllib.request.Request(API + path, method=method, data=payload)
        req.add_header("Authorization", "Bearer " + open(TOKEN_FILE, encoding="utf-8").read().strip())
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("User-Agent", "wb-publish")
        if body is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=180, context=ctx) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:200]
            last = "HTTP %s %s %s\n%s" % (e.code, method, path, detail)
            if e.code not in RETRY_CODES:
                break
        except Exception as e:            # 连接被中间人掐断等
            last = "%s %s %s\n%s" % (type(e).__name__, method, path, e)
        time.sleep(1.5 * (attempt + 1))
    raise SystemExit(last)


def blob_sha(data):
    """git blob 的内容寻址 sha，用来判断文件是否变化、能否跳过上传。"""
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


def local_files():
    out = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, SRC).replace(os.sep, "/")
            out.append((rel, full))
    return sorted(out)


def main():
    files = local_files()
    if not files:
        raise SystemExit("本地目录为空：%s" % SRC)

    ref = api("GET", "/repos/%s/%s/git/ref/heads/%s" % (OWNER, REPO, BRANCH))
    parent = ref["object"]["sha"]
    base_tree = api("GET", "/repos/%s/%s/git/commits/%s" % (OWNER, REPO, parent))["tree"]["sha"]
    remote_map = {t["path"]: t["sha"] for t in api(
        "GET", "/repos/%s/%s/git/trees/%s?recursive=1" % (OWNER, REPO, base_tree))["tree"]
        if t["type"] == "blob"}
    remote = set(remote_map)

    local = {rel for rel, _ in files}
    added = sorted(local - remote)
    changed_unknown = sorted(local & remote)
    removed = sorted(p for p in remote - local if not keep(p))

    print("父提交      %s" % parent[:7])
    print("本地文件    %d" % len(local))
    print("新增        %d" % len(added))
    print("删除        %d" % len(removed))
    for p in removed[:8]:
        print("   - " + p)
    if len(removed) > 8:
        print("   … 其余 %d 个" % (len(removed) - 8))
    kept = sorted(p for p in remote - local if keep(p))
    print("保留(不删)  %d  %s" % (len(kept), kept[:3]))

    if DRY:
        print("\n[dry-run] 未提交")
        return

    tree = []
    uploaded = skipped = 0
    total = len(files)
    for idx, (rel, full) in enumerate(files, 1):
        data = open(full, "rb").read()
        sha = blob_sha(data)
        if remote_map.get(rel) == sha:
            skipped += 1
        else:
            try:
                sha = api("POST", "/repos/%s/%s/git/blobs" % (OWNER, REPO), {
                    "content": base64.b64encode(data).decode(),
                    "encoding": "base64",
                })["sha"]
            except SystemExit as e:
                raise SystemExit("上传失败：%s（%.1f MB）\n%s" % (rel, len(data) / 1048576, e))
            uploaded += 1
        tree.append({"path": rel, "mode": "100644", "type": "blob", "sha": sha})
        if idx % 25 == 0 or idx == total:
            print("  … %d/%d  （上传 %d / 跳过 %d）" % (idx, total, uploaded, skipped), flush=True)
    print("\n上传 %d 个，内容未变跳过 %d 个" % (uploaded, skipped))
    for p in removed:
        tree.append({"path": p, "mode": "100644", "type": "blob", "sha": None})

    new_tree = api("POST", "/repos/%s/%s/git/trees" % (OWNER, REPO),
                   {"base_tree": base_tree, "tree": tree})
    commit = api("POST", "/repos/%s/%s/git/commits" % (OWNER, REPO),
                 {"message": MSG, "tree": new_tree["sha"], "parents": [parent]})
    api("PATCH", "/repos/%s/%s/git/refs/heads/%s" % (OWNER, REPO, BRANCH),
        {"sha": commit["sha"]})

    print("\n✅ 已提交 %s" % commit["sha"][:8])
    print("   https://github.com/%s/%s/commit/%s" % (OWNER, REPO, commit["sha"]))


if __name__ == "__main__":
    main()
