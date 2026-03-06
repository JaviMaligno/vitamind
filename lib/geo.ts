/* eslint-disable @typescript-eslint/no-explicit-any */

export function decodeTopo(topology: any, name: string): any {
  const tf = topology.transform;
  const decoded = topology.arcs.map((arc: number[][]) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]: number[]) => {
      x += dx; y += dy;
      return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]];
    });
  });

  function ring(indices: number[]): number[][] {
    const c: number[][] = [];
    for (const idx of indices) {
      const a = idx < 0 ? [...decoded[~idx]].reverse() : decoded[idx];
      for (let i = c.length ? 1 : 0; i < a.length; i++) c.push(a[i]);
    }
    return c;
  }

  function geo(g: any): any {
    if (g.type === "Polygon") return { type: "Polygon", coordinates: g.arcs.map(ring) };
    if (g.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: g.arcs.map((p: any) => p.map(ring)) };
    return g;
  }

  const obj = topology.objects[name];
  if (obj.type === "GeometryCollection") {
    return {
      type: "FeatureCollection",
      features: obj.geometries.map((g: any) => ({
        type: "Feature",
        geometry: geo(g),
        properties: g.properties || {},
      })),
    };
  }
  return { type: "Feature", geometry: geo(obj), properties: obj.properties || {} };
}
