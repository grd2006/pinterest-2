"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';

const db = getFirestore();

export default function UploadPage() {
  const { user } = useAuth();
  const [userImages, setUserImages] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch user's uploaded images
  useEffect(() => {
    const fetchUserImages = async () => {
      if (!user) return;
      try {
        const userImagesRef = collection(db, 'users', user.uid, 'uploaded_images');
        const querySnapshot = await getDocs(userImagesRef);
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

  const handleImageUpload = async (event) => {
    if (!user) return;
    
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size should be less than 2MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Convert image to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // Extract base64 data
      const base64Data = base64Image.split(',')[1];

      const formData = new FormData();
      formData.append('key', process.env.NEXT_PUBLIC_IMGBB_API_KEY);
      formData.append('image', base64Data);

      const response = await axios.post('https://api.imgbb.com/1/upload', formData);
      const imageUrl = response.data.data.url;

      // Update Firestore save logic
      const userImagesRef = collection(db, 'users', user.uid, 'uploaded_images');
      const docRef = await addDoc(userImagesRef, {
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
        userName: user.displayName || 'Anonymous'
      });

      // Update UI
      setUserImages(prev => [{
        id: docRef.id,
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
        userName: user.displayName || 'Anonymous'
      }, ...prev]);

    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Upload Images</h1>

      {!user && (
        <div className="text-center p-4 bg-yellow-100 rounded-lg mb-6">
          Please login to upload and view images
        </div>
      )}

      {user && (
        <div className="mb-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={uploading}
            />
            <label
              htmlFor="image-upload"
              className={`inline-block px-6 py-3 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? 'Uploading...' : 'Select Image to Upload'}
            </label>
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Display uploaded images */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {userImages.map((image) => (
          <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <img
              src={image.imageUrl}
              alt={`Uploaded by ${image.userName}`}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <p className="text-sm text-gray-600">
                Uploaded by: {image.userName}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(image.createdAt).toLocaleDateString()} at{' '}
                {new Date(image.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {userImages.length === 0 && user && (
        <div className="text-center text-gray-500 mt-8">
          <p>No images uploaded yet</p>
          <p className="text-sm mt-2">Upload your first image using the button above!</p>
        </div>
      )}
    </div>
  );
}