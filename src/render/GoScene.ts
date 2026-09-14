import * as THREE from "three";
import { BLACK, EMPTY, GoGame, starPoints, type Cell } from "../engine/go";
import type { Highlight } from "../lessons/lessons";
import { CameraRig, type CameraMode } from "./cameraRig";
import { makeCoordTexture, makeFeltTexture, makeWoodTexture } from "./textures";

const LETTERS = "ABCDEFGHJKLMNOPQRST";

export interface SceneCallbacks {
  onIntersect: (x: number, y: number, kind: "hover" | "play") => void;
  onMiss: () => void;
}

interface StoneVis {
  mesh: THREE.Mesh;
  color: Cell;
  drop: number;
  capture: number;
  dead: boolean;
}

export class GoScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  private boardGroup = new THREE.Group();
  private stoneGroup = new THREE.Group();
  private markerGroup = new THREE.Group();
  private coordGroup = new THREE.Group();
  private hover: THREE.Mesh;
  private lastRing: THREE.Mesh;
  private koDisc: THREE.Mesh;
  private highlights: THREE.Mesh[] = [];
  private stones = new Map<number, StoneVis>();
  private size = 9;
  private spacing = 1;
  private boardY = 0.12;
  private pickPlane: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();
  private callbacks: SceneCallbacks;
  private coordsOn = false;
  private down: { x: number; y: number; t: number } | null = null;
  private wood: THREE.CanvasTexture;
  private felt: THREE.CanvasTexture;
  private blackMat: THREE.MeshStandardMaterial;
  private whiteMat: THREE.MeshStandardMaterial;
  private stoneGeo: THREE.SphereGeometry;
  private hoverLegal = new THREE.MeshStandardMaterial({
    color: 0x7dcea0,
    emissive: 0x1f5a38,
    transparent: true,
    opacity: 0.55,
    roughness: 0.6,
  });
  private hoverIllegal = new THREE.MeshStandardMaterial({
    color: 0xe07a6a,
    emissive: 0x5a2018,
    transparent: true,
    opacity: 0.4,
    roughness: 0.6,
  });

  constructor(canvas: HTMLCanvasElement, callbacks: SceneCallbacks) {
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120e0b);
    this.scene.fog = new THREE.Fog(0x120e0b, 18, 48);

    this.rig = new CameraRig(canvas);
    this.wood = makeWoodTexture();
    this.felt = makeFeltTexture();

    const hemi = new THREE.HemisphereLight(0xfff1d6, 0x2a2018, 0.7);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff3dc, 1.35);
    key.position.set(6, 12, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.bias = -0.00025;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aacc, 0.28);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);

    this.scene.add(this.boardGroup, this.stoneGroup, this.markerGroup, this.coordGroup);

    this.stoneGeo = new THREE.SphereGeometry(0.42, 32, 20);
    this.blackMat = new THREE.MeshStandardMaterial({
      color: 0x161616,
      roughness: 0.38,
      metalness: 0.12,
    });
    this.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf3efe6,
      roughness: 0.32,
      metalness: 0.08,
    });

    const hoverGeo = new THREE.CircleGeometry(0.28, 28);
    this.hover = new THREE.Mesh(hoverGeo, this.hoverLegal);
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;
    this.markerGroup.add(this.hover);

    const ringGeo = new THREE.RingGeometry(0.1, 0.16, 24);
    this.lastRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xe8c872, side: THREE.DoubleSide }),
    );
    this.lastRing.rotation.x = -Math.PI / 2;
    this.lastRing.visible = false;
    this.markerGroup.add(this.lastRing);

    this.koDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xe07a6a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.koDisc.rotation.x = -Math.PI / 2;
    this.koDisc.visible = false;
    this.markerGroup.add(this.koDisc);

    this.pickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = this.boardY + 0.02;
    this.scene.add(this.pickPlane);

    const felt = new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      new THREE.MeshStandardMaterial({ map: this.felt, roughness: 0.95, color: 0x8aa090 }),
    );
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = -0.08;
    felt.receiveShadow = true;
    this.scene.add(felt);

    this.bindInput(canvas);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  worldOf(x: number, y: number): THREE.Vector3 {
    const half = (this.size - 1) / 2;
    return new THREE.Vector3((x - half) * this.spacing, this.boardY + 0.02, (y - half) * this.spacing);
  }

  rebuildBoard(size: number): void {
    this.size = size;
    this.spacing = size >= 19 ? 0.72 : size >= 13 ? 0.88 : 1;
    this.clearGroup(this.boardGroup);
    this.clearGroup(this.coordGroup);
    this.clearStones();

    const extent = (size - 1) * this.spacing;
    const margin = this.spacing * 0.85;
    const boardW = extent + margin * 2;
    const thick = 0.2;

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.wood,
      roughness: 0.62,
      metalness: 0.04,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e18,
      roughness: 0.55,
      map: this.wood,
    });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(boardW, thick, boardW), woodMat);
    slab.position.y = this.boardY - thick / 2 + 0.02;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.boardGroup.add(slab);

    const rimH = 0.08;
    const rimT = 0.1;
    const rims: THREE.Mesh[] = [
      new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.08, rimH, rimT), rimMat),
      new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.08, rimH, rimT), rimMat),
      new THREE.Mesh(new THREE.BoxGeometry(rimT, rimH, boardW), rimMat),
      new THREE.Mesh(new THREE.BoxGeometry(rimT, rimH, boardW), rimMat),
    ];
    rims[0].position.set(0, this.boardY + 0.01, boardW / 2);
    rims[1].position.set(0, this.boardY + 0.01, -boardW / 2);
    rims[2].position.set(boardW / 2, this.boardY + 0.01, 0);
    rims[3].position.set(-boardW / 2, this.boardY + 0.01, 0);
    for (const r of rims) {
      r.castShadow = true;
      this.boardGroup.add(r);
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x2a1c10 });
    const points: THREE.Vector3[] = [];
    const y = this.boardY + 0.022;
    for (let i = 0; i < size; i++) {
      const a = this.worldOf(0, i);
      const b = this.worldOf(size - 1, i);
      points.push(new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(b.x, y, b.z));
      const c = this.worldOf(i, 0);
      const d = this.worldOf(i, size - 1);
      points.push(new THREE.Vector3(c.x, y, c.z), new THREE.Vector3(d.x, y, d.z));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    this.boardGroup.add(new THREE.LineSegments(lineGeo, lineMat));

    const hoshiMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.8 });
    const hoshiGeo = new THREE.CircleGeometry(this.spacing * 0.08, 16);
    for (const [hx, hy] of starPoints(size)) {
      const m = new THREE.Mesh(hoshiGeo, hoshiMat);
      const p = this.worldOf(hx, hy);
      m.position.set(p.x, y + 0.001, p.z);
      m.rotation.x = -Math.PI / 2;
      this.boardGroup.add(m);
    }

    this.buildCoords();
    this.pickPlane.position.y = this.boardY + 0.03;
    this.rig.setBoardSpan(boardW);
    this.rig.jump(this.rig.mode);
  }

  private buildCoords(): void {
    this.clearGroup(this.coordGroup);
    const y = this.boardY + 0.03;
    const off = this.spacing * 0.55;
    for (let i = 0; i < this.size; i++) {
      const letter = LETTERS[i] ?? String(i);
      const num = String(this.size - i);
      const a = this.worldOf(i, 0);
      const b = this.worldOf(0, i);
      this.coordSprite(letter, a.x, y, a.z + off);
      this.coordSprite(num, b.x - off, y, b.z);
    }
    this.coordGroup.visible = this.coordsOn;
  }

  private coordSprite(text: string, x: number, y: number, z: number): void {
    const tex = makeCoordTexture(text);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.position.set(x, y, z);
    spr.scale.set(0.38, 0.38, 1);
    this.coordGroup.add(spr);
  }

  setCoordinates(on: boolean): void {
    this.coordsOn = on;
    this.coordGroup.visible = on;
  }

  setCamera(mode: CameraMode): void {
    this.rig.flyTo(mode);
  }

  resetCamera(): void {
    this.rig.reset();
  }

  setHover(x: number, y: number, legal: boolean): void {
    const p = this.worldOf(x, y);
    this.hover.position.set(p.x, this.boardY + 0.028, p.z);
    this.hover.material = legal ? this.hoverLegal : this.hoverIllegal;
    this.hover.visible = true;
  }

  hideHover(): void {
    this.hover.visible = false;
  }

  setHighlights(list: Highlight[]): void {
    for (const m of this.highlights) {
      this.markerGroup.remove(m);
      m.geometry.dispose();
    }
    this.highlights = [];
    const colors: Record<Highlight["tone"], number> = {
      hint: 0x7dcea0,
      hot: 0xe8c872,
      good: 0x6ec6ff,
      bad: 0xe07a6a,
    };
    for (const h of list) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.3, 28),
        new THREE.MeshBasicMaterial({
          color: colors[h.tone],
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        }),
      );
      const p = this.worldOf(h.x, h.y);
      m.position.set(p.x, this.boardY + 0.035, p.z);
      m.rotation.x = -Math.PI / 2;
      this.markerGroup.add(m);
      this.highlights.push(m);
    }
  }

  sync(game: GoGame, captured: number[] = []): void {
    const now = game.cloneBoard();
    for (const i of captured) {
      const vis = this.stones.get(i);
      if (vis) vis.capture = 0.001;
    }
    for (let i = 0; i < now.length; i++) {
      const cell = now[i];
      const vis = this.stones.get(i);
      if (cell === EMPTY) {
        if (vis && vis.capture === 0) vis.capture = 0.001;
        continue;
      }
      if (!vis) this.spawnStone(i, cell, game);
      else {
        vis.color = cell;
        vis.dead = game.dead[i];
        vis.mesh.material = cell === BLACK ? this.blackMat : this.whiteMat;
        vis.mesh.scale.set(1, 0.48, 1);
      }
    }

    if (game.lastMove !== null && game.lastMove >= 0 && now[game.lastMove] !== EMPTY) {
      const [x, y] = game.xy(game.lastMove);
      const p = this.worldOf(x, y);
      this.lastRing.position.set(p.x, this.boardY + 0.22, p.z);
      this.lastRing.visible = true;
      const col = now[game.lastMove] === BLACK ? 0xe8c872 : 0x3a2a10;
      (this.lastRing.material as THREE.MeshBasicMaterial).color.setHex(col);
    } else {
      this.lastRing.visible = false;
    }

    if (game.koPoint !== null) {
      const [x, y] = game.xy(game.koPoint);
      const p = this.worldOf(x, y);
      this.koDisc.position.set(p.x, this.boardY + 0.03, p.z);
      this.koDisc.visible = true;
    } else {
      this.koDisc.visible = false;
    }
  }

  private spawnStone(i: number, color: Cell, game: GoGame): void {
    const mesh = new THREE.Mesh(this.stoneGeo, color === BLACK ? this.blackMat : this.whiteMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(1, 0.48, 1);
    const [x, y] = game.xy(i);
    const p = this.worldOf(x, y);
    mesh.position.set(p.x, this.boardY + 0.72, p.z);
    this.stoneGroup.add(mesh);
    this.stones.set(i, { mesh, color, drop: 0.001, capture: 0, dead: game.dead[i] });
  }

  private clearStones(): void {
    for (const vis of this.stones.values()) this.stoneGroup.remove(vis.mesh);
    this.stones.clear();
  }

  private clearGroup(g: THREE.Group): void {
    while (g.children.length) {
      const ch = g.children.pop()!;
      g.remove(ch);
      if ((ch as THREE.Mesh).geometry) (ch as THREE.Mesh).geometry.dispose();
    }
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    const setPtr = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    canvas.addEventListener("pointermove", (e) => {
      setPtr(e);
      const hit = this.pick();
      if (hit) this.callbacks.onIntersect(hit.x, hit.y, "hover");
      else this.callbacks.onMiss();
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!this.down || e.button !== 0) return;
      const dx = e.clientX - this.down.x;
      const dy = e.clientY - this.down.y;
      const dt = performance.now() - this.down.t;
      this.down = null;
      if (dx * dx + dy * dy > 100 || dt > 700) return;
      setPtr(e);
      const hit = this.pick();
      if (hit) this.callbacks.onIntersect(hit.x, hit.y, "play");
    });

    canvas.addEventListener("pointerleave", () => {
      this.callbacks.onMiss();
      this.down = null;
    });
  }

  pick(): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const hits = this.raycaster.intersectObject(this.pickPlane);
    if (!hits.length) return null;
    const p = hits[0].point;
    const half = (this.size - 1) / 2;
    const fx = p.x / this.spacing + half;
    const fy = p.z / this.spacing + half;
    let x = Math.round(fx);
    let y = Math.round(fy);
    const dist = Math.hypot(fx - x, fy - y);
    if (dist > 0.62) return null;
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return { x, y };
  }

  start(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.rig.update(dt);
      this.tickStones(dt);
      const t = this.clock.elapsedTime;
      for (const m of this.highlights) {
        const s = 1 + Math.sin(t * 3) * 0.08;
        m.scale.set(s, s, 1);
      }
      this.renderer.render(this.scene, this.rig.camera);
    };
    loop();
  }

  private tickStones(dt: number): void {
    const restY = this.boardY + 0.095;
    for (const [i, vis] of this.stones) {
      if (vis.capture > 0) {
        vis.capture += dt * 2.8;
        vis.mesh.position.y = restY + vis.capture * 0.9;
        vis.mesh.rotation.z = vis.capture * 2;
        const s = Math.max(0.01, 1 - vis.capture);
        vis.mesh.scale.set(s, 0.48 * s, s);
        if (vis.capture >= 1) {
          this.stoneGroup.remove(vis.mesh);
          this.stones.delete(i);
        }
        continue;
      }

      if (vis.drop > 0 && vis.drop < 1) {
        vis.drop = Math.min(1, vis.drop + dt * 3.4);
        const u = vis.drop;
        const bounce = Math.sin(u * Math.PI) * 0.08 * (1 - u);
        vis.mesh.position.y = THREE.MathUtils.lerp(this.boardY + 0.72, restY, u) + bounce;
      } else {
        vis.mesh.position.y = vis.dead ? restY - 0.02 : restY;
      }

      const base = vis.dead ? 0.72 : 1;
      const flat = vis.dead ? 0.34 : 0.48;
      vis.mesh.scale.set(base, flat, base);
      vis.mesh.material = vis.color === BLACK ? this.blackMat : this.whiteMat;
    }
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
  }
}
