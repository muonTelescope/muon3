"""The WLS fiber loop of an sPHENIX inner-HCal tile, shared by the FreeCAD assembly and the Geant4 model.

The source tile CAD (STEP/GDML) carries NO fiber. The pattern follows Aidala et al., IEEE TNS 65 (2018), Fig. 6: ONE fiber
makes a closed loop. Both ends leave the flat SiPM edge side by side, orthogonal to it (so a single 3x3 mm SiPM sees both),
each runs through an S-bend (two arcs, R >= 25 mm, the tile design's minimum) onto a leg, the two legs run down the tile in
parallel and a semicircle closes the loop near the far edge. On the slanted tiles the loop leans with the tile (Fig. 6b), so
the legs stay `margin` from the slanted edges. The lean, the loop's x position and the leg spacing are the ones that put the
fiber closest to the tile's area (lowest mean distance from a point of the tile to the fiber, with a small penalty for length)
among the loops that fit. The sPHENIX design goal is a deposit within about 25 mm of a fiber: a single loop reaches that
only near its legs, and `info` reports the mean, 95th-percentile and maximum distance for the tile.

    tokens, info = loop_tokens(hull, sx, ytop)     # hull = [bl, br, tr, tl], x from the tile's own xmin
    pts = dense(tokens)                            # polyline, arcs sampled every `step_deg`
"""
import math


def _wrap(a): return (a + math.pi) % (2 * math.pi) - math.pi


def _arc_step(p, h, R, sig, ang):
    """pose after turning sig*ang (sig=+1 left/ccw) from point p, heading h: returns (end, end heading, mid, centre)"""
    C = (p[0] - sig * R * math.sin(h), p[1] + sig * R * math.cos(h))
    rot = lambda a: (C[0] + (p[0] - C[0]) * math.cos(a) - (p[1] - C[1]) * math.sin(a) * 1.0 * 1, C[1] + (p[0] - C[0]) * math.sin(a) + (p[1] - C[1]) * math.cos(a))
    e = rot(sig * ang); m = rot(sig * ang / 2)
    return e, h + sig * ang, m, C


def _sbend(p0, h0, Pline, w, R):
    """Two arcs (first turning one way, second back) from pose (p0,h0) onto the line through Pline with heading w.
    Returns (tokens, end point) for the shortest solution, or None."""
    dlt = _wrap(w - h0); best = None
    nl = (-math.sin(w), math.cos(w))                                        # normal of the target line
    for sig in (1, -1):
        def end(a1):
            a2 = a1 - sig * dlt
            if a2 < -1e-9: return None
            e1, h1, m1, _ = _arc_step(p0, h0, R, sig, a1)
            e2, h2, m2, _ = _arc_step(e1, h1, R, -sig, a2)
            return e1, m1, e2, m2, (e2[0] - Pline[0]) * nl[0] + (e2[1] - Pline[1]) * nl[1]
        lo = max(0.0, sig * dlt); n = 400; prev = None
        for i in range(n + 1):
            a1 = lo + (math.pi - lo) * i / n
            r = end(a1)
            if r is None: prev = None; continue
            if prev is not None and prev[1][4] * r[4] <= 0:
                a, b = prev[0], a1                                          # bisect the sign change
                for _ in range(50):
                    mid = 0.5 * (a + b); rm = end(mid)
                    if rm is None or prev[1][4] * rm[4] > 0: a = mid
                    else: b = mid
                a1s = 0.5 * (a + b); e1, m1, e2, m2, _ = end(a1s)
                L = R * (a1s + a1s - sig * dlt)
                if best is None or L < best[0]: best = (L, [("arc", p0, e1, m1), ("arc", e1, e2, m2)], e2)
                break
            prev = (a1, r)
    return None if best is None else (best[1], best[2])


def _build(hull, sx, ytop, phi, xc, R, d, sep, margin):
    (blx, bly), (brx, bry) = hull[0], hull[1]
    a = (-math.sin(phi), -math.cos(phi)); n = (math.cos(phi), -math.sin(phi))   # leg direction (down the tile), leg spacing direction
    far = min(d * (math.sin(t) * a[1] + math.cos(t) * n[1]) for t in [math.pi * k / 90 for k in range(91)])
    yc = max(bly, bry) + margin - far                                           # centre of the closing semicircle
    C = (xc, yc)
    Pl = (C[0] - d * n[0], C[1] - d * n[1]); Pr = (C[0] + d * n[0], C[1] + d * n[1])
    w = math.atan2(a[1], a[0]); h0 = -math.pi / 2
    yS = ytop - 4.0
    xL, xR = sx - sep / 2, sx + sep / 2
    L = _sbend((xL, yS), h0, Pl, w, R); Rr = _sbend((xR, yS), h0, Pr, w, R)
    if L is None or Rr is None: return None
    (tl_, eL), (tr_, eR) = L, Rr
    for e, P in ((eL, Pl), (eR, Pr)):                                           # S-bend must end above the turn, on the leg
        if (P[0] - e[0]) * a[0] + (P[1] - e[1]) * a[1] < 2.0: return None
    tok = [("pt", (xL, ytop))] + tl_ + [("arc", Pl, Pr, (C[0] + d * a[0], C[1] + d * a[1]))]
    for t in reversed(tr_): tok.append(("arc", t[2], t[1], t[3]))
    tok.append(("pt", (xR, ytop)))
    return tok


