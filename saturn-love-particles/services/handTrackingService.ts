import { HandGesture } from '../types';

// Declare global variable for the script-loaded library
declare var Hands: any;

interface Results {
    multiHandLandmarks: any[][];
    image: any;
}

export class HandTracker {
  private hands: any;
  private videoElement: HTMLVideoElement;
  private onGestureCallback: (gesture: HandGesture) => void;
  private animationFrameId: number | null = null;
  private stream: MediaStream | null = null;

  constructor(videoElement: HTMLVideoElement, onGesture: (gesture: HandGesture) => void) {
    this.videoElement = videoElement;
    this.onGestureCallback = onGesture;

    this.hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults(this.onResults);
  }

  private onResults = (results: Results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.onGestureCallback(HandGesture.NONE);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const gesture = this.detectGesture(landmarks);
    this.onGestureCallback(gesture);
  };

  private detectGesture(landmarks: any[]): HandGesture {
    // Simple heuristic: Distance between wrist (0) and fingertips
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Calculate average distance of fingertips to wrist
    const getDist = (p1: any, p2: any) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const tipDistances = [
      getDist(thumbTip, wrist),
      getDist(indexTip, wrist),
      getDist(middleTip, wrist),
      getDist(ringTip, wrist),
      getDist(pinkyTip, wrist),
    ];

    const avgDist = tipDistances.reduce((a, b) => a + b, 0) / 5;

    // Thresholds tuned based on normalized coordinates (0-1)
    if (avgDist < 0.25) {
      return HandGesture.CLOSED;
    } else if (avgDist > 0.35) {
      return HandGesture.OPEN;
    }

    return HandGesture.UNKNOWN;
  }

  public async start() {
    if (this.stream) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      this.videoElement.srcObject = this.stream;
      
      await new Promise<void>((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play().catch(e => console.error("Play error", e));
          resolve();
        };
      });

      this.processVideo();
    } catch (e) {
      console.error("Error accessing camera:", e);
      throw e;
    }
  }

  private processVideo = async () => {
    if (!this.stream) return; 

    if (this.videoElement && !this.videoElement.paused && !this.videoElement.ended) {
        try {
            await this.hands.send({ image: this.videoElement });
        } catch (e) {
            console.error("Hand tracking error", e);
        }
    }
    
    this.animationFrameId = requestAnimationFrame(this.processVideo);
  };

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
    }
  }
}