/** Jardinier automatique : ratisse en contournant les pierres, joue des notes, pose parfois une pierre. */
import { TAU, C, SP, RINGS, clamp } from './config';
import { type Garden, ringR } from './garden';
import { rakeSeg, placeStone, stoneAt, randomRadius } from './tools';

/** Un pas du jardinier ; renvoie true s'il ratisse, false s'il fait une pause.
 * @param entered le joueur est entré (sinon, pierres posées sans bruit) */
export function autoStep(g: Garden, dt: number, entered: boolean): boolean {
  const R = g.rand, { vw, vh, ag } = g;
  if (ag.pause > 0) {
    ag.pause -= dt;
    if (ag.pause <= 0) { ag.x = vw * (.1 + R() * .8); ag.y = vh * (.12 + R() * .7); ag.a = R() * TAU; ag.left = Math.min(vw, vh) * (.8 + R() * 1.4); }
    return false;
  }
  ag.t += dt; ag.a += (Math.sin(ag.t * .011 + ag.s) * .6 + Math.sin(ag.t * .027 + ag.s * 2) * .4) * .02 * dt;
  const mg = 70, cx = vw / 2 - ag.x, cy = vh / 2 - ag.y;
  if (ag.x < mg || ag.x > vw - mg || ag.y < mg || ag.y > vh - mg - 60) { let da = Math.atan2(cy, cx) - ag.a; da = Math.atan2(Math.sin(da), Math.cos(da)); ag.a += da * .05 * dt; }
  for (const s of g.stones) {
    const z = ringR(s) * C + RINGS * SP * C + g.tines * SP * C / 2 + 14, dx = ag.x - s.x, dy = ag.y - s.y, d = Math.hypot(dx, dy);
    if (d < z + 30) {
      const away = Math.atan2(dy, dx); const tan = away + (Math.sin(ag.a - away) > 0 ? Math.PI / 2 : -Math.PI / 2);
      let da = tan - ag.a; da = Math.atan2(Math.sin(da), Math.cos(da)); ag.a += da * .12 * dt * clamp(1 - (d - z) / 30, 0, 1);
    }
  }
  const sp = 1.5 * dt, ox = ag.x, oy = ag.y; ag.x += Math.cos(ag.a) * sp; ag.y += Math.sin(ag.a) * sp; ag.dx = Math.cos(ag.a); ag.dy = Math.sin(ag.a);
  rakeSeg(g, ox / C, oy / C, ag.x / C, ag.y / C);
  ag.left -= sp; ag.trav += sp; if (ag.trav > 52) { ag.trav = 0; g.events.note(ag.x, ag.y); }
  if (ag.left <= 0) {
    ag.pause = 50 + R() * 90;
    if (g.stones.length < 6 && R() < .3) { const x = vw * (.15 + R() * .7), y = vh * (.18 + R() * .55); if (stoneAt(g, x, y) < 0) placeStone(g, x, y, randomRadius(g), !entered); }
  }
  return true;
}