def _inside(hull, pts, margin):
    (blx, bly), (brx, bry), (trx, tr_y), (tlx, tl_y) = hull
    edges = [(hull[0], hull[1]), (hull[1], hull[2]), (hull[3], hull[0])]        # bottom, right, left (counter-clockwise bl,br,tr,tl)
    for (x, y) in pts:
        if y > tr_y + 0.01: return False
        if y > tr_y - 3.0: continue                                             # the stem at the SiPM edge
        for (p, q) in edges:
            ex, ey = q[0] - p[0], q[1] - p[1]; el = math.hypot(ex, ey)
            if (ex * (y - p[1]) - ey * (x - p[0])) / el < margin - 0.05: return False
    return True


def coverage(hull, pts, step=6.0):
    """(mean, 95th percentile, max) distance from points of the tile (grid `step` mm) to the fiber centre line."""
    import numpy as np
    P = np.asarray(pts, float); seg = []
    for a, b in zip(P[:-1], P[1:]):                                     # resample straight legs every 2 mm
        n = max(1, int(np.hypot(*(b - a)) / 2.0)); seg.append(a + (b - a) * (np.arange(n)[:, None] / n))
    F = np.vstack(seg + [P[-1:]])
    xs = np.arange(min(x for x, _ in hull), max(x for x, _ in hull), step); ys = np.arange(min(y for _, y in hull), max(y for _, y in hull), step)
    G = np.array([(x, y) for x in xs for y in ys if _inside_poly(hull, x, y)])
    D = np.sqrt(((G[:, None, :] - F[None, ::2, :]) ** 2).sum(-1)).min(1)
    return float(D.mean()), float(np.percentile(D, 95)), float(D.max())


def _inside_poly(hull, x, y):                                            # convex hull, counter-clockwise bl, br, tr, tl
    for i in range(4):
        (ax, ay), (bx, by) = hull[i], hull[(i + 1) % 4]
        if (bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0: return False
    return True


def loop_tokens(hull, sx, ytop, margin=8.0, R=25.0, sep=1.2, spacings=(27.5, 35.0, 45.0, 55.0, 65.0), length_penalty=0.01):
    best = None
    for d in spacings:
        for phi_d in [2.5 * k for k in range(0, 29)]:
            phi = math.radians(phi_d)
            for xc in [sx - 200 + 4.0 * i for i in range(0, 101)]:
                tok = _build(hull, sx, ytop, phi, xc, R, d, sep, margin)
                if tok is None: continue
                pts = dense(tok, 3.0)
                if not _inside(hull, pts, margin): continue
                L = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
                try: cov = coverage(hull, pts)
                except ImportError: cov = (0.0, 0.0, 0.0)                # no numpy: shortest loop that fits
                score = cov[0] + length_penalty * L
                if best is None or score < best[0]: best = (score, phi_d, xc, d, L, cov, tok)
    assert best, "no fiber loop fits this hull"
    _, phi_d, xc, d, L, cov, tok = best
    return tok, {"length": L, "lean_deg": phi_d, "xc": xc, "spacing_mm": 2 * d, "mean_dist_mm": cov[0], "p95_dist_mm": cov[1], "max_dist_mm": cov[2]}


def _circle(a, b, m):
    ax, ay = a; bx, by = b; mx, my = m
    D = 2 * (ax * (by - my) + bx * (my - ay) + mx * (ay - by))
    ux = ((ax**2 + ay**2) * (by - my) + (bx**2 + by**2) * (my - ay) + (mx**2 + my**2) * (ay - by)) / D
    uy = ((ax**2 + ay**2) * (mx - bx) + (bx**2 + by**2) * (ax - mx) + (mx**2 + my**2) * (bx - ax)) / D
    return ux, uy, math.hypot(ax - ux, ay - uy)


def dense(tok, step_deg=1.0):
    pts = [tok[0][1]]
    for t in tok[1:]:
        if t[0] == "pt":
            if math.hypot(t[1][0] - pts[-1][0], t[1][1] - pts[-1][1]) > 1e-6: pts.append(t[1])
            continue
        _, a, b, m = t
        if math.hypot(a[0] - pts[-1][0], a[1] - pts[-1][1]) > 1e-6: pts.append(a)
        cx, cy, r = _circle(a, b, m)
        a0, a1, am = (math.atan2(p[1] - cy, p[0] - cx) for p in (a, b, m))
        da = (a1 - a0) % (2 * math.pi) if _wrap(am - a0) >= 0 else -((a0 - a1) % (2 * math.pi))
        n = max(2, math.ceil(abs(math.degrees(da)) / step_deg))
        pts += [(cx + r * math.cos(a0 + da * k / n), cy + r * math.sin(a0 + da * k / n)) for k in range(1, n + 1)]
    return pts
