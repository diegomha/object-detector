import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Box, CircularProgress } from '@mui/material';
import { openDB } from 'idb';

interface Prediction extends cocoSsd.DetectedObject {
  type: string;
}

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualPredictions, setManualPredictions] = useState<Prediction[]>([]);

  const dbPromise = openDB('ai-training', 1, {
    upgrade(db) {
      db.createObjectStore('predictions', { keyPath: 'id', autoIncrement: true });
    },
  });

  useEffect(() => {
    const loadModel = async () => {
      const loadedModel = await cocoSsd.load();
      setModel(loadedModel);
      setLoading(false);
    };
    loadModel();
    startVideo();
    loadManualPredictions();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(err => {
        console.error('Error accessing webcam: ', err);
      });
  };

  const loadManualPredictions = async () => {
    const db = await dbPromise;
    const allPredictions = await db.getAll('predictions');
    setManualPredictions(allPredictions);
  };

  const detectObjects = async () => {
    if (model && videoRef.current && canvasRef.current) {
      const predictions = await model.detect(videoRef.current);
      drawPredictions(predictions);
    }
  };

  const drawPredictions = (predictions: cocoSsd.DetectedObject[]) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const manualPrediction = manualPredictions.find(p => p.class === prediction.class);

        ctx.strokeStyle = manualPrediction ? '#FF0000' : '#00FFFF'; // Red if manually labeled
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height); // Draw rectangle
        ctx.font = '18px Arial';
        ctx.fillStyle = manualPrediction ? '#FF0000' : '#00FFFF';
        ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x, y - 10);
      });
    }
  };

  useEffect(() => {
    if (!loading) {
      const interval = setInterval(detectObjects, 100);
      return () => clearInterval(interval);
    }
  }, [loading, manualPredictions]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
      <video ref={videoRef} style={{ display: loading ? 'none' : 'block' }} width="640" height="480" />
      <canvas ref={canvasRef} width="640" height="480" style={{ position: 'absolute', top: 0, left: 0 }} />
      {loading && <CircularProgress sx={{ mt: 2 }} />}
    </Box>
  );
};

export default App;
