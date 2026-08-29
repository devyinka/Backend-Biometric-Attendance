import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';

export const faceService = {
  async loadModels() {
    const modelPath = './models';

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    console.log('Face detection models loaded successfully');
  },

  facedetection: async (imageBuffer: Buffer): Promise<number[]> => {
    const imageTensor = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;

    try {
      const detection = await faceapi
        .detectSingleFace(imageTensor)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected in the image');
      }

      return Array.from(detection.descriptor);
    } finally {
      imageTensor.dispose();
    }
  },

  verifyFace: async (
    enrolledface: number[],
    detectedface: number[],
  ): Promise<boolean> => {
    const floatEnrolled = new Float32Array(enrolledface);
    const floatNew = new Float32Array(detectedface);

    const distance = faceapi.euclideanDistance(
      floatEnrolled,
      floatNew,
    );

    console.log('Face distance:', distance);

    return distance < 0.5;
  },
};
/*


import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";

export const faceService = {
  async loadModels() {
    const modelPath = "./models";
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  },
  facedetection: async (imageBuffer: Buffer): Promise<number[]> => {
    const Tensor = tf.node.decodeImage(imageBuffer, 3) as any;
    const detection = await faceapi
      .detectSingleFace(Tensor)
      .withFaceLandmarks()
      .withFaceDescriptor();
    tf.dispose(Tensor); // Dispose the tensor to free memory
    if (!detection) {
      throw new Error("No face detected in the image");
    }
    const descriptorArray = Array.from(detection.descriptor);
    return descriptorArray;
  },

  verifyFace: async (
    enrolledface: number[],
    detectedface: number[],
  ): Promise<boolean> => {
    const floatEnrolled = new Float32Array(enrolledface);
    const floatNew = new Float32Array(detectedface);
    const distance = faceapi.euclideanDistance(floatEnrolled, floatNew);
    return distance < 0.5; //
  },
};


*/
