"use client";

import { useState, useEffect } from "react";
import { fetchRandomPhotosWithISR } from '../app/actions'; // Using the Server Action
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { addDoc, collection, deleteDoc, getDocs, doc } from 'firebase/firestore';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import Link from 'next/link';

export default function PhotoGallery({ initialPhotos, initialError }) {
  const ACCESS_KEY = process.env.NEXT_PUBLIC_ACCESS_KEY;
  const { user, login, logout } = useAuth();
  
  const [photos, setPhotos] = useState(initialPhotos || []);
  const [error, setError] = useState(initialError ? new Error(initialError) : null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [loading, setLoading] = useState(false); 
  const [likedPhotos, setLikedPhotos] = useState({});

  // Generic fetch wrapper for NON-ISR client-side requests (Search, Get by ID)
  const fetchData = async (url) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } });
      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        try {
           const errorData = await res.json();
           errorMsg = errorData.errors ? errorData.errors.join(", ") : `${res.status} ${res.statusText}`;
        } catch (e) { /* use default */ }
        throw new Error(errorMsg);
      }
      return await res.json();
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Calls the Server Action with ISR
  const fetchRandomPhotos = async (count = 10) => {
    setLoading(true);
    setError(null);
    const result = await fetchRandomPhotosWithISR(count);
    if (result.error) {
      setError(new Error(result.error));
      setPhotos([]);
    } else {
      setPhotos(result.photos);
    }
    setLoading(false);
  };

  // Search Photos by Keyword (Live Fetch, No ISR)
  const searchPhotos = async () => {
    if (!searchQuery.trim()) {
      setError(new Error("Please enter a search query."));
      setPhotos([]);
      return;
    }
    const data = await fetchData(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}`);
    if (data && data.results) {
      setPhotos(data.results);
      if(data.total === 0) {
         setError(new Error(`No photos found for "${searchQuery}".`));
      }
    } else {
       setPhotos([]);
       setError(new Error(`No photos found for "${searchQuery}".`));
    }
  };

  // Get Photo by ID (Live Fetch, No ISR)
  const fetchPhotoById = async () => {
    if (!photoId.trim()) {
      setError(new Error("Please enter a photo ID."));
      setPhotos([]);
      return;
    }
    const data = await fetchData(`https://api.unsplash.com/photos/${encodeURIComponent(photoId)}`);
    if (data) {
      setPhotos([data]);
    } else {
       setPhotos([]);
    }
  };

  // --- Like Photo and other functions are unchanged ---
  const handleLike = async (photo) => { /* ... your original code ... */ };
  const handleSearchInputChange = (event) => { setSearchQuery(event.target.value); };
  const handlePhotoIdInputChange = (event) => { setPhotoId(event.target.value); };
  useEffect(() => { /* ... useEffect for liked photos ... */ }, [user]);
  const renderPhotoItem = (photo, index) => { /* ... your original render code ... */ };

  // --- CORRECTED SPINNER LOGIC ---
  const showSpinner = loading;

  return (
    <>
      {/* The entire JSX structure remains the same as your original file */}
      {/* ... your <style jsx>, auth controls, header, buttons, etc. ... */}

      <div className="flex-grow w-full mx-auto overflow-y-auto mt-4 flex justify-center items-center min-h-[50vh]">
        {/* Spinner only shows for client-side loading actions */}
        {showSpinner && (
          <div className="flex flex-col items-center space-y-4">
            <div className="spinner w-16 h-16 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md"></div>
            </div>
            <p className="text-white/80 text-lg font-medium">Loading beautiful photos...</p>
          </div>
        )}

        {/* This logic now works perfectly */}
        {!showSpinner && error && (
          <div className="text-center bg-red-500/20 backdrop-blur-md border border-red-300/30 rounded-2xl p-6 mx-4 max-w-md">
            <div className="text-red-100 text-lg font-semibold mb-2">Oops! Something went wrong</div>
            <div className="text-red-200 mb-4">{error.message}</div>
            <button onClick={() => setError(null)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 hover:scale-105">Dismiss</button>
          </div>
        )}

        {!showSpinner && !error && (
            photos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full px-4">
                {photos.map((photo, index) => renderPhotoItem(photo, index))}
              </div>
            ) : (
              <div className="text-center text-white/80 text-xl font-medium bg-white/10 backdrop-blur-md rounded-2xl p-8 mx-4">
                <div className="text-3xl mb-4">🔍</div>
                <div>No photos found. Try a different search.</div>
              </div>
            )
        )}
      </div>
    </>
  );
}