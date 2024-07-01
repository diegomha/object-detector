import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { Box, CircularProgress, Button, ButtonGroup } from '@mui/material';
import { openDB } from 'idb';
import axios from 'axios';

interface Prediction extends cocoSsd.DetectedObject {
  type: string;
}

const UNSPLASH_ACCESS_KEY = 'BLoFG_OrMY7SGG5uBLiA9pKoXbRkrtn8sEGwey9sp48'; // Substitua com sua Access Key do Unsplash

const App: React.FC = () => {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [currentPredictionIndex, setCurrentPredictionIndex] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectionName, setDetectionName] = useState<string>('');

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
    loadRandomImage();
  }, []);

  const loadRandomImage = async () => {
    try {
      const response = await axios.get(`https://api.unsplash.com/photos/random?client_id=${UNSPLASH_ACCESS_KEY}&w=640&h=480`);
      setImage(response.data.urls.regular);
    } catch (error) {
      console.error('Error fetching image from Unsplash:', error);
      setImage(null); // Reset image if there's an error
    }
  };

  const detectObjects = async () => {
    if (model && image && canvasRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = image;
      img.onload = async () => {
        const detectedObjects = await model.detect(img);
        const predictionsWithTypes = detectedObjects.map((prediction) => ({ ...prediction, type: '' }));
        setPredictions(predictionsWithTypes);
        setCurrentPredictionIndex(0);
        drawPredictions(predictionsWithTypes);
      };
    }
  };

  const drawPredictions = (predictions: Prediction[]) => {
    const ctx = canvasRef.current?.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = image!;
    img.onload = () => {
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        predictions.forEach(prediction => {
          setDetectionName(prediction.class);
          const [x, y, width, height] = prediction.bbox;
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height); // Draw rectangle
          ctx.font = '18px Arial';
          ctx.fillStyle = '#00FFFF';
          ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x, y + 15);
        });
      }
    };
  };

  const classifyImage = async (type: string) => {
    if (predictions[currentPredictionIndex]) {
      const updatedPredictions = [...predictions];
      updatedPredictions[currentPredictionIndex].type = type;
      setPredictions(updatedPredictions);

      if (currentPredictionIndex < predictions.length - 1) {
        setCurrentPredictionIndex(currentPredictionIndex + 1);
      } else {
        await savePredictions(updatedPredictions);
      }
    }
  };

  const savePredictions = async (predictions: Prediction[]) => {
    const db = await dbPromise;
    predictions.forEach(async prediction => {
      await db.add('predictions', prediction);
    });
    console.log('Predictions saved to IndexedDB');
    loadRandomImage(); // Load a new image after saving
  };

  useEffect(() => {
    if (image) {
      detectObjects();
    }
  }, [image, model]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
      {loading && <CircularProgress sx={{ mt: 2 }} />}
      {!loading && image && (
        <>
          <canvas ref={canvasRef} width="640" height="480" />
          <ButtonGroup sx={{ mt: 2 }}>
            <Button onClick={() => classifyImage('person')}>Person</Button>
            <Button onClick={() => classifyImage('car')}>Car</Button>
            <Button onClick={() => classifyImage(detectionName)}>{detectionName.toUpperCase()}</Button>
          </ButtonGroup>
          <Button onClick={loadRandomImage} sx={{ mt: 2 }}>Load New Image</Button>
        </>
      )}
      {!loading && !image && (
        <Box sx={{ mt: 2 }}>Failed to load image. Please try again.</Box>
      )}
    </Box>
  );
};

export default App;
