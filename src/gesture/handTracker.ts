import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

// Thin MediaPipe wrapper. Emits up to two index fingertips per frame as
// normalized MIRRORED coordinates (selfie view: on-screen left = your left).
// Aspect-ratio mapping to canvas pixels is the caller's job (see coords.ts).
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private lastVideoTime = -1;

  get videoAspect(): number {
    const v = this.video;
    return v && v.videoWidth > 0 ? v.videoWidth / v.videoHeight : 16 / 9;
  }

  async init(video: HTMLVideoElement): Promise<void> {
    this.video = video;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });
    video.srcObject = this.stream;
    await video.play();

    try {
      const fileset = await FilesetResolver.forVisionTasks("/wasm");
      this.landmarker = await createLandmarker(fileset);
    } catch {
      this.stop();
      throw new Error(
        "手部模型加载失败：请联网后运行 `npm run fetch-assets` 重新下载模型，并确认 public/models/hand_landmarker.task 存在。"
      );
    }
  }

  // Up to two mirrored, normalized index fingertips. Returns [] when no new
  // frame is available (MediaPipe rejects duplicate timestamps) or no hands.
  detect(now: number): { x: number; y: number }[] {
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return [];
    if (video.currentTime === this.lastVideoTime) return [];
    this.lastVideoTime = video.currentTime;

    const result = landmarker.detectForVideo(video, now);
    return (result.landmarks ?? [])
      .filter((lm) => lm.length > 8)
      .slice(0, 2)
      .map((lm) => ({ x: 1 - lm[8].x, y: lm[8].y })); // mirror x for selfie view
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.lastVideoTime = -1;
  }
}

async function createLandmarker(fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>) {
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  try {
    return await HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    // Some machines/drivers reject the GPU delegate — fall back to CPU.
    return HandLandmarker.createFromOptions(fileset, options("CPU"));
  }
}
