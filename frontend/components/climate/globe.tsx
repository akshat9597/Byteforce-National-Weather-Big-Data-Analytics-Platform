"use client";
import { useEffect, useRef } from "react";

// Deliberately simplified geographic illustration, not an administrative map.
const land = [
  [
    [-17, 14],
    [-10, 35],
    [10, 37],
    [32, 31],
    [43, 12],
    [51, 11],
    [43, -12],
    [32, -34],
    [18, -35],
    [10, -5],
    [0, 5],
  ],
  [
    [-10, 36],
    [-10, 58],
    [10, 70],
    [40, 70],
    [65, 74],
    [105, 77],
    [145, 65],
    [170, 60],
    [145, 45],
    [130, 32],
    [121, 20],
    [107, 5],
    [100, 1],
    [98, 20],
    [88, 22],
    [80, 8],
    [74, 14],
    [68, 24],
    [57, 25],
    [45, 12],
    [36, 30],
    [25, 40],
    [10, 44],
  ],
  [
    [68, 24],
    [72, 30],
    [77, 35],
    [82, 30],
    [88, 27],
    [96, 28],
    [94, 23],
    [87, 21],
    [83, 17],
    [80, 8],
    [76, 9],
    [73, 17],
  ],
  [
    [113, -22],
    [130, -12],
    [142, -11],
    [153, -27],
    [146, -39],
    [132, -33],
    [115, -35],
  ],
  [
    [47, -13],
    [51, -16],
    [47, -26],
    [44, -22],
  ],
  [
    [95, 5],
    [105, -6],
    [115, -8],
    [119, -5],
    [109, 0],
  ],
];
const stations = [
  [77.2, 28.6],
  [72.88, 19.08],
  [88.36, 22.57],
  [80.27, 13.08],
  [77.59, 12.97],
  [78.49, 17.39],
  [83.22, 17.69],
  [72.57, 23.02],
  [75.79, 26.91],
  [91.74, 26.14],
  [77.41, 23.26],
  [80.95, 26.85],
];

