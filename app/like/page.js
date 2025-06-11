"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getFirestore, collection, addDoc, deleteDoc, getDocs, query, where, doc } from 'firebase/firestore';

const db = getFirestore();

export default function LikedPhotos() {
  const { user } = useAuth();
  const [likedPhotos, setLikedPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch liked photos
  useEffect(() => {
    const fetchLikedPhotos = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const likedRef = collection(db, 'users', user.uid, 'liked_photos');
        const querySnapshot = await getDocs(likedRef);
        const photos = [];
        querySnapshot.forEach((doc) => {
          photos.push({ id: doc.id, ...doc.data() });
        });
        setLikedPhotos(photos);
      } catch (error) {
        console.error('Error fetching liked photos:', error);
        setError('Failed to fetch liked photos');
      } finally {
        setLoading(false);
      }
    };

    fetchLikedPhotos();
  }, [user]);

  const handleUnlike = async (photoId) => {
    if (!user) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'liked_photos', photoId));
      
      // Update UI
      setLikedPhotos(prev => prev.filter(photo => photo.id !== photoId));
    } catch (error) {
      console.error('Error unliking photo:', error);
      setError('Failed to unlike photo');
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-cyan-200 to-fuchsia-200 p-4">
        <div className="text-center p-6 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
          <p className="text-lg text-gray-800">Please login to view your liked photos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-cyan-200 to-fuchsia-200 p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Your Liked Photos</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="p-3 custom-spinner-animation drop-shadow-2xl bg-gradient-to-bl from-pink-400 via-purple-400 to-indigo-600 h-30 w-30 aspect-square rounded-full">
            <div className="rounded-full h-full w-full bg-slate-100 dark:bg-zinc-900 background-blur-md"></div>
          </div>
        </div>
      ) : error ? (
        <div className="text-center text-red-600">{error}</div>
      ) : likedPhotos.length === 0 ? (
        <div className="text-center text-gray-600">
          <p>No liked photos yet</p>
          <p className="text-sm mt-2">Start liking photos to see them here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {likedPhotos.map((photo) => (
            <div key={photo.id} className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-lg border border-white/20">
              <img
                src={photo.imageUrl}
                alt={photo.description || 'Liked photo'}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                {photo.description && (
                  <p className="text-gray-700 mb-2">{photo.description}</p>
                )}
                <button
                  onClick={() => handleUnlike(photo.id)}
                  className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md 
                    border border-white/20 shadow-sm
                    hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 
                    transition-all duration-300 ease-out
                    w-full"
                >
                  Unlike Photo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}