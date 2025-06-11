"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadString } from 'firebase/storage';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = getFirestore();
const storage = getStorage();
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export default function GenerateImage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [userImages, setUserImages] = useState([]);
  const [error, setError] = useState(null);

  // Fetch user's previously generated images
  useEffect(() => {
    const fetchUserImages = async () => {
      if (!user) return;
      
      try {
        const q = query(collection(db, 'generated_images'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const images = [];
        querySnapshot.forEach((doc) => {
          images.push({ id: doc.id, ...doc.data() });
        });
        setUserImages(images);
      } catch (error) {
        console.error('Error fetching images:', error);
        setError('Failed to fetch your images');
      }
    };

    fetchUserImages();
  }, [user]);

  const generateImage = async () => {
    if (!user) {
      setError('Please login to generate images');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Initialize the model
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

      // Generate the image
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const imageData = response.text;

      // Save to Firebase Storage
      const storageRef = ref(storage, `generated_images/${user.uid}/${Date.now()}.jpg`);
      await uploadString(storageRef, imageData, 'data_url');

      // Get the download URL first
      const imageUrl = await storageRef.getDownloadURL();

      // Save metadata to Firestore
      const docRef = await addDoc(collection(db, 'generated_images'), {
        userId: user.uid,
        prompt: prompt,
        imageUrl: imageUrl,
        createdAt: new Date().toISOString()
      });

      // Update UI with the already retrieved URL
      setGeneratedImages(prev => [...prev, {
        id: docRef.id,
        imageUrl: imageUrl,
        prompt: prompt
      }]);

      setPrompt('');
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">AI Image Generation</h1>

      {/* Input Section */}
      <div className="mb-8">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="w-full p-3 border rounded-lg resize-none h-32"
          disabled={loading}
        />
        <button
          onClick={generateImage}
          disabled={loading || !user}
          className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Image'}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Generated Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {generatedImages.map((image) => (
          <div key={image.id} className="border rounded-lg overflow-hidden">
            <img
              src={image.imageUrl}
              alt={image.prompt}
              className="w-full h-48 object-cover"
            />
            <p className="p-2 text-sm text-gray-600">{image.prompt}</p>
          </div>
        ))}
      </div>

      {/* Previous Images Section */}
      {userImages.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Your Previous Generations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userImages.map((image) => (
              <div key={image.id} className="border rounded-lg overflow-hidden">
                <img
                  src={image.imageUrl}
                  alt={image.prompt}
                  className="w-full h-48 object-cover"
                />
                <p className="p-2 text-sm text-gray-600">{image.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}