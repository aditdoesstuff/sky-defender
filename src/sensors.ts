import * as THREE from 'three';
import { bearingOf } from './logic';

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

type IOSOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function screenAngle(): number {
  const a = screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
  return THREE.MathUtils.degToRad(a);
}

/** Looks around with phone sensors when present, otherwise with pointer drag. */
export class Look {
  readonly quaternion = new THREE.Quaternion();
  hasSensor = false;
  private yaw = 0;
  private pitch = 0;
  private absolute = false;

  /** Call directly inside a tap handler. iOS only shows the prompt from a user gesture. */
  async requestPermission(): Promise<PermissionResult> {
    const DOE = window.DeviceOrientationEvent as IOSOrientation | undefined;
    if (!DOE) return 'unsupported';
    if (typeof DOE.requestPermission !== 'function') return 'granted';
    try {
      return (await DOE.requestPermission()) === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  start(): void {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.type === 'deviceorientationabsolute') this.absolute = true;
      else if (this.absolute) return;
      const c = e as CompassEvent;
      if (e.beta === null || e.gamma === null) return;
      let alpha = e.alpha ?? 0;
      if (typeof c.webkitCompassHeading === 'number') alpha = 360 - c.webkitCompassHeading;
      this.hasSensor = true;
      const d = THREE.MathUtils.degToRad;
      euler.set(d(e.beta), d(alpha), -d(e.gamma), 'YXZ');
      this.quaternion
        .setFromEuler(euler)
        .multiply(q1)
        .multiply(q0.setFromAxisAngle(zee, -screenAngle()));
    };
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener);
    window.addEventListener('deviceorientation', onOrient);
  }

  /** Drag look: used on desktop or when sensor permission is denied. */
  drag(dx: number, dy: number): void {
    if (this.hasSensor) return;
    this.yaw += dx * 0.004;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, -1.5, 1.5);
    euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.quaternion.setFromEuler(euler);
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(0, 0, -1).applyQuaternion(this.quaternion);
  }

  heading(): number {
    return bearingOf(this.forward());
  }
}

/** Rear camera behind the canvas. Returns false when denied or unavailable. */
export async function startCamera(video: HTMLVideoElement): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    video.classList.add('on');
    return true;
  } catch {
    return false;
  }
}
