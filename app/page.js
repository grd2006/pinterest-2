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
      // setLoading(false); // Moved loading=false after state updates
      return data;
    } catch (err) {
      console.error("Fetch Error:", err); // Log the actual error
      setError(err);
      setPhotos([]); // Clear photos on fetch error
      setDisplayType("photos"); // Transition to photos display type even on error
      setLoading(false); // Set loading to false here on error
      return null; // Return null on error
    } finally {
        // Ensure loading is set to false in successful case too
        // Note: Setting loading=false *after* setPhotos/setDisplayType in successful paths is slightly better practice
    }
  };

  // Get Random Photo(s) - Unsplash API allows count parameter
  const fetchRandomPhotos = async (count = 10) => { // Changed default count to 10
    const data = await fetchData(`https://api.unsplash.com/photos/random?count=${count}`);
    if (data) {
      // The random endpoint returns an array if count > 1, a single object if count = 1
      setPhotos(Array.isArray(data) ? data : [data]);
      setDisplayType("photos");
    } else {
       setPhotos([]); // Ensure photos are cleared on error (redundant with fetchData catch, but safe)
       setDisplayType("photos"); // Transition to photos display type even on error
    }
     setLoading(false); // Set loading false after state updates in success
  };

  // Search Photos by Keyword
  const searchPhotos = async () => {
    if (!searchQuery.trim()) {
      setError(new Error("Please enter a search query."));
      setPhotos([]); // Clear previous photos
      setDisplayType("photos"); // Show empty photos area with error
      return;
    }
    // Unsplash search endpoint is different, results are in data.results
    const data = await fetchData(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}`);
    if (data && data.results) {
      setPhotos(data.results);
      setDisplayType("photos");
      if(data.total === 0) {
         setError(new Error(`No photos found for "${searchQuery}".`));
      }
    } else if (data && data.total === 0) {
       // API might return 200 with total: 0 and empty results array
       setPhotos([]);
       setError(new Error(`No photos found for "${searchQuery}".`));
       setDisplayType("photos");
    } else {
        setPhotos([]); // Clear photos on error (redundant with fetchData catch)
        setDisplayType("photos"); // Transition to photos display type even on error
    }
    setLoading(false); // Set loading false after state updates in success/no results
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
      setPhotos([data]); // Set as an array for consistent rendering
      setDisplayType("photos");
    } else {
       setPhotos([]); // Clear photos on error (redundant with fetchData catch)
       setDisplayType("photos"); // Transition to photos display type even on error
    }
    setLoading(false); // Set loading false after state updates in success
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
    // Only fetch initially if no data is loaded yet and not already loading/errored
    // displayType === 'initial' is key here for the first load
    if (displayType === 'initial' && photos.length === 0 && !loading && !error) {
       fetchRandomPhotos(10); // Fetch 10 random photos on mount
    }
  }, [ACCESS_KEY, displayType, photos.length, loading, error]); // Include dependencies

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

  // Helper component or inline JSX to render a single photo item
  const renderPhotoItem = (photo) => (
    <div key={photo.id} className="flex flex-col items-center p-2 bg-white/10 backdrop-blur-md rounded-lg shadow-md m-2 w-full sm:w-auto max-w-xs border border-white/20">
      <div className="relative w-full">
        <button
          onClick={() => handleLike(photo)}
          className="absolute top-2 left-2 p-2 rounded-full bg-white/20 backdrop-blur-md 
            hover:bg-white/40 transition-all duration-300 ease-out
            group"
        >
          {likedPhotos[photo.id] ? (
            <FaHeart className="text-red-500 text-xl group-hover:scale-110 transition-transform" />
          ) : (
            <FaRegHeart className="text-white text-xl group-hover:scale-110 transition-transform" />
          )}
        </button>
        <a href={photo.links.html} target="_blank" rel="noopener noreferrer">
          <img
            src={photo.urls.small}
            alt={photo.alt_description || "Unsplash Photo"}
            className="rounded-t-lg object-cover w-full h-48"
          />
        </a>
      </div>
      <div className="mt-2 text-gray-700 text-center text-sm">
        Photo by{" "}
        <a
          href={photo.user.links.html}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {photo.user.name}
        </a>
        {photo.description && <p className="text-xs mt-1 italic line-clamp-2">{photo.description}</p>}
      </div>
    </div>
  );

  // Determine if the spinner should be shown
  const showSpinner = loading || (displayType === 'initial' && !loading && !error);


  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-r from-cyan-200 to-fuchsia-200 p-4">
      {/* Auth Controls */}
      <div className="absolute top-4 right-4">
        {user ? (
          <div className="flex items-center gap-4">
            <img 
              src={user.photoURL} 
              alt={user.displayName} 
              className="w-8 h-8 rounded-full"
            />
            <span className="text-gray-700">{user.displayName}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition duration-200"
          >
            Login with Google
          </button>
        )}
      </div>
      
      {/* Controls Area */}
      <div className="flex flex-col md:flex-row items-center justify-center space-y-3 md:space-y-0 md:space-x-4 mb-6 w-full max-w-4xl mx-auto">

        {/* Liked Photos Button */}
        <Link
          href="/like"
          className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md 
            border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 
            transition-all duration-300 ease-out w-full md:w-auto flex items-center justify-center gap-2"
        >
          <FaHeart className="text-red-500" />
          Liked Photos
        </Link>

        {/* Random Photo Buttons */}
        <button
          onClick={() => fetchRandomPhotos(1)} // Fetch 1 random photo
          className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto"
          disabled={loading}
        >
          Get 1 Random Photo
        </button>

         <button
          onClick={() => fetchRandomPhotos(10)} // Fetch 10 random photos
          className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto"
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
                className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
            />
            <button
                onClick={searchPhotos}
                className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto"
                 disabled={loading}
            >
                Search Keyword
            </button>
        </div>

        {/* Get Photo by ID Input and Button */}
         <div className="flex w-full md:w-auto md:flex-grow max-w-sm space-x-2">
             <input
                 type="text"
                 placeholder="Enter Photo ID..."
                 value={photoId}
                 onChange={handlePhotoIdInputChange}
                 className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                 disabled={loading}
             />
             <button
                 onClick={fetchPhotoById}
                 className="px-4 py-2 bg-white/10 backdrop-blur-md text-gray-800 font-semibold rounded-md border border-white/20 shadow-sm hover:shadow-lg hover:shadow-white/20 hover:bg-white/20 transition-all duration-300 ease-out w-full md:w-auto"
                 disabled={loading}
             >
                 Get by ID
             </button>
         </div>


      </div> {/* End Controls Row */}


      {/* Loading, Error, and Results Area */}
      <div className="flex-grow w-full max-w-6xl mx-auto overflow-y-auto mt-4 flex justify-center items-center min-h-[50vh]"> {/* Added flex, centering, and min-h */}

        {/* Spinner */}
        {showSpinner && (
           <div
             className="p-3 custom-spinner-animation drop-shadow-2xl bg-gradient-to-bl from-pink-400 via-purple-400 to-indigo-600 h-30 w-30 aspect-square rounded-full"
           >
             <div
               className="rounded-full h-full w-full bg-slate-100 dark:bg-zinc-900 background-blur-md"
             ></div>
           </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center text-red-600 text-xl mt-4 mb-4">
            Error: {error.message}
            {/* Clear button */}
            <button onClick={() => setError(null)} className="ml-3 text-sm text-blue-700 hover:underline">
                Dismiss
            </button>
          </div>
        )}

        {/* Display Photos or "No photos" message */}
        {/* Only show this block if NOT showing the spinner AND displayType is 'photos' */}
        {!showSpinner && displayType === 'photos' && (
           photos.length > 0 ? (
             <div className="flex flex-wrap justify-center w-full"> {/* Flex container for photos, full width */}
               {photos.map(renderPhotoItem)}
             </div>
           ) : (
              // Only show "No photos" if no error (error is handled above)
              !error && <div className="text-center text-gray-700 text-xl mt-8">No photos found. Try a different search.</div>
           )
        )}

        {/* The original message is now replaced by the spinner */}
        {/* Original: (!loading && !error && displayType === 'initial') && (...) */}

      </div> {/* End Results Area */}

    </div> // End Main Container
  );
}