export default function ClimateGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    const c = ctx;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 760px)");
    let frame = 0,
      last = 0,
      phase = 0;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = canvas.height = 640 * dpr;
    c.scale(dpr, dpr);
    function draw(t: number) {
      c.clearRect(0, 0, 640, 640);
      const r = 238,
        cx = 320,
        cy = 320,
        radians = Math.PI / 180;
      // A slow oscillating rotation keeps the Indian observation network in view.
      const longitude = 79 + Math.sin(t / 48) * 13,
        latitude = 20;
      function project(lon: number, lat: number) {
        const a = (lon - longitude) * radians,
          b = lat * radians,
          p = latitude * radians;
        return [
          cx + r * Math.cos(b) * Math.sin(a),
          cy -
            r *
              (Math.cos(p) * Math.sin(b) -
                Math.sin(p) * Math.cos(b) * Math.cos(a)),
          Math.sin(p) * Math.sin(b) + Math.cos(p) * Math.cos(b) * Math.cos(a),
        ];
      }
      const glow = c.createRadialGradient(320, 320, 228, 320, 320, 278);
      glow.addColorStop(0, "#428c982f");
      glow.addColorStop(0.35, "#428c9818");
      glow.addColorStop(1, "#428c9800");
      c.fillStyle = glow;
      c.fillRect(0, 0, 640, 640);
      c.save();
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.clip();
      const ocean = c.createRadialGradient(215, 170, 10, 340, 350, 320);
      ocean.addColorStop(0, "#163d4c");
      ocean.addColorStop(0.65, "#0b2635");
      ocean.addColorStop(1, "#030a12");
      c.fillStyle = ocean;
      c.fillRect(0, 0, 640, 640);
      c.strokeStyle = "#6a9daa22";
      c.lineWidth = 0.65;
      function line(points: number[][]) {
        c.beginPath();
        let pen = false;
        for (const [lon, lat] of points) {
          const [x, y, z] = project(lon, lat);
          if (z < 0) {
            pen = false;
            continue;
          }
          if (pen) c.lineTo(x, y);
          else c.moveTo(x, y);
          pen = true;
        }
        c.stroke();
      }
      for (let lat = -75; lat <= 75; lat += 15)
        line(Array.from({ length: 181 }, (_, i) => [i * 2 - 180, lat]));
      for (let lon = -180; lon < 180; lon += 15)
        line(Array.from({ length: 91 }, (_, i) => [lon, i * 2 - 90]));
      land.forEach((shape, index) => {
        c.beginPath();
        shape.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.closePath();
        c.fillStyle = index === 2 ? "#44827888" : "#36575e88";
        c.strokeStyle = index === 2 ? "#8ac3acaa" : "#68878b70";
        c.lineWidth = index === 2 ? 1.3 : 0.8;
        c.fill();
        c.stroke();
      });
      // Diffuse, low-opacity atmospheric bands; no measured weather is implied.
      for (let i = 0; i < 9; i++) {
        c.strokeStyle = "#bed5d908";
        c.lineWidth = 7 + (i % 3) * 3;
        line(
          Array.from({ length: 70 }, (_, j) => [
            15 + j * 2,
            42 - i * 8 + Math.sin(j / 9 + t / 28 + i) * 4,
          ]),
        );
      }
      c.lineWidth = 0.8;
      c.strokeStyle = "#9fcfc540";
      stations.forEach((station, i) => {
        const [x, y, z] = project(station[0], station[1]);
        if (z < 0) return;
        if (i > 0) {
          const [px, py] = project(stations[i - 1][0], stations[i - 1][1]);
          c.beginPath();
          c.moveTo(px, py);
          c.quadraticCurveTo((px + x) / 2, (py + y) / 2 - 12, x, y);
          c.stroke();
        }
        c.fillStyle = "#a8d4c422";
        c.beginPath();
        c.arc(x, y, 6 + Math.sin(t * 0.7 + i) * 1.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#b7ddcd";
        c.beginPath();
        c.arc(x, y, 2, 0, Math.PI * 2);
        c.fill();
      });
      const shade = c.createLinearGradient(120, 120, 540, 450);
      shade.addColorStop(0, "#00000000");
      shade.addColorStop(0.6, "#00000008");
      shade.addColorStop(1, "#000810d9");
      c.fillStyle = shade;
      c.fillRect(0, 0, 640, 640);
      c.restore();
      c.strokeStyle = "#7db3bd55";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(320, 320);
        c.rotate(-0.3 + i * 0.14);
        c.strokeStyle = "#83b5be25";
        c.lineWidth = 0.7;
        c.beginPath();
        c.ellipse(0, 0, 277 + i * 12, 95 + i * 15, 0, 0.15, Math.PI * 1.1);
        c.stroke();
        const a = t / 22 + i * 1.8;
        c.fillStyle = "#9bbecb88";
        c.beginPath();
        c.arc(
          (277 + i * 12) * Math.cos(a),
          (95 + i * 15) * Math.sin(a),
          1.8,
          0,
          Math.PI * 2,
        );
        c.fill();
        c.restore();
      }
      canvas!.style.opacity = "1";
    }
    function tick(now: number) {
      if (now - last > 50) {
        phase += Math.min((now - last) / 1000, 0.08);
        last = now;
        try {
          draw(phase);
        } catch {
          canvas!.style.opacity = "0";
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(frame);
      if (document.hidden) return;
      try {
        draw(phase);
      } catch {
        return;
      }
      if (!motion.matches && !mobile.matches) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    resume();
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    mobile.addEventListener("change", resume);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
      mobile.removeEventListener("change", resume);
    };
  }, []);
  return <canvas ref={ref} className="climate-canvas" aria-hidden="true" />;
}
