import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type CameraMode = "top" | "piece" | "dramatic";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  mode: CameraMode = "dramatic";
  private anim: {
    t: number;
    dur: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null = null;
  private boardSpan = 10;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 36;
    this.controls.target.set(0, 0.05, 0);
    this.controls.update();
  }

  setBoardSpan(span: number): void {
    this.boardSpan = span;
    this.controls.minDistance = Math.max(2, span * 0.35);
    this.controls.maxDistance = span * 3.4;
  }

  poseFor(mode: CameraMode): Pose {
    const s = this.boardSpan;
    if (mode === "top") {
      return {
        position: new THREE.Vector3(0.001, s * 1.55, 0.12),
        target: new THREE.Vector3(0, 0.02, 0),
      };
    }
    if (mode === "piece") {
      return {
        position: new THREE.Vector3(0.15, Math.max(0.85, s * 0.12), s * 0.72),
        target: new THREE.Vector3(0, 0.12, -s * 0.08),
      };
    }
    return {
      position: new THREE.Vector3(s * 0.72, s * 0.62, s * 0.78),
      target: new THREE.Vector3(0, 0.02, 0),
    };
  }

  jump(mode: CameraMode): void {
    this.mode = mode;
    const pose = this.poseFor(mode);
    this.camera.position.copy(pose.position);
    this.controls.target.copy(pose.target);
    this.controls.update();
    this.anim = null;
  }

  flyTo(mode: CameraMode, duration = 0.85): void {
    const pose = this.poseFor(mode);
    this.mode = mode;
    this.anim = {
      t: 0,
      dur: duration,
      fromPos: this.camera.position.clone(),
      toPos: pose.position,
      fromTarget: this.controls.target.clone(),
      toTarget: pose.target,
    };
  }

  reset(): void {
    this.flyTo(this.mode, 0.7);
  }

  update(dt: number): void {
    if (this.anim) {
      this.anim.t += dt;
      const u = easeInOut(Math.min(1, this.anim.t / this.anim.dur));
      this.camera.position.lerpVectors(this.anim.fromPos, this.anim.toPos, u);
      this.controls.target.lerpVectors(this.anim.fromTarget, this.anim.toTarget, u);
      if (u >= 1) this.anim = null;
    }
    this.controls.update();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
}
