# python3 tools/train-policy.py out.json files... -> linear softmax move prior over aFeat action features (imitates Expert's choices)
import sys, json, numpy as np
rows = [json.loads(l) for f in sys.argv[2:] for l in open(f) if l.strip()]; rng = np.random.default_rng(0); rng.shuffle(rows)
nv = len(rows) // 8; va, tr = rows[:nv], rows[nv:]; d = len(rows[0][1][0]); w = np.zeros(d); m = np.zeros(d); v = np.zeros(d)
def stats(R, w):
    ll = acc = 0
    for k, A in R:
        z = np.array(A) @ w; z -= z.max(); p = np.exp(z) / np.exp(z).sum(); ll -= np.log(p[k] + 1e-9); acc += int(np.argmax(z) == k)
    return ll / len(R), acc / len(R)
for t in range(1, 41):
    g = np.zeros(d)
    for k, A in tr:
        X = np.array(A); z = X @ w; z -= z.max(); p = np.exp(z) / np.exp(z).sum(); g += X.T @ p - X[k]
    g = g / len(tr) + 1e-4 * w; m = .9 * m + .1 * g; v = .999 * v + .001 * g * g; w -= 0.1 * (m / (1 - .9 ** t)) / (np.sqrt(v / (1 - .999 ** t)) + 1e-8)
    if t % 10 == 0: print(t, "val ll/top1", stats(va, w), flush=True)
json.dump({"w": [round(float(x), 4) for x in w], "k": 30, "h": 0}, open(sys.argv[1], "w")); print("saved")
