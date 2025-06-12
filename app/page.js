"use client";

import { useState, useEffect } from "react";
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { addDoc, collection, deleteDoc, getDocs, doc } from 'firebase/firestore';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import Link from 'next/link';

export default function Home() {
  const ACCESS_KEY = process.env.NEXT_PUBLIC_ACCESS_KEY;
  const { user, login, logout, loading: authLoading } = useAuth();
  // State to hold the list of photos to display
  const [photos, setPhotos] = useState([]);
  // State for input values
  const [searchQuery, setSearchQuery] = useState("");
  const [photoId, setPhotoId] = useState("");
  // State for loading indicator
  const [loading, setLoading] = useState(false);
  // State for error messages
  const [error, setError] = useState(null);
  // State to track what is currently displayed
  const [displayType, setDisplayType] = useState("initial"); // 'initial', 'photos'
  // State to manage liked photos
  const [likedPhotos, setLikedPhotos] = useState({});

  // --- API Fetching Functions ---

  // Generic fetch wrapper with loading and error handling
  const fetchData = async (url) => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        },
      });
      if (!res.ok) {
        // Try to parse error details from response body if available
        let errorMsg = `HTTP error! status: ${res.status}`;
        try {
           const errorData = await res.json();
           if (errorData.errors) {
             errorMsg = errorData.errors.join(", ");
           } else if (errorData.message) {
             errorMsg = errorData.message;
           } else {
            errorMsg = `${res.status} ${res.statusText}`;
           }
        } catch (parseError) {
           // If JSON parsing fails, use default error message
           console.error("Failed to parse error response:", parseError);
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Fetch Error:", err);
      setError(err);
      setPhotos([]);
      setDisplayType("photos");
      setLoading(false);
      return null;
    }
  };

  // Get Random Photo(s) - Unsplash API allows count parameter
  const fetchRandomPhotos = async (count = 10) => {
    const data = await fetchData(`https://api.unsplash.com/photos/random?count=${count}`);
    if (data) {
      setPhotos(Array.isArray(data) ? data : [data]);
      setDisplayType("photos");
    } else {
       setPhotos([]);
       setDisplayType("photos");
    }
     setLoading(false);
  };

  // Search Photos by Keyword
  const searchPhotos = async () => {
    if (!searchQuery.trim()) {
      setError(new Error("Please enter a search query."));
      setPhotos([]);
      setDisplayType("photos");
      return;
    }
    const data = await fetchData(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}`);
    if (data && data.results) {
      setPhotos(data.results);
      setDisplayType("photos");
      if(data.total === 0) {
         setError(new Error(`No photos found for "${searchQuery}".`));
      }
    } else if (data && data.total === 0) {
       setPhotos([]);
       setError(new Error(`No photos found for "${searchQuery}".`));
       setDisplayType("photos");
    } else {
        setPhotos([]);
        setDisplayType("photos");
    }
    setLoading(false);
  };

  // Get Photo by ID
  const fetchPhotoById = async () => {
    if (!photoId.trim()) {
      setError(new Error("Please enter a photo ID."));
      setPhotos([]);
      setDisplayType("photos");
      return;
    }
    const data = await fetchData(`https://api.unsplash.com/photos/${encodeURIComponent(photoId)}`);
    if (data) {
      setPhotos([data]);
      setDisplayType("photos");
    } else {
       setPhotos([]);
       setDisplayType("photos");
    }
    setLoading(false);
  };

  // --- Like Photo Function ---

  const handleLike = async (photo) => {
    if (!user) {
      setError(new Error('Please login to like photos'));
      return;
    }

    try {
      if (likedPhotos[photo.id]) {
        // Unlike photo
        await deleteDoc(doc(db, 'users', user.uid, 'liked_photos', likedPhotos[photo.id]));
        setLikedPhotos(prev => {
          const newLiked = { ...prev };
          delete newLiked[photo.id];
          return newLiked;
        });
      } else {
        // Like photo
        const docRef = await addDoc(collection(db, 'users', user.uid, 'liked_photos'), {
          imageUrl: photo.urls.regular,
          description: photo.description || photo.alt_description,
          likedAt: new Date().toISOString(),
          photographerName: photo.user.name,
          unsplashId: photo.id
        });
        setLikedPhotos(prev => ({
          ...prev,
          [photo.id]: docRef.id
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setError(new Error('Failed to update like status'));
    }
  };

  // --- Event Handlers ---

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handlePhotoIdInputChange = (event) => {
    setPhotoId(event.target.value);
  };

  // --- Initial Fetch on Mount ---
  useEffect(() => {
    if (displayType === 'initial' && photos.length === 0 && !loading && !error) {
       fetchRandomPhotos(10);
    }
  }, [ACCESS_KEY, displayType, photos.length, loading, error]);

  // Fetch liked photos on mount
  useEffect(() => {
    const fetchLikedPhotos = async () => {
      if (!user) return;
      
      try {
        const likedRef = collection(db, 'users', user.uid, 'liked_photos');
        const querySnapshot = await getDocs(likedRef);
        const liked = {};
        querySnapshot.forEach((doc) => {
          liked[doc.data().unsplashId] = doc.id;
        });
        setLikedPhotos(liked);
      } catch (error) {
        console.error('Error fetching liked photos:', error);
      }
    };

    fetchLikedPhotos();
  }, [user]);

  // --- Render Logic ---

  // Helper component to render a single photo item
  const renderPhotoItem = (photo, index) => (
    <div 
      key={photo.id} 
      className="group photo-card relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 ease-out transform hover:scale-105 hover:-translate-y-2 w-full sm:w-80 max-w-sm"
      style={{
        animationDelay: `${index * 100}ms`,
        animation: 'fadeInUp 0.8s ease-out forwards'
      }}
    >
      <div className="relative overflow-hidden rounded-t-2xl">
        <button
          onClick={() => handleLike(photo)}
          className="absolute top-3 left-3 z-10 p-3 rounded-full bg-white/20 backdrop-blur-md 
            hover:bg-white/40 transition-all duration-300 ease-out transform hover:scale-110
            group/heart shadow-lg"
        >
          {likedPhotos[photo.id] ? (
            <FaHeart className="text-red-500 text-lg group-hover/heart:animate-pulse drop-shadow-sm" />
          ) : (
            <FaRegHeart className="text-white text-lg group-hover/heart:text-red-300 transition-colors duration-300 drop-shadow-sm" />
          )}
        </button>
        
        <a href={photo.links.html} target="_blank" rel="noopener noreferrer" className="block">
          <div className="relative overflow-hidden">
            <img
              src={photo.urls.small}
              alt={photo.alt_description || "Unsplash Photo"}
              className="w-full h-64 object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
        </a>
      </div>
      
      <div className="p-4 space-y-2">
        <div className="text-gray-700 text-center">
          <span className="text-sm">Photo by </span>
          <a
            href={photo.user.links.html}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-purple-600 transition-colors duration-300 hover:underline"
          >
            {photo.user.name}
          </a>
        </div>
        {photo.description && (
          <p className="text-xs text-gray-600 text-center italic line-clamp-2 leading-relaxed">
            {photo.description}
          </p>
        )}
      </div>
    </div>
  );

  // Determine if the spinner should be shown
  const showSpinner = loading || (displayType === 'initial' && !loading && !error);

  return (
    <>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(168, 85, 247, 0.8);
          }
        }
        
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .photo-card {
          opacity: 0;
        }
        
        .animated-bg {
          background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe);
          background-size: 400% 400%;
          animation: gradient-shift 15s ease infinite;
        }
        
        .glass-button {
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .glass-button:hover {
          backdrop-filter: blur(16px);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        
        .spinner {
          background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
          background-size: 400% 400%;
          animation: gradient-shift 2s ease infinite, pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
      
      <div className="flex flex-col min-h-screen animated-bg p-4 relative overflow-hidden">
        {/* Floating background elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-purple-300/20 rounded-full blur-2xl" style={{animation: 'float 6s ease-in-out infinite'}} />
        <div className="absolute top-1/3 right-10 w-20 h-20 bg-pink-300/30 rounded-full blur-lg" style={{animation: 'float 4s ease-in-out infinite reverse'}} />
        
        {/* Auth Controls */}
        <div className="absolute top-6 right-6 z-20">
          {user ? (
            <div className="flex items-center gap-4 glass-button bg-white/10 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
              <img 
                src={user.photoURL} 
                alt={user.displayName} 
                className="w-8 h-8 rounded-full border-2 border-white/30"
              />
              <span className="text-white font-medium hidden md:block">{user.displayName}</span>
              <button
                onClick={logout}
                className="glass-button px-4 py-2 bg-red-500/80 hover:bg-red-600/90 text-white font-semibold rounded-full transition-all duration-300 ease-out hover:scale-105"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg"
            >
              Login with Google
            </button>
          )}
        </div>

        {/* Upload Button */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={() => {/* Add your upload logic here */}}
            className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
    Upload Photo
          </button>
        </div>
        
        {/* Header */}
        <div className="text-center mb-8 mt-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-4" style={{animation: 'fadeInUp 1s ease-out'}}>
            Photo Gallery
          </h1>
          <p className="text-lg md:text-xl text-white/80 drop-shadow" style={{animation: 'fadeInUp 1s ease-out 0.2s both'}}>
            Discover beautiful photography from around the world
          </p>
        </div>
        
        {/* Controls Area */}
        <div className="flex flex-col md:flex-row items-center justify-center space-y-3 md:space-y-0 md:space-x-4 mb-8 w-full mx-auto" style={{animation: 'fadeInUp 1s ease-out 0.4s both'}}>

          {/* Liked Photos Button */}
          <Link
            href="/like"
            className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto flex items-center justify-center gap-2 hover:shadow-lg"
          >
            <FaHeart className="text-red-400" />
            Liked Photos
          </Link>

          {/* Random Photo Buttons */}
          <button
            onClick={() => fetchRandomPhotos(1)}
            className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
            disabled={loading}
          >
            Get 1 Random Photo
          </button>

          <button
            onClick={() => fetchRandomPhotos(10)}
            className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
            disabled={loading}
          >
            Get 10 Random Photos
          </button>

          {/* Search Photos Input and Button */}
          <div className="flex w-full md:w-auto md:flex-grow max-w-sm space-x-2">
            <input
              type="text"
              placeholder="Search photos by keyword..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              className="flex-grow px-4 py-3 border-none rounded-full bg-white/20 backdrop-blur-md placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300"
              disabled={loading}
            />
            <button
              onClick={searchPhotos}
              className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
              disabled={loading}
            >
              Search
            </button>
          </div>

          {/* Get Photo by ID Input and Button */}
          <div className="flex w-full md:w-auto md:flex-grow max-w-sm space-x-2">
            <input
              type="text"
              placeholder="Enter Photo ID..."
              value={photoId}
              onChange={handlePhotoIdInputChange}
              className="flex-grow px-4 py-3 border-none rounded-full bg-white/20 backdrop-blur-md placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300"
              disabled={loading}
            />
            <button
              onClick={fetchPhotoById}
              className="glass-button bg-white/10 backdrop-blur-md text-white font-semibold rounded-full px-6 py-3 hover:bg-white/20 transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
              disabled={loading}
            >
              Get
            </button>
          </div>
        </div>

        {/* Loading, Error, and Results Area */}
        <div className="flex-grow w-full mx-auto overflow-y-auto mt-4 flex justify-center items-center min-h-[50vh]">

          {/* Enhanced Spinner */}
          {showSpinner && (
            <div className="flex flex-col items-center space-y-4">
              <div className="spinner w-16 h-16 rounded-full flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md"></div>
              </div>
              <p className="text-white/80 text-lg font-medium">Loading beautiful photos...</p>
            </div>
          )}

          {/* Enhanced Error Display */}
          {error && (
            <div className="text-center bg-red-500/20 backdrop-blur-md border border-red-300/30 rounded-2xl p-6 mx-4 max-w-md">
              <div className="text-red-100 text-lg font-semibold mb-2">Oops! Something went wrong</div>
              <div className="text-red-200 mb-4">{error.message}</div>
              <button 
                onClick={() => setError(null)} 
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 hover:scale-105"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Display Photos */}
          {!showSpinner && displayType === 'photos' && (
            photos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full px-4">
                {photos.map((photo, index) => renderPhotoItem(photo, index))}
              </div>
            ) : (
              !error && (
                <div className="text-center text-white/80 text-xl font-medium bg-white/10 backdrop-blur-md rounded-2xl p-8 mx-4">
                  <div className="text-3xl mb-4">🔍</div>
                  <div>No photos found. Try a different search.</div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </>
  );
}