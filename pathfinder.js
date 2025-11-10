import floor4 from './floor4.json';

// Extract Coordinates
function getCoords(node) {
  return {
    x: parseFloat(node.xPosition),
    y: parseFloat(node.yPosition)
  };
}

// Build a Graph
const graph = {};
for (const node of floor4) {
  graph[node.name] = {
    ...node,
    edges: node.edges.filter(e => floor4.some(n => n.name === e))
  };
}

// Distance between Two Nodes
function distance(a, b) {
  const A = getCoords(a);
  const B = getCoords(b);
  return Math.hypot(A.x - B.x, A.y - B.y);
}

// Dijkstra’s Algorithm
function findShortestPath(startName, endName) {
  const distances = {};
  const prev = {};
  const pq = new Set(Object.keys(graph));

  for (const n of pq) distances[n] = Infinity;
  distances[startName] = 0;

  while (pq.size) {
    // Pick the node with smallest distance
    let current = [...pq].reduce((a, b) => distances[a] < distances[b] ? a : b);
    pq.delete(current);
    if (current === endName) break;

    const node = graph[current];
    for (const neighborName of node.edges) {
      const neighbor = graph[neighborName];
      const alt = distances[current] + distance(node, neighbor);
      if (alt < distances[neighborName]) {
        distances[neighborName] = alt;
        prev[neighborName] = current;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let u = endName;
  while (u) {
    path.unshift(u);
    u = prev[u];
  }
  return path;
}

// Directions (N,S,E,W)
function direction(a, b) {
  const dx = parseFloat(b.xPosition) - parseFloat(a.xPosition);
  const dy = parseFloat(b.yPosition) - parseFloat(a.yPosition);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle >= -45 && angle < 45) return "East";
  if (angle >= 45 && angle < 135) return "South";
  if (angle >= 135 || angle < -135) return "West";
  return "North";
}

// Left/Right/Straight Turns
function getTurnDirections(path) {
  const directions = [];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = graph[path[i - 1]];
    const curr = graph[path[i]];
    const next = graph[path[i + 1]];

    const a1 = Math.atan2(
      parseFloat(curr.yPosition) - parseFloat(prev.yPosition),
      parseFloat(curr.xPosition) - parseFloat(prev.xPosition)
    );
    const a2 = Math.atan2(
      parseFloat(next.yPosition) - parseFloat(curr.yPosition),
      parseFloat(next.xPosition) - parseFloat(curr.xPosition)
    );

    const diff = ((a2 - a1) * 180 / Math.PI + 360) % 360;
    if (diff < 45 || diff > 315) directions.push("Straight");
    else if (diff < 180) directions.push("Right");
    else directions.push("Left");
  }
  return directions;
}