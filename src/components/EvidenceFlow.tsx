import { useEffect, useRef } from "react";

/**
 * EvidenceFlow — "Research Infrastructure" background.
 *
 * Story: An agent searches the internet, finds sources, verifies evidence.
 *
 * 1. Sparse network of faint dots = the internet (always visible)
 * 2. An agent dot appears brighter
 * 3. Light pulses travel along network lines to reach sources
 * 4. Source dots glow when reached
 * 5. Evidence lines trace back to the agent
 * 6. Agent pulses emerald = verified
 * 7. Fades. New agent starts elsewhere.
 *
 * Calm. Purposeful. No bursts.
 */

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  glowAlpha: number; // emerald glow when "found"
  neighbors: number[]; // indices of nearby nodes
}

interface TravelingLight {
  fromNode: number;
  toNode: number;
  progress: number; // 0 to 1
  speed: number;
}

interface AgentQuery {
  agentNode: number;
  phase: "searching" | "returning" | "verified" | "fading";
  age: number;
  foundNodes: number[];
  lights: TravelingLight[];
  returnLights: TravelingLight[];
  verifyAlpha: number;
}

export function EvidenceFlow({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({
    nodes: [] as Node[],
    edges: [] as [number, number][],
    queries: [] as AgentQuery[],
    w: 0, h: 0, frame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reduce work on mobile (fewer nodes, skip frames)
    const isMobile = window.innerWidth < 768;
    let frameSkip = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const s = stateRef.current;
      s.w = rect.width; s.h = rect.height;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    }

    function init() {
      const s = stateRef.current;
      s.nodes = [];
      s.edges = [];
      s.queries = [];

      // Create network nodes — fewer on mobile
      const count = Math.min(isMobile ? 35 : 70, Math.floor((s.w * s.h) / (isMobile ? 18000 : 12000)));
      for (let i = 0; i < count; i++) {
        s.nodes.push({
          x: Math.random() * s.w,
          y: Math.random() * s.h,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.06,
          radius: 0.8 + Math.random() * 0.8,
          baseAlpha: 0.04 + Math.random() * 0.06,
          alpha: 0.04 + Math.random() * 0.06,
          glowAlpha: 0,
          neighbors: [],
        });
      }

      // Build edges between nearby nodes (the "internet" topology)
      const maxDist = Math.min(s.w, s.h) * 0.15;
      for (let i = 0; i < s.nodes.length; i++) {
        const ni = s.nodes[i];
        for (let j = i + 1; j < s.nodes.length; j++) {
          const nj = s.nodes[j];
          const dist = Math.hypot(ni.x - nj.x, ni.y - nj.y);
          if (dist < maxDist && ni.neighbors.length < 4 && nj.neighbors.length < 4) {
            ni.neighbors.push(j);
            nj.neighbors.push(i);
            s.edges.push([i, j]);
          }
        }
      }
    }

    function startQuery() {
      const s = stateRef.current;
      // Pick a node with neighbors as the agent
      const candidates = s.nodes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.neighbors.length >= 2 && n.glowAlpha === 0);
      if (candidates.length === 0) return;

      const agent = candidates[Math.floor(Math.random() * candidates.length)];

      // Find reachable nodes (BFS, max depth 3)
      const visited = new Set<number>([agent.i]);
      const frontier = [agent.i];
      const reachable: number[] = [];

      for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
        const next: number[] = [];
        for (const fi of frontier) {
          for (const ni of s.nodes[fi].neighbors) {
            if (!visited.has(ni)) {
              visited.add(ni);
              next.push(ni);
              reachable.push(ni);
            }
          }
        }
        frontier.length = 0;
        frontier.push(...next);
      }

      // Pick 3-5 targets from reachable
      const targets = reachable
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 + Math.floor(Math.random() * 3));

      if (targets.length === 0) return;

      // Create traveling lights from agent to each target
      // Find path (simplified: just direct neighbor hops)
      const lights: TravelingLight[] = [];
      for (const target of targets) {
        // Find shortest path via BFS
        const path = findPath(s.nodes, agent.i, target);
        if (path.length >= 2) {
          // Create a light for each edge in the path with staggered delays
          for (let p = 0; p < path.length - 1; p++) {
            lights.push({
              fromNode: path[p],
              toNode: path[p + 1],
              progress: -p * 0.3, // staggered start (negative = delayed)
              speed: 0.008 + Math.random() * 0.004,
            });
          }
        }
      }

      s.queries.push({
        agentNode: agent.i,
        phase: "searching",
        age: 0,
        foundNodes: targets,
        lights,
        returnLights: [],
        verifyAlpha: 0,
      });
    }

    function findPath(nodes: Node[], from: number, to: number): number[] {
      const queue: number[][] = [[from]];
      const visited = new Set<number>([from]);
      while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];
        if (current === to) return path;
        for (const n of nodes[current].neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push([...path, n]);
          }
        }
      }
      return []; // no path
    }

    function draw() {
      const s = stateRef.current;
      if (!ctx || s.w === 0) { animRef.current = requestAnimationFrame(draw); return; }
      // On mobile, render every other frame to save battery
      if (isMobile) { frameSkip++; if (frameSkip % 2 !== 0) { animRef.current = requestAnimationFrame(draw); return; } }
      s.frame++;

      ctx.clearRect(0, 0, s.w, s.h);

      // Move nodes gently
      for (const n of s.nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = s.w + 20;
        if (n.x > s.w + 20) n.x = -20;
        if (n.y < -20) n.y = s.h + 20;
        if (n.y > s.h + 20) n.y = -20;
        // Decay glow
        n.glowAlpha *= 0.995;
      }

      // ── Draw network edges (the internet) ──
      for (const [i, j] of s.edges) {
        const ni = s.nodes[i];
        const nj = s.nodes[j];
        const edgeAlpha = Math.max(ni.alpha, nj.alpha) * 0.4;
        // Boost if either node is glowing
        const boost = Math.max(ni.glowAlpha, nj.glowAlpha);
        ctx.beginPath();
        ctx.moveTo(ni.x, ni.y);
        ctx.lineTo(nj.x, nj.y);
        if (boost > 0.05) {
          ctx.strokeStyle = `rgba(52, 211, 153, ${boost * 0.3})`;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${edgeAlpha})`;
        }
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // ── Spawn queries ──
      if (s.frame % 400 === 100 && s.queries.length < 2) {
        startQuery();
      }
      if (s.frame === 80) startQuery(); // first one early

      // ── Update queries ──
      for (let qi = s.queries.length - 1; qi >= 0; qi--) {
        const q = s.queries[qi];
        q.age++;

        // Agent node stays bright
        s.nodes[q.agentNode].alpha = Math.max(s.nodes[q.agentNode].baseAlpha, 0.3);

        if (q.phase === "searching") {
          // Advance traveling lights
          let allArrived = true;
          for (const light of q.lights) {
            light.progress += light.speed;
            if (light.progress < 0) { allArrived = false; continue; }
            if (light.progress >= 1) {
              // Light arrived — glow the target
              s.nodes[light.toNode].glowAlpha = Math.max(s.nodes[light.toNode].glowAlpha, 0.4);
              continue;
            }
            allArrived = false;

            // Draw the traveling light
            const from = s.nodes[light.fromNode];
            const to = s.nodes[light.toNode];
            const lx = from.x + (to.x - from.x) * light.progress;
            const ly = from.y + (to.y - from.y) * light.progress;

            ctx.beginPath();
            ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, 0.35)`;
            ctx.fill();

            // Trail
            const trailP = Math.max(0, light.progress - 0.15);
            const tx = from.x + (to.x - from.x) * trailP;
            const ty = from.y + (to.y - from.y) * trailP;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(lx, ly);
            ctx.strokeStyle = `rgba(255, 255, 255, 0.12)`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (allArrived && q.age > 60) {
            q.phase = "returning";
            q.age = 0;
            // Create return lights from found nodes back to agent
            for (const target of q.foundNodes) {
              const path = findPath(s.nodes, target, q.agentNode);
              for (let p = 0; p < path.length - 1; p++) {
                q.returnLights.push({
                  fromNode: path[p],
                  toNode: path[p + 1],
                  progress: -p * 0.25,
                  speed: 0.01 + Math.random() * 0.005,
                });
              }
            }
          }
        }

        if (q.phase === "returning") {
          let allBack = true;
          for (const light of q.returnLights) {
            light.progress += light.speed;
            if (light.progress < 0) { allBack = false; continue; }
            if (light.progress >= 1) continue;
            allBack = false;

            const from = s.nodes[light.fromNode];
            const to = s.nodes[light.toNode];
            const lx = from.x + (to.x - from.x) * light.progress;
            const ly = from.y + (to.y - from.y) * light.progress;

            ctx.beginPath();
            ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52, 211, 153, 0.4)`;
            ctx.fill();

            // Green trail
            const trailP = Math.max(0, light.progress - 0.12);
            const tx = from.x + (to.x - from.x) * trailP;
            const ty = from.y + (to.y - from.y) * trailP;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(lx, ly);
            ctx.strokeStyle = `rgba(52, 211, 153, 0.15)`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (allBack && q.age > 40) {
            q.phase = "verified";
            q.age = 0;
          }
        }

        if (q.phase === "verified") {
          // Agent glows emerald
          q.verifyAlpha = Math.min(0.5, q.verifyAlpha + 0.008);
          s.nodes[q.agentNode].glowAlpha = q.verifyAlpha;

          // Soft halo
          const agent = s.nodes[q.agentNode];
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, 8 + q.age * 0.05, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${q.verifyAlpha * 0.1})`;
          ctx.fill();

          if (q.age > 150) {
            q.phase = "fading";
            q.age = 0;
          }
        }

        if (q.phase === "fading") {
          const fade = 1 - q.age / 120;
          s.nodes[q.agentNode].alpha = Math.max(
            s.nodes[q.agentNode].baseAlpha,
            0.3 * fade,
          );
          for (const di of q.foundNodes) {
            s.nodes[di].glowAlpha *= 0.97;
          }
          q.verifyAlpha *= 0.97;

          if (q.age > 120) {
            s.nodes[q.agentNode].alpha = s.nodes[q.agentNode].baseAlpha;
            s.queries.splice(qi, 1);
          }
        }
      }

      // ── Draw nodes ──
      for (const n of s.nodes) {
        // Emerald glow halo
        if (n.glowAlpha > 0.02) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${n.glowAlpha * 0.1})`;
          ctx.fill();
        }

        // Dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.glowAlpha > 0.1 ? n.radius * 1.5 : n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.glowAlpha > 0.1
          ? `rgba(52, 211, 153, ${Math.max(n.alpha, n.glowAlpha)})`
          : `rgba(255, 255, 255, ${n.alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
