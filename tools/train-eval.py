# python3 tools/train-eval.py out.json files... -> trains logistic regression and a small ReLU MLP on self-play rows, keeps the better (val log-loss), exports JSON
import sys, json, numpy as np
out = sys.argv[1]; files = sys.argv[2:]; X = []; Y = []; G = []
for gi, f in enumerate(files):
    for l in open(f):
        r = json.loads(l); y, x = r[0], r[1]; X.append(x); Y.append(y); G.append(gi)
X = np.array(X, dtype=np.float64); Y = np.array(Y, dtype=np.float64); G = np.array(G)
va = G == G.max(); tr = ~va; print("rows", len(Y), "val", va.sum())
def ll(p, y): p = np.clip(p, 1e-6, 1 - 1e-6); return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())
sig = lambda z: 1 / (1 + np.exp(-z))
# logistic regression (Adam, L2)
rng = np.random.default_rng(0); d = X.shape[1]
def adam(params, grads_fn, steps=3000, lr=0.01, bs=4096):
    m = [np.zeros_like(p) for p in params]; v = [np.zeros_like(p) for p in params]; idx = np.where(tr)[0]
    for t in range(1, steps + 1):
        b = rng.choice(idx, min(bs, len(idx)), replace=False); gs = grads_fn(params, X[b], Y[b])
        for i, (p, g) in enumerate(zip(params, gs)):
            m[i] = .9 * m[i] + .1 * g; v[i] = .999 * v[i] + .001 * g * g; p -= lr * (m[i] / (1 - .9 ** t)) / (np.sqrt(v[i] / (1 - .999 ** t)) + 1e-8)
    return params
w = np.zeros(d)
def g_lr(P, x, y): w, = P; p = sig(x @ w); return [x.T @ (p - y) / len(y) + 1e-4 * w]
adam([w], g_lr); lr_val = ll(sig(X[va] @ w), Y[va]); acc = float(((sig(X[va] @ w) > .5) == Y[va]).mean()); print("logreg val ll", lr_val, "acc", acc)
H = int(__import__("os").environ.get("H", "24"))
W1 = rng.normal(0, np.sqrt(2 / d), (d, H)); b1 = np.zeros(H); w2 = rng.normal(0, np.sqrt(1 / H), H); b2 = np.zeros(1)
def fwd(P, x): W1, b1, w2, b2 = P; h = np.maximum(0, x @ W1 + b1); return h, sig(h @ w2 + b2[0])
def g_mlp(P, x, y):
    W1, b1, w2, b2 = P; h, p = fwd(P, x); e = (p - y) / len(y); gw2 = h.T @ e + 1e-4 * w2; gb2 = np.array([e.sum()]); dh = np.outer(e, w2) * (h > 0)
    return [x.T @ dh + 1e-4 * W1, dh.sum(0), gw2, gb2]
P = adam([W1, b1, w2, b2], g_mlp, steps=6000, lr=0.003); _, pv = fwd(P, X[va]); m_val = ll(pv, Y[va]); print("mlp val ll", m_val, "acc", float(((pv > .5) == Y[va]).mean()))
if m_val < lr_val: W1, b1, w2, b2 = P; J = {"kind": "mlp", "val": m_val, "h": [{"w": [round(float(v), 5) for v in W1[:, j]], "b": round(float(b1[j]), 5)} for j in range(H)], "w2": [round(float(v), 5) for v in w2], "b2": round(float(b2[0]), 5)}
else: J = {"kind": "logreg", "val": lr_val, "w": [round(float(v), 5) for v in w]}
json.dump(J, open(out, "w")); print("saved", J["kind"])
