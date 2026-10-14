# python3 tools/train-big.py out.json H1 H2 DE files...  -> value net with per-card embeddings (summed per zone) + state features.
# Zones: my play, my hand, their play, my inkwell, their discard. Last file = validation. Exports JSON for js/engine.js learnedEval.
import sys, json, torch, torch.nn as nn, numpy as np, os
out, H1, H2, DE = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]); files = sys.argv[5:]; torch.manual_seed(0)
def load(fs):
    F, Y, Z = [], [], []
    for f in fs:
        for l in open(f):
            r = json.loads(l)
            if len(r) < 3: continue
            Y.append(r[0]); F.append(r[1]); Z.append(r[2])
    return np.array(F, np.float32), np.array(Y, np.float32), Z
Ftr, Ytr, Ztr = load(files[:-1]); Fva, Yva, Zva = load(files[-1:]); print("rows", len(Ytr), "val", len(Yva), flush=True)
V = 1 + max(max((max(z) if z else 0) for z in zs) for zs in Ztr + Zva) + 1
def pack(Z):  # flatten zones to (index, row*5+zone) for EmbeddingBag
    idx, off = [], []
    for zs in Z:
        for z in zs: off.append(len(idx)); idx.extend(i + 1 for i in z)  # 0 = padding/unknown
    return torch.tensor(idx, dtype=torch.long), torch.tensor(off, dtype=torch.long)
class Net(nn.Module):
    def __init__(s, nf):
        super().__init__(); s.emb = nn.EmbeddingBag(V, DE, mode="sum"); s.l1 = nn.Linear(nf + 5 * DE, H1); s.l2 = nn.Linear(H1, H2) if H2 else None; s.o = nn.Linear(H2 or H1, 1)
    def forward(s, f, idx, off, n):
        e = s.emb(idx, off).view(n, 5 * DE) / 8; h = torch.relu(s.l1(torch.cat([f, e], 1)))
        if s.l2 is not None: h = torch.relu(s.l2(h))
        return s.o(h).squeeze(1)
net = Net(Ftr.shape[1]); opt = torch.optim.Adam(net.parameters(), 1e-3, weight_decay=1e-6); lossf = nn.BCEWithLogitsLoss()
Ft, Yt = torch.tensor(Ftr), torch.tensor(Ytr); Fv, Yv = torch.tensor(Fva), torch.tensor(Yva); iv, ov = pack(Zva)
BS = 2048; EP = int(os.environ.get("EP", "6")); best = (9, None)
for ep in range(EP):
    perm = np.random.permutation(len(Ytr)); net.train()
    for b in range(0, len(perm), BS):
        j = perm[b:b + BS]; i, o = pack([Ztr[k] for k in j]); opt.zero_grad(); l = lossf(net(Ft[j], i, o, len(j)), Yt[j]); l.backward(); opt.step()
    net.eval()
    with torch.no_grad(): p = net(Fv, iv, ov, len(Yva)); vl = float(lossf(p, Yv)); acc = float(((p > 0).float() == Yv).float().mean())
    print("epoch", ep, "val ll", round(vl, 4), "acc", round(acc, 4), flush=True)
    if vl < best[0]: best = (vl, {k: v.clone() for k, v in net.state_dict().items()})
net.load_state_dict(best[1]); sd = {k: v.numpy() for k, v in net.state_dict().items()}
R = lambda a: [round(float(x), 4) for x in np.asarray(a).ravel()]
J = {"kind": "big", "val": best[0], "V": V, "de": DE, "nf": int(Ftr.shape[1]), "emb": R(sd["emb.weight"]), "W1": R(sd["l1.weight"]), "b1": R(sd["l1.bias"]), "h1": H1,
     "W2": R(sd["l2.weight"]) if H2 else None, "b2": R(sd["l2.bias"]) if H2 else None, "h2": H2, "wo": R(sd["o.weight"]), "bo": float(sd["o.bias"][0])}
json.dump(J, open(out, "w"), separators=(",", ":")); print("saved", out, os.path.getsize(out), "bytes", "params", sum(v.size for v in sd.values()))
