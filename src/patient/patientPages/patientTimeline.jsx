import React, { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { db, auth } from "../../../firebase.config";
import { onAuthStateChanged } from "firebase/auth";
import { 
  Calendar, 
  TrendingUp, 
  Eye, 
  X,
  RefreshCw,
  CheckCircle,
  Clock,
  Activity
} from "lucide-react";

export default function PatientTimeline() {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [progressImages, setProgressImages] = useState([]);
  const [goalImages, setGoalImages] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingImage, setViewingImage] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
      } else {
        setCurrentUserId(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load all data when user is set
  useEffect(() => {
    if (!currentUserId) return;
    loadAllData();
  }, [currentUserId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadImages(),
        loadAppointments()
      ]);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  };

  const loadImages = async () => {
    try {
      // Load progress images
      const progressRef = collection(db, 'users', currentUserId, 'aiProgress');
      const qProgress = query(progressRef, orderBy('timestamp', 'desc'));
      const snapProgress = await getDocs(qProgress);
      const progress = snapProgress.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Load goals images
      const goalRef = collection(db, 'users', currentUserId, 'aiGoals');
      const qGoal = query(goalRef, orderBy('timestamp', 'desc'));
      const snapGoal = await getDocs(qGoal);
      const goals = snapGoal.docs.map((d) => ({ id: d.id, ...d.data() }));

      setProgressImages(progress);
      setGoalImages(goals);
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  };

  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded border border-gray-300 p-8 max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Please Log In</h3>
          <p className="text-sm text-gray-600">You need to be logged in to view your treatment timeline</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading your timeline...</p>
        </div>
      </div>
    );
  }

  const allImages = [...progressImages, ...goalImages];
  const filteredImages = selectedTab === 'all' 
    ? allImages 
    : selectedTab === 'progress' 
    ? progressImages 
    : goalImages;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1400px] mx-auto">
        {/* Filter Tabs */}
        <div className="bg-white rounded border border-gray-300 p-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTab('all')}
              className={`flex-1 px-4 py-2 rounded text-xs font-medium transition-all ${
                selectedTab === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Timeline ({allImages.length})
            </button>
            <button
              onClick={() => setSelectedTab('progress')}
              className={`flex-1 px-4 py-2 rounded text-xs font-medium transition-all ${
                selectedTab === 'progress'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Progress ({progressImages.length})
            </button>
            <button
              onClick={() => setSelectedTab('goals')}
              className={`flex-1 px-4 py-2 rounded text-xs font-medium transition-all ${
                selectedTab === 'goals'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Goals ({goalImages.length})
            </button>
          </div>
        </div>

        {/* Progress Images Section */}
        {(selectedTab === 'all' || selectedTab === 'progress') && progressImages.length > 0 && (
          <div className="bg-white rounded border border-gray-300 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-700">Progress Journey</h2>
              </div>
              <button
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50 text-gray-700 text-xs font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Reload
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {progressImages.map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative bg-gray-50 rounded border border-gray-300 overflow-hidden hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setViewingImage(img.imageUrl)}
                >
                  <div className="relative h-40">
                    <img 
                      src={img.imageUrl} 
                      alt={`Progress ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                    </div>

                    {/* Badge */}
                    <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-semibold">
                      Step {idx + 1}
                    </div>
                  </div>

                  <div className="p-2 bg-white border-t border-gray-200">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] font-medium">
                        {img.timestamp?.seconds
                          ? new Date(img.timestamp.seconds * 1000).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal Images Section */}
        {(selectedTab === 'all' || selectedTab === 'goals') && goalImages.length > 0 && (
          <div className="bg-white rounded border border-gray-300 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <h2 className="text-sm font-semibold text-gray-700">Treatment Goals</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {goalImages.map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative bg-gray-50 rounded border border-gray-300 overflow-hidden hover:border-green-400 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setViewingImage(img.imageUrl)}
                >
                  <div className="relative h-40">
                    <img 
                      src={img.imageUrl} 
                      alt={`Goal ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                    </div>

                    {/* Badge */}
                    <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-[10px] font-semibold">
                      Goal
                    </div>
                  </div>

                  <div className="p-2 bg-white border-t border-gray-200">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] font-medium">
                        {img.timestamp?.seconds
                          ? new Date(img.timestamp.seconds * 1000).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredImages.length === 0 && (
          <div className="bg-white rounded border border-gray-300 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-2">No Images Yet</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              {selectedTab === 'progress' && 'No progress images have been uploaded yet.'}
              {selectedTab === 'goals' && 'No goal images have been uploaded yet.'}
              {selectedTab === 'all' && 'Your treatment timeline will appear here once your dentist uploads images.'}
            </p>
          </div>
        )}
      </div>

      {/* Full Screen Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="max-w-5xl max-h-[90vh] relative">
            <img 
              src={viewingImage} 
              alt="Full view" 
              className="max-w-full max-h-[90vh] rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-4 -right-4 bg-white text-gray-700 p-2 rounded-full hover:bg-gray-100 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}