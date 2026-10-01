// Highlight glyphs for the canvas. The icons are lucide's own path data
// (`__iconData`), turned into Path2D once, so the lanes match the rest of the
// UI's iconography without an image or font.

import { __iconData as contact } from "lucide-react/dist/esm/icons/circle-dot.mjs";
import { __iconData as acceleration } from "lucide-react/dist/esm/icons/zap.mjs";
import { __iconData as custom } from "lucide-react/dist/esm/icons/diamond.mjs";
import { __iconData as label } from "lucide-react/dist/esm/icons/tag.mjs";

type Attrs = Record<string, string | number>;
interface IconData {
  node: [string, Attrs][];
}

function toPath(data: IconData): Path2D {
  const p = new Path2D();
  for (const [tag, a] of data.node) {
    switch (tag) {
      case "path":
        p.addPath(new Path2D(String(a.d)));
        break;
      case "circle":
        p.moveTo(Number(a.cx) + Number(a.r), Number(a.cy));
        p.arc(Number(a.cx), Number(a.cy), Number(a.r), 0, Math.PI * 2);
        break;
      case "line":
        p.moveTo(Number(a.x1), Number(a.y1));
        p.lineTo(Number(a.x2), Number(a.y2));
        break;
      case "polyline":
      case "polygon": {
        const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
        p.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
        if (tag === "polygon") p.closePath();
        break;
      }
      case "rect": {
        const x = Number(a.x ?? 0);
        const y = Number(a.y ?? 0);
        p.roundRect(x, y, Number(a.width), Number(a.height), Number(a.rx ?? 0));
        break;
      }
      case "ellipse":
        p.ellipse(Number(a.cx), Number(a.cy), Number(a.rx), Number(a.ry), 0, 0, Math.PI * 2);
        break;
    }
  }
  return p;
}

let cache: Map<string, Path2D> | null = null;

/** Glyph path (24x24 box) for a highlight kind: circle-dot for contact force, the bolt for acceleration, a diamond for any custom kind (C8). */
export function kindIcon(kind: string): Path2D {
  cache ??= new Map([
    ["contact", toPath(contact as IconData)],
    ["acceleration", toPath(acceleration as IconData)],
    ["custom", toPath(custom as IconData)],
    ["label", toPath(label as IconData)],
  ]);
  return cache.get(kind) ?? cache.get("custom")!;
}
