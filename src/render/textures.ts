import * as THREE from "three";

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function makeWoodTexture(w = 512, h = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n =
        0.55 * hash(x * 0.015, y * 0.08) +
        0.3 * hash(x * 0.04, y * 0.2) +
        0.15 * Math.sin(y * 0.11 + Math.sin(x * 0.03) * 2);
      const ring = Math.sin((y + n * 18) * 0.085) * 0.08;
      const r = 176 + n * 40 + ring * 30;
      const g = 126 + n * 28 + ring * 18;
      const b = 72 + n * 16;
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = i % 2 ? "#5a3518" : "#3a2010";
    ctx.lineWidth = 1 + (i % 3);
    const y = (i / 40) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 6) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 5);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeFeltTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash(x * 0.8, y * 0.8);
      const i = (y * w + x) * 4;
      img.data[i] = 28 + n * 18;
      img.data[i + 1] = 42 + n * 16;
      img.data[i + 2] = 36 + n * 12;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export function makeCoordTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(243, 230, 200, 0.92)";
  ctx.font = "700 72px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